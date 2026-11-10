import { Inject, Injectable, Logger } from '@nestjs/common';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import type { ChangeableStatus } from '../../domain/request-status';
import { ChangeRequestStatusResponseDto } from '../dto/change-request-status-response.dto';
import { buildStatusChangeEmail } from '../notifications/status-change-email';
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
 * row in status_history together, with the date, time and responsible, and
 * queues the email to the requester in the same transaction (HU-23).
 */
@Injectable()
export class ChangeRequestStatusUseCase {
  private readonly logger = new Logger(ChangeRequestStatusUseCase.name);

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

    // Throws InvalidStatusTransitionError (409), or RejectionReasonRequiredError
    // (400) when rejecting without a reason, before anything is saved (HU-16)
    const change = request.changeStatus(
      input.status,
      input.userId,
      input.comment,
    );

    // HU-23: the new status and, if rejected, the reason the requester reads
    const context = await this.repository.findNotificationContext(request.id);
    const notification = context
      ? buildStatusChangeEmail(context, {
          newStatus: change.newStatus,
          rejectionReason: change.rejectionReason,
        })
      : null;
    if (!notification) {
      this.logger.warn(
        `Request ${context?.trackingCode ?? request.id} has no requester ` +
          'email: its status change is saved without an email',
      );
    }

    const saved = await this.repository.saveStatusChange(change, notification);

    const { changedBy } = saved;
    return {
      id: request.id,
      status: request.status,
      allowedTransitions: request.allowedTransitions,
      rejectionReason: request.rejectionReason,
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
