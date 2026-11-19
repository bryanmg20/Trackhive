import { MaterialLoanResponseDto } from '../../../materials/application/dto/material-loan-response.dto';
import { MaterialLoanResponseMapper } from '../../../materials/application/mappers/material-loan-response.mapper';
import type { MaterialLoanRecord } from '../../../materials/domain/repositories/material-loan.repository';

/** Delegates mapping of a delivered material loan to the materials mapper (R6). */
export class DeliverMaterialResponseMapper {
  static toDto(record: MaterialLoanRecord): MaterialLoanResponseDto {
    return MaterialLoanResponseMapper.toDto(record);
  }
}
