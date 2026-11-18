import { toAppointmentDay } from '../../domain/value-objects/appointment-date';
import {
  AppointmentListItemDto,
  PaginatedAppointmentsResponseDto,
} from '../dto/appointment-list-response.dto';
import type { AppointmentListItem } from '../ports/request-query.port';
import { DateOnlyMapper } from './date-only.mapper';
import { PersonNameMapper } from './person-name.mapper';

/** A row of the calendar (HU-19) → its response. */
export class AppointmentListResponseMapper {
  static toDto(item: AppointmentListItem): AppointmentListItemDto {
    const date = DateOnlyMapper.toDto(item.appointmentDate);
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
        name: PersonNameMapper.fullName(item.requester),
        email: item.requester.email,
        phone: item.requester.phone,
        requesterType: item.requester.requesterType,
        institution: item.requester.institution,
        documentType: item.requester.documentType,
        documentNumber: item.requester.documentNumber,
      },
      scheduledBy: {
        id: item.scheduledBy.id,
        name: PersonNameMapper.fullName(item.scheduledBy),
      },
      materials: item.materials.map((material) => ({
        id: material.id,
        catalogCode: material.catalogCode,
        title: material.title,
        materialType: material.materialType,
        location:
          material.depot !== null &&
          material.shelf !== null &&
          material.box !== null
            ? {
                depot: material.depot,
                shelf: material.shelf,
                box: material.box,
              }
            : null,
      })),
    };
  }

  static toPaginatedDto(
    items: AppointmentListItem[],
    pagination: { page: number; limit: number; total: number },
  ): PaginatedAppointmentsResponseDto {
    return {
      items: items.map((item) => AppointmentListResponseMapper.toDto(item)),
      ...pagination,
    };
  }
}
