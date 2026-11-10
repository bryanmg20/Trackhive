import { Inject, Injectable } from '@nestjs/common';
import { CreateRequestResponseDto } from '../dto/create-request-response.dto';
import type { RequestRepository } from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';
import { assertValidDesiredDate } from '../../domain/desired-date';
import { RequestMaterialsRequiredError } from '../../domain/errors/request-materials-required.error';
import { RequesterEmailRequiredError } from '../../domain/errors/requester-email-required.error';
import { RequesterNameRequiredError } from '../../domain/errors/requester-name-required.error';
import type { CreateRequestInput } from './create-request.use-case';

export interface RequesterInput {
  email: string;
  userId?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  secondLastName?: string | null;
  phone?: string | null;
  requesterType?: string;
  institution?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
}

export interface CreateRequestOnBehalfInput extends CreateRequestInput {
  requester: RequesterInput;
}

/**
 * Registers a request on behalf of a visitor. The staff member comes from the
 * access token; the requester may be a registered user or only contact data.
 */
@Injectable()
export class CreateRequestOnBehalfUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(
    input: CreateRequestOnBehalfInput,
    createdById: string,
  ): Promise<CreateRequestResponseDto> {
    assertValidDesiredDate(input.desiredDate);

    if (input.materialIds.length === 0) {
      throw new RequestMaterialsRequiredError();
    }
    if (!input.requester.email?.trim()) {
      throw new RequesterEmailRequiredError();
    }
    if (
      !input.requester.userId &&
      (!input.requester.firstName?.trim() || !input.requester.lastName?.trim())
    ) {
      throw new RequesterNameRequiredError();
    }

    return this.repository.createOnBehalf({ ...input, createdById });
  }
}
