import type { SavedStatusChange } from './saved-status-change';

/** An appointment as it was saved (HU-18), with the names to show. */
export interface SavedAppointment {
  readonly id: string;
  // UTC midnight of the day
  readonly date: Date;
  readonly status: 'PROGRAMADA';
  readonly requester: {
    readonly id: string;
    readonly firstName: string;
    readonly middleName: string | null;
    readonly lastName: string;
    readonly secondLastName: string | null;
  };
  readonly materials: { id: string; catalogCode: string; title: string }[];
  readonly statusChange: SavedStatusChange;
}
