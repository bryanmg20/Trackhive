"""The sync use case with fakes in memory and a fake clock (HU-166), as D-21 in the backend."""

from __future__ import annotations

import json
import logging
import unittest

from trackhive_agent.application.dto import ClosedRun, RunSummary, SyncSettings
from trackhive_agent.application.retrier import MAX_DELAY_SECONDS, Retrier, RetryPolicy
from trackhive_agent.application.synchronize import SynchronizeUseCase
from trackhive_agent.domain.agent_run import CloseRequest
from trackhive_agent.domain.errors import (
    EverythingError,
    EverythingUnavailableError,
    TrackhiveError,
    TrackhiveUnavailableError,
)
from trackhive_agent.domain.everything_page import EverythingPage

NOTARIES, PERIODICALS, LETTERS = 'C:\\docs\\Notarías', 'C:\\docs\\Periódicos', 'C:\\docs\\Correspondencia'
SUMMARY = RunSummary(leaves=117, created=84, updated=33, not_found=0, for_review=11)

# The tests read the log with assertLogs; nothing goes to the console
LOGGER = logging.getLogger('trackhive_agent.pruebas')
LOGGER.addHandler(logging.NullHandler())
LOGGER.propagate = False


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class FakeEverything:
    """Folders per root. failures[n] is raised on call number n (the first
    call is the check that Everything answers)."""

    def __init__(self, folders: dict[str, int]) -> None:
        self.folders = folders
        self.calls: list[tuple[str, int, int]] = []
        self.failures: dict[int, Exception] = {}
        # Calls answered with an empty index, as Everything just opened
        self.empty: set[int] = set()

    def folders_under(self, root: str, offset: int, count: int) -> EverythingPage:
        self.calls.append((root, offset, count))
        failure = self.failures.get(len(self.calls))
        if failure is not None:
            raise failure
        total = 0 if len(self.calls) in self.empty else self.folders[root]
        results = max(0, min(count, total - offset))
        body = json.dumps({'totalResults': total, 'results': [{}] * results, 'root': root, 'offset': offset})
        return EverythingPage(body.encode('utf-8'), total, results)


class FakeTrackhive:
    """The port of Trackhive in memory. failures['start'|'close'|n] are raised in order."""

    def __init__(self) -> None:
        self.started = 0
        self.sent: list[int] = []
        self.pages: dict[int, bytes] = {}
        self.closes: list[CloseRequest] = []
        self.failures: dict[object, list[Exception]] = {}
        self.close_answer = ClosedRun('OK', None, SUMMARY)

    def _maybe_fail(self, key: object) -> None:
        pending = self.failures.get(key)
        if pending:
            raise pending.pop(0)

    def start_run(self) -> str:
        self.started += 1
        self._maybe_fail('start')
        return 'run-1'

    def send_page(self, run_id: str, number: int, body: bytes) -> None:
        self.sent.append(number)
        self._maybe_fail(number)
        self.pages[number] = body

    def close_run(self, run_id: str, request: CloseRequest) -> ClosedRun:
        self.closes.append(request)
        self._maybe_fail('close')
        if not request.complete:
            return ClosedRun('ERROR', request.error_message, None)
        return self.close_answer


def unavailable(message: str = 'Trackhive no responde en https://t: rechazó la conexión') -> TrackhiveUnavailableError:
    return TrackhiveUnavailableError(message)


class SyncTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.everything = FakeEverything({NOTARIES: 450, PERIODICALS: 6, LETTERS: 0})
        self.trackhive = FakeTrackhive()
        self.clock = FakeClock()
        self.logger = LOGGER

    def use_case(self, attempts: int = 5, startup_wait: float = 0) -> SynchronizeUseCase:
        retrier = Retrier(RetryPolicy(attempts, 5), self.clock, self.logger)
        settings = SyncSettings((NOTARIES, PERIODICALS, LETTERS), page_size=200, startup_wait_seconds=startup_wait)
        return SynchronizeUseCase(self.everything, self.trackhive, retrier, self.clock, settings, self.logger)

    def sent_pages(self) -> list[tuple[str, int]]:
        return [(page['root'], page['offset']) for page in map(json.loads, self.trackhive.pages.values())]


