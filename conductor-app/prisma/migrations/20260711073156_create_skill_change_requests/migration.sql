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
