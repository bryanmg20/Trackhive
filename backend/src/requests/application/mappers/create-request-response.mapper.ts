import type { Request } from '../../domain/entities/request.entity';
import { CreateRequestResponseDto } from '../dto/create-request-response.dto';

/** A request just created → the response with its tracking code (HU-09). */
export class CreateRequestResponseMapper {
  static toDto(request: Request): CreateRequestResponseDto {
    if (!request.registration || request.status !== 'RECIBIDA') {
      throw new Error(`Request ${request.id} is not a new request`);
    }
    return {
      id: request.id,
      trackingCode: request.registration.trackingCode,
      status: request.status,
    };
  }
}
