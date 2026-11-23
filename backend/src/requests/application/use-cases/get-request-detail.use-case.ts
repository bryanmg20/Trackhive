import { Inject, Injectable } from '@nestjs/common';
import { Request } from '../../domain/entities/request.entity';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { summarizeDigitalCopies } from '../../domain/policies/digital-copy';
import type { GetRequestDetailInput } from '../dto/get-request-detail.input';
import { RequestDetailResponseDto } from '../dto/request-detail-response.dto';
import { RequestDetailResponseMapper } from '../mappers/request-detail-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE } from '../tokens';

@Injectable()
export class GetRequestDetailUseCase {
  constructor(
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: GetRequestDetailInput,
  ): Promise<RequestDetailResponseDto> {
    const detail = await this.queries.findDetail(input.id);
    if (!detail) {
      throw new RequestNotFoundError();
    }

    // The screen offers only these transitions (HU-15) and asks for the
    // comment only where the entity requires it (HU-16, HU-09.2): the rules
    // stay in the entity instead of being repeated in React. With its
    // references, or the delivery comment would never be required, and the
    // digital copies of its materials, or RECIBIDA would never offer
    // DISPONIBLE (HU-139)
    const request = new Request({
      id: detail.id,
      status: detail.status,
      deliveryMode: detail.deliveryMode,
      rejectionReason: detail.rejectionReason,
      references: detail.references,
      ...summarizeDigitalCopies(detail.materials),
    });

    return RequestDetailResponseMapper.toDto(detail, {
      allowedTransitions: request.allowedTransitions,
      commentRequiredFor: request.commentRequiredFor,
    });
  }
}
