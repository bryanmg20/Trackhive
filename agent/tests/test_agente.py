"""The agent as the Task Scheduler runs it, against the Everything mock of
HU-133 and a fake Trackhive (HU-166).

Each test runs `python agent/agente.py --config …` as a process; with
TRACKHIVE_AGENTE_EXE (CI on Windows) it runs trackhive-agente.exe instead."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
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
    start_watch,
    stop,
    wait_until,
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
        # The first three queries check that every root has folders
        self.assertEqual(
            queries, [*(folders_query(root, 0, 1) for root in ROOTS), *(folders_query(root, 0, 200) for root in ROOTS)]
        )
        self.assertTrue(all(f'folder%3A%20%22{quote(root, safe="")}%5C%22' in query for root, query in zip(ROOTS, queries[3:])))
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

    def test_a_root_with_a_typo_ends_the_run_with_an_error_and_never_complete(self) -> None:
        # Everything finds nothing under it: closing complete would leave the
        # whole fund as «copia digital no encontrada»
        typo = LETTERS.replace('Correspondencia', 'Corespondencia')
        with RunningMock() as mock, FakeTrackhive() as trackhive:
            config = write_config(self.folder, mock.url, trackhive.url, everything={'roots': [NOTARIES, PERIODICALS, typo]})
            result = run_agent(config)
        self.assertExit(result, EXIT_SYNC_FAILED)
        self.assertEqual(trackhive.operations(), ['start', 'page:1', 'page:2', 'close'])
        [close] = trackhive.closes()
        self.assertEqual(close['result'], 'ERROR')
        self.assertIn(f'ninguna carpeta bajo {typo}', close['errorMessage'])

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


class WatchTest(AgentTestCase):
    """--vigilar, as the task «Atender Sincronizar ahora» starts it (HU-138):
    the agent keeps asking Trackhive until it is stopped."""

    def test_takes_the_run_an_administrator_asked_for_and_keeps_asking(self) -> None:
        with RunningMock() as mock, FakeTrackhive() as trackhive:
            trackhive.requested_at = '2026-11-24T15:00:00.000Z'
            config = write_config(self.folder, mock.url, trackhive.url, trackhive={'poll_seconds': 0.2})
            process = start_watch(config)
            try:
                closed = wait_until(lambda: 'close' in trackhive.operations())
                # After the run it goes on asking: the run is no longer PEDIDA
                asked_again = wait_until(lambda: trackhive.operations()[-1] == 'requested')
                running = process.poll() is None
            finally:
                stop(process)

        self.assertTrue(closed, trackhive.operations())
        self.assertTrue(asked_again, trackhive.operations())
        self.assertTrue(running, 'el agente con --vigilar no debe terminar solo')
        operations = trackhive.operations()
        self.assertEqual(operations[: operations.index('close') + 1], ['requested', 'start', 'page:1', 'page:2', 'page:3', 'close'])
        self.assertEqual(operations.count('start'), 1)
        self.assertEqual(trackhive.closes(), [{'result': 'OK', 'pageCount': 3}])

        log = read_log(config, 'vigilancia.log')
        self.assertIn('Atendiendo «Sincronizar ahora»', log)
        self.assertIn('Un administrador pidió «Sincronizar ahora»', log)
        self.assertIn(f'Corrida {trackhive.run_id} completa con 3 páginas', log)
        self.assertNotIn(TOKEN, log)
        self.assertNotIn(EVERYTHING_PASSWORD, log)
        # The daily run keeps its own log
        self.assertEqual(read_log(config), '')

    def test_without_a_requested_run_it_only_asks(self) -> None:
        with RunningMock() as mock, FakeTrackhive() as trackhive:
            config = write_config(self.folder, mock.url, trackhive.url, trackhive={'poll_seconds': 0.1})
            queries = record_requests(mock)
            process = start_watch(config)
            try:
                asked = wait_until(lambda: trackhive.operations().count('requested') >= 3)
            finally:
                stop(process)

        self.assertTrue(asked, trackhive.operations())
        self.assertEqual(set(trackhive.operations()), {'requested'})
        self.assertEqual(queries, [])

    def test_trackhive_down_does_not_stop_the_watch(self) -> None:
        config = write_config(self.folder, 'http://127.0.0.1:8081', f'http://127.0.0.1:{closed_port()}', trackhive={'poll_seconds': 0.1})
        process = start_watch(config)
        try:
            logged = wait_until(lambda: 'No se pudo preguntar a Trackhive' in read_log(config, 'vigilancia.log'))
            alive = wait_until(lambda: process.poll() is None, timeout=1)
        finally:
            stop(process)

        self.assertTrue(logged)
        self.assertTrue(alive)
        # Logged once, not at every question
        self.assertEqual(read_log(config, 'vigilancia.log').count('No se pudo preguntar a Trackhive'), 1)

    @unittest.skipUnless(
        sys.platform == 'win32' and os.environ.get('TRACKHIVE_AGENTE_EXE'),
        'Solo el .exe de Windows es un lanzador con el agente como hijo',
    )
    def test_when_the_task_ends_the_launcher_the_agent_ends_too(self) -> None:
        # The Task Scheduler stops a task by ending the process it started:
        # the launcher of the .exe, not the agent it started
        with FakeTrackhive() as trackhive:
            config = write_config(self.folder, 'http://127.0.0.1:8081', trackhive.url, trackhive={'poll_seconds': 30})
            process = start_watch(config)
            try:
                asked = wait_until(lambda: 'requested' in trackhive.operations())
                process.terminate()
                process.wait(timeout=30)
                ended = wait_until(lambda: 'se deja de atender' in read_log(config, 'vigilancia.log'), timeout=15)
            finally:
                stop(process)

        self.assertTrue(asked)
        self.assertTrue(ended, read_log(config, 'vigilancia.log'))

    def test_a_wrong_configuration_ends_it_at_once_with_code_2(self) -> None:
        with FakeTrackhive() as trackhive:
            config = write_config(self.folder, 'http://127.0.0.1:8081', trackhive.url, trackhive={'token': 'corto'})
            result = subprocess.run(
                [*agent_command(), '--vigilar', '--config', str(config)], capture_output=True, text=True, timeout=60
            )
        self.assertExit(result, EXIT_INVALID_CONFIG)
        self.assertEqual(trackhive.calls, [])
        self.assertIn('al menos 32 caracteres', read_log(config, 'vigilancia.log'))


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
