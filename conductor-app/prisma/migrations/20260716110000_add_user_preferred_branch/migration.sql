ALTER TABLE "User"
ADD COLUMN "preferredBranch" TEXT;

CREATE INDEX "User_preferredBranch_idx" ON "User"("preferredBranch");
