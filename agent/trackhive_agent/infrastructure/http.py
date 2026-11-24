"""One HTTP request with the standard library, shared by both clients."""

from __future__ import annotations

import http.client
import socket
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import Message


@dataclass(frozen=True)
class HttpAnswer:
    status: int
    headers: Message
    body: bytes


class TransportError(Exception):
    """The request got no answer: refused, timed out, cut, or the TLS
    connection could not be made."""

    def __init__(self, reason: str, certificate: bool = False, timed_out: bool = False) -> None:
        super().__init__(reason)
        # The certificate of the server is not valid: retrying will not fix it
        self.certificate = certificate
        # The server took longer than the timeout to answer
        self.timed_out = timed_out


class _NoRedirects(urllib.request.HTTPRedirectHandler):
    """A redirection is answered as it is, never followed: urllib would
    forward the Authorization header (the token) to the new address, and
    could turn https:// into http://."""

    def redirect_request(self, *args: object, **kwargs: object) -> None:
        return None


def describe(error: BaseException, timeout: float) -> str:
    """Why a request got no answer, for the log."""
    if isinstance(error, urllib.error.URLError) and isinstance(error.reason, BaseException):
        return describe(error.reason, timeout)
    if isinstance(error, (TimeoutError, socket.timeout)):
        return f'no respondió en {timeout:g} s'
    if isinstance(error, ConnectionRefusedError):
        return 'rechazó la conexión'
    if isinstance(error, socket.gaierror):
        return 'no se encontró el servidor (DNS)'
    if isinstance(error, ssl.SSLCertVerificationError):
        return f'su certificado no es válido ({error.verify_message})'
    if isinstance(error, ssl.SSLError):
        return f'no se pudo establecer la conexión segura (TLS): {error.reason or error}'
    if isinstance(error, (ConnectionResetError, http.client.RemoteDisconnected, ConnectionAbortedError)):
        return 'cortó la conexión'
    if isinstance(error, urllib.error.URLError):
        return str(error.reason)
    return str(error) or type(error).__name__


def _cause(error: BaseException) -> BaseException:
    """The error under the URLError of urllib, if there is one."""
    if isinstance(error, urllib.error.URLError) and isinstance(error.reason, BaseException):
        return _cause(error.reason)
    return error


def build_opener(context: ssl.SSLContext | None, use_proxy: bool) -> urllib.request.OpenerDirector:
    """Without redirections. Everything is on this PC, so it never goes
    through a proxy; Trackhive uses the proxy of Windows, if there is one."""
    handlers: list[urllib.request.BaseHandler] = [_NoRedirects()]
    if context is not None:
        handlers.append(urllib.request.HTTPSHandler(context=context))
    if not use_proxy:
        handlers.append(urllib.request.ProxyHandler({}))
    return urllib.request.build_opener(*handlers)


def send(opener: urllib.request.OpenerDirector, request: urllib.request.Request, timeout: float) -> HttpAnswer:
    """The answer, also for 3xx, 4xx and 5xx; TransportError if none came."""
    try:
        with opener.open(request, timeout=timeout) as response:
            return HttpAnswer(response.status, response.headers, response.read())
    except urllib.error.HTTPError as error:
        with error:
            return HttpAnswer(error.code, error.headers, error.read())
    except (urllib.error.URLError, OSError, http.client.HTTPException) as error:
        cause = _cause(error)
        raise TransportError(
            describe(error, timeout),
            certificate=isinstance(cause, ssl.SSLCertVerificationError),
            timed_out=isinstance(cause, (TimeoutError, socket.timeout)),
        ) from error
