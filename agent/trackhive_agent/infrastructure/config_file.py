"""agente.toml: the configuration of the agent (HU-166).

Read and checked when the agent starts, before it connects to anything: a
wrong or unsafe value stops it with the reason (as D-23 in the backend). The
example is agent/agente.example.toml; the real file has the token and the
password of Everything, so it never goes to the repository.
"""

from __future__ import annotations

import re
import tomllib
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..domain.connection_policy import local_everything_url, secure_trackhive_url
from ..domain.errors import InvalidConfigError

# The same minimum as EVERYTHING_AGENT_TOKEN in the backend (HU-137)
MIN_TOKEN_LENGTH = 32
# Results per page the backend accepts (MAX_RESULTS_PER_PAGE, HU-137)
MAX_PAGE_SIZE = 500

# A full Windows path: C:\…, Z:\… or \\server\share…
WINDOWS_PATH = re.compile(r'^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)')
# Not valid in a Windows name, and special in a search of Everything
FORBIDDEN_IN_PATH = set('<>"|?*')


@dataclass(frozen=True)
class EverythingSettings:
    url: str
    user: str
    password: str = field(repr=False)
    timeout_seconds: float
    page_size: int
    startup_wait_seconds: float
    roots: tuple[str, ...]


@dataclass(frozen=True)
class TrackhiveSettings:
    url: str
    token: str = field(repr=False)
    timeout_seconds: float
    close_timeout_seconds: float
    attempts: int
    retry_delay_seconds: float
    ca_file: Path | None
    # With --vigilar: how often it asks whether a run is requested (HU-138)
    poll_seconds: float = 60


@dataclass(frozen=True)
class AgentConfig:
    everything: EverythingSettings
    trackhive: TrackhiveSettings


class _Section:
    """One [section] of the file, with typed readers and its own errors."""

    def __init__(self, name: str, values: Any, known: set[str]) -> None:
        if not isinstance(values, dict):
            raise InvalidConfigError(f'Falta la sección [{name}]')
        unknown = sorted(set(values) - known)
        if unknown:
            raise InvalidConfigError(f'Clave desconocida en [{name}]: {", ".join(unknown)} (¿una errata?)')
        self.name = name
        self.values = values

    def text(self, key: str, default: str | None = None) -> str:
        value = self.values.get(key, default)
        if value is None:
            raise InvalidConfigError(f'Falta {self.name}.{key}')
        if not isinstance(value, str):
            raise InvalidConfigError(f'{self.name}.{key} debe ser un texto entre comillas')
        return value.strip()

    def required_text(self, key: str) -> str:
        value = self.text(key)
        if value == '':
            raise InvalidConfigError(f'Falta {self.name}.{key}')
        return value

    def number(self, key: str, default: float, minimum: float, maximum: float, exclusive_minimum: bool) -> float:
        value = self.values.get(key, default)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise InvalidConfigError(f'{self.name}.{key} debe ser un número')
        too_small = value <= minimum if exclusive_minimum else value < minimum
        if too_small or value > maximum:
            limits = (
                f'mayor que {minimum:g} y como máximo {maximum:g}'
                if exclusive_minimum
                else f'entre {minimum:g} y {maximum:g}'
            )
            raise InvalidConfigError(f'{self.name}.{key} debe ser {limits} (es {value:g})')
        return float(value)

    def integer(self, key: str, default: int, minimum: int, maximum: int) -> int:
        value = self.values.get(key, default)
        if isinstance(value, bool) or not isinstance(value, int):
            raise InvalidConfigError(f'{self.name}.{key} debe ser un número entero')
        if not minimum <= value <= maximum:
            raise InvalidConfigError(f'{self.name}.{key} debe estar entre {minimum} y {maximum} (es {value})')
        return value


def _root(value: Any, index: int) -> str:
    where = f'everything.roots[{index}]'
    if not isinstance(value, str) or value.strip() == '':
        raise InvalidConfigError(f'{where} debe ser una ruta entre comillas simples')
    root = unicodedata.normalize('NFC', value.strip())
    if any(unicodedata.category(char) == 'Cc' for char in root):
        raise InvalidConfigError(
            f'{where} tiene un carácter de control (¿un \\t?): escribe las rutas entre comillas simples, '
            "'C:\\carpeta', para que la \\ no se interprete"
        )
    if not WINDOWS_PATH.match(root):
        raise InvalidConfigError(f'{where} debe ser una ruta completa de Windows: C:\\…, Z:\\… o \\\\servidor\\carpeta\\… (es «{root}»)')
    if FORBIDDEN_IN_PATH & set(root):
        raise InvalidConfigError(f'{where} tiene un carácter que no puede ir en una ruta de Windows (<>"|?*): «{root}»')
    return root.rstrip('\\') if not re.fullmatch(r'[A-Za-z]:\\', root) else root


