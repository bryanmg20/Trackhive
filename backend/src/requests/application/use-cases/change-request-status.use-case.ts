import { Inject, Injectable, Logger } from '@nestjs/common';
import { assertCanSettleAppointmentOutcome } from '../../domain/policies/appointment-loans';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { ChangeRequestStatusInput } from '../dto/change-request-status.input';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { ChangeRequestStatusResponseDto } from '../dto/change-request-status-response.dto';
import { buildStatusChangeEmail } from '../services/status-change-email';
import { ChangeRequestStatusResponseMapper } from '../mappers/change-request-status-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE, REQUEST_REPOSITORY } from '../tokens';

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
    @Inject(REQUEST_REPOSITORY) private readonly repository: IRequestRepository,
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: ChangeRequestStatusInput,
  ): Promise<ChangeRequestStatusResponseDto> {
    const request = await this.repository.findById(input.requestId);
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

    if (change.appointmentOutcome) {
      const loanCounts =
        await this.queries.countScheduledAppointmentLoansByRequest(request.id);
      assertCanSettleAppointmentOutcome(change.appointmentOutcome, loanCounts);
    }

    // HU-23 / HU-24: the new status and, if rejected, the reason (otherwise the staff comment)
    const context = await this.queries.findNotificationContext(request.id);
    const notification = context
      ? buildStatusChangeEmail(context, {
          newStatus: change.newStatus,
          comment: change.rejectionReason ? null : change.comment,
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

    return ChangeRequestStatusResponseMapper.toDto(request, saved);
  }
}
