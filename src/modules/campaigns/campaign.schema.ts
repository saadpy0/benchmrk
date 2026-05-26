export const createCampaignSchema = {
    body: {
      type: 'object',
      required: ['title', 'description', 'guidelines', 'cpvRate', 'totalBudget', 'startDate', 'endDate'],
      properties: {
        title:       { type: 'string', minLength: 3 },
        description: { type: 'string' },
        guidelines:  { type: 'string' },
        cpvRate:     { type: 'number' },
        totalBudget: { type: 'number' },
        minimumPayoutViews: { type: 'number', minimum: 0 },
        maxPayoutPerSubmission: { type: 'number', minimum: 0 },
        startDate:   { type: 'string' },
        endDate:     { type: 'string' },
      },
    },
  };
  
  export const updateStatusSchema = {
    body: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['PENDING_REVIEW', 'LIVE', 'REJECTED', 'PAUSED', 'COMPLETED'] },
      },
    },
  };