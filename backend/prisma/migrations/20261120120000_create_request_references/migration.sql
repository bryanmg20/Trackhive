-- HU-09.2: a request may ask for a material that is not in the catalog yet,
-- described by a written reference. RN-04 becomes «at least one material of
-- the catalog or one reference»; the rule lives in the Request entity.

-- CreateTable
CREATE TABLE "request_references" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "notary" VARCHAR(120),
    "deed_year" SMALLINT,
    "deed_number" VARCHAR(20),
    "description" VARCHAR(500),
    "status" VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',
    "material_id" UUID,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_references_pkey" PRIMARY KEY ("id"),
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "request_references_kind_check" CHECK ("kind" IN ('PROTOCOLO_NOTARIAL', 'TEXTO_LIBRE')),
    CONSTRAINT "request_references_status_check" CHECK ("status" IN ('PENDIENTE', 'RESUELTA')),
    -- Only the columns of its kind, never blank
    CONSTRAINT "request_references_kind_data_check" CHECK (
      (
        "kind" = 'PROTOCOLO_NOTARIAL'
        AND btrim("notary") <> '' AND "deed_year" IS NOT NULL AND btrim("deed_number") <> ''
        AND "description" IS NULL
      )
      OR (
        "kind" = 'TEXTO_LIBRE'
        AND btrim("description") <> ''
        AND "notary" IS NULL AND "deed_year" IS NULL AND "deed_number" IS NULL
      )
    ),
    -- RESUELTA goes with its material, who associated it and when
    CONSTRAINT "request_references_resolution_check" CHECK (
      ("status" = 'PENDIENTE' AND "material_id" IS NULL AND "resolved_by_id" IS NULL AND "resolved_at" IS NULL)
      OR ("status" = 'RESUELTA' AND "material_id" IS NOT NULL AND "resolved_by_id" IS NOT NULL AND "resolved_at" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "request_references_request_id_idx" ON "request_references"("request_id");

-- CreateIndex
CREATE INDEX "request_references_material_id_idx" ON "request_references"("material_id");

-- CreateIndex
CREATE INDEX "request_references_resolved_by_id_idx" ON "request_references"("resolved_by_id");

-- Added by hand: the staff listing filters the requests with pending references
CREATE INDEX "request_references_pending_idx" ON "request_references"("request_id") WHERE "status" = 'PENDIENTE';

-- AddForeignKey
ALTER TABLE "request_references" ADD CONSTRAINT "request_references_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_references" ADD CONSTRAINT "request_references_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_references" ADD CONSTRAINT "request_references_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HU-09.2: associating the material of a reference keeps the status of the
-- request (RECIBIDA or EN_BUSQUEDA) and records who did it in status_history,
-- like rescheduling an appointment keeps AGENDADA (HU-21)
ALTER TABLE "status_history"
  DROP CONSTRAINT "status_history_status_changed_check";

ALTER TABLE "status_history"
  ADD CONSTRAINT "status_history_status_changed_check"
  CHECK (
    "previous_status" IS DISTINCT FROM "new_status"
    OR "previous_status" IN ('AGENDADA', 'RECIBIDA', 'EN_BUSQUEDA')
  );
