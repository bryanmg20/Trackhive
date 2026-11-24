"""Agente de sincronización con Everything (HU-166).

Runs on the PC of the CLENA: queries the Everything HTTP server on localhost
and sends each page, as Everything answered it, to the ingest endpoints of
Trackhive (HU-137) over HTTPS. It only makes outgoing connections, so the
servers of Trackhive never need to reach this PC.

Layers, as in the backend (D-25): domain (rules of a run and of the
connections), application (the sync use case and its ports), infrastructure
(HTTP, TLS, configuration file, log) and presentation (the console program).
"""

__version__ = '1.0.0'
