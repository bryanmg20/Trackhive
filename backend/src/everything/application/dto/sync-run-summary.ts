/** What a run closed complete did to the catalog (HU-137). */
export interface SyncRunSummary {
  // Leaf folders under the roots of the funds: one material each
  leaves: number;
  created: number;
  updated: number;
  // Everything materials it did not see: «copia digital no encontrada»
  notFound: number;
  // Leaves without a valid code of their own, or with a repeated one
  forReview: number;
}
