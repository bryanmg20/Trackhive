import {
  isNotificationTemplate,
  NOTIFICATION_TEMPLATES,
} from './notification-template';

describe('notification-template (HU-24)', () => {
  it('defines a template for every request status and appointment change within VARCHAR(25)', () => {
    expect(NOTIFICATION_TEMPLATES).toEqual(
      expect.arrayContaining([
        'SOLICITUD_RECIBIDA',
        'SOLICITUD_EN_BUSQUEDA',
        'SOLICITUD_DISPONIBLE',
        'SOLICITUD_AGENDADA',
        'SOLICITUD_ATENDIDA',
        'SOLICITUD_CERRADA',
        'SOLICITUD_RECHAZADA',
        'CITA_REPROGRAMADA',
        'CITA_CANCELADA',
      ]),
    );
    for (const template of NOTIFICATION_TEMPLATES) {
      expect(template.length).toBeLessThanOrEqual(25);
    }
  });

  it('validates known and unknown template values', () => {
    expect(isNotificationTemplate('SOLICITUD_DISPONIBLE')).toBe(true);
    expect(isNotificationTemplate('CITA_REPROGRAMADA')).toBe(true);
    expect(isNotificationTemplate('CAMBIO_ESTADO')).toBe(false);
    expect(isNotificationTemplate('DESCONOCIDA')).toBe(false);
  });
});
