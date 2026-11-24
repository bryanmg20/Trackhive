"""Builds trackhive-agente.exe with PyInstaller (HU-166).

One file with Python, the agent and truststore inside: nothing else is
installed on the PC of the CLENA. Built on Windows (the CI does it on
windows-latest); on another system PyInstaller builds a program for that one.

    pip install -r agent/requirements-build.txt
    python agent/construir_exe.py

agent/dist/ ends with what is copied to the PC of the CLENA: the .exe, the
example configuration and the script that schedules the task.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import PyInstaller.__main__

AGENT = Path(__file__).resolve().parent
DIST = AGENT / 'dist'
PACKAGE_FILES = ('agente.example.toml', 'instalar-tarea.ps1')


def main() -> None:
    options = [
        str(AGENT / 'agente.py'),
        '--name',
        'trackhive-agente',
        '--onefile',
        '--console',
        '--paths',
        str(AGENT),
        '--distpath',
        str(DIST),
        '--workpath',
        str(AGENT / 'build'),
        '--specpath',
        str(AGENT / 'build'),
        '--clean',
        '--noconfirm',
    ]
    if sys.platform == 'win32':
        # Started by the Task Scheduler, the program owns its console: it is
        # hidden at once. Started from a console, it keeps writing there
        options += ['--hide-console', 'hide-early']
    PyInstaller.__main__.run(options)
    for name in PACKAGE_FILES:
        shutil.copy2(AGENT / name, DIST / name)
    print(f'Paquete del agente en {DIST}: {", ".join(sorted(path.name for path in DIST.iterdir()))}')


if __name__ == '__main__':
    main()
