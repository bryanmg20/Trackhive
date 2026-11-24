"""The clock of the system, for the waits of the sync."""

from __future__ import annotations

import time


class SystemClock:
    def monotonic(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        time.sleep(seconds)
