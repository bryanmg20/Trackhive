"""The log of the agent: a file in logs\\ next to its configuration, and the
console when it runs in one."""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOGGER_NAME = 'trackhive_agent'
LOG_FORMAT = '%(asctime)s %(levelname)s %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'
# 1 MB per file and 5 older ones: a run writes a few kB, so months of history
MAX_BYTES = 1_000_000
BACKUPS = 5


def configure_logging(log_file: Path) -> tuple[logging.Logger, str | None]:
    """The logger of the agent, and why the file could not be opened (then
    it only writes to the console). Never logs the token nor the password."""
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()
    formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)

    problem = None
    try:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(log_file, maxBytes=MAX_BYTES, backupCount=BACKUPS, encoding='utf-8')
    except OSError as error:
        problem = f'No se pudo escribir el log en {log_file}: {error.strerror or error}'
    else:
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    # Without a console (the .exe hidden by the Task Scheduler) stderr may be None
    if sys.stderr is not None:
        reconfigure = getattr(sys.stderr, 'reconfigure', None)
        if reconfigure is not None:
            # A console in cp1252 must not stop the agent over an accent
            reconfigure(errors='replace')
        console = logging.StreamHandler(sys.stderr)
        console.setFormatter(formatter)
        logger.addHandler(console)
    return logger, problem
