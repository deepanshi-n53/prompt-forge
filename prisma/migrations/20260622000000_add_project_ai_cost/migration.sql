-- Add accumulated AI cost tracking to Project

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiGenerationRuns" INTEGER NOT NULL DEFAULT 0;
