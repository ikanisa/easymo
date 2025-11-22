import type { AgentContext } from "@easymo/commons";
import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { ToolsController } from "../src/modules/tools/tools.controller";
import { ToolsService } from "../src/modules/tools/tools.service";

describe("ToolsController", () => {
  let controller: ToolsController;
  let service: ToolsService;
  const agent: AgentContext = {
    agentId: "agent-test",
    tenantId: "a4a8cf2d-0a4f-446c-8bf2-28509641158f",
    agentConfigId: "26db67d6-e0dd-49aa-bf19-31d3de42b5ca",
    agentKind: "support",
    permissions: new Set(),
    token: "token",
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ToolsController],
      providers: [
        {
          provide: ToolsService,
          useValue: {
            collectPayment: jest.fn().mockReturnValue({ type: "USSD", code: "*182*8*1*AGENT*1000#" }),
            searchSupabase: jest.fn(),
            createListing: jest.fn(),
            createOrder: jest.fn(),
            createMatch: jest.fn(),
            recordPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ToolsController);
    service = module.get(ToolsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("validates collect payment payload", async () => {
    const response = await controller.collectPayment(agent, { region: "rw", amount: 1000, currency: "RWF" });
    expect(service.collectPayment).toHaveBeenCalledWith(agent, { region: "rw", amount: 1000, currency: "RWF" });
    expect(response).toEqual({ type: "USSD", code: "*182*8*1*AGENT*1000#" });
  });

  it("normalizes snake_case payloads before searching Supabase", async () => {
    (service.searchSupabase as jest.Mock).mockResolvedValue({ items: [], count: 0 });
    await controller.searchSupabase(agent, {
      tenant_id: agent.tenantId,
      table: "produce_listings",
      filters: { farm_id: "farm" },
      order: { column: "created_at", ascending: false },
    } as unknown);

    expect(service.searchSupabase).toHaveBeenCalledWith(agent, {
      tenantId: agent.tenantId,
      table: "produce_listings",
      filters: { farm_id: "farm" },
      order: { column: "created_at", ascending: false },
      limit: undefined,
      attribution: undefined,
    });
  });

  it("normalizes createListing payloads", async () => {
    (service.createListing as jest.Mock).mockResolvedValue({ listing_id: "listing" });
    await controller.createListing(agent, {
      tenant_id: agent.tenantId,
      farm_id: "059f4f52-89ed-4131-8a93-64a304d2b0dd",
      produce_id: "d8dbb551-f4ae-4d03-893f-32f1c8356b64",
      unit_type: "kg",
      quantity: 10,
      price_per_unit: 300,
      currency: "RWF",
    } as unknown);

    expect(service.createListing).toHaveBeenCalledWith(agent, {
      tenantId: agent.tenantId,
      farmId: "059f4f52-89ed-4131-8a93-64a304d2b0dd",
      produceId: "d8dbb551-f4ae-4d03-893f-32f1c8356b64",
      unitType: "kg",
      quantity: 10,
      pricePerUnit: 300,
      currency: "RWF",
      harvestDate: undefined,
      title: undefined,
      description: undefined,
      tags: undefined,
      metadata: undefined,
      attribution: undefined,
    });
  });

  it("rejects tenant mismatches on createOrder", async () => {
    await expect(() =>
      controller.createOrder(
        agent,
        {
          tenant_id: "0d0d0d0d-0d0d-0d0d-0d0d-0d0d0d0d0d0d",
          buyer_profile_id: "38b5ab39-3ae1-4b05-b07e-a5f52ccf71c6",
          quantity: 5,
          unit_type: "kg",
          currency: "RWF",
        } as unknown,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("normalizes createMatch payloads", async () => {
    (service.createMatch as jest.Mock).mockResolvedValue({ match_id: "match" });
    await controller.createMatch(agent, {
      tenant_id: agent.tenantId,
      order_id: "35d9bb35-17df-4d9b-854f-e81fdf6579fc",
      listing_id: "8f953d26-1dc5-45a5-a1c9-0d752ce0df0c",
      score: 0.9,
    } as unknown);

    expect(service.createMatch).toHaveBeenCalledWith(agent, {
      tenantId: agent.tenantId,
      orderId: "35d9bb35-17df-4d9b-854f-e81fdf6579fc",
      listingId: "8f953d26-1dc5-45a5-a1c9-0d752ce0df0c",
      score: 0.9,
      metadata: undefined,
      attribution: undefined,
    });
  });

  it("normalizes recordPayment payloads", async () => {
    (service.recordPayment as jest.Mock).mockResolvedValue({ payment_id: "pay" });
    await controller.recordPayment(agent, {
      tenant_id: agent.tenantId,
      order_id: "fe31c42e-3fda-41c4-a80d-5131b5a6fd88",
      payer_profile_id: "f868fa8c-4e0e-4b0b-9b57-cb03cccb4d63",
      amount: 4200,
      currency: "RWF",
    } as unknown);

    expect(service.recordPayment).toHaveBeenCalledWith(agent, {
      tenantId: agent.tenantId,
      orderId: "fe31c42e-3fda-41c4-a80d-5131b5a6fd88",
      payerProfileId: "f868fa8c-4e0e-4b0b-9b57-cb03cccb4d63",
      amount: 4200,
      currency: "RWF",
      provider: undefined,
      providerRef: undefined,
      metadata: undefined,
      attribution: undefined,
    });
  });
});
