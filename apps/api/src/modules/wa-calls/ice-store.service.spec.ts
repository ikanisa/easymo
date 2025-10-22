jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    lpush: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(true),
    rpop: jest.fn().mockResolvedValue(null),
  })),
);

jest.mock('../../common/env', () => ({
  env: {
    redisUrl: 'redis://localhost:6379',
  },
}));

const RedisMock = jest.requireMock('ioredis') as jest.Mock;

describe('IceStoreService', () => {
  const { IceStoreService } = require('./ice-store.service') as typeof import('./ice-store.service');
  let service: InstanceType<typeof IceStoreService>;
  const currentClient = () => (service as unknown as { client: ReturnType<typeof RedisMock> | null }).client;

  beforeEach(() => {
    RedisMock.mockClear();
    service = new IceStoreService();
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('instantiates Redis client and disconnects on destroy', async () => {
    expect(RedisMock.mock.calls[0][0]).toBe('redis://localhost:6379');
    await service.onModuleDestroy();
    const client = currentClient();
    expect(client).toBeNull();
    const lastInstance = RedisMock.mock.results.at(-1)?.value as {
      disconnect: jest.Mock;
    } | undefined;
    expect(lastInstance).toBeDefined();
    expect(lastInstance!.disconnect).toHaveBeenCalled();
  });

  it('pushes ICE candidate with TTL', async () => {
    await service.pushIce('CALL123', { candidate: 'abc' });
    const instance = currentClient();
    expect(instance?.lpush).toHaveBeenCalledWith('ice:CALL123', JSON.stringify({ candidate: 'abc' }));
    expect(instance?.expire).toHaveBeenCalledWith('ice:CALL123', 600);
  });

  it('pops ICE candidate when available', async () => {
    const instance = currentClient();
    expect(instance).toBeDefined();
    instance!.rpop.mockResolvedValueOnce(JSON.stringify({ candidate: 'xyz' }));
    const result = await service.popIce('CALLXYZ');
    expect(instance!.rpop).toHaveBeenCalledWith('ice:CALLXYZ');
    expect(result).toEqual({ candidate: 'xyz' });
  });
});
