-- HU-138: «Sincronizar ahora». An administrator asks for a run, which waits
-- PEDIDA until the agent of the CLENA (HU-166) takes it: the agent asks
-- Trackhive every minute while the PC is on, and its daily run takes it too.
-- Taken, the run goes on as before: EN_CURSO, then OK or ERROR (HU-137).

-- AlterTable: when and who asked for the run, NULL in the runs the agent
-- starts on its own. A run PEDIDA has not started yet: its start is NULL,
-- written explicitly (the default now() stays for a run EN_CURSO)
ALTER TABLE "sync_runs" ADD COLUMN     "requested_at" TIMESTAMPTZ,
ADD COLUMN     "requested_by_id" UUID,
ALTER COLUMN "started_at" DROP NOT NULL;

-- Added by hand: Prisma does not generate CHECK constraints
ALTER TABLE "sync_runs"
  DROP CONSTRAINT "sync_runs_status_check",
  ADD CONSTRAINT "sync_runs_status_check" CHECK ("status" IN ('PEDIDA', 'EN_CURSO', 'OK', 'ERROR')),
  -- A finished run has its end; one waiting for the agent or running does not
  DROP CONSTRAINT "sync_runs_finished_at_check",
  ADD CONSTRAINT "sync_runs_finished_at_check" CHECK (("status" IN ('PEDIDA', 'EN_CURSO')) = ("finished_at" IS NULL)),
  -- Only a run waiting for the agent has not started
  ADD CONSTRAINT "sync_runs_started_at_check" CHECK (("status" = 'PEDIDA') = ("started_at" IS NULL)),
  -- A request has its moment and its administrator, or neither
  ADD CONSTRAINT "sync_runs_requested_check" CHECK (("requested_at" IS NULL) = ("requested_by_id" IS NULL)),
  -- A run waiting for the agent was asked for by an administrator
  ADD CONSTRAINT "sync_runs_pending_requested_check" CHECK ("status" <> 'PEDIDA' OR "requested_at" IS NOT NULL);

-- AddForeignKey: the administrator who asked for the run. Accounts are
-- deactivated, never deleted
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Added by hand: only one run waiting for the agent or running at a time,
-- even if an administrator asks for one while the agent starts its daily
-- run, or two instances of the backend receive them together (HU-137,
-- HU-138). It replaces the index of HU-137, which only covered EN_CURSO
DROP INDEX "sync_runs_single_running_idx";
CREATE UNIQUE INDEX "sync_runs_single_open_idx" ON "sync_runs" ((true)) WHERE "status" IN ('PEDIDA', 'EN_CURSO');

-- CreateTable: the agent of the CLENA, a single row with the last time it
-- called Trackhive with its token
CREATE TABLE "sync_agent" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_contact_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sync_agent_pkey" PRIMARY KEY ("id"),
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "sync_agent_singleton_check" CHECK ("id" = 1)
);
