# OpenAI Agents Tooling Overview

This document summarizes the available tooling integrations for the OpenAI Agents SDK and captures the main usage patterns needed when wiring agents into the Easymo stack.

## 1. Hosted tools

Hosted tools run alongside the model on OpenAI infrastructure and are available when instantiating an `Agent` with the OpenAI SDK. They can be attached by importing the helpers from `@openai/agents` and adding them to the agent configuration. The built-in hosted tools are:

| Tool | Type string | Purpose |
| --- | --- | --- |
| Web search | `web_search` | Execute internet searches. |
| File / retrieval search | `file_search` | Query OpenAI-hosted vector stores. |
| Computer use | `computer` | Automate GUI interactions. |
| Code interpreter | `code_interpreter` | Execute code in a sandbox. |
| Image generation | `image_generation` | Generate images from text prompts. |

Example usage:

```ts
import { Agent, webSearchTool, fileSearchTool } from '@openai/agents';

const agent = new Agent({
  name: 'Travel assistant',
  tools: [webSearchTool(), fileSearchTool('VS_ID')],
});
```

The helper APIs mirror the OpenAI Responses API options, so advanced configuration such as ranking or semantic filters is passed directly into the helper factories.

## 2. Function tools

Any JavaScript or TypeScript function can be wrapped as a tool with the `tool()` helper. The helper supports both strict validation with [Zod](https://zod.dev/) schemas and non-strict validation via raw JSON schema definitions.

### Strict Zod example

```ts
import { tool } from '@openai/agents';
import { z } from 'zod';

const getWeatherTool = tool({
  name: 'get_weather',
  description: 'Get the weather for a given city',
  parameters: z.object({ city: z.string() }),
  async execute({ city }) {
    return `The weather in ${city} is sunny.`;
  },
});
```

### Non-strict JSON schema example

```ts
import { tool } from '@openai/agents';

interface LooseToolInput {
  text: string;
}

const looseTool = tool({
  description: 'Echo input; be forgiving about typos',
  strict: false,
  parameters: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: true,
  },
  execute: async (input) => {
    if (typeof input !== 'object' || input === null || !('text' in input)) {
      return 'Invalid input. Please try again';
    }
    return (input as LooseToolInput).text;
  },
});
```

Strict mode causes the SDK to reject invalid arguments automatically. When `strict` is disabled the tool is responsible for validating inputs and returning helpful messages on error.

## 3. Agents as tools

Existing agents can be exposed as callable tools with `agent.asTool()`. This pattern lets one agent delegate work to another without fully handing over the conversation context.

```ts
import { Agent } from '@openai/agents';

const summarizer = new Agent({
  name: 'Summarizer',
  instructions: 'Generate a concise summary of the supplied text.',
});

const summarizerTool = summarizer.asTool({
  toolName: 'summarize_text',
  toolDescription: 'Generate a concise summary of the supplied text.',
});

const mainAgent = new Agent({
  name: 'Research assistant',
  tools: [summarizerTool],
});
```

When the tool is invoked the SDK spins up a runner with the default settings unless overridden via `runConfig` or `runOptions` passed to `asTool()`.

## 4. MCP servers

Model Context Protocol (MCP) servers expose tool capabilities via a standard interface. The `MCPServerStdio` helper connects to a local MCP server by spawning the configured command and wiring its stdio to the agent runtime.

```ts
import { Agent, MCPServerStdio } from '@openai/agents';

const server = new MCPServerStdio({
  fullCommand: 'npx -y @modelcontextprotocol/server-filesystem ./sample_files',
});

await server.connect();

const agent = new Agent({
  name: 'Assistant',
  mcpServers: [server],
});
```

See `filesystem-example.ts` in the SDK for a full demonstration and refer to the MCP integration guide for deep configuration options.

## Tool usage guidance

- Write concise, explicit descriptions so models know exactly when to call a tool.
- Validate inputs rigorously. Prefer Zod schemas when you want automatic argument checking.
- Keep tools focused on a single responsibility to simplify reasoning.
- Use `errorFunction` sparingly to transform internal errors into user-friendly strings without triggering side effects.
- Configure `tool_choice` and `toolUseBehavior` in the agent to enforce or limit tool usage when business rules demand it.

These patterns provide the foundation for integrating hosted and bespoke tools into Easymo agents while keeping deployments compatible with self-hosted infrastructure and the broader platform architecture.

## 5. Tool selection and fallbacks in Easymo

- **Local preference over hosted** – Default to Easymo-hosted tools (Supabase, internal APIs) where latency and data residency are critical, and reserve hosted tools for exploratory or bursty workloads.
- **Add a guardrail layer** – Wrap each tool invocation with a thin adapter that logs inputs/outputs to our observability pipeline, redacts PII, and normalizes errors before surfacing them to the agent runner.
- **Provide fallbacks** – When a hosted tool is temporarily unavailable, configure the agent runner with a local fallback tool (for example, a cached search index) so the conversation can continue without surfacing infrastructure failures to the end user.
- **Respect conversation phase** – Phase the tool list in `tool_choice`: discovery phases can expose exploratory tools (web search, summarizers) while transactional phases limit the surface area to deterministic Easymo services.

## 6. Testing matrix for tool integrations

| Scenario | Recommended check | Tooling notes |
| --- | --- | --- |
| Schema evolution | Run shared contract tests against mock tool inputs | Catch breaking parameter changes before deployment. |
| Latency budgets | Capture end-to-end traces with the observability adapter | Use budgets in `toolUseBehavior` to prevent slow tools from blocking user flows. |
| Error handling | Simulate invalid payloads through `errorFunction` | Ensure human-readable responses without leaking stack traces. |
| Deployment preview | Exercise agent flows on the staging URL | Confirm that hosted tools are reachable from the ingress layer and that environment variables are wired correctly. |

## 7. Deployment checklist for self-hosted rollouts

1. Confirm that the agent environment variables for tool authentication are stored in the hosting secret store (staging & production).
2. Validate that `tool_choice` defaults align with the feature flag configuration for the target release cohort.
3. Run the full conversation regression suite (`pnpm test agent:tools`) against the preview deployment and store the results in the release ticket.
4. Ensure observability dashboards include the new tool metrics (latency, success rate, fallback rate) before promoting to production.
5. Capture a final dry-run conversation in the preview environment and attach the transcript to the rollout checklist for reviewer sign-off.
