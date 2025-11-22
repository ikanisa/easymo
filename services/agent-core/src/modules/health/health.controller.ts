import { getAgentCoreControllerBasePath } from "@easymo/commons";
import { Controller, Get } from "@nestjs/common";

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
