import { MaterialLoan } from '../entities/material-loan.entity';
import { MaterialStatus } from '../enums/material-status';

export interface MaterialLoanPerson {
  id: string;
  name: string;
}

export interface MaterialLoanAppointmentRef {
  id: string;
  date: Date;
  requestId: string;
  trackingCode: string;
}

export interface MaterialLoanRecord {
  id: string;
  materialId: string;
  materialCatalogCode: string;
  materialTitle: string;
  materialStatus: MaterialStatus;
  appointment: MaterialLoanAppointmentRef;
  requester: MaterialLoanPerson;
  handedOverAt: Date;
  handedOverBy: MaterialLoanPerson;
  deliveryNotes: string | null;
  returnedAt: Date | null;
  returnedBy: MaterialLoanPerson | null;
  returnNotes: string | null;
}

export interface ReturnActiveLoanParams {
  materialId: string;
  returnedById: string;
  returnNotes: string | null;
  now?: Date;
}

export interface MaterialLoanHistoryCriteria {
  materialId: string;
  page: number;
  limit: number;
}

export interface MaterialLoanHistoryResult {
  items: MaterialLoanRecord[];
  lastLoan: MaterialLoanRecord | null;
  total: number;
}

export interface IMaterialLoanRepository {
  /**
   * Atomically transitions the material from DISPONIBLE to EN_USO and creates
   * the open loan row in material_loans (HU-72).
   */
  deliverMaterial(loan: MaterialLoan): Promise<MaterialLoanRecord>;

  /**
   * Atomically closes the open loan of the material and transitions the
   * material back from EN_USO to DISPONIBLE (HU-72).
   */
  returnActiveLoan(params: ReturnActiveLoanParams): Promise<MaterialLoanRecord>;

  /**
   * Lists the custody history of a material ordered from most recent handover
   * to oldest, along with the latest loan summary (HU-72).
   */
  findMaterialHistory(
    criteria: MaterialLoanHistoryCriteria,
  ): Promise<MaterialLoanHistoryResult>;
}
