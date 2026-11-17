-- HU-17: every request starts its history with the row of its creation
-- (previous status NULL, RECIBIDA, who registered it). From now on the API
-- inserts it together with the request; the requests that already exist
-- (the seed included) get it here, dated on their registration.
-- Only INSERT: the trigger of status_history rejects UPDATE and DELETE (D-08).
INSERT INTO "status_history" ("request_id", "previous_status", "new_status", "user_id", "changed_at")
SELECT r."id", NULL, 'RECIBIDA', r."created_by_id", r."registered_at"
FROM "requests" r
WHERE NOT EXISTS (
    SELECT 1
    FROM "status_history" h
    WHERE h."request_id" = r."id"
      AND h."previous_status" IS NULL
);
