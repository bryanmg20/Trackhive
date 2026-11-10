import { InvalidMaterialStatusError } from '../errors/invalid-material-status.error';
import type { MaterialStatus } from '../material-status';
import { Material } from './material.entity';

const buildMaterial = (): Material =>
  new Material({
    id: 'material-1',
    catalogCode: 'AHM-DOC-0001',
    title: 'Acta del Cabildo de 1810',
    materialType: 'DOCUMENTO',
    author: null,
    collection: 'Actas del Cabildo',
    publicationDate: null,
    publisher: null,
    location: { depot: 'D-01', shelf: 'E-12', box: 'C-034' },
    status: 'DISPONIBLE',
    createdAt: new Date('2026-11-08T00:00:00Z'),
    updatedAt: new Date('2026-11-08T00:00:00Z'),
  });

describe('Material.changeStatus', () => {
  const now = new Date('2026-11-10T15:00:00Z');

  it('has no status change recorded when it is created', () => {
    const material = buildMaterial();

    expect(material.statusChangedAt).toBeNull();
    expect(material.statusChangedBy).toBeNull();
    expect(material.statusChangeReason).toBeNull();
  });

  it('returns a copy with the new status, who changed it, when and why', () => {
    const changed = buildMaterial().changeStatus(
      'EN_RESTAURACION',
      'user-1',
      'Humedad en la caja',
      now,
    );

    expect(changed.status).toBe('EN_RESTAURACION');
    expect(changed.statusChangedBy).toBe('user-1');
    expect(changed.statusChangedAt).toEqual(now);
    expect(changed.statusChangeReason).toBe('Humedad en la caja');
    expect(changed.updatedAt).toEqual(now);
    expect(changed.catalogCode).toBe('AHM-DOC-0001');
  });

  it('keeps the original material unchanged', () => {
    const original = buildMaterial();

    original.changeStatus('NO_CONSULTABLE', 'user-1', null, now);

    expect(original.status).toBe('DISPONIBLE');
  });

  it('accepts a change without a reason', () => {
    const changed = buildMaterial().changeStatus('EN_USO', 'user-1', null, now);

    expect(changed.statusChangeReason).toBeNull();
  });

  it('rejects a status that does not exist', () => {
    expect(() =>
      buildMaterial().changeStatus('ROTO' as MaterialStatus, 'user-1', null),
    ).toThrow(InvalidMaterialStatusError);
  });
});