def _parts(root: str) -> list[str]:
    """Windows does not tell upper from lower case in paths."""
    return [part.lower() for part in root.split('\\') if part]


def _roots(section: _Section) -> tuple[str, ...]:
    values = section.values.get('roots')
    if not isinstance(values, list) or not values:
        raise InvalidConfigError(
            'Falta everything.roots: las raíces de los fondos, las mismas de base + root en '
            'backend/config/catalog-convention.json'
        )
    roots = [_root(value, index) for index, value in enumerate(values)]
    for index, root in enumerate(roots):
        for other in roots[:index]:
            shorter, longer = sorted((_parts(root), _parts(other)), key=len)
            if longer[: len(shorter)] == shorter:
                raise InvalidConfigError(
                    f'Las raíces «{other}» y «{root}» se repiten o una está dentro de la otra: sus carpetas '
                    'se enviarían dos veces'
                )
    return tuple(roots)


def _token(section: _Section) -> str:
    token = section.text('token', '')
    if token == '':
        raise InvalidConfigError('Falta trackhive.token: el mismo valor de EVERYTHING_AGENT_TOKEN en el servidor de Trackhive')
    if len(token) < MIN_TOKEN_LENGTH or any(char.isspace() for char in token):
        # Never repeated in the message: it would end in the log
        raise InvalidConfigError(
            f'trackhive.token debe tener al menos {MIN_TOKEN_LENGTH} caracteres y ningún espacio, como '
            'EVERYTHING_AGENT_TOKEN en el servidor (se genera con `openssl rand -hex 32`)'
        )
    return token


def _ca_file(section: _Section, folder: Path) -> Path | None:
    value = section.text('ca_file', '')
    if value == '':
        return None
    path = Path(value)
    path = path if path.is_absolute() else folder / path
    if not path.is_file():
        raise InvalidConfigError(f'No existe trackhive.ca_file: {path}')
    return path


def parse_config(text: str, folder: Path) -> AgentConfig:
    """The configuration in `text`; relative paths are relative to `folder`."""
    try:
        document = tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        raise InvalidConfigError(
            f'El archivo no es TOML válido: {error}. Escribe las rutas y las contraseñas entre comillas simples'
        ) from None
    unknown = sorted(set(document) - {'everything', 'trackhive'})
    if unknown:
        raise InvalidConfigError(f'Sección desconocida: {", ".join(unknown)} (solo hay [everything] y [trackhive])')

    everything = _Section(
        'everything',
        document.get('everything'),
        {'url', 'user', 'password', 'timeout_seconds', 'page_size', 'startup_wait_seconds', 'roots'},
    )
    trackhive = _Section(
        'trackhive',
        document.get('trackhive'),
        {
            'url',
            'token',
            'timeout_seconds',
            'close_timeout_seconds',
            'attempts',
            'retry_delay_seconds',
            'ca_file',
            'poll_seconds',
        },
    )
    return AgentConfig(
        everything=EverythingSettings(
            url=local_everything_url(everything.required_text('url')),
            user=everything.required_text('user'),
            password=everything.required_text('password'),
            timeout_seconds=everything.number('timeout_seconds', 30, 0, 600, exclusive_minimum=True),
            page_size=everything.integer('page_size', 200, 1, MAX_PAGE_SIZE),
            startup_wait_seconds=everything.number('startup_wait_seconds', 300, 0, 3600, exclusive_minimum=False),
            roots=_roots(everything),
        ),
        trackhive=TrackhiveSettings(
            url=secure_trackhive_url(trackhive.required_text('url')),
            token=_token(trackhive),
            timeout_seconds=trackhive.number('timeout_seconds', 60, 0, 600, exclusive_minimum=True),
            close_timeout_seconds=trackhive.number('close_timeout_seconds', 600, 0, 3600, exclusive_minimum=True),
            attempts=trackhive.integer('attempts', 5, 1, 10),
            retry_delay_seconds=trackhive.number('retry_delay_seconds', 5, 0, 300, exclusive_minimum=True),
            ca_file=_ca_file(trackhive, folder),
            poll_seconds=trackhive.number('poll_seconds', 60, 0, 3600, exclusive_minimum=True),
        ),
    )


def load_config(path: Path) -> AgentConfig:
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        raise InvalidConfigError(
            f'No existe {path}: copia agente.example.toml como agente.toml en esa carpeta y complétalo'
        ) from None
    except OSError as error:
        raise InvalidConfigError(f'No se pudo leer {path}: {error.strerror or error}') from None
    try:
        # utf-8-sig: the Notepad of Windows may add a BOM
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        raise InvalidConfigError(
            f'{path} no está guardado en UTF-8 (en el Bloc de notas: Guardar como, Codificación UTF-8)'
        ) from None
    try:
        return parse_config(text, path.parent)
    except InvalidConfigError as error:
        raise InvalidConfigError(f'{path}: {error}') from None
