-- New projects start as DRAFT (created, no BRD uploaded yet) instead of
-- PROCESSING, so a freshly-named project is never shown as "generating".
-- Runs after the enum values are committed by the previous migration.
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
