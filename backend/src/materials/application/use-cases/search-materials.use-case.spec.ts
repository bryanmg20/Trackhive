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
    location: { depot: 'D-03', shelf: 'E-01', box: 'C-100' },
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
    useCase = new SearchMaterialsUseCase({ search });
  });

  it('hides the physical location from the PUBLICO role', async () => {
    const result = await useCase.execute({}, 'PUBLICO');

    expect(result.items[0]).not.toHaveProperty('location');
  });

  it.each(['PERSONAL', 'ADMIN'] as const)(
    'shows the physical location to %s',
    async (role) => {
      const result = await useCase.execute({}, role);

      expect(result.items[0].location).toEqual({
        depot: 'D-03',
        shelf: 'E-01',
        box: 'C-100',
      });
    },
  );

  it('uses page 1, 20 per page and title ascending by default', async () => {
    const result = await useCase.execute({}, 'PUBLICO');

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
    const result = await useCase.execute(
      {
        q: 'correo',
        type: 'PERIODICO',
        collection: 'Prensa regional',
        status: 'DISPONIBLE',
        sort: 'author',
        order: 'desc',
        page: 2,
        limit: 5,
      },
      'PERSONAL',
    );

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
    const result = await useCase.execute({}, 'PUBLICO');

    expect(result.items[0].publicationDate).toBe('1915-03-21');
  });
});
