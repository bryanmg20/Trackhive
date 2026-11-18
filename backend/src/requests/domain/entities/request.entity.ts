import { DeliveryMode } from '../enums/delivery-mode';
import { RequestMaterialsRequiredError } from '../errors/request-materials-required.error';
import { InvalidRequestStatusError } from '../errors/invalid-request-status.error';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';
import { RejectionReasonRequiredError } from '../errors/rejection-reason-required.error';
import {
  ChangeableStatus,
  isChangeableStatus,
  isRequestStatus,
  REQUEST_STATUSES,
  RequestStatus,
} from '../enums/request-status';
import { assertValidDesiredDate } from '../value-objects/desired-date';
import type { StatusChange } from '../value-objects/status-change';

// Business rule: the only status changes allowed (docs/modelo-dominio.md, section 4)
const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  RECIBIDA: ['EN_BUSQUEDA', 'RECHAZADA'],
  EN_BUSQUEDA: ['DISPONIBLE', 'RECHAZADA'],
  DISPONIBLE: ['AGENDADA', 'ATENDIDA', 'CERRADA'],
  AGENDADA: ['ATENDIDA', 'DISPONIBLE'],
  ATENDIDA: ['CERRADA'],
  CERRADA: [],
  RECHAZADA: [],
};

/** How the request arrived: the public form or the staff (HU-09, HU-10). */
export type OriginChannel = 'WEB' | 'PRESENCIAL';

/** What was registered when the request was created (HU-09, HU-10). */
export interface RequestRegistration {
  readonly trackingCode: string;
  readonly requesterId: string;
  readonly createdById: string;
  readonly originChannel: OriginChannel;
  readonly reason: string;
  readonly requirementDescription: string;
  // UTC midnight of the day
  readonly desiredDate: Date;
  readonly materialIds: readonly string[];
}

/** The data of a new request, before it exists (Request.create). */
export interface NewRequestData {
  id: string;
  trackingCode: string;
  requesterId: string;
  createdById: string;
  originChannel: OriginChannel;
  deliveryMode: DeliveryMode;
  reason: string;
  requirementDescription?: string;
  // YYYY-MM-DD
  desiredDate: string;
  materialIds: readonly string[];
}

export interface RequestProps {
  id: string;
  status: RequestStatus;
  deliveryMode: DeliveryMode;
  rejectionReason?: string | null;
  // Loaded by the repository; null for a request rebuilt only to apply its rules
  registration?: RequestRegistration | null;
}

export class Request {
  public readonly id: string;
  public readonly deliveryMode: DeliveryMode;
  private currentStatus: RequestStatus;
  private currentRejectionReason: string | null;
  public readonly registration: RequestRegistration | null;

  constructor(props: RequestProps) {
    if (!isRequestStatus(props.status)) {
      throw new InvalidRequestStatusError();
    }
    this.id = props.id;
    this.deliveryMode = props.deliveryMode;
    this.currentStatus = props.status;
    this.currentRejectionReason = props.rejectionReason ?? null;
    this.registration = props.registration ?? null;
  }

  /**
   * The rules a new request must meet (HU-09, HU-10): at least one material
   * (RN-04) and a valid desired date (RN-03). The use cases check them first,
   * before looking up the requester, and create() checks them again.
   */
  static assertCanBeCreated(
    data: Pick<NewRequestData, 'desiredDate' | 'materialIds'>,
    now: Date = new Date(),
  ): void {
    assertValidDesiredDate(data.desiredDate, now);
    if (data.materialIds.length === 0) {
      throw new RequestMaterialsRequiredError();
    }
  }

  /** A new request: it always starts RECIBIDA. A repeated material counts once. */
  static create(data: NewRequestData, now: Date = new Date()): Request {
    Request.assertCanBeCreated(data, now);
    return new Request({
      id: data.id,
      status: 'RECIBIDA',
      deliveryMode: data.deliveryMode,
      registration: {
        trackingCode: data.trackingCode,
        requesterId: data.requesterId,
        createdById: data.createdById,
        originChannel: data.originChannel,
        reason: data.reason,
        requirementDescription: data.requirementDescription ?? data.reason,
        desiredDate: new Date(`${data.desiredDate}T00:00:00.000Z`),
        materialIds: [...new Set(data.materialIds)],
      },
    });
  }

  get status(): RequestStatus {
    return this.currentStatus;
  }

  get rejectionReason(): string | null {
    return this.currentRejectionReason;
  }

  get allowedTransitions(): RequestStatus[] {
    return REQUEST_STATUSES.filter((next) => this.canTransitionTo(next));
  }

  startSearch(): void {
    this.transitionTo('EN_BUSQUEDA');
  }

  markAvailable(): void {
    this.transitionTo('DISPONIBLE');
  }

  schedule(): void {
    this.transitionTo('AGENDADA');
  }

  attend(): void {
    this.transitionTo('ATENDIDA');
  }

  close(): void {
    this.transitionTo('CERRADA');
  }

