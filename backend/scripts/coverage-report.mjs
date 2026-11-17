// Coverage report by layer (domain, application) and by feature.
// Reads coverage/coverage-summary.json from `pnpm test:cov`, writes a Markdown
// table to the GitHub Actions job summary (or stdout locally) and exits with 1
// when a layer is under the threshold, so domain cannot hide a weak application.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const THRESHOLD = Number(process.env.COVERAGE_THRESHOLD ?? 70);
const METRICS = ['statements', 'branches', 'functions', 'lines'];
const LAYERS = ['domain', 'application'];
const summaryPath = fileURLToPath(
  new URL('../coverage/coverage-summary.json', import.meta.url),
);

const output = (markdown) => {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (target) appendFileSync(target, `${markdown}\n`);
  else console.log(markdown);
};

if (!existsSync(summaryPath)) {
  output(
    '## Cobertura de dominio y aplicación\n\n' +
      '> [!WARNING]\n> No se generó `coverage/coverage-summary.json`. ' +
      'Revisa el paso `pnpm test:cov`.',
  );
  process.exit(1);
}

const emptyTotals = () =>
  Object.fromEntries(METRICS.map((m) => [m, { covered: 0, total: 0 }]));

const add = (totals, file) => {
  for (const m of METRICS) {
    totals[m].covered += file[m].covered;
    totals[m].total += file[m].total;
  }
};

// A group without measurable code does not lower the coverage
const pct = ({ covered, total }) =>
  total === 0 ? 100 : (100 * covered) / total;
const passes = (totals) => METRICS.every((m) => pct(totals[m]) >= THRESHOLD);
const format = (totals) =>
  METRICS.map((m) => `${pct(totals[m]).toFixed(1)} %`).join(' | ');
// Layers and total block the CI (❌); features only warn (⚠️)
const row = (label, totals, failIcon = '❌') =>
  `| ${passes(totals) ? '✅' : failIcon} ${label} | ${format(totals)} |`;

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const byLayer = Object.fromEntries(LAYERS.map((l) => [l, emptyTotals()]));
const byFeature = new Map();
const total = emptyTotals();

for (const [path, file] of Object.entries(summary)) {
  if (path === 'total') continue;
  // src/<feature>/<layer>/..., with / or \ as separator
  const match = path.match(
    /[\\/]src[\\/]([^\\/]+)[\\/](domain|application)[\\/]/,
  );
  if (!match) continue;
  const [, feature, layer] = match;
  const key = `${feature} / ${layer}`;
  if (!byFeature.has(key)) byFeature.set(key, emptyTotals());

  add(byLayer[layer], file);
  add(byFeature.get(key), file);
  add(total, file);
}

const header =
  '| Alcance | Statements | Branches | Functions | Lines |\n' +
  '|---|---|---|---|---|';

output(
  [
    '## Cobertura de dominio y aplicación',
    '',
    `Umbral mínimo: **${THRESHOLD} %** en cada métrica, por capa y en total.`,
    '',
    header,
    ...LAYERS.map((l) => row(l, byLayer[l])),
    row('**Total**', total),
    '',
    '<details><summary>Detalle por feature</summary>',
    '',
    header,
    ...[...byFeature.keys()].sort().map((k) => row(k, byFeature.get(k), '⚠️')),
    '',
    '</details>',
    '',
  ].join('\n'),
);

const failing = LAYERS.filter((l) => !passes(byLayer[l]));
if (failing.length > 0) {
  console.error(
    `La cobertura de ${failing.join(' y ')} está por debajo del ${THRESHOLD} %.`,
  );
  process.exit(1);
}
