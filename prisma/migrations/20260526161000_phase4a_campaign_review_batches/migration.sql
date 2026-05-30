CREATE TYPE "ReviewBatchStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'MORE_INFO_REQUESTED');

ALTER TABLE "Campaign"
ADD COLUMN "minimumPayoutViews" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN "maxPayoutPerSubmission" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE "BalanceLedgerEntry"
ADD COLUMN "reviewBatchId" TEXT;

CREATE TABLE "SubmissionReviewBatch" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "cycleNumber" INTEGER NOT NULL,
  "windowOpenedAt" TIMESTAMP(3) NOT NULL,
  "reviewStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedFromViews" INTEGER NOT NULL,
  "lockedToViews" INTEGER NOT NULL,
  "incrementalViews" INTEGER NOT NULL,
  "grossAmount" DECIMAL(65,30) NOT NULL,
  "status" "ReviewBatchStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "adminNotes" TEXT,
  "moreInfoRequest" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubmissionReviewBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubmissionReviewBatch_submissionId_cycleNumber_key" ON "SubmissionReviewBatch"("submissionId", "cycleNumber");
CREATE INDEX "SubmissionReviewBatch_campaignId_cycleNumber_idx" ON "SubmissionReviewBatch"("campaignId", "cycleNumber");
CREATE INDEX "SubmissionReviewBatch_status_campaignId_createdAt_idx" ON "SubmissionReviewBatch"("status", "campaignId", "createdAt");
CREATE INDEX "BalanceLedgerEntry_reviewBatchId_idx" ON "BalanceLedgerEntry"("reviewBatchId");

ALTER TABLE "SubmissionReviewBatch"
ADD CONSTRAINT "SubmissionReviewBatch_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "ContentSubmission"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubmissionReviewBatch"
ADD CONSTRAINT "SubmissionReviewBatch_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BalanceLedgerEntry"
ADD CONSTRAINT "BalanceLedgerEntry_reviewBatchId_fkey"
FOREIGN KEY ("reviewBatchId") REFERENCES "SubmissionReviewBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
