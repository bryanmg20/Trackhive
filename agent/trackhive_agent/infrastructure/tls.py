"""TLS of the connection to Trackhive: the certificate is always verified."""

from __future__ import annotations

import ssl
from pathlib import Path

import truststore

from ..domain.errors import InvalidConfigError


def trackhive_tls_context(ca_file: Path | None) -> ssl.SSLContext:
    """Checks the certificate chain and the name of the server.

    By default it trusts what Windows trusts (truststore uses the certificate
    store and the verification of the system, like the browser, which also
    downloads a root certificate Windows does not have yet). With ca_file it
    trusts only that CA instead: for a server whose certificate comes from a
    CA of its own, and for the tests."""
    if ca_file is None:
        context = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    else:
        try:
            context = ssl.create_default_context(cafile=str(ca_file))
        except (ssl.SSLError, OSError) as error:
            raise InvalidConfigError(f'trackhive.ca_file no es un certificado PEM válido: {ca_file} ({error})') from None
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    return context
