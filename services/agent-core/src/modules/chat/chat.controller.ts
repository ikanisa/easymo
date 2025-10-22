import { Body, Controller, Post } from "@nestjs/common";
import { ChatService } from "./chat.service.js";
import { ChatRequestSchema } from "./types.js";
import { agentCoreControllerBasePath, getAgentCoreRouteSegment } from "@easymo/commons";

@Controller(agentCoreControllerBasePath)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post(getAgentCoreRouteSegment("respond"))
  async respond(@Body() body: unknown) {
    const payload = ChatRequestSchema.parse(body);
    const result = await this.chat.generateReply({
      sessionId: payload.session_id,
      agentKind: payload.agent_kind,
      message: payload.message,
      profileRef: payload.profile_ref ?? null,
      history: payload.history ?? [],
      toolkit: payload.toolkit ?? null,
    });
    return result;
  }
}
