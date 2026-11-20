import { toAppointmentDay } from '../../domain/value-objects/appointment-date';
import {
  AppointmentListItemDto,
  AppointmentMaterialLoanDto,
  PaginatedAppointmentsResponseDto,
} from '../dto/appointment-list-response.dto';
import type {
  AppointmentListItem,
  AppointmentMaterialLoanSummary,
} from '../ports/request-query.port';
import { DateOnlyMapper } from './date-only.mapper';
import { PersonNameMapper } from './person-name.mapper';

/** A row of the calendar (HU-19) → its response. */
export class AppointmentListResponseMapper {
  static toLoanDto(
    loan: AppointmentMaterialLoanSummary | null | undefined,
  ): AppointmentMaterialLoanDto | null {
    if (!loan) {
      return null;
    }
    return {
      id: loan.id,
      handedOverAt: loan.handedOverAt.toISOString(),
      handedOverBy: {
        id: loan.handedOverBy.id,
        name: PersonNameMapper.fullName(loan.handedOverBy),
      },
      deliveryNotes: loan.deliveryNotes,
      returnedAt: loan.returnedAt ? loan.returnedAt.toISOString() : null,
      returnedBy: loan.returnedBy
        ? {
            id: loan.returnedBy.id,
            name: PersonNameMapper.fullName(loan.returnedBy),
          }
        : null,
      returnNotes: loan.returnNotes,
    };
  }

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
        status: material.status ?? 'DISPONIBLE',
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
        activeLoan: AppointmentListResponseMapper.toLoanDto(
          material.activeLoan,
        ),
        lastLoan: AppointmentListResponseMapper.toLoanDto(material.lastLoan),
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
