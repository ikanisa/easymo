import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AgentAdminService } from "./agent-admin.service.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";

@Controller("admin/agents")
@UseGuards(ServiceTokenGuard)
export class AgentAdminController {
  constructor(private readonly svc: AgentAdminService) {}

  @Get()
  list(@Query("tenantId") tenantId: string) {
    if (!tenantId) throw new Error("tenantId_required");
    return this.svc.listAgents(tenantId);
  }

  @Post()
  create(@Body() body: { tenantId: string; name: string; slug: string; persona?: string }) {
    return this.svc.createAgent(body);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.svc.getAgent(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<{ name: string; persona: string; status: string }>) {
    return this.svc.updateAgent(id, body);
  }

  @Get(":id/revisions")
  listRevisions(@Param("id") id: string) {
    return this.svc.listRevisions(id);
  }

  @Post(":id/revisions")
  createRevision(
    @Param("id") id: string,
    @Body() body: { instructions: string; tools?: unknown; metadata?: unknown; createdBy?: string },
  ) {
    return this.svc.createRevision({ agentId: id, ...body });
  }

  @Post(":id/publish")
  publish(
    @Param("id") id: string,
    @Body() body: { revisionId?: string },
  ) {
    return this.svc.publishRevision(id, body.revisionId);
  }

  @Get(":id/documents")
  listDocs(@Param("id") id: string) {
    return this.svc.listDocuments(id);
  }

  @Post(":id/documents")
  createDoc(
    @Param("id") id: string,
    @Body() body: { title: string; source?: string; url?: string | null; content?: string | null },
  ) {
    return this.svc.createDocument({ agentId: id, ...body });
  }

  @Get(":id/tasks")
  listTasks(@Param("id") id: string) {
    return this.svc.listTasks(id);
  }

  @Post(":id/tasks")
  createTask(
    @Param("id") id: string,
    @Body() body: { title: string; description?: string | null; payloadSchema?: unknown },
  ) {
    return this.svc.createTask({ agentId: id, ...body });
  }
}

