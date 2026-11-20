"""Compares an Everything HTTP server (the mock or another Everything) with the
fixtures of the real one (HU-133).

Repeats every query of dev/fixtures/capturas.json against --url and checks the
HTTP status, the headers (but Date) and the body. The JSON is compared without
date_modified, which changes every time the tree is generated; with --bytes the
body must also be byte-identical (CRLF and tabs) apart from that date.

    python dev/scripts/comparar_everything.py --url http://127.0.0.1:8081
    python dev/scripts/comparar_everything.py --url http://127.0.0.1:8081 --bytes

Credentials: --usuario/--contrasena or EVERYTHING_USER/EVERYTHING_PASSWORD.
Exits with 1 if any response differs.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from everything_http import (  # noqa: E402
    CAPTURES_FILE,
    FIXTURES,
    credentials_for,
    fetch,
    load_json,
    mask_dates,
    stable_headers,
    without_dates,
)


# Queries whose answer depends on how the folder is indexed. Through
# Indexes → Folders (the portable, and a network drive at the CLENA) the root
# comes with name = full path and an empty path; when a disk already indexed
# by NTFS holds it, it is an ordinary folder (name docs_simulados, path
# C:\trackhive). Both are right; the adapter (HU-135) must accept both.
INDEX_DEPENDENT = {
    'raiz_del_indice': 'esperado si docs_simulados llega por el índice NTFS del disco y no por Indexes > Folders',
}


@dataclass
class Difference:
    id: str
    reason: str


def compare(base_url: str, user: str, password: str, require_bytes: bool = False) -> tuple[int, list[Difference]]:
    """Number of queries compared and the ones that differ."""
    captures = load_json(CAPTURES_FILE)['capturas']
    differences = []
    for capture in captures:
        status, headers, body = fetch(base_url.rstrip('/') + capture['pathQuery'], credentials_for(capture, user, password))
        expected_body = (FIXTURES / capture['archivo']).read_bytes()

        if status != capture['status']:
            differences.append(Difference(capture['id'], f'código HTTP {status}, se esperaba {capture["status"]}'))
            continue
        if stable_headers(headers) != capture['headers']:
            differences.append(Difference(capture['id'], f'cabeceras {stable_headers(headers)}, se esperaban {capture["headers"]}'))
            continue
        if capture['archivo'].endswith('.json'):
            try:
                got = without_dates(json.loads(body))
            except ValueError:
                differences.append(Difference(capture['id'], 'la respuesta no es JSON'))
                continue
            expected = without_dates(json.loads(expected_body))
            if got != expected:
                differences.append(Difference(capture['id'], _json_difference(expected, got)))
                continue
            if require_bytes and mask_dates(body) != mask_dates(expected_body):
                differences.append(Difference(capture['id'], 'mismo JSON, pero no los mismos bytes (formato, CRLF o tabulaciones)'))
        elif body != expected_body:
            differences.append(Difference(capture['id'], 'el cuerpo no es igual'))
    return len(captures), differences


def _json_difference(expected: dict, got: dict) -> str:
    if expected.get('totalResults') != got.get('totalResults'):
        return f'totalResults {got.get("totalResults")}, se esperaba {expected.get("totalResults")}'
    expected_results, got_results = expected.get('results', []), got.get('results', [])
    if len(expected_results) != len(got_results):
        return f'{len(got_results)} resultados, se esperaban {len(expected_results)}'
    for index, (want, have) in enumerate(zip(expected_results, got_results)):
        if want != have:
            return f'resultado {index}: {have}, se esperaba {want}'
    return 'el JSON no es igual'


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description='Compara un servidor de Everything (o el mock) con los fixtures del real.')
    parser.add_argument('--url', default='http://127.0.0.1:8081')
    parser.add_argument('--usuario', default=os.environ.get('EVERYTHING_USER', 'trackhive'))
    parser.add_argument('--contrasena', default=os.environ.get('EVERYTHING_PASSWORD', 'trackhive-dev'))
    parser.add_argument('--bytes', action='store_true', help='exige también los mismos bytes, salvo date_modified')
    parser.add_argument(
        '--estricto', action='store_true', help='también falla en las diferencias que dependen de cómo se indexa la carpeta'
    )
    args = parser.parse_args(argv)
    # A Windows console in cp1252 must not stop the report over an accent
    sys.stdout.reconfigure(errors='replace')

    total, differences = compare(args.url, args.usuario, args.contrasena, args.bytes)
    expected = [d for d in differences if d.id in INDEX_DEPENDENT and not args.estricto]
    unexpected = [d for d in differences if d not in expected]
    status = {d.id: 'DIFIERE' for d in unexpected} | {d.id: 'esperado' for d in expected}
    for capture in load_json(CAPTURES_FILE)['capturas']:
        print(f'{status.get(capture["id"], "igual"):8} {capture["id"]}')
    for difference in differences:
        note = f' ({INDEX_DEPENDENT[difference.id]})' if difference in expected else ''
        print(f'  {difference.id}: {difference.reason}{note}')
    print(f'{total - len(differences)} de {total} respuestas iguales a las de Everything real', end='')
    print(f'; {len(expected)} diferencia(s) esperada(s)' if expected else '')
    sys.exit(1 if unexpected else 0)


if __name__ == '__main__':
    main()
