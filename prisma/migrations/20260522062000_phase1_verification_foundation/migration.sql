-- CreateEnum
CREATE TYPE "BalanceEntryType" AS ENUM ('ACCRUAL_PENDING', 'RELEASE_TO_AVAILABLE', 'WITHDRAWAL', 'REVERSAL', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BalanceEntryStatus" AS ENUM ('PENDING', 'AVAILABLE', 'RELEASED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CreatorBaseline" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 30,
    "avgViews" DOUBLE PRECISION NOT NULL,
    "avgLikes" DOUBLE PRECISION NOT NULL,
    "avgComments" DOUBLE PRECISION NOT NULL,
    "avgEngagementRate" DOUBLE PRECISION NOT NULL,
    "followerCount" INTEGER,
    "audienceIndiaPct" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL,
    "likeCount" INTEGER,
    "commentCount" INTEGER,
    "shareCount" INTEGER,
    "engagementRatio" DOUBLE PRECISION,
    "geographicIndiaPct" DOUBLE PRECISION,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorWallet" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "pendingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lifetimeEarned" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "submissionId" TEXT,
    "entryType" "BalanceEntryType" NOT NULL,
    "status" "BalanceEntryStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(65,30) NOT NULL,
    "holdUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "BalanceLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorBaseline_creatorId_platform_key" ON "CreatorBaseline"("creatorId", "platform");

-- CreateIndex
CREATE INDEX "MetricSnapshot_submissionId_capturedAt_idx" ON "MetricSnapshot"("submissionId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorWallet_creatorId_key" ON "CreatorWallet"("creatorId");

-- CreateIndex
CREATE INDEX "BalanceLedgerEntry_walletId_createdAt_idx" ON "BalanceLedgerEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "BalanceLedgerEntry_submissionId_idx" ON "BalanceLedgerEntry"("submissionId");

-- AddForeignKey
ALTER TABLE "CreatorBaseline" ADD CONSTRAINT "CreatorBaseline_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ContentSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorWallet" ADD CONSTRAINT "CreatorWallet_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLedgerEntry" ADD CONSTRAINT "BalanceLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreatorWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLedgerEntry" ADD CONSTRAINT "BalanceLedgerEntry_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ContentSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
