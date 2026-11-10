import { toAppointmentDay } from './appointment-date';
import { InvalidAppointmentDateError } from './errors/invalid-appointment-date.error';

describe('toAppointmentDay (HU-18)', () => {
  it.each([
    ['2026-11-16', 'lunes'],
    ['2026-11-18', 'miércoles'],
    ['2026-11-20', 'viernes'],
  ])('gives the 8:00-17:00 service hours to %s (%s)', (value) => {
    expect(toAppointmentDay(value)).toEqual({
      date: new Date(`${value}T00:00:00.000Z`),
      serviceHours: { opensAt: '08:00', closesAt: '17:00' },
    });
  });

  it('gives the 9:00-13:00 service hours to a Saturday', () => {
    expect(toAppointmentDay('2026-11-21').serviceHours).toEqual({
      opensAt: '09:00',
      closesAt: '13:00',
    });
  });

  it('rejects a Sunday because the CLENA does not attend that day', () => {
    expect(() => toAppointmentDay('2026-11-22')).toThrow(
      new InvalidAppointmentDateError(
        'El CLENA no atiende los domingos. Elija una fecha de lunes a sábado.',
      ),
    );
  });

  it.each(['', '2026-11-31', '2026-02-29', '16/11/2026', '2026-11-16T10:00'])(
    'rejects %j as an invalid date',
    (value) => {
      expect(() => toAppointmentDay(value)).toThrow(
        'La fecha de la cita no tiene un formato válido.',
      );
    },
  );
});
