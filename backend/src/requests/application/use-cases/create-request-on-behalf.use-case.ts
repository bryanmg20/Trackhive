import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from '../../domain/entities/request.entity';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';
import { RequesterEmailRequiredError } from '../../domain/errors/requester-email-required.error';
import { RequesterNameRequiredError } from '../../domain/errors/requester-name-required.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { CreateRequestOnBehalfInput } from '../dto/create-request-on-behalf.input';
import { CreateRequestResponseDto } from '../dto/create-request-response.dto';
import { CreateRequestResponseMapper } from '../mappers/create-request-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import type { ITrackingCodeGenerator } from '../ports/tracking-code-generator.port';
import { RequesterResolver } from '../services/requester-resolver';
import {
  REQUEST_QUERY_SERVICE,
  REQUEST_REPOSITORY,
  TRACKING_CODE_GENERATOR,
} from '../tokens';

/**
 * Registers a request on behalf of a visitor. The staff member comes from the
 * access token; the requester may be a registered user or only contact data.
 */
@Injectable()
export class CreateRequestOnBehalfUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: IRequestRepository,
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
    @Inject(TRACKING_CODE_GENERATOR)
    private readonly trackingCodes: ITrackingCodeGenerator,
    private readonly requesterResolver: RequesterResolver,
  ) {}

  async execute(
    input: CreateRequestOnBehalfInput,
  ): Promise<CreateRequestResponseDto> {
    // RN-03 and RN-04, and the minimum data of the requester (HU-10), before
    // looking anything up
    Request.assertCanBeCreated(input);
    if (!input.requester.email?.trim()) {
      throw new RequesterEmailRequiredError();
    }
    if (
      !input.requester.userId &&
      (!input.requester.firstName?.trim() || !input.requester.lastName?.trim())
    ) {
      throw new RequesterNameRequiredError();
    }

    const missing = await this.queries.findMissingMaterialIds(
      input.materialIds,
    );
    if (missing.length > 0) {
      throw new RequestMaterialNotFoundError();
    }
    const requester = await this.requesterResolver.forContact(input.requester);

    const request = Request.create({
      id: randomUUID(),
      trackingCode: await this.trackingCodes.next(),
      requesterId: requester.id,
      createdById: input.createdById,
      originChannel: 'PRESENCIAL',
      deliveryMode: input.deliveryMode,
      reason: input.reason,
      requirementDescription: input.requirementDescription,
      desiredDate: input.desiredDate,
      materialIds: input.materialIds,
    });
    await this.repository.save(request);

    return CreateRequestResponseMapper.toDto(request);
  }
}
