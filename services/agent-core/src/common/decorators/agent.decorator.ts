import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AgentContext } from "@easymo/commons";
import type { AgentRequest } from "../types.js";

export const AgentCtx = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AgentContext => {
    const request = ctx.switchToHttp().getRequest<AgentRequest>();
    if (!request.agent) {
      throw new Error("Agent context missing on request");
    }
    return request.agent;
  },
);
