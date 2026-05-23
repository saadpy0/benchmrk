export const rebuildConnectedInstagramBaselineSchema = {
  body: {
    type: 'object',
    properties: {
      maxResults: { type: 'number', minimum: 1, maximum: 30 },
    },
  },
};
