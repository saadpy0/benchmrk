# Phase 4 Answers

## Earnings model
- The brand decides the payout rate per views for every campaign.
- Example: `$1 for 1000 views`.
- Each campaign also has:
  - minimum views required to earn
  - maximum amount a creator can earn from one video
- This formula structure applies to all campaigns.
- These values are configurable by the brand.

## Pending balance behavior
- Money should stay in `pending` and keep compounding as each snapshot is taken.
- Actual payment depends on later view verification.
- Regardless of whether views drop, the pending payment shown remains the same, with the messaging that actual payment depends on verification.

## Review and verification model
- All videos and views are always subject to review.
- Phase 3 should not automatically classify videos or views as `VERIFIED` or `REVIEW`.
- Phase 3 should only:
  - capture metrics from posting time until checking stops
  - analyze patterns
  - suggest to the admin/checker whether the behavior looks botted or suspicious
- Every video goes through a review period.
- Videos should not stay under review forever; the admin/checker resolves them during the review period.
- Admin has full control during the review window.

## Review-period / hold behavior
- The example 10-day wait period was for testing.
- The exact earning duration and the exact moment the wait period starts still need product clarification.
- After a video is verified and after the wait period, money moves from pending to withdrawable balance.

## Payout methods
- For now: wallet simulation for testing.
- Later: likely support multiple payment methods.
