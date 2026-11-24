"""Shared setup of the tests of the agent (HU-166): the Everything mock of
HU-133, a fake Trackhive that keeps every call, test certificates and the
agent run as a process, as the Task Scheduler runs it."""

from __future__ import annotations

import json
import os
import re
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import threading
import uuid
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

AGENT = Path(__file__).resolve().parent.parent
REPO = AGENT.parent
sys.path.insert(0, str(REPO / 'dev' / 'tests'))

# dev/tests/apoyo.py: the simulated tree and the Everything mock (HU-133)
from apoyo import RunningMock, generated  # noqa: E402,F401

CONVENTION_FILE = REPO / 'backend' / 'config' / 'catalog-convention.json'
EXAMPLE_CONFIG = AGENT / 'agente.example.toml'

TOKEN = secrets.token_hex(32)
EVERYTHING_USER = 'trackhive'
EVERYTHING_PASSWORD = 'trackhive-dev'


def convention_roots() -> list[str]:
    """base + root of every fund of backend/config/catalog-convention.json."""
    convention = json.loads(CONVENTION_FILE.read_text(encoding='utf-8'))
    base = convention['base'].rstrip('\\')
    return [f'{base}\\{fund["root"]}' for fund in convention['funds']]


ROOTS = convention_roots()


# --- configuration -----------------------------------------------------------


def toml_value(value: Any) -> str:
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        # Literal strings, as the example asks for Windows paths
        return f"'{value}'" if "'" not in value else json.dumps(value)
    if isinstance(value, (list, tuple)):
        return '[' + ', '.join(toml_value(item) for item in value) + ']'
    raise TypeError(value)


def write_config(folder: Path, everything_url: str, trackhive_url: str, **overrides: dict[str, Any]) -> Path:
    """agente.toml for a test: fast timeouts and retries, no wait for Everything."""
    everything: dict[str, Any] = {
        'url': everything_url,
        'user': EVERYTHING_USER,
        'password': EVERYTHING_PASSWORD,
        'timeout_seconds': 5,
        'page_size': 200,
        'startup_wait_seconds': 0,
        'roots': ROOTS,
    } | overrides.get('everything', {})
    trackhive: dict[str, Any] = {
        'url': trackhive_url,
        'token': TOKEN,
        'timeout_seconds': 5,
        'close_timeout_seconds': 10,
        'attempts': 3,
        'retry_delay_seconds': 0.05,
    } | overrides.get('trackhive', {})
    lines = []
    for name, section in (('everything', everything), ('trackhive', trackhive)):
        lines.append(f'[{name}]')
        lines += [f'{key} = {toml_value(value)}' for key, value in section.items() if value is not None]
        lines.append('')
    path = folder / 'agente.toml'
    path.write_text('\n'.join(lines), encoding='utf-8')
    return path


# --- the agent as a process ----------------------------------------------------


def agent_command() -> list[str]:
    """The .exe when TRACKHIVE_AGENTE_EXE says where it is (CI on Windows);
    otherwise the sources."""
    exe = os.environ.get('TRACKHIVE_AGENTE_EXE')
    if exe:
        return [str(Path(exe).resolve())]
    return [sys.executable, str(AGENT / 'agente.py')]


def run_agent(config: Path, timeout: float = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [*agent_command(), '--config', str(config)],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=timeout,
    )


def read_log(config: Path) -> str:
    return (config.parent / 'logs' / 'agente.log').read_text(encoding='utf-8')


def record_requests(mock: RunningMock) -> list[str]:
    """Path and query of every request the mock receives from now on."""
    paths: list[str] = []
    handler = mock.server.RequestHandlerClass

    class Recording(handler):  # type: ignore[misc,valid-type]
        def do_GET(self) -> None:  # noqa: N802
            paths.append(self.path)
            super().do_GET()

    mock.server.RequestHandlerClass = Recording
    return paths


# --- servers that do not answer ------------------------------------------------


def closed_port() -> int:
    """A port nobody listens on: the connection is refused."""
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        return probe.getsockname()[1]


class SilentServer:
    """Accepts connections and never answers: a hung Everything."""

    def __init__(self) -> None:
        self.socket = socket.socket()
        self.socket.bind(('127.0.0.1', 0))
        self.socket.listen(16)
        self.url = f'http://127.0.0.1:{self.socket.getsockname()[1]}'

    def __enter__(self) -> 'SilentServer':
        return self

    def __exit__(self, *exc: object) -> None:
        self.socket.close()


# --- fake Trackhive --------------------------------------------------------------


@dataclass(frozen=True)
class Call:
    method: str
    path: str
    headers: dict[str, str]
    body: bytes

    @property
    def operation(self) -> str:
        if self.method == 'POST' and self.path.endswith('/sync-runs'):
            return 'start'
        page = re.search(r'/pages/(\d+)$', self.path)
        if self.method == 'PUT' and page:
            return f'page:{page.group(1)}'
        if self.method == 'POST' and self.path.endswith('/close'):
            return 'close'
        return f'{self.method} {self.path}'


# Answers a fake failure gives: (status, code); status 0 cuts the connection
Failure = tuple[int, str | None]

SUMMARY = {'leaves': 117, 'created': 84, 'updated': 33, 'notFound': 0, 'forReview': 11}


class _QuietServer(ThreadingHTTPServer):
    """The agent cuts the connection on purpose (an untrusted certificate):
    that is not an error of the fake, so it prints nothing."""

    def handle_error(self, request: object, client_address: object) -> None:
        if isinstance(sys.exc_info()[1], (ConnectionError, ssl.SSLError)):
            return
        super().handle_error(request, client_address)


