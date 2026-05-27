# Benchmrk Project Report

## Overview

Benchmrk is being built as a performance-based creator campaign platform. The core idea is to let brands launch campaigns with clear payout rules, allow creators to submit content into those campaigns, continuously track how that content performs over time, and then route eligible earnings through an internal review and payout workflow. Up to this point, the work has focused on turning that idea into a usable end-to-end system rather than just a loose prototype. We now have the major backbone pieces in place: user accounts, creator and brand profiles, campaign setup, creator submission flow, metric tracking, admin review sweeps, wallet-related foundations, and a basic creator-facing dashboard experience.

This report summarizes what has been completed so far, how the system is structured, and what product behavior is already working today.

## Product Direction

The product is designed around a simple operating model:

1. Brands create campaigns with budgets and payment rules.
2. Creators join and submit public content.
3. The system tracks view growth and related metrics through time-based snapshots.
4. Admin reviewers inspect eligible earning windows instead of paying blindly.
5. The platform eventually converts reviewed performance into creator balances and payouts.

That means the product is not just a campaign listing board and not just a payout tool. It is being shaped as a controlled marketplace with verification, performance tracking, trust signals, and operational review built into the core workflow.

## Technical Foundation Established Early

One of the first important steps was stabilizing the repository and runtime foundation. The project was aligned to ESM, TypeScript configuration was cleaned up to match the NodeNext environment, import issues were resolved, and Prisma client generation plus TypeScript compilation were brought into a healthy state. A dedicated JWT auth middleware was added and route registration was organized through the Fastify server entrypoint. This was an important base layer because nearly every later feature depends on a stable runtime, clean auth wiring, and a predictable server structure.

Today the Fastify server acts as the main application shell and registers route groups for authentication, creator workflows, brand workflows, campaigns, applications, submissions, admin flows, payouts, analytics, OAuth integrations, and the newer creator portal experience. That gives the codebase a modular structure where each domain can evolve without collapsing into one large server file.

## Data Model and Schema Work

The database schema has been expanded far beyond a simple user table. The current schema already reflects the product direction in a meaningful way.

At the identity level, the system supports `User`, `CreatorProfile`, and `BrandProfile`. This separates authentication concerns from platform role data. Connected social or platform accounts are stored in `ConnectedPlatformAccount`, which is especially important for ownership verification and baseline analysis.

For campaign operations, the system includes:

- `Campaign`
- `Application`
- `ContentSubmission`
- `SubmissionReviewBatch`

For measurement and trust, it includes:

- `CreatorBaseline`
- `MetricSnapshot`
- `SubmissionTrackingJob`

For money movement and balances, it includes:

- `CreatorWallet`
- `BalanceLedgerEntry`
- `EarningsWallet`
- `Payout`

This schema is significant because it shows that the project has already moved into a real platform shape. Campaigns are not just static posts; they have payout rules. Submissions are not just links; they accumulate snapshots and review batches. Wallets are not just a single balance field; there is already a foundation for pending, available, and lifetime earnings with ledger-backed accounting.

## Phase 1 and Phase 2: Creator Trust and Baselines

A major part of the early product strategy has been creator verification and baseline building. Rather than treating every submitted video in isolation, the platform captures a creator’s historical context. The `CreatorBaseline` model supports storage of average views, engagement rate, sample size, and other comparison metrics. This lets the system reason about whether future performance looks normal or suspicious relative to that creator’s usual behavior.

The baseline flow was then connected to real account linking. Google OAuth and Instagram professional account linking were added so creators can connect social identities rather than manually typing arbitrary channel details. Those connected accounts are persisted and can be reused for baseline rebuilds. This improves both product usability and trust quality.

A lightweight test environment was also created at `/dev/phase2`. This dev page became the main proving ground for much of the product logic. It originally supported baseline and tracking tests, but over time it evolved into a broader simulation environment for brand campaign creation, creator submission, and admin review behavior.

## Continuous Tracking Engine

The system now has a meaningful tracking engine for submitted content. When a creator submits a video, the platform schedules tracking jobs across a timeline and persists metric snapshots as those jobs execute. In development mode, the cadence is intentionally shortened so behavior can be tested quickly. This includes a dev-friendly checkpoint schedule across a short observation window, plus background polling and manual triggering tools.

The tracking layer is important for two reasons.

First, it creates the raw data needed to estimate value over time. A submission is no longer judged only at upload time. Instead, the product watches performance evolve.

Second, it enables review logic and creator reporting. Snapshots drive what the admin side sees and what the creator side can interpret as pending earnings.

The system also includes a conservative verification posture. Submitted content is not automatically trusted just because views exist. Growth patterns and tracking results inform whether a submission remains under review or can be treated more confidently. This is a critical design choice because the platform is meant to support payout decisions, not just display vanity metrics.

## Brand Campaign Configuration and Dev Campaign Flow

The dev campaign flow has been expanded into a more complete brand-side simulation. Brands can now create live campaigns with the core commercial settings needed for a performance marketplace:

- campaign title and description
- campaign guidelines
- total budget
- payout rate expressed as dollars per 1000 views
- maximum payout per video
- minimum view threshold for payout eligibility

