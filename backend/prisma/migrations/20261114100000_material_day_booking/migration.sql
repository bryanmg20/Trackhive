-- HU-20: a booking is by day, material + date, without time ranges. While
-- the appointment is PROGRAMADA, appointment_materials copies the day into
-- booked_date; when it settles (CUMPLIDA, NO_ASISTIO) or is cancelled it
-- becomes NULL, freeing the day. NULL never collides, so only the active
-- booking holds it
ALTER TABLE "appointment_materials" ADD COLUMN "booked_date" DATE;

-- Backfill: only the materials of an appointment still PROGRAMADA hold a day
UPDATE "appointment_materials" AS am
SET "booked_date" = a."appointment_date"
FROM "appointments" AS a
WHERE am."appointment_id" = a."id" AND a."status" = 'PROGRAMADA';

-- A material cannot be booked twice the same day, no matter how many API
-- instances run: the race of two staff members scheduling at once is
-- stopped here, not only in the use case (D-09)
CREATE UNIQUE INDEX "appointment_materials_material_day_uniq" ON "appointment_materials"("material_id", "booked_date");
