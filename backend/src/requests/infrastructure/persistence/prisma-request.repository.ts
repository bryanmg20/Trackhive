import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreatedRequest,
  MyRequestListCriteria,
  RequestDetail,
  RequestListCriteria,
  RequestListResult,
  RequesterProfile,
  RequestRepository,
  SavedStatusChange,
} from '../../application/ports/request.repository.port';
import type { CreateRequestInput } from '../../application/use-cases/create-request.use-case';
import type {
  CreateRequestOnBehalfInput,
  RequesterInput,
} from '../../application/use-cases/create-request-on-behalf.use-case';
import { isDeliveryMode } from '../../domain/delivery-mode';
import { Request } from '../../domain/entities/request.entity';
import { isRequestStatus } from '../../domain/request-status';
import type { StatusChange } from '../../domain/status-change';
import { RequestMaterialNotFoundError } from '../../domain/errors/request-material-not-found.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
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

  async list(criteria: RequestListCriteria): Promise<RequestListResult> {
    return this.findPage(this.buildListWhere(criteria), criteria);
  }

  async listByRequesterUser(
    userId: string,
    criteria: MyRequestListCriteria,
  ): Promise<RequestListResult> {
    // Filter by the account linked to the requester, never by the email: a
    // visitor's requester can share an email without being this user (HU-11)
    return this.findPage(
      { AND: [{ requester: { userId } }, this.buildListWhere(criteria)] },
      criteria,
    );
  }

  private async findPage(
    where: Prisma.RequestModelWhereInput,
    criteria: Pick<RequestListCriteria, 'sort' | 'order' | 'page' | 'limit'>,
  ): Promise<RequestListResult> {
    // Same filter for the page and the total, in one transaction
    const [models, total] = await this.prisma.$transaction([
      this.prisma.requestModel.findMany({
        where,
        orderBy: [{ [criteria.sort]: criteria.order }, { id: 'asc' }],
        skip: (criteria.page - 1) * criteria.limit,
        take: criteria.limit,
        include: {
          requester: true,
          items: { include: { material: true } },
        },
      }),
      this.prisma.requestModel.count({ where }),
    ]);

    return {
      items: models.map((model) => {
        if (
          !isRequestStatus(model.status) ||
          !isDeliveryMode(model.deliveryMode)
        ) {
          throw new Error(`Request ${model.id} has an invalid stored value`);
        }
        return {
          id: model.id,
          trackingCode: model.trackingCode,
          status: model.status,
          deliveryMode: model.deliveryMode,
          desiredDate: model.desiredDate,
          registeredAt: model.registeredAt,
          rejectionReason: model.rejectionReason,
          requester: {
            firstName: model.requester.firstName,
            middleName: model.requester.middleName,
            lastName: model.requester.lastName,
            secondLastName: model.requester.secondLastName,
            email: model.requester.email,
          },
          materials: model.items.map(({ material }) => ({
            id: material.id,
            catalogCode: material.catalogCode,
            title: material.title,
          })),
        };
      }),
      total,
    };
  }

  async findById(id: string): Promise<RequestDetail | null> {
    const model = await this.prisma.requestModel.findUnique({
      where: { id },
      include: {
        requester: true,
        items: { include: { material: true } },
      },
    });
    if (!model) {
      return null;
    }
    if (!isRequestStatus(model.status) || !isDeliveryMode(model.deliveryMode)) {
      throw new Error(`Request ${model.id} has an invalid stored value`);
    }

    return {
      id: model.id,
      trackingCode: model.trackingCode,
      status: model.status,
      deliveryMode: model.deliveryMode,
      originChannel: model.originChannel,
      reason: model.reason,
      requirementDescription: model.requirementDescription,
      desiredDate: model.desiredDate,
      committedDate: model.committedDate,
      registeredAt: model.registeredAt,
      rejectionReason: model.rejectionReason,
      requester: {
        firstName: model.requester.firstName,
        middleName: model.requester.middleName,
        lastName: model.requester.lastName,
        secondLastName: model.requester.secondLastName,
        email: model.requester.email,
        phone: model.requester.phone,
        requesterType: model.requester.requesterType,
        institution: model.requester.institution,
        documentType: model.requester.documentType,
        documentNumber: model.requester.documentNumber,
      },
      materials: model.items.map(({ material, itemStatus }) => ({
        id: material.id,
        catalogCode: material.catalogCode,
        title: material.title,
        materialType: material.materialType,
        author: material.author,
        collection: material.collection,
        status: material.status,
        location: {
          depot: material.depot,
          shelf: material.shelf,
          box: material.box,
        },
        itemStatus,
      })),
    };
  }

  async findEntityById(id: string): Promise<Request | null> {
    const model = await this.prisma.requestModel.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        deliveryMode: true,
        rejectionReason: true,
      },
    });
    if (!model) {
      return null;
    }
    if (!isRequestStatus(model.status) || !isDeliveryMode(model.deliveryMode)) {
      throw new Error(`Request ${model.id} has an invalid stored value`);
    }
    return new Request({
      id: model.id,
      status: model.status,
      deliveryMode: model.deliveryMode,
      rejectionReason: model.rejectionReason,
    });
  }

  async saveStatusChange(change: StatusChange): Promise<SavedStatusChange> {
    // The new status and its history row are saved together or not at all (D-08)
    return this.prisma.$transaction(async (tx) => {
      // Optimistic lock: update only if the request is still in the status the
      // transition was validated against. If another person changed it in the
      // meantime, nothing is written and the history stays consistent.
      const { count } = await tx.requestModel.updateMany({
        where: { id: change.requestId, status: change.previousStatus },
        data: {
          status: change.newStatus,
          version: { increment: 1 },
          ...(change.newStatus === 'ATENDIDA' && {
            attendedAt: change.changedAt,
          }),
          ...(change.newStatus === 'CERRADA' && {
            closedAt: change.changedAt,
          }),
          // HU-16: the reason the requester reads in «Mis solicitudes»
          ...(change.newStatus === 'RECHAZADA' && {
            rejectionReason: change.rejectionReason,
          }),
        },
      });
      if (count === 0) {
        throw new RequestStatusConflictError();
      }

      const row = await tx.statusHistoryModel.create({
        data: {
          requestId: change.requestId,
          previousStatus: change.previousStatus,
          newStatus: change.newStatus,
          userId: change.changedBy,
          comment: change.comment,
          changedAt: change.changedAt,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              secondLastName: true,
            },
          },
        },
      });

      return {
        previousStatus: change.previousStatus,
        newStatus: change.newStatus,
        changedAt: row.changedAt,
        comment: row.comment,
        changedBy: row.user,
      };
    });
  }

  private buildListWhere(
    criteria: RequestListCriteria,
  ): Prisma.RequestModelWhereInput {
    const and: Prisma.RequestModelWhereInput[] = [];

    if (criteria.status) {
      and.push({ status: criteria.status });
    }
    if (criteria.desiredFrom || criteria.desiredTo) {
      and.push({
        desiredDate: {
          ...(criteria.desiredFrom && {
            gte: new Date(`${criteria.desiredFrom}T00:00:00.000Z`),
          }),
          ...(criteria.desiredTo && {
            lte: new Date(`${criteria.desiredTo}T00:00:00.000Z`),
          }),
        },
      });
    }
    // Every word must match some field, so "juan pérez" finds "Juan Carlos Pérez"
    for (const word of criteria.requester?.split(/\s+/).filter(Boolean) ?? []) {
      const text = { contains: word, mode: 'insensitive' as const };
      and.push({
        requester: {
          OR: [
            { firstName: text },
            { middleName: text },
            { lastName: text },
            { secondLastName: text },
            { email: text },
            { documentNumber: text },
          ],
        },
      });
    }
    if (criteria.material) {
      const text = {
        contains: criteria.material,
        mode: 'insensitive' as const,
      };
      and.push({
        items: {
          some: { material: { OR: [{ title: text }, { catalogCode: text }] } },
        },
      });
    }
    return and.length > 0 ? { AND: and } : {};
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
