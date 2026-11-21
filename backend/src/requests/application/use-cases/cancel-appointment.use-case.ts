import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error';
import { AppointmentNotScheduledError } from '../../domain/errors/appointment-not-scheduled.error';
import { assertCanCancelOrRescheduleAppointment } from '../../domain/policies/appointment-loans';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import { CancelAppointmentResponseDto } from '../dto/cancel-appointment-response.dto';
import type { CancelAppointmentInput } from '../dto/cancel-appointment.input';
import { CancelAppointmentResponseMapper } from '../mappers/cancel-appointment-response.mapper';
import { DateOnlyMapper } from '../mappers/date-only.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { buildStatusChangeEmail } from '../services/status-change-email';
import { REQUEST_QUERY_SERVICE, REQUEST_REPOSITORY } from '../tokens';

/**
 * «Cancelar cita» (HU-21). Marks a PROGRAMADA appointment as CANCELADA,
 * releases its booked materials for that day, moves the request back from
 * AGENDADA to DISPONIBLE (HU-14), records the change in status_history and
 * queues the notification email in the same transaction.
 */
@Injectable()
export class CancelAppointmentUseCase {
  private readonly logger = new Logger(CancelAppointmentUseCase.name);

  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: IRequestRepository,
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: CancelAppointmentInput,
  ): Promise<CancelAppointmentResponseDto> {
    const appointment = await this.repository.findAppointmentById(
      input.appointmentId,
    );
    if (!appointment) {
      throw new AppointmentNotFoundError();
    }
    if (appointment.status !== 'PROGRAMADA') {
      throw new AppointmentNotScheduledError();
    }

    const loanCounts = await this.queries.countAppointmentLoans(appointment.id);
    assertCanCancelOrRescheduleAppointment(loanCounts);

    const appointmentDate = DateOnlyMapper.toDto(appointment.date);
    const defaultComment = `Cita del ${appointmentDate} cancelada`;
    const staffComment = input.comment?.trim() || null;
    const comment = staffComment ?? defaultComment;
    const change = appointment.request.cancelAppointment(input.userId, comment);

    const context = await this.queries.findNotificationContext(
      appointment.request.id,
    );
    const notification = context
      ? buildStatusChangeEmail(context, {
          newStatus: change.newStatus,
          appointmentEvent: 'CANCELADA',
          cancelledAppointmentDate: appointment.date,
          comment: staffComment,
        })
      : null;
    if (!notification) {
      this.logger.warn(
        `Request ${context?.trackingCode ?? appointment.request.id} has no ` +
          'requester email: its appointment cancellation is saved without an email',
      );
    }

    const saved = await this.repository.cancelAppointment(
      appointment.id,
      change,
      notification,
    );

    return CancelAppointmentResponseMapper.toDto(appointment.request, saved);
  }
}
