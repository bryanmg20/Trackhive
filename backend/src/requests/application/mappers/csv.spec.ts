import { toCsv } from './csv';
import { ReportCsvMapper } from './report-csv.mapper';

describe('report CSV formatting', () => {
  it('preserves accents, quotes, delimiters and embedded newlines, with BOM and CRLF', () => {
    expect(
      toCsv([
        ['Material', 'Cantidad'],
        ['Actas, "año"\n1890', 2],
        [null, 0],
      ]),
    ).toBe(
      '\uFEFF"Material","Cantidad"\r\n"Actas, ""año""\n1890","2"\r\n"","0"\r\n',
    );
  });
  it.each([
    '=1+1',
    '+SUM(A1)',
    '-1+1',
    '@SUM(A1)',
    '  =HYPERLINK("x")',
    '\tCMD',
    '\rCMD',
    '\nCMD',
  ])('exports formula-like text %j as literal text', (value) => {
    expect(toCsv([[value]])).toBe(
      '\uFEFF"\'' + value.replaceAll('"', '""') + '"\r\n',
    );
  });
  it('leaves ordinary text and numeric values unchanged', () => {
    expect(toCsv([['Actas-1890', 2.5, -2]])).toBe(
      '\uFEFF"Actas-1890","2.5","-2"\r\n',
    );
  });
  it('keeps the ranking filters and ordering, including the applied limit in the file name', () => {
    const result = ReportCsvMapper.ranking(
      {
        from: '2026-11-01',
        to: '2026-11-30',
        totalRequests: 4,
        items: [
          {
            rank: 1,
            materialId: 'm1',
            catalogCode: 'DOC-1',
            title: 'Actas',
            materialType: 'DOCUMENTO',
            requestCount: 3,
          },
        ],
      },
      10,
    );
    expect(result.fileName).toBe(
      'material-mas-solicitado_2026-11-01_2026-11-30_top-10.csv',
    );
    expect(result.content).toContain(
      '"2026-11-01","2026-11-30","4","1","DOC-1","Actas","DOCUMENTO","3"',
    );
    expect(
      ReportCsvMapper.ranking(
        { from: null, to: null, totalRequests: 0, items: [] },
        10,
      ).content.split('\r\n'),
    ).toHaveLength(2);
  });
  it('distinguishes no observations from true zero duration in the attention export', () => {
    const result = ReportCsvMapper.attention({
      from: null,
      to: null,
      completedRequests: 2,
      averageSeconds: 0,
      states: [
        { state: 'RECIBIDA', requestCount: 2, averageSeconds: 0 },
        { state: 'AGENDADA', requestCount: 0, averageSeconds: null },
      ],
    });
    expect(result.content).toContain('"Total","Recibida → Atendida","2","0"');
    expect(result.content).toContain('"Por estado","Agendada","0",""');
  });
});
