"""Captures the fixtures from a real Everything HTTP server with curl (HU-133).

Runs every query of dev/fixtures/consultas.json with `curl` and saves:
- the raw body as dev/fixtures/everything_<id>.json (.html for the 401 page);
- dev/fixtures/capturas.json, with the status, headers and URL of each one;
- dev/fixtures/README.md, with the curl command used next to each fixture.

Run it on the Windows machine where Everything runs (guide in
docs/everything-desarrollo.md), with the credentials in the environment:

    set EVERYTHING_USER=trackhive
    set EVERYTHING_PASSWORD=...
    python dev\\scripts\\capturar_fixtures.py --url http://127.0.0.1:8081 --version-everything "1.4.1.1032 x64"
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from everything_http import (  # noqa: E402
    CAPTURES_FILE,
    FIXTURES,
    QUERIES_FILE,
    WRONG_PASSWORD,
    credentials_for,
    load_json,
    path_and_query,
    stable_headers,
)


def curl_command(url: str, output: str, credentials: tuple[str, str] | None) -> list[str]:
    command = ['curl', '-s', '-S', '-D', '-', '-o', output]
    if credentials:
        command += ['-u', f'{credentials[0]}:{credentials[1]}']
    return command + [url]


def documented_command(url: str, output: str, auth: str) -> str:
    """The same command, with the credentials as variables of the shell."""
    user = {
        'correcta': ' -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD"',
        'incorrecta': f' -u "$EVERYTHING_USER:{WRONG_PASSWORD}"',
        'ninguna': '',
    }[auth]
    return f'curl -s -S -D - -o {output}{user} "{url}"'


def parse_headers(raw: str) -> tuple[int, list[tuple[str, str]]]:
    lines = [line for line in raw.replace('\r\n', '\n').split('\n') if line]
    status = int(lines[0].split()[1])
    headers = [tuple(part.strip() for part in line.split(':', 1)) for line in lines[1:]]
    return status, headers


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description='Captura los fixtures de un Everything real con curl.')
    parser.add_argument('--url', default='http://127.0.0.1:8081', help='servidor HTTP de Everything')
    parser.add_argument('--version-everything', required=True, help='versión de Everything, p. ej. "1.4.1.1032 x64"')
    args = parser.parse_args(argv)

    user, password = os.environ.get('EVERYTHING_USER'), os.environ.get('EVERYTHING_PASSWORD')
    if not user or not password:
        raise SystemExit('Define EVERYTHING_USER y EVERYTHING_PASSWORD con las credenciales del servidor HTTP')
    if not shutil.which('curl'):
        raise SystemExit('No se encontró curl en el PATH')

    base = args.url.rstrip('/')
    captures = []
    for query in load_json(QUERIES_FILE)['consultas']:
        url = base + path_and_query(query['params'])
        auth = query.get('auth', 'correcta')
        temporary = f'everything_{query["id"]}.tmp'
        result = subprocess.run(
            curl_command(url, temporary, credentials_for(query, user, password)),
            cwd=FIXTURES,
            capture_output=True,
            text=True,
            check=True,
        )
        status, headers = parse_headers(result.stdout)
        content_type = dict((name.lower(), value) for name, value in headers).get('content-type', '')
        output = f'everything_{query["id"]}.{"json" if "json" in content_type else "html"}'
        (FIXTURES / temporary).replace(FIXTURES / output)
        captures.append({
            'id': query['id'],
            'descripcion': query['descripcion'],
            'archivo': output,
            'auth': auth,
            'params': query['params'],
            'pathQuery': path_and_query(query['params']),
            'status': status,
            'headers': stable_headers(headers),
            'curl': documented_command(base + path_and_query(query['params']), output, auth),
        })
        print(f'{status} {output}')

    metadata = {
        'descripcion': 'Respuestas reales del servidor HTTP de Everything, capturadas con dev/scripts/capturar_fixtures.py. No editar a mano.',
        'everything': args.version_everything,
        'servidor': base,
        'capturadoEl': date.today().isoformat(),
        'capturas': captures,
    }
    with CAPTURES_FILE.open('w', encoding='utf-8', newline='\n') as file:
        json.dump(metadata, file, ensure_ascii=False, indent=2)
        file.write('\n')
    write_readme(metadata)


def write_readme(metadata: dict) -> None:
    lines = [
        '# Fixtures del servidor HTTP de Everything',
        '',
        f'Respuestas **reales** de Everything {metadata["everything"]}, capturadas el {metadata["capturadoEl"]} '
        f'con `dev/scripts/capturar_fixtures.py` contra `{metadata["servidor"]}`, que indexa solo '
        '`C:\\trackhive\\docs_simulados` (guía en [docs/everything-desarrollo.md](../../docs/everything-desarrollo.md)).',
        '',
        '- Cada `everything_<id>.json` es el cuerpo tal cual lo envió Everything (CRLF y tabulaciones incluidos).',
        '- [`capturas.json`](capturas.json) guarda de cada una el código HTTP, las cabeceras (menos `Date`) y la URL.',
        '- Debajo de cada fixture está el comando `curl` con el que se capturó; las credenciales se cambian por variables.',
        '- Para volver a capturarlos o compararlos con otro Everything, mira la guía. No se editan a mano.',
        '',
    ]
    for capture in metadata['capturas']:
        search = next((capture['params'][key] for key in ('search', 's', 'q') if key in capture['params']), '')
        lines += [
            f'## {capture["archivo"]}',
            '',
            f'{capture["descripcion"]}. Respuesta: **{capture["status"]}**.',
            '',
            f'Búsqueda: `{search}`',
            '',
            '```bash',
            capture['curl'],
            '```',
            '',
        ]
    (FIXTURES / 'README.md').write_text('\n'.join(lines), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
