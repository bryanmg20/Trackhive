"""Builds the simulated CLENA folder tree from convencion.yaml (HU-133).

The tree is first built in memory, as a map from each folder (its parts,
relative to the docs root) to the files it holds, and then written to disk.
Nothing depends on the order in which the operating system lists a folder, and
every random choice comes from a generator seeded with the fixed seed plus the
folder it is about. Hence Linux and Windows write exactly the same folders and
files, and adding a folder to the convention does not reshuffle the others.
"""

from __future__ import annotations

import hashlib
import os
import random
import shutil
import unicodedata
from pathlib import Path
from typing import Any

import yaml

Parts = tuple[str, ...]
Tree = dict[Parts, tuple[str, ...]]

# Marker file at the root of a generated tree. The generator only deletes an
# existing output folder when it holds this file (or is empty), so a wrong
# --salida never wipes a real folder.
MARKER = 'LEEME.txt'
MARKER_TEXT = (
    'Árbol de documentos SIMULADOS de Trackhive (HU-133).\n'
    'Lo genera dev/simulador/generar_docs.py a partir de convencion.yaml.\n'
    'Las imágenes están vacías y no hay ningún dato real ni personal del CLENA.\n'
    'Se borra y se vuelve a crear cada vez que se ejecuta el generador.\n'
)


def nfc(text: str) -> str:
    """Names are written in NFC so every platform stores the same bytes."""
    return unicodedata.normalize('NFC', text)


def load_convention(path: Path) -> dict[str, Any]:
    with path.open(encoding='utf-8') as file:
        return yaml.safe_load(file)


def _rng(seed: int, *key: object) -> random.Random:
    # A string seed is hashed with SHA-512 by random.Random: the same sequence
    # on every platform and Python 3 version
    return random.Random('|'.join([str(seed), *map(str, key)]))


