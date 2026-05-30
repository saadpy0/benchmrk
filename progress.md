# Progress

## Completed

### Phase 1: Core Database & Verification Schema
- Added `CreatorBaseline` model for creator historical benchmarks.
- Added `MetricSnapshot` model for submission time-series metrics.
- Added `CreatorWallet` and `BalanceLedgerEntry` models for held and available balance tracking.
- Added the supporting Prisma migration and applied it successfully.

### Repository Configuration Stabilization
- Fixed the package/runtime alignment by switching the project to ESM.
- Updated TypeScript config to include Node types under the existing NodeNext setup.
- Cleaned the import style issues required by `verbatimModuleSyntax`.
- Added a new `auth.ts` middleware and rewired auth imports so the repo builds cleanly without terminal-side scripted edits.
- Regenerated Prisma Client and verified that TypeScript compilation passes.

### Phase 2: Baseline Profiler
- Added baseline rebuild request schema.
- Added baseline service to calculate average views, engagement rate, consistency score, and trust score.
- Added baseline routes to rebuild and fetch a creator baseline.
- Added a lightweight Fastify-served Phase 2 test page at `/dev/phase2`.
- Added a live YouTube baseline rebuild path using public channel data from the YouTube Data API.
- Added Google OAuth YouTube ownership verification routes and persisted connected YouTube accounts in the database.
- Added baseline rebuild support using the stored connected YouTube account instead of a typed channel input.
- Added Instagram professional-account OAuth linking, connected account persistence, and connected-account baseline rebuild support.
- Wired creator profile creation to initialize a wallet automatically.
- Registered the baseline routes in the Fastify server.
- Verified that Prisma schema validation passes with the new Phase 2 code in place.

### Phase 3: Continuous Tracking Engine (YouTube current scope)
- Added submission tracking jobs and metric snapshot persistence for submitted YouTube videos.
- Added automatic background polling with an immediate startup check and dev-friendly polling cadence.
- Added a streamlined `/dev/phase2` tester that bootstraps hidden dev campaign/application state and supports direct YouTube submission tracking.
- Added manual track-now, run-due, and old-submissions inspection flows for testing historical submissions.
- Added a 10-minute dev checkpoint schedule through a 2-hour observation window for validating continuous tracking behavior.
- Fixed checkpoint progression so manual captures also complete the correct scheduled job.
- Added a conservative YouTube verifier that only marks a video `VERIFIED` when the observed growth pattern stays clean; otherwise it remains in `UNDER_REVIEW`.
- Improved the dev output formatting to show snapshot history, growth deltas, baseline comparison, verdict, and reasons.

## In Progress
- Phase 4 roadmap work remains: 72-hour / longer-horizon production scheduling, payout hold maturation, and admin review queue integration.
