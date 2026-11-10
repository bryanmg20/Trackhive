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
    location: { depot: 'D-01', shelf: 'E-12', box: 'C-034' },
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
      reason: 'Humedad en la caja',
      userId: 'user-1',
    });

    expect(saveStatusChange).toHaveBeenCalledTimes(1);
    const saved = saveStatusChange.mock.calls[0][0];
    expect(saved.status).toBe('EN_RESTAURACION');
    expect(saved.statusChangedBy).toBe('user-1');
    expect(saved.statusChangedAt).toBeInstanceOf(Date);
    expect(saved.statusChangeReason).toBe('Humedad en la caja');
  });

  it('accepts a change without a reason', async () => {
    await useCase.execute({
      materialId: 'material-1',
      status: 'EN_USO',
      userId: 'user-1',
    });

    expect(saveStatusChange.mock.calls[0][0].statusChangeReason).toBeNull();
  });

  it('returns the material with its new status and its location', async () => {
    const result = await useCase.execute({
      materialId: 'material-1',
      status: 'NO_CONSULTABLE',
      userId: 'user-1',
    });

    expect(result.status).toBe('NO_CONSULTABLE');
    expect(result.location).toEqual({
      depot: 'D-01',
      shelf: 'E-12',
      box: 'C-034',
    });
  });

  it('throws MaterialNotFoundError and saves nothing when it does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        materialId: 'missing',
        status: 'EN_USO',
        userId: 'user-1',
      }),
    ).rejects.toThrow(MaterialNotFoundError);
    expect(saveStatusChange).not.toHaveBeenCalled();
  });
});
