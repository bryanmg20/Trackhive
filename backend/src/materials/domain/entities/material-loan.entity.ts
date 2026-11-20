import { MaterialNotInUseError } from '../errors/material-not-in-use.error';

export interface MaterialLoanProps {
  id: string;
  materialId: string;
  appointmentId: string;
  handedOverAt: Date;
  handedOverById: string;
  deliveryNotes: string | null;
  returnedAt: Date | null;
  returnedById: string | null;
  returnNotes: string | null;
}

export interface DeliverMaterialLoanProps {
  id: string;
  materialId: string;
  appointmentId: string;
  handedOverById: string;
  deliveryNotes: string | null;
  now?: Date;
}

/**
 * Physical handover and return of one archive material during an appointment
 * in the reading room (HU-72).
 */
export class MaterialLoan {
  public readonly id: string;
  public readonly materialId: string;
  public readonly appointmentId: string;
  public readonly handedOverAt: Date;
  public readonly handedOverById: string;
  public readonly deliveryNotes: string | null;
  public readonly returnedAt: Date | null;
  public readonly returnedById: string | null;
  public readonly returnNotes: string | null;

  constructor(props: MaterialLoanProps) {
    this.id = props.id;
    this.materialId = props.materialId;
    this.appointmentId = props.appointmentId;
    this.handedOverAt = props.handedOverAt;
    this.handedOverById = props.handedOverById;
    this.deliveryNotes = props.deliveryNotes;
    this.returnedAt = props.returnedAt;
    this.returnedById = props.returnedById;
    this.returnNotes = props.returnNotes;
  }

  /** Creates a new open loan when staff hands the material over. */
  static deliver(props: DeliverMaterialLoanProps): MaterialLoan {
    return new MaterialLoan({
      id: props.id,
      materialId: props.materialId,
      appointmentId: props.appointmentId,
      handedOverAt: props.now ?? new Date(),
      handedOverById: props.handedOverById,
      deliveryNotes: props.deliveryNotes,
      returnedAt: null,
      returnedById: null,
      returnNotes: null,
    });
  }

  get isOpen(): boolean {
    return this.returnedAt === null;
  }

  /** Closes the loan when the requester returns the material to staff. */
  registerReturn(
    returnedById: string,
    returnNotes: string | null,
    now: Date = new Date(),
  ): MaterialLoan {
    if (!this.isOpen) {
      throw new MaterialNotInUseError();
    }
    const returnedAt = now < this.handedOverAt ? this.handedOverAt : now;
    return new MaterialLoan({
      ...this,
      returnedAt,
      returnedById,
      returnNotes,
    });
  }
}
