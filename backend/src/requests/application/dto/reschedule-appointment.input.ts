export interface RescheduleAppointmentInput {
  appointmentId: string;
  // YYYY-MM-DD, without a time
  date: string;
  comment?: string;
  // The staff member from the token (HU-04)
  userId: string;
}
