-- HU-21: rescheduling an appointment keeps the request in AGENDADA and records
-- the change in status_history (previous_status = 'AGENDADA', new_status = 'AGENDADA').
ALTER TABLE "status_history"
  DROP CONSTRAINT "status_history_status_changed_check";

ALTER TABLE "status_history"
  ADD CONSTRAINT "status_history_status_changed_check"
  CHECK (
    "previous_status" IS DISTINCT FROM "new_status"
    OR ("previous_status" = 'AGENDADA' AND "new_status" = 'AGENDADA')
  );
