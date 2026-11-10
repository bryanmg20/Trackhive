-- HU-16: the rejection reason is free text written for the requester, so 25
-- characters are not enough. Same limit as the status change comment.
ALTER TABLE "requests" ALTER COLUMN "rejection_reason" SET DATA TYPE VARCHAR(500);

-- Added by hand: Prisma does not generate CHECK constraints.
-- A rejected request needs a reason that is not blank; any other status has none.
-- IS NOT NULL is explicit because a CHECK that evaluates to NULL passes.
ALTER TABLE "requests" DROP CONSTRAINT "requests_rejection_reason_check";
ALTER TABLE "requests" ADD CONSTRAINT "requests_rejection_reason_check" CHECK (
    ("status" = 'RECHAZADA' AND "rejection_reason" IS NOT NULL AND btrim("rejection_reason") <> '')
    OR
    ("status" <> 'RECHAZADA' AND "rejection_reason" IS NULL)
);
