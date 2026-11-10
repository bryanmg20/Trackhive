import type { RequesterProfile } from '../ports/request.repository.port';
import { RequesterResponseDto } from '../dto/requester-response.dto';

export class RequesterResponseMapper {
  static toDto(profile: RequesterProfile): RequesterResponseDto {
    return {
      requesterId: profile.requesterId,
      userId: profile.userId,
      firstName: profile.firstName,
      middleName: profile.middleName,
      lastName: profile.lastName,
      secondLastName: profile.secondLastName,
      email: profile.email,
      phone: profile.phone,
      requesterType: profile.requesterType,
      institution: profile.institution,
      documentType: profile.documentType,
      documentNumber: profile.documentNumber,
      foundIn: profile.foundIn,
    };
  }
}
