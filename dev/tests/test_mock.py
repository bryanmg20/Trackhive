"""The Everything mock answers like the real Everything (HU-133)."""

from __future__ import annotations

import json
import unittest

from apoyo import RunningMock

from busqueda import Item, Options, parse, render_json, search, sort
from comparar_everything import compare
from everything_http import CAPTURES_FILE, FIXTURES, fetch, load_json, path_and_query


class MockAgainstRealFixturesTest(unittest.TestCase):
    """Fails if the mock and the real Everything answer differently."""

    def test_same_status_headers_and_bytes_as_the_real_everything(self) -> None:
        with RunningMock() as mock:
            total, differences = compare(mock.url, mock.user, mock.password, require_bytes=True)
        self.assertGreater(total, 0)
        self.assertEqual([f'{d.id}: {d.reason}' for d in differences], [])

    def test_the_comparison_fails_when_the_answers_differ(self) -> None:
        # Another tree root: same results, different paths
        with RunningMock() as mock:
            mock.server.RequestHandlerClass = _with_root(mock, 'D:\\otra\\raiz')
            _, differences = compare(mock.url, mock.user, mock.password)
        self.assertTrue(any(d.id == 'carpetas_notarias_p1' for d in differences))

    def test_basic_authentication(self) -> None:
        with RunningMock() as mock:
            url = mock.url + path_and_query({'search': 'Aha', 'json': '1'})
            self.assertEqual(fetch(url, None)[0], 401)
            self.assertEqual(fetch(url, (mock.user, 'incorrecta'))[0], 401)
            status, headers, _ = fetch(url, (mock.user, mock.password))
        self.assertEqual(status, 200)
        self.assertIn(('Content-Type', 'application/json'), headers)


def _with_root(mock: RunningMock, root: str) -> type:
    from apoyo import generated
    from everything_mock import make_handler

    docs, _ = generated()
    return make_handler(docs, root, mock.user, mock.password)


class FixturesTest(unittest.TestCase):
    def test_every_fixture_documents_its_curl_command(self) -> None:
        captures = load_json(CAPTURES_FILE)
        readme = (FIXTURES / 'README.md').read_text(encoding='utf-8')
        self.assertIn('1.4.1.1032', captures['everything'])
        for capture in captures['capturas']:
            self.assertTrue((FIXTURES / capture['archivo']).is_file(), capture['archivo'])
            self.assertTrue(capture['curl'].startswith('curl '))
            self.assertIn(capture['curl'], readme)
            # Never the real credentials
            self.assertNotIn('trackhive-dev', capture['curl'])

    def test_includes_a_folders_only_search_under_a_root(self) -> None:
        capture = next(c for c in load_json(CAPTURES_FILE)['capturas'] if c['id'] == 'carpetas_notarias_p1')
        self.assertTrue(capture['params']['search'].startswith('folder: "C:\\trackhive\\docs_simulados\\'))
        body = json.loads((FIXTURES / capture['archivo']).read_bytes())
        self.assertTrue(all(result['type'] == 'folder' for result in body['results']))
        self.assertTrue(all(result['size'] == '' for result in body['results']))
        self.assertTrue(all(result['date_modified'].isdigit() for result in body['results']))

    def test_the_indexed_root_has_its_full_path_as_name(self) -> None:
        body = json.loads((FIXTURES / 'everything_raiz_del_indice.json').read_bytes())
        self.assertEqual(body['results'][0]['name'], 'C:\\trackhive\\docs_simulados')
        self.assertEqual(body['results'][0]['path'], '')


def item(name: str, path: str = 'C:\\r', kind: str = 'file', size: int | None = 0) -> Item:
    return Item(kind, name, path, None if kind == 'folder' else size, 133_000_000_000_000_000)


class SearchTest(unittest.TestCase):
    items = [
        item('Notarías', 'C:\\r\\Aha', 'folder'),
        item('1ra - Notaria Primera', 'C:\\r\\Aha\\Notarías', 'folder'),
        item('001 - Esc 0001.jpg', 'C:\\r\\Aha\\Notarías\\1ra - Notaria Primera'),
        item('Esc en PDF', 'C:\\r', 'folder'),
        item('1ra - 1931 - Esc 0001.pdf', 'C:\\r\\Esc en PDF'),
    ]

    def names(self, query: str, options: Options = Options()) -> list[str]:
        return [found.name for found in search(self.items, query, options)]

    def test_and_or_not_and_quotes(self) -> None:
        self.assertEqual(self.names('esc pdf'), ['Esc en PDF', '1ra - 1931 - Esc 0001.pdf'])
        self.assertEqual(self.names('jpg | pdf'), ['001 - Esc 0001.jpg', 'Esc en PDF', '1ra - 1931 - Esc 0001.pdf'])
        self.assertEqual(self.names('esc !pdf'), ['001 - Esc 0001.jpg'])
        self.assertEqual(self.names('"esc en"'), ['Esc en PDF'])
        self.assertEqual([[t.text for t in g] for g in parse('a b | c')], [['a'], ['b', 'c']])

    def test_folder_and_file_modifiers(self) -> None:
        self.assertEqual(self.names('folder: esc'), ['Esc en PDF'])
        self.assertEqual(self.names('file:esc'), ['001 - Esc 0001.jpg', '1ra - 1931 - Esc 0001.pdf'])

    def test_case_and_diacritics(self) -> None:
        self.assertEqual(self.names('NOTARIAS'), ['Notarías'])
        self.assertEqual(self.names('notaría primera'), ['1ra - Notaria Primera'])
        self.assertEqual(self.names('Notarías', Options(match_diacritics=True)), ['Notarías'])
        self.assertEqual(self.names('notarías', Options(match_case=True)), [])

    def test_a_word_with_backslash_matches_the_full_path(self) -> None:
        self.assertEqual(self.names('"C:\\r\\Aha\\Notarías\\"'), ['1ra - Notaria Primera', '001 - Esc 0001.jpg'])
        self.assertEqual(self.names('C:\\r\\Esc*'), ['Esc en PDF', '1ra - 1931 - Esc 0001.pdf'])

    def test_wildcards_match_the_whole_name(self) -> None:
        self.assertEqual(self.names('*.pdf'), ['1ra - 1931 - Esc 0001.pdf'])
        self.assertEqual(self.names('esc*'), ['Esc en PDF'])

    def test_name_sort_puts_folders_first_and_descending_reverses_all(self) -> None:
        ordered = [found.name for found in sort(self.items, 'name')]
        self.assertEqual(ordered[:3], ['1ra - Notaria Primera', 'Esc en PDF', 'Notarías'])
        self.assertEqual([found.name for found in sort(self.items, 'name', ascending=False)], ordered[::-1])

    def test_json_like_everything(self) -> None:
        body = render_json(1, [item('a\\b "c"', 'C:\\r', 'folder')], path=True, size=True, date_modified=False)
        self.assertEqual(
            body,
            b'{\r\n\t"totalResults":1,\r\n\t"results":[\r\n\t\t{\r\n\t\t\t"type":"folder",\r\n'
            b'\t\t\t"name":"a\\\\b \\"c\\"",\r\n\t\t\t"path":"C:\\\\r",\r\n\t\t\t"size":""\r\n\t\t}\r\n\t]\r\n}\r\n',
        )
        self.assertEqual(render_json(0, [], True, True, True), b'{\r\n\t"totalResults":0,\r\n\t"results":[\r\n\t]\r\n}\r\n')


if __name__ == '__main__':
    unittest.main()
