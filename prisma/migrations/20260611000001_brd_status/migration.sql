-- Migration: add BRDStatus enum, BRD.status, BRD.parsedContent,
--            ProjectStatus.PARSED, Project.archetypeConfidence

-- 1. New enum types
CREATE TYPE "BRDStatus" AS ENUM ('PENDING', 'PARSED', 'FAILED');

-- 2. Add PARSED to existing ProjectStatus enum
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PARSED';

-- 3. Add status column to BRD (defaults to PENDING for existing rows)
ALTER TABLE "BRD" ADD COLUMN IF NOT EXISTS "status" "BRDStatus" NOT NULL DEFAULT 'PENDING';

-- 4. Rename parsedData -> parsedContent (the original column may not exist yet if schema was never in sync)
--    Safe pattern: add the new column, ignore if parsedData never existed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BRD' AND column_name = 'parsedData'
  ) THEN
    ALTER TABLE "BRD" RENAME COLUMN "parsedData" TO "parsedContent";
  ELSE
    ALTER TABLE "BRD" ADD COLUMN IF NOT EXISTS "parsedContent" JSONB;
  END IF;
END $$;

-- 5. Add archetypeConfidence to Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "archetypeConfidence" DOUBLE PRECISION;
