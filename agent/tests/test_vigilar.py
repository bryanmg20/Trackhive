"""«Sincronizar ahora» (HU-138): the watch of the agent with fakes in memory
and a fake clock, as D-21 in the backend."""

from __future__ import annotations

import unittest

from tests.test_sincronizar import (
    LETTERS,
    LOGGER,
    NOTARIES,
    PERIODICALS,
    FakeClock,
    FakeEverything,
    FakeTrackhive,
    unavailable,
)

from trackhive_agent.application.dto import RequestedRun, SyncSettings, WatchSettings
from trackhive_agent.application.retrier import Retrier, RetryPolicy
from trackhive_agent.application.synchronize import SynchronizeUseCase
from trackhive_agent.application.watch import WatchRequestsUseCase
from trackhive_agent.domain.agent_run import CloseRequest
from trackhive_agent.domain.errors import EverythingUnavailableError, TrackhiveError
from trackhive_agent.infrastructure.lifeline import LauncherLifeline, SleepLifeline, lifeline_of_this_process

POLL_SECONDS = 60
ASKED = RequestedRun(requested_at='2026-11-24T15:00:00.000Z')


class FakeLifeline:
    """The task that started the agent: it goes on for `waits` waits between
    checks, then ends, as when the user signs out or the task is stopped."""

    def __init__(self, waits: int) -> None:
        self.left = waits
        self.waited: list[float] = []

    def wait(self, seconds: float) -> bool:
        self.waited.append(seconds)
        self.left -= 1
        return self.left >= 0


class WatchTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.everything = FakeEverything({NOTARIES: 450, PERIODICALS: 6, LETTERS: 3})
        self.trackhive = FakeTrackhive()
        self.clock = FakeClock()

    def watch(self, lifeline: FakeLifeline | None = None) -> WatchRequestsUseCase:
        retrier = Retrier(RetryPolicy(5, 5), self.clock, LOGGER)
        settings = SyncSettings((NOTARIES, PERIODICALS, LETTERS), page_size=200, startup_wait_seconds=0)
        synchronize = SynchronizeUseCase(self.everything, self.trackhive, retrier, self.clock, settings, LOGGER)
        return WatchRequestsUseCase(
            self.trackhive, synchronize, lifeline or FakeLifeline(0), WatchSettings(POLL_SECONDS), LOGGER
        )


class CheckTest(WatchTestCase):
    def test_nothing_asked_for_means_no_sync_and_nothing_in_the_log(self) -> None:
        with self.assertNoLogs(LOGGER, 'INFO'):
            report = self.watch().check()

        self.assertIsNone(report)
        self.assertEqual(self.trackhive.asked, 1)
        self.assertEqual(self.trackhive.started, 0)
        self.assertEqual(self.everything.calls, [])

    def test_a_requested_run_is_synchronized_like_the_daily_one(self) -> None:
        self.trackhive.requested = ASKED
        with self.assertLogs(LOGGER, 'INFO') as logs:
            report = self.watch().check()

        self.assertTrue(report.ok)
        # The start takes the run PEDIDA; then every page and the close
        self.assertEqual(self.trackhive.started, 1)
        self.assertEqual(self.trackhive.sent, [1, 2, 3, 4, 5])
        self.assertEqual(self.trackhive.closes, [CloseRequest('OK', page_count=5)])
        self.assertIn('Un administrador pidió «Sincronizar ahora»', '\n'.join(logs.output))
        self.assertIn(ASKED.requested_at, '\n'.join(logs.output))
        # Taken: the next question finds nothing
        self.assertIsNone(self.watch().check())
        self.assertEqual(self.trackhive.started, 1)

    def test_a_requested_run_that_fails_is_closed_with_an_error_and_watching_goes_on(self) -> None:
        self.trackhive.requested = ASKED
        for call in range(1, 10):
            self.everything.failures[call] = EverythingUnavailableError('Everything no responde: rechazó la conexión')

        report = self.watch().check()

        self.assertFalse(report.ok)
        [close] = self.trackhive.closes
        self.assertEqual(close.result, 'ERROR')
        self.assertIn('rechazó la conexión', close.error_message)

    def test_trackhive_not_answering_is_logged_once_and_again_when_it_answers(self) -> None:
        self.trackhive.failures['requested'] = [unavailable()] * 3
        watch = self.watch()

        with self.assertLogs(LOGGER, 'INFO') as logs:
            for _ in range(4):
                watch.check()

        output = '\n'.join(logs.output)
        self.assertEqual(output.count('No se pudo preguntar a Trackhive si hay una sincronización pedida'), 1)
        self.assertIn('WARNING', logs.output[0])
        self.assertIn('Trackhive responde de nuevo', output)
        self.assertEqual(self.trackhive.asked, 4)

    def test_a_refusal_that_will_not_fix_itself_is_an_error_logged_once(self) -> None:
        refused = TrackhiveError('Trackhive rechazó el token del agente (401 INVALID_AGENT_TOKEN)', 401, 'INVALID_AGENT_TOKEN')
        self.trackhive.failures['requested'] = [refused, refused]
        watch = self.watch()

        with self.assertLogs(LOGGER, 'ERROR') as logs:
            watch.check()
            watch.check()

        self.assertEqual(len(logs.output), 1)
        self.assertIn('401', logs.output[0])
        self.assertEqual(self.trackhive.started, 0)


