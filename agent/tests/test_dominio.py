"""Rules of the agent: the run, the pages of Everything and where it may connect (HU-166)."""

from __future__ import annotations

import unittest

from trackhive_agent.domain.agent_run import (
    MAX_ERROR_MESSAGE_LENGTH,
    NO_PAGES,
    AgentRun,
    fit_error_message,
    utf16_length,
)
from trackhive_agent.domain.connection_policy import is_loopback, local_everything_url, secure_trackhive_url
from trackhive_agent.domain.errors import EverythingError, InvalidConfigError
from trackhive_agent.domain.everything_page import EverythingPage


class AgentRunTest(unittest.TestCase):
    def test_pages_are_numbered_from_one_without_gaps(self) -> None:
        run = AgentRun('run-1')
        for number in (1, 2, 3):
            self.assertEqual(run.next_page_number(), number)
            run.page_sent(number)
        with self.assertRaises(ValueError):
            run.page_sent(5)
        self.assertEqual(run.pages_sent, 3)

    def test_closes_complete_with_the_number_of_pages_sent(self) -> None:
        run = AgentRun('run-1')
        run.page_sent(1)
        run.page_sent(2)
        request = run.close_request()
        self.assertTrue(request.complete)
        self.assertEqual((request.result, request.page_count, request.error_message), ('OK', 2, None))

    def test_after_a_failure_it_never_closes_complete(self) -> None:
        run = AgentRun('run-1')
        run.page_sent(1)
        run.fail('Everything no respondió en 30 s')
        run.fail('otro motivo posterior')
        request = run.close_request()
        self.assertFalse(request.complete)
        self.assertEqual((request.result, request.page_count), ('ERROR', None))
        # The first reason stays
        self.assertEqual(request.error_message, 'Everything no respondió en 30 s')
        with self.assertRaises(ValueError):
            run.page_sent(2)

    def test_a_run_without_pages_closes_with_an_error(self) -> None:
        request = AgentRun('run-1').close_request()
        self.assertEqual((request.result, request.error_message), ('ERROR', NO_PAGES))

    def test_the_reason_fits_the_limit_of_trackhive(self) -> None:
        long = fit_error_message('x' * 5000)
        self.assertEqual(len(long), MAX_ERROR_MESSAGE_LENGTH)
        self.assertTrue(long.endswith('…'))
        self.assertEqual(fit_error_message('  corto  '), 'corto')
        self.assertTrue(fit_error_message('   '))

    def test_the_limit_counts_utf16_units_like_the_backend(self) -> None:
        # An emoji is one character in Python and two UTF-16 units in JavaScript
        fitted = fit_error_message('😀' * 600)
        self.assertLessEqual(utf16_length(fitted), MAX_ERROR_MESSAGE_LENGTH)
        self.assertEqual(set(fitted[:-1]), {'😀'})
        self.assertEqual(fitted[-1], '…')
        self.assertEqual(fit_error_message('😀' * 500), '😀' * 500)

    def test_needs_the_id_of_the_run(self) -> None:
        with self.assertRaises(ValueError):
            AgentRun('')


class EverythingPageTest(unittest.TestCase):
    def test_next_offset_until_every_result_arrived(self) -> None:
        # 124 folders in pages of 50, like the fixtures of the notaries
        self.assertEqual(EverythingPage(b'', 124, 50).next_offset(0), 50)
        self.assertEqual(EverythingPage(b'', 124, 50).next_offset(50), 100)
        self.assertIsNone(EverythingPage(b'', 124, 24).next_offset(100))

    def test_an_exact_multiple_ends_without_an_empty_page(self) -> None:
        self.assertIsNone(EverythingPage(b'', 400, 200).next_offset(200))

    def test_an_empty_page_ends_the_root(self) -> None:
        self.assertIsNone(EverythingPage(b'', 0, 0).next_offset(0))
        # The index shrank between two pages: no endless loop
        self.assertIsNone(EverythingPage(b'', 500, 0).next_offset(200))

    def test_rejects_negative_counts(self) -> None:
        with self.assertRaises(EverythingError):
            EverythingPage(b'', -1, 0)


class ConnectionPolicyTest(unittest.TestCase):
    def test_trackhive_only_by_https(self) -> None:
        self.assertEqual(secure_trackhive_url('https://trackhive.example.org/'), 'https://trackhive.example.org')
        self.assertEqual(secure_trackhive_url('https://uni.example.org/trackhive/'), 'https://uni.example.org/trackhive')
        for url in ('http://trackhive.example.org', 'http://192.168.0.30:3000', 'ftp://trackhive.example.org', 'trackhive'):
            with self.subTest(url=url), self.assertRaises(InvalidConfigError):
                secure_trackhive_url(url)

    def test_http_only_against_this_pc_in_development(self) -> None:
        for url in ('http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'http://LOCALHOST'):
            with self.subTest(url=url):
                self.assertTrue(secure_trackhive_url(url).startswith('http://'))

    def test_the_message_says_why_and_never_shows_a_password(self) -> None:
        with self.assertRaises(InvalidConfigError) as http:
            secure_trackhive_url('http://trackhive.example.org')
        self.assertIn('https://', str(http.exception))
        with self.assertRaises(InvalidConfigError) as credentials:
            secure_trackhive_url('https://agente:secreto@trackhive.example.org')
        self.assertNotIn('secreto', str(credentials.exception))

    def test_rejects_query_fragment_and_wrong_ports(self) -> None:
        for url in ('https://trackhive.example.org/?a=1', 'https://trackhive.example.org/#x', 'https://trackhive.example.org:99999'):
            with self.subTest(url=url), self.assertRaises(InvalidConfigError):
                secure_trackhive_url(url)

    def test_everything_only_on_this_pc(self) -> None:
        self.assertEqual(local_everything_url('http://127.0.0.1:8081/'), 'http://127.0.0.1:8081')
        self.assertEqual(local_everything_url('http://localhost:8081'), 'http://localhost:8081')
        for url in ('http://192.168.0.30:8081', 'http://everything-mock:8081', 'http://pc-clena:8081'):
            with self.subTest(url=url), self.assertRaises(InvalidConfigError):
                local_everything_url(url)

    def test_loopback(self) -> None:
        self.assertTrue(is_loopback('127.0.0.5'))
        self.assertTrue(is_loopback('::1'))
        self.assertFalse(is_loopback('10.0.0.1'))
        self.assertFalse(is_loopback('localhost.example.org'))


if __name__ == '__main__':
    unittest.main()
