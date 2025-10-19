import { AgentKind } from "@easymo/commons";

export type AgentChatRequest = {
  agentKind: AgentKind;
  message: string;
  sessionId?: string;
  profileRef?: string;
};
