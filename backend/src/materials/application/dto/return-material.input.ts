/** Input to register the return of an in-use material (HU-72). */
export interface ReturnMaterialInput {
  materialId: string;
  userId: string;
  notes?: string;
}
