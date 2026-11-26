import type { RequestStatus } from '../../domain/enums/request-status';
import { canResolveReferences } from '../../domain/policies/reference-resolution';
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
    rules: {
      allowedTransitions: RequestStatus[];
      commentRequiredFor: RequestStatus[];
    },
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
      allowedTransitions: rules.allowedTransitions,
      commentRequiredFor: rules.commentRequiredFor,
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
      materials: detail.materials.map((material) => ({
        id: material.id,
        catalogCode: material.catalogCode,
        title: material.title,
        materialType: material.materialType,
        author: material.author,
        collection: material.collection,
        status: material.status,
        itemStatus: material.itemStatus,
        hasDigitalCopy: material.hasDigitalCopy,
        digitalFolderName: material.digitalFolderName,
        needsReview: material.needsReview,
        reviewReason: material.reviewReason,
      })),
      references: detail.references.map((reference) =>
        RequestReferenceResponseMapper.toDto(reference, detail.status),
      ),
      canResolveReferences: canResolveReferences(detail.status),
      activeAppointment,
    };
  }
}
