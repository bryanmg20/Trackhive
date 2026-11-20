"""Index, search and JSON output of the Everything HTTP server, copied from the
real one (HU-133). The behaviour comes from the fixtures captured from
Everything 1.4.1.1032 (dev/fixtures), not from its documentation: when they
differ, the real one wins.

- Words separated by spaces are ANDed; `|` (OR) binds tighter than the space;
  `!` negates a word; "quotes" keep words together.
- `folder:` and `file:` keep only folders or files, alone or with a word
  (`folder:1577`).
- Without case or diacritics: «NOTARÍA» finds «Notaria».
- A word with `\\` is matched against the full path (`"C:\\x\\"` finds
  everything under C:\\x); otherwise only against the name.
- A word with `*` or `?` must match the whole name (or full path).
- sort=name puts the folders first and breaks ties by path; sort=path orders by
  containing folder and then by name; ascending=0 reverses the whole list.
"""

from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

# 100-nanosecond intervals between 1601-01-01 (Windows FILETIME) and 1970-01-01
FILETIME_EPOCH_OFFSET = 116_444_736_000_000_000


@dataclass(frozen=True)
class Item:
    type: str  # 'folder' or 'file'
    name: str
    path: str  # containing folder, with \\ as Everything reports it
    size: int | None  # None for folders: Everything does not index folder sizes
    date_modified: int  # Windows FILETIME

    @property
    def full_path(self) -> str:
        # The indexed root has no containing folder: its name is its full path
        return f'{self.path}\\{self.name}' if self.path else self.name


def filetime(mtime_ns: int) -> int:
    return mtime_ns // 100 + FILETIME_EPOCH_OFFSET


def build_index(docs: Path, windows_root: str) -> list[Item]:
    """Everything under `docs`, with the paths it would have under `windows_root`.

    Like a folder index of Everything (Indexes → Folders), the root itself is
    an item too: its name is the whole Windows path and its path is empty.
    """
    windows_root = windows_root.rstrip('\\')
    items = [Item('folder', windows_root, '', None, filetime(os.stat(docs).st_mtime_ns))]
    for current, folders, files in os.walk(docs):
        relative = Path(current).relative_to(docs).parts
        parent = '\\'.join([windows_root, *(unicodedata.normalize('NFC', part) for part in relative)])
        for name in folders:
            stat = os.stat(os.path.join(current, name))
            items.append(Item('folder', unicodedata.normalize('NFC', name), parent, None, filetime(stat.st_mtime_ns)))
        for name in files:
            stat = os.stat(os.path.join(current, name))
            items.append(Item('file', unicodedata.normalize('NFC', name), parent, stat.st_size, filetime(stat.st_mtime_ns)))
    return items


@dataclass(frozen=True)
class Options:
    match_case: bool = False
    match_diacritics: bool = False
    match_path: bool = False


@dataclass(frozen=True)
class Term:
    text: str
    kind: str | None = None  # 'folder', 'file' or None
    negate: bool = False


def _fold(text: str, options: Options) -> str:
    if not options.match_diacritics:
        text = ''.join(char for char in unicodedata.normalize('NFD', text) if not unicodedata.combining(char))
        text = unicodedata.normalize('NFC', text)
    return text if options.match_case else text.lower()


def _tokens(search: str) -> list[str]:
    """Splits on spaces and `|` outside quotes; the quotes stay in the token."""
    tokens, current, quoted = [], [], False
    for char in search:
        if char == '"':
            quoted = not quoted
            current.append(char)
        elif not quoted and char in ' \t':
            if current:
                tokens.append(''.join(current))
                current = []
        elif not quoted and char == '|':
            if current:
                tokens.append(''.join(current))
                current = []
            tokens.append('|')
        else:
            current.append(char)
    if current:
        tokens.append(''.join(current))
    return tokens


def _term(token: str) -> Term:
    negate = token.startswith('!')
    if negate:
        token = token[1:]
    kind = None
    for modifier in ('folder:', 'file:'):
        if token.lower().startswith(modifier):
            kind, token = modifier[:-1], token[len(modifier):]
            break
    return Term(token.replace('"', ''), kind, negate)


def parse(search: str) -> list[list[Term]]:
    """AND of groups; each group is an OR of terms."""
    groups: list[list[Term]] = []
    join_next = False
    for token in _tokens(search):
        if token == '|':
            join_next = bool(groups)
            continue
        term = _term(token)
        if join_next:
            groups[-1].append(term)
        else:
            groups.append([term])
        join_next = False
    return groups


def _wildcard(pattern: str) -> re.Pattern[str]:
    return re.compile(''.join('.*' if c == '*' else '.' if c == '?' else re.escape(c) for c in pattern), re.DOTALL)


def _matches(term: Term, item: Item, options: Options) -> bool:
    result = term.kind is None or item.type == term.kind
    if result and term.text:
        target = item.full_path if ('\\' in term.text or options.match_path) else item.name
        text, target = _fold(term.text, options), _fold(target, options)
        if '*' in text or '?' in text:
            result = _wildcard(text).fullmatch(target) is not None
        else:
            result = text in target
    return not result if term.negate else result


def search(items: list[Item], query: str, options: Options = Options()) -> list[Item]:
    groups = parse(query)
    return [item for item in items if all(any(_matches(term, item, options) for term in group) for group in groups)]


def _ordinal(text: str) -> str:
    # Case-insensitive ordinal comparison: a space goes before a hyphen and the
    # digits before the letters («1080» < «1ra - Matrimonios» < «1ra-1931 …»)
    return text.upper()


def _type_rank(item: Item) -> int:
    return 0 if item.type == 'folder' else 1


SORT_KEYS = {
    'name': lambda item: (_type_rank(item), _ordinal(item.name), _ordinal(item.path)),
    'path': lambda item: (_ordinal(item.path), _type_rank(item), _ordinal(item.name)),
    'size': lambda item: (_type_rank(item), item.size or 0, _ordinal(item.name), _ordinal(item.path)),
    'extension': lambda item: (
        _type_rank(item),
        _ordinal(os.path.splitext(item.name)[1]) if item.type == 'file' else '',
        _ordinal(item.name),
        _ordinal(item.path),
    ),
    'date_modified': lambda item: (_type_rank(item), item.date_modified, _ordinal(item.name), _ordinal(item.path)),
}


def sort(items: list[Item], by: str = 'name', ascending: bool = True) -> list[Item]:
    ordered = sorted(items, key=SORT_KEYS.get(by, SORT_KEYS['name']))
    return ordered if ascending else ordered[::-1]


def _escape(text: str) -> str:
    return text.replace('\\', '\\\\').replace('"', '\\"')


def render_json(total: int, items: list[Item], path: bool, size: bool, date_modified: bool) -> bytes:
    """The same bytes as Everything: tabs, CRLF and every value as text."""
    lines = ['{', f'\t"totalResults":{total},', '\t"results":[']
    for index, item in enumerate(items):
        fields = [('type', item.type), ('name', item.name)]
        if path:
            fields.append(('path', item.path))
        if size:
            fields.append(('size', '' if item.size is None else str(item.size)))
        if date_modified:
            fields.append(('date_modified', str(item.date_modified)))
        lines.append('\t\t{')
        for position, (key, value) in enumerate(fields):
            comma = ',' if position < len(fields) - 1 else ''
            lines.append(f'\t\t\t"{key}":"{_escape(value)}"{comma}')
        lines.append('\t\t},' if index < len(items) - 1 else '\t\t}')
    lines += ['\t]', '}']
    return ('\r\n'.join(lines) + '\r\n').encode('utf-8')
