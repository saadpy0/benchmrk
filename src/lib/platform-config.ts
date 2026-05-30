/**
 * In-memory platform configuration.
 * Toggled at runtime via admin API endpoints.
 * Resets to defaults on server restart.
 */

export const platformConfig = {
  campaignReviewRequired: true, // when true, brand campaigns go to PENDING_REVIEW before LIVE
};
