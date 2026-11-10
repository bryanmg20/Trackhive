import { Inject, Injectable } from '@nestjs/common';
import { CreateRequestResponseDto } from '../dto/create-request-response.dto';
import type { RequestRepository } from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';
import { assertValidDesiredDate } from '../../domain/desired-date';
import { RequestMaterialsRequiredError } from '../../domain/errors/request-materials-required.error';

export interface CreateRequestInput {
  materialIds: string[];
  reason: string;
  desiredDate: string;
  deliveryMode: 'PRESENCIAL' | 'DIGITAL';
  requirementDescription?: string;
}

@Injectable()
export class CreateRequestUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(
    input: CreateRequestInput,
    userId: string,
  ): Promise<CreateRequestResponseDto> {
    assertValidDesiredDate(input.desiredDate);
    if (input.materialIds.length === 0) {
      throw new RequestMaterialsRequiredError();
    }

    return this.repository.create({ ...input, createdById: userId });
  }
}