The campaign model stores this using fields such as `cpvRate`, `totalBudget`, `minimumPayoutViews`, and `maxPayoutPerSubmission`. In development mode, campaigns created through `/dev/phase2` go live immediately and become eligible for the admin sweep after a shortened interval. This has been useful for validating the entire lifecycle quickly.

An important refinement made during this work was clarifying what the minimum view threshold actually means. The logic was first interpreted against total views, but was then intentionally changed to use **incremental views per sweep window**. That means a video only enters a new admin review sweep if the newly accumulated views since the last locked review window meet the campaign minimum. This better matches the business rule that very small increments should not keep surfacing for manual review or payment consideration.

## Admin Review Sweep Model

The admin review side has been pushed significantly forward. The platform now has a sweep model that groups eligible performance into review batches. Each review batch records:

- the submission and campaign
- the review window timing
- locked starting and ending views
- incremental views for that window
- the gross amount tied to that increment
- the review status

The review queue logic now supports a shorter dev/testing interval and a production-oriented interval. Conceptually, the admin side does not continuously pay on every tracked change. Instead, it periodically opens a review window and creates review batches for content that meets the configured rules.

The most important recent behavior change in this area was making the admin queue respect **incremental eligibility thresholds**. If a campaign requires, for example, 1500 minimum views in a sweep window, then a video that only grew by 500 views since the last review window should not appear in the new admin review queue, even if its total lifetime views are much higher. This keeps the review process aligned with payout value instead of raw lifetime popularity.

The review layer also accounts for per-video payout caps and prevents repeated overpayment by checking how much value has already been locked for a submission.

## Creator Portal and Account Experience

A major addition beyond the internal dev tester is the new creator portal. Rather than relying only on a hidden dev bootstrap flow, the project now has a basic creator-facing web app at `/creator/app`.

This portal reuses the existing `User` and `CreatorProfile` models instead of introducing duplicate auth tables. From a product perspective, that means the system now supports a more natural creator entry flow:

- sign up as a creator
- log in with email and password
- automatically ensure a creator profile and wallet records exist
- browse live campaigns
- submit a video to a selected campaign
- review submission history and pending earnings

This is a meaningful step because it shifts the project from an internal testing setup toward an actual user-facing experience.

The creator portal also intentionally reduces friction in the current phase by auto-accepting a creator’s application when they submit to a live campaign from the portal. This is a practical development decision that allows the end-to-end flow to be exercised while a more complete campaign application lifecycle can be refined later.

## Creator Dashboard and Pending Earnings

The creator dashboard is now doing more than listing submissions. It calculates a live-looking estimate of pending value based on the latest tracked snapshot and the campaign’s CPV configuration.

In practical terms, the dashboard pulls each submission’s latest snapshot, reads the campaign payout rate, applies any per-submission cap, subtracts value already moved into verified review batches, and presents the remainder as pending. The dashboard also exposes totals such as submission count, tracked views, total projected value, pending amount, and a placeholder withdrawable amount that is intentionally held at zero for now.

This is an important milestone because it creates the beginnings of the creator financial experience. Even before full withdrawal and maturation logic is finished, creators can already see how performance connects to earnings.

## Analytics, Payout Foundations, and Platform Observability

The project also includes route groups and services for analytics and payouts. Creator, brand, and platform analytics endpoints exist, and payout-related models and services are already in place. While the final withdrawable flow is not complete yet, the architecture clearly anticipates it. There is already separation between wallet states, payout history, and administrative payout actions.

This means the project is not only thinking about front-end flows, but also about back-office operability and financial state transitions. That is important for any product in which creator earnings and brand budgets matter.

## Current State of the Product

At this stage, Benchmrk can be described as an early but coherent vertical slice of the full product vision. A brand can define a campaign with commercial constraints. A creator can sign up, log in, browse available campaigns, submit a piece of content, and see tracked performance reflected in a dashboard. The system can capture snapshots over time, estimate pending value, and route eligible performance into an admin review queue using incremental view rules and payout caps.

That is a strong foundation because the essential product loop is now visible:

- define campaign economics
- bring in creators
- submit content
- observe performance growth
- surface reviewable earnings
- prepare for payout handling

## Remaining Work and Likely Next Steps

The project still has important work ahead. Production-grade scheduling horizons, payout maturation, withdrawable balance movement, richer creator application workflows, and more complete admin tooling remain on the roadmap. There is also room to improve user experience, harden validation, and expand platform integrations.

However, the current implementation already demonstrates the product’s core value proposition in a working form. The project is no longer only an idea or an isolated backend experiment. It has become a connected system with real data structures, route flows, review mechanics, and user-facing surfaces that reflect the intended business model.

## Summary

So far, the work on Benchmrk has focused on building the foundations of a creator-performance marketplace with trust, measurement, review, and payout logic embedded into the product from the start. The team has established a stable technical base, designed a rich schema, implemented creator baseline and tracking systems, built dev and creator-facing interfaces, expanded campaign configuration, added incremental-view-based admin review sweeps, and introduced a basic earnings-aware creator dashboard. In short, the product has moved from concept validation into the first meaningful version of an operational platform.
