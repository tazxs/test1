-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionCategory" ADD VALUE 'DIVIDEND_INCOME';
ALTER TYPE "TransactionCategory" ADD VALUE 'INTEREST_INCOME';
ALTER TYPE "TransactionCategory" ADD VALUE 'ASSET_SALE_INCOME';
ALTER TYPE "TransactionCategory" ADD VALUE 'OTHER_INCOME';
ALTER TYPE "TransactionCategory" ADD VALUE 'INSURANCE_EXPENSES';
ALTER TYPE "TransactionCategory" ADD VALUE 'TAX_EXPENSES';
ALTER TYPE "TransactionCategory" ADD VALUE 'BANK_EXPENSES';
ALTER TYPE "TransactionCategory" ADD VALUE 'REPAIR_EXPENSES';
ALTER TYPE "TransactionCategory" ADD VALUE 'SUBSCRIPTION_EXPENSES';
