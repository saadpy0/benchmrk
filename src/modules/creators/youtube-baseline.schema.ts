export const rebuildYoutubeBaselineSchema = {
  body: {
    type: 'object',
    required: ['channelInput'],
    properties: {
      channelInput: { type: 'string', minLength: 1 },
      maxResults: { type: 'number', minimum: 1, maximum: 30 },
    },
  },
};
