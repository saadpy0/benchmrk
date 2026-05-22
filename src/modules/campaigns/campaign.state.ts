import type { CampaignStatus } from '@prisma/client';

const transitions: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT:          ['PENDING_REVIEW'],
  PENDING_REVIEW: ['LIVE', 'REJECTED'],
  LIVE:           ['PAUSED', 'COMPLETED'],
  PAUSED:         ['LIVE', 'COMPLETED'],
  COMPLETED:      [],
  REJECTED:       [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}