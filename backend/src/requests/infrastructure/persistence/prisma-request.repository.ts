import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { NotificationDraft } from '../../../notifications/domain/value-objects/notification-draft';
import { PrismaNotificationMapper } from '../../../notifications/infrastructure/mappers/prisma-notification.mapper';
import { PrismaService } from '../../../prisma/prisma.service';
import { Request } from '../../domain/entities/request.entity';
import { AppointmentHasLoansError } from '../../domain/errors/appointment-has-loans.error';
import { AppointmentHasUnreturnedMaterialsError } from '../../domain/errors/appointment-has-unreturned-materials.error';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error';
import { AppointmentNotScheduledError } from '../../domain/errors/appointment-not-scheduled.error';
import { MaterialAlreadyBookedError } from '../../domain/errors/material-already-booked.error';
import { RequestStatusConflictError } from '../../domain/errors/request-status-conflict.error';
import { RoomCapacityExceededError } from '../../domain/errors/room-capacity-exceeded.error';
import {
  ACTIVE_CAPACITY_APPOINTMENT_STATUSES,
  DEFAULT_DAILY_ROOM_CAPACITY,
  isRoomFull,
} from '../../domain/policies/room-capacity';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import type {
  SavedAppointment,
  SavedCancelledAppointment,
  StoredAppointment,
} from '../../domain/value-objects/saved-appointment';
import type { SavedStatusChange } from '../../domain/value-objects/saved-status-change';
import type { StatusChange } from '../../domain/value-objects/status-change';
import { PrismaAppointmentMapper } from '../mappers/prisma-appointment.mapper';
import { PrismaRequestMapper } from '../mappers/prisma-request.mapper';
import { PrismaStatusHistoryMapper } from '../mappers/prisma-status-history.mapper';
import { findSchedulingConflicts } from './scheduling-conflicts.query';

