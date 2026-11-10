-- HU-08: who changed the status of a material, when, and why (last change only)
ALTER TABLE "materials"
    ADD COLUMN "status_changed_at" TIMESTAMPTZ,
    ADD COLUMN "status_changed_by" UUID,
    ADD COLUMN "status_change_reason" VARCHAR(500);

ALTER TABLE "materials"
    ADD CONSTRAINT "materials_status_changed_by_fkey"
    FOREIGN KEY ("status_changed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
