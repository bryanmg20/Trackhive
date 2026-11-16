/**
 * Architecture rules (#144, docs/arquitectura.md). They follow the Clean
 * Architecture taught in the course plus the team decisions D-A to D-F. They
 * read the source with the TypeScript compiler, so a pull request that breaks
 * the structure fails in `pnpm test`, not only in review.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import * as ts from 'typescript';

const SRC = __dirname;
const SHARED_FOLDERS = new Set(['common', 'prisma']);
const DOMAIN_FOLDERS = new Set([
  'entities',
  'errors',
  'repositories',
  'enums',
  'value-objects',
  'policies',
]);
const DOMAIN_ERROR_BASE = join(SRC, 'common', 'errors', 'domain.error');

interface SourceInfo {
  path: string;
  rel: string;
  source: ts.SourceFile;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return full.endsWith('.ts') ? [full] : [];
  });
}

const isSpec = (path: string): boolean => path.endsWith('.spec.ts');

const sources: SourceInfo[] = walk(SRC)
  .filter((path) => !isSpec(path))
  .map((path) => ({
    path,
    rel: relative(SRC, path).split(sep).join('/'),
    source: ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.ES2022,
      true,
    ),
  }));

const modules = readdirSync(SRC).filter(
  (name) =>
    statSync(join(SRC, name)).isDirectory() && !SHARED_FOLDERS.has(name),
);

/** The layer of a file: src/<module>/<layer>/... */
function layerOf(rel: string): string | null {
  const [module, layer] = rel.split('/');
  if (!module || SHARED_FOLDERS.has(module) || !layer) {
    return null;
  }
  return ['domain', 'application', 'presentation', 'infrastructure'].includes(
    layer,
  )
    ? layer
    : null;
}

function imports(info: SourceInfo): { specifier: string; resolved: string }[] {
  return info.source.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => {
      const specifier = (statement.moduleSpecifier as ts.StringLiteral).text;
      const resolved = specifier.startsWith('.')
        ? resolve(dirname(info.path), specifier)
        : specifier;
      return { specifier, resolved };
    });
}

const relFromSrc = (path: string): string =>
  relative(SRC, path).split(sep).join('/');

function filesIn(pattern: RegExp): SourceInfo[] {
  return sources.filter((info) => pattern.test(info.rel));
}

const useCaseFiles = filesIn(
  /^[^/]+\/application\/use-cases\/[^/]+\.use-case\.ts$/,
);
const serviceFiles = filesIn(/^[^/]+\/application\/services\/[^/]+\.ts$/);