const SAVED_APPOINTMENT_SELECT = {
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
} satisfies Prisma.AppointmentModelSelect;

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

  async findAppointmentById(id: string): Promise<StoredAppointment | null> {
    const model = await this.prisma.appointmentModel.findUnique({
      where: { id },
      select: {
        id: true,
        appointmentDate: true,
        status: true,
        materials: { select: { materialId: true } },
        request: {
          include: { items: { select: { materialId: true } } },
        },
      },
    });
    return model ? PrismaAppointmentMapper.toStoredAppointment(model) : null;
  }

  async saveStatusChange(
    change: StatusChange,
    notification: NotificationDraft | null,
  ): Promise<SavedStatusChange> {
    // The new status, its history row and its email are saved together or
    // not at all (D-08, D-10)
    return this.prisma.$transaction(async (tx) => {
      // HU-72 safeguards before settling a PROGRAMADA appointment
      if (change.appointmentOutcome) {
        const scheduled = await tx.appointmentModel.findFirst({
          where: { requestId: change.requestId, status: 'PROGRAMADA' },
          select: { id: true },
        });
        if (scheduled) {
          if (change.appointmentOutcome === 'NO_ASISTIO') {
            const loansCount = await tx.materialLoanModel.count({
              where: { appointmentId: scheduled.id },
            });
            if (loansCount > 0) {
              throw new AppointmentHasLoansError();
            }
          } else if (change.appointmentOutcome === 'CUMPLIDA') {
            const openLoansCount = await tx.materialLoanModel.count({
              where: { appointmentId: scheduled.id, returnedAt: null },
            });
            if (openLoansCount > 0) {
              throw new AppointmentHasUnreturnedMaterialsError();
            }
          }
        }
      }

      const saved = await this.applyStatusChange(tx, change, notification);

      // The entity decided how the appointment ends (appointmentOutcome);
      // here it is only saved, and the day of its materials is released
      if (change.appointmentOutcome) {
        await tx.appointmentModel.updateMany({
          where: { requestId: change.requestId, status: 'PROGRAMADA' },
          data: PrismaAppointmentMapper.toSettled(change.appointmentOutcome),
        });
        await tx.appointmentMaterialModel.updateMany({
          where: {
            appointment: {
              requestId: change.requestId,
              status: { not: 'PROGRAMADA' },
            },
            bookedDate: { not: null },
          },
          data: PrismaAppointmentMapper.toBookingReleased(),
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
      // Serialize concurrent capacity checks for the same appointment day
      // before any status change or appointment insert runs (HU-20.1, RN-19)
      await this.assertDailyCapacityAvailable(tx, date);

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

      return PrismaAppointmentMapper.toSavedAppointment(
        appointment,
        statusChange,
      );
    });
  }

  async rescheduleAppointment(
    appointmentId: string,
    change: StatusChange,
    date: Date,
    notification: NotificationDraft | null,
  ): Promise<SavedAppointment> {
    return this.prisma.$transaction(async (tx) => {
      const loansCount = await tx.materialLoanModel.count({
        where: { appointmentId },
      });
      if (loansCount > 0) {
        throw new AppointmentHasLoansError();
      }

      await this.assertDailyCapacityAvailable(tx, date);

      const { count } = await tx.appointmentModel.updateMany({
        where: { id: appointmentId, status: 'PROGRAMADA' },
        data: PrismaAppointmentMapper.toRescheduled(date, change.changedBy),
      });
      if (count === 0) {
        throw new AppointmentNotScheduledError();
      }

      const request = await tx.requestModel.findUniqueOrThrow({
        where: { id: change.requestId },
        select: {
          items: {
            select: {
              material: { select: { catalogCode: true, title: true } },
            },
          },
        },
      });

      await this.updateBookedMaterialsDate(tx, {
        appointmentId,
        requestId: change.requestId,
        date,
        materials: request.items.map(({ material }) => material),
      });

      const statusChange = await this.applyStatusChange(
        tx,
        change,
        notification,
      );

      const appointment = await tx.appointmentModel.findUniqueOrThrow({
        where: { id: appointmentId },
        select: SAVED_APPOINTMENT_SELECT,
      });

      return PrismaAppointmentMapper.toSavedAppointment(
        appointment,
        statusChange,
      );
    });
  }

  async cancelAppointment(
    appointmentId: string,
    change: StatusChange,
    notification: NotificationDraft | null,
  ): Promise<SavedCancelledAppointment> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.appointmentModel.findUnique({
        where: { id: appointmentId },
        select: { id: true, appointmentDate: true },
      });
      if (!current) {
        throw new AppointmentNotFoundError();
      }

      const loansCount = await tx.materialLoanModel.count({
        where: { appointmentId },
      });
      if (loansCount > 0) {
        throw new AppointmentHasLoansError();
      }

      const { count } = await tx.appointmentModel.updateMany({
        where: { id: appointmentId, status: 'PROGRAMADA' },
        data: PrismaAppointmentMapper.toSettled('CANCELADA'),
      });
      if (count === 0) {
        throw new AppointmentNotScheduledError();
      }

      await tx.appointmentMaterialModel.updateMany({
        where: { appointmentId, bookedDate: { not: null } },
        data: PrismaAppointmentMapper.toBookingReleased(),
      });

      const statusChange = await this.applyStatusChange(
        tx,
        change,
        notification,
      );

      return PrismaAppointmentMapper.toSavedCancelledAppointment(
        current,
        statusChange,
      );
    });
  }

  private async updateBookedMaterialsDate(
    tx: Prisma.TransactionClient,
    input: {
      appointmentId: string;
      requestId: string;
      date: Date;
      materials: { catalogCode: string; title: string }[];
    },
  ): Promise<void> {
    try {
      await tx.appointmentMaterialModel.updateMany({
        where: { appointmentId: input.appointmentId },
        data: PrismaAppointmentMapper.toMaterialBookedDate(input.date),
      });
    } catch (error) {
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

  private async assertDailyCapacityAvailable(
    tx: Prisma.TransactionClient,
    date: Date,
  ): Promise<void> {
    const lockKey = `appointment_capacity_${date.toISOString().slice(0, 10)}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const config = await tx.readingRoomConfigModel.findUnique({
      where: { id: 1 },
      select: { dailyCapacity: true },
    });
    const dailyCapacity = config?.dailyCapacity ?? DEFAULT_DAILY_ROOM_CAPACITY;

    const occupied = await tx.appointmentModel.count({
      where: {
        appointmentDate: date,
        status: { in: [...ACTIVE_CAPACITY_APPOINTMENT_STATUSES] },
      },
    });
    if (isRoomFull(occupied, dailyCapacity)) {
      throw new RoomCapacityExceededError(date, dailyCapacity);
    }
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
        data: PrismaAppointmentMapper.toPersistence({
          id: randomUUID(),
          requestId: input.requestId,
          requesterId: input.requesterId,
          scheduledById: input.scheduledById,
          date: input.date,
          materialIds: input.materials.map(({ materialId }) => materialId),
        }),
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
      data: PrismaStatusHistoryMapper.toRequestUpdate(change),
    });
    if (count === 0) {
      throw new RequestStatusConflictError();
    }

    const row = await tx.statusHistoryModel.create({
      data: PrismaStatusHistoryMapper.toHistoryRow(change),
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
