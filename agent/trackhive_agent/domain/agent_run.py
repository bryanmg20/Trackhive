"""A run of the sync as the agent drives it (HU-166)."""

from __future__ import annotations

from dataclasses import dataclass

# errorMessage of the close is at most 1000 characters (CloseSyncRunDto and
# sync_runs.error_message, HU-137): a longer one would be rejected with 400
MAX_ERROR_MESSAGE_LENGTH = 1000
NO_PAGES = 'El agente no envió ninguna página'
UNKNOWN_FAILURE = 'La corrida falló sin detalle'


def fit_error_message(reason: str) -> str:
    """The reason as Trackhive accepts it: never empty, at most 1000 characters."""
    text = reason.strip() or UNKNOWN_FAILURE
    if len(text) <= MAX_ERROR_MESSAGE_LENGTH:
        return text
    return text[: MAX_ERROR_MESSAGE_LENGTH - 1] + '…'


@dataclass(frozen=True)
class CloseRequest:
    """How the agent closes a run: OK with pageCount, or ERROR with the reason."""

    result: str
    page_count: int | None = None
    error_message: str | None = None

    @property
    def complete(self) -> bool:
        return self.result == 'OK'


class AgentRun:
    """The rules the agent follows while it feeds a run of Trackhive:

    - pages are numbered from 1 across the whole run, also when the root
      changes, and none is skipped (contract of HU-137);
    - once anything fails (Everything did not answer, a page was rejected…)
      the run can only close with ERROR, never as complete: only a complete
      run lets Trackhive mark the copies it did not see as not found (RN-27);
    - a complete run closes with pageCount, the number of pages sent.
    """

    def __init__(self, run_id: str) -> None:
        if not run_id:
            raise ValueError('La corrida necesita el identificador que devolvió Trackhive')
        self.id = run_id
        self._pages_sent = 0
        self._failure: str | None = None

    @property
    def pages_sent(self) -> int:
        return self._pages_sent

    @property
    def failure(self) -> str | None:
        return self._failure

    def next_page_number(self) -> int:
        return self._pages_sent + 1

    def page_sent(self, number: int) -> None:
        """Trackhive kept page `number`: it must be the next one."""
        if self._failure is not None:
            raise ValueError('Una corrida que falló no recibe más páginas')
        if number != self.next_page_number():
            raise ValueError(f'Se esperaba la página {self.next_page_number()}, no la {number}')
        self._pages_sent = number

    def fail(self, reason: str) -> None:
        """From now on the run closes with ERROR. The first reason stays."""
        if self._failure is None:
            self._failure = fit_error_message(reason)

    def close_request(self) -> CloseRequest:
        if self._failure is not None:
            return CloseRequest('ERROR', error_message=self._failure)
        if self._pages_sent == 0:
            return CloseRequest('ERROR', error_message=NO_PAGES)
        return CloseRequest('OK', page_count=self._pages_sent)
