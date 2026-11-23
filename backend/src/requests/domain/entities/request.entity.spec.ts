import { DeliveryMode } from '../enums/delivery-mode';
import { InvalidRequestStatusError } from '../errors/invalid-request-status.error';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';
import { RejectionReasonRequiredError } from '../errors/rejection-reason-required.error';
import {
  CHANGEABLE_STATUSES,
  ChangeableStatus,
  REQUEST_STATUSES,
  RequestStatus,
} from '../enums/request-status';
import { summarizeDigitalCopies } from '../policies/digital-copy';
import type { MaterialReference } from '../value-objects/material-reference';
import { Request } from './request.entity';
import type { RequestProps } from './request.entity';

// Without what the repository reads of the digital copies, as before HU-139:
// RECIBIDA always goes through EN_BUSQUEDA. The direct step has its own block
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

    // Since HU-16 every target status of ACTIONS can be chosen, RECHAZADA
    // included, except AGENDADA: only by scheduling an appointment (HU-18)
    const isChangeableTarget = (status: RequestStatus) => status !== 'AGENDADA';
    const CHANGEABLE_VALID = VALID_TRANSITIONS.filter(
      (
        transition,
      ): transition is [RequestStatus, ChangeableStatus, DeliveryMode] =>
        isChangeableTarget(transition[1]),
    );
    const CHANGEABLE_INVALID = INVALID_TRANSITIONS.filter(
      (transition): transition is [RequestStatus, ChangeableStatus] =>
        isChangeableTarget(transition[1]),
    );

    it('offers every target status except RECIBIDA (initial) and AGENDADA', () => {
      expect(CHANGEABLE_STATUSES).toEqual([
        'EN_BUSQUEDA',
        'DISPONIBLE',
        'ATENDIDA',
        'CERRADA',
        'RECHAZADA',
      ]);
      expect([...CHANGEABLE_STATUSES].sort()).toEqual(
        TARGET_STATUSES.filter(isChangeableTarget).sort(),
      );
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
          // When rejecting, the comment is the reason (HU-16)
          rejectionReason: to === 'RECHAZADA' ? 'Revisado' : null,
          attendedAt: to === 'ATENDIDA' ? NOW : null,
          closedAt: to === 'CERRADA' ? NOW : null,
          // Leaving AGENDADA settles the appointment (HU-20)
          appointmentOutcome:
            from === 'AGENDADA'
              ? to === 'ATENDIDA'
                ? 'CUMPLIDA'
                : 'NO_ASISTIO'
              : null,
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

    it.each(['RECIBIDA', 'ROTA'])(
      'does not accept %s as a target and keeps the status',
      (target) => {
        const request = buildRequest('RECIBIDA');

        expect(() =>
          request.changeStatus(target as ChangeableStatus, 'staff-1'),
        ).toThrow(InvalidRequestStatusError);
        expect(request.status).toBe('RECIBIDA');
      },
    );

    it('does not reach AGENDADA: it needs an appointment (HU-18)', () => {
      const request = buildRequest('DISPONIBLE', 'PRESENCIAL');

      expect(() =>
        request.changeStatus('AGENDADA' as ChangeableStatus, 'staff-1'),
      ).toThrow(InvalidRequestStatusError);
      expect(request.status).toBe('DISPONIBLE');
    });
  });

  describe('scheduleAppointment (HU-18)', () => {
    const NOW = new Date('2026-11-10T15:30:00.000Z');

    it('moves a presential DISPONIBLE request to AGENDADA and records who and when', () => {
      const request = buildRequest('DISPONIBLE', 'PRESENCIAL');

      const change = request.scheduleAppointment('staff-1', NOW);

      expect(request.status).toBe('AGENDADA');
      expect(change).toEqual({
        requestId: '1',
        previousStatus: 'DISPONIBLE',
        newStatus: 'AGENDADA',
        changedBy: 'staff-1',
        changedAt: NOW,
        comment: null,
        rejectionReason: null,
        attendedAt: null,
        closedAt: null,
        appointmentOutcome: null,
      });
      expect(Object.isFrozen(change)).toBe(true);
    });

    it.each(REQUEST_STATUSES.filter((status) => status !== 'DISPONIBLE'))(
      'does not schedule a request in %s and keeps the status',
      (status) => {
        const request = buildRequest(status, 'PRESENCIAL');

        expect(() => request.scheduleAppointment('staff-1')).toThrow(
          InvalidStatusTransitionError,
        );
        expect(request.status).toBe(status);
      },
    );

    it('does not schedule a request with a digital delivery', () => {
      const request = buildRequest('DISPONIBLE', 'DIGITAL');

      expect(() => request.scheduleAppointment('staff-1')).toThrow(
        InvalidStatusTransitionError,
      );
      expect(request.status).toBe('DISPONIBLE');
    });
  });

  describe('rescheduleAppointment and cancelAppointment (HU-21)', () => {
    const NOW = new Date('2026-11-18T15:30:00.000Z');

    it('reschedules an AGENDADA request, keeping it AGENDADA and recording the history change', () => {
      const request = buildRequest('AGENDADA', 'PRESENCIAL');

      const change = request.rescheduleAppointment(
        'staff-1',
        '  Cita reprogramada del 2026-11-20 al 2026-11-24  ',
        NOW,
      );

      expect(request.status).toBe('AGENDADA');
      expect(change).toEqual({
        requestId: '1',
        previousStatus: 'AGENDADA',
        newStatus: 'AGENDADA',
        changedBy: 'staff-1',
        changedAt: NOW,
        comment: 'Cita reprogramada del 2026-11-20 al 2026-11-24',
        rejectionReason: null,
        attendedAt: null,
        closedAt: null,
        appointmentOutcome: null,
      });
      expect(Object.isFrozen(change)).toBe(true);
    });

    it.each(REQUEST_STATUSES.filter((status) => status !== 'AGENDADA'))(
      'rejects rescheduling a request in %s',
      (status) => {
        const request = buildRequest(status, 'PRESENCIAL');

        expect(() =>
          request.rescheduleAppointment('staff-1', 'Cambio'),
        ).toThrow(InvalidStatusTransitionError);
        expect(request.status).toBe(status);
      },
    );

    it('cancels an AGENDADA request, returning it to DISPONIBLE with CANCELADA outcome', () => {
      const request = buildRequest('AGENDADA', 'PRESENCIAL');

      const change = request.cancelAppointment(
        'staff-1',
        '  Cita cancelada  ',
        NOW,
      );

      expect(request.status).toBe('DISPONIBLE');
      expect(request.allowedTransitions).toEqual(['AGENDADA', 'CERRADA']);
      expect(change).toEqual({
        requestId: '1',
        previousStatus: 'AGENDADA',
        newStatus: 'DISPONIBLE',
        changedBy: 'staff-1',
        changedAt: NOW,
        comment: 'Cita cancelada',
        rejectionReason: null,
        attendedAt: null,
        closedAt: null,
        appointmentOutcome: 'CANCELADA',
      });
      expect(Object.isFrozen(change)).toBe(true);
    });

    it.each(REQUEST_STATUSES.filter((status) => status !== 'AGENDADA'))(
      'rejects cancelling an appointment when the request is in %s',
      (status) => {
        const request = buildRequest(status, 'PRESENCIAL');

        expect(() => request.cancelAppointment('staff-1')).toThrow(
          InvalidStatusTransitionError,
        );
        expect(request.status).toBe(status);
      },
    );
  });

  describe('changeStatus to RECHAZADA (HU-16)', () => {
    it.each<RequestStatus>(['RECIBIDA', 'EN_BUSQUEDA'])(
      'rejects a %s request and keeps the reason for the requester',
      (from) => {
        const request = buildRequest(from);

        const change = request.changeStatus(
          'RECHAZADA',
          'staff-1',
          '  El material está restringido por la familia donante  ',
        );

        expect(request.status).toBe('RECHAZADA');
        expect(request.rejectionReason).toBe(
          'El material está restringido por la familia donante',
        );
        expect(change).toMatchObject({
          previousStatus: from,
          newStatus: 'RECHAZADA',
          comment: 'El material está restringido por la familia donante',
          rejectionReason:
            'El material está restringido por la familia donante',
        });
        expect(request.allowedTransitions).toEqual([]);
      },
    );

    it.each([undefined, null, '', '   '])(
      'does not reject without a reason (%j) and keeps the status',
      (reason) => {
        const request = buildRequest('RECIBIDA');

        expect(() =>
          request.changeStatus('RECHAZADA', 'staff-1', reason),
        ).toThrow(RejectionReasonRequiredError);
        expect(request.status).toBe('RECIBIDA');
        expect(request.rejectionReason).toBeNull();
      },
    );

    it('reports the invalid transition first when the reason is also missing', () => {
      const request = buildRequest('AGENDADA');

      expect(() => request.changeStatus('RECHAZADA', 'staff-1')).toThrow(
        InvalidStatusTransitionError,
      );
      expect(request.status).toBe('AGENDADA');
    });

    it('does not mark any other change as a rejection', () => {
      const change = buildRequest('RECIBIDA').changeStatus(
        'EN_BUSQUEDA',
        'staff-1',
        'Se asignó a Ana',
      );

      expect(change.rejectionReason).toBeNull();
    });
  });

  describe('direct DISPONIBLE when the material has a digital copy (HU-139)', () => {
    const NOW = new Date('2026-11-22T15:00:00.000Z');

    // A request as the repository loads it, with what it read of the copies
    const buildWithCopies = (overrides: Partial<RequestProps> = {}): Request =>
      new Request({
        id: '1',
        status: 'RECIBIDA',
        deliveryMode: 'DIGITAL',
        allMaterialsHaveDigitalCopy: true,
        anyMaterialNotConsultable: false,
        ...overrides,
      });

    const pendingReference: MaterialReference = Object.freeze({
      id: 'reference-1',
      kind: 'TEXTO_LIBRE',
      notary: null,
      year: null,
      deedNumber: null,
      description: 'El Heraldo, 15-03-1950',
      status: 'PENDIENTE',
      materialId: null,
    });

    it('offers DISPONIBLE and RECHAZADA, not EN_BUSQUEDA, when every material has a consultable copy', () => {
      const request = buildWithCopies();

      expect(request.allowedTransitions).toEqual(['DISPONIBLE', 'RECHAZADA']);
      // Only the rejection asks for a comment: there is nothing to explain
      expect(request.commentRequiredFor).toEqual(['RECHAZADA']);
    });

    it('moves RECIBIDA to DISPONIBLE and records who did it, when and the comment', () => {
      const request = buildWithCopies();

      const change = request.changeStatus(
        'DISPONIBLE',
        'staff-1',
        'Copia digital enviada por correo',
        NOW,
      );

      expect(request.status).toBe('DISPONIBLE');
      expect(change).toEqual({
        requestId: '1',
        previousStatus: 'RECIBIDA',
        newStatus: 'DISPONIBLE',
        changedBy: 'staff-1',
        changedAt: NOW,
        comment: 'Copia digital enviada por correo',
        rejectionReason: null,
        attendedAt: null,
        closedAt: null,
        appointmentOutcome: null,
      });
      // Then the digital delivery goes on as always
      expect(request.allowedTransitions).toEqual(['ATENDIDA', 'CERRADA']);
    });

    it('does not need a comment to go straight to DISPONIBLE', () => {
      const request = buildWithCopies();

      request.changeStatus('DISPONIBLE', 'staff-1');

      expect(request.status).toBe('DISPONIBLE');
    });

    it('rejects EN_BUSQUEDA with 409: the sync already found the material', () => {
      const request = buildWithCopies();

      expect(() => request.changeStatus('EN_BUSQUEDA', 'staff-1')).toThrow(
        InvalidStatusTransitionError,
      );
      expect(() => request.startSearch()).toThrow(
        'No se puede pasar una solicitud de Recibida a En búsqueda',
      );
      expect(request.status).toBe('RECIBIDA');
    });

    it('still lets the staff reject it', () => {
      const request = buildWithCopies();

      request.changeStatus('RECHAZADA', 'staff-1', 'Material restringido');

      expect(request.status).toBe('RECHAZADA');
    });

    it('allows the direct step with a material being restored: the restoration affects the original, not the copy', () => {
      const request = buildWithCopies(
        summarizeDigitalCopies([
          { hasDigitalCopy: true, status: 'EN_RESTAURACION' },
          { hasDigitalCopy: true, status: 'DISPONIBLE' },
        ]),
      );

      expect(request.allowedTransitions).toEqual(['DISPONIBLE', 'RECHAZADA']);
      request.markAvailable();
      expect(request.status).toBe('DISPONIBLE');
    });

    it.each<[string, Partial<RequestProps>]>([
      [
        'a material with its copy is not consultable',
        summarizeDigitalCopies([
          { hasDigitalCopy: true, status: 'DISPONIBLE' },
          { hasDigitalCopy: true, status: 'NO_CONSULTABLE' },
        ]),
      ],
      [
        'a material has no digital copy',
        summarizeDigitalCopies([
          { hasDigitalCopy: true, status: 'DISPONIBLE' },
          { hasDigitalCopy: false, status: 'DISPONIBLE' },
        ]),
      ],
      [
        'it has no catalog material, only a written reference',
        {
          ...summarizeDigitalCopies([]),
          references: [pendingReference],
        },
      ],
      [
        'a reference is still pending its material (HU-09.2)',
        { references: [pendingReference] },
      ],
      ['the delivery is presential', { deliveryMode: 'PRESENCIAL' }],
      [
        'the repository did not say anything about the copies',
        {
          allMaterialsHaveDigitalCopy: undefined,
          anyMaterialNotConsultable: undefined,
        },
      ],
    ])(
      'offers EN_BUSQUEDA and RECHAZADA, as before, when %s',
      (_case, overrides) => {
        const request = buildWithCopies(overrides);

        expect(request.allowedTransitions).toEqual([
          'EN_BUSQUEDA',
          'RECHAZADA',
        ]);
        expect(() => request.changeStatus('DISPONIBLE', 'staff-1')).toThrow(
          InvalidStatusTransitionError,
        );
        expect(request.status).toBe('RECIBIDA');

        request.changeStatus('EN_BUSQUEDA', 'staff-1');
        expect(request.status).toBe('EN_BUSQUEDA');
      },
    );

    it('only changes RECIBIDA: from EN_BUSQUEDA it goes to DISPONIBLE as always', () => {
      const request = buildWithCopies({ status: 'EN_BUSQUEDA' });

      expect(request.allowedTransitions).toEqual(['DISPONIBLE', 'RECHAZADA']);
    });

    it.each<RequestStatus>([
      'DISPONIBLE',
      'AGENDADA',
      'ATENDIDA',
      'CERRADA',
      'RECHAZADA',
    ])('never offers going back to EN_BUSQUEDA from %s', (status) => {
      const request = buildWithCopies({ status });

      expect(request.allowedTransitions).not.toContain('EN_BUSQUEDA');
    });
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
