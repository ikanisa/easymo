import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { TasksService } from "./tasks.service.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { ServiceScopes } from "../../common/decorators/service-scopes.decorator.js";
import {
  getAgentCoreControllerBasePath,
  getAgentCoreRouteSegment,
  getAgentCoreRouteServiceScopes,
} from "@easymo/commons";

const ScheduleSchema = z.object({
  tenantId: z.string().uuid(),
  contactRef: z.string().min(1),
  type: z.enum([
    "BROKER_WHATSAPP",
    "SALES_WHATSAPP",
    "MARKETING_WHATSAPP",
    "SUPPORT_WHATSAPP",
    "VOICE_COLD_CALL",
    "VOICE_SALES_CALL",
    "VOICE_MARKETING_CALL",
    "VOICE_BROKER_CALL",
  ]),
  payload: z.record(z.any()),
  scheduledAt: z.coerce.date().optional(),
});

@Controller(getAgentCoreControllerBasePath("aiTasks"))
@UseGuards(ServiceTokenGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post(getAgentCoreRouteSegment("aiTasksSchedule"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiTasksSchedule"))
  async schedule(@Body() body: unknown) {
    const payload = ScheduleSchema.parse(body) as Parameters<TasksService["scheduleTask"]>[0];
    return await this.tasks.scheduleTask(payload);
  }

  @Post(getAgentCoreRouteSegment("aiTasksRunDue"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiTasksRunDue"))
  async runDue() {
    const results = await this.tasks.runDueTasks();
    return { count: results.length, results };
  }
}
