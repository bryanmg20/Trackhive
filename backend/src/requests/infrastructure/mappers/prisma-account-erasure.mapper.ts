import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { escapeHtml } from '../../../common/html/escape-html';
/** Scrub payloads preserve technical relationships, never the former identity. */
export class PrismaAccountErasureMapper {
  /** Replace only the known staff-comment slots; keep the citizen's mail intact. */
  static notification(
    row: { body: string; htmlBody: string | null },
    comment: string,
  ): Prisma.NotificationModelUpdateInput {
    const replacement = '[Comentario del personal suprimido]';
    const htmlComment = escapeHtml(comment).replace(/\r?\n/g, '<br>');
    return {
      body: row.body
        .replace(
          `Observaciones del personal:\n${comment}`,
          `Observaciones del personal:\n${replacement}`,
        )
        .replace(
          `Motivo del rechazo: ${comment}`,
          `Motivo del rechazo: ${replacement}`,
        ),
      htmlBody:
        row.htmlBody === null
          ? null
          : row.htmlBody
              .replace(
                `<p style="margin:0;color:#1e293b;">${htmlComment}</p>`,
                `<p style="margin:0;color:#1e293b;">${replacement}</p>`,
              )
              .replace(
                `Motivo del rechazo: <strong>${htmlComment}</strong>`,
                `Motivo del rechazo: <strong>${replacement}</strong>`,
              ),
    };
  }
  static user(now: Date): Prisma.UserModelUpdateInput {
    return {
      firstName: 'Persona',
      lastName: 'anonimizada',
      middleName: null,
      secondLastName: null,
      email: `deleted-${randomUUID()}@anon.invalid`,
      passwordHash: 'ACCOUNT_DELETED',
      active: false,
      privacyPolicyAcceptedAt: null,
      privacyPolicyVersion: null,
      lastLoginAt: null,
      deletedAt: now,
    };
  }
  static requester(now: Date): Prisma.RequesterModelUpdateManyMutationInput {
    return {
      firstName: 'Persona',
      lastName: 'anonimizada',
      middleName: null,
      secondLastName: null,
      email: null,
      phone: null,
      documentType: null,
      documentNumber: null,
      institution: null,
      requesterType: 'CIUDADANO',
      municipality: null,
      ageRange: null,
      populationGroup: null,
      acceptsDataProcessing: false,
      privacyPolicyVersion: 'suprimido',
      anonymizedAt: now,
    };
  }
  static history(): Prisma.StatusHistoryModelUpdateManyMutationInput {
    return { comment: null };
  }
  static item(): Prisma.RequestItemModelUpdateManyMutationInput {
    return { note: null };
  }
  static textReference(): Prisma.RequestReferenceModelUpdateManyMutationInput {
    return { description: 'Referencia anonimizada' };
  }
  static notarialReference(): Prisma.RequestReferenceModelUpdateManyMutationInput {
    return { notary: 'Referencia anonimizada', deedNumber: 'Suprimido' };
  }
  static loan(): Prisma.MaterialLoanModelUpdateManyMutationInput {
    return { deliveryNotes: null, returnNotes: null };
  }
  static request(): Prisma.RequestModelUpdateManyMutationInput {
    return { reason: null, requirementDescription: '', notes: null };
  }
  static rejection(): Prisma.RequestModelUpdateManyMutationInput {
    return { rejectionReason: 'Datos personales suprimidos' };
  }
}
