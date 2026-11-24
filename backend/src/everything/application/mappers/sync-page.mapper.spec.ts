import type { DocumentRecord } from '../dto/document-record';
import { SyncPageMapper } from './sync-page.mapper';

const AT = new Date('2026-11-20T17:18:26.386Z');
const RECEIVED = new Date('2026-11-23T11:00:00.000Z');
const YEAR =
  'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +';

const record = (
  fullPath: string,
  kind: DocumentRecord['kind'] = 'folder',
): DocumentRecord => {
  const cut = fullPath.lastIndexOf('\\');
  return {
    name: fullPath.slice(cut + 1),
    parentPath: fullPath.slice(0, cut),
    fullPath,
    kind,
    ...(kind === 'file' ? { size: 0 } : {}),
    modifiedAt: AT,
  };
};

describe('SyncPageMapper', () => {
  it('cuenta todos los resultados pero solo guarda las carpetas', () => {
    const page = SyncPageMapper.toPage(
      2,
      [
        record(`${YEAR}\\1ra-1931 - Esc 0001-0109 - Ene`),
        record(`${YEAR}\\1ra-1931 - Esc 0001-0109 - Ene\\001.jpg`, 'file'),
      ],
      RECEIVED,
    );

    expect(page).toEqual({
      number: 2,
      resultsCount: 2,
      folders: [
        { fullPath: `${YEAR}\\1ra-1931 - Esc 0001-0109 - Ene`, modifiedAt: AT },
      ],
      receivedAt: RECEIVED,
    });
  });

  it('devuelve las carpetas de todas las páginas como DocumentRecord, en orden', () => {
    const pages = [
      SyncPageMapper.toPage(1, [record(YEAR)], RECEIVED),
      SyncPageMapper.toPage(
        2,
        [record(`${YEAR}\\1ra-1931 - Esc 0110-0206 - Feb`)],
        RECEIVED,
      ),
    ];

    expect(SyncPageMapper.toRecords(pages)).toEqual([
      record(YEAR),
      record(`${YEAR}\\1ra-1931 - Esc 0110-0206 - Feb`),
    ]);
  });

  it('una ruta sin barras queda entera como nombre', () => {
    const [root] = SyncPageMapper.toRecords([
      SyncPageMapper.toPage(1, [{ ...record('Z:'), fullPath: 'Z:' }], RECEIVED),
    ]);

    expect(root).toMatchObject({ name: 'Z:', parentPath: '', fullPath: 'Z:' });
  });
});
