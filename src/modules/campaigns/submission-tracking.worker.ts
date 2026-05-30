import type { FastifyBaseLogger } from 'fastify';
import { processDueTrackingJobs } from './submission-tracking.service.js';

function getTrackerPollIntervalMs() {
  const rawValue = process.env.SUBMISSION_TRACKER_POLL_MS?.trim();
  if (!rawValue) {
    return process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 60 * 1000;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function startSubmissionTrackingWorker(logger: FastifyBaseLogger) {
  const intervalMs = getTrackerPollIntervalMs();
  if (intervalMs <= 0) {
    logger.info('Submission tracking worker disabled');
    return () => {};
  }

  let isRunning = false;

  const runPoll = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      const result = await processDueTrackingJobs({ maxJobs: 25 });
      if (result.processedCount > 0 || result.failedCount > 0) {
        logger.info({ result }, 'Submission tracking worker processed jobs');
      }
    } catch (error) {
      logger.error(error, 'Submission tracking worker failed');
    } finally {
      isRunning = false;
    }
  };

  logger.info({ intervalMs }, 'Submission tracking worker started');
  void runPoll();

  const timer = setInterval(() => {
    void runPoll();
  }, intervalMs);

  return () => clearInterval(timer);
}
