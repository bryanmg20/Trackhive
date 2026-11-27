"""agente.toml: what the agent accepts before it connects to anything (HU-166)."""

from __future__ import annotations

import tempfile
import tomllib
import unittest
from pathlib import Path
from typing import Any

from tests.apoyo_agente import AGENT, EXAMPLE_CONFIG, ROOTS, TOKEN, convention_roots, toml_value

from trackhive_agent.domain.errors import InvalidConfigError
from trackhive_agent.infrastructure.config_file import load_config, parse_config

VALID: dict[str, dict[str, Any]] = {
    'everything': {
        'url': 'http://127.0.0.1:8081',
        'user': 'trackhive',
        'password': 'contraseña-de-everything',
        'roots': ROOTS,
    },
    'trackhive': {'url': 'https://trackhive.example.org', 'token': TOKEN},
}


def config_text(everything: dict[str, Any] | None = None, trackhive: dict[str, Any] | None = None, extra: str = '') -> str:
    """A valid configuration with some keys changed; None removes a key."""
    sections = {
        'everything': {**VALID['everything'], **(everything or {})},
        'trackhive': {**VALID['trackhive'], **(trackhive or {})},
    }
    lines = []
    for name, values in sections.items():
        lines.append(f'[{name}]')
        lines += [f'{key} = {toml_value(value)}' for key, value in values.items() if value is not None]
    return '\n'.join(lines) + '\n' + extra


def parse(**sections: dict[str, Any]) -> Any:
    return parse_config(config_text(**sections), AGENT)


def env_example_value(key: str) -> str:
    for line in (AGENT.parent / '.env.example').read_text(encoding='utf-8').splitlines():
        if line.startswith(f'{key}='):
            return line.split('=', 1)[1]
    raise AssertionError(f'{key} no está en .env.example')


class ExampleConfigTest(unittest.TestCase):
    def test_the_example_works_as_it_is_against_docker_compose_and_the_portable_everything(self) -> None:
        # Copied as it is, it reaches the Everything portable (or the mock) and
        # the backend of docker compose with the public token of .env.example
        config = parse_config(EXAMPLE_CONFIG.read_text(encoding='utf-8'), AGENT)
        self.assertEqual(config.everything.url, 'http://127.0.0.1:8081')
        self.assertEqual((config.everything.user, config.everything.password), ('trackhive', 'trackhive-dev'))
        self.assertEqual(config.everything.page_size, 200)
        self.assertEqual(config.trackhive.url, f"http://127.0.0.1:{env_example_value('BACKEND_PORT')}")
        self.assertEqual(config.trackhive.token, env_example_value('EVERYTHING_AGENT_TOKEN'))
        self.assertIsNone(config.trackhive.ca_file)

    def test_the_example_token_is_the_public_one_of_development(self) -> None:
        # The backend refuses it with RUN_SEED=false (everything-sync.config.ts)
        token = tomllib.loads(EXAMPLE_CONFIG.read_text(encoding='utf-8'))['trackhive']['token']
        self.assertIn('no-usar-en-produccion', token)

    def test_the_example_roots_are_the_funds_of_the_backend_convention(self) -> None:
        # The roots the backend parses (base + root): one missing would leave
        # its materials as «copia digital no encontrada»
        text = EXAMPLE_CONFIG.read_text(encoding='utf-8')
        self.assertEqual(list(parse_config(text, AGENT).everything.roots), convention_roots())

    def test_the_real_configuration_is_ignored_by_git(self) -> None:
        ignored = (AGENT.parent / '.gitignore').read_text(encoding='utf-8').splitlines()
        self.assertIn('agente.toml', ignored)


class DefaultsTest(unittest.TestCase):
    def test_defaults(self) -> None:
        config = parse()
        self.assertEqual(config.everything.timeout_seconds, 30)
        self.assertEqual(config.everything.page_size, 200)
        self.assertEqual(config.everything.startup_wait_seconds, 300)
        self.assertEqual(config.trackhive.timeout_seconds, 60)
        self.assertEqual(config.trackhive.close_timeout_seconds, 600)
        self.assertEqual(config.trackhive.attempts, 5)
        self.assertEqual(config.trackhive.retry_delay_seconds, 5)
        self.assertEqual(config.trackhive.poll_seconds, 60)

    def test_the_example_says_how_often_it_asks_for_a_requested_run(self) -> None:
        # A key the example does not show would hardly ever be configured
        text = EXAMPLE_CONFIG.read_text(encoding='utf-8')
        self.assertIn('poll_seconds', tomllib.loads(text)['trackhive'])
        self.assertEqual(parse_config(text, AGENT).trackhive.poll_seconds, 60)

    def test_secrets_never_show_in_the_representation(self) -> None:
        config = parse()
        self.assertNotIn(TOKEN, repr(config))
        self.assertNotIn('contraseña-de-everything', repr(config))


