-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "public";

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('SELF_EMPLOYED', 'SOLE_PROPRIETOR', 'LLC');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('SIMPLIFIED_DECLARATION', 'GENERAL_REGIME', 'PATENT', 'ESP');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'PRO_AI');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'KASPI', 'HALYK', 'FORTE', 'OTHER_BANK');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('SERVICES_INCOME', 'GOODS_INCOME', 'RENT_INCOME', 'CONSULTING_INCOME', 'FREELANCE_INCOME', 'OFFICE_EXPENSES', 'EQUIPMENT_EXPENSES', 'MARKETING_EXPENSES', 'SALARY_EXPENSES', 'TRANSPORT_EXPENSES', 'UTILITIES_EXPENSES', 'OTHER_EXPENSES', 'UNCATEGORIZED');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('DRAFT', 'READY', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeclarationPeriodType" AS ENUM ('QUARTER', 'YEAR', 'MONTH');

-- CreateEnum
CREATE TYPE "DeclarationFormType" AS ENUM ('FORM_200', 'FORM_910', 'FORM_912', 'ESP');

-- CreateEnum
CREATE TYPE "BankProvider" AS ENUM ('KASPI', 'HALYK', 'FORTE', 'OTHER');

-- CreateEnum
CREATE TYPE "BankConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'SYNCING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "iin" TEXT,
    "businessType" "BusinessType" NOT NULL DEFAULT 'SELF_EMPLOYED',
    "taxRegime" "TaxRegime" NOT NULL DEFAULT 'SIMPLIFIED_DECLARATION',
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "telegramChatId" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "telegramNotifications" BOOLEAN NOT NULL DEFAULT false,
    "notifyDaysBefore" INTEGER[] DEFAULT ARRAY[14, 7, 2]::INTEGER[],
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL DEFAULT 'UNCATEGORIZED',
    "description" TEXT NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declarations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "periodType" "DeclarationPeriodType" NOT NULL,
    "formType" "DeclarationFormType" NOT NULL,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "calculation" JSONB,
    "pdfUrl" TEXT,
    "eGovConfirmationCode" TEXT,
    "submittedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "provider" "BankProvider" NOT NULL,
    "accountMask" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "BankConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_iin_key" ON "users"("iin");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "transactions_userId_date_idx" ON "transactions"("userId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_userId_type_idx" ON "transactions"("userId", "type");

-- CreateIndex
CREATE INDEX "transactions_userId_category_idx" ON "transactions"("userId", "category");

-- CreateIndex
CREATE INDEX "transactions_userId_deletedAt_idx" ON "transactions"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_userId_externalId_key" ON "transactions"("userId", "externalId");

-- CreateIndex
CREATE INDEX "declarations_userId_status_idx" ON "declarations"("userId", "status");

-- CreateIndex
CREATE INDEX "declarations_userId_deletedAt_idx" ON "declarations"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "declarations_userId_period_formType_key" ON "declarations"("userId", "period", "formType");

-- CreateIndex
CREATE INDEX "bank_connections_userId_idx" ON "bank_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_connections_userId_provider_key" ON "bank_connections"("userId", "provider");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declarations" ADD CONSTRAINT "declarations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
