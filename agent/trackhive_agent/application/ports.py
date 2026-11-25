"""Ports of the sync: Everything, Trackhive and the clock (R4 of D-25)."""

from __future__ import annotations

from typing import Protocol

from ..domain.agent_run import CloseRequest
from ..domain.everything_page import EverythingPage
from .dto import ClosedRun, RequestedRun


class IEverythingClient(Protocol):
    """The Everything HTTP server on this PC."""

    def folders_under(self, root: str, offset: int, count: int) -> EverythingPage:
        """Folders only under `root` (`folder:` + the root with its final
        backslash), from result `offset`, at most `count`.

        Raises EverythingUnavailableError if Everything does not answer in
        time and EverythingError if its answer is not a search."""
        ...


class ITrackhiveClient(Protocol):
    """The endpoints of Trackhive for the agent (HU-137, HU-138), with its
    token.

    Each method makes one request. It raises TrackhiveUnavailableError when
    trying again may work (network, timeout, 5xx) and TrackhiveError when it
    will not."""

    def requested_run(self) -> RequestedRun | None:
        """The run an administrator asked for with «Sincronizar ahora»
        (HU-138), or None when there is none."""
        ...

    def start_run(self) -> str:
        """Starts a run and returns its id. If a run is requested, the start
        takes it (HU-138)."""
        ...

    def send_page(self, run_id: str, number: int, body: bytes) -> None:
        """Sends page `number` as Everything answered it. Sending the same
        number again replaces the page."""
        ...

    def close_run(self, run_id: str, request: CloseRequest) -> ClosedRun:
        """Closes the run complete (OK and pageCount) or with an error."""
        ...


class IClock(Protocol):
    def monotonic(self) -> float:
        ...

    def sleep(self, seconds: float) -> None:
        ...


class ILifeline(Protocol):
    """What keeps the watch of «Sincronizar ahora» going (HU-138): the
    program that started the agent, as the task of Windows."""

    def wait(self, seconds: float) -> bool:
        """Waits up to `seconds` before the next question. False as soon as
        the program that started the agent is gone: the watch ends."""
        ...
