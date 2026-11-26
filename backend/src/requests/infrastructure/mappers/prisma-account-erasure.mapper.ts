import type { NotificationModel, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { escapeHtml } from '../../../common/html/escape-html';
const REDACTED_COMMENT = '[Comentario del personal suprimido]';
/** Scrub payloads preserve technical relationships, never the former identity. */
export class PrismaAccountErasureMapper {
  /** Prefer known slots, then redact remaining copies even in older/newer templates. */
  static notification(
    row: { body: string; htmlBody: string | null },
    comment: string,
  ): Pick<NotificationModel, 'body' | 'htmlBody'> {
    if (!comment.trim()) return { body: row.body, htmlBody: row.htmlBody };
    const replacement = REDACTED_COMMENT;
    const htmlComment = escapeHtml(comment).replace(/\r?\n/g, '<br>');
    const body = row.body
      .replace(
        `Observaciones del personal:\n${comment}`,
        `Observaciones del personal:\n${replacement}`,
      )
      .replace(
        `Motivo del rechazo: ${comment}`,
        `Motivo del rechazo: ${replacement}`,
      );
    const htmlBody =
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
            );
    return {
      body: this.redactRemaining(body, [comment]),
      htmlBody:
        htmlBody === null
          ? null
          : this.redactRemaining(htmlBody, [
              htmlComment,
              escapeHtml(comment),
              comment,
            ]),
    };
  }
  private static redactRemaining(
    value: string,
    variants: readonly string[],
  ): string {
    let result = value;
    for (const variant of new Set(variants)) {
      if (!variant) continue;
      // A comment can itself quote the marker; replace the whole comment first.
      if (variant.includes(REDACTED_COMMENT)) {
        result = result.replaceAll(variant, REDACTED_COMMENT);
        continue;
      }
      // Never process a marker inserted by an earlier replacement.
      result = result
        .split(REDACTED_COMMENT)
        .map((part) => part.replaceAll(variant, REDACTED_COMMENT))
        .join(REDACTED_COMMENT);
    }
    return result;
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
