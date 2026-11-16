import type { Prisma } from '@prisma/client';
import { Requester } from '../../domain/entities/requester.entity';

/** A row of the requesters table. */
export interface RequesterRow {
  id: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string | null;
  phone: string | null;
  requesterType: string;
  institution: string | null;
  documentType: string | null;
  documentNumber: string | null;
  acceptsDataProcessing: boolean;
  consentedAt: Date;
  privacyPolicyVersion: string;
}

/** Translates between the Requester entity and the requesters table. */
export class PrismaRequesterMapper {
  static toDomain(model: RequesterRow): Requester {
    return new Requester({
      id: model.id,
      userId: model.userId,
      firstName: model.firstName,
      middleName: model.middleName,
      lastName: model.lastName,
      secondLastName: model.secondLastName,
      email: model.email,
      phone: model.phone,
      requesterType: model.requesterType,
      institution: model.institution,
      documentType: model.documentType,
      documentNumber: model.documentNumber,
      acceptsDataProcessing: model.acceptsDataProcessing,
      consentedAt: model.consentedAt,
      privacyPolicyVersion: model.privacyPolicyVersion,
    });
  }

  static toPersistence(
    requester: Requester,
  ): Prisma.RequesterModelUncheckedCreateInput {
    return { ...requester.props };
  }
}
