-- Add DRAFT and PARSING to ProjectStatus so PROCESSING can mean active
-- generation ONLY (DRAFT = created, no BRD; PARSING = BRD being parsed).
-- Must be its own migration: Postgres can't use a newly-added enum value
-- (e.g. as a column default) in the same transaction that adds it.
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PARSING';
