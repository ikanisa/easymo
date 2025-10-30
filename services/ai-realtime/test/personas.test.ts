import { buildToolsSpec } from "../src/realtimeClient";
import { PERSONAS } from "../src/personas";

describe("buildToolsSpec", () => {
  it("should convert persona tools to OpenAI format", () => {
    const tools = buildToolsSpec(PERSONAS.waiter.tools);
    
    expect(tools).toHaveLength(2);
    expect(tools[0]).toMatchObject({
      type: "function",
      name: "lookup_menu",
      description: expect.stringContaining("Find a menu item")
    });
    expect(tools[0].parameters).toHaveProperty("type", "object");
    expect(tools[0].parameters).toHaveProperty("required");
  });

  it("should handle CFO persona tools", () => {
    const tools = buildToolsSpec(PERSONAS.cfo.tools);
    
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe("fetch_financials");
    expect(tools[1].name).toBe("check_tax_rule");
  });
});

describe("PERSONAS", () => {
  it("should have waiter persona defined", () => {
    expect(PERSONAS.waiter).toBeDefined();
    expect(PERSONAS.waiter.system).toContain("AI Waiter");
    expect(PERSONAS.waiter.tools).toHaveLength(2);
  });

  it("should have cfo persona defined", () => {
    expect(PERSONAS.cfo).toBeDefined();
    expect(PERSONAS.cfo.system).toContain("AI CFO");
    expect(PERSONAS.cfo.tools).toHaveLength(2);
  });
});
