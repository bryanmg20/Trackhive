import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_APPOINTMENT_PAGE_LIMIT } from '../../../common/pagination';
import { PaginatedAppointmentsResponseDto } from '../dto/appointment-list-response.dto';
import type { ListAppointmentsInput } from '../dto/list-appointments.input';
import { AppointmentListResponseMapper } from '../mappers/appointment-list-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE } from '../tokens';

/**
 * «Vista de calendario» (HU-19): lists the scheduled appointments with
 * pagination, filters by material, requester, status and date range, and
 * ordering.
 */
@Injectable()
export class ListAppointmentsUseCase {
  constructor(
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: ListAppointmentsInput,
  ): Promise<PaginatedAppointmentsResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_APPOINTMENT_PAGE_LIMIT;

    const { items, total } = await this.queries.listAppointments({
      status: input.status,
      from: input.from,
      to: input.to,
      requester: input.requester,
      material: input.material,
      // Chronological by default so the calendar shows the appointments in order
      sort: input.sort ?? 'appointmentDate',
      order: input.order ?? 'asc',
      page,
      limit,
    });

    return AppointmentListResponseMapper.toPaginatedDto(items, {
      page,
      limit,
      total,
    });
  }
}
