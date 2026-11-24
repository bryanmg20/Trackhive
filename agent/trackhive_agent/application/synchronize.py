"""One sync of the copies with Trackhive (HU-166)."""

from __future__ import annotations

import logging

from ..domain.agent_run import AgentRun, CloseRequest
from ..domain.errors import EverythingError, EverythingUnavailableError, TrackhiveError
from .dto import ClosedRun, SyncReport, SyncSettings
from .ports import IClock, IEverythingClient, ITrackhiveClient
from .retrier import Retrier, seconds

# While Everything is starting, it is asked again this often
PROBE_INTERVAL_SECONDS = 10.0
EMPTY_INDEX = 'Everything responde, pero aún no tiene carpetas bajo todas las raíces (puede estar cargando su índice)'


class SynchronizeUseCase:
    """Sends to Trackhive what Everything indexes under the roots of the
    funds, with the three ingest endpoints of HU-137:

    1. Waits for Everything if it is still starting (the task runs as soon
       as the PC is turned on when it missed its time): while it does not
       answer, or answers with its index still empty.
    2. Starts a run.
    3. For each root, asks Everything for its folders page by page (`offset`
       and `count`) and sends each page as it came, numbered from 1 across
       the whole run. A page Trackhive did not get is sent again with the
       same number.
    4. Closes the run: complete with pageCount only if every page of every
       root arrived; with an error otherwise, so that Trackhive marks nothing
       as not found.

    Trackhive marks as not found every copy the run did not see, whatever
    its root. So a root that comes back empty (a network drive not
    connected, an index loaded halfway, a typo in agente.toml) fails the
    run: closing it complete would mark the whole fund as not found. And a
    root whose number of folders changes between its pages (folders created
    or deleted while it is read with offsets) fails it too: a folder could
    be skipped. A fund without folders yet is not put in the roots.

    Everything is never retried during the run: if it does not answer, or
    takes longer than the timeout, the run closes with an error. Trackhive is
    retried with a growing wait (Retrier)."""

    def __init__(
        self,
        everything: IEverythingClient,
        trackhive: ITrackhiveClient,
        retrier: Retrier,
        clock: IClock,
        settings: SyncSettings,
        logger: logging.Logger,
    ) -> None:
        self._everything = everything
        self._trackhive = trackhive
        self._retrier = retrier
        self._clock = clock
        self._settings = settings
        self._log = logger

    def execute(self) -> SyncReport:
        everything_problem = self._wait_for_everything()
        try:
            run = AgentRun(self._retrier.run(self._start_attempt, 'Iniciar la corrida'))
        except TrackhiveError as error:
            reason = f'No se pudo iniciar la corrida en Trackhive: {error}'
            self._log.error(reason)
            return SyncReport(ok=False, run_id=None, pages=0, error=reason)
        self._log.info('Corrida %s iniciada en Trackhive', run.id)

        if everything_problem is not None:
            run.fail(everything_problem)
        else:
            try:
                self._send_pages(run)
            except Exception as error:  # noqa: BLE001 (a bug must never let the run close as complete)
                self._log.exception('Error inesperado del agente')
                run.fail(f'Error inesperado del agente: {error!r}')
        return self._close(run)

    def _wait_for_everything(self) -> str | None:
        """None when Everything is ready; otherwise why it cannot be used.

        Waits up to startup_wait_seconds while Everything is starting: while
        it does not answer, and while some root has no folder. Just opened,
        the installed Everything answers at once with its index empty or
        loaded halfway. If a root is still empty when the time is up the run
        goes on, and the empty root ends it with an error (_send_pages), so
        that Trackhive records why. A wrong password or a wrong answer will
        not fix itself, so they are not waited for."""
        started = self._clock.monotonic()
        deadline = started + self._settings.startup_wait_seconds
        waited = False
        while True:
            try:
                if self._every_root_has_folders():
                    self._log.info('Everything responde')
                    return None
                problem: EverythingError | None = None
            except EverythingUnavailableError as error:
                problem = error
            except EverythingError as error:
                self._log.error(str(error))
                return str(error)
            remaining = deadline - self._clock.monotonic()
            if remaining <= 0:
                elapsed = round(self._clock.monotonic() - started)
                after = f' (se esperó {seconds(elapsed)} s a que arrancara)' if waited else ''
                if problem is None:
                    self._log.warning('Everything sigue sin carpetas bajo alguna raíz%s: la corrida se cerrará con error', after)
                    return None
                self._log.error(f'{problem}{after}')
                return f'{problem}{after}'
            wait = min(PROBE_INTERVAL_SECONDS, remaining)
            why = problem or EMPTY_INDEX
            self._log.warning('%s. Puede estar arrancando: nuevo intento en %s s', why, seconds(wait))
            self._clock.sleep(wait)
            waited = True

    def _every_root_has_folders(self) -> bool:
        return all(self._everything.folders_under(root, 0, 1).total_results > 0 for root in self._settings.roots)

    def _start_attempt(self, attempt: int) -> str:
        try:
            return self._trackhive.start_run()
        except TrackhiveError as error:
            if attempt > 1 and error.code == 'SYNC_RUN_ALREADY_RUNNING':
                raise TrackhiveError(
                    f'{error}. Seguramente la abrió el intento anterior, que no recibió la respuesta: Trackhive la '
                    'dará por vencida (EVERYTHING_RUN_TIMEOUT_MINUTES) y la próxima ejecución sincronizará',
                    error.status,
                    error.code,
                ) from error
            raise

    def _send_pages(self, run: AgentRun) -> None:
        """Every page of every root, numbered from 1 across the whole run.
        Stops at the first failure, which the run keeps."""
        for root in self._settings.roots:
            offset: int | None = 0
            first_total: int | None = None
            while offset is not None:
                number = run.next_page_number()
                where = f'página {number} de la corrida: {root}, desde el resultado {offset}'
                try:
                    page = self._everything.folders_under(root, offset, self._settings.page_size)
                except EverythingError as error:
                    self._fail(run, f'{error} ({where})')
                    return
                if first_total is None and page.total_results == 0:
                    self._fail(
                        run,
                        f'Everything no devolvió ninguna carpeta bajo {root}: la unidad no está conectada, Everything '
                        'aún no la carga o la raíz está mal escrita en agente.toml. La corrida se cierra con error '
                        'para no marcar los materiales de ese fondo como no encontrados (un fondo sin carpetas no va '
                        'en everything.roots)',
                    )
                    return
                if first_total is not None and page.total_results != first_total:
                    self._fail(
                        run,
                        f'Las carpetas bajo {root} cambiaron mientras se leían (de {first_total} a '
                        f'{page.total_results}): alguien creó o borró carpetas durante la corrida y una podría '
                        'saltarse. La próxima ejecución sincroniza',
                    )
                    return
                first_total = page.total_results
                try:
                    self._retrier.run(
                        lambda _attempt: self._trackhive.send_page(run.id, number, page.body), f'Enviar la página {number}'
                    )
                except TrackhiveError as error:
                    self._fail(run, f'Trackhive no recibió la {where}: {error}')
                    return
                run.page_sent(number)
                self._log.info(
                    'Página %d enviada: %d carpetas (%d de %d bajo %s)',
                    number,
                    page.results,
                    offset + page.results,
                    page.total_results,
                    root,
                )
                offset = page.next_offset(offset)

    def _fail(self, run: AgentRun, reason: str) -> None:
        self._log.error(reason)
        run.fail(reason)

    def _close(self, run: AgentRun) -> SyncReport:
        request = run.close_request()
        try:
            closed = self._retrier.run(
                lambda attempt: self._close_attempt(run.id, request, attempt), 'Cerrar la corrida'
            )
        except TrackhiveError as error:
            reason = f'No se pudo cerrar la corrida {run.id} en Trackhive: {error}'
            self._log.error('%s. Si quedó abierta, vencerá sin marcar nada como no encontrado', reason)
            error_text = f'{reason} (la corrida había fallado: {request.error_message})' if request.error_message else reason
            return SyncReport(ok=False, run_id=run.id, pages=run.pages_sent, error=error_text)

        if not request.complete:
            self._log.error('Corrida %s cerrada con ERROR: %s', run.id, request.error_message)
            return SyncReport(ok=False, run_id=run.id, pages=run.pages_sent, error=request.error_message)
        if closed.status != 'OK':
            reason = closed.error_message or 'Trackhive cerró la corrida con error, sin detalle'
            self._log.error('Trackhive cerró la corrida %s con ERROR: %s', run.id, reason)
            return SyncReport(ok=False, run_id=run.id, pages=run.pages_sent, error=reason)
        summary = closed.summary.describe() if closed.summary else 'sin resumen'
        self._log.info('Corrida %s completa con %d páginas: %s', run.id, run.pages_sent, summary)
        return SyncReport(ok=True, run_id=run.id, pages=run.pages_sent, summary=closed.summary)

    def _close_attempt(self, run_id: str, request: CloseRequest, attempt: int) -> ClosedRun:
        try:
            return self._trackhive.close_run(run_id, request)
        except TrackhiveError as error:
            if attempt > 1 and error.code == 'SYNC_RUN_NOT_RUNNING':
                raise TrackhiveError(
                    f'{error}. Un intento anterior la cerró aunque no recibió la respuesta: revisa en Trackhive '
                    'cómo terminó',
                    error.status,
                    error.code,
                ) from error
            raise
