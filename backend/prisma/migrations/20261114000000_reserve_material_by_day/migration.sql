-- HU-20: a material can be in only one active appointment per day.
-- appointment_materials copies the day and the status of its appointment
-- through a composite FK with ON UPDATE CASCADE, so PostgreSQL keeps them in
-- sync and a partial unique index can forbid the double booking (D-09).
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_id_date_status_key" UNIQUE ("id", "appointment_date", "status");

ALTER TABLE "appointment_materials"
  ADD COLUMN "appointment_date" DATE,
  ADD COLUMN "appointment_status" VARCHAR(12);

UPDATE "appointment_materials" am
   SET "appointment_date" = a."appointment_date", "appointment_status" = a."status"
  FROM "appointments" a
 WHERE a."id" = am."appointment_id";

ALTER TABLE "appointment_materials"
  ALTER COLUMN "appointment_date" SET NOT NULL,
  ALTER COLUMN "appointment_status" SET NOT NULL;

ALTER TABLE "appointment_materials" DROP CONSTRAINT "appointment_materials_appointment_id_fkey";
ALTER TABLE "appointment_materials"
  ADD CONSTRAINT "appointment_materials_appointment_fkey"
  FOREIGN KEY ("appointment_id", "appointment_date", "appointment_status")
  REFERENCES "appointments"("id", "appointment_date", "status")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Added by hand: Prisma does not generate partial indexes.
-- CANCELADA and NO_ASISTIO free the day of the material.
CREATE UNIQUE INDEX "appointment_materials_material_day_key"
  ON "appointment_materials" ("material_id", "appointment_date")
  WHERE "appointment_status" IN ('PROGRAMADA', 'CUMPLIDA');
