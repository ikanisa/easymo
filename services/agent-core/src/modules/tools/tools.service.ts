import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@easymo/db";
import { CallDirection, CallPlatform } from "@prisma/client";
import type { AgentContext } from "@easymo/commons";

@Injectable()
export class ToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  async listLeads(agent: AgentContext, params: { limit: number; search?: string }) {
    const leads = await this.prisma.lead.findMany({
      where: {
        tenantId: agent.tenantId,
        ...(params.search
          ? {
            OR: [
              { phoneE164: { contains: params.search, mode: "insensitive" } },
              { name: { contains: params.search, mode: "insensitive" } },
            ],
          }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: params.limit,
      include: {
        calls: {
          select: { startedAt: true },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    });

    return leads.map((lead) => {
      const { calls, ...rest } = lead;
      return {
        ...rest,
        lastCallAt: calls[0]?.startedAt ?? null,
      };
    });
  }

  async fetchLead(agent: AgentContext, payload: { phone: string }) {
    this.logger.debug({
      msg: "tools.fetchLead",
      tenantId: agent.tenantId,
      phone: payload.phone,
    });
    return await this.prisma.lead.findFirst({
      where: {
        tenantId: agent.tenantId,
        phoneE164: payload.phone,
      },
    });
  }

  async logLead(agent: AgentContext, payload: {
    phone: string;
    name?: string;
    tags?: string[];
    optIn?: boolean;
  }) {
    const result = await this.prisma.lead.upsert({
      where: {
        tenantId_phoneE164: {
          tenantId: agent.tenantId,
          phoneE164: payload.phone,
        },
      },
      update: {
        name: payload.name,
        optIn: payload.optIn ?? undefined,
        tags: payload.tags ?? undefined,
      },
      create: {
        tenantId: agent.tenantId,
        phoneE164: payload.phone,
        name: payload.name,
        tags: payload.tags ?? [],
        optIn: payload.optIn ?? false,
      },
    });
    this.logger.debug({
      msg: "tools.logLead.upserted",
      tenantId: agent.tenantId,
      leadId: result.id,
    });
    return result;
  }

  async createCall(agent: AgentContext, payload: {
    leadId?: string;
    direction: CallDirection;
    platform: CallPlatform;
    region?: string;
  }) {
    if (payload.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: payload.leadId,
          tenantId: agent.tenantId,
        },
      });
      if (!lead) {
        throw new NotFoundException("Lead not found in tenant scope");
      }
    }

    const call = await this.prisma.call.create({
      data: {
        tenantId: agent.tenantId,
        leadId: payload.leadId ?? null,
        direction: payload.direction,
        platform: payload.platform,
        region: payload.region,
      },
    });
    this.logger.debug({
      msg: "tools.createCall.created",
      tenantId: agent.tenantId,
      callId: call.id,
      leadId: payload.leadId ?? null,
      direction: payload.direction,
      platform: payload.platform,
    });
    return call;
  }

  async setDisposition(agent: AgentContext, payload: {
    callId: string;
    code: string;
    notes?: string;
  }) {
    const call = await this.prisma.call.findFirst({
      where: {
        id: payload.callId,
        tenantId: agent.tenantId,
      },
    });

    if (!call) {
      throw new NotFoundException("Call not found in tenant scope");
    }

    const disposition = await this.prisma.disposition.create({
      data: {
        callId: payload.callId,
        code: payload.code,
        notes: payload.notes,
      },
    });
    this.logger.debug({
      msg: "tools.setDisposition.created",
      tenantId: agent.tenantId,
      callId: payload.callId,
      dispositionId: disposition.id,
    });
    return disposition;
  }

  async registerOptOut(_agent: AgentContext, payload: { phone: string; reason?: string }) {
    const optOut = await this.prisma.optOut.upsert({
      where: { phoneE164: payload.phone },
      update: { reason: payload.reason },
      create: {
        phoneE164: payload.phone,
        reason: payload.reason,
      },
    });
    this.logger.debug({
      msg: "tools.registerOptOut.upserted",
      phone: payload.phone,
    });
    return optOut;
  }

  collectPayment(_agent: AgentContext, payload: { region: string; amount: number; currency: string }) {
    if (payload.region === "rw") {
      return {
        type: "USSD",
        code: `*182*8*1*AGENT*${payload.amount}#`,
      };
    }
    if (payload.region === "mt") {
      return {
        type: "LINK",
        url: `https://revolut.com/pay/easymo?amount=${payload.amount}&currency=${payload.currency}`,
      };
    }
    return {
      type: "MANUAL",
      instructions: "Collect payment via local flow and confirm in the console.",
    };
  }

  warmTransfer(_agent: AgentContext, payload: { queue: string }) {
    this.logger.debug({
      msg: "tools.warmTransfer.requested",
      queue: payload.queue,
    });
    return {
      accepted: true,
      queue: payload.queue,
      message: `Handoff request queued for ${payload.queue}.`,
    };
  }
}
