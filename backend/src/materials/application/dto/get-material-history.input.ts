/** Input to query the custody history of a material (HU-72). */
export interface GetMaterialHistoryInput {
  materialId: string;
  page?: number;
  limit?: number;
}
