import { InvalidMaterialReviewReasonError } from '../errors/invalid-material-review-reason.error';
import { InvalidMaterialSourceError } from '../errors/invalid-material-source.error';
import { InvalidMaterialStatusError } from '../errors/invalid-material-status.error';
import { InvalidMaterialTypeError } from '../errors/invalid-material-type.error';
import { MaterialInUseError } from '../errors/material-in-use.error';
import { MaterialStatusNotManualError } from '../errors/material-status-not-manual.error';
import type { MaterialReviewReason } from '../enums/material-review-reason';
import type { MaterialSource } from '../enums/material-source';
import type { MaterialStatus } from '../enums/material-status';
import type { MaterialType } from '../enums/material-type';
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
      'Humedad en las hojas',
      now,
    );

    expect(changed.status).toBe('EN_RESTAURACION');
    expect(changed.statusChangedBy).toBe('user-1');
    expect(changed.statusChangedAt).toEqual(now);
    expect(changed.statusChangeReason).toBe('Humedad en las hojas');
    expect(changed.updatedAt).toEqual(now);
    expect(changed.catalogCode).toBe('AHM-DOC-0001');
  });

  it('keeps the original material unchanged', () => {
    const original = buildMaterial();

    original.changeStatus('NO_CONSULTABLE', 'user-1', null, now);

    expect(original.status).toBe('DISPONIBLE');
  });

  it('accepts a change without a reason', () => {
    const changed = buildMaterial().changeStatus(
      'EN_RESTAURACION',
      'user-1',
      null,
      now,
    );

    expect(changed.statusChangeReason).toBeNull();
  });

  it('rejects EN_USO as a manual target status (HU-72)', () => {
    expect(() =>
      buildMaterial().changeStatus('EN_USO', 'user-1', null, now),
    ).toThrow(MaterialStatusNotManualError);
  });

  it('rejects changing a material that is currently EN_USO (HU-72)', () => {
    const inUse = new Material({ ...buildMaterial(), status: 'EN_USO' });

    expect(() => inUse.changeStatus('DISPONIBLE', 'user-1', null, now)).toThrow(
      MaterialInUseError,
    );
  });

  it('rejects a status that does not exist', () => {
    expect(() =>
      buildMaterial().changeStatus('ROTO' as MaterialStatus, 'user-1', null),
    ).toThrow(InvalidMaterialStatusError);
  });
});

describe('Material', () => {
  it('rejects a material type that does not exist', () => {
    const props = { ...buildMaterial(), materialType: 'MAPA' as MaterialType };

    expect(() => new Material(props)).toThrow(InvalidMaterialTypeError);
  });

  it('exposes a stable error code for an invalid material type', () => {
    expect(new InvalidMaterialTypeError().code).toBe('INVALID_MATERIAL_TYPE');
  });

  it('is MANUAL and without digital copy when the source is not given (HU-134)', () => {
    const material = buildMaterial();

    expect(material.source).toBe('MANUAL');
    expect(material.digitalPath).toBeNull();
    expect(material.lastSeenAt).toBeNull();
  });

  it('accepts a material from Everything with its digital copy', () => {
    const seenAt = new Date('2026-11-18T05:00:00Z');
    const material = new Material({
      ...buildMaterial(),
      source: 'EVERYTHING',
      digitalPath: 'D:\\Digitalizados\\M245.pdf',
      lastSeenAt: seenAt,
    });

    expect(material).not.toHaveProperty('location');
    expect(material.source).toBe('EVERYTHING');
    expect(material.digitalPath).toBe('D:\\Digitalizados\\M245.pdf');
    expect(material.lastSeenAt).toEqual(seenAt);
  });

  it('keeps the source and the digital copy when the status changes', () => {
    const material = new Material({
      ...buildMaterial(),
      source: 'EVERYTHING',
      digitalPath: 'D:\\Digitalizados\\M245.pdf',
    });

    const changed = material.changeStatus('EN_RESTAURACION', 'user-1', null);

    expect(changed.source).toBe('EVERYTHING');
    expect(changed.digitalPath).toBe('D:\\Digitalizados\\M245.pdf');
  });

  it('rejects a source that does not exist', () => {
    const props = {
      ...buildMaterial(),
      source: 'EXCEL' as MaterialSource,
    };

    expect(() => new Material(props)).toThrow(InvalidMaterialSourceError);
    expect(new InvalidMaterialSourceError().code).toBe(
      'INVALID_MATERIAL_SOURCE',
    );
  });

  it('has nothing to review when the sync gave its code (HU-137)', () => {
    const material = buildMaterial();

    expect(material.reviewReason).toBeNull();
    expect(material.needsReview).toBe(false);
    expect(material.hasDigitalCopy).toBe(false);
    expect(material.digitalFolderName).toBeNull();
  });

  it('exposes the leaf folder name and hasDigitalCopy for Windows and UNC paths (HU-140)', () => {
    const windowsMaterial = new Material({
      ...buildMaterial(),
      source: 'EVERYTHING',
      digitalPath:
        'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera\\1931\\1ra-1931 - Esc 0001-0109 - Ene',
    });
    const uncMaterial = new Material({
      ...buildMaterial(),
      source: 'EVERYTHING',
      digitalPath: '\\\\servidor\\Multimedia\\Aha\\1902',
    });

    expect(windowsMaterial.hasDigitalCopy).toBe(true);
    expect(windowsMaterial.digitalFolderName).toBe(
      '1ra-1931 - Esc 0001-0109 - Ene',
    );
    expect(uncMaterial.hasDigitalCopy).toBe(true);
    expect(uncMaterial.digitalFolderName).toBe('1902');

    const changed = windowsMaterial.changeStatus(
      'EN_RESTAURACION',
      'user-1',
      null,
    );
    expect(changed.hasDigitalCopy).toBe(true);
    expect(changed.digitalFolderName).toBe('1ra-1931 - Esc 0001-0109 - Ene');
  });

  it.each(['NO_PATTERN', 'DUPLICATE_CODE'] as const)(
    'keeps the review mark %s of the sync, also when the status changes',
    (reviewReason) => {
      const material = new Material({ ...buildMaterial(), reviewReason });

      const changed = material.changeStatus('NO_CONSULTABLE', 'user-1', null);

      expect(material.needsReview).toBe(true);
      expect(changed.reviewReason).toBe(reviewReason);
    },
  );

  it('rejects a review reason that does not exist', () => {
    const props = {
      ...buildMaterial(),
      reviewReason: 'TITULO_RARO' as MaterialReviewReason,
    };

    expect(() => new Material(props)).toThrow(InvalidMaterialReviewReasonError);
    expect(new InvalidMaterialReviewReasonError().code).toBe(
      'INVALID_MATERIAL_REVIEW_REASON',
    );
  });
});
