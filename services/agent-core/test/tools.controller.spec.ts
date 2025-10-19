import { Test } from "@nestjs/testing";
import { ToolsController } from "../src/modules/tools/tools.controller";
import { ToolsService } from "../src/modules/tools/tools.service";
import type { AgentContext } from "@easymo/commons";

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
          },
        },
      ],
    }).compile();

    controller = module.get(ToolsController);
    service = module.get(ToolsService);
  });

  it("validates collect payment payload", async () => {
    const response = await controller.collectPayment(agent, { region: "rw", amount: 1000, currency: "RWF" });
    expect(service.collectPayment).toHaveBeenCalledWith(agent, { region: "rw", amount: 1000, currency: "RWF" });
    expect(response).toEqual({ type: "USSD", code: "*182*8*1*AGENT*1000#" });
  });
});
