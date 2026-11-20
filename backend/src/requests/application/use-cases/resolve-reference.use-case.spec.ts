import { Material } from '../../../materials/domain/entities/material.entity';
import type { IMaterialRepository } from '../../../materials/domain/repositories/material.repository';
import { Request } from '../../domain/entities/request.entity';
import { MaterialReferenceAlreadyResolvedError } from '../../domain/errors/material-reference-already-resolved.error';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type {
  ReferenceResolution,
  SavedReferenceResolution,
} from '../../domain/value-objects/reference-resolution';
import { ResolveReferenceUseCase } from './resolve-reference.use-case';

const NOW = new Date('2026-11-20T15:00:00.000Z');

const MATERIAL = new Material({
  id: 'material-9',
  catalogCode: 'TH-PER-0101',
  title: 'El Heraldo, 15-03-1950',
  materialType: 'PERIODICO',
  author: null,
  collection: 'Prensa',
  publicationDate: null,
  publisher: null,
  location: null,
  status: 'DISPONIBLE',
  createdAt: NOW,
  updatedAt: NOW,
});

const buildRequest = (status: 'EN_BUSQUEDA' | 'RECHAZADA' = 'EN_BUSQUEDA') =>
  new Request({
    id: 'request-1',
    status,
    deliveryMode: 'PRESENCIAL',
    references: [
      {
        id: 'reference-1',
        kind: 'TEXTO_LIBRE',
        notary: null,
        year: null,
        deedNumber: null,
        description: 'El Heraldo, 15-03-1950',
        status: 'PENDIENTE',
        materialId: null,
      },
    ],
  });

const build = (
  request: Request | null = buildRequest(),
  material: Material | null = MATERIAL,
) => {
  const saveReferenceResolution = jest.fn<
    Promise<SavedReferenceResolution>,
    [ReferenceResolution]
  >((resolution) =>
    Promise.resolve({
      reference: {
        id: resolution.referenceId,
        kind: 'TEXTO_LIBRE',
        notary: null,
        year: null,
        deedNumber: null,
        description: 'El Heraldo, 15-03-1950',
        status: 'RESUELTA',
        materialId: resolution.materialId,
      },
      resolvedAt: NOW,
      historyEntry: {
        previousStatus: resolution.historyEntry.previousStatus,
        newStatus: resolution.historyEntry.newStatus,
        changedAt: NOW,
        comment: resolution.historyEntry.comment,
        changedBy: {
          id: 'staff-1',
          firstName: 'Ana',
          middleName: null,
          lastName: 'Gómez',
          secondLastName: null,
        },
      },
    }),
  );
  const repository: IRequestRepository = {
    save: jest.fn(),
    findById: jest.fn(() => Promise.resolve(request)),
    findAppointmentById: jest.fn(),
    saveStatusChange: jest.fn(),
    saveAppointment: jest.fn(),
    rescheduleAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
    saveReferenceResolution,
  };
  const findMaterial = jest.fn<Promise<Material | null>, [string]>(() =>
    Promise.resolve(material),
  );
  const materials: IMaterialRepository = {
    search: jest.fn(),
    findById: findMaterial,
    saveStatusChange: jest.fn(),
  };
  return {
    useCase: new ResolveReferenceUseCase(repository, materials),
    saveReferenceResolution,
  };
};

const INPUT = {
  requestId: 'request-1',
  referenceId: 'reference-1',
  materialId: 'material-9',
  userId: 'staff-1',
};

describe('ResolveReferenceUseCase (HU-09.2)', () => {
  it('saves the resolution with the material and who did it, and answers with the history row', async () => {
    const { useCase, saveReferenceResolution } = build();

    const result = await useCase.execute(INPUT);

    const [resolution] = saveReferenceResolution.mock.calls[0];
    expect(resolution).toMatchObject({
      requestId: 'request-1',
      referenceId: 'reference-1',
      materialId: 'material-9',
      resolvedBy: 'staff-1',
      historyEntry: {
        previousStatus: 'EN_BUSQUEDA',
        newStatus: 'EN_BUSQUEDA',
        changedBy: 'staff-1',
      },
    });
    expect(result).toEqual({
      requestId: 'request-1',
      reference: {
        id: 'reference-1',
        kind: 'TEXTO_LIBRE',
        label: 'El Heraldo, 15-03-1950',
        notary: null,
        year: null,
        deedNumber: null,
        description: 'El Heraldo, 15-03-1950',
        status: 'RESUELTA',
        material: {
          id: 'material-9',
          catalogCode: 'TH-PER-0101',
          title: 'El Heraldo, 15-03-1950',
        },
        resolvedAt: NOW.toISOString(),
        resolvedBy: { id: 'staff-1', name: 'Ana Gómez' },
      },
      historyEntry: {
        previousStatus: 'EN_BUSQUEDA',
        newStatus: 'EN_BUSQUEDA',
        changedAt: NOW.toISOString(),
        changedBy: { id: 'staff-1', name: 'Ana Gómez' },
        comment:
          'Referencia «El Heraldo, 15-03-1950» asociada al material TH-PER-0101 · El Heraldo, 15-03-1950',
      },
    });
  });

  it('throws RequestNotFoundError when the request does not exist', async () => {
    const { useCase, saveReferenceResolution } = build(null);

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(
      RequestNotFoundError,
    );
    expect(saveReferenceResolution).not.toHaveBeenCalled();
  });

  it('throws RequestMaterialNotFoundError when the material is not in the catalog', async () => {
    const { useCase, saveReferenceResolution } = build(buildRequest(), null);

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(
      RequestMaterialNotFoundError,
    );
    expect(saveReferenceResolution).not.toHaveBeenCalled();
  });

  it('saves nothing when the entity refuses (reference already resolved)', async () => {
    const request = buildRequest();
    request.resolveReference('reference-1', MATERIAL, 'other-staff');
    const { useCase, saveReferenceResolution } = build(request);

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(
      MaterialReferenceAlreadyResolvedError,
    );
    expect(saveReferenceResolution).not.toHaveBeenCalled();
  });
});
