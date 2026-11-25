"""The endpoints of Trackhive for the agent (HU-137, HU-138), with its token."""

from __future__ import annotations

import json
import ssl
import urllib.request
from typing import Any
from urllib.parse import quote

from .. import __version__
from ..application.dto import ClosedRun, RequestedRun
from ..domain.agent_run import CloseRequest
from ..domain.errors import TrackhiveError, TrackhiveUnavailableError
from .http import HttpAnswer, TransportError, build_opener, send
from .trackhive_mapper import TrackhiveMapper

SYNC_RUNS = '/api/v1/everything/sync-runs'

# Trackhive may answer these later: the request is retried
RETRYABLE_STATUSES = {408, 429}


class TrackhiveHttpClient:
    """`Authorization: Bearer <token>` on every request, the certificate
    verified (tls.py) and no redirection followed. Maps every answer to what
    the use case expects: TrackhiveUnavailableError when trying again may
    work, TrackhiveError when it will not."""

    def __init__(
        self,
        url: str,
        token: str,
        timeout_seconds: float,
        close_timeout_seconds: float,
        context: ssl.SSLContext | None,
    ) -> None:
        self._url = url
        self._runs = url + SYNC_RUNS
        self._timeout = timeout_seconds
        self._close_timeout = close_timeout_seconds
        self._headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
            'User-Agent': f'trackhive-agente/{__version__}',
        }
        self._opener = build_opener(context, use_proxy=True)

    def requested_run(self) -> RequestedRun | None:
        answer = self._request('GET', f'{self._runs}/requested', None, self._timeout)
        return TrackhiveMapper.to_requested_run(self._json(answer, 200, 'la pregunta por una sincronización pedida'))

    def start_run(self) -> str:
        body = self._json(self._request('POST', self._runs, None, self._timeout), 201, 'el inicio de la corrida')
        run_id = body.get('id')
        if not isinstance(run_id, str) or not run_id:
            raise TrackhiveError('Trackhive no devolvió el id de la corrida')
        return run_id

    def send_page(self, run_id: str, number: int, body: bytes) -> None:
        url = f'{self._runs}/{quote(run_id, safe="")}/pages/{number}'
        self._check(self._request('PUT', url, body, self._timeout), 200, f'la página {number}')

    def close_run(self, run_id: str, request: CloseRequest) -> ClosedRun:
        url = f'{self._runs}/{quote(run_id, safe="")}/close'
        answer = self._request('POST', url, TrackhiveMapper.close_body(request), self._close_timeout)
        return TrackhiveMapper.to_closed_run(self._json(answer, 200, 'el cierre de la corrida'))

    def _request(self, method: str, url: str, data: bytes | None, timeout: float) -> HttpAnswer:
        headers = dict(self._headers)
        if data is not None:
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            return send(self._opener, request, timeout)
        except TransportError as error:
            if error.certificate:
                raise TrackhiveError(
                    f'No se pudo verificar el certificado de Trackhive en {self._url}: {error}. El agente solo envía '
                    'las carpetas a un servidor con un certificado válido para ese nombre'
                ) from error
            raise TrackhiveUnavailableError(f'Trackhive no responde en {self._url}: {error}') from error

    def _check(self, answer: HttpAnswer, expected: int, what: str) -> None:
        if answer.status == expected:
            return
        code, message = TrackhiveMapper.error_of(answer.body)
        detail = str(answer.status) + (f' {code}' if code else '') + (f': {message}' if message else '')
        if 300 <= answer.status < 400:
            raise TrackhiveError(
                f'Trackhive respondió a {what} con una redirección ({answer.status}) a '
                f'«{answer.headers.get("Location", "")}». El agente no sigue redirecciones: pon en trackhive.url la '
                'dirección final, con https://',
                answer.status,
            )
        if code == 'EVERYTHING_SYNC_DISABLED':
            raise TrackhiveError(
                f'La sincronización está desactivada en Trackhive ({detail}): el servidor no tiene '
                'EVERYTHING_AGENT_TOKEN',
                answer.status,
                code,
            )
        if answer.status == 401:
            raise TrackhiveError(
                f'Trackhive rechazó el token del agente ({detail}): trackhive.token debe ser igual a '
                'EVERYTHING_AGENT_TOKEN del servidor',
                answer.status,
                code,
            )
        if answer.status >= 500 or answer.status in RETRYABLE_STATUSES:
            raise TrackhiveUnavailableError(f'Trackhive respondió {detail} a {what}', answer.status, code)
        raise TrackhiveError(f'Trackhive rechazó {what}: {detail}', answer.status, code)

    def _json(self, answer: HttpAnswer, expected: int, what: str) -> dict[str, Any]:
        self._check(answer, expected, what)
        try:
            body = json.loads(answer.body)
        except (ValueError, UnicodeDecodeError):
            body = None
        if not isinstance(body, dict):
            raise TrackhiveError(
                f'La respuesta de Trackhive a {what} no es JSON: ¿trackhive.url es la dirección de Trackhive?',
                answer.status,
            )
        return body
