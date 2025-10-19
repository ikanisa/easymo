import type { Request } from "express";
import type { AgentContext } from "@easymo/commons";

export type AgentRequest = Request & {
  agent?: AgentContext;
};
