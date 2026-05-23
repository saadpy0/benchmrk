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

## In Progress
- Test Phase 2 baseline endpoints thoroughly before moving to the next phase.
