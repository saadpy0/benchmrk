export const rebuildBaselineSchema = {
  body: {
    type: 'object',
    required: ['platform', 'accountAgeDays', 'posts'],
    properties: {
      platform: { type: 'string', enum: ['INSTAGRAM', 'YOUTUBE'] },
      accountAgeDays: { type: 'number', minimum: 0 },
      followerCount: { type: 'number', minimum: 0 },
      audienceIndiaPct: { type: 'number', minimum: 0, maximum: 100 },
      posts: {
        type: 'array',
        minItems: 1,
        maxItems: 30,
        items: {
          type: 'object',
          required: ['views', 'likes', 'comments'],
          properties: {
            views: { type: 'number', minimum: 0 },
            likes: { type: 'number', minimum: 0 },
            comments: { type: 'number', minimum: 0 },
          },
        },
      },
    },
  },
};
