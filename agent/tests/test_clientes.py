"""The HTTP adapters: Everything against the mock of HU-133 and the fixtures
of the real one, Trackhive against a fake with the contract of HU-137 (HU-166)."""

from __future__ import annotations

import json
import ssl
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from tests.apoyo_agente import (
    EVERYTHING_PASSWORD,
    EVERYTHING_USER,
    ROOTS,
    TOKEN,
    FakeTrackhive,
    RunningMock,
    SilentServer,
    closed_port,
    make_certificates,
)

from everything_http import CAPTURES_FILE, FIXTURES, load_json, mask_dates
from trackhive_agent.domain.agent_run import CloseRequest
from trackhive_agent.domain.errors import (
    EverythingError,
    EverythingUnavailableError,
    TrackhiveError,
    TrackhiveUnavailableError,
)
from trackhive_agent.infrastructure.everything_client import EverythingHttpClient, folders_query
from trackhive_agent.infrastructure.tls import trackhive_tls_context
from trackhive_agent.infrastructure.trackhive_client import TrackhiveHttpClient

NOTARIES = ROOTS[0]


def capture(capture_id: str) -> dict:
    return next(c for c in load_json(CAPTURES_FILE)['capturas'] if c['id'] == capture_id)


class StaticServer:
    """Answers every GET with the same status, headers and body."""

    def __init__(self, status: int, body: bytes, headers: dict[str, str] | None = None) -> None:
        answer = (status, body, headers or {})

        class Handler(BaseHTTPRequestHandler):
            def _serve(self) -> None:
                self.rfile.read(int(self.headers.get('Content-Length') or 0))
                self.send_response(answer[0])
                for name, value in answer[2].items():
                    self.send_header(name, value)
                self.send_header('Content-Length', str(len(answer[1])))
                self.end_headers()
                self.wfile.write(answer[1])

            do_GET = do_POST = do_PUT = _serve  # noqa: N815

            def log_message(self, format: str, *args: object) -> None:  # noqa: A002
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def __enter__(self) -> 'StaticServer':
        return self

    def __exit__(self, *exc: object) -> None:
        self.server.shutdown()
        self.server.server_close()


class EverythingClientTest(unittest.TestCase):
    def client(self, url: str, password: str = EVERYTHING_PASSWORD, timeout: float = 5) -> EverythingHttpClient:
        return EverythingHttpClient(url, EVERYTHING_USER, password, timeout)

    def test_asks_exactly_the_search_of_the_sync_captured_from_the_real_everything(self) -> None:
        # folder: + the root with its final backslash, the three columns, offset and count
        for capture_id, offset in (('carpetas_notarias_p1', 0), ('carpetas_notarias_p2', 50), ('carpetas_notarias_p3', 100)):
            with self.subTest(capture_id=capture_id):
                self.assertEqual(folders_query(NOTARIES, offset, 50), capture(capture_id)['pathQuery'])
        self.assertEqual(folders_query(NOTARIES + '\\', 0, 50), folders_query(NOTARIES, 0, 50))

    def test_the_page_comes_byte_for_byte_as_the_real_everything_answers_it(self) -> None:
        with RunningMock() as mock:
            page = self.client(mock.url).folders_under(NOTARIES, 0, 50)
        fixture = (FIXTURES / capture('carpetas_notarias_p1')['archivo']).read_bytes()
        self.assertEqual(mask_dates(page.body), mask_dates(fixture))
        self.assertEqual((page.total_results, page.results), (124, 50))
        self.assertEqual(page.next_offset(0), 50)

    def test_a_wrong_password_is_an_error_that_is_not_waited_for(self) -> None:
        with RunningMock() as mock:
            with self.assertRaises(EverythingError) as refused:
                self.client(mock.url, password='incorrecta').folders_under(NOTARIES, 0, 1)
        self.assertNotIsInstance(refused.exception, EverythingUnavailableError)
        self.assertIn('401', str(refused.exception))
        self.assertNotIn('incorrecta', str(refused.exception))

    def test_everything_closed_does_not_answer(self) -> None:
        with self.assertRaises(EverythingUnavailableError) as down:
            self.client(f'http://127.0.0.1:{closed_port()}').folders_under(NOTARIES, 0, 1)
        self.assertIn('rechazó la conexión', str(down.exception))

    def test_everything_slower_than_the_timeout_does_not_answer(self) -> None:
        with SilentServer() as silent:
            started = time.monotonic()
            with self.assertRaises(EverythingUnavailableError) as slow:
                self.client(silent.url, timeout=0.5).folders_under(NOTARIES, 0, 1)
        self.assertIn('no respondió en 0.5 s', str(slow.exception))
        self.assertLess(time.monotonic() - started, 5)

    def test_an_answer_that_is_not_a_search(self) -> None:
        for status, body in ((200, b'<html>otro servidor</html>'), (200, b'{"results": []}'), (500, b'')):
            with self.subTest(status=status, body=body), StaticServer(status, body) as other:
                with self.assertRaises(EverythingError) as wrong:
                    self.client(other.url).folders_under(NOTARIES, 0, 1)
                self.assertNotIsInstance(wrong.exception, EverythingUnavailableError)


