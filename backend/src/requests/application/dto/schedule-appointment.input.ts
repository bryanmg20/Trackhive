/** «Agendar cita» (HU-18). */
export interface ScheduleAppointmentInput {
  requestId: string;
  // YYYY-MM-DD
  date: string;
  // Who schedules it: always the user of the access token
  userId: string;
}
