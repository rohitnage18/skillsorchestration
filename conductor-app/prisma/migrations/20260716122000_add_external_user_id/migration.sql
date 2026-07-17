ALTER TABLE "User"
ADD COLUMN "externalUserId" TEXT;

CREATE UNIQUE INDEX "User_externalUserId_key" ON "User"("externalUserId");
CREATE INDEX "User_externalUserId_idx" ON "User"("externalUserId");
