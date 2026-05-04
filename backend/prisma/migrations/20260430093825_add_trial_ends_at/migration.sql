-- AlterTable
ALTER TABLE "users" ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tax_law_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "articleNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_law_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_law_chunks_articleNumber_idx" ON "tax_law_chunks"("articleNumber");
