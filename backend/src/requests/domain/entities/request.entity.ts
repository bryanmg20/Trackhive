import { DeliveryMode } from '../enums/delivery-mode';
import { RequestMaterialsRequiredError } from '../errors/request-materials-required.error';
import { DeliveryCommentRequiredError } from '../errors/delivery-comment-required.error';
import { InvalidRequestStatusError } from '../errors/invalid-request-status.error';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';
import { MaterialReferenceAlreadyResolvedError } from '../errors/material-reference-already-resolved.error';
import { MaterialReferenceNotFoundError } from '../errors/material-reference-not-found.error';
import { MaterialReferenceNotResolvableError } from '../errors/material-reference-not-resolvable.error';
import { RejectionReasonRequiredError } from '../errors/rejection-reason-required.error';
import {
  ChangeableStatus,
  isChangeableStatus,
  isRequestStatus,
  REQUEST_STATUSES,
  RequestStatus,
} from '../enums/request-status';
import { canResolveReferences } from '../policies/reference-resolution';
import { assertValidDesiredDate } from '../value-objects/desired-date';
import {
  createMaterialReference,
  describeMaterialReference,
} from '../value-objects/material-reference';
import type {
  MaterialReference,
  MaterialReferenceData,
} from '../value-objects/material-reference';
import type { ReferenceResolution } from '../value-objects/reference-resolution';
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
  // Materials not in the catalog, described in writing (HU-09.2)
  references?: readonly NewMaterialReference[];
}

/** A written reference of a new request, with the id the use case gave it. */
export interface NewMaterialReference extends MaterialReferenceData {
  id: string;
}

/** The catalog material the staff associates with a reference (HU-09.2). */
export interface ReferenceMaterial {
  id: string;
  catalogCode: string;
  title: string;
}

export interface RequestProps {
  id: string;
  status: RequestStatus;
  deliveryMode: DeliveryMode;
  rejectionReason?: string | null;
  // Loaded by the repository; null for a request rebuilt only to apply its rules
  registration?: RequestRegistration | null;
  // Its written references (HU-09.2); none when omitted
  references?: readonly MaterialReference[];
}

export class Request {
  public readonly id: string;
  public readonly deliveryMode: DeliveryMode;
  private currentStatus: RequestStatus;
  private currentRejectionReason: string | null;
  public readonly registration: RequestRegistration | null;
  private currentReferences: readonly MaterialReference[];

  constructor(props: RequestProps) {
    if (!isRequestStatus(props.status)) {
      throw new InvalidRequestStatusError();
    }
    this.id = props.id;
    this.deliveryMode = props.deliveryMode;
    this.currentStatus = props.status;
    this.currentRejectionReason = props.rejectionReason ?? null;
    this.registration = props.registration ?? null;
    this.currentReferences = props.references ?? [];
  }

  /**
   * The rules a new request must meet (HU-09, HU-10): at least one material
   * of the catalog or one written reference (RN-04, HU-09.2), each reference
   * with the data of its kind, and a valid desired date (RN-03). The use
   * cases check them first, before looking up the requester, and create()
   * checks them again.
   */
  static assertCanBeCreated(
    data: Pick<NewRequestData, 'desiredDate' | 'materialIds'> & {
      references?: readonly MaterialReferenceData[];
    },
    now: Date = new Date(),
  ): void {
    assertValidDesiredDate(data.desiredDate, now);
    const references = data.references ?? [];
    if (data.materialIds.length === 0 && references.length === 0) {
      throw new RequestMaterialsRequiredError();
    }
    // Throws InvalidMaterialReferenceError (400) for an incomplete reference
    references.forEach((reference) =>
      createMaterialReference('', reference, now),
    );
  }

  /**
   * A new request: it always starts RECIBIDA, and its references PENDIENTE.
   * A repeated material counts once.
   */
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
      references: (data.references ?? []).map((reference) =>
        createMaterialReference(reference.id, reference, now),
      ),
    });
  }

  get references(): readonly MaterialReference[] {
    return this.currentReferences;
  }

  /**
   * A reference without its catalog material. It blocks nothing: going
   * EN_BUSQUEDA → DISPONIBLE with one only asks for a comment (HU-09.2).
   */
  get hasPendingReferences(): boolean {
    return this.currentReferences.some(
      (reference) => reference.status === 'PENDIENTE',
    );
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

  /**
   * From EN_BUSQUEDA with references without material, the comment is
   * required: it says what is delivered and how (HU-09.2). Coming back from
   * AGENDADA (no-show or cancelled appointment) never asks for it.
   */
  markAvailable(comment?: string | null): void {
    this.assertCanTransitionTo('DISPONIBLE');
    if (
      this.currentStatus === 'EN_BUSQUEDA' &&
      this.hasPendingReferences &&
      !comment?.trim()
    ) {
      throw new DeliveryCommentRequiredError();
    }
    this.currentStatus = 'DISPONIBLE';
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
        this.markAvailable(comment);
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

  /**
   * «Asociar material» (HU-09.2): the staff gives a pending reference its
   * catalog material, normally the one the sync brought after digitizing
   * it. Only while the request is RECIBIDA or EN_BUSQUEDA. The status does
   * not change; the history records who did it and which material it was.
   */
  resolveReference(
    referenceId: string,
    material: ReferenceMaterial,
    resolvedBy: string,
    now: Date = new Date(),
  ): ReferenceResolution {
    const reference = this.currentReferences.find(
      ({ id }) => id === referenceId,
    );
    if (!reference) {
      throw new MaterialReferenceNotFoundError();
    }
    if (reference.status === 'RESUELTA') {
      throw new MaterialReferenceAlreadyResolvedError();
    }
    if (!canResolveReferences(this.currentStatus)) {
      throw new MaterialReferenceNotResolvableError();
    }

    this.currentReferences = this.currentReferences.map((current) =>
      current.id === referenceId
        ? Object.freeze({
            ...current,
            status: 'RESUELTA' as const,
            materialId: material.id,
          })
        : current,
    );

    const comment =
      `Referencia «${describeMaterialReference(reference)}» asociada al ` +
      `material ${material.catalogCode} · ${material.title}`;
    return Object.freeze({
      requestId: this.id,
      referenceId,
      materialId: material.id,
      resolvedBy,
      resolvedAt: now,
      historyEntry: this.recordChange(
        this.currentStatus,
        resolvedBy,
        comment,
        now,
        null,
      ),
    });
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
