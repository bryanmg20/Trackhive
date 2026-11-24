"""Where the agent may connect (HU-166).

- Trackhive is on the servers of the university and the agent reaches it
  over the internet: only by HTTPS, with its certificate verified. http:// is
  only accepted against this same PC, for development (#42).
- Everything is queried on this same PC: its HTTP server does not encrypt
  anything and answers with the names and paths of the files, so the agent
  never queries it over the network.
"""

from __future__ import annotations

from ipaddress import ip_address
from urllib.parse import SplitResult, urlsplit

from .errors import InvalidConfigError


def is_loopback(host: str) -> bool:
    """localhost, 127.0.0.0/8 or ::1: this same PC."""
    if host.lower() == 'localhost':
        return True
    try:
        return ip_address(host).is_loopback
    except ValueError:
        return False


def _split(url: str, what: str) -> SplitResult:
    parts = urlsplit(url.strip())
    if parts.username is not None or parts.password is not None:
        # Never repeated in the message: it would show the password in the log
        raise InvalidConfigError(f'La URL de {what} no puede llevar usuario ni contraseña')
    try:
        parts.port
    except ValueError:
        raise InvalidConfigError(f'La URL de {what} tiene un puerto inválido: «{url}»') from None
    if parts.scheme not in ('https', 'http') or not parts.hostname:
        raise InvalidConfigError(f'La URL de {what} debe ser https://<servidor> o http://<servidor> (es «{url}»)')
    if parts.query or parts.fragment:
        raise InvalidConfigError(f'La URL de {what} no puede llevar ? ni #: es solo la dirección base (es «{url}»)')
    return parts


def secure_trackhive_url(url: str) -> str:
    """The base URL of Trackhive without the final slash, if it is safe:
    https://, or http:// against this same PC (development)."""
    parts = _split(url, 'Trackhive')
    if parts.scheme == 'http' and not is_loopback(parts.hostname or ''):
        raise InvalidConfigError(
            f'La URL de Trackhive debe empezar por https:// (es «{url}»): el agente solo envía las carpetas '
            'por HTTPS y verifica el certificado. http:// solo se acepta contra localhost, en desarrollo'
        )
    return f'{parts.scheme}://{parts.netloc}{parts.path.rstrip("/")}'


def local_everything_url(url: str) -> str:
    """The URL of the Everything HTTP server without the final slash, if it
    is on this same PC."""
    parts = _split(url, 'Everything')
    if not is_loopback(parts.hostname or ''):
        raise InvalidConfigError(
            f'Everything se consulta en este mismo PC: la URL debe ser http://127.0.0.1:<puerto> o '
            f'http://localhost:<puerto> (es «{url}»). Su servidor HTTP no cifra nada, así que nunca se consulta por la red'
        )
    return f'{parts.scheme}://{parts.netloc}{parts.path.rstrip("/")}'
