import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AgentAdminService } from "./agent-admin.service.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { getAgentCoreControllerBasePath, getAgentCoreRouteSegment } from "@easymo/commons";

@Controller(getAgentCoreControllerBasePath("agentAdmin"))
@UseGuards(ServiceTokenGuard)
export class AgentAdminController {
  constructor(private readonly svc: AgentAdminService) {}

  @Get(getAgentCoreRouteSegment("agentAdminList"))
  list(@Query("tenantId") tenantId: string) {
    if (!tenantId) throw new Error("tenantId_required");
    return this.svc.listAgents(tenantId);
  }

  @Post(getAgentCoreRouteSegment("agentAdminCreate"))
  create(@Body() body: { tenantId: string; name: string; slug: string; persona?: string }) {
    return this.svc.createAgent(body);
  }

  @Get(getAgentCoreRouteSegment("agentAdminGet"))
  get(@Param("id") id: string) {
    return this.svc.getAgent(id);
  }

  @Patch(getAgentCoreRouteSegment("agentAdminUpdate"))
  update(@Param("id") id: string, @Body() body: Partial<{ name: string; persona: string; status: string }>) {
    return this.svc.updateAgent(id, body);
  }

  @Get(getAgentCoreRouteSegment("agentAdminListRevisions"))
  listRevisions(@Param("id") id: string) {
    return this.svc.listRevisions(id);
  }

  @Post(getAgentCoreRouteSegment("agentAdminCreateRevision"))
  createRevision(
    @Param("id") id: string,
    @Body() body: { instructions: string; tools?: unknown; metadata?: unknown; createdBy?: string },
  ) {
    return this.svc.createRevision({ agentId: id, ...body });
  }

  @Post(getAgentCoreRouteSegment("agentAdminPublishRevision"))
  publish(
    @Param("id") id: string,
    @Body() body: { revisionId?: string },
  ) {
    return this.svc.publishRevision(id, body.revisionId);
  }

  @Get(getAgentCoreRouteSegment("agentAdminListDocuments"))
  listDocs(@Param("id") id: string) {
    return this.svc.listDocuments(id);
  }

  @Post(getAgentCoreRouteSegment("agentAdminCreateDocument"))
  createDoc(
    @Param("id") id: string,
    @Body() body: { title: string; source?: string; url?: string | null; content?: string | null },
  ) {
    return this.svc.createDocument({ agentId: id, ...body });
  }

  @Get(getAgentCoreRouteSegment("agentAdminListTasks"))
  listTasks(@Param("id") id: string) {
    return this.svc.listTasks(id);
  }

  @Post(getAgentCoreRouteSegment("agentAdminCreateTask"))
  createTask(
    @Param("id") id: string,
    @Body() body: { title: string; description?: string | null; payloadSchema?: unknown },
  ) {
    return this.svc.createTask({ agentId: id, ...body });
  }
}

