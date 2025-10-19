import { NotFoundException } from "@nestjs/common";
import { ToolsService } from "../src/modules/tools/tools.service";
import type { AgentContext } from "@easymo/commons";
import { CallDirection, CallPlatform } from "@prisma/client";
import { Logger } from "@nestjs/common";

const TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";

const agent: AgentContext = {
  agentId: "agent-test",
  tenantId: TENANT_ID,
  agentConfigId: "26db67d6-e0dd-49aa-bf19-31d3de42b5ca",
  agentKind: "support",
  permissions: new Set(),
  token: "token",
};

const createPrismaMock = () => ({
  lead: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  call: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  disposition: {
    create: jest.fn(),
  },
  optOut: {
    upsert: jest.fn(),
  },
});

describe("ToolsService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: ToolsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ToolsService(prisma as any, new Logger("ToolsServiceTest"));
  });

  it("scopes fetchLead queries to the agent tenant", async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: "lead" });
    await service.fetchLead(agent, { phone: "+250780010001" });

    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        phoneE164: "+250780010001",
      },
    });
  });

  it("rejects createCall when the lead is outside tenant scope", async () => {
    prisma.lead.findFirst.mockResolvedValue(null);

    await expect(() =>
      service.createCall(agent, {
        leadId: "3da34d03-9106-4a5d-97b3-16008d15ac31",
        direction: CallDirection.outbound,
        platform: CallPlatform.pstn,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.call.create).not.toHaveBeenCalled();
  });

  it("creates calls under the tenant when lead passes validation", async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: "lead" });
    prisma.call.create.mockResolvedValue({ id: "call" });

    await service.createCall(agent, {
      leadId: "3da34d03-9106-4a5d-97b3-16008d15ac31",
      direction: CallDirection.outbound,
      platform: CallPlatform.pstn,
      region: "rw",
    });

    expect(prisma.call.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_ID,
        leadId: "3da34d03-9106-4a5d-97b3-16008d15ac31",
        direction: CallDirection.outbound,
        platform: CallPlatform.pstn,
        region: "rw",
      },
    });
  });

  it("guards dispositions against cross-tenant access", async () => {
    prisma.call.findFirst.mockResolvedValue(null);
    await expect(() =>
      service.setDisposition(agent, { callId: "59f4e60f-cee7-4a52-9ab8-550466e21003", code: "COMPLETE" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("lists leads with recent call timestamp", async () => {
    prisma.lead.findMany.mockResolvedValue([
      {
        id: "lead-1",
        tenantId: TENANT_ID,
        phoneE164: "+250780010001",
        name: "Lead One",
        tags: ["pilot"],
        optIn: true,
        locale: "rw",
        lastContactAt: new Date("2024-01-02T10:00:00Z"),
        createdAt: new Date("2024-01-01T09:00:00Z"),
        lastCallAt: null,
        calls: [{ startedAt: new Date("2024-01-02T10:00:00Z") }],
      },
    ]);

    const leads = await service.listLeads(agent, { limit: 5 });

    expect(prisma.lead.findMany).toHaveBeenCalled();
    expect(leads[0].lastCallAt).toEqual(new Date("2024-01-02T10:00:00Z"));
  });

  it("computes regional payment instructions", () => {
    const ussd = service.collectPayment(agent, { region: "rw", amount: 10, currency: "RWF" });
    expect(ussd).toEqual({ type: "USSD", code: "*182*8*1*AGENT*10#" });

    const revolut = service.collectPayment(agent, { region: "mt", amount: 15, currency: "EUR" });
    expect(revolut).toEqual({
      type: "LINK",
      url: "https://revolut.com/pay/easymo?amount=15&currency=EUR",
    });

    const manual = service.collectPayment(agent, { region: "ke", amount: 5, currency: "USD" });
    expect(manual.type).toBe("MANUAL");
  });
});
