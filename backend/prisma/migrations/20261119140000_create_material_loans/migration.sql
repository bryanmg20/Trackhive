-- HU-72: records each physical handover and return of a material during an
-- appointment in the reading room. Multiple loans of the same material in the
-- same appointment are allowed after the previous one is returned, while a
-- partial unique index prevents two open loans for the same material.

-- CreateTable
CREATE TABLE "material_loans" (
    "id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "handed_over_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handed_over_by_id" UUID NOT NULL,
    "delivery_notes" VARCHAR(500),
    "returned_at" TIMESTAMPTZ,
    "returned_by_id" UUID,
    "return_notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_loans_pkey" PRIMARY KEY ("id"),
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "material_loans_return_pair_check" CHECK (("returned_at" IS NULL) = ("returned_by_id" IS NULL)),
    CONSTRAINT "material_loans_return_after_handover_check" CHECK ("returned_at" IS NULL OR "returned_at" >= "handed_over_at"),
    CONSTRAINT "material_loans_return_notes_check" CHECK ("return_notes" IS NULL OR "returned_at" IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "material_loans_material_handed_over_idx" ON "material_loans"("material_id", "handed_over_at" DESC);

-- CreateIndex
CREATE INDEX "material_loans_appointment_material_idx" ON "material_loans"("appointment_id", "material_id");

-- CreateIndex
CREATE INDEX "material_loans_handed_over_by_idx" ON "material_loans"("handed_over_by_id");

-- CreateIndex
CREATE INDEX "material_loans_returned_by_idx" ON "material_loans"("returned_by_id");

-- Added by hand: at most one open loan per material at a time (HU-72)
CREATE UNIQUE INDEX "material_loans_active_material_uniq" ON "material_loans"("material_id") WHERE "returned_at" IS NULL;

-- AddForeignKey
ALTER TABLE "material_loans" ADD CONSTRAINT "material_loans_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_loans" ADD CONSTRAINT "material_loans_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_loans" ADD CONSTRAINT "material_loans_handed_over_by_id_fkey" FOREIGN KEY ("handed_over_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_loans" ADD CONSTRAINT "material_loans_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