describe('Arquitectura del backend', () => {
  it('el dominio solo tiene las subcarpetas permitidas, sin archivos sueltos', () => {
    const problems: string[] = [];
    for (const module of modules) {
      const domain = join(SRC, module, 'domain');
      let entries: string[];
      try {
        entries = readdirSync(domain);
      } catch {
        continue;
      }
      for (const name of entries) {
        const full = join(domain, name);
        if (!statSync(full).isDirectory()) {
          problems.push(`${module}/domain/${name}: archivo suelto`);
        } else if (!DOMAIN_FOLDERS.has(name)) {
          problems.push(`${module}/domain/${name}/: subcarpeta no permitida`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('el dominio solo importa otro dominio o la clase base DomainError', () => {
    const problems: string[] = [];
    for (const info of sources.filter((s) => layerOf(s.rel) === 'domain')) {
      for (const { specifier, resolved } of imports(info)) {
        const target = specifier.startsWith('.') ? relFromSrc(resolved) : '';
        const allowed =
          specifier.startsWith('.') &&
          (layerOf(`${target}.ts`) === 'domain' ||
            resolved === DOMAIN_ERROR_BASE);
        if (!allowed) {
          problems.push(`${info.rel} importa ${specifier}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('la aplicación no importa presentación ni infraestructura, y un puerto no importa casos de uso', () => {
    const problems: string[] = [];
    for (const info of sources.filter(
      (s) => layerOf(s.rel) === 'application',
    )) {
      for (const { specifier, resolved } of imports(info)) {
        if (!specifier.startsWith('.')) {
          continue;
        }
        const layer = layerOf(`${relFromSrc(resolved)}.ts`);
        if (layer === 'presentation' || layer === 'infrastructure') {
          problems.push(`${info.rel} importa ${specifier}`);
        }
        if (
          info.rel.includes('/application/ports/') &&
          specifier.includes('/use-cases/')
        ) {
          problems.push(
            `${info.rel} (puerto) importa el caso de uso ${specifier}`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('presentación no importa infraestructura ni Prisma, e infraestructura no importa presentación', () => {
    const problems: string[] = [];
    for (const info of sources) {
      const layer = layerOf(info.rel);
      for (const { specifier, resolved } of imports(info)) {
        const target = specifier.startsWith('.')
          ? layerOf(`${relFromSrc(resolved)}.ts`)
          : null;
        if (
          layer === 'presentation' &&
          (target === 'infrastructure' || specifier.startsWith('@prisma/'))
        ) {
          problems.push(`${info.rel} importa ${specifier}`);
        }
        if (layer === 'infrastructure' && target === 'presentation') {
          problems.push(`${info.rel} importa ${specifier}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('un caso de uso no define tipos ni funciones en su archivo (D-C)', () => {
    const problems: string[] = [];
    for (const info of useCaseFiles) {
      for (const statement of info.source.statements) {
        if (
          ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isFunctionDeclaration(statement) ||
          ts.isEnumDeclaration(statement)
        ) {
          problems.push(
            `${info.rel}: ${statement.name?.text ?? 'declaración'}`,
          );
        }
        if (
          ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) =>
              declaration.initializer !== undefined &&
              (ts.isArrowFunction(declaration.initializer) ||
                ts.isFunctionExpression(declaration.initializer)),
          )
        ) {
          problems.push(`${info.rel}: función definida con const`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('execute recibe como máximo una interfaz ...Input de application/dto (D-B)', () => {
    const problems: string[] = [];
    for (const info of useCaseFiles) {
      const inputImports = new Map<string, string>();
      for (const statement of info.source.statements.filter(
        ts.isImportDeclaration,
      )) {
        const specifier = (statement.moduleSpecifier as ts.StringLiteral).text;
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            inputImports.set(element.name.text, specifier);
          }
        }
      }
      ts.forEachChild(info.source, function visit(node) {
        if (ts.isMethodDeclaration(node) && node.name.getText() === 'execute') {
          if (node.parameters.length > 1) {
            problems.push(
              `${info.rel}: execute tiene ${node.parameters.length} parámetros`,
            );
          }
          const [parameter] = node.parameters;
          if (parameter) {
            const type = parameter.type;
            const typeName =
              type && ts.isTypeReferenceNode(type)
                ? type.typeName.getText()
                : '';
            const from = inputImports.get(typeName) ?? '';
            if (
              !typeName.endsWith('Input') ||
              !/^\.\.\/dto\/[^/]+\.input$/.test(from)
            ) {
              problems.push(
                `${info.rel}: execute recibe ${type?.getText() ?? 'sin tipo'}`,
              );
            }
          }
        }
        ts.forEachChild(node, visit);
      });
    }
    expect(problems).toEqual([]);
  });

  it('las respuestas se arman con un mapeador de application/mappers (R6)', () => {
    const problems: string[] = [];
    for (const info of [...useCaseFiles, ...serviceFiles]) {
      // A use case may delegate the response to an application service that
      // builds it with a mapper (login and refresh use SessionTokenIssuer)
      const importsMapper = imports(info).some(
        ({ specifier }) =>
          specifier.startsWith('../mappers/') ||
          specifier.startsWith('../services/'),
      );
      ts.forEachChild(info.source, function visit(node) {
        if (
          ts.isMethodDeclaration(node) &&
          !node.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword,
          ) &&
          node.type?.getText().includes('ResponseDto')
        ) {
          const method = node.name.getText();
          if (!importsMapper) {
            problems.push(`${info.rel}: ${method} no usa un mapeador`);
          }
          const checkReturns = (child: ts.Node): void => {
            if (ts.isFunctionLike(child)) {
              return;
            }
            if (
              ts.isReturnStatement(child) &&
              child.expression &&
              ts.isObjectLiteralExpression(child.expression)
            ) {
              problems.push(`${info.rel}: ${method} arma el DTO a mano`);
            }
            ts.forEachChild(child, checkReturns);
          };
          if (node.body) {
            ts.forEachChild(node.body, checkReturns);
          }
        }
        ts.forEachChild(node, visit);
      });
    }
    expect(problems).toEqual([]);
  });

  it('los contratos con métodos en repositorios y puertos empiezan con I (R9)', () => {
    const problems: string[] = [];
    const contracts = filesIn(
      /^[^/]+\/(domain\/repositories|application\/ports)\/[^/]+\.ts$/,
    );
    for (const info of contracts) {
      for (const statement of info.source.statements) {
        if (!ts.isInterfaceDeclaration(statement)) {
          continue;
        }
        const hasMethods = statement.members.some(
          (member) =>
            ts.isMethodSignature(member) ||
            (ts.isPropertySignature(member) &&
              member.type !== undefined &&
              ts.isFunctionTypeNode(member.type)),
        );
        if (hasMethods && !/^I[A-Z]/.test(statement.name.text)) {
          problems.push(`${info.rel}: ${statement.name.text}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
