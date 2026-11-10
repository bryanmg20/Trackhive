-- HU-18: an appointment is a whole day in the reading room, without a time.
-- The requester can consult the material during the service hours of that
-- day (Monday to Friday 8:00-17:00, Saturday 9:00-13:00).
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "scheduled_by_id" UUID NOT NULL,
    "appointment_date" DATE NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'PROGRAMADA',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "appointments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "appointments_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "requesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "appointments_scheduled_by_id_fkey" FOREIGN KEY ("scheduled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "appointments_status_check" CHECK ("status" IN ('PROGRAMADA', 'CUMPLIDA', 'CANCELADA', 'NO_ASISTIO')),
    -- The CLENA does not attend on Sundays (ISODOW 7)
    CONSTRAINT "appointments_not_sunday_check" CHECK (EXTRACT(ISODOW FROM "appointment_date") <> 7)
);

-- Every material of the request, booked for the day of the appointment
CREATE TABLE "appointment_materials" (
    "appointment_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,

    CONSTRAINT "appointment_materials_pkey" PRIMARY KEY ("appointment_id", "material_id"),
    CONSTRAINT "appointment_materials_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "appointment_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Calendar by date range (§4 of docs/modelo-datos.md)
CREATE INDEX "appointments_appointment_date_idx" ON "appointments"("appointment_date");
CREATE INDEX "appointments_request_id_idx" ON "appointments"("request_id");
CREATE INDEX "appointments_requester_id_idx" ON "appointments"("requester_id");
CREATE INDEX "appointments_scheduled_by_id_idx" ON "appointments"("scheduled_by_id");
CREATE INDEX "appointment_materials_material_id_idx" ON "appointment_materials"("material_id");