class CompleteRunTest(SyncTestCase):
    def test_every_page_of_every_root_numbered_from_one_across_the_run(self) -> None:
        report = self.use_case().execute()

        self.assertTrue(report.ok)
        self.assertEqual((report.run_id, report.pages, report.summary), ('run-1', 5, SUMMARY))
        # 450 notaries in pages of 200, then the 6 periodicals; an empty root still sends its page
        self.assertEqual(self.trackhive.sent, [1, 2, 3, 4, 5])
        self.assertEqual(
            self.sent_pages(), [(NOTARIES, 0), (NOTARIES, 200), (NOTARIES, 400), (PERIODICALS, 0), (LETTERS, 0)]
        )
        # count=200 in every query after the check that Everything answers
        self.assertEqual({count for _, _, count in self.everything.calls[1:]}, {200})
        self.assertEqual(self.trackhive.closes, [CloseRequest('OK', page_count=5)])

    def test_the_page_goes_as_everything_answered_it(self) -> None:
        self.use_case().execute()
        self.assertEqual(json.loads(self.trackhive.pages[4]), {'totalResults': 6, 'results': [{}] * 6, 'root': PERIODICALS, 'offset': 0})

    def test_trackhive_closing_the_run_with_an_error_is_a_failure(self) -> None:
        self.trackhive.close_answer = ClosedRun('ERROR', 'falta la página 2', None)
        with self.assertLogs(self.logger, 'ERROR') as logs:
            report = self.use_case().execute()
        self.assertFalse(report.ok)
        self.assertEqual(report.error, 'falta la página 2')
        self.assertIn('falta la página 2', '\n'.join(logs.output))


class EverythingFailsTest(SyncTestCase):
    def test_everything_failing_in_the_middle_closes_with_an_error_never_complete(self) -> None:
        # Call 1 checks Everything, call 3 asks for page 2
        self.everything.failures[3] = EverythingUnavailableError('Everything no responde en http://127.0.0.1:8081: no respondió en 30 s')
        with self.assertLogs(self.logger, 'ERROR') as logs:
            report = self.use_case().execute()

        self.assertFalse(report.ok)
        self.assertEqual(self.trackhive.sent, [1])
        [close] = self.trackhive.closes
        self.assertEqual(close.result, 'ERROR')
        self.assertIn('no respondió en 30 s', close.error_message)
        self.assertIn('página 2 de la corrida', close.error_message)
        self.assertIn('no respondió en 30 s', '\n'.join(logs.output))

    def test_everything_down_waits_while_it_may_be_starting_then_closes_with_an_error(self) -> None:
        for call in range(1, 10):
            self.everything.failures[call] = EverythingUnavailableError('Everything no responde: rechazó la conexión')
        report = self.use_case(startup_wait=25).execute()

        self.assertFalse(report.ok)
        self.assertEqual(self.clock.sleeps, [10, 10, 5])
        self.assertEqual(self.trackhive.started, 1)
        self.assertEqual(self.trackhive.sent, [])
        [close] = self.trackhive.closes
        self.assertEqual(close.result, 'ERROR')
        self.assertIn('rechazó la conexión', close.error_message)
        self.assertIn('se esperó 25 s', close.error_message)

    def test_everything_that_starts_a_little_later_is_waited_for(self) -> None:
        self.everything.failures[1] = EverythingUnavailableError('rechazó la conexión')
        self.everything.failures[2] = EverythingUnavailableError('rechazó la conexión')
        report = self.use_case(startup_wait=300).execute()
        self.assertTrue(report.ok)
        self.assertEqual(self.clock.sleeps, [10, 10])

    def test_an_everything_still_loading_its_index_is_waited_for(self) -> None:
        # Just opened, the installed Everything answers with an empty index:
        # the three roots come empty in the first check (calls 1 to 3)
        self.everything.empty = {1, 2, 3}
        with self.assertLogs(self.logger, 'WARNING') as logs:
            report = self.use_case(startup_wait=300).execute()
        self.assertTrue(report.ok)
        self.assertEqual(self.clock.sleeps, [10])
        self.assertIn('aún no tiene carpetas bajo ninguna raíz', '\n'.join(logs.output))
        self.assertEqual(self.trackhive.closes, [CloseRequest('OK', page_count=5)])

    def test_roots_still_empty_after_the_wait_are_sent_anyway(self) -> None:
        # Trackhive ends that run with an error, because no leaf folder arrives
        self.everything.empty = set(range(1, 50))
        with self.assertLogs(self.logger, 'WARNING') as logs:
            self.use_case(startup_wait=15).execute()
        self.assertEqual(self.clock.sleeps, [10, 5])
        self.assertIn('se sincroniza igual', '\n'.join(logs.output))
        self.assertEqual(self.trackhive.sent, [1, 2, 3])

    def test_without_a_wait_it_closes_at_once_and_does_not_say_it_waited(self) -> None:
        self.everything.failures[1] = EverythingUnavailableError('Everything no responde: no respondió en 30 s')
        self.clock.now = 0
        report = self.use_case(startup_wait=0).execute()
        self.assertFalse(report.ok)
        self.assertEqual(self.clock.sleeps, [])
        self.assertEqual(self.trackhive.closes[0].error_message, 'Everything no responde: no respondió en 30 s')

    def test_a_wrong_password_is_not_waited_for(self) -> None:
        self.everything.failures[1] = EverythingError('Everything rechazó el usuario o la contraseña (401)')
        report = self.use_case(startup_wait=300).execute()
        self.assertFalse(report.ok)
        self.assertEqual(self.clock.sleeps, [])
        self.assertEqual(self.trackhive.closes[0].error_message, 'Everything rechazó el usuario o la contraseña (401)')

    def test_an_unexpected_error_never_closes_complete(self) -> None:
        self.everything.failures[2] = RuntimeError('fallo del programa')
        with self.assertLogs(self.logger, 'ERROR'):
            report = self.use_case().execute()
        self.assertFalse(report.ok)
        self.assertIn('Error inesperado del agente', self.trackhive.closes[0].error_message)


