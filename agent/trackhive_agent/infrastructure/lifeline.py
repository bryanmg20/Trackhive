"""What keeps the watch of «Sincronizar ahora» going (HU-138).

trackhive-agente.exe is one file made by PyInstaller: a launcher that
unpacks Python and starts the agent as its child. When the Task Scheduler
stops the task (the task is reinstalled, or someone ends it) it only ends the
launcher, and the child would go on asking Trackhive, with the .exe in use.
So the child keeps a handle to its launcher and waits on it: the watch ends
as soon as the launcher does. When the user signs out, Windows ends both.
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any

SYNCHRONIZE = 0x00100000
WAIT_OBJECT_0 = 0x0


class SleepLifeline:
    """From the sources (python agente.py), in a console or on Linux: there
    is no launcher, so it only waits. Ctrl+C or the end of the console stop
    the agent."""

    def wait(self, seconds: float) -> bool:
        time.sleep(seconds)
        return True


class LauncherLifeline:
    """The agent started by trackhive-agente.exe on Windows: it waits on the
    handle of its launcher, which wakes it up the moment the launcher ends."""

    def __init__(self, kernel32: Any, handle: int) -> None:
        self._kernel32 = kernel32
        self._handle = handle

    def wait(self, seconds: float) -> bool:
        ended = self._kernel32.WaitForSingleObject(self._handle, int(seconds * 1000)) == WAIT_OBJECT_0
        return not ended


def lifeline_of_this_process() -> SleepLifeline | LauncherLifeline:
    """The launcher of the .exe on Windows; otherwise, only waiting."""
    if sys.platform != 'win32' or not getattr(sys, 'frozen', False):
        return SleepLifeline()
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel32.WaitForSingleObject.restype = wintypes.DWORD
    # Opened now, while the launcher surely runs: the handle is that process,
    # even if Windows later gives its number to another one
    handle = kernel32.OpenProcess(SYNCHRONIZE, False, os.getppid())
    return LauncherLifeline(kernel32, handle) if handle else SleepLifeline()
