"""Retries of the requests to Trackhive, with a growing wait (HU-166)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Callable, TypeVar

from ..domain.errors import TrackhiveUnavailableError
from .ports import IClock

T = TypeVar('T')

# No single wait is longer than this, whatever the configuration says
MAX_DELAY_SECONDS = 300.0


@dataclass(frozen=True)
class RetryPolicy:
    # Attempts of each request, the first one included (1 = no retries)
    attempts: int
    # Wait before the second attempt; it doubles before each next one
    first_delay_seconds: float

    def delay_before(self, attempt: int) -> float:
        """Seconds to wait before attempt number `attempt` (2, 3…)."""
        return min(self.first_delay_seconds * 2 ** (attempt - 2), MAX_DELAY_SECONDS)


def seconds(value: float) -> str:
    """5, 10, 0.05… for the log: at most two decimals."""
    return f'{round(value, 2):g}'


class Retrier:
    """Repeats a request while Trackhive does not answer, a limited number of
    times and waiting longer each time: 5, 10, 20, 40 s by default. An error
    that a retry will not fix (401, 409, 413…) is not repeated. If the last
    attempt fails, the error goes up: the agent ends with an error and the
    next execution tries again."""

    def __init__(self, policy: RetryPolicy, clock: IClock, logger: logging.Logger) -> None:
        self._policy = policy
        self._clock = clock
        self._log = logger

    def run(self, action: Callable[[int], T], what: str) -> T:
        """Calls `action(attempt)` until it succeeds or the attempts run out."""
        attempt = 1
        while True:
            try:
                return action(attempt)
            except TrackhiveUnavailableError as error:
                if attempt >= self._policy.attempts:
                    raise TrackhiveUnavailableError(
                        f'{error} (tras {attempt} intento{"s" if attempt > 1 else ""})', error.status, error.code
                    ) from error
                attempt += 1
                delay = self._policy.delay_before(attempt)
                self._log.warning(
                    '%s: %s. Intento %d de %d en %s s', what, error, attempt, self._policy.attempts, seconds(delay)
                )
                self._clock.sleep(delay)
