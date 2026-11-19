import { DEFAULT_PAGE_LIMIT } from '../../../common/pagination';
import { Material } from '../../domain/entities/material.entity';
import { MaterialNotFoundError } from '../../domain/errors/material-not-found.error';
import type {
  IMaterialLoanRepository,
  MaterialLoanRecord,
} from '../../domain/repositories/material-loan.repository';
import type { IMaterialRepository } from '../../domain/repositories/material.repository';
import { GetMaterialHistoryUseCase } from './get-material-history.use-case';

const MATERIAL = new Material({
  id: 'material-1',
  catalogCode: 'TH-DOC-0001',
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

const LOAN_RECORD: MaterialLoanRecord = {
  id: 'loan-2',
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
  returnNotes: null,
};

describe('GetMaterialHistoryUseCase', () => {
  let findById: jest.Mock<Promise<Material | null>, [string]>;
  let findMaterialHistory: jest.Mock;
  let useCase: GetMaterialHistoryUseCase;

  beforeEach(() => {
    findById = jest.fn<Promise<Material | null>, [string]>(() =>
      Promise.resolve(MATERIAL),
    );
    findMaterialHistory = jest.fn(() =>
      Promise.resolve({
        items: [LOAN_RECORD],
        lastLoan: LOAN_RECORD,
        total: 1,
      }),
    );
    const materialRepo: IMaterialRepository = {
      search: jest.fn(),
      findById,
      saveStatusChange: jest.fn(),
    };
    const loanRepo: IMaterialLoanRepository = {
      deliverMaterial: jest.fn(),
      returnActiveLoan: jest.fn(),
      findMaterialHistory,
    };
    useCase = new GetMaterialHistoryUseCase(materialRepo, loanRepo);
  });

  it('returns the material summary, last loan and paginated items with defaults', async () => {
    const result = await useCase.execute({ materialId: 'material-1' });

    expect(findMaterialHistory).toHaveBeenCalledWith({
      materialId: 'material-1',
      page: 1,
      limit: DEFAULT_PAGE_LIMIT,
    });
    expect(result.material).toEqual({
      id: 'material-1',
      catalogCode: 'TH-DOC-0001',
      title: 'Acta del Cabildo de 1810',
      status: 'DISPONIBLE',
    });
    expect(result.lastLoan?.requester.name).toBe('Juan Pérez');
    expect(result.lastLoan?.returnedAt).toBe('2026-11-19T16:00:00.000Z');
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('returns lastLoan null when the material has never been handed over', async () => {
    findMaterialHistory.mockResolvedValue({
      items: [],
      lastLoan: null,
      total: 0,
    });

    const result = await useCase.execute({
      materialId: 'material-1',
      page: 2,
      limit: 5,
    });

    expect(result.lastLoan).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
  });

  it('throws MaterialNotFoundError when the material does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute({ materialId: 'missing' })).rejects.toThrow(
      MaterialNotFoundError,
    );
    expect(findMaterialHistory).not.toHaveBeenCalled();
  });
});
