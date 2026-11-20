import type { RequestStatus } from '../../domain/enums/request-status';
import { toAppointmentDay } from '../../domain/value-objects/appointment-date';
import { RequestDetailResponseDto } from '../dto/request-detail-response.dto';
import type { RequestDetail } from '../ports/request-query.port';
import { AppointmentListResponseMapper } from './appointment-list-response.mapper';
import { DateOnlyMapper } from './date-only.mapper';
import { PersonNameMapper } from './person-name.mapper';
import { RequestReferenceResponseMapper } from './request-reference-response.mapper';

/** The detail of a request (HU-13) → its response. */
export class RequestDetailResponseMapper {
  static toDto(
    detail: RequestDetail,
    allowedTransitions: RequestStatus[],
  ): RequestDetailResponseDto {
    const { requester } = detail;
    const activeAppointment = detail.activeAppointment
      ? (() => {
          const date = DateOnlyMapper.toDto(
            detail.activeAppointment.appointmentDate,
          );
          const { serviceHours } = toAppointmentDay(date);
          return {
            id: detail.activeAppointment.id,
            date,
            serviceHours,
            status: detail.activeAppointment.status,
            materials: detail.activeAppointment.materials.map((material) => ({
              id: material.id,
              catalogCode: material.catalogCode,
              title: material.title,
              status: material.status,
              activeLoan: AppointmentListResponseMapper.toLoanDto(
                material.activeLoan,
              ),
              lastLoan: AppointmentListResponseMapper.toLoanDto(
                material.lastLoan,
              ),
            })),
          };
        })()
      : null;

    return {
      id: detail.id,
      trackingCode: detail.trackingCode,
      status: detail.status,
      allowedTransitions,
      deliveryMode: detail.deliveryMode,
      originChannel: detail.originChannel,
      reason: detail.reason,
      requirementDescription: detail.requirementDescription,
      desiredDate: DateOnlyMapper.toDto(detail.desiredDate),
      committedDate: detail.committedDate
        ? DateOnlyMapper.toDto(detail.committedDate)
        : null,
      registeredAt: detail.registeredAt.toISOString(),
      rejectionReason: detail.rejectionReason,
      requester: {
        name: PersonNameMapper.fullName(requester),
        email: requester.email,
        phone: requester.phone,
        requesterType: requester.requesterType,
        institution: requester.institution,
        documentType: requester.documentType,
        documentNumber: requester.documentNumber,
      },
      materials: detail.materials,
      references: detail.references.map((reference) =>
        RequestReferenceResponseMapper.toDto(reference),
      ),
      activeAppointment,
    };
  }
}
