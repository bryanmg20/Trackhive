"""«Sincronizar ahora» (HU-138): while the PC of the CLENA is on, the agent
asks Trackhive whether an administrator asked for a sync, and runs it."""

from __future__ import annotations

import logging

from ..domain.errors import TrackhiveError, TrackhiveUnavailableError
from .dto import SyncReport, WatchSettings
from .ports import ILifeline, ITrackhiveClient
from .retrier import seconds
from .synchronize import SynchronizeUseCase


class WatchRequestsUseCase:
    """Asks Trackhive every poll_seconds whether an administrator pressed
    «Sincronizar ahora» (HU-138). When a run is PEDIDA it runs the same sync
    as the daily task (SynchronizeUseCase), and starting the run takes it.

    It goes on while the program that started it does (the task of Windows,
    until the user signs out or the task is stopped). If Trackhive does not
    answer, or a sync fails, the next check tries again. The log only says
    what changes (a requested run, Trackhive not answering, Trackhive
    answering again), not every check, so it does not fill up while nobody
    asks for anything."""

    def __init__(
        self,
        trackhive: ITrackhiveClient,
        synchronize: SynchronizeUseCase,
        lifeline: ILifeline,
        settings: WatchSettings,
        logger: logging.Logger,
    ) -> None:
        self._trackhive = trackhive
        self._synchronize = synchronize
        self._lifeline = lifeline
        self._settings = settings
        self._log = logger
        # The last failure logged, so the same one is not logged at every check
        self._trackhive_failure: str | None = None
        self._unexpected_failure: str | None = None

    def check(self) -> SyncReport | None:
        """One question to Trackhive, and the sync if a run is requested:
        its report, or None when there was nothing to run."""
        try:
            requested = self._trackhive.requested_run()
        except TrackhiveError as error:
            self._trackhive_failed(error)
            return None
        if self._trackhive_failure is not None:
            self._log.info('Trackhive responde de nuevo')
            self._trackhive_failure = None
        if requested is None:
            return None
        self._log.info(
            'Un administrador pidió «Sincronizar ahora» en Trackhive (pedida el %s UTC): se sincroniza',
            requested.requested_at,
        )
        return self._synchronize.execute()

    def run(self) -> None:
        """Checks now and then every poll_seconds, until the program that
        started the agent ends (or Ctrl+C in a console)."""
        self._log.info(
            'Atendiendo «Sincronizar ahora»: se pregunta a Trackhive cada %s s si hay una sincronización pedida',
            self._every,
        )
        while True:
            try:
                self.check()
            except Exception as error:  # noqa: BLE001 (the watch goes on: the next check tries again)
                failure = f'Error inesperado del agente: {error!r}'
                if failure != self._unexpected_failure:
                    self._log.exception('%s. Se vuelve a preguntar cada %s s', failure, self._every)
                self._unexpected_failure = failure
            else:
                self._unexpected_failure = None
            if not self._lifeline.wait(self._settings.poll_seconds):
                self._log.info(
                    'La tarea que inició al agente terminó: se deja de atender «Sincronizar ahora»'
                )
                return

    @property
    def _every(self) -> str:
        return seconds(self._settings.poll_seconds)

    def _trackhive_failed(self, error: TrackhiveError) -> None:
        """Trackhive did not answer, or refused the question: logged once,
        not at every check, until it answers again."""
        failure = str(error)
        if failure != self._trackhive_failure:
            log = self._log.warning if isinstance(error, TrackhiveUnavailableError) else self._log.error
            log(
                'No se pudo preguntar a Trackhive si hay una sincronización pedida: %s. Se vuelve a preguntar cada %s s',
                failure,
                self._every,
            )
        self._trackhive_failure = failure
