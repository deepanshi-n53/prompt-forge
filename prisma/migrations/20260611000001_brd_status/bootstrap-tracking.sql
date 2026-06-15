-- Run this in Supabase SQL Editor AFTER running migration.sql
-- It registers the migration in Prisma's tracking table

INSERT INTO "_prisma_migrations" (
  id,
  checksum,
  finished_at,
  migration_name,
  logs,
  rolled_back_at,
  started_at,
  applied_steps_count
) VALUES (
  gen_random_uuid()::text,
  'c81b70f6258485545eef45d8b943986e837c9da966a3bffef71f890b26345626',
  now(),
  '20260611000001_brd_status',
  NULL,
  NULL,
  now(),
  1
);
