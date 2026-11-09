import { CreateRequestInput } from '../use-cases/create-request.use-case';

export interface CreatedRequest {
  id: string;
  trackingCode: string;
  status: 'RECIBIDA';
}

export interface RequestRepository {
  create(
    input: CreateRequestInput & { createdById: string },
  ): Promise<CreatedRequest>;
}
