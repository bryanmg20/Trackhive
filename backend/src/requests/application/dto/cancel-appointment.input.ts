export interface CancelAppointmentInput {
  appointmentId: string;
  comment?: string;
  // The staff member from the token (HU-04)
  userId: string;
}
