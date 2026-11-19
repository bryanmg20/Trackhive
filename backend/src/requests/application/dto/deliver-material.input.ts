/** Input to hand over an appointment material to the requester (HU-72). */
export interface DeliverMaterialInput {
  appointmentId: string;
  materialId: string;
  userId: string;
  notes?: string;
}
