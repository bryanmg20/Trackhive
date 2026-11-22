export interface ExportReportInput {
  report: 'most-requested-materials' | 'attention-times';
  from?: string;
  to?: string;
  limit?: number;
}