  reject(reason: string): void {
    this.assertCanTransitionTo('RECHAZADA');
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new RejectionReasonRequiredError();
    }
    this.currentRejectionReason = trimmedReason;
    this.currentStatus = 'RECHAZADA';
  }

  /**
   * The «cambiar estado» action of the staff (HU-15). It goes through the
   * same action methods, so the transition rules of HU-14 apply, and returns
   * the record of who changed the status, when and why. Blank comment = none.
   * From AGENDADA, ATENDIDA means the requester attended and DISPONIBLE that
   * they did not. To reject, the comment is the reason and it is required
   * (HU-16): without it, reject() throws RejectionReasonRequiredError.
   */
  changeStatus(
    next: ChangeableStatus,
    changedBy: string,
    comment?: string | null,
    now: Date = new Date(),
  ): StatusChange {
    if (!isChangeableStatus(next)) {
      throw new InvalidRequestStatusError();
    }
    const previousStatus = this.currentStatus;

    switch (next) {
      case 'EN_BUSQUEDA':
        this.startSearch();
        break;
      case 'DISPONIBLE':
        this.markAvailable();
        break;
      case 'ATENDIDA':
        this.attend();
        break;
      case 'CERRADA':
        this.close();
        break;
      case 'RECHAZADA':
        this.reject(comment ?? '');
        break;
    }

    return this.recordChange(previousStatus, changedBy, comment, now);
  }

  /**
   * «Agendar cita» (HU-18): the only way to reach AGENDADA. It goes through
   * schedule(), so the request must be DISPONIBLE with a presential delivery,
   * and returns the record of the change for status_history.
   */
  scheduleAppointment(
    scheduledBy: string,
    now: Date = new Date(),
  ): StatusChange {
    const previousStatus = this.currentStatus;
    this.schedule();
    return this.recordChange(previousStatus, scheduledBy, null, now);
  }

  /**
   * «Reprogramar cita» (HU-21): moves the scheduled appointment to another
   * day. The request must already be AGENDADA with a presential delivery,
   * stays in AGENDADA, and records the change in status_history.
   */
  rescheduleAppointment(
    rescheduledBy: string,
    comment?: string | null,
    now: Date = new Date(),
  ): StatusChange {
    if (
      this.currentStatus !== 'AGENDADA' ||
      this.deliveryMode !== 'PRESENCIAL'
    ) {
      throw new InvalidStatusTransitionError(this.currentStatus, 'AGENDADA');
    }
    return this.recordChange('AGENDADA', rescheduledBy, comment, now, null);
  }

  /**
   * «Cancelar cita» (HU-21): cancels the scheduled appointment, frees its
   * materials and returns the request from AGENDADA to DISPONIBLE (HU-14).
   */
  cancelAppointment(
    cancelledBy: string,
    comment?: string | null,
    now: Date = new Date(),
  ): StatusChange {
    if (this.currentStatus !== 'AGENDADA') {
      throw new InvalidStatusTransitionError(this.currentStatus, 'DISPONIBLE');
    }
    const previousStatus = this.currentStatus;
    this.markAvailable();
    return this.recordChange(
      previousStatus,
      cancelledBy,
      comment,
      now,
      'CANCELADA',
    );
  }

  private recordChange(
    previousStatus: RequestStatus,
    changedBy: string,
    comment: string | null | undefined,
    now: Date,
    outcomeOverride?: StatusChange['appointmentOutcome'],
  ): StatusChange {
    const newStatus = this.currentStatus;
    const leftAppointment =
      previousStatus === 'AGENDADA' && newStatus !== 'AGENDADA';
    const defaultOutcome: StatusChange['appointmentOutcome'] = leftAppointment
      ? newStatus === 'ATENDIDA'
        ? 'CUMPLIDA'
        : 'NO_ASISTIO'
      : null;
    return Object.freeze({
      requestId: this.id,
      previousStatus,
      newStatus,
      changedBy,
      changedAt: now,
      comment: comment?.trim() || null,
      rejectionReason:
        newStatus === 'RECHAZADA' ? this.currentRejectionReason : null,
      attendedAt: newStatus === 'ATENDIDA' ? now : null,
      closedAt: newStatus === 'CERRADA' ? now : null,
      // From AGENDADA only ATENDIDA (attended) and DISPONIBLE (did not / cancelled) are allowed
      appointmentOutcome:
        outcomeOverride !== undefined ? outcomeOverride : defaultOutcome,
    });
  }

  private canTransitionTo(next: RequestStatus): boolean {
    if (!ALLOWED_TRANSITIONS[this.currentStatus].includes(next)) {
      return false;
    }
    // From DISPONIBLE, the next step depends on how the material is delivered
    if (this.currentStatus === 'DISPONIBLE' && next === 'AGENDADA') {
      return this.deliveryMode === 'PRESENCIAL';
    }
    if (this.currentStatus === 'DISPONIBLE' && next === 'ATENDIDA') {
      return this.deliveryMode === 'DIGITAL';
    }
    return true;
  }

  private assertCanTransitionTo(next: RequestStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new InvalidStatusTransitionError(this.currentStatus, next);
    }
  }

  private transitionTo(next: RequestStatus): void {
    this.assertCanTransitionTo(next);
    this.currentStatus = next;
  }
}
