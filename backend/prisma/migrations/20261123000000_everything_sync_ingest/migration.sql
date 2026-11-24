-- HU-137: the Everything agent (HU-166) sends each run page by page. The
-- pages wait in sync_run_pages until the run closes, because the leaf folders
-- and the repeated codes are only known with every folder (HU-136). A leaf
-- that does not give its own code stays marked for review.

-- AlterTable: why the staff should review the code of a material
ALTER TABLE "materials" ADD COLUMN "review_reason" VARCHAR(20);

-- Added by hand: Prisma does not generate CHECK constraints
ALTER TABLE "materials"
  ADD CONSTRAINT "materials_review_reason_check" CHECK (
    "review_reason" IS NULL OR "review_reason" IN ('NO_PATTERN', 'DUPLICATE_CODE')
  );

-- AlterTable: the last activity of a run (its start or its last page). The
-- existing runs take their end, or their start if they are still running
ALTER TABLE "sync_runs" ADD COLUMN "last_activity_at" TIMESTAMPTZ;
UPDATE "sync_runs" SET "last_activity_at" = COALESCE("finished_at", "started_at");
ALTER TABLE "sync_runs" ALTER COLUMN "last_activity_at" SET NOT NULL,
ALTER COLUMN "last_activity_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "sync_run_pages" (
    "sync_run_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "results_count" INTEGER NOT NULL,
    "folders" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_run_pages_pkey" PRIMARY KEY ("sync_run_id","page_number"),
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "sync_run_pages_page_number_check" CHECK ("page_number" >= 1),
    CONSTRAINT "sync_run_pages_results_count_check" CHECK ("results_count" >= 0),
    CONSTRAINT "sync_run_pages_folders_check" CHECK (jsonb_typeof("folders") = 'array')
);

-- AddForeignKey: the pages only live while their run is open
ALTER TABLE "sync_run_pages" ADD CONSTRAINT "sync_run_pages_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
