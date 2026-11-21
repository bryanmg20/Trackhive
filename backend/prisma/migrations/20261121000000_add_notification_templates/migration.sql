-- HU-24: per-status and appointment-event email templates in notifications.
-- Keeps CAMBIO_ESTADO so rows queued under HU-23 remain valid.
ALTER TABLE "notifications"
  DROP CONSTRAINT "notifications_template_check";

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_template_check"
  CHECK (
    "template" IN (
      'CAMBIO_ESTADO',
      'SOLICITUD_RECIBIDA',
      'SOLICITUD_EN_BUSQUEDA',
      'SOLICITUD_DISPONIBLE',
      'SOLICITUD_AGENDADA',
      'SOLICITUD_ATENDIDA',
      'SOLICITUD_CERRADA',
      'SOLICITUD_RECHAZADA',
      'CITA_REPROGRAMADA',
      'CITA_CANCELADA'
    )
  );
