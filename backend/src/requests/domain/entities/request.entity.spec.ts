import { DeliveryMode } from '../delivery-mode';
import { InvalidRequestStatusError } from '../errors/invalid-request-status.error';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';
import { RejectionReasonRequiredError } from '../errors/rejection-reason-required.error';
import {
  CHANGEABLE_STATUSES,
  ChangeableStatus,
  REQUEST_STATUSES,
  RequestStatus,
} from '../request-status';
import { Request } from './request.entity';

const buildRequest = (
  status: RequestStatus,
  deliveryMode: DeliveryMode = 'PRESENCIAL',
): Request => new Request({ id: '1', status, deliveryMode });

// One action per reachable status. No method leads to RECIBIDA: it is only the initial status.
const ACTIONS = {
  EN_BUSQUEDA: (request: Request) => request.startSearch(),
  DISPONIBLE: (request: Request) => request.markAvailable(),
  AGENDADA: (request: Request) => request.schedule(),
  ATENDIDA: (request: Request) => request.attend(),
  CERRADA: (request: Request) => request.close(),
  RECHAZADA: (request: Request) => request.reject('Material no localizado'),
};

type TargetStatus = keyof typeof ACTIONS;

const TARGET_STATUSES = Object.keys(ACTIONS) as TargetStatus[];

// Written by hand on purpose: importing the production table would compare it with itself.
const VALID_TRANSITIONS: [RequestStatus, TargetStatus, DeliveryMode][] = [
  ['RECIBIDA', 'EN_BUSQUEDA', 'PRESENCIAL'],
  ['RECIBIDA', 'RECHAZADA', 'PRESENCIAL'],
  ['EN_BUSQUEDA', 'DISPONIBLE', 'PRESENCIAL'],
  ['EN_BUSQUEDA', 'RECHAZADA', 'PRESENCIAL'],
  ['DISPONIBLE', 'AGENDADA', 'PRESENCIAL'],
  ['DISPONIBLE', 'ATENDIDA', 'DIGITAL'],
  ['DISPONIBLE', 'CERRADA', 'PRESENCIAL'],
  ['AGENDADA', 'ATENDIDA', 'PRESENCIAL'],
  ['AGENDADA', 'DISPONIBLE', 'PRESENCIAL'],
  ['ATENDIDA', 'CERRADA', 'PRESENCIAL'],
];

const INVALID_TRANSITIONS = REQUEST_STATUSES.flatMap((from) =>
  TARGET_STATUSES.filter(
    (to) => !VALID_TRANSITIONS.some(([f, t]) => f === from && t === to),
  ).map((to): [RequestStatus, TargetStatus] => [from, to]),
);

