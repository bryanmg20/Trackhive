"""instalar-tarea.ps1 schedules the agent in the Task Scheduler of Windows:
the daily sync (HU-166) and the watch of «Sincronizar ahora» (HU-138).

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
from typing import Callable
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
        suffix = uuid.uuid4().hex[:8]
        self.name = f'Prueba agente {suffix}'
        self.watch_name = f'Prueba vigilancia {suffix}'

    def names(self) -> tuple[str, ...]:
        return ('-Nombre', self.name, '-NombreVigilancia', self.watch_name, '-Ruta', FOLDER)

    def install(self) -> subprocess.CompletedProcess[str]:
        # -SinIniciar: the empty .exe of the test is never started
        return powershell('-File', str(SCRIPT), '-Carpeta', str(self.folder), '-Hora', '07:30', '-SinIniciar', *self.names())

    def install_with_configuration(self) -> None:
        (self.folder / 'agente.toml').write_text('', encoding='utf-8')
        installed = self.install()
        self.addCleanup(powershell, '-File', str(SCRIPT), '-Quitar', *self.names())
        self.assertEqual(installed.returncode, 0, installed.stderr)

    def exported(self, name: str) -> ElementTree.Element:
        exported = powershell('-Command', f"Export-ScheduledTask -TaskPath '{FOLDER}' -TaskName '{name}'")
        self.assertEqual(exported.returncode, 0, exported.stderr)
        return ElementTree.fromstring(re.sub(r'^\s*<\?xml[^>]*\?>', '', exported.stdout))

    @staticmethod
    def reader(task: ElementTree.Element) -> Callable[[str], str | None]:
        def text(path: str) -> str | None:
            # './/Settings/StartWhenAvailable' with the namespace of the tasks in each step
            steps = path.removeprefix('.//').split('/')
            return task.findtext('.//' + '/'.join(TASK + step for step in steps))

        return text

    def test_once_a_day_and_as_soon_as_possible_after_a_missed_start(self) -> None:
        self.install_with_configuration()
        text = self.reader(self.exported(self.name))

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

    def test_attends_sincronizar_ahora_while_the_session_is_on(self) -> None:
        # HU-138: started when the user signs in, it keeps asking Trackhive
        self.install_with_configuration()
        text = self.reader(self.exported(self.watch_name))

        self.assertEqual(text('.//Triggers/LogonTrigger/Enabled') or 'true', 'true')
        self.assertTrue((text('.//Triggers/LogonTrigger/UserId') or '').endswith(os.environ.get('USERNAME', '')))
        self.assertEqual(text('.//Actions/Exec/Arguments'), '--vigilar')
        self.assertEqual(Path(text('.//Actions/Exec/Command') or ''), self.folder / 'trackhive-agente.exe')
        self.assertEqual(Path(text('.//Actions/Exec/WorkingDirectory') or ''), self.folder)
        # Without a time limit, never two at once, restarted if it fails, also on battery
        self.assertEqual(text('.//Settings/ExecutionTimeLimit'), 'PT0S')
        self.assertEqual(text('.//Settings/MultipleInstancesPolicy'), 'IgnoreNew')
        self.assertEqual(text('.//Settings/RestartOnFailure/Count'), '3')
        self.assertEqual(text('.//Settings/RestartOnFailure/Interval'), 'PT1M')
        self.assertEqual(text('.//Settings/DisallowStartIfOnBatteries'), 'false')
        self.assertEqual(text('.//Settings/StopIfGoingOnBatteries'), 'false')
        # Only while the user is logged on, not elevated
        self.assertEqual(text('.//Principals/Principal/LogonType'), 'InteractiveToken')
        self.assertIn(text('.//Principals/Principal/RunLevel'), (None, 'LeastPrivilege'))

    def test_quitar_removes_both_tasks(self) -> None:
        self.install_with_configuration()
        removed = powershell('-File', str(SCRIPT), '-Quitar', *self.names())
        self.assertEqual(removed.returncode, 0, removed.stderr)

        for name in (self.name, self.watch_name):
            with self.subTest(name=name):
                found = powershell('-Command', f"Get-ScheduledTask -TaskPath '{FOLDER}' -TaskName '{name}'")
                self.assertNotEqual(found.returncode, 0)

    def test_refuses_to_schedule_it_without_its_configuration(self) -> None:
        installed = self.install()
        self.assertNotEqual(installed.returncode, 0)
        self.assertIn('agente.toml', installed.stderr + installed.stdout)


if __name__ == '__main__':
    unittest.main()
