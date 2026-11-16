import { Inject, Injectable } from '@nestjs/common';
import { Request } from '../../domain/entities/request.entity';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
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

    // The screen offers only these transitions (HU-15): the rule stays in the
    // entity instead of being repeated in React
    const { allowedTransitions } = new Request({
      id: detail.id,
      status: detail.status,
      deliveryMode: detail.deliveryMode,
      rejectionReason: detail.rejectionReason,
    });

    return RequestDetailResponseMapper.toDto(detail, allowedTransitions);
  }
}
