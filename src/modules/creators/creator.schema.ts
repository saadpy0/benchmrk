export const createProfileSchema = {
    body: {
      type: 'object',
      required: ['displayName'],
      properties: {
        displayName: { type: 'string', minLength: 2 },
        bio: { type: 'string' },
      },
    },
  };