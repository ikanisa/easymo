import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { FeatureFlagGuard } from "../src/common/guards/feature-flag.guard";

class ReflectorStub extends Reflector {
  constructor(private readonly permissions: string[] | undefined) {
    super();
  }

  override getAllAndOverride<T>(key: string): T {
    return this.permissions as unknown as T;
  }
}

describe("FeatureFlagGuard", () => {
  const original = process.env.FEATURE_AGENT_COLLECTPAYMENT;

  afterAll(() => {
    process.env.FEATURE_AGENT_COLLECTPAYMENT = original;
  });

  it("allows requests when flag is enabled", () => {
    process.env.FEATURE_AGENT_COLLECTPAYMENT = "1";
    const guard = new FeatureFlagGuard(new ReflectorStub(["agent.collectPayment"])) as any;
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    expect(guard.canActivate(context)).toBe(true);
  });

  it("blocks requests when flag is disabled", () => {
    process.env.FEATURE_AGENT_COLLECTPAYMENT = "0";
    const guard = new FeatureFlagGuard(new ReflectorStub(["agent.collectPayment"])) as any;
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