class TrackhiveFailsTest(SyncTestCase):
    def test_a_page_it_did_not_get_is_sent_again_with_the_same_number_and_a_growing_wait(self) -> None:
        self.trackhive.failures[2] = [unavailable(), unavailable()]
        with self.assertLogs(self.logger, 'WARNING') as logs:
            report = self.use_case().execute()

        self.assertTrue(report.ok)
        self.assertEqual(self.trackhive.sent, [1, 2, 2, 2, 3, 4, 5])
        self.assertEqual(self.clock.sleeps, [5, 10])
        self.assertIn('Intento 2 de 5 en 5 s', '\n'.join(logs.output))
        self.assertIn('Intento 3 de 5 en 10 s', '\n'.join(logs.output))

    def test_after_the_last_attempt_it_ends_with_an_error(self) -> None:
        self.trackhive.failures[1] = [unavailable()] * 3
        report = self.use_case(attempts=3).execute()

        self.assertFalse(report.ok)
        self.assertEqual(self.trackhive.sent, [1, 1, 1])
        self.assertEqual(self.clock.sleeps, [5, 10])
        [close] = self.trackhive.closes
        self.assertEqual(close.result, 'ERROR')
        self.assertIn('tras 3 intentos', close.error_message)

    def test_an_error_a_retry_will_not_fix_is_not_retried(self) -> None:
        self.trackhive.failures[1] = [TrackhiveError('Trackhive rechazó la página 1: 413 PAYLOAD_TOO_LARGE', 413)]
        report = self.use_case().execute()
        self.assertFalse(report.ok)
        self.assertEqual(self.trackhive.sent, [1])
        self.assertEqual(self.clock.sleeps, [])
        self.assertIn('413', self.trackhive.closes[0].error_message)

    def test_without_a_run_there_is_nothing_to_close(self) -> None:
        self.trackhive.failures['start'] = [unavailable()] * 5
        report = self.use_case().execute()
        self.assertFalse(report.ok)
        self.assertIsNone(report.run_id)
        self.assertEqual(self.trackhive.started, 5)
        self.assertEqual(self.clock.sleeps, [5, 10, 20, 40])
        self.assertEqual(self.trackhive.closes, [])

    def test_a_run_already_running_after_a_lost_answer_is_explained(self) -> None:
        self.trackhive.failures['start'] = [
            unavailable('Trackhive no responde: no respondió en 60 s'),
            TrackhiveError('Trackhive rechazó el inicio de la corrida: 409 SYNC_RUN_ALREADY_RUNNING', 409, 'SYNC_RUN_ALREADY_RUNNING'),
        ]
        report = self.use_case().execute()
        self.assertFalse(report.ok)
        self.assertIn('intento anterior', report.error)

    def test_a_close_that_arrived_although_its_answer_was_lost_is_explained(self) -> None:
        self.trackhive.failures['close'] = [
            unavailable('Trackhive respondió 504 a el cierre de la corrida'),
            TrackhiveError('Trackhive rechazó el cierre de la corrida: 409 SYNC_RUN_NOT_RUNNING', 409, 'SYNC_RUN_NOT_RUNNING'),
        ]
        report = self.use_case().execute()
        self.assertFalse(report.ok)
        self.assertIn('Un intento anterior la cerró', report.error)
        self.assertEqual(len(self.trackhive.closes), 2)


class RetryPolicyTest(unittest.TestCase):
    def test_the_wait_doubles_and_has_a_ceiling(self) -> None:
        policy = RetryPolicy(attempts=5, first_delay_seconds=5)
        self.assertEqual([policy.delay_before(attempt) for attempt in (2, 3, 4, 5)], [5, 10, 20, 40])
        self.assertEqual(RetryPolicy(10, 60).delay_before(10), MAX_DELAY_SECONDS)

    def test_one_attempt_means_no_retry(self) -> None:
        clock = FakeClock()
        retrier = Retrier(RetryPolicy(1, 5), clock, LOGGER)

        def send(attempt: int) -> None:
            raise unavailable()

        with self.assertRaises(TrackhiveUnavailableError):
            retrier.run(send, 'Enviar la página 1')
        self.assertEqual(clock.sleeps, [])


if __name__ == '__main__':
    unittest.main()
