import { Inject, Injectable } from '@nestjs/common';
import { Request } from '../../domain/entities/request.entity';
import { RequestNotFoundError } from '../../domain/errors/request-not-found.error';
import { RequestDetailResponseDto } from '../dto/request-detail-response.dto';
import type { RequestRepository } from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';

// Date-only column: send YYYY-MM-DD, without time or time zone
const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

@Injectable()
export class GetRequestDetailUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(id: string): Promise<RequestDetailResponseDto> {
    const detail = await this.repository.findById(id);
    if (!detail) {
      throw new RequestNotFoundError();
    }

    // The screen offers only these transitions (HU-15): the rule stays in the
    // entity instead of being repeated in React
    const { allowedTransitions } = new Request({
      id: detail.id,
      status: detail.status,
      deliveryMode: detail.deliveryMode,
      rejectionReason: detail.rejectionReason,
    });

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
      desiredDate: toDateOnly(detail.desiredDate),
      committedDate: detail.committedDate
        ? toDateOnly(detail.committedDate)
        : null,
      registeredAt: detail.registeredAt.toISOString(),
      rejectionReason: detail.rejectionReason,
      requester: {
        name: [
          requester.firstName,
          requester.middleName,
          requester.lastName,
          requester.secondLastName,
        ]
          .filter(Boolean)
          .join(' '),
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
