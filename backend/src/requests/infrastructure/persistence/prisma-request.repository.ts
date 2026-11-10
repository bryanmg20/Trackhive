import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreatedRequest,
  RequesterProfile,
  RequestRepository,
} from '../../application/ports/request.repository.port';
import type { CreateRequestInput } from '../../application/use-cases/create-request.use-case';
import type {
  CreateRequestOnBehalfInput,
  RequesterInput,
} from '../../application/use-cases/create-request-on-behalf.use-case';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';
import { RequesterEmailMismatchError } from '../../domain/errors/requester-email-mismatch.error';
import { RequesterNameRequiredError } from '../../domain/errors/requester-name-required.error';
import { RequesterUserNotFoundError } from '../../domain/errors/requester-user-not-found.error';

type UserModel = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
};

type RequesterModel = {
  id: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string | null;
  phone: string | null;
  requesterType: string;
  institution: string | null;
  documentType: string | null;
  documentNumber: string | null;
};

@Injectable()
export class PrismaRequestRepository implements RequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateRequestInput & { createdById: string },
  ): Promise<CreatedRequest> {
    const user = await this.prisma.userModel.findUniqueOrThrow({
      where: { id: input.createdById },
    });
    let requester = await this.prisma.requesterModel.findUnique({
      where: { userId: input.createdById },
    });
    if (!requester) {
      requester = await this.prisma.requesterModel.create({
        data: this.requesterDataFromUser(user),
      });
    }

    const materialIds = await this.assertMaterialsExist(input.materialIds);
    return this.persistRequest(
      input,
      requester.id,
      materialIds,
      'WEB',
      input.createdById,
    );
  }

  async createOnBehalf(
    input: CreateRequestOnBehalfInput & { createdById: string },
  ): Promise<CreatedRequest> {
    const materialIds = await this.assertMaterialsExist(input.materialIds);
    const requester = await this.resolveRequester(input.requester);
    return this.persistRequest(
      input,
      requester.id,
      materialIds,
      'PRESENCIAL',
      input.createdById,
    );
  }

  async findRequesterByEmail(email: string): Promise<RequesterProfile | null> {
    const requester = await this.prisma.requesterModel.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
    if (requester) {
      return this.toRequesterProfile(requester, 'REQUESTER');
    }

    const user = await this.prisma.userModel.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    return user ? this.toUserProfile(user) : null;
  }

  private async resolveRequester(
    input: RequesterInput,
  ): Promise<RequesterModel> {
    const email = input.email.trim().toLowerCase();

    if (input.userId) {
      const user = await this.prisma.userModel.findUnique({
        where: { id: input.userId },
      });
      if (!user) {
        throw new RequesterUserNotFoundError();
      }
      if (user.email.trim().toLowerCase() !== email) {
        throw new RequesterEmailMismatchError();
      }

      const existing = await this.prisma.requesterModel.findUnique({
        where: { userId: user.id },
      });
      return (
        existing ??
        (await this.prisma.requesterModel.create({
          data: this.requesterDataFromUser(user),
        }))
      );
    }

    const existing = await this.prisma.requesterModel.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return existing;
    }

    const user = await this.prisma.userModel.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (user) {
      const linked = await this.prisma.requesterModel.findUnique({
        where: { userId: user.id },
      });
      return (
        linked ??
        (await this.prisma.requesterModel.create({
          data: this.requesterDataFromUser(user),
        }))
      );
    }

    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();
    if (!firstName || !lastName) {
      throw new RequesterNameRequiredError();
    }

    return this.prisma.requesterModel.create({
      data: {
        id: randomUUID(),
        userId: null,
        firstName,
        middleName: input.middleName?.trim() || null,
        lastName,
        secondLastName: input.secondLastName?.trim() || null,
        email,
        phone: input.phone?.trim() || null,
        requesterType: input.requesterType ?? 'CIUDADANO',
        institution: input.institution?.trim() || null,
        documentType: input.documentType ?? null,
        documentNumber: input.documentNumber?.trim() || null,
        acceptsDataProcessing: true,
        consentedAt: new Date(),
        privacyPolicyVersion: '1.0',
      },
    });
  }

  private requesterDataFromUser(user: UserModel) {
    return {
      id: randomUUID(),
      userId: user.id,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      secondLastName: user.secondLastName,
      email: user.email.trim().toLowerCase(),
      phone: null,
      requesterType: 'INVESTIGADOR',
      institution: null,
      documentType: null,
      documentNumber: null,
      acceptsDataProcessing: true,
      consentedAt: new Date(),
      privacyPolicyVersion: '1.0',
    };
  }

  private toRequesterProfile(
    requester: RequesterModel,
    foundIn: 'REQUESTER',
  ): RequesterProfile {
    return {
      requesterId: requester.id,
      userId: requester.userId,
      firstName: requester.firstName,
      middleName: requester.middleName,
      lastName: requester.lastName,
      secondLastName: requester.secondLastName,
      email: requester.email ?? '',
      phone: requester.phone,
      requesterType: requester.requesterType,
      institution: requester.institution,
      documentType: requester.documentType,
      documentNumber: requester.documentNumber,
      foundIn,
    };
  }

  private toUserProfile(user: UserModel): RequesterProfile {
    return {
      requesterId: null,
      userId: user.id,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      secondLastName: user.secondLastName,
      email: user.email.trim().toLowerCase(),
      phone: null,
      requesterType: null,
      institution: null,
      documentType: null,
      documentNumber: null,
      foundIn: 'USER',
    };
  }

  private async assertMaterialsExist(materialIds: string[]): Promise<string[]> {
    const uniqueIds = [...new Set(materialIds)];
    const existingMaterials = await this.prisma.materialModel.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (existingMaterials.length !== uniqueIds.length) {
      throw new RequestMaterialNotFoundError();
    }
    return uniqueIds;
  }

  private async persistRequest(
    input: CreateRequestInput,
    requesterId: string,
    materialIds: string[],
    originChannel: 'WEB' | 'PRESENCIAL',
    createdById: string,
  ): Promise<CreatedRequest> {
    const trackingCode = await this.nextTrackingCode();
    const created = await this.prisma.requestModel.create({
      data: {
        id: randomUUID(),
        trackingCode,
        requesterId,
        createdById,
        requestType: 'CONSULTA_SALA',
        originChannel,
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
    // The sequence is race-safe: two concurrent requests never get the same
    // number (unlike count + 1, which collides with the unique index).
    const rows = await this.prisma.$queryRaw<Array<{ value: bigint }>>`
      SELECT nextval('request_tracking_seq') AS value
    `;
    return `SOL-${year}-${String(Number(rows[0].value)).padStart(5, '0')}`;
  }
}
