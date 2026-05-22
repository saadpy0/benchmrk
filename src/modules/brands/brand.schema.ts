export const createBrandProfileSchema = {
    body: {
      type: 'object',
      required: ['companyName'],
      properties: {
        companyName: { type: 'string', minLength: 2 },
        gstNumber: { type: 'string' },
      },
    },
  };