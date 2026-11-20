import { InvalidMaterialReferenceError } from '../errors/invalid-material-reference.error';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';
import { MaterialReferenceAlreadyResolvedError } from '../errors/material-reference-already-resolved.error';
import { MaterialReferenceNotFoundError } from '../errors/material-reference-not-found.error';
import { MaterialReferenceNotResolvableError } from '../errors/material-reference-not-resolvable.error';
import { RequestMaterialsRequiredError } from '../errors/request-materials-required.error';
import { DeliveryCommentRequiredError } from '../errors/delivery-comment-required.error';
import type { RequestStatus } from '../enums/request-status';
import { addBusinessDays, todayInBogota } from '../value-objects/desired-date';
import type { MaterialReference } from '../value-objects/material-reference';
import { Request } from './request.entity';
import type { NewRequestData } from './request.entity';

const NOW = new Date('2026-11-20T15:00:00.000Z');

// A Monday-to-Saturday date with the 10 business days of RN-03
const desiredDate = (): string => {
  const date = addBusinessDays(todayInBogota(NOW), 12);
  if (date.getUTCDay() === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
};

const newRequest = (
  overrides: Partial<NewRequestData> = {},
): NewRequestData => ({
  id: 'request-1',
  trackingCode: 'SOL-2026-00001',
  requesterId: 'requester-1',
  createdById: 'user-1',
  originChannel: 'WEB',
  deliveryMode: 'PRESENCIAL',
  reason: 'Consulta para un trabajo de investigación',
  desiredDate: desiredDate(),
  materialIds: [],
  references: [],
  ...overrides,
});

const pending = (id = 'reference-1'): MaterialReference => ({
  id,
  kind: 'TEXTO_LIBRE',
  notary: null,
  year: null,
  deedNumber: null,
  description: 'El Heraldo, 15-03-1950',
  status: 'PENDIENTE',
  materialId: null,
});

const resolved = (id = 'reference-2'): MaterialReference => ({
  ...pending(id),
  status: 'RESUELTA',
  materialId: 'material-9',
});

const withReferences = (
  status: RequestStatus,
  references: MaterialReference[],
): Request =>
  new Request({
    id: 'request-1',
    status,
    deliveryMode: 'PRESENCIAL',
    references,
  });

const MATERIAL = {
  id: 'material-9',
  catalogCode: 'TH-PER-0101',
  title: 'El Heraldo, 15-03-1950',
};

describe('Request written references (HU-09.2)', () => {
  describe('RN-04: at least one catalog material or one reference', () => {
    it('rejects a request without materials nor references', () => {
      expect(() => Request.create(newRequest(), NOW)).toThrow(
        RequestMaterialsRequiredError,
      );
    });

    it('creates a request with only a free text reference, PENDIENTE', () => {
      const request = Request.create(
        newRequest({
          references: [
            {
              id: 'reference-1',
              kind: 'TEXTO_LIBRE',
              description: '  El Heraldo, 15-03-1950 ',
            },
          ],
        }),
        NOW,
      );

      expect(request.status).toBe('RECIBIDA');
      expect(request.registration?.materialIds).toEqual([]);
      expect(request.references).toEqual([pending()]);
      expect(request.hasPendingReferences).toBe(true);
    });

    it('keeps only the notary, year and deed number of a notarial protocol', () => {
      const request = Request.create(
        newRequest({
          references: [
            {
              id: 'reference-1',
              kind: 'PROTOCOLO_NOTARIAL',
              notary: 'Notaría Primera de Barranquilla',
              year: 1950,
              deedNumber: '245',
              description: 'ignored',
            },
          ],
        }),
        NOW,
      );

      expect(request.references).toEqual([
        {
          id: 'reference-1',
          kind: 'PROTOCOLO_NOTARIAL',
          notary: 'Notaría Primera de Barranquilla',
          year: 1950,
          deedNumber: '245',
          description: null,
          status: 'PENDIENTE',
          materialId: null,
        },
      ]);
    });

    it('still accepts a request with only catalog materials', () => {
      const request = Request.create(
        newRequest({ materialIds: ['material-1'] }),
        NOW,
      );

      expect(request.references).toEqual([]);
      expect(request.hasPendingReferences).toBe(false);
    });

    it.each([
      [
        'a notarial protocol without notary',
        { kind: 'PROTOCOLO_NOTARIAL', year: 1950, deedNumber: '1' },
      ],
      [
        'a notarial protocol without deed number',
        { kind: 'PROTOCOLO_NOTARIAL', notary: 'N1', year: 1950 },
      ],
      [
        'a notarial protocol of a future year',
        {
          kind: 'PROTOCOLO_NOTARIAL',
          notary: 'N1',
          year: 2027,
          deedNumber: '1',
        },
      ],
      [
        'a notarial protocol before 1500',
        {
          kind: 'PROTOCOLO_NOTARIAL',
          notary: 'N1',
          year: 1499,
          deedNumber: '1',
        },
      ],
      ['a blank free text', { kind: 'TEXTO_LIBRE', description: '   ' }],
      ['an unknown kind', { kind: 'OTRO', description: 'algo' }],
    ])('rejects %s with 400', (_case, reference) => {
      expect(() =>
        Request.assertCanBeCreated(
          {
            desiredDate: desiredDate(),
            materialIds: [],
            references: [reference as never],
          },
          NOW,
        ),
      ).toThrow(InvalidMaterialReferenceError);
    });
  });

  describe('references without material never block the delivery', () => {
    it('refuses EN_BUSQUEDA → DISPONIBLE without a comment (400)', () => {
      const request = withReferences('EN_BUSQUEDA', [pending(), resolved()]);

      expect(() => request.changeStatus('DISPONIBLE', 'user-1')).toThrow(
        DeliveryCommentRequiredError,
      );
      expect(() => request.changeStatus('DISPONIBLE', 'user-1', '   ')).toThrow(
        DeliveryCommentRequiredError,
      );
      expect(request.status).toBe('EN_BUSQUEDA');
    });

    it('allows EN_BUSQUEDA → DISPONIBLE with a comment, and records it', () => {
      const request = withReferences('EN_BUSQUEDA', [pending()]);

      const change = request.changeStatus(
        'DISPONIBLE',
        'user-1',
        'Localizada en físico, se consulta en sala',
      );

      expect(request.status).toBe('DISPONIBLE');
      expect(change.comment).toBe('Localizada en físico, se consulta en sala');
      // The reference keeps no material: it was delivered without the catalog
      expect(request.hasPendingReferences).toBe(true);
    });

    it('asks for no comment coming back from AGENDADA (no-show or cancellation)', () => {
      const noShow = withReferences('AGENDADA', [pending()]);
      noShow.changeStatus('DISPONIBLE', 'user-1');
      expect(noShow.status).toBe('DISPONIBLE');

      const cancelled = withReferences('AGENDADA', [pending()]);
      cancelled.cancelAppointment('user-1');
      expect(cancelled.status).toBe('DISPONIBLE');
    });

    it('schedules the appointment of a request with references without material', () => {
      const request = withReferences('DISPONIBLE', [pending()]);

      request.scheduleAppointment('user-1');

      expect(request.status).toBe('AGENDADA');
    });

    it('lists DISPONIBLE among the transitions whose comment is required, with the same rule', () => {
      expect(
        withReferences('EN_BUSQUEDA', [pending()]).commentRequiredFor,
      ).toEqual(['DISPONIBLE', 'RECHAZADA']);
      expect(
        withReferences('EN_BUSQUEDA', [resolved()]).commentRequiredFor,
      ).toEqual(['RECHAZADA']);
      // Coming back from AGENDADA never asks for it
      expect(
        withReferences('AGENDADA', [pending()]).commentRequiredFor,
      ).toEqual([]);
    });

    it('offers only EN_BUSQUEDA and RECHAZADA from RECIBIDA (rule of #139 not in place)', () => {
      const request = withReferences('RECIBIDA', [pending()]);

      expect(request.allowedTransitions).toEqual(['EN_BUSQUEDA', 'RECHAZADA']);
    });

    it('still checks the state machine first', () => {
      const request = withReferences('RECIBIDA', [pending()]);

      expect(() => request.markAvailable()).toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('allows EN_BUSQUEDA and RECHAZADA with a pending reference', () => {
      const searching = withReferences('RECIBIDA', [pending()]);
      searching.changeStatus('EN_BUSQUEDA', 'user-1');
      expect(searching.status).toBe('EN_BUSQUEDA');

      const rejected = withReferences('EN_BUSQUEDA', [pending()]);
      rejected.changeStatus('RECHAZADA', 'user-1', 'No existe en el archivo');
      expect(rejected.status).toBe('RECHAZADA');
    });

    it('asks for no comment once every reference is resolved', () => {
      const request = withReferences('EN_BUSQUEDA', [resolved()]);

      request.changeStatus('DISPONIBLE', 'user-1');

      expect(request.status).toBe('DISPONIBLE');
    });
  });

  describe('resolveReference', () => {
    it('resolves the reference and records who did it without changing the status', () => {
      const request = withReferences('EN_BUSQUEDA', [pending()]);

      const resolution = request.resolveReference(
        'reference-1',
        MATERIAL,
        'staff-1',
        NOW,
      );

      expect(resolution).toEqual({
        requestId: 'request-1',
        referenceId: 'reference-1',
        materialId: 'material-9',
        resolvedBy: 'staff-1',
        resolvedAt: NOW,
        historyEntry: {
          requestId: 'request-1',
          previousStatus: 'EN_BUSQUEDA',
          newStatus: 'EN_BUSQUEDA',
          changedBy: 'staff-1',
          changedAt: NOW,
          comment:
            'Referencia «El Heraldo, 15-03-1950» asociada al material TH-PER-0101 · El Heraldo, 15-03-1950',
          rejectionReason: null,
          attendedAt: null,
          closedAt: null,
          appointmentOutcome: null,
        },
      });
      expect(request.status).toBe('EN_BUSQUEDA');
      expect(request.references[0]).toMatchObject({
        status: 'RESUELTA',
        materialId: 'material-9',
      });
      expect(request.hasPendingReferences).toBe(false);
    });

    it('throws MaterialReferenceNotFoundError for a reference of another request', () => {
      const request = withReferences('EN_BUSQUEDA', [pending()]);

      expect(() =>
        request.resolveReference('other', MATERIAL, 'staff-1'),
      ).toThrow(MaterialReferenceNotFoundError);
    });

    it('throws MaterialReferenceAlreadyResolvedError for a resolved reference', () => {
      const request = withReferences('EN_BUSQUEDA', [resolved()]);

      expect(() =>
        request.resolveReference('reference-2', MATERIAL, 'staff-1'),
      ).toThrow(MaterialReferenceAlreadyResolvedError);
    });

    it.each<RequestStatus>(['RECHAZADA', 'CERRADA'])(
      'throws MaterialReferenceNotResolvableError when the request is %s',
      (status) => {
        const request = withReferences(status, [pending()]);

        expect(() =>
          request.resolveReference('reference-1', MATERIAL, 'staff-1'),
        ).toThrow(MaterialReferenceNotResolvableError);
        expect(request.hasPendingReferences).toBe(true);
      },
    );
  });
});
