"""Helpers shared by the scripts that capture and compare Everything responses (HU-133)."""

from __future__ import annotations

import base64
import json
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import quote

DEV = Path(__file__).resolve().parent.parent
FIXTURES = DEV / 'fixtures'
QUERIES_FILE = FIXTURES / 'consultas.json'
CAPTURES_FILE = FIXTURES / 'capturas.json'

# Password sent by the queries that check a wrong password
WRONG_PASSWORD = 'incorrecta'

# Headers that change on every response and are not compared
VOLATILE_HEADERS = {'date'}

# The modification date changes every time the tree is generated
_DATE_MODIFIED = re.compile(rb'"date_modified":"\d*"')


def path_and_query(params: dict[str, str]) -> str:
    """`/?search=...&json=1`, every value percent-encoded (ASCII only)."""
    return '/?' + '&'.join(f'{name}={quote(value, safe="")}' for name, value in params.items())


def credentials_for(query: dict[str, Any], user: str, password: str) -> tuple[str, str] | None:
    auth = query.get('auth', 'correcta')
    if auth == 'ninguna':
        return None
    return (user, WRONG_PASSWORD if auth == 'incorrecta' else password)


def fetch(url: str, credentials: tuple[str, str] | None, timeout: float = 10) -> tuple[int, list[tuple[str, str]], bytes]:
    """Status, headers (in order) and raw body of a GET, also for 4xx responses."""
    request = urllib.request.Request(url)
    if credentials:
        token = base64.b64encode(f'{credentials[0]}:{credentials[1]}'.encode('utf-8')).decode('ascii')
        request.add_header('Authorization', f'Basic {token}')
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, list(response.headers.items()), response.read()
    except urllib.error.HTTPError as error:
        with error:
            return error.code, list(error.headers.items()), error.read()


def stable_headers(headers: list[tuple[str, str]]) -> list[list[str]]:
    return [[name, value] for name, value in headers if name.lower() not in VOLATILE_HEADERS]


def mask_dates(body: bytes) -> bytes:
    return _DATE_MODIFIED.sub(b'"date_modified":"*"', body)


def without_dates(document: Any) -> Any:
    """The parsed JSON without date_modified, which changes on its own."""
    if isinstance(document, dict):
        return {key: without_dates(value) for key, value in document.items() if key != 'date_modified'}
    if isinstance(document, list):
        return [without_dates(item) for item in document]
    return document


def load_json(path: Path) -> Any:
    with path.open(encoding='utf-8') as file:
        return json.load(file)
