import type { CreateRequestInput } from '../use-cases/create-request.use-case';
import type { CreateRequestOnBehalfInput } from '../use-cases/create-request-on-behalf.use-case';

export interface CreatedRequest {
  id: string;
  trackingCode: string;
  status: 'RECIBIDA';
}

export interface RequesterProfile {
  requesterId: string | null;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
  phone: string | null;
  requesterType: string | null;
  institution: string | null;
  documentType: string | null;
  documentNumber: string | null;
  foundIn: 'REQUESTER' | 'USER';
}

export interface RequestRepository {
  create(
    input: CreateRequestInput & { createdById: string },
  ): Promise<CreatedRequest>;

  createOnBehalf(
    input: CreateRequestOnBehalfInput & { createdById: string },
  ): Promise<CreatedRequest>;

  findRequesterByEmail(email: string): Promise<RequesterProfile | null>;
}
