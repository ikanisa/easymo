import { Controller, Get } from "@nestjs/common";
import { getAgentCoreControllerBasePath } from "@easymo/commons";

@Controller(getAgentCoreControllerBasePath("health"))
export class HealthController {
  @Get()
  ping() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
