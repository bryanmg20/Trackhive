import { REQUEST_STATUS_LABELS } from '../../domain/enums/request-status';
import type { MostRequestedMaterialsResponseDto } from '../dto/most-requested-materials-response.dto';
import type { AttentionTimesResponseDto } from '../dto/attention-times-response.dto';
import type { ReportCsvResponseDto } from '../dto/report-csv-response.dto';
import { toCsv } from './csv';

export class ReportCsvMapper {
  static ranking(
    report: MostRequestedMaterialsResponseDto,
    limit: number,
  ): ReportCsvResponseDto {
    return {
      fileName: `material-mas-solicitado_${report.from ?? 'inicio'}_${report.to ?? 'actual'}_top-${limit}.csv`,
      content: toCsv([
        [
          'Radicadas desde',
          'Radicadas hasta',
          'Total solicitudes del periodo',
          'Puesto',
          'Código',
          'Material',
          'Tipo',
          'Solicitudes',
        ],
        ...report.items.map((item) => [
          report.from,
          report.to,
          report.totalRequests,
          item.rank,
          item.catalogCode,
          item.title,
          item.materialType,
          item.requestCount,
        ]),
      ]),
    };
  }

  static attention(report: AttentionTimesResponseDto): ReportCsvResponseDto {
    return {
      fileName: `tiempos-de-atencion_${report.from ?? 'inicio'}_${report.to ?? 'actual'}.csv`,
      content: toCsv([
        [
          'Radicadas desde',
          'Radicadas hasta',
          'Indicador',
          'Estado',
          'Solicitudes consideradas',
          'Promedio (segundos)',
        ],
        [
          report.from,
          report.to,
          'Total',
          'Recibida → Atendida',
          report.completedRequests,
          report.averageSeconds,
        ],
        ...report.states.map((item) => [
          report.from,
          report.to,
          'Por estado',
          REQUEST_STATUS_LABELS[item.state],
          item.requestCount,
          item.averageSeconds,
        ]),
      ]),
    };
  }
}
