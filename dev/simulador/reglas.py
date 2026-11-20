"""Reference rules that turn a leaf folder into the expected material (HU-133).

They write manifiesto.json: what the parse of HU-136 must extract from every
leaf folder of docs_simulados. The parse in the backend is written again in
TypeScript and its tests walk the manifest, so these rules are the contract
between both. They are documented in docs/everything-desarrollo.md.
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter
from typing import Any

from arbol import Parts, Tree, leaves, nfc

# Windows separator: the paths of the manifest look like the ones Everything returns
SEP = '\\'

_ORDINAL = r'(?P<numero>\d+)(?:ra|da|ta|ma|va|na)'

# 1ra - Notaria Primera de Barranquilla - 1815 a 1979 [(499)]
NOTARY_RE = re.compile(
    rf'^{_ORDINAL} - (?P<nombre>Notar[ií]a .+?) - (?P<desde>\d{{4}}) a (?P<hasta>\d{{4}})(?: \(\d+\))?$'
)
# 1931 - Esc 1-1290 (12) [+ | + ptes | + Ptes]
YEAR_RE = re.compile(r'^(?P<anio>\d{4}) - Esc (?P<inicio>\d+)-(?P<fin>\d+)(?: \(\d+\))?(?: \+(?: [Pp]tes)?)?$')
# 1ra-1931 - Esc 0001-0109 - Ene
MONTH_RE = re.compile(
    rf'^{_ORDINAL}-(?P<anio>\d{{4}}) - Esc (?P<inicio>\d+)-(?P<fin>\d+) - '
    r'(?P<mes>Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)$'
)

MONTH_NAMES = {
    'Ene': 'enero', 'Feb': 'febrero', 'Mar': 'marzo', 'Abr': 'abril',
    'May': 'mayo', 'Jun': 'junio', 'Jul': 'julio', 'Ago': 'agosto',
    'Sep': 'septiembre', 'Oct': 'octubre', 'Nov': 'noviembre', 'Dic': 'diciembre',
}

# Type of material by fund (HU-136); any other fund is DOCUMENTO
DEFAULT_MATERIAL_TYPE = 'DOCUMENTO'

# Column catalog_code is varchar(40)
MAX_CODE_LENGTH = 40

NO_PATTERN = 'NO_PATTERN'
DUPLICATE_CODE = 'DUPLICATE_CODE'
OUTSIDE_ROOT = 'OUTSIDE_ROOT'


def fallback_code(prefix: str, relative: Parts) -> str:
    """Fund prefix plus a short hash of the path relative to the fund root.

    SHA-256 of the UTF-8 (NFC) relative path joined with `\\`, first 8 hex
    digits in upper case: NOT-1A2B3C4D.
    """
    digest = hashlib.sha256(nfc(SEP.join(relative)).encode('utf-8')).hexdigest()
    return f'{prefix}-{digest[:8].upper()}'


def notary_title(folder: str) -> str | None:
    """«Notaría Primera de Barranquilla» from the notary folder, if it has the pattern."""
    match = NOTARY_RE.match(folder)
    if not match:
        return None
    return re.sub(r'^Notar[ií]a', 'Notaría', match['nombre'])


def parse_notary_leaf(fund: dict[str, Any], relative: Parts) -> dict[str, Any]:
    """Code and title of a notary → year → month leaf; None code if it has no pattern."""
    if len(relative) == 3:
        notary, year, month = relative
        notary_match, year_match, month_match = NOTARY_RE.match(notary), YEAR_RE.match(year), MONTH_RE.match(month)
        if notary_match and year_match and month_match:
            first, last = int(month_match['inicio']), int(month_match['fin'])
            if first <= last:
                return {
                    'code': f"{fund['prefijo']}{int(month_match['numero'])}-{month_match['anio']}-{first:04d}-{last:04d}",
                    'title': (
                        f'{notary_title(notary)} · {month_match["anio"]} · '
                        f'Escrituras {first}–{last} ({MONTH_NAMES[month_match["mes"]]})'
                    ),
                }
    # Fallback: the folder name, with the notary when the first level has it
    title = relative[-1]
    notary = notary_title(relative[0]) if len(relative) > 1 else None
    return {'code': None, 'title': f'{notary} · {title}' if notary else title}


def parse_leaf(fund: dict[str, Any], relative: Parts) -> dict[str, Any]:
    if fund.get('patron') == 'notarias':
        return parse_notary_leaf(fund, relative)
    # Fund without a known pattern: always the fallback
    return {'code': None, 'title': relative[-1]}


def _under(folder: Parts, root: Parts) -> bool:
    # By path parts, never by text: «Fondo - Notarías\Esc en PDF» is not under
    # «Fondo - Notarías\Notarías»
    return len(folder) > len(root) and folder[: len(root)] == root


def build_manifest(conv: dict[str, Any], tree: Tree, tree_fingerprint: dict[str, Any]) -> dict[str, Any]:
    funds = [(tuple(nfc(part) for part in fund['raiz']), fund) for fund in conv['fondos']]
    entries = []
    excluded = []
    for leaf in leaves(tree):
        owner = next(((root, fund) for root, fund in funds if _under(leaf, root)), None)
        if owner is None:
            excluded.append({'path': SEP.join(leaf), 'reason': OUTSIDE_ROOT})
            continue
        root, fund = owner
        relative = leaf[len(root):]
        parsed = parse_leaf(fund, relative)
        entries.append({
            'path': SEP.join(leaf),
            'fundRoot': SEP.join(root),
            'relativePath': SEP.join(relative),
            'folderName': leaf[-1],
            'parsedCode': parsed['code'],
            'catalogCode': parsed['code'] or fallback_code(fund['prefijo'], relative),
            'title': parsed['title'],
            'collection': fund['coleccion'],
            'materialType': fund.get('tipo_material', DEFAULT_MATERIAL_TYPE),
            'needsReview': parsed['code'] is None,
            'reviewReason': None if parsed['code'] else NO_PATTERN,
            'images': len(tree[leaf]),
        })

    # The same code in two leaves: both for review, with the code of their path
    repeated = Counter(entry['parsedCode'] for entry in entries if entry['parsedCode'])
    prefixes = {SEP.join(root): fund['prefijo'] for root, fund in funds}
    for entry in entries:
        if entry['parsedCode'] and repeated[entry['parsedCode']] > 1:
            relative = tuple(entry['relativePath'].split(SEP))
            entry['catalogCode'] = fallback_code(prefixes[entry['fundRoot']], relative)
            entry['needsReview'] = True
            entry['reviewReason'] = DUPLICATE_CODE

    codes = Counter(entry['catalogCode'] for entry in entries)
    clashes = [code for code, count in codes.items() if count > 1]
    if clashes:
        raise ValueError(f'Catalog codes repeated after the fallback: {clashes}')
    too_long = [entry['catalogCode'] for entry in entries if len(entry['catalogCode']) > MAX_CODE_LENGTH]
    if too_long:
        raise ValueError(f'Catalog codes longer than {MAX_CODE_LENGTH}: {too_long}')

    return {
        'description': (
            'What the parse (HU-136) must extract from every leaf folder of '
            'dev/docs_simulados. Generated by dev/simulador/generar_docs.py from '
            'convencion.yaml: do not edit by hand.'
        ),
        'seed': conv['semilla'],
        'windowsRoot': conv['raiz_windows'],
        'tree': tree_fingerprint,
        'funds': [
            {
                'root': SEP.join(root),
                'collection': fund['coleccion'],
                'prefix': fund['prefijo'],
                'materialType': fund.get('tipo_material', DEFAULT_MATERIAL_TYPE),
                'pattern': fund.get('patron'),
            }
            for root, fund in funds
        ],
        'summary': {
            'leaves': len(entries),
            'valid': sum(not entry['needsReview'] for entry in entries),
            'needsReview': sum(entry['needsReview'] for entry in entries),
            'excluded': len(excluded),
        },
        'leaves': entries,
        'excluded': excluded,
    }
