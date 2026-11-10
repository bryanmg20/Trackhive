import type { DeliveryMode } from '../../domain/delivery-mode';
import type { RequestStatus } from '../../domain/request-status';
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

export const REQUEST_SORT_FIELDS = ['registeredAt', 'desiredDate'] as const;

export type RequestSortField = (typeof REQUEST_SORT_FIELDS)[number];

export type SortOrder = 'asc' | 'desc';

export interface RequestListCriteria {
  status?: RequestStatus;
  // Desired date range, both ends included, as YYYY-MM-DD
  desiredFrom?: string;
  desiredTo?: string;
  // Free text matched against the requester's names, email and document number
  requester?: string;
  // Free text matched against the title or catalog code of a requested material
  material?: string;
  sort: RequestSortField;
  order: SortOrder;
  page: number;
  limit: number;
}

export interface RequestListItem {
  id: string;
  trackingCode: string;
  status: RequestStatus;
  deliveryMode: DeliveryMode;
  desiredDate: Date;
  registeredAt: Date;
  requester: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
    email: string | null;
  };
  materials: { id: string; catalogCode: string; title: string }[];
}

export interface RequestListResult {
  items: RequestListItem[];
  total: number;
}

export interface RequestDetail {
  id: string;
  trackingCode: string;
  status: RequestStatus;
  deliveryMode: DeliveryMode;
  originChannel: string;
  reason: string | null;
  requirementDescription: string;
  desiredDate: Date;
  committedDate: Date | null;
  registeredAt: Date;
  rejectionReason: string | null;
  requester: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    secondLastName: string | null;
    email: string | null;
    phone: string | null;
    requesterType: string;
    institution: string | null;
    documentType: string | null;
    documentNumber: string | null;
  };
  materials: {
    id: string;
    catalogCode: string;
    title: string;
    materialType: string;
    author: string | null;
    collection: string;
    status: string;
    location: { depot: string; shelf: string; box: string };
    itemStatus: string;
  }[];
}

export interface RequestRepository {
  create(
    input: CreateRequestInput & { createdById: string },
  ): Promise<CreatedRequest>;

  createOnBehalf(
    input: CreateRequestOnBehalfInput & { createdById: string },
  ): Promise<CreatedRequest>;

  findRequesterByEmail(email: string): Promise<RequesterProfile | null>;

  list(criteria: RequestListCriteria): Promise<RequestListResult>;

  findById(id: string): Promise<RequestDetail | null>;
}
