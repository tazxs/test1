-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accessUntil" TIMESTAMP(3),
ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true;
