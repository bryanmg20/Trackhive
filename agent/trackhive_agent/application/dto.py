"""Inputs and results of the sync use case (R5 of D-25)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SyncSettings:
    # Roots of the funds, as Everything reports them: the same ones as
    # base + root in backend/config/catalog-convention.json
    roots: tuple[str, ...]
    # count of each query: 200 by default, at most 500 (limit of HU-137)
    page_size: int
    # How long to wait for Everything to start before giving up
    startup_wait_seconds: float


@dataclass(frozen=True)
class RunSummary:
    """What Trackhive did with the catalog when the run closed complete."""

    leaves: int
    created: int
    updated: int
    not_found: int
    for_review: int

    def describe(self) -> str:
        return (
            f'{self.leaves} carpetas hoja: {self.created} materiales creados, {self.updated} actualizados, '
            f'{self.not_found} copias no encontradas y {self.for_review} para revisión'
        )


@dataclass(frozen=True)
class ClosedRun:
    """The answer of Trackhive to the close."""

    # OK or ERROR: a run closed as complete still ends ERROR if pages are
    # missing or no leaf folder arrived
    status: str
    error_message: str | None
    summary: RunSummary | None


@dataclass(frozen=True)
class SyncReport:
    """How one execution of the agent ended."""

    ok: bool
    # None when Trackhive did not start the run
    run_id: str | None
    pages: int
    error: str | None = None
    summary: RunSummary | None = None


@dataclass(frozen=True)
class RequestedRun:
    """A run an administrator asked for with «Sincronizar ahora» (HU-138):
    it waits PEDIDA in Trackhive until the agent starts the sync."""

    # When it was asked for, as Trackhive says it (ISO 8601, UTC)
    requested_at: str


@dataclass(frozen=True)
class WatchSettings:
    # How often the agent asks Trackhive whether a run is requested
    poll_seconds: float
