"""Entry point of the agent (HU-166): `python agent/agente.py`, and the script
PyInstaller turns into trackhive-agente.exe (construir_exe.py)."""

import sys

from trackhive_agent.presentation.cli import main

if __name__ == '__main__':
    sys.exit(main())
