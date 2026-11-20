import type { Prisma } from '@prisma/client';
import { Request } from '../../domain/entities/request.entity';
import type { OriginChannel } from '../../domain/entities/request.entity';
import { isDeliveryMode } from '../../domain/enums/delivery-mode';
import { isRequestStatus } from '../../domain/enums/request-status';
import { PrismaRequestReferenceMapper } from './prisma-request-reference.mapper';
import type { RequestReferenceRow } from './prisma-request-reference.mapper';
import { PrismaStatusHistoryMapper } from './prisma-status-history.mapper';

/** The columns of a request that the entity needs, with its materials. */
export interface RequestEntityRow {
  id: string;
  trackingCode: string;
  requesterId: string;
  createdById: string;
  originChannel: string;
  deliveryMode: string;
  status: string;
  reason: string | null;
  requirementDescription: string;
  desiredDate: Date;
  rejectionReason: string | null;
  items: { materialId: string }[];
  // Written references (HU-09.2)
  references?: RequestReferenceRow[];
}

/** Translates between the Request entity and the requests table. */
export class PrismaRequestMapper {
  static toDomain(model: RequestEntityRow): Request {
    if (!isRequestStatus(model.status) || !isDeliveryMode(model.deliveryMode)) {
      throw new Error(`Request ${model.id} has an invalid stored value`);
    }
    return new Request({
      id: model.id,
      status: model.status,
      deliveryMode: model.deliveryMode,
      rejectionReason: model.rejectionReason,
      registration: {
        trackingCode: model.trackingCode,
        requesterId: model.requesterId,
        createdById: model.createdById,
        originChannel: model.originChannel as OriginChannel,
        reason: model.reason ?? '',
        requirementDescription: model.requirementDescription,
        desiredDate: model.desiredDate,
        materialIds: model.items.map(({ materialId }) => materialId),
      },
      references: (model.references ?? []).map((row) =>
        PrismaRequestReferenceMapper.toDomain(row),
      ),
    });
  }

  /**
   * A new request, with one item per material (HU-09, HU-10), its written
   * references (HU-09.2) and the first row of its history (HU-17), all in
   * the same insert.
   */
  static toPersistence(
    request: Request,
    itemId: () => string,
  ): Prisma.RequestModelUncheckedCreateInput {
    const { registration } = request;
    if (!registration) {
      throw new Error(`Request ${request.id} has no registration data`);
    }
    return {
      id: request.id,
      trackingCode: registration.trackingCode,
      requesterId: registration.requesterId,
      createdById: registration.createdById,
      requestType: 'CONSULTA_SALA',
      originChannel: registration.originChannel,
      deliveryMode: request.deliveryMode,
      purpose: 'INVESTIGACION',
      reason: registration.reason,
      requirementDescription: registration.requirementDescription,
      desiredDate: registration.desiredDate,
      status: request.status,
      items: {
        create: registration.materialIds.map((materialId) => ({
          id: itemId(),
          materialId,
          itemStatus: 'PENDIENTE',
          accessType: 'FISICO',
        })),
      },
      references: {
        create: request.references.map((reference) =>
          PrismaRequestReferenceMapper.toPersistence(reference),
        ),
      },
      statusHistory: {
        create: PrismaStatusHistoryMapper.toCreationRow(request),
      },
    };
  }
}
