-- AlterTable: Add network identity fields to audit_logs
ALTER TABLE "audit_logs" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "actionCategory" TEXT NOT NULL DEFAULT 'SYSTEM';

-- CreateIndex: Composite index for admin chronological timeline per user
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId" DESC, "createdAt" DESC);

-- CreateIndex: Filter by action category
CREATE INDEX "audit_logs_actionCategory_idx" ON "audit_logs"("actionCategory");
