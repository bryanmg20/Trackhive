import { Inject, Injectable } from '@nestjs/common';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import type { ChangeableStatus } from '../../domain/request-status';
import { ChangeRequestStatusResponseDto } from '../dto/change-request-status-response.dto';
import type { RequestRepository } from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';

export interface ChangeRequestStatusInput {
  requestId: string;
  status: ChangeableStatus;
  comment?: string;
  // Who makes the change: always the user of the access token
  userId: string;
}

/**
 * «Cambiar estado de una solicitud» (HU-15). The entity decides whether the
 * transition is valid (HU-14); the repository saves the new status and its
 * row in status_history together, with the date, time and responsible.
 */
@Injectable()
export class ChangeRequestStatusUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(
    input: ChangeRequestStatusInput,
  ): Promise<ChangeRequestStatusResponseDto> {
    const request = await this.repository.findEntityById(input.requestId);
    if (!request) {
      throw new RequestNotFoundError();
    }

    // Throws InvalidStatusTransitionError (409) before anything is saved
    const change = request.changeStatus(
      input.status,
      input.userId,
      input.comment,
    );
    const saved = await this.repository.saveStatusChange(change);

    const { changedBy } = saved;
    return {
      id: request.id,
      status: request.status,
      allowedTransitions: request.allowedTransitions,
      statusChange: {
        previousStatus: saved.previousStatus,
        newStatus: saved.newStatus,
        changedAt: saved.changedAt.toISOString(),
        changedBy: {
          id: changedBy.id,
          name: [
            changedBy.firstName,
            changedBy.middleName,
            changedBy.lastName,
            changedBy.secondLastName,
          ]
            .filter(Boolean)
            .join(' '),
        },
        comment: saved.comment,
      },
    };
  }
}