class TrackhiveRulesTest(unittest.TestCase):
    def test_refuses_http_unless_it_is_this_pc(self) -> None:
        with self.assertRaises(InvalidConfigError) as refused:
            parse(trackhive={'url': 'http://trackhive.example.org'})
        self.assertIn('https://', str(refused.exception))
        self.assertEqual(parse(trackhive={'url': 'http://localhost:3000'}).trackhive.url, 'http://localhost:3000')

    def test_the_token_has_at_least_32_characters_and_is_never_shown(self) -> None:
        for token in ('a' * 31, 'a' * 20 + ' ' + 'a' * 20, ''):
            with self.subTest(token=len(token)), self.assertRaises(InvalidConfigError) as refused:
                parse(trackhive={'token': token})
            if token:
                self.assertNotIn(token, str(refused.exception))
        self.assertEqual(parse(trackhive={'token': 'b' * 32}).trackhive.token, 'b' * 32)

    def test_asks_for_a_requested_run_every_minute_by_default(self) -> None:
        # «Sincronizar ahora» (HU-138), with --vigilar
        self.assertEqual(parse().trackhive.poll_seconds, 60)
        self.assertEqual(parse(trackhive={'poll_seconds': 30}).trackhive.poll_seconds, 30)
        for poll in (0, -5, 3601, '60', True):
            with self.subTest(poll=poll), self.assertRaises(InvalidConfigError):
                parse(trackhive={'poll_seconds': poll})

    def test_retries_are_limited(self) -> None:
        for values in ({'attempts': 0}, {'attempts': 11}, {'retry_delay_seconds': 0}, {'attempts': 2.5}):
            with self.subTest(values=values), self.assertRaises(InvalidConfigError):
                parse(trackhive=values)

    def test_a_ca_file_relative_to_the_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'ca.pem').write_text('-', encoding='ascii')
            config = parse_config(config_text(trackhive={'ca_file': 'ca.pem'}), Path(folder))
            self.assertEqual(config.trackhive.ca_file, Path(folder) / 'ca.pem')
            with self.assertRaises(InvalidConfigError):
                parse_config(config_text(trackhive={'ca_file': 'otra.pem'}), Path(folder))


class EverythingRulesTest(unittest.TestCase):
    def test_everything_only_on_this_pc(self) -> None:
        with self.assertRaises(InvalidConfigError):
            parse(everything={'url': 'http://192.168.0.30:8081'})

    def test_user_and_password_are_required(self) -> None:
        for key in ('user', 'password', 'url'):
            with self.subTest(key=key), self.assertRaises(InvalidConfigError):
                parse(everything={key: None})

    def test_page_size_up_to_the_limit_of_trackhive(self) -> None:
        self.assertEqual(parse(everything={'page_size': 500}).everything.page_size, 500)
        for size in (0, 501, '200', True):
            with self.subTest(size=size), self.assertRaises(InvalidConfigError):
                parse(everything={'page_size': size})

    def test_timeout_must_be_positive(self) -> None:
        self.assertEqual(parse(everything={'timeout_seconds': 0.5}).everything.timeout_seconds, 0.5)
        for timeout in (0, -1, 601, 'treinta'):
            with self.subTest(timeout=timeout), self.assertRaises(InvalidConfigError):
                parse(everything={'timeout_seconds': timeout})


class RootsTest(unittest.TestCase):
    def test_full_windows_paths_without_the_final_backslash(self) -> None:
        roots = ['Z:\\Aha\\Fondo - Notarías\\Notarías\\', '\\\\servidor\\Multimedia\\Aha\\Fondo - Periódicos', 'Y:\\']
        self.assertEqual(
            parse(everything={'roots': roots}).everything.roots,
            ('Z:\\Aha\\Fondo - Notarías\\Notarías', '\\\\servidor\\Multimedia\\Aha\\Fondo - Periódicos', 'Y:\\'),
        )

    def test_a_double_quoted_path_turns_backslash_t_into_a_tab(self) -> None:
        # Between double quotes, TOML reads "C:\trackhive\\docs" as C:<tab>rackhive\docs
        root = 'roots = ["C:\\trackhive\\\\docs"]\n'
        text = config_text(everything={'roots': None}).replace('[trackhive]', root + '[trackhive]')
        with self.assertRaises(InvalidConfigError) as refused:
            parse_config(text, AGENT)
        self.assertIn('comillas simples', str(refused.exception))

    def test_rejects_missing_relative_and_overlapping_roots(self) -> None:
        cases = [
            [],
            ['Aha\\Fondo - Notarías'],
            ['C:\\docs\\Aha', 'C:\\docs\\Aha\\Notarías'],
            ['C:\\docs\\Aha', 'c:\\DOCS\\aha\\'],
            ['C:\\docs\\A*'],
        ]
        for roots in cases:
            with self.subTest(roots=roots), self.assertRaises(InvalidConfigError):
                parse(everything={'roots': roots})

    def test_the_message_points_to_the_backend_convention(self) -> None:
        with self.assertRaises(InvalidConfigError) as refused:
            parse(everything={'roots': None})
        self.assertIn('catalog-convention.json', str(refused.exception))


class FileTest(unittest.TestCase):
    def test_unknown_keys_and_sections_are_not_ignored(self) -> None:
        with self.assertRaises(InvalidConfigError) as key:
            parse(everything={'rots': ROOTS})
        self.assertIn('rots', str(key.exception))
        with self.assertRaises(InvalidConfigError):
            parse_config(config_text(extra='[log]\nfile = "x"\n'), AGENT)

    def test_invalid_toml(self) -> None:
        with self.assertRaises(InvalidConfigError):
            parse_config('[everything\nurl = 1', AGENT)

    def test_reads_utf8_with_the_bom_of_notepad(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'agente.toml'
            path.write_bytes(b'\xef\xbb\xbf' + config_text().encode('utf-8'))
            self.assertEqual(load_config(path).everything.roots, tuple(ROOTS))

    def test_refuses_a_file_not_saved_in_utf8(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'agente.toml'
            path.write_bytes(config_text().encode('cp1252'))
            with self.assertRaises(InvalidConfigError) as refused:
                load_config(path)
            self.assertIn('UTF-8', str(refused.exception))

    def test_a_missing_file_says_how_to_create_it(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(InvalidConfigError) as refused:
                load_config(Path(folder) / 'agente.toml')
        self.assertIn('agente.example.toml', str(refused.exception))


if __name__ == '__main__':
    unittest.main()