describe('Request', () => {
  it('defines exactly the seven statuses', () => {
    expect(REQUEST_STATUSES).toEqual([
      'RECIBIDA',
      'EN_BUSQUEDA',
      'DISPONIBLE',
      'AGENDADA',
      'ATENDIDA',
      'CERRADA',
      'RECHAZADA',
    ]);
  });

  it('throws InvalidRequestStatusError when the status is unknown', () => {
    expect(() => buildRequest('ROOT' as RequestStatus)).toThrow(
      InvalidRequestStatusError,
    );
  });

  it('does not allow assigning the status from outside', () => {
    const request = buildRequest('RECIBIDA');

    expect(() => {
      // @ts-expect-error status only has a getter
      request.status = 'CERRADA';
    }).toThrow(TypeError);
    expect(request.status).toBe('RECIBIDA');
  });

  describe('transitions', () => {
    it('covers every combination of status and action', () => {
      expect(VALID_TRANSITIONS).toHaveLength(10);
      expect(INVALID_TRANSITIONS).toHaveLength(32);
    });

    it.each(VALID_TRANSITIONS)(
      'allows %s -> %s (%s)',
      (from, to, deliveryMode) => {
        const request = buildRequest(from, deliveryMode);

        ACTIONS[to](request);

        expect(request.status).toBe(to);
      },
    );

    it.each(INVALID_TRANSITIONS)(
      'rejects %s -> %s and keeps the status',
      (from, to) => {
        for (const deliveryMode of ['PRESENCIAL', 'DIGITAL'] as const) {
          const request = buildRequest(from, deliveryMode);

          expect(() => ACTIONS[to](request)).toThrow(
            InvalidStatusTransitionError,
          );
          expect(request.status).toBe(from);
        }
      },
    );

    it('gives a clear error when RECIBIDA tries to go to ATENDIDA', () => {
      const request = buildRequest('RECIBIDA', 'DIGITAL');

      expect(() => request.attend()).toThrow(
        'No se puede pasar una solicitud de Recibida a Atendida',
      );
    });

    it('can be scheduled again after the appointment is cancelled', () => {
      const request = buildRequest('AGENDADA');

      request.markAvailable();
      request.schedule();

      expect(request.status).toBe('AGENDADA');
    });
  });

  describe('reject', () => {
    it.each(['', '   '])('requires a reason (%j)', (reason) => {
      const request = buildRequest('RECIBIDA');

      expect(() => request.reject(reason)).toThrow(
        RejectionReasonRequiredError,
      );
      expect(request.status).toBe('RECIBIDA');
      expect(request.rejectionReason).toBeNull();
    });

    it('stores the trimmed reason', () => {
      const request = buildRequest('EN_BUSQUEDA');

      request.reject('  Material no localizado  ');

      expect(request.status).toBe('RECHAZADA');
      expect(request.rejectionReason).toBe('Material no localizado');
    });

    it('reports the invalid transition first when the reason is also missing', () => {
      expect(() => buildRequest('CERRADA').reject('')).toThrow(
        InvalidStatusTransitionError,
      );
    });
  });

  describe('delivery mode', () => {
    it('does not let a presential request be attended from DISPONIBLE', () => {
      const request = buildRequest('DISPONIBLE', 'PRESENCIAL');

      expect(() => request.attend()).toThrow(InvalidStatusTransitionError);
      expect(request.status).toBe('DISPONIBLE');
    });

    it('does not let a digital request be scheduled', () => {
      const request = buildRequest('DISPONIBLE', 'DIGITAL');

      expect(() => request.schedule()).toThrow(InvalidStatusTransitionError);
      expect(request.status).toBe('DISPONIBLE');
    });
  });

  describe('changeStatus (HU-15)', () => {
    const NOW = new Date('2026-11-10T15:30:00.000Z');

    // The changeable statuses are all the targets except RECHAZADA (needs a reason)
    const CHANGEABLE_VALID = VALID_TRANSITIONS.filter(
      (
        transition,
      ): transition is [RequestStatus, ChangeableStatus, DeliveryMode] =>
        transition[1] !== 'RECHAZADA',
    );
    const CHANGEABLE_INVALID = INVALID_TRANSITIONS.filter(
      (transition): transition is [RequestStatus, ChangeableStatus] =>
        transition[1] !== 'RECHAZADA',
    );

    it('offers every target status except RECIBIDA and RECHAZADA', () => {
      expect(CHANGEABLE_STATUSES).toEqual([
        'EN_BUSQUEDA',
        'DISPONIBLE',
        'AGENDADA',
        'ATENDIDA',
        'CERRADA',
      ]);
    });

    it.each(CHANGEABLE_VALID)(
      'allows %s -> %s (%s) and records who, when and the comment',
      (from, to, deliveryMode) => {
        const request = buildRequest(from, deliveryMode);

        const change = request.changeStatus(to, 'staff-1', 'Revisado', NOW);

        expect(request.status).toBe(to);
        expect(change).toEqual({
          requestId: '1',
          previousStatus: from,
          newStatus: to,
          changedBy: 'staff-1',
          changedAt: NOW,
          comment: 'Revisado',
        });
      },
    );

    it.each(CHANGEABLE_INVALID)(
      'rejects %s -> %s with 409 and keeps the status',
      (from, to) => {
        for (const deliveryMode of ['PRESENCIAL', 'DIGITAL'] as const) {
          const request = buildRequest(from, deliveryMode);

          expect(() => request.changeStatus(to, 'staff-1')).toThrow(
            InvalidStatusTransitionError,
          );
          expect(request.status).toBe(from);
        }
      },
    );

    it('moves a scheduled request to ATENDIDA when the requester attended', () => {
      const request = buildRequest('AGENDADA');

      request.changeStatus('ATENDIDA', 'staff-1');

      expect(request.status).toBe('ATENDIDA');
      expect(request.allowedTransitions).toEqual(['CERRADA']);
    });

    it('moves a scheduled request back to DISPONIBLE when the requester did not attend', () => {
      const request = buildRequest('AGENDADA');

      request.changeStatus('DISPONIBLE', 'staff-1', 'No asistió a la cita');

      expect(request.status).toBe('DISPONIBLE');
      // It can be scheduled again
      expect(request.allowedTransitions).toContain('AGENDADA');
    });

    it('gives a clear error when RECIBIDA tries to go to ATENDIDA', () => {
      expect(() =>
        buildRequest('RECIBIDA', 'DIGITAL').changeStatus('ATENDIDA', 'staff-1'),
      ).toThrow('No se puede pasar una solicitud de Recibida a Atendida');
    });

    it.each([undefined, null, '', '   '])(
      'stores no comment when it is %j',
      (comment) => {
        const change = buildRequest('RECIBIDA').changeStatus(
          'EN_BUSQUEDA',
          'staff-1',
          comment,
        );

        expect(change.comment).toBeNull();
      },
    );

    it('trims the comment', () => {
      const change = buildRequest('RECIBIDA').changeStatus(
        'EN_BUSQUEDA',
        'staff-1',
        '  Se asignó a Ana  ',
      );

      expect(change.comment).toBe('Se asignó a Ana');
    });

    it('uses the current date and time when none is given', () => {
      const before = Date.now();

      const change = buildRequest('RECIBIDA').changeStatus(
        'EN_BUSQUEDA',
        'staff-1',
      );

      expect(change.changedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(change.changedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('returns a record that cannot be modified', () => {
      const change = buildRequest('RECIBIDA').changeStatus(
        'EN_BUSQUEDA',
        'staff-1',
      );

      expect(Object.isFrozen(change)).toBe(true);
    });

    it.each(['RECHAZADA', 'RECIBIDA', 'ROTA'])(
      'does not accept %s as a target and keeps the status',
      (target) => {
        const request = buildRequest('RECIBIDA');

        expect(() =>
          request.changeStatus(target as ChangeableStatus, 'staff-1'),
        ).toThrow(InvalidRequestStatusError);
        expect(request.status).toBe('RECIBIDA');
      },
    );
  });

  describe('allowedTransitions', () => {
    it.each<[RequestStatus, DeliveryMode, RequestStatus[]]>([
      ['RECIBIDA', 'PRESENCIAL', ['EN_BUSQUEDA', 'RECHAZADA']],
      ['EN_BUSQUEDA', 'DIGITAL', ['DISPONIBLE', 'RECHAZADA']],
      ['DISPONIBLE', 'PRESENCIAL', ['AGENDADA', 'CERRADA']],
      ['DISPONIBLE', 'DIGITAL', ['ATENDIDA', 'CERRADA']],
      ['AGENDADA', 'PRESENCIAL', ['DISPONIBLE', 'ATENDIDA']],
      ['ATENDIDA', 'DIGITAL', ['CERRADA']],
      ['CERRADA', 'PRESENCIAL', []],
      ['RECHAZADA', 'DIGITAL', []],
    ])(
      'lists the next statuses of %s (%s)',
      (status, deliveryMode, expected) => {
        expect(buildRequest(status, deliveryMode).allowedTransitions).toEqual(
          expected,
        );
      },
    );
  });
});
