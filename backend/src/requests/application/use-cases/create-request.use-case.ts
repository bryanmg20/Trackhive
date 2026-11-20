import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from '../../domain/entities/request.entity';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { CreateRequestInput } from '../dto/create-request.input';
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

/** A public user radicates their own request from the web form (HU-09). */
@Injectable()
export class CreateRequestUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: IRequestRepository,
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
    @Inject(TRACKING_CODE_GENERATOR)
    private readonly trackingCodes: ITrackingCodeGenerator,
    private readonly requesterResolver: RequesterResolver,
  ) {}

  async execute(input: CreateRequestInput): Promise<CreateRequestResponseDto> {
    // RN-03 and RN-04 before looking anything up
    const materialIds = input.materialIds ?? [];
    const references = (input.references ?? []).map((reference) => ({
      ...reference,
      id: randomUUID(),
    }));
    Request.assertCanBeCreated({
      desiredDate: input.desiredDate,
      materialIds,
      references,
    });

    const requester = await this.requesterResolver.forUser(input.userId);
    const missing =
      materialIds.length > 0
        ? await this.queries.findMissingMaterialIds(materialIds)
        : [];
    if (missing.length > 0) {
      throw new RequestMaterialNotFoundError();
    }

    const request = Request.create({
      id: randomUUID(),
      trackingCode: await this.trackingCodes.next(),
      requesterId: requester.id,
      createdById: input.userId,
      originChannel: 'WEB',
      deliveryMode: input.deliveryMode,
      reason: input.reason,
      requirementDescription: input.requirementDescription,
      desiredDate: input.desiredDate,
      materialIds,
      references,
    });
    await this.repository.save(request);

    return CreateRequestResponseMapper.toDto(request);
  }
}
