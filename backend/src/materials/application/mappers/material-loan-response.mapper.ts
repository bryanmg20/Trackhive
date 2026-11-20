import { Material } from '../../domain/entities/material.entity';
import type {
  MaterialLoanHistoryResult,
  MaterialLoanRecord,
} from '../../domain/repositories/material-loan.repository';
import { MaterialHistoryResponseDto } from '../dto/material-history-response.dto';
import { MaterialLoanResponseDto } from '../dto/material-loan-response.dto';

export class MaterialLoanResponseMapper {
  static toDto(record: MaterialLoanRecord): MaterialLoanResponseDto {
    return {
      id: record.id,
      materialId: record.materialId,
      materialCatalogCode: record.materialCatalogCode,
      materialTitle: record.materialTitle,
      materialStatus: record.materialStatus,
      appointment: {
        id: record.appointment.id,
        date: record.appointment.date.toISOString().slice(0, 10),
        requestId: record.appointment.requestId,
        trackingCode: record.appointment.trackingCode,
      },
      requester: {
        id: record.requester.id,
        name: record.requester.name,
      },
      handedOverAt: record.handedOverAt.toISOString(),
      handedOverBy: {
        id: record.handedOverBy.id,
        name: record.handedOverBy.name,
      },
      deliveryNotes: record.deliveryNotes,
      returnedAt: record.returnedAt ? record.returnedAt.toISOString() : null,
      returnedBy: record.returnedBy
        ? { id: record.returnedBy.id, name: record.returnedBy.name }
        : null,
      returnNotes: record.returnNotes,
    };
  }

  static toHistoryDto(
    material: Material,
    history: MaterialLoanHistoryResult,
    page: number,
    limit: number,
  ): MaterialHistoryResponseDto {
    return {
      material: {
        id: material.id,
        catalogCode: material.catalogCode,
        title: material.title,
        status: material.status,
      },
      lastLoan: history.lastLoan
        ? MaterialLoanResponseMapper.toDto(history.lastLoan)
        : null,
      items: history.items.map((item) =>
        MaterialLoanResponseMapper.toDto(item),
      ),
      page,
      limit,
      total: history.total,
    };
  }
}
