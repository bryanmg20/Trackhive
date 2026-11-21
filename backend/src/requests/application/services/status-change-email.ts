import { escapeHtml } from '../../../common/html/escape-html';
import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import type { RequestNotificationContext } from '../ports/request-query.port';
import {
  resolveRequestEmailTemplate,
  type StatusChangeEmailDetails,
} from './email-templates';

export type {
  AppointmentEmailEvent,
  StatusChangeEmailDetails,
} from './email-templates';

const ACCOUNT_HINT =
  'Si tiene una cuenta en Trackhive, también puede ver sus solicitudes en ' +
  '«Mis solicitudes».';
const SIGNATURE =
  'Este correo se envió automáticamente desde Trackhive, el sistema de ' +
  'solicitudes del CLENA.';

/**
 * Builds the email sent when a request changes status or its appointment is
 * rescheduled or cancelled (HU-23, HU-24). Returns null when the requester
 * has no email address.
 */
export function buildStatusChangeEmail(
  context: RequestNotificationContext,
  details: StatusChangeEmailDetails,
): NotificationDraft | null {
  const recipientEmail = context.requester.email?.trim();
  if (!recipientEmail) {
    return null;
  }

  const { template, subject, heading, intro, facts } =
    resolveRequestEmailTemplate(context, details);
  const trimmedComment = details.comment?.trim() || null;
  const trimmedReason = details.rejectionReason?.trim() || null;
  // On RECHAZADA, the reason is already shown under «Motivo del rechazo»
  const staffComment =
    trimmedComment && trimmedComment !== trimmedReason ? trimmedComment : null;

  // Like the test email: first name and first last name (HU-22)
  const name = `${context.requester.firstName} ${context.requester.lastName}`;
  const materials = [
    ...context.materials.map(
      ({ catalogCode, title }) => `${catalogCode} · ${title}`,
    ),
    ...context.references,
  ];

  const text = buildPlainText(name, intro, facts, staffComment, materials);
  const html = buildHtml(heading, name, intro, facts, staffComment, materials);

  return {
    recipientEmail,
    template,
    subject,
    text,
    html,
  };
}

function buildPlainText(
  name: string,
  intro: string,
  facts: readonly (readonly [string, string])[],
  staffComment: string | null,
  materials: readonly string[],
): string {
  const sections: string[] = [
    `Hola, ${name}:`,
    intro,
    facts.map(([label, value]) => `${label}: ${value}`).join('\n'),
  ];

  if (staffComment) {
    sections.push(`Observaciones del personal:\n${staffComment}`);
  }

  if (materials.length > 0) {
    sections.push(
      ['Material solicitado:', ...materials.map((item) => `- ${item}`)].join(
        '\n',
      ),
    );
  }

  sections.push(ACCOUNT_HINT, SIGNATURE);
  return sections.join('\n\n');
}

function buildHtml(
  heading: string,
  name: string,
  intro: string,
  facts: readonly (readonly [string, string])[],
  staffComment: string | null,
  materials: readonly string[],
): string {
  const factsHtml = facts
    .map(
      ([label, value]) => `${toHtml(label)}: <strong>${toHtml(value)}</strong>`,
    )
    .join('<br>');

  // Every value can come from a person (names, titles, references, notes): escaped
  const sections: string[] = [
    '<div style="background-color:#f8fafc;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">',
    '<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">',
    '<div style="background-color:#0f172a;padding:20px 24px;color:#ffffff;">',
    '<p style="margin:0 0 4px;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;color:#cbd5e1;">CLENA · Trackhive</p>',
    `<h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:600;color:#ffffff;">${toHtml(heading)}</h1>`,
    '</div>',
    '<div style="padding:24px;">',
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hola, ${toHtml(name)}:</p>`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${toHtml(intro)}</p>`,
    `<div style="margin:0 0 16px;padding:12px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;line-height:1.6;">${factsHtml}</div>`,
  ];

  if (staffComment) {
    sections.push(
      '<div style="margin:0 0 16px;padding:12px 16px;background-color:#eff6ff;border-left:4px solid #2563eb;border-radius:4px;font-size:14px;line-height:1.5;">',
      '<p style="margin:0 0 4px;font-weight:600;color:#1e3a8a;">Observaciones del personal:</p>',
      `<p style="margin:0;color:#1e293b;">${toHtml(staffComment)}</p>`,
      '</div>',
    );
  }

  if (materials.length > 0) {
    const itemsHtml = materials
      .map((material) => `<li>${toHtml(material)}</li>`)
      .join('');
    sections.push(
      '<p style="margin:0 0 8px;font-size:14px;font-weight:600;line-height:1.5;">Material solicitado:</p>',
      `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6;">${itemsHtml}</ul>`,
    );
  }

  sections.push(
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">',
    `<p style="margin:0 0 8px;color:#475569;font-size:12px;line-height:1.5;"><small>${ACCOUNT_HINT}</small></p>`,
    `<p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;"><small>${SIGNATURE}</small></p>`,
    '</div>',
    '</div>',
    '</div>',
  );

  return sections.join('\n');
}

function toHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}
