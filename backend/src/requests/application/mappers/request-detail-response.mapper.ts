import type { RequestStatus } from '../../domain/enums/request-status';
import { RequestDetailResponseDto } from '../dto/request-detail-response.dto';
import type { RequestDetail } from '../ports/request-query.port';
import { DateOnlyMapper } from './date-only.mapper';
import { PersonNameMapper } from './person-name.mapper';

/** The detail of a request (HU-13) → its response. */
export class RequestDetailResponseMapper {
  static toDto(
    detail: RequestDetail,
    allowedTransitions: RequestStatus[],
  ): RequestDetailResponseDto {
    const { requester } = detail;
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
    };
  }
}
