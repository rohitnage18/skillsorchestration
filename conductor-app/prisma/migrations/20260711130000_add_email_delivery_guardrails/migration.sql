CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'NOT_CONFIGURED');

ALTER TABLE "Notification"
ADD COLUMN "emailStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "emailError" TEXT,
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

UPDATE "Notification"
SET "emailStatus" = 'SENT'
WHERE "emailSent" = true;

CREATE INDEX "Notification_emailStatus_idx" ON "Notification"("emailStatus");
CREATE INDEX "Notification_lastAttemptAt_idx" ON "Notification"("lastAttemptAt");
