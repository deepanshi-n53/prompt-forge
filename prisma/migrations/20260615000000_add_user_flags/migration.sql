-- Add isNewUser and isInternalUser flags to User table

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isNewUser" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isInternalUser" BOOLEAN NOT NULL DEFAULT false;