class TrackhiveClientTest(unittest.TestCase):
    def client(self, url: str, token: str = TOKEN, context: ssl.SSLContext | None = None) -> TrackhiveHttpClient:
        return TrackhiveHttpClient(url, token, 5, 5, context)

    def test_the_three_ingest_endpoints_with_the_token_of_the_agent(self) -> None:
        page = b'{\r\n\t"totalResults":0,\r\n\t"results":[\r\n\t]\r\n}\r\n'
        with FakeTrackhive() as fake:
            client = self.client(fake.url)
            run_id = client.start_run()
            client.send_page(run_id, 1, page)
            closed = client.close_run(run_id, CloseRequest('OK', page_count=1))

        self.assertEqual(run_id, fake.run_id)
        start, sent, close = fake.calls
        self.assertEqual((start.method, start.path), ('POST', '/api/v1/everything/sync-runs'))
        self.assertEqual((sent.method, sent.path), ('PUT', f'/api/v1/everything/sync-runs/{run_id}/pages/1'))
        self.assertEqual((close.method, close.path), ('POST', f'/api/v1/everything/sync-runs/{run_id}/close'))
        # The page as Everything answered it, CRLF and tabs included
        self.assertEqual(sent.body, page)
        self.assertEqual(sent.headers['Content-Type'], 'application/json')
        self.assertTrue(all(call.headers['Authorization'] == f'Bearer {TOKEN}' for call in fake.calls))
        self.assertEqual(json.loads(close.body), {'result': 'OK', 'pageCount': 1})
        self.assertEqual(closed.status, 'OK')
        self.assertEqual(closed.summary.leaves, 117)

    def test_closing_with_an_error_sends_the_reason(self) -> None:
        with FakeTrackhive() as fake:
            closed = self.client(fake.url).close_run(fake.run_id, CloseRequest('ERROR', error_message='Everything no respondió en 30 s'))
        self.assertEqual(json.loads(fake.calls[0].body), {'result': 'ERROR', 'errorMessage': 'Everything no respondió en 30 s'})
        self.assertEqual((closed.status, closed.summary), ('ERROR', None))

    def test_errors_that_a_retry_may_fix_and_errors_it_will_not(self) -> None:
        cases = [
            ((503, 'SERVICE_UNAVAILABLE'), TrackhiveUnavailableError),
            ((500, 'INTERNAL_ERROR'), TrackhiveUnavailableError),
            ((502, None), TrackhiveUnavailableError),
            ((0, None), TrackhiveUnavailableError),
            ((503, 'EVERYTHING_SYNC_DISABLED'), TrackhiveError),
            ((409, 'SYNC_RUN_ALREADY_RUNNING'), TrackhiveError),
            ((413, 'PAYLOAD_TOO_LARGE'), TrackhiveError),
            ((400, 'INVALID_EVERYTHING_PAGE'), TrackhiveError),
        ]
        for failure, expected in cases:
            with self.subTest(failure=failure), FakeTrackhive() as fake:
                fake.fail('start', failure)
                with self.assertRaises(TrackhiveError) as raised:
                    self.client(fake.url).start_run()
                self.assertIs(type(raised.exception), expected)
                if failure[0]:
                    self.assertEqual((raised.exception.status, raised.exception.code), failure)

    def test_a_wrong_token_is_not_retried_and_never_shown(self) -> None:
        with FakeTrackhive() as fake:
            with self.assertRaises(TrackhiveError) as refused:
                self.client(fake.url, token='c' * 64).start_run()
        self.assertNotIsInstance(refused.exception, TrackhiveUnavailableError)
        self.assertIn('EVERYTHING_AGENT_TOKEN', str(refused.exception))
        self.assertNotIn('c' * 64, str(refused.exception))

    def test_trackhive_down_may_answer_later(self) -> None:
        with self.assertRaises(TrackhiveUnavailableError):
            self.client(f'http://127.0.0.1:{closed_port()}').start_run()

    def test_never_follows_a_redirection_nor_gives_the_token_to_another_server(self) -> None:
        with FakeTrackhive() as other:
            location = {'Location': other.url + '/api/v1/everything/sync-runs'}
            with StaticServer(307, b'', location) as redirecting:
                with self.assertRaises(TrackhiveError) as refused:
                    self.client(redirecting.url).start_run()
        self.assertIn('redirección', str(refused.exception))
        self.assertEqual(other.calls, [])


class HttpsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.folder = tempfile.TemporaryDirectory()
        cls.certificates = make_certificates(Path(cls.folder.name))
        if cls.certificates is None:
            cls.folder.cleanup()
            raise unittest.SkipTest('Sin openssl no se pueden crear los certificados de prueba')

    @classmethod
    def tearDownClass(cls) -> None:
        cls.folder.cleanup()

    def test_with_a_certificate_it_trusts_it_connects(self) -> None:
        with FakeTrackhive(tls=self.certificates.server_context()) as fake:
            client = TrackhiveHttpClient(fake.url, TOKEN, 5, 5, trackhive_tls_context(self.certificates.ca))
            self.assertEqual(client.start_run(), fake.run_id)
        self.assertTrue(fake.url.startswith('https://'))

    def test_with_a_certificate_it_does_not_trust_it_sends_nothing_and_does_not_retry(self) -> None:
        # The CA of the test is not in the store of the system
        with FakeTrackhive(tls=self.certificates.server_context()) as fake:
            client = TrackhiveHttpClient(fake.url, TOKEN, 5, 5, trackhive_tls_context(None))
            with self.assertRaises(TrackhiveError) as refused:
                client.start_run()
        self.assertNotIsInstance(refused.exception, TrackhiveUnavailableError)
        self.assertIn('certificado', str(refused.exception))
        self.assertEqual(fake.calls, [])

    def test_the_context_always_verifies_the_certificate_and_the_name(self) -> None:
        for context in (trackhive_tls_context(None), trackhive_tls_context(self.certificates.ca)):
            with self.subTest(context=type(context).__module__):
                self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
                self.assertTrue(context.check_hostname)
                self.assertEqual(context.minimum_version, ssl.TLSVersion.TLSv1_2)


if __name__ == '__main__':
    unittest.main()
