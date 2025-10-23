export class IdempotencyStore {
  constructor(_options?: unknown) {}

  async connect() {
    return Promise.resolve();
  }

  async disconnect() {
    return Promise.resolve();
  }

  async execute<T>(_key: string, handler: () => Promise<T>): Promise<T> {
    return await handler();
  }
}

export class KafkaFactory {
  constructor(_options?: unknown) {}

  createProducer() {
    return {
      connect: async () => {},
      disconnect: async () => {},
      send: async () => {},
    };
  }
}
