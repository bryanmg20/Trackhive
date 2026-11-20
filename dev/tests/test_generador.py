"""The generator of docs_simulados and its manifest (HU-133)."""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from apoyo import COMMITTED_MANIFEST, CONVENTION, REPO, convention, generated

import generar_docs
from arbol import MARKER, build_tree, fingerprint, write_tree

EXAMPLE_PATH = (
    '1ra - Notaria Primera de Barranquilla - 1815 a 1979\\'
    '1931 - Esc 1-1290 (12) +\\'
    '1ra-1931 - Esc 0001-0109 - Ene'
)
NOTARY_RE = re.compile(r'^\d+(ra|da|ta) - Notaria \w+ de \w+ - \d{4} a \d{4}( \(\d+\))?$')
YEAR_RE = re.compile(r'^\d{4} - Esc 1-\d{4} \(\d{2}\)( \+( [Pp]tes)?)?$')
MONTH_RE = re.compile(r'^\d+(ra|da|ta)-\d{4} - Esc (\d{4}-\d{4}|\d+-\d+) - [A-Z][a-z]{2}$')


def leaves_by_path(manifest: dict) -> dict[str, dict]:
    return {leaf['relativePath']: leaf for leaf in manifest['leaves']}


class DeterminismTest(unittest.TestCase):
    def test_the_same_convention_always_writes_the_same_tree(self) -> None:
        docs, manifest = generated()
        with tempfile.TemporaryDirectory() as other:
            again = generar_docs.generate(CONVENTION, Path(other) / 'docs', Path(other) / 'manifiesto.json')
        self.assertEqual(manifest, again)
        self.assertEqual(fingerprint(docs), manifest['tree'])

    def test_the_committed_manifest_is_up_to_date(self) -> None:
        # The fingerprint is computed from the files on disk: run on Windows
        # (CI matrix), this proves Linux and Windows generate the same tree
        _, manifest = generated()
        with COMMITTED_MANIFEST.open(encoding='utf-8') as file:
            committed = json.load(file)
        self.assertEqual(
            committed,
            manifest,
            'dev/manifiesto.json está desactualizado: python dev/simulador/generar_docs.py',
        )

    def test_never_deletes_a_folder_it_did_not_generate(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'documento real.txt').write_text('no borrar', encoding='utf-8')
            with self.assertRaises(SystemExit):
                write_tree(build_tree(convention()), Path(folder))
            self.assertTrue((Path(folder) / 'documento real.txt').exists())

    def test_replaces_a_tree_it_generated_before(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'docs'
            write_tree(build_tree(convention()), output)
            (output / 'sobrante').mkdir()
            write_tree(build_tree(convention()), output)
            self.assertFalse((output / 'sobrante').exists())
            self.assertTrue((output / MARKER).is_file())


class RealStructureTest(unittest.TestCase):
    def setUp(self) -> None:
        self.docs, self.manifest = generated()
        self.leaves = leaves_by_path(self.manifest)
        self.notaries = self.docs / 'Aha' / 'Fondo - Notarías' / 'Notarías'

    def test_fund_root_notary_year_month_with_images_in_the_month(self) -> None:
        month = self.notaries.joinpath(*EXAMPLE_PATH.split('\\'))
        self.assertTrue(month.is_dir())
        images = sorted(path.name for path in month.iterdir())
        self.assertIn('002 - 1ra - 1931 - Esc 0001.jpg', images)
        self.assertTrue(all(path.is_file() for path in month.iterdir()))

    def test_every_level_keeps_the_shape_of_the_real_names(self) -> None:
        loose = {'1ra - Matrimonios', '1080', '1823 - 1827'}
        for notary in self.notaries.iterdir():
            self.assertRegex(notary.name, NOTARY_RE)
            for year in notary.iterdir():
                if year.name in loose:
                    continue
                self.assertRegex(year.name, YEAR_RE)
                for month in year.iterdir():
                    self.assertRegex(month.name, MONTH_RE)

    def test_the_count_in_parentheses_is_the_number_of_folders_inside(self) -> None:
        for notary in self.notaries.iterdir():
            months = 0
            for year in notary.iterdir():
                count = re.search(r'\((\d+)\)', year.name)
                if count:
                    inside = sum(1 for child in year.iterdir() if child.is_dir())
                    self.assertEqual(int(count[1]), inside, year.name)
                    months += inside
            shown = re.search(r'\((\d+)\)$', notary.name)
            if shown:
                self.assertEqual(int(shown[1]), months, notary.name)

    def test_year_marks_and_variable_leading_zeros(self) -> None:
        years = [year.name for notary in self.notaries.iterdir() for year in notary.iterdir()]
        self.assertTrue(any(name.endswith(' +') for name in years))
        self.assertTrue(any(name.endswith(' + ptes') for name in years))
        self.assertTrue(any(name.endswith(' + Ptes') for name in years))
        self.assertTrue(any(re.search(r' \(\d+\)$', name) for name in years))
        self.assertIn('1932 - Esc 1-0820 (07) +', years)
        self.assertTrue(any(' - Esc 1-161 - Ene' in path for path in self.leaves))

    def test_months_split_in_several_folders(self) -> None:
        january_1950 = [path for path in self.leaves if path.split('\\')[-1].startswith('3ra-1950') and path.endswith('- Ene')]
        self.assertEqual(len(january_1950), 2)

    def test_folders_without_the_pattern(self) -> None:
        for name in ('1080', '1823 - 1827', '1ra - Matrimonios'):
            leaf = self.leaves[f'1ra - Notaria Primera de Barranquilla - 1815 a 1979\\{name}']
            self.assertTrue(leaf['needsReview'])
            self.assertEqual(leaf['reviewReason'], 'NO_PATTERN')
            self.assertEqual(leaf['title'], f'Notaría Primera de Barranquilla · {name}')
            self.assertRegex(leaf['catalogCode'], r'^NOT-[0-9A-F]{8}$')

    def test_the_same_code_in_two_folders(self) -> None:
        duplicated = [leaf for leaf in self.manifest['leaves'] if leaf['reviewReason'] == 'DUPLICATE_CODE']
        self.assertEqual(len(duplicated), 2)
        self.assertEqual({leaf['parsedCode'] for leaf in duplicated}, {duplicated[0]['parsedCode']})
        self.assertNotEqual(duplicated[0]['catalogCode'], duplicated[1]['catalogCode'])

    def test_a_newspaper_fund_without_a_known_pattern(self) -> None:
        newspapers = [leaf for leaf in self.manifest['leaves'] if leaf['collection'] == 'Periódicos']
        self.assertGreater(len(newspapers), 0)
        for leaf in newspapers:
            self.assertEqual(leaf['materialType'], 'PERIODICO')
            self.assertTrue(leaf['needsReview'])
            self.assertEqual(leaf['title'], leaf['folderName'])
            self.assertRegex(leaf['catalogCode'], r'^PER-[0-9A-F]{8}$')

    def test_any_other_fund_is_documento(self) -> None:
        others = [leaf for leaf in self.manifest['leaves'] if leaf['collection'] == 'Correspondencia']
        self.assertGreater(len(others), 0)
        self.assertTrue(all(leaf['materialType'] == 'DOCUMENTO' for leaf in others))

    def test_work_folders_outside_the_fund_roots_are_not_materials(self) -> None:
        excluded = {item['path'] for item in self.manifest['excluded']}
        self.assertEqual(
            excluded,
            {'Aha\\Fondo - Notarías\\Esc en PDF', 'Escritura 1577', 'Empaste 2026', '3ra-1950 - Esc 0051-0160 - Ene'},
        )
        self.assertTrue(all(not leaf['path'].startswith(tuple(excluded)) for leaf in self.manifest['leaves']))
        # The work copy repeats the name of a month inside the fund: only the
        # root restriction keeps it out
        self.assertIn('3ra-1950 - Esc 0051-0160 - Ene', {leaf['folderName'] for leaf in self.manifest['leaves']})


class ImagesTest(unittest.TestCase):
    def test_every_month_folder_has_a_few_empty_images(self) -> None:
        docs, manifest = generated()
        limits = convention()['imagenes_por_hoja']
        for leaf in manifest['leaves']:
            files = list(docs.joinpath(*leaf['path'].split('\\')).iterdir())
            self.assertTrue(limits['min'] <= len(files) <= limits['max'], leaf['path'])
            self.assertEqual(leaf['images'], len(files))
            for image in files:
                self.assertEqual(image.suffix, '.jpg')
                self.assertEqual(image.stat().st_size, 0)

    def test_no_real_content_enters_the_tree(self) -> None:
        docs, _ = generated()
        for path in docs.rglob('*'):
            if path.is_file() and path.name != MARKER:
                self.assertEqual(path.stat().st_size, 0, path)
                self.assertIn(path.suffix, {'.jpg', '.pdf'}, path)


class ManifestTest(unittest.TestCase):
    def setUp(self) -> None:
        _, self.manifest = generated()
        self.leaves = leaves_by_path(self.manifest)

    def test_the_parse_example_of_hu_136(self) -> None:
        leaf = self.leaves[EXAMPLE_PATH]
        self.assertEqual(leaf['catalogCode'], 'NOT1-1931-0001-0109')
        self.assertEqual(leaf['title'], 'Notaría Primera de Barranquilla · 1931 · Escrituras 1–109 (enero)')
        self.assertEqual(leaf['collection'], 'Notarías')
        self.assertEqual(leaf['materialType'], 'PROTOCOLO_NOTARIAL')
        self.assertFalse(leaf['needsReview'])
        self.assertIsNone(leaf['reviewReason'])

    def test_every_leaf_has_what_the_parse_must_extract(self) -> None:
        for leaf in self.manifest['leaves']:
            self.assertTrue(leaf['catalogCode'] and len(leaf['catalogCode']) <= 40)
            self.assertTrue(leaf['title'])
            self.assertIn(leaf['materialType'], {'PROTOCOLO_NOTARIAL', 'PERIODICO', 'DOCUMENTO'})
            self.assertEqual(leaf['needsReview'], leaf['reviewReason'] is not None)

    def test_catalog_codes_are_unique(self) -> None:
        codes = Counter(leaf['catalogCode'] for leaf in self.manifest['leaves'])
        self.assertEqual([code for code, count in codes.items() if count > 1], [])

    def test_some_codes_are_materials_of_the_database_seed(self) -> None:
        seed = (REPO / 'backend' / 'prisma' / 'seed.ts').read_text(encoding='utf-8')
        seed_codes = set(re.findall(r"catalogCode: '([^']+)'", seed))
        by_code = {leaf['catalogCode']: leaf for leaf in self.manifest['leaves']}
        shared = seed_codes & set(by_code)
        self.assertGreaterEqual(len(shared), 3, shared)

        # Their digital path is the folder as Everything reports it
        root = re.search(r"const DIGITAL_ROOT =\s*'([^']+)'", seed)[1].replace('\\\\', '\\')
        for code in shared:
            entry = re.search(rf"catalogCode: '{code}',.*?digitalPath: `\$\{{DIGITAL_ROOT\}}([^`]+)`", seed, re.DOTALL)
            self.assertIsNotNone(entry, code)
            leaf = by_code[code]
            self.assertEqual(
                root + entry[1].replace('\\\\', '\\'),
                f'{self.manifest["windowsRoot"]}\\{leaf["path"]}',
            )
            self.assertIn(leaf['title'], seed)


if __name__ == '__main__':
    unittest.main()
