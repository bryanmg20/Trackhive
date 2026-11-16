import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import { PrismaNotificationMapper } from '../../../notifications/infrastructure/mappers/prisma-notification.mapper';
import { PrismaService } from '../../../prisma/prisma.service';
import { Request } from '../../domain/entities/request.entity';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type { SavedAppointment } from '../../domain/value-objects/saved-appointment';
import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';
import type { StatusChange } from '../../domain/value-objects/status-change';
import { PrismaRequestMapper } from '../mappers/prisma-request.mapper';
import { PrismaStatusHistoryMapper } from '../mappers/prisma-status-history.mapper';
import { findSchedulingConflicts } from './scheduling-conflicts.query';

/** Saves and loads the Request entity (R3). */
@Injectable()
export class PrismaRequestRepository implements IRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(request: Request): Promise<void> {
    await this.prisma.requestModel.create({
      data: PrismaRequestMapper.toPersistence(request, randomUUID),
    });
  }

  async findById(id: string): Promise<Request | null> {
    const model = await this.prisma.requestModel.findUnique({
      where: { id },
      include: { items: { select: { materialId: true } } },
    });
    return model ? PrismaRequestMapper.toDomain(model) : null;
  }

  async saveStatusChange(
    change: StatusChange,
    notification: NotificationDraft | null,
  ): Promise<SavedStatusChange> {
    // The new status, its history row and its email are saved together or
    // not at all (D-08, D-10)
    return this.prisma.$transaction(async (tx) => {
      const saved = await this.applyStatusChange(tx, change, notification);

      // Leaving AGENDADA settles its appointment, so the request can be
      // scheduled again: ATENDIDA = the requester attended, DISPONIBLE = not
      if (change.previousStatus === 'AGENDADA') {
        await tx.appointmentModel.updateMany({
          where: { requestId: change.requestId, status: 'PROGRAMADA' },
          data: {
            status: change.newStatus === 'ATENDIDA' ? 'CUMPLIDA' : 'NO_ASISTIO',
          },
        });
        // HU-20: the day of its materials is free again. booked_date only
        // holds it while the appointment is PROGRAMADA
        await tx.appointmentMaterialModel.updateMany({
          where: {
            appointment: {
              requestId: change.requestId,
              status: { not: 'PROGRAMADA' },
            },
            bookedDate: { not: null },
          },
          data: { bookedDate: null },
        });
      }
      return saved;
    });
  }

  async saveAppointment(
    change: StatusChange,
    date: Date,
    notification: NotificationDraft | null,
  ): Promise<SavedAppointment> {
    // The change to AGENDADA, its history row, its email and the appointment
    // are saved together or not at all
    return this.prisma.$transaction(async (tx) => {
      const statusChange = await this.applyStatusChange(
        tx,
        change,
        notification,
      );

      const request = await tx.requestModel.findUniqueOrThrow({
        where: { id: change.requestId },
        select: {
          requesterId: true,
          items: {
            select: {
              materialId: true,
              material: { select: { catalogCode: true, title: true } },
            },
          },
        },
      });

      const appointment = await this.insertAppointment(tx, {
        requestId: change.requestId,
        requesterId: request.requesterId,
        scheduledById: change.changedBy,
        date,
        materials: request.items.map(({ materialId, material }) => ({
          materialId,
          ...material,
        })),
      });

      return {
        id: appointment.id,
        date: appointment.appointmentDate,
        status: 'PROGRAMADA',
        requester: appointment.requester,
        materials: appointment.materials.map(({ material }) => material),
        statusChange,
      };
    });
  }

  /**
   * Inserts the appointment with every material of the request booked for
   * the day (HU-18, HU-20). When the unique index of the day rejects the
   * insert, it becomes MaterialAlreadyBookedError with the concrete
   * conflict, so a race between two staff members is answered with the same
   * error as the pre-check (D-09).
   */
  private async insertAppointment(
    tx: Prisma.TransactionClient,
    input: {
      requestId: string;
      requesterId: string;
      scheduledById: string;
      date: Date;
      materials: { materialId: string; catalogCode: string; title: string }[];
    },
  ) {
    try {
      return await tx.appointmentModel.create({
        data: {
          id: randomUUID(),
          requestId: input.requestId,
          requesterId: input.requesterId,
          scheduledById: input.scheduledById,
          appointmentDate: input.date,
          status: 'PROGRAMADA',
          materials: {
            create: input.materials.map(({ materialId }) => ({
              materialId,
              bookedDate: input.date,
            })),
          },
        },
        select: {
          id: true,
          appointmentDate: true,
          requester: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              secondLastName: true,
            },
          },
          materials: {
            select: {
              material: {
                select: { id: true, catalogCode: true, title: true },
              },
            },
            orderBy: { material: { catalogCode: 'asc' } },
          },
        },
      });
    } catch (error) {
      // D-09: two staff members booked the same material the same day at
      // once and the unique index stopped this one. It is the only unique
      // constraint this insert can reach, so ask again what holds the day
      // to name the concrete conflict; if it is no longer visible, fall back
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )) {
        throw error;
      }
      const taken = await findSchedulingConflicts(
        this.prisma,
        input.requestId,
        input.date,
      );
      throw new MaterialAlreadyBookedError(
        taken.bookedMaterials.length > 0
          ? taken.bookedMaterials
          : input.materials.map(({ catalogCode, title }) => ({
              catalogCode,
              title,
              date: input.date,
            })),
      );
    }
  }

  /**
   * Saves the new status, inserts its row in status_history (D-08) and
   * queues its email in the outbox (HU-23, D-10) inside the transaction `tx`.
   * Every status change goes through here.
   */
  private async applyStatusChange(
    tx: Prisma.TransactionClient,
    change: StatusChange,
    notification: NotificationDraft | null,
  ): Promise<SavedStatusChange> {
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

    // Only queued: a job sends it, so a mail server failure can neither
    // slow down nor undo the change (D-10)
    if (notification) {
      await tx.notificationModel.create({
        data: PrismaNotificationMapper.toPersistence(
          notification,
          {
            id: randomUUID(),
            requestId: change.requestId,
            statusHistoryId: row.id,
          },
          change.changedAt,
        ),
      });
    }

    return PrismaStatusHistoryMapper.toSavedStatusChange(change, row);
  }
}
