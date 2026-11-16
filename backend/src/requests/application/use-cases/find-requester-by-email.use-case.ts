import { Inject, Injectable } from '@nestjs/common';
import { RequesterNotFoundError } from '../../domain/errors/requester-not-found.error';
import type { FindRequesterByEmailInput } from '../dto/find-requester-by-email.input';
import { RequesterResponseDto } from '../dto/requester-response.dto';
import { RequesterResponseMapper } from '../mappers/requester-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE } from '../tokens';

@Injectable()
export class FindRequesterByEmailUseCase {
  constructor(
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: FindRequesterByEmailInput,
  ): Promise<RequesterResponseDto> {
    const profile = await this.queries.findRequesterByEmail(
      input.email.trim().toLowerCase(),
    );
    if (!profile) {
      throw new RequesterNotFoundError();
    }
    return RequesterResponseMapper.toDto(profile);
  }
}