class FakeTrackhive:
    """The ingest endpoints of HU-137 with the contract of the backend, enough
    to test the agent: they keep every call. fail('page:2', (503, None)) makes
    that operation answer 503 once before answering as usual."""

    def __init__(self, tls: ssl.SSLContext | None = None, token: str = TOKEN) -> None:
        self.token = token
        self.calls: list[Call] = []
        self.run_id = str(uuid.uuid4())
        # What the close of a run sent as complete answers
        self.close_status = 'OK'
        self.close_error: str | None = None
        self._failures: dict[str, list[Failure]] = {}
        self._lock = threading.Lock()
        self.server = _QuietServer(('127.0.0.1', 0), self._handler())
        if tls is not None:
            self.server.socket = tls.wrap_socket(self.server.socket, server_side=True)
        scheme = 'https' if tls is not None else 'http'
        self.url = f'{scheme}://127.0.0.1:{self.server.server_address[1]}'
        self._thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self) -> 'FakeTrackhive':
        self._thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.server.shutdown()
        self.server.server_close()

    def fail(self, operation: str, *failures: Failure) -> None:
        self._failures.setdefault(operation, []).extend(failures)

    def operations(self) -> list[str]:
        return [call.operation for call in self.calls]

    def pages(self) -> dict[int, bytes]:
        """The last body received for each page number."""
        return {int(call.operation[5:]): call.body for call in self.calls if call.operation.startswith('page:')}

    def closes(self) -> list[dict[str, Any]]:
        return [json.loads(call.body) for call in self.calls if call.operation == 'close']

    def _next_failure(self, operation: str) -> Failure | None:
        with self._lock:
            pending = self._failures.get(operation)
            return pending.pop(0) if pending else None

    def _answer(self, call: Call) -> tuple[int, dict[str, Any] | bytes] | None:
        if call.headers.get('Authorization') != f'Bearer {self.token}':
            return 401, {'statusCode': 401, 'code': 'INVALID_AGENT_TOKEN', 'message': 'El token del agente no es válido'}
        failure = self._next_failure(call.operation)
        if failure is not None:
            status, code = failure
            if status == 0:
                return None
            if code is None:
                # Like nginx when the backend is down: HTML, not the error of the API
                return status, f'<html><body>{status}</body></html>'.encode('ascii')
            return status, {'statusCode': status, 'code': code, 'message': f'Fallo de prueba {status}'}
        if call.operation == 'start':
            return 201, {'id': self.run_id, 'status': 'EN_CURSO', 'filesCount': 0, 'errorMessage': None}
        if call.operation.startswith('page:'):
            results = len(json.loads(call.body)['results'])
            return 200, {'runId': self.run_id, 'pageNumber': int(call.operation[5:]), 'results': results}
        if call.operation == 'close':
            body = json.loads(call.body)
            if body['result'] == 'ERROR':
                return 200, {'id': self.run_id, 'status': 'ERROR', 'errorMessage': body['errorMessage'], 'summary': None}
            ok = self.close_status == 'OK'
            return 200, {
                'id': self.run_id,
                'status': self.close_status,
                'errorMessage': None if ok else self.close_error,
                'summary': SUMMARY if ok else None,
            }
        return 404, {'statusCode': 404, 'code': 'NOT_FOUND', 'message': 'No existe'}

    def _handler(self) -> type[BaseHTTPRequestHandler]:
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def _serve(self) -> None:
                length = int(self.headers.get('Content-Length') or 0)
                call = Call(self.command, self.path, dict(self.headers.items()), self.rfile.read(length))
                with fake._lock:
                    fake.calls.append(call)
                answer = fake._answer(call)
                if answer is None:
                    # A cut connection: no answer at all
                    self.close_connection = True
                    return
                status, body = answer
                html = isinstance(body, bytes)
                data = body if isinstance(body, bytes) else json.dumps(body).encode('utf-8')
                self.send_response(status)
                self.send_header('Content-Type', 'text/html' if html else 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            do_POST = do_PUT = _serve  # noqa: N815

            def log_message(self, format: str, *args: object) -> None:  # noqa: A002
                pass

        return Handler


# --- certificates for HTTPS ----------------------------------------------------

OPENSSL_CONFIG = """\
[req]
distinguished_name = dn
prompt = no
[dn]
CN = Trackhive pruebas CA
[ca]
basicConstraints = critical,CA:TRUE
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
[server]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:localhost,IP:127.0.0.1
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
"""


@dataclass(frozen=True)
class Certificates:
    ca: Path
    server_cert: Path
    server_key: Path

    def server_context(self) -> ssl.SSLContext:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(self.server_cert, self.server_key)
        return context


def make_certificates(folder: Path) -> Certificates | None:
    """A test CA and a certificate for 127.0.0.1 and localhost signed by it,
    made with openssl for each run (no key enters the repository). None if
    there is no openssl."""
    openssl = shutil.which('openssl')
    if openssl is None:
        return None
    config = folder / 'openssl.cnf'
    config.write_text(OPENSSL_CONFIG, encoding='ascii')
    ca, ca_key = folder / 'ca.pem', folder / 'ca.key'
    cert, key, csr = folder / 'servidor.pem', folder / 'servidor.key', folder / 'servidor.csr'
    commands = [
        ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', ca_key, '-out', ca, '-days', '2',
         '-config', config, '-extensions', 'ca'],
        ['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', csr, '-subj', '/CN=localhost',
         '-config', config],
        ['x509', '-req', '-in', csr, '-CA', ca, '-CAkey', ca_key, '-CAcreateserial', '-out', cert, '-days', '2',
         '-extfile', config, '-extensions', 'server'],
    ]
    for command in commands:
        subprocess.run([openssl, *map(str, command)], check=True, capture_output=True, cwd=folder)
    return Certificates(ca, cert, key)
