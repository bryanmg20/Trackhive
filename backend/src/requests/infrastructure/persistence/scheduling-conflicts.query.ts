import type { PrismaService } from '../../../prisma/prisma.service';
import type { SchedulingConflicts } from '../../application/ports/request-query.port';

/**
 * The materials of the request and the PROGRAMADA appointments that already
 * hold any of them on `date` (HU-20). The query service answers it for
 * «Agendar cita», and the repository asks it again when the unique index of
 * the day stops an insert (D-09).
 */
export async function findSchedulingConflicts(
  prisma: PrismaService,
  requestId: string,
  date: Date,
): Promise<SchedulingConflicts> {
  // Every material of the request with its current status
  const request = await prisma.requestModel.findUnique({
    where: { id: requestId },
    select: {
      items: {
        select: {
          material: {
            select: {
              id: true,
              catalogCode: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: { material: { catalogCode: 'asc' } },
      },
    },
  });
  const materials = (request?.items ?? []).map(({ material }) => material);
  const materialIds = materials.map((material) => material.id);

  // The PROGRAMADA appointments that already hold any of them that day.
  // Days are stored as UTC midnight, so a plain equals finds the same day
  const appointments =
    materialIds.length === 0
      ? []
      : await prisma.appointmentModel.findMany({
          where: {
            status: 'PROGRAMADA',
            appointmentDate: date,
            materials: { some: { materialId: { in: materialIds } } },
          },
          select: {
            appointmentDate: true,
            request: { select: { trackingCode: true } },
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

  const bookedMaterials = appointments.flatMap(
    ({ appointmentDate, request: appointmentRequest, materials: booked }) =>
      booked
        .filter(({ material }) => materialIds.includes(material.id))
        .map(({ material }) => ({
          materialId: material.id,
          catalogCode: material.catalogCode,
          title: material.title,
          date: appointmentDate,
          trackingCode: appointmentRequest.trackingCode,
        })),
  );

  return { materials, bookedMaterials };
}
