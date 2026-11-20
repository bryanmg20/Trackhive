"""Generates dev/docs_simulados and dev/manifiesto.json from convencion.yaml (HU-133).

    python dev/simulador/generar_docs.py
    python dev/simulador/generar_docs.py --salida C:\\trackhive\\docs_simulados

Runs the same on Linux and Windows: same folders, same files, same manifest.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from arbol import build_tree, fingerprint, load_convention, write_tree  # noqa: E402
from reglas import build_manifest  # noqa: E402

DEV = HERE.parent
DEFAULT_CONVENTION = HERE / 'convencion.yaml'
DEFAULT_OUTPUT = DEV / 'docs_simulados'
DEFAULT_MANIFEST = DEV / 'manifiesto.json'


def generate(convention: Path, output: Path, manifest: Path) -> dict:
    conv = load_convention(convention)
    tree = build_tree(conv)
    write_tree(tree, output)
    result = build_manifest(conv, tree, fingerprint(output))
    manifest.parent.mkdir(parents=True, exist_ok=True)
    # LF and UTF-8 on every platform: the committed file does not change on Windows
    with manifest.open('w', encoding='utf-8', newline='\n') as file:
        json.dump(result, file, ensure_ascii=False, indent=2)
        file.write('\n')
    return result


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description='Genera el árbol de documentos simulados del CLENA y su manifiesto.')
    parser.add_argument('--convencion', type=Path, default=DEFAULT_CONVENTION, help='archivo de convención (YAML)')
    parser.add_argument('--salida', type=Path, default=DEFAULT_OUTPUT, help='carpeta del árbol (se reemplaza)')
    parser.add_argument('--manifiesto', type=Path, default=DEFAULT_MANIFEST, help='archivo manifiesto.json')
    args = parser.parse_args(argv)

    result = generate(args.convencion, args.salida, args.manifiesto)
    summary, tree = result['summary'], result['tree']
    print(f'Árbol: {args.salida} ({tree["folders"]} carpetas, {tree["files"]} archivos)')
    print(f'Huella SHA-256: {tree["sha256"]}')
    print(
        f'Manifiesto: {args.manifiesto} ({summary["leaves"]} hojas: {summary["valid"]} válidas, '
        f'{summary["needsReview"]} para revisión; {summary["excluded"]} carpetas de trabajo excluidas)'
    )


if __name__ == '__main__':
    main()
