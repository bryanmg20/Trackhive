import { Material } from '../../domain/entities/material.entity';
import type {
  IMaterialRepository,
  MaterialSearchCriteria,
} from '../../domain/repositories/material.repository';
import { SearchMaterialsUseCase } from './search-materials.use-case';

const buildMaterial = (): Material =>
  new Material({
    id: 'material-1',
    catalogCode: 'TH-PER-0001',
    title: 'El Correo del Valle, edición 1',
    materialType: 'PERIODICO',
    author: null,
    collection: 'Prensa regional',
    publicationDate: new Date('1915-03-21'),
    publisher: 'Imprenta del Valle',
    status: 'DISPONIBLE',
    createdAt: new Date('2026-11-08T00:00:00Z'),
    updatedAt: new Date('2026-11-08T00:00:00Z'),
  });

describe('SearchMaterialsUseCase', () => {
  let search: jest.Mock<
    ReturnType<IMaterialRepository['search']>,
    [MaterialSearchCriteria]
  >;
  let useCase: SearchMaterialsUseCase;

  beforeEach(() => {
    search = jest.fn<
      ReturnType<IMaterialRepository['search']>,
      [MaterialSearchCriteria]
    >(() => Promise.resolve({ items: [buildMaterial()], total: 31 }));
    useCase = new SearchMaterialsUseCase({
      search,
      findById: jest.fn(),
      saveStatusChange: jest.fn(),
    });
  });

  it('never sends a physical location, the digital path nor the source (HU-134, #165)', async () => {
    search.mockResolvedValue({
      items: [
        new Material({
          ...buildMaterial(),
          source: 'EVERYTHING',
          digitalPath:
            'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Notarías\\Notarías\\1ra\\1931\\1ra-1931 - Esc 0001-0109 - Ene',
          reviewReason: 'NO_PATTERN',
        }),
      ],
      total: 1,
    });

    const result = await useCase.execute({ viewerRole: 'PUBLICO' });

    expect(result.items[0]).not.toHaveProperty('location');
    expect(result.items[0]).not.toHaveProperty('digitalPath');
    expect(result.items[0]).not.toHaveProperty('source');
    expect(result.items[0]).toMatchObject({ hasDigitalCopy: true });
    expect(result.items[0]).not.toHaveProperty('digitalFolderName');
    expect(result.items[0]).not.toHaveProperty('needsReview');
    expect(result.items[0]).not.toHaveProperty('reviewReason');
  });

  it.each(['PERSONAL', 'ADMIN'] as const)(
    'sends %s only the leaf folder name and review info, never the full path (HU-140)',
    async (viewerRole) => {
      search.mockResolvedValue({
        items: [
          new Material({
            ...buildMaterial(),
            id: 'mat-copy',
            source: 'EVERYTHING',
            digitalPath:
              'Z:\\Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera\\1931\\1ra-1931 - Esc 0001-0109 - Ene',
            reviewReason: null,
          }),
          new Material({
            ...buildMaterial(),
            id: 'mat-review',
            source: 'EVERYTHING',
            digitalPath: 'Z:\\Aha\\Fondo - Periódicos\\1925-03 Marzo',
            reviewReason: 'DUPLICATE_CODE',
          }),
          new Material({
            ...buildMaterial(),
            id: 'mat-none',
            source: 'EVERYTHING',
            digitalPath: null,
            reviewReason: null,
          }),
        ],
        total: 3,
      });

      const result = await useCase.execute({ viewerRole });

      expect(result.items[0]).toMatchObject({
        hasDigitalCopy: true,
        digitalFolderName: '1ra-1931 - Esc 0001-0109 - Ene',
        needsReview: false,
        reviewReason: null,
      });
      expect(result.items[0]).not.toHaveProperty('digitalPath');
      expect(result.items[1]).toMatchObject({
        hasDigitalCopy: true,
        digitalFolderName: '1925-03 Marzo',
        needsReview: true,
        reviewReason: 'DUPLICATE_CODE',
      });
      expect(result.items[2]).toMatchObject({
        hasDigitalCopy: false,
        digitalFolderName: null,
        needsReview: false,
        reviewReason: null,
      });
    },
  );

  it('uses page 1, 20 per page and title ascending by default', async () => {
    const result = await useCase.execute({ viewerRole: 'PUBLICO' });

    expect(search).toHaveBeenCalledWith({
      q: undefined,
      type: undefined,
      collection: undefined,
      status: undefined,
      sort: 'title',
      order: 'asc',
      page: 1,
      limit: 20,
    });
    expect(result).toMatchObject({ page: 1, limit: 20, total: 31 });
  });

  it('passes the filters, sort and page to the repository', async () => {
    const result = await useCase.execute({
      q: 'correo',
      type: 'PERIODICO',
      collection: 'Prensa regional',
      status: 'DISPONIBLE',
      sort: 'author',
      order: 'desc',
      page: 2,
      limit: 5,
      viewerRole: 'PERSONAL',
    });

    expect(search).toHaveBeenCalledWith({
      q: 'correo',
      type: 'PERIODICO',
      collection: 'Prensa regional',
      status: 'DISPONIBLE',
      sort: 'author',
      order: 'desc',
      page: 2,
      limit: 5,
    });
    expect(result).toMatchObject({ page: 2, limit: 5, total: 31 });
  });

  it('sends the publication date without time', async () => {
    const result = await useCase.execute({ viewerRole: 'PUBLICO' });

    expect(result.items[0].publicationDate).toBe('1915-03-21');
  });
});
