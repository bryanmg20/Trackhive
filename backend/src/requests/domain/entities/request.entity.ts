import { DeliveryMode } from '../delivery-mode';
import { InvalidRequestStatusError } from '../errors/invalid-request-status.error';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';
import { RejectionReasonRequiredError } from '../errors/rejection-reason-required.error';
import {
  isRequestStatus,
  REQUEST_STATUSES,
  RequestStatus,
} from '../request-status';

// Business rule: the only status changes allowed (docs/modelo-datos.md, section 1.3)
const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  RECIBIDA: ['EN_BUSQUEDA', 'RECHAZADA'],
  EN_BUSQUEDA: ['DISPONIBLE', 'RECHAZADA'],
  DISPONIBLE: ['AGENDADA', 'ATENDIDA', 'CERRADA'],
  AGENDADA: ['ATENDIDA', 'DISPONIBLE'],
  ATENDIDA: ['CERRADA'],
  CERRADA: [],
  RECHAZADA: [],
};

export interface RequestProps {
  id: string;
  status: RequestStatus;
  deliveryMode: DeliveryMode;
  rejectionReason?: string | null;
}

export class Request {
  public readonly id: string;
  public readonly deliveryMode: DeliveryMode;
  private currentStatus: RequestStatus;
  private currentRejectionReason: string | null;

  constructor(props: RequestProps) {
    if (!isRequestStatus(props.status)) {
      throw new InvalidRequestStatusError();
    }
    this.id = props.id;
    this.deliveryMode = props.deliveryMode;
    this.currentStatus = props.status;
    this.currentRejectionReason = props.rejectionReason ?? null;
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
