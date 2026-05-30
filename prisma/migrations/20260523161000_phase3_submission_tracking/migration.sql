CREATE TYPE "TrackingJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "SubmissionTrackingJob" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "checkpointLabel" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "TrackingJobStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "processingStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubmissionTrackingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubmissionTrackingJob_submissionId_sequence_key" ON "SubmissionTrackingJob"("submissionId", "sequence");
CREATE INDEX "SubmissionTrackingJob_status_scheduledFor_idx" ON "SubmissionTrackingJob"("status", "scheduledFor");
CREATE INDEX "SubmissionTrackingJob_submissionId_scheduledFor_idx" ON "SubmissionTrackingJob"("submissionId", "scheduledFor");

ALTER TABLE "SubmissionTrackingJob"
ADD CONSTRAINT "SubmissionTrackingJob_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "ContentSubmission"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
