/** «Asociar material» to a pending written reference (HU-09.2). */
export interface ResolveReferenceInput {
  requestId: string;
  referenceId: string;
  materialId: string;
  // The staff member of the access token
  userId: string;
}
