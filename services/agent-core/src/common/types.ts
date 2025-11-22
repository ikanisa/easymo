import type { AgentContext } from "@easymo/commons";
import type { Request } from "express";

export type AgentRequest = Request & {
  agent?: AgentContext;
};
