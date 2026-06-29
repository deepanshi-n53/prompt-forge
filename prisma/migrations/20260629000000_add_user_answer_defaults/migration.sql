-- CreateTable
CREATE TABLE "UserAnswerDefault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAnswerDefault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAnswerDefault_userId_idx" ON "UserAnswerDefault"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnswerDefault_userId_field_key" ON "UserAnswerDefault"("userId", "field");

-- AddForeignKey
ALTER TABLE "UserAnswerDefault" ADD CONSTRAINT "UserAnswerDefault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
