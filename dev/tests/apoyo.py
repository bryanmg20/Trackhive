"""Shared setup of the dev tests: import paths and a generated tree (HU-133)."""

from __future__ import annotations

import atexit
import shutil
import sys
import tempfile
import threading
from functools import cache
from pathlib import Path

DEV = Path(__file__).resolve().parent.parent
REPO = DEV.parent
for folder in ('simulador', 'everything-mock', 'scripts'):
    sys.path.insert(0, str(DEV / folder))

import generar_docs  # noqa: E402
from arbol import load_convention  # noqa: E402

CONVENTION = DEV / 'simulador' / 'convencion.yaml'
COMMITTED_MANIFEST = DEV / 'manifiesto.json'


@cache
def generated() -> tuple[Path, dict]:
    """A tree generated in a temporary folder and its manifest, once per run."""
    workdir = Path(tempfile.mkdtemp(prefix='trackhive-docs-'))
    atexit.register(shutil.rmtree, workdir, ignore_errors=True)
    manifest = generar_docs.generate(CONVENTION, workdir / 'docs_simulados', workdir / 'manifiesto.json')
    return workdir / 'docs_simulados', manifest


@cache
def convention() -> dict:
    return load_convention(CONVENTION)


class RunningMock:
    """The Everything mock on a free port, over the generated tree."""

    def __init__(self, user: str = 'trackhive', password: str = 'trackhive-dev') -> None:
        from everything_mock import create_server

        docs, _ = generated()
        self.user, self.password = user, password
        self.server = create_server(docs, convention()['raiz_windows'], '127.0.0.1', 0, user, password)
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self) -> 'RunningMock':
        self.thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.server.shutdown()
        self.server.server_close()
