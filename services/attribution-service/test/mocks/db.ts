export class PrismaService {
  quote = {
    update: async (_args?: unknown) => ({ id: "mock-quote" }),
  };

  attributionEvidence = {
    create: async (_args?: unknown) => ({ id: "mock-evidence" }),
  };

  dispute = {
    create: async (_args?: unknown) => ({ id: "mock-dispute" }),
  };

  async $connect() {
    return Promise.resolve();
  }

  async $disconnect() {
    return Promise.resolve();
  }
}
