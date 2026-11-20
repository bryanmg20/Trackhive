"""Mock of the Everything HTTP server for those without Windows (HU-133).

Indexes the same dev/docs_simulados folder and answers like Everything
1.4.1.1032 (dev/fixtures): same parameters, same search, same JSON bytes and
HTTP basic authentication. The backend reaches it, or the real Everything,
only by changing EVERYTHING_URL.

    python dev/everything-mock/everything_mock.py
    python dev/everything-mock/everything_mock.py --host 0.0.0.0 --puerto 8081

Parameters: search/s/q, offset/o, count/c, json/j, sort, ascending,
path_column, size_column, date_modified_column, case, diacritics, path.
Without json=1 it answers a minimal HTML page: Trackhive only uses JSON.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import hmac
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from busqueda import Options, build_index, render_json, search, sort  # noqa: E402

DEV = HERE.parent
DEFAULT_DOCS = DEV / 'docs_simulados'
DEFAULT_CONVENTION = DEV / 'simulador' / 'convencion.yaml'
DEFAULT_WINDOWS_ROOT = 'C:\\trackhive\\docs_simulados'

UNAUTHORIZED_BODY = (
    b'<html><meta http-equiv="Content-Type" content="text/html; charset=utf-8">'
    b'<meta name="viewport" content="width=512"><head><title>401 Unauthorized</title></head>'
    b'<body>401 Unauthorized</body></html>'
)

ALIASES = {
    'search': ('search', 's', 'q'),
    'offset': ('offset', 'o'),
    'count': ('count', 'c'),
    'json': ('json', 'j'),
}


def _param(query: dict[str, list[str]], name: str) -> str | None:
    for alias in ALIASES.get(name, (name,)):
        if alias in query:
            return query[alias][-1]
    return None


def _flag(query: dict[str, list[str]], name: str) -> bool:
    return (_param(query, name) or '0') not in ('0', '')


def _number(query: dict[str, list[str]], name: str) -> int | None:
    value = _param(query, name)
    try:
        number = int(value) if value is not None else None
    except ValueError:
        return None
    return number if number is not None and number >= 0 else None


def answer(query: dict[str, list[str]], docs: Path, windows_root: str) -> tuple[str, bytes]:
    """Content type and body for a search, like Everything."""
    options = Options(
        match_case=_flag(query, 'case'),
        match_diacritics=_flag(query, 'diacritics'),
        match_path=_flag(query, 'path'),
    )
    # The index is rebuilt on every request: like Everything, it sees the
    # changes in the folder at once
    found = search(build_index(docs, windows_root), _param(query, 'search') or '', options)
    ordered = sort(found, _param(query, 'sort') or 'name', (_param(query, 'ascending') or '1') != '0')
    offset = _number(query, 'offset') or 0
    count = _number(query, 'count')
    page = ordered[offset:] if count is None else ordered[offset : offset + count]

    if not _flag(query, 'json'):
        rows = ''.join(f'<li>{item.full_path}</li>' for item in page)
        html = f'<html><body><p>Everything mock: usa json=1</p><ul>{rows}</ul></body></html>'
        return 'text/html; charset=UTF-8', html.encode('utf-8')
    body = render_json(
        len(ordered),
        page,
        path=_flag(query, 'path_column'),
        size=_flag(query, 'size_column'),
        date_modified=_flag(query, 'date_modified_column'),
    )
    return 'application/json', body


def make_handler(docs: Path, windows_root: str, user: str, password: str) -> type[BaseHTTPRequestHandler]:
    expected = f'{user}:{password}'.encode('utf-8')

    class EverythingHandler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.0'

        def version_string(self) -> str:
            return 'Everything HTTP Server'

        def _authorized(self) -> bool:
            if not user:
                return True
            header = self.headers.get('Authorization', '')
            if not header.startswith('Basic '):
                return False
            try:
                given = base64.b64decode(header[6:], validate=True)
            except (binascii.Error, ValueError):
                return False
            return hmac.compare_digest(given, expected)

        def do_GET(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler API)
            if not self._authorized():
                self.send_response_only(401)
                self.send_header('WWW-Authenticate', 'Basic realm="Everything"')
                self.send_header('Content-Type', 'text/html; charset=UTF-8')
                self.end_headers()
                self.wfile.write(UNAUTHORIZED_BODY)
                return
            content_type, body = answer(parse_qs(urlsplit(self.path).query), docs, windows_root)
            # Same headers, in the same order, as Everything
            self.send_response_only(200)
            self.send_header('Server', self.version_string())
            self.send_header('Content-Type', content_type)
            self.send_header('Date', self.date_time_string())
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.send_header('Connection', 'Close')
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: object) -> None:  # noqa: A002
            sys.stderr.write(f'everything-mock {self.address_string()} {format % args}\n')

    return EverythingHandler


def windows_root_from_convention(path: Path) -> str:
    try:
        import yaml

        with path.open(encoding='utf-8') as file:
            return yaml.safe_load(file).get('raiz_windows') or DEFAULT_WINDOWS_ROOT
    except (ImportError, OSError):
        return DEFAULT_WINDOWS_ROOT


def create_server(docs: Path, windows_root: str, host: str, port: int, user: str, password: str) -> ThreadingHTTPServer:
    if not docs.is_dir():
        raise SystemExit(f'No existe {docs}: genera el árbol con python dev/simulador/generar_docs.py')
    return ThreadingHTTPServer((host, port), make_handler(docs, windows_root, user, password))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description='Mock del servidor HTTP de Everything sobre docs_simulados.')
    parser.add_argument('--docs', type=Path, default=DEFAULT_DOCS, help='carpeta que indexa')
    parser.add_argument('--raiz-windows', default=None, help='ruta de Windows que informa para --docs')
    parser.add_argument('--host', default=os.environ.get('EVERYTHING_MOCK_HOST', '127.0.0.1'))
    parser.add_argument('--puerto', type=int, default=int(os.environ.get('EVERYTHING_MOCK_PORT', '8081')))
    parser.add_argument('--usuario', default=os.environ.get('EVERYTHING_USER', 'trackhive'))
    parser.add_argument('--contrasena', default=os.environ.get('EVERYTHING_PASSWORD', 'trackhive-dev'))
    args = parser.parse_args(argv)

    windows_root = args.raiz_windows or windows_root_from_convention(DEFAULT_CONVENTION)
    server = create_server(args.docs, windows_root, args.host, args.puerto, args.usuario, args.contrasena)
    print(f'Everything mock en http://{args.host}:{args.puerto} sobre {args.docs} (como {windows_root})', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
