import { Inject, Injectable } from '@nestjs/common';
import { toAppointmentDay } from '../../domain/appointment-date';
import {
  AppointmentListItemDto,
  PaginatedAppointmentsResponseDto,
} from '../dto/appointment-list-response.dto';
import {
  DEFAULT_APPOINTMENT_PAGE_LIMIT,
  ListAppointmentsQueryDto,
} from '../dto/list-appointments-query.dto';
import type {
  AppointmentListItem,
  RequestRepository,
} from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';

export type ListAppointmentsInput = ListAppointmentsQueryDto;

interface PersonName {
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
}

const fullName = (person: PersonName): string =>
  [person.firstName, person.middleName, person.lastName, person.secondLastName]
    .filter(Boolean)
    .join(' ');

function toDto(item: AppointmentListItem): AppointmentListItemDto {
  const date = item.appointmentDate.toISOString().slice(0, 10);
  const { serviceHours } = toAppointmentDay(date);

  return {
    id: item.id,
    date,
    serviceHours,
    status: item.status,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    request: {
      id: item.request.id,
      trackingCode: item.request.trackingCode,
      status: item.request.status,
      deliveryMode: item.request.deliveryMode,
    },
    requester: {
      id: item.requester.id,
      name: fullName(item.requester),
      email: item.requester.email,
      phone: item.requester.phone,
      requesterType: item.requester.requesterType,
      institution: item.requester.institution,
      documentType: item.requester.documentType,
      documentNumber: item.requester.documentNumber,
    },
    scheduledBy: {
      id: item.scheduledBy.id,
      name: fullName(item.scheduledBy),
    },
    materials: item.materials.map((material) => ({
      id: material.id,
      catalogCode: material.catalogCode,
      title: material.title,
      materialType: material.materialType,
      location: {
        depot: material.depot,
        shelf: material.shelf,
        box: material.box,
      },
    })),
  };
}

/**
 * «Vista de calendario» (HU-19): lists the scheduled appointments with
 * pagination, filters by material, requester, status and date range, and
 * ordering.
 */
@Injectable()
export class ListAppointmentsUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(
    input: ListAppointmentsInput,
  ): Promise<PaginatedAppointmentsResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_APPOINTMENT_PAGE_LIMIT;

    const { items, total } = await this.repository.listAppointments({
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

    return { items: items.map(toDto), page, limit, total };
  }
}