def split_range(rng: random.Random, start: int, end: int, parts: int) -> list[tuple[int, int]]:
    """Splits start..end into `parts` contiguous, non-empty ranges of similar size."""
    size = end - start + 1
    if parts < 1 or parts > size:
        raise ValueError(f'Cannot split {start}-{end} into {parts} ranges')
    jitter = size // (parts * 4)
    bounds = [start]
    for index in range(1, parts):
        bounds.append(start + (index * size) // parts + rng.randint(-jitter, jitter))
    bounds.append(end + 1)
    return [(bounds[i], bounds[i + 1] - 1) for i in range(parts)]


def _year_volumes(conv: dict[str, Any], notary: dict[str, Any], year: dict[str, Any]) -> list[tuple[str, int, int, bool]]:
    """Month folders of a year as (month, first deed, last deed, without zeros)."""
    if 'rangos' in year:
        volumes = [(month, int(first), int(last), False) for month, first, last in year['rangos']]
    else:
        rng = _rng(conv['semilla'], notary['ordinal'], year['anio'])
        months = conv['meses'][: year.get('meses_digitalizados', 12)]
        month_ranges = split_range(rng, 1, int(year['fin']), 12)
        volumes = []
        for month, (first, last) in zip(months, month_ranges):
            parts = int(year.get('partidos', {}).get(month, 1))
            for part_first, part_last in split_range(rng, first, last, parts):
                volumes.append((month, part_first, part_last, False))
    copy_month = year.get('copia_sin_ceros')
    if copy_month:
        month, first, last, _ = next(v for v in volumes if v[0] == copy_month)
        volumes.append((month, first, last, True))
    return volumes


def _images(conv: dict[str, Any], folder: Parts, name_for_page) -> tuple[str, ...]:
    limits = conv['imagenes_por_hoja']
    count = _rng(conv['semilla'], '/'.join(folder)).randint(limits['min'], limits['max'])
    return tuple(nfc(name_for_page(page)) for page in range(1, count + 1))


def _add_folder(tree: Tree, folder: Parts, files: tuple[str, ...] = ()) -> None:
    folder = tuple(nfc(part) for part in folder)
    for depth in range(len(folder)):
        tree.setdefault(folder[:depth], ())
    if folder in tree and tree[folder]:
        raise ValueError(f'Folder generated twice: {"/".join(folder)}')
    tree[folder] = tuple(files)


def _build_notaries(conv: dict[str, Any], fund: dict[str, Any], tree: Tree) -> None:
    formats = conv['formatos']
    root = tuple(fund['raiz'])
    for notary in fund['notarias']:
        years = [(year, _year_volumes(conv, notary, year)) for year in notary['anios']]
        notary_name = formats['notaria'].format(**notary)
        if notary.get('mostrar_conteo'):
            notary_name += formats['conteo_notaria'].format(n=sum(len(v) for _, v in years))

        for year, volumes in years:
            year_name = formats['anio'].format(
                anio=year['anio'], inicio=1, fin=int(year['fin']), n=len(volumes), marca=year['marca']
            )
            for month, first, last, without_zeros in volumes:
                month_format = formats['mes_sin_ceros' if without_zeros else 'mes']
                month_name = month_format.format(
                    ordinal=notary['ordinal'], anio=year['anio'], inicio=first, fin=last, mes=month
                )
                folder = (*root, notary_name, year_name, month_name)
                images = _images(
                    conv,
                    folder,
                    lambda page, first=first: formats['imagen_mes'].format(
                        pagina=page, ordinal=notary['ordinal'], anio=year['anio'], escritura=first
                    ),
                )
                _add_folder(tree, folder, images)

        for loose in notary.get('sueltas', []):
            folder = (*root, notary_name, loose)
            _add_folder(
                tree,
                folder,
                _images(conv, folder, lambda page, loose=loose: formats['imagen_libre'].format(pagina=page, carpeta=loose)),
            )


def _build_free_fund(conv: dict[str, Any], fund: dict[str, Any], tree: Tree) -> None:
    formats = conv['formatos']
    for relative in fund['carpetas']:
        folder = (*fund['raiz'], *map(str, relative))
        leaf = folder[-1]
        _add_folder(
            tree,
            folder,
            _images(conv, folder, lambda page, leaf=leaf: formats['imagen_libre'].format(pagina=page, carpeta=leaf)),
        )


def build_tree(conv: dict[str, Any]) -> Tree:
    """Every folder of the simulated tree, mapped to the files it holds."""
    tree: Tree = {(): (MARKER,)}
    for fund in conv['fondos']:
        if fund.get('patron') == 'notarias':
            _build_notaries(conv, fund, tree)
        else:
            _build_free_fund(conv, fund, tree)
    for work in conv.get('trabajo', []):
        _add_folder(tree, tuple(work['ruta']), tuple(work.get('archivos', [])))
    return dict(sorted(tree.items()))


def leaves(tree: Tree) -> list[Parts]:
    """Folders without subfolders, as the sync computes them (HU-136)."""
    parents = {folder[:-1] for folder in tree if folder}
    return sorted(folder for folder in tree if folder and folder not in parents)


def write_tree(tree: Tree, output: Path) -> None:
    """Writes the tree to `output`, replacing a previously generated one."""
    if output.exists():
        if not output.is_dir():
            raise SystemExit(f'{output} existe y no es una carpeta')
        if any(output.iterdir()) and not (output / MARKER).is_file():
            raise SystemExit(f'{output} no está vacía y no la generó este script ({MARKER}); no se borra')
        shutil.rmtree(output)
    for folder, files in tree.items():
        directory = output.joinpath(*folder)
        directory.mkdir(parents=True, exist_ok=True)
        for name in files:
            content = MARKER_TEXT.encode('utf-8') if folder == () and name == MARKER else b''
            (directory / name).write_bytes(content)


def fingerprint(output: Path) -> dict[str, Any]:
    """Folders, files and a SHA-256 of what is on disk, the same on any platform."""
    lines = []
    for current, folders, files in os.walk(output):
        base = Path(current).relative_to(output)
        for name in folders:
            lines.append(f'D {nfc((base / name).as_posix())}')
        for name in files:
            path = Path(current) / name
            lines.append(f'F {nfc((base / name).as_posix())} {path.stat().st_size}')
    lines.sort()
    digest = hashlib.sha256('\n'.join(lines).encode('utf-8')).hexdigest()
    return {
        'folders': sum(line.startswith('D ') for line in lines),
        'files': sum(line.startswith('F ') for line in lines),
        'sha256': digest,
    }
