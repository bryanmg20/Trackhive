import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreatedRequest,
  RequestRepository,
} from '../../application/ports/request.repository.port';
import type { CreateRequestInput } from '../../application/use-cases/create-request.use-case';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';

@Injectable()
export class PrismaRequestRepository implements RequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateRequestInput & { createdById: string },
  ): Promise<CreatedRequest> {
    const user = await this.prisma.userModel.findUniqueOrThrow({
      where: { id: input.createdById },
    });
    const names = user.fullName.trim().split(/\s+/);
    const firstNames = names.slice(0, Math.ceil(names.length / 2)).join(' ');
    const lastNames = names.slice(Math.ceil(names.length / 2)).join(' ');

    let requester = await this.prisma.requesterModel.findUnique({
      where: { userId: input.createdById },
    });
    if (!requester) {
      requester = await this.prisma.requesterModel.create({
        data: {
          id: randomUUID(),
          userId: input.createdById,
          firstNames,
          lastNames: lastNames || firstNames,
          email: user.email,
          requesterType: 'INVESTIGADOR',
          acceptsDataProcessing: true,
          consentedAt: new Date(),
          privacyPolicyVersion: '1.0',
        },
      });
    }

    const materialIds = [...new Set(input.materialIds)];
    const existingMaterials = await this.prisma.materialModel.findMany({
      where: { id: { in: materialIds } },
      select: { id: true },
    });
    if (existingMaterials.length !== materialIds.length) {
      throw new RequestMaterialNotFoundError();
    }

    const trackingCode = await this.nextTrackingCode();
    const created = await this.prisma.requestModel.create({
      data: {
        id: randomUUID(),
        trackingCode,
        requesterId: requester.id,
        createdById: input.createdById,
        requestType: 'CONSULTA_SALA',
        originChannel: 'WEB',
        deliveryMode: input.deliveryMode,
        purpose: 'INVESTIGACION',
        reason: input.reason,
        requirementDescription: input.requirementDescription ?? input.reason,
        desiredDate: new Date(`${input.desiredDate}T00:00:00.000Z`),
        status: 'RECIBIDA',
        items: {
          create: materialIds.map((materialId) => ({
            id: randomUUID(),
            materialId,
            itemStatus: 'PENDIENTE',
            accessType: 'FISICO',
          })),
        },
      },
    });

    return {
      id: created.id,
      trackingCode: created.trackingCode,
      status: 'RECIBIDA',
    };
  }

  private async nextTrackingCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const count = await this.prisma.requestModel.count({
      where: { trackingCode: { startsWith: `SOL-${year}-` } },
    });
    return `SOL-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