class RunTest(WatchTestCase):
    def test_asks_at_once_and_then_every_poll_seconds_while_the_task_goes_on(self) -> None:
        lifeline = FakeLifeline(waits=3)
        with self.assertLogs(LOGGER, 'INFO') as logs:
            self.watch(lifeline).run()

        self.assertEqual(self.trackhive.asked, 4)
        self.assertEqual(lifeline.waited, [POLL_SECONDS] * 4)
        self.assertIn(f'cada {POLL_SECONDS} s', logs.output[0])
        # When the task ends, the watch ends and says so
        self.assertIn('se deja de atender «Sincronizar ahora»', logs.output[-1])

    def test_the_request_made_while_watching_is_taken_at_the_next_check(self) -> None:
        lifeline = FakeLifeline(waits=2)
        original = self.trackhive.requested_run

        def asked_on_the_second_check() -> RequestedRun | None:
            if self.trackhive.asked == 1:
                self.trackhive.requested = ASKED
            return original()

        self.trackhive.requested_run = asked_on_the_second_check  # type: ignore[method-assign]
        with self.assertLogs(LOGGER, 'INFO'):
            self.watch(lifeline).run()

        self.assertEqual(self.trackhive.started, 1)
        self.assertEqual(self.trackhive.closes, [CloseRequest('OK', page_count=5)])

    def test_an_unexpected_error_does_not_stop_the_watch(self) -> None:
        self.trackhive.failures['requested'] = [RuntimeError('fallo del programa')] * 2

        with self.assertLogs(LOGGER, 'ERROR') as logs:
            self.watch(FakeLifeline(waits=2)).run()

        # Three checks: two failed, logged once, and the watch went on
        self.assertEqual(self.trackhive.asked, 3)
        self.assertEqual(len(logs.output), 1)
        self.assertIn('fallo del programa', logs.output[0])


class FakeKernel32:
    """WaitForSingleObject of Windows: 0 when the launcher ended, 0x102
    (WAIT_TIMEOUT) when the time ran out with the launcher still running."""

    def __init__(self, answer: int) -> None:
        self.answer = answer
        self.calls: list[tuple[int, int]] = []

    def WaitForSingleObject(self, handle: int, milliseconds: int) -> int:  # noqa: N802
        self.calls.append((handle, milliseconds))
        return self.answer


class LifelineTest(unittest.TestCase):
    def test_the_watch_goes_on_while_the_launcher_of_the_exe_runs(self) -> None:
        kernel32 = FakeKernel32(answer=0x102)
        self.assertTrue(LauncherLifeline(kernel32, 42).wait(60))
        self.assertEqual(kernel32.calls, [(42, 60_000)])

    def test_the_watch_ends_as_soon_as_the_launcher_ends(self) -> None:
        # The Task Scheduler stopped the task: it only ended the launcher
        self.assertFalse(LauncherLifeline(FakeKernel32(answer=0), 42).wait(60))

    def test_from_the_sources_there_is_no_launcher_and_it_only_waits(self) -> None:
        lifeline = lifeline_of_this_process()
        self.assertIsInstance(lifeline, SleepLifeline)
        self.assertTrue(lifeline.wait(0))


if __name__ == '__main__':
    unittest.main()
