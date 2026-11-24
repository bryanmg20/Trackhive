"""instalar-tarea.ps1 schedules the agent in the Task Scheduler of Windows (HU-166).

It creates a real task, so it only runs on Windows with
TRACKHIVE_PROBAR_TAREA=1 (the CI sets it); the task is removed at the end."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from xml.etree import ElementTree

from tests.apoyo_agente import AGENT

SCRIPT = AGENT / 'instalar-tarea.ps1'
TASK = '{http://schemas.microsoft.com/windows/2004/02/mit/task}'
FOLDER = '\\TrackhivePruebas\\'


def powershell(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', *arguments],
        capture_output=True,
        text=True,
        errors='replace',
        timeout=120,
    )


def remove_empty_test_folder() -> None:
    """Windows keeps the folder of the tasks after the last one is removed."""
    name = FOLDER.strip('\\')
    powershell(
        '-Command',
        "$s = New-Object -ComObject Schedule.Service; $s.Connect(); "
        f"if ($s.GetFolder('\\{name}').GetTasks(1).Count -eq 0) {{ $s.GetFolder('\\').DeleteFolder('{name}', 0) }}",
    )


@unittest.skipUnless(
    sys.platform == 'win32' and os.environ.get('TRACKHIVE_PROBAR_TAREA') == '1',
    'Crea una tarea real en el Programador de tareas: solo en Windows con TRACKHIVE_PROBAR_TAREA=1',
)
class ScheduledTaskTest(unittest.TestCase):
    @classmethod
    def tearDownClass(cls) -> None:
        remove_empty_test_folder()

    def setUp(self) -> None:
        self.folder = Path(tempfile.mkdtemp(prefix='trackhive-tarea-'))
        self.addCleanup(shutil.rmtree, self.folder, ignore_errors=True)
        (self.folder / 'trackhive-agente.exe').write_bytes(b'')
        self.name = f'Prueba agente {uuid.uuid4().hex[:8]}'

    def install(self) -> subprocess.CompletedProcess[str]:
        return powershell(
            '-File', str(SCRIPT), '-Carpeta', str(self.folder), '-Hora', '07:30', '-Nombre', self.name, '-Ruta', FOLDER
        )

    def test_once_a_day_and_as_soon_as_possible_after_a_missed_start(self) -> None:
        (self.folder / 'agente.toml').write_text('', encoding='utf-8')
        installed = self.install()
        self.addCleanup(powershell, '-File', str(SCRIPT), '-Quitar', '-Nombre', self.name, '-Ruta', FOLDER)
        self.assertEqual(installed.returncode, 0, installed.stderr)

        exported = powershell('-Command', f"Export-ScheduledTask -TaskPath '{FOLDER}' -TaskName '{self.name}'")
        self.assertEqual(exported.returncode, 0, exported.stderr)
        task = ElementTree.fromstring(re.sub(r'^\s*<\?xml[^>]*\?>', '', exported.stdout))

        def text(path: str) -> str | None:
            # './/Settings/StartWhenAvailable' with the namespace of the tasks in each step
            steps = path.removeprefix('.//').split('/')
            return task.findtext('.//' + '/'.join(TASK + step for step in steps))

        # «Ejecutar la tarea lo antes posible si se omitió un inicio programado»
        self.assertEqual(text('.//Settings/StartWhenAvailable'), 'true')
        # Once a day, at the given time
        self.assertEqual(text('.//Triggers/CalendarTrigger/ScheduleByDay/DaysInterval'), '1')
        self.assertIn('T07:30:00', text('.//Triggers/CalendarTrigger/StartBoundary') or '')
        # Only while the user is logged on (when Everything is open), not
        # elevated: Windows leaves out RunLevel when it is the default one
        self.assertEqual(text('.//Principals/Principal/LogonType'), 'InteractiveToken')
        self.assertIn(text('.//Principals/Principal/RunLevel'), (None, 'LeastPrivilege'))
        # Never two at once, at most one hour, also on battery
        self.assertEqual(text('.//Settings/MultipleInstancesPolicy'), 'IgnoreNew')
        self.assertEqual(text('.//Settings/ExecutionTimeLimit'), 'PT1H')
        self.assertEqual(text('.//Settings/DisallowStartIfOnBatteries'), 'false')
        self.assertEqual(text('.//Settings/StopIfGoingOnBatteries'), 'false')
        self.assertEqual(Path(text('.//Actions/Exec/Command') or ''), self.folder / 'trackhive-agente.exe')
        self.assertEqual(Path(text('.//Actions/Exec/WorkingDirectory') or ''), self.folder)

    def test_refuses_to_schedule_it_without_its_configuration(self) -> None:
        installed = self.install()
        self.assertNotEqual(installed.returncode, 0)
        self.assertIn('agente.toml', installed.stderr + installed.stdout)


if __name__ == '__main__':
    unittest.main()
