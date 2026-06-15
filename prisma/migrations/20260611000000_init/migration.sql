-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PROFESSIONAL', 'AGENCY', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PROCESSING', 'READY', 'ERROR', 'UPDATING');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('FAST', 'FULL');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('GENERATED', 'OUTDATED', 'APPLIED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ChangeEventStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PROCESSING',
    "archetype" TEXT,
    "track" "Track" NOT NULL DEFAULT 'FAST',
    "ownerId" TEXT NOT NULL,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BRD" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "rawText" TEXT,
    "healthScore" INTEGER,
    "healthDetail" JSONB,
    "parsedData" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BRD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionGraph" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "decisions" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedPrompt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionNum" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'GENERATED',
    "confidence" DOUBLE PRECISION,
    "assumptions" JSONB,
    "brdVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigmaLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "figmaUrl" TEXT NOT NULL,
    "parsedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FigmaLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "oldBrdId" TEXT NOT NULL,
    "newBrdId" TEXT NOT NULL,
    "changeAnalysis" JSONB NOT NULL,
    "status" "ChangeEventStatus" NOT NULL DEFAULT 'PENDING',
    "deltaPrompts" JSONB,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_clerkOrgId_key" ON "Organisation"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE INDEX "BRD_projectId_idx" ON "BRD"("projectId");

-- CreateIndex
CREATE INDEX "BRD_projectId_version_idx" ON "BRD"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionGraph_projectId_key" ON "DecisionGraph"("projectId");

-- CreateIndex
CREATE INDEX "GeneratedPrompt_projectId_idx" ON "GeneratedPrompt"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPrompt_projectId_sectionNum_brdVersion_key" ON "GeneratedPrompt"("projectId", "sectionNum", "brdVersion");

-- CreateIndex
CREATE INDEX "ChangeEvent_projectId_idx" ON "ChangeEvent"("projectId");

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BRD" ADD CONSTRAINT "BRD_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionGraph" ADD CONSTRAINT "DecisionGraph_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPrompt" ADD CONSTRAINT "GeneratedPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FigmaLink" ADD CONSTRAINT "FigmaLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
