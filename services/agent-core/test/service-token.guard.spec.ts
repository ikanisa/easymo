import { ConfigService } from "@nestjs/config";
import { ServiceTokenGuard } from "../src/common/guards/service-token.guard";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

const createExecutionContext = (headers: Record<string, string>): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({ headers }),
  }),
  getHandler: () => ({}),
  getClass: () => ({}),
} as ExecutionContext);

const reflectorWithScopes = (scopes?: string[]) => {
  const reflector = new Reflector();
  jest.spyOn(reflector, "getAllAndOverride").mockImplementation(() => scopes ?? undefined);
  return reflector;
};

describe("ServiceTokenGuard", () => {
  const audience = "agent-core";
  const configService = {
    get: jest.fn(() => audience),
  } as unknown as ConfigService;

  beforeAll(() => {
    process.env.SERVICE_JWT_KEYS = "test-secret";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const sign = async (scopes: string[]) => {
    const { signServiceJwt } = require("@easymo/commons");
    return await signServiceJwt({ audience, scope: scopes });
  };

  it("allows requests with required scopes", async () => {
    const token = await sign(["tasks:schedule"]);
    const guard = new ServiceTokenGuard(reflectorWithScopes(["tasks:schedule"]), configService);
    const can = await guard.canActivate(createExecutionContext({ authorization: `Bearer ${token}` }));
    expect(can).toBe(true);
  });

  it("rejects missing Authorization header", async () => {
    const guard = new ServiceTokenGuard(reflectorWithScopes(["tasks:run"]), configService);
    await expect(guard.canActivate(createExecutionContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects missing scopes", async () => {
    const token = await sign(["tasks:schedule"]);
    const guard = new ServiceTokenGuard(reflectorWithScopes(["tasks:run"]), configService);
    await expect(
      guard.canActivate(createExecutionContext({ authorization: `Bearer ${token}` })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
