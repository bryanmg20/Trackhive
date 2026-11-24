"""The agent as the Task Scheduler runs it, against the Everything mock of
HU-133 and a fake Trackhive (HU-166).

Each test runs `python agent/agente.py --config …` as a process; with
TRACKHIVE_AGENTE_EXE (CI on Windows) it runs trackhive-agente.exe instead."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from urllib.parse import quote

from tests.apoyo_agente import (
    EVERYTHING_PASSWORD,
    ROOTS,
    TOKEN,
    FakeTrackhive,
    RunningMock,
    SilentServer,
    agent_command,
    closed_port,
    make_certificates,
    read_log,
    record_requests,
    run_agent,
    write_config,
)

from everything_http import fetch
from trackhive_agent import __version__
from trackhive_agent.infrastructure.everything_client import folders_query

EXIT_OK, EXIT_SYNC_FAILED, EXIT_INVALID_CONFIG = 0, 1, 2
NOTARIES, PERIODICALS, LETTERS = ROOTS


def everything_answer(mock: RunningMock, root: str, offset: int, count: int) -> bytes:
    """What the mock answers to the search of the sync."""
    status, _, body = fetch(mock.url + folders_query(root, offset, count), (mock.user, mock.password))
    assert status == 200
    return body


class AgentTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.folder = Path(tempfile.mkdtemp(prefix='trackhive-agente-'))
        self.addCleanup(shutil.rmtree, self.folder, ignore_errors=True)

    def assertExit(self, result: subprocess.CompletedProcess[str], code: int) -> None:  # noqa: N802
        self.assertEqual(result.returncode, code, f'stdout:\n{result.stdout}\nstderr:\n{result.stderr}')


class CompleteRunTest(AgentTestCase):
    def test_every_page_of_every_root_as_everything_answers_it_numbered_across_the_run(self) -> None:
        with RunningMock() as mock, FakeTrackhive() as trackhive:
            config = write_config(self.folder, mock.url, trackhive.url, everything={'page_size': 50})
            result = run_agent(config)
            # 124 notaries in pages of 50, then the 6 periodicals and the 3 letters
            expected = [
                everything_answer(mock, root, offset, 50)
                for root, offset in ((NOTARIES, 0), (NOTARIES, 50), (NOTARIES, 100), (PERIODICALS, 0), (LETTERS, 0))
            ]

        self.assertExit(result, EXIT_OK)
        self.assertEqual(trackhive.operations(), ['start', 'page:1', 'page:2', 'page:3', 'page:4', 'page:5', 'close'])
        pages = trackhive.pages()
        self.assertEqual([pages[number] for number in range(1, 6)], expected)
        self.assertEqual(trackhive.closes(), [{'result': 'OK', 'pageCount': 5}])

        log = read_log(config)
        self.assertIn(f'Corrida {trackhive.run_id} completa con 5 páginas: 117 carpetas hoja', log)
        self.assertNotIn(TOKEN, log)
        self.assertNotIn(EVERYTHING_PASSWORD, log)

    def test_asks_everything_for_folders_only_under_each_root_200_per_page(self) -> None:
        with RunningMock() as mock, FakeTrackhive() as trackhive:
            config = write_config(self.folder, mock.url, trackhive.url)
            queries = record_requests(mock)
            result = run_agent(config)

        self.assertExit(result, EXIT_OK)
        # The first query only checks that Everything answers
        self.assertEqual(queries, [folders_query(NOTARIES, 0, 1), *(folders_query(root, 0, 200) for root in ROOTS)])
        self.assertTrue(all(f'folder%3A%20%22{quote(root, safe="")}%5C%22' in query for root, query in zip(ROOTS, queries[1:])))
        self.assertEqual(trackhive.closes(), [{'result': 'OK', 'pageCount': 3}])

    def test_trackhive_answering_again_after_a_while_gets_the_same_page_again(self) -> None:
        with RunningMock() as mock, FakeTrackhive() as trackhive:
            trackhive.fail('page:2', (503, 'SERVICE_UNAVAILABLE'), (0, None))
            config = write_config(self.folder, mock.url, trackhive.url)
            result = run_agent(config)

        self.assertExit(result, EXIT_OK)
        self.assertEqual(trackhive.operations().count('page:2'), 3)
        self.assertEqual(trackhive.closes(), [{'result': 'OK', 'pageCount': 3}])
        log = read_log(config)
        self.assertIn('Enviar la página 2: Trackhive respondió 503 SERVICE_UNAVAILABLE', log)
        self.assertIn('Intento 2 de 3 en 0.05 s', log)
        self.assertIn('Intento 3 de 3 en 0.1 s', log)


class EverythingFailsTest(AgentTestCase):
    def assertClosedWithError(self, trackhive: FakeTrackhive, config: Path, reason: str) -> None:  # noqa: N802
        self.assertEqual(trackhive.operations(), ['start', 'close'])
        [close] = trackhive.closes()
        self.assertEqual(close['result'], 'ERROR')
        self.assertNotIn('pageCount', close)
        self.assertIn(reason, close['errorMessage'])
        self.assertIn(reason, read_log(config))

    def test_everything_closed_ends_the_run_with_an_error(self) -> None:
        with FakeTrackhive() as trackhive:
            config = write_config(self.folder, f'http://127.0.0.1:{closed_port()}', trackhive.url)
            result = run_agent(config)
        self.assertExit(result, EXIT_SYNC_FAILED)
        self.assertClosedWithError(trackhive, config, 'rechazó la conexión')

    def test_everything_slower_than_the_timeout_ends_the_run_with_an_error(self) -> None:
        with SilentServer() as silent, FakeTrackhive() as trackhive:
            config = write_config(self.folder, silent.url, trackhive.url, everything={'timeout_seconds': 1})
            result = run_agent(config)
        self.assertExit(result, EXIT_SYNC_FAILED)
        self.assertClosedWithError(trackhive, config, 'no respondió en 1 s')

    def test_a_wrong_password_of_everything_ends_the_run_with_an_error(self) -> None:
        with RunningMock(password='otra-contraseña') as mock, FakeTrackhive() as trackhive:
            config = write_config(self.folder, mock.url, trackhive.url)
            result = run_agent(config)
        self.assertExit(result, EXIT_SYNC_FAILED)
        self.assertClosedWithError(trackhive, config, '401')


class TrackhiveFailsTest(AgentTestCase):
    def test_trackhive_down_is_retried_and_the_agent_ends_with_an_error(self) -> None:
        with RunningMock() as mock:
            config = write_config(self.folder, mock.url, f'http://127.0.0.1:{closed_port()}')
            result = run_agent(config)
        self.assertExit(result, EXIT_SYNC_FAILED)
        log = read_log(config)
        self.assertIn('Iniciar la corrida: Trackhive no responde', log)
        self.assertIn('Intento 3 de 3', log)
        self.assertIn('No se pudo iniciar la corrida en Trackhive', log)
        self.assertIn('tras 3 intentos', log)

    def test_a_wrong_token_is_not_retried(self) -> None:
        with RunningMock() as mock, FakeTrackhive(token='d' * 64) as trackhive:
            config = write_config(self.folder, mock.url, trackhive.url)
            result = run_agent(config)
        self.assertExit(result, EXIT_SYNC_FAILED)
        self.assertEqual(trackhive.operations(), ['start'])
        self.assertIn('EVERYTHING_AGENT_TOKEN', read_log(config))


class RefusesToRunTest(AgentTestCase):
    def test_refuses_an_http_trackhive_that_is_not_this_pc_and_connects_to_nothing(self) -> None:
        with RunningMock() as mock:
            queries = record_requests(mock)
            config = write_config(self.folder, mock.url, 'http://trackhive.example.org')
            result = run_agent(config)
        self.assertExit(result, EXIT_INVALID_CONFIG)
        self.assertEqual(queries, [])
        self.assertIn('debe empezar por https://', read_log(config))

    def test_refuses_a_short_token_without_showing_it(self) -> None:
        with FakeTrackhive() as trackhive:
            config = write_config(self.folder, 'http://127.0.0.1:8081', trackhive.url, trackhive={'token': 'corto-1234'})
            result = run_agent(config)
        self.assertExit(result, EXIT_INVALID_CONFIG)
        self.assertEqual(trackhive.calls, [])
        log = read_log(config)
        self.assertIn('al menos 32 caracteres', log)
        self.assertNotIn('corto-1234', log)

    def test_without_its_configuration_it_says_how_to_create_it(self) -> None:
        result = run_agent(self.folder / 'agente.toml')
        self.assertExit(result, EXIT_INVALID_CONFIG)
        self.assertIn('agente.example.toml', read_log(self.folder / 'agente.toml'))

    def test_version(self) -> None:
        result = subprocess.run([*agent_command(), '--version'], capture_output=True, text=True, timeout=60)
        self.assertExit(result, EXIT_OK)
        self.assertIn(__version__, result.stdout)


class HttpsTest(AgentTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.certificates = make_certificates(self.folder)
        if self.certificates is None:
            self.skipTest('Sin openssl no se pueden crear los certificados de prueba')

    def test_a_complete_run_over_https(self) -> None:
        with RunningMock() as mock, FakeTrackhive(tls=self.certificates.server_context()) as trackhive:
            config = write_config(self.folder, mock.url, trackhive.url, trackhive={'ca_file': str(self.certificates.ca)})
            result = run_agent(config)
        self.assertExit(result, EXIT_OK)
        self.assertTrue(trackhive.url.startswith('https://'))
        self.assertEqual(trackhive.closes(), [{'result': 'OK', 'pageCount': 3}])

    def test_an_untrusted_certificate_stops_the_agent_before_it_sends_anything(self) -> None:
        with RunningMock() as mock, FakeTrackhive(tls=self.certificates.server_context()) as trackhive:
            config = write_config(self.folder, mock.url, trackhive.url)
            result = run_agent(config)
        self.assertExit(result, EXIT_SYNC_FAILED)
        self.assertEqual(trackhive.calls, [])
        log = read_log(config)
        self.assertIn('No se pudo verificar el certificado de Trackhive', log)
        self.assertNotIn('Intento 2', log)


if __name__ == '__main__':
    unittest.main()
