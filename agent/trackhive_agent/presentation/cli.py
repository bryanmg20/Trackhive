"""trackhive-agente: one sync and exit (HU-166).

The Task Scheduler of Windows runs it once a day (agent/instalar-tarea.ps1).
The exit code is the «Last Run Result» of the task:

- 0: the run closed complete;
- 1: the sync failed (Everything or Trackhive): the run closed with an error,
  or could not start or close, and the next execution tries again;
- 2: the configuration is wrong or unsafe: the agent did not connect to
  anything.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .. import __version__
from ..application.dto import SyncSettings
from ..application.retrier import Retrier, RetryPolicy
from ..application.synchronize import SynchronizeUseCase
from ..domain.errors import InvalidConfigError
from ..infrastructure.clock import SystemClock
from ..infrastructure.config_file import AgentConfig, load_config
from ..infrastructure.everything_client import EverythingHttpClient
from ..infrastructure.logging_setup import configure_logging
from ..infrastructure.tls import trackhive_tls_context
from ..infrastructure.trackhive_client import TrackhiveHttpClient

EXIT_OK = 0
EXIT_SYNC_FAILED = 1
EXIT_INVALID_CONFIG = 2

CONFIG_NAME = 'agente.toml'


def program_folder() -> Path:
    """The folder of the .exe; running from the sources, agent/."""
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def build_use_case(config: AgentConfig, logger: logging.Logger) -> SynchronizeUseCase:
    """Composition root: the adapters of the ports, with the configuration."""
    clock = SystemClock()
    everything = EverythingHttpClient(
        config.everything.url,
        config.everything.user,
        config.everything.password,
        config.everything.timeout_seconds,
    )
    secure = config.trackhive.url.startswith('https://')
    trackhive = TrackhiveHttpClient(
        config.trackhive.url,
        config.trackhive.token,
        config.trackhive.timeout_seconds,
        config.trackhive.close_timeout_seconds,
        trackhive_tls_context(config.trackhive.ca_file) if secure else None,
    )
    retrier = Retrier(RetryPolicy(config.trackhive.attempts, config.trackhive.retry_delay_seconds), clock, logger)
    settings = SyncSettings(
        roots=config.everything.roots,
        page_size=config.everything.page_size,
        startup_wait_seconds=config.everything.startup_wait_seconds,
    )
    return SynchronizeUseCase(everything, trackhive, retrier, clock, settings, logger)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog='trackhive-agente',
        description=(
            'Agente de sincronización con Everything (HU-166): envía a Trackhive, por HTTPS, las carpetas que '
            'indexa Everything en este PC. Hace una sincronización y termina.'
        ),
        epilog='Códigos de salida: 0 corrida completa, 1 la sincronización falló, 2 configuración inválida.',
    )
    parser.add_argument(
        '--config',
        type=Path,
        default=program_folder() / CONFIG_NAME,
        help=f'archivo de configuración (por defecto, {CONFIG_NAME} junto al programa). El log queda en logs\\ junto a él',
    )
    parser.add_argument('--version', action='version', version=f'%(prog)s {__version__}')
    args = parser.parse_args(argv)

    config_path: Path = args.config.absolute()
    logger, problem = configure_logging(config_path.parent / 'logs' / 'agente.log')
    if problem:
        logger.warning(problem)
    logger.info('Agente de Trackhive %s con %s', __version__, config_path)

    try:
        config = load_config(config_path)
        use_case = build_use_case(config, logger)
    except InvalidConfigError as error:
        logger.error('El agente no se ejecuta: %s', error)
        return EXIT_INVALID_CONFIG
    logger.info(
        'Everything en %s, Trackhive en %s; %d raíces, %d resultados por página',
        config.everything.url,
        config.trackhive.url,
        len(config.everything.roots),
        config.everything.page_size,
    )

    try:
        report = use_case.execute()
    except Exception:  # noqa: BLE001 (the log must say why, and the task must see a failure)
        logger.exception('Error inesperado del agente')
        return EXIT_SYNC_FAILED
    return EXIT_OK if report.ok else EXIT_SYNC_FAILED
