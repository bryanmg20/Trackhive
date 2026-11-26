import { Material } from '../../domain/entities/material.entity';
import { MaterialNotFoundError } from '../../domain/errors/material-not-found.error';
import type { IMaterialRepository } from '../../domain/repositories/material.repository';
import { ChangeMaterialStatusUseCase } from './change-material-status.use-case';

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

describe('ChangeMaterialStatusUseCase', () => {
  let findById: jest.Mock<Promise<Material | null>, [string]>;
  let saveStatusChange: jest.Mock<Promise<void>, [Material]>;
  let useCase: ChangeMaterialStatusUseCase;

  beforeEach(() => {
    findById = jest.fn<Promise<Material | null>, [string]>(() =>
      Promise.resolve(buildMaterial()),
    );
    saveStatusChange = jest.fn<Promise<void>, [Material]>(() =>
      Promise.resolve(),
    );
    const repo: IMaterialRepository = {
      search: jest.fn(),
      findById,
      saveStatusChange,
    };
    useCase = new ChangeMaterialStatusUseCase(repo);
  });

  it('saves the new status with who changed it and the reason', async () => {
    await useCase.execute({
      materialId: 'material-1',
      status: 'EN_RESTAURACION',
      reason: 'Humedad en las hojas',
      userId: 'user-1',
      viewerRole: 'PERSONAL',
    });

    expect(saveStatusChange).toHaveBeenCalledTimes(1);
    const saved = saveStatusChange.mock.calls[0][0];
    expect(saved.status).toBe('EN_RESTAURACION');
    expect(saved.statusChangedBy).toBe('user-1');
    expect(saved.statusChangedAt).toBeInstanceOf(Date);
    expect(saved.statusChangeReason).toBe('Humedad en las hojas');
  });

  it('accepts a change without a reason', async () => {
    await useCase.execute({
      materialId: 'material-1',
      status: 'NO_CONSULTABLE',
      userId: 'user-1',
      viewerRole: 'PERSONAL',
    });

    expect(saveStatusChange.mock.calls[0][0].statusChangeReason).toBeNull();
  });

  it('returns the material with its new status and digital copy info without location or path', async () => {
    findById.mockResolvedValue(
      new Material({
        ...buildMaterial(),
        source: 'EVERYTHING',
        digitalPath:
          'Z:\\Aha\\Fondo - Notarías\\1ra-1931 - Esc 0001-0109 - Ene',
        reviewReason: 'NO_PATTERN',
      }),
    );

    const result = await useCase.execute({
      materialId: 'material-1',
      status: 'NO_CONSULTABLE',
      userId: 'user-1',
      viewerRole: 'PERSONAL',
    });

    expect(result).toMatchObject({
      status: 'NO_CONSULTABLE',
      hasDigitalCopy: true,
      digitalFolderName: '1ra-1931 - Esc 0001-0109 - Ene',
      needsReview: true,
      reviewReason: 'NO_PATTERN',
    });
    expect(result).not.toHaveProperty('location');
    expect(result).not.toHaveProperty('digitalPath');
  });

  it('throws MaterialNotFoundError and saves nothing when it does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        materialId: 'missing',
        status: 'EN_RESTAURACION',
        userId: 'user-1',
        viewerRole: 'PERSONAL',
      }),
    ).rejects.toThrow(MaterialNotFoundError);
    expect(saveStatusChange).not.toHaveBeenCalled();
  });
});
