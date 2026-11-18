-- HU-134: the materials table records the digital copy that the Everything
-- sync brings (HU-137), and each sync run is logged in sync_runs.

-- AlterTable: the physical location becomes optional. A material from
-- Everything may not have it
ALTER TABLE "materials" ALTER COLUMN "depot" DROP NOT NULL,
ALTER COLUMN "shelf" DROP NOT NULL,
ALTER COLUMN "box" DROP NOT NULL;

-- AlterTable: the existing materials get source = MANUAL and no digital copy
ALTER TABLE "materials" ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "digital_path" VARCHAR(1024),
ADD COLUMN "last_seen_at" TIMESTAMPTZ;

-- Added by hand: Prisma does not generate CHECK constraints
ALTER TABLE "materials"
  ADD CONSTRAINT "materials_source_check" CHECK ("source" IN ('MANUAL', 'EVERYTHING')),
  -- The location goes whole or not at all: a half location cannot be found
  ADD CONSTRAINT "materials_location_check" CHECK (
    ("depot" IS NULL AND "shelf" IS NULL AND "box" IS NULL)
    OR ("depot" IS NOT NULL AND "shelf" IS NOT NULL AND "box" IS NOT NULL)
  ),
  ADD CONSTRAINT "materials_digital_path_check" CHECK ("digital_path" IS NULL OR "digital_path" <> '');

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "status" VARCHAR(10) NOT NULL DEFAULT 'EN_CURSO',
    "files_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" VARCHAR(1000),

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id"),
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "sync_runs_status_check" CHECK ("status" IN ('EN_CURSO', 'OK', 'ERROR')),
    CONSTRAINT "sync_runs_files_count_check" CHECK ("files_count" >= 0),
    -- A finished run has its end; a running one does not
    CONSTRAINT "sync_runs_finished_at_check" CHECK (("status" = 'EN_CURSO') = ("finished_at" IS NULL)),
    CONSTRAINT "sync_runs_finished_after_start_check" CHECK ("finished_at" IS NULL OR "finished_at" >= "started_at"),
    -- Only a failed run has a reason
    CONSTRAINT "sync_runs_error_message_check" CHECK (("status" = 'ERROR') = ("error_message" IS NOT NULL))
);

-- CreateIndex: the latest run, for the sync status (HU-138)
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs"("started_at" DESC);

-- Added by hand: only one run at a time, even if the job and the
-- «Sincronizar ahora» button start one together (HU-137, HU-138)
CREATE UNIQUE INDEX "sync_runs_single_running_idx" ON "sync_runs" ((true)) WHERE "status" = 'EN_CURSO';
