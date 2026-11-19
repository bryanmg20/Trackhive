import { Material } from '../../domain/entities/material.entity';
import { MaterialNotFoundError } from '../../domain/errors/material-not-found.error';
import { MaterialNotInUseError } from '../../domain/errors/material-not-in-use.error';
import type {
  IMaterialLoanRepository,
  MaterialLoanRecord,
} from '../../domain/repositories/material-loan.repository';
import type { IMaterialRepository } from '../../domain/repositories/material.repository';
import { ReturnMaterialUseCase } from './return-material.use-case';

const buildMaterial = (status: 'DISPONIBLE' | 'EN_USO' = 'EN_USO'): Material =>
  new Material({
    id: 'material-1',
    catalogCode: 'TH-DOC-0001',
    title: 'Acta del Cabildo de 1810',
    materialType: 'DOCUMENTO',
    author: null,
    collection: 'Actas del Cabildo',
    publicationDate: null,
    publisher: null,
    location: { depot: 'D-01', shelf: 'E-12', box: 'C-034' },
    status,
    createdAt: new Date('2026-11-08T00:00:00Z'),
    updatedAt: new Date('2026-11-08T00:00:00Z'),
  });

const RETURNED_RECORD: MaterialLoanRecord = {
  id: 'loan-1',
  materialId: 'material-1',
  materialCatalogCode: 'TH-DOC-0001',
  materialTitle: 'Acta del Cabildo de 1810',
  materialStatus: 'DISPONIBLE',
  appointment: {
    id: 'appointment-1',
    date: new Date('2026-11-19T00:00:00Z'),
    requestId: 'request-1',
    trackingCode: 'SOL-2026-00001',
  },
  requester: { id: 'requester-1', name: 'Juan Pérez' },
  handedOverAt: new Date('2026-11-19T14:00:00Z'),
  handedOverBy: { id: 'staff-1', name: 'Ana Gómez' },
  deliveryNotes: null,
  returnedAt: new Date('2026-11-19T16:00:00Z'),
  returnedBy: { id: 'staff-2', name: 'Luis Díaz' },
  returnNotes: 'Devuelto sin novedad',
};

describe('ReturnMaterialUseCase', () => {
  let findById: jest.Mock<Promise<Material | null>, [string]>;
  let returnActiveLoan: jest.Mock;
  let useCase: ReturnMaterialUseCase;

  beforeEach(() => {
    findById = jest.fn<Promise<Material | null>, [string]>(() =>
      Promise.resolve(buildMaterial('EN_USO')),
    );
    returnActiveLoan = jest.fn(() => Promise.resolve(RETURNED_RECORD));

    const materialRepo: IMaterialRepository = {
      search: jest.fn(),
      findById,
      saveStatusChange: jest.fn(),
    };
    const loanRepo: IMaterialLoanRepository = {
      deliverMaterial: jest.fn(),
      returnActiveLoan,
      findMaterialHistory: jest.fn(),
    };
    useCase = new ReturnMaterialUseCase(materialRepo, loanRepo);
  });

  it('closes the open loan and returns the mapped DTO with DISPONIBLE status', async () => {
    const result = await useCase.execute({
      materialId: 'material-1',
      userId: 'staff-2',
      notes: 'Devuelto sin novedad',
    });

    expect(returnActiveLoan).toHaveBeenCalledWith({
      materialId: 'material-1',
      returnedById: 'staff-2',
      returnNotes: 'Devuelto sin novedad',
    });
    expect(result).toEqual({
      id: 'loan-1',
      materialId: 'material-1',
      materialCatalogCode: 'TH-DOC-0001',
      materialTitle: 'Acta del Cabildo de 1810',
      materialStatus: 'DISPONIBLE',
      appointment: {
        id: 'appointment-1',
        date: '2026-11-19',
        requestId: 'request-1',
        trackingCode: 'SOL-2026-00001',
      },
      requester: { id: 'requester-1', name: 'Juan Pérez' },
      handedOverAt: '2026-11-19T14:00:00.000Z',
      handedOverBy: { id: 'staff-1', name: 'Ana Gómez' },
      deliveryNotes: null,
      returnedAt: '2026-11-19T16:00:00.000Z',
      returnedBy: { id: 'staff-2', name: 'Luis Díaz' },
      returnNotes: 'Devuelto sin novedad',
    });
  });

  it('throws MaterialNotFoundError when the material does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ materialId: 'missing', userId: 'staff-2' }),
    ).rejects.toThrow(MaterialNotFoundError);
    expect(returnActiveLoan).not.toHaveBeenCalled();
  });

  it('throws MaterialNotInUseError when the material is not EN_USO', async () => {
    findById.mockResolvedValue(buildMaterial('DISPONIBLE'));

    await expect(
      useCase.execute({ materialId: 'material-1', userId: 'staff-2' }),
    ).rejects.toThrow(MaterialNotInUseError);
    expect(returnActiveLoan).not.toHaveBeenCalled();
  });
});
