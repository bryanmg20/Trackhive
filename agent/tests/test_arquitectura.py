"""The layers of the agent follow the dependency rule of the backend (D-25),
checked here as backend/src/architecture.spec.ts does there (HU-166)."""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

from tests.apoyo_agente import AGENT

PACKAGE = AGENT / 'trackhive_agent'
LAYERS = ('domain', 'application', 'infrastructure', 'presentation')

# Layers each layer may import: never an outer one (R1 of D-25)
ALLOWED_LAYERS = {
    'domain': {'domain'},
    'application': {'domain', 'application'},
    'infrastructure': {'domain', 'application', 'infrastructure', ''},
    'presentation': {'domain', 'application', 'infrastructure', 'presentation', ''},
}
# The domain and the application do no I/O: no HTTP, TLS, files, clock nor
# configuration file; that is the infrastructure
ALLOWED_LIBRARIES = {
    'domain': {'__future__', 'dataclasses', 'ipaddress', 'typing', 'urllib.parse', 're', 'unicodedata'},
    'application': {'__future__', 'dataclasses', 'typing', 'logging'},
}


def imports_of(path: Path) -> list[str]:
    """Every module `path` imports, relative imports made absolute."""
    package = path.relative_to(AGENT).with_suffix('').parts[:-1]
    found = []
    for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
        if isinstance(node, ast.Import):
            found += [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                base = package[: len(package) - node.level + 1]
                found.append('.'.join([*base, *([node.module] if node.module else [])]))
            else:
                found.append(node.module or '')
    return found


def modules_of(layer: str) -> list[Path]:
    return sorted((PACKAGE / layer).glob('*.py'))


class DependencyRuleTest(unittest.TestCase):
    def test_every_layer_has_modules(self) -> None:
        for layer in LAYERS:
            self.assertTrue(modules_of(layer), layer)

    def test_no_layer_imports_an_outer_one(self) -> None:
        for layer in LAYERS:
            for path in modules_of(layer):
                for module in imports_of(path):
                    if module == 'trackhive_agent' or module.startswith('trackhive_agent.'):
                        target = module.split('.')[1] if '.' in module else ''
                        with self.subTest(file=path.name, module=module):
                            self.assertIn(target, ALLOWED_LAYERS[layer])

    def test_the_domain_and_the_application_do_no_io(self) -> None:
        for layer, allowed in ALLOWED_LIBRARIES.items():
            for path in modules_of(layer):
                for module in imports_of(path):
                    if not module.startswith('trackhive_agent'):
                        with self.subTest(file=f'{layer}/{path.name}', module=module):
                            self.assertIn(module, allowed)

    def test_ports_start_with_i(self) -> None:
        # R9 of D-25: the contracts with methods start with I
        tree = ast.parse((PACKAGE / 'application' / 'ports.py').read_text(encoding='utf-8'))
        ports = [node.name for node in tree.body if isinstance(node, ast.ClassDef)]
        self.assertTrue(ports)
        self.assertTrue(all(name.startswith('I') and name[1].isupper() for name in ports), ports)


if __name__ == '__main__':
    unittest.main()
