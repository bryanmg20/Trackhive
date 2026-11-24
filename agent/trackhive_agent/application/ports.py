"""Ports of the sync: Everything, Trackhive and the clock (R4 of D-25)."""

from __future__ import annotations

from typing import Protocol

from ..domain.agent_run import CloseRequest
from ..domain.everything_page import EverythingPage
from .dto import ClosedRun


class IEverythingClient(Protocol):
    """The Everything HTTP server on this PC."""

    def folders_under(self, root: str, offset: int, count: int) -> EverythingPage:
        """Folders only under `root` (`folder:` + the root with its final
        backslash), from result `offset`, at most `count`.

        Raises EverythingUnavailableError if Everything does not answer in
        time and EverythingError if its answer is not a search."""
        ...


class ITrackhiveClient(Protocol):
    """The ingest endpoints of Trackhive (HU-137), with the token of the agent.

    Each method makes one request. It raises TrackhiveUnavailableError when
    trying again may work (network, timeout, 5xx) and TrackhiveError when it
    will not."""

    def start_run(self) -> str:
        """Starts a run and returns its id."""
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
