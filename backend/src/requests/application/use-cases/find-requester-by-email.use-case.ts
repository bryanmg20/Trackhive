import { Inject, Injectable } from '@nestjs/common';
import { RequesterResponseDto } from '../dto/requester-response.dto';
import { RequesterResponseMapper } from '../mappers/requester-response.mapper';
import type { RequestRepository } from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';
import { RequesterNotFoundError } from '../../domain/errors/requester-not-found.error';

@Injectable()
export class FindRequesterByEmailUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(email: string): Promise<RequesterResponseDto> {
    const profile = await this.repository.findRequesterByEmail(
      email.trim().toLowerCase(),
    );
    if (!profile) {
      throw new RequesterNotFoundError();
    }
    return RequesterResponseMapper.toDto(profile);
  }
}
