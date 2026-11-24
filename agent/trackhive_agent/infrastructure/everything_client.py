"""The Everything HTTP server on this PC (HU-133 describes how it answers)."""

from __future__ import annotations

import base64
import json
import urllib.request
from urllib.parse import quote

from .. import __version__
from ..domain.errors import EverythingError, EverythingUnavailableError
from ..domain.everything_page import EverythingPage
from .http import HttpAnswer, TransportError, build_opener, send

# The columns the backend maps (HU-135): the containing folder, the size and
# the modification date, besides the type and the name
COLUMNS = {'json': '1', 'path_column': '1', 'size_column': '1', 'date_modified_column': '1'}


def folders_query(root: str, offset: int, count: int) -> str:
    """`/?search=folder: "<root>\\"&json=1&…&offset=…&count=…`, the search of
    the fixtures of the sync (dev/fixtures/capturas.json). With the final
    backslash the root itself does not come back, only what hangs from it."""
    folder = root.rstrip('\\') + '\\'
    params = {
        'search': f'folder: "{folder}"',
        **COLUMNS,
        'offset': str(offset),
        'count': str(count),
    }
    return '/?' + '&'.join(f'{name}={quote(value, safe="")}' for name, value in params.items())


class EverythingHttpClient:
    """Asks Everything with HTTP basic authentication and the configured
    timeout. Only checks that the answer is a search (totalResults and
    results), to know where the next page starts; the page goes to Trackhive
    as it came."""

    def __init__(self, url: str, user: str, password: str, timeout_seconds: float) -> None:
        self._url = url
        self._timeout = timeout_seconds
        credentials = base64.b64encode(f'{user}:{password}'.encode('utf-8')).decode('ascii')
        self._headers = {
            'Authorization': f'Basic {credentials}',
            'Accept': 'application/json',
            'User-Agent': f'trackhive-agente/{__version__}',
        }
        self._opener = build_opener(context=None, use_proxy=False)

    def folders_under(self, root: str, offset: int, count: int) -> EverythingPage:
        request = urllib.request.Request(self._url + folders_query(root, offset, count), headers=self._headers)
        try:
            answer = send(self._opener, request, self._timeout)
        except TransportError as error:
            hint = (
                'Si Everything está ocupado (por ejemplo, reindexando la unidad de red), sube everything.timeout_seconds'
                if error.timed_out
                else 'Revisa que esté abierto y con el servidor HTTP activado en esa dirección'
            )
            raise EverythingUnavailableError(f'Everything no responde en {self._url}: {error}. {hint}') from error
        return self._page(answer)

    def _page(self, answer: HttpAnswer) -> EverythingPage:
        if answer.status == 401:
            raise EverythingError(
                f'Everything rechazó el usuario o la contraseña (401) en {self._url}: revisa everything.user y '
                'everything.password'
            )
        if answer.status != 200:
            raise EverythingError(f'Everything respondió {answer.status} en {self._url}')
        try:
            document = json.loads(answer.body)
        except (ValueError, UnicodeDecodeError):
            document = None
        total = document.get('totalResults') if isinstance(document, dict) else None
        results = document.get('results') if isinstance(document, dict) else None
        if not isinstance(total, int) or isinstance(total, bool) or not isinstance(results, list):
            raise EverythingError(
                f'La respuesta de {self._url} no es una búsqueda de Everything (falta totalResults o results): '
                '¿es la dirección del servidor HTTP de Everything?'
            )
        return EverythingPage(body=answer.body, total_results=total, results=len(results))
