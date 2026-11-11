import { DomainError } from '../../../common/errors/domain.error';

/** A material that already has a PROGRAMADA appointment on a day (HU-20). */
export interface BookedMaterial {
  catalogCode: string;
  title: string;
  // UTC midnight of the day
  date: Date;
  // The request that holds the day; left out when the appointment that won
  // the race in the database is no longer visible
  trackingCode?: string;
}

// The day is stored as UTC midnight, so it is formatted in UTC
const DAY_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * The material already has a cita on that day, so it cannot be booked again
 * (HU-20). The message names the material, the day and the request that
 * holds it: the concrete conflict the staff needs to see.
 */
export class MaterialAlreadyBookedError extends DomainError {
  readonly code = 'MATERIAL_ALREADY_BOOKED';

  constructor(materials: BookedMaterial[]) {
    super(
      materials
        .map(
          (material) =>
            `El material «${material.title}» (${material.catalogCode}) ya tiene ` +
            `cita el ${DAY_FORMAT.format(material.date)}` +
            (material.trackingCode
              ? ` (solicitud ${material.trackingCode}).`
              : '.'),
        )
        .join(' '),
    );
  }
}
