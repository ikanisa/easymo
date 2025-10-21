import { Injectable } from "@nestjs/common";
import { PrismaService } from "@easymo/db";

@Injectable()
export class AgentAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listAgents(tenantId: string) {
    return this.prisma.agent.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } });
  }

  getAgent(id: string) {
    return this.prisma.agent.findUnique({ where: { id }, include: { currentRevision: true } });
  }

  async createAgent(input: { tenantId: string; name: string; slug: string; persona?: string }) {
    return this.prisma.agent.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        slug: input.slug,
        persona: input.persona ?? "general",
      },
    });
  }

  updateAgent(id: string, data: Partial<{ name: string; persona: string; status: string }>) {
    return this.prisma.agent.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  }

  listRevisions(agentId: string) {
    return this.prisma.agentRevision.findMany({ where: { agentId }, orderBy: { createdAt: "desc" } });
  }

  async createRevision(input: { agentId: string; instructions: string; tools?: unknown; metadata?: unknown; createdBy?: string }) {
    const latest = await this.prisma.agentRevision.findFirst({ where: { agentId: input.agentId }, orderBy: { version: "desc" } });
    const version = (latest?.version ?? 0) + 1;
    return this.prisma.agentRevision.create({
      data: {
        agentId: input.agentId,
        version,
        instructions: input.instructions,
        tools: (input.tools ?? []) as any,
        metadata: (input.metadata ?? {}) as any,
        createdBy: input.createdBy,
      },
    });
  }

  async publishRevision(agentId: string, revisionId?: string) {
    const rev = revisionId
      ? await this.prisma.agentRevision.findUnique({ where: { id: revisionId } })
      : await this.prisma.agentRevision.findFirst({ where: { agentId }, orderBy: { version: "desc" } });
    if (!rev) throw new Error("revision_not_found");
    await this.prisma.agentRevision.update({ where: { id: rev.id }, data: { published: true } });
    return this.prisma.agent.update({ where: { id: agentId }, data: { currentRevisionId: rev.id, updatedAt: new Date() } });
  }

  listDocuments(agentId: string) {
    return this.prisma.agentDocument.findMany({ where: { agentId }, orderBy: { createdAt: "desc" } });
  }

  createDocument(input: { agentId: string; title: string; source?: string; url?: string | null; content?: string | null }) {
    return this.prisma.agentDocument.create({
      data: {
        agentId: input.agentId,
        title: input.title,
        source: input.source ?? (input.url ? "url" : "text"),
        url: input.url,
        content: input.content,
      },
    });
  }

  listTasks(agentId: string) {
    return this.prisma.agentTask.findMany({ where: { agentId }, orderBy: { createdAt: "desc" } });
  }

  createTask(input: { agentId: string; title: string; description?: string | null; payloadSchema?: unknown }) {
    return this.prisma.agentTask.create({
      data: {
        agentId: input.agentId,
        title: input.title,
        description: input.description ?? null,
        payloadSchema: (input.payloadSchema ?? {}) as any,
      },
    });
  }
}

