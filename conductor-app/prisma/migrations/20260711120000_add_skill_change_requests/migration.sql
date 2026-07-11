DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkillChangeRequestType') THEN
    CREATE TYPE "SkillChangeRequestType" AS ENUM (
      'SKILL_CREATE',
      'SKILL_IMPORT',
      'SKILL_FILE_UPDATE'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkillChangeRequestStatus') THEN
    CREATE TYPE "SkillChangeRequestStatus" AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SkillChangeRequest" (
  "id" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "type" "SkillChangeRequestType" NOT NULL,
  "status" "SkillChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "resourceId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "SkillChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SkillChangeRequest_requestedById_idx" ON "SkillChangeRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "SkillChangeRequest_reviewedById_idx" ON "SkillChangeRequest"("reviewedById");
CREATE INDEX IF NOT EXISTS "SkillChangeRequest_type_idx" ON "SkillChangeRequest"("type");
CREATE INDEX IF NOT EXISTS "SkillChangeRequest_status_idx" ON "SkillChangeRequest"("status");
CREATE INDEX IF NOT EXISTS "SkillChangeRequest_createdAt_idx" ON "SkillChangeRequest"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SkillChangeRequest_requestedById_fkey'
  ) THEN
    ALTER TABLE "SkillChangeRequest"
    ADD CONSTRAINT "SkillChangeRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SkillChangeRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "SkillChangeRequest"
    ADD CONSTRAINT "SkillChangeRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
