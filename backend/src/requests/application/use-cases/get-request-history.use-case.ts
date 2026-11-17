import { Inject, Injectable } from '@nestjs/common';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { assertCanViewHistory } from '../../domain/policies/request-history-access';
import type { GetRequestHistoryInput } from '../dto/get-request-history.input';
import { RequestHistoryResponseDto } from '../dto/request-history-response.dto';
import { RequestHistoryResponseMapper } from '../mappers/request-history-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE } from '../tokens';

/**
 * The timeline of a request (HU-17): every status change with the previous
 * and new status, the date and who made it. The staff and the admin read any
 * request; a public user only their own.
 */
@Injectable()
export class GetRequestHistoryUseCase {
  constructor(
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: GetRequestHistoryInput,
  ): Promise<RequestHistoryResponseDto> {
    const history = await this.queries.findHistory(input.requestId);
    if (!history) {
      throw new RequestNotFoundError();
    }

    assertCanViewHistory(input.viewer, history.requesterUserId);

    return RequestHistoryResponseMapper.toDto(history, input.viewer);
  }
}
