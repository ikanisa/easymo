# GPT-5 Adoption Guide

This guide captures practical notes for Easymo teams adopting the GPT-5 model family across backend agents, frontend workflows, and infrastructure automation. GPT-5 excels at code-heavy, multi-step tasks and exposes new API controls compared with earlier OpenAI models.

## Model Options

| Variant | Ideal Use Cases |
| --- | --- |
| `gpt-5` | Deep reasoning with tool use, broad knowledge questions, and complex code generation. |
| `gpt-5-mini` | Cost-sensitive automations that still require strong reasoning and conversational quality. |
| `gpt-5-nano` | High-throughput, narrowly scoped instruction following or classification. |

System card ↔ API alias mapping:

| System Card Name | API Alias |
| --- | --- |
| `gpt-5-thinking` | `gpt-5` |
| `gpt-5-thinking-mini` | `gpt-5-mini` |
| `gpt-5-thinking-nano` | `gpt-5-nano` |
| `gpt-5-main` | `gpt-5-chat-latest` |
| `gpt-5-main-mini` | _Not exposed via API_ |

## Response Controls

GPT-5 introduces explicit parameters for balancing reasoning depth and latency. Earlier controls such as `temperature`, `top_p`, and `logprobs` are **not supported** on GPT-5 models.

### Reasoning Effort

Configure how many reasoning tokens are emitted before the visible response:

- `minimal`: fastest time-to-first-token, recommended for tooling-heavy instruction following.
- `low`: similar latency profile to GPT-4.1 with improved adherence to instructions.
- `medium` (default): balanced depth for most conversational or coding flows.
- `high`: maximum rigor when debugging complex issues or refactoring large code paths.

Example:

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    input="How much gold would it take to coat the Statue of Liberty in a 1mm layer?",
    reasoning={"effort": "minimal"},
)
```

### Verbosity

The `text.verbosity` parameter sets the target length of the visible reply:

- `low`: concise answers or terse code snippets.
- `medium`: balanced detail (default prior to GPT-5).
- `high`: verbose, tutorial-style explanations or large refactors.

```python
response = client.responses.create(
    model="gpt-5",
    input="What is the answer to the ultimate question of life, the universe, and everything?",
    text={"verbosity": "low"},
)
```

Combine verbosity prompts with explicit instructions when you need even shorter or longer responses.

### Output Length

Continue to bound output using `max_output_tokens`; reasoning effort and verbosity determine the quality within that budget.

## Tooling Enhancements

### Custom Tools

Define tools with `type: "custom"` to send raw text payloads—code, SQL, shell commands—directly to downstream services. Server-side validation remains mandatory because GPT-5 can emit arbitrary free-form strings.

You can optionally attach a context-free grammar (CFG) so the model outputs only syntax that matches a domain-specific language (e.g., SQL). This improves safety and deterministic formatting for critical workflows.

### Allowed Tools Lists

List every tool in the `tools` array, then restrict the active subset with `tool_choice: { "type": "allowed_tools" }`. Modes:

- `auto`: GPT-5 may pick any allowed tool.
- `required`: GPT-5 must invoke one of the allowed tools, preventing misfires.

This separation keeps prompt instructions clean and boosts caching by avoiding brittle, turn-specific tool directives.

### Preambles

Prompt GPT-5 to describe why it is calling a tool by adding a system instruction such as “Before you call a tool, explain why you are calling it.” The model emits a short rationale (a *preamble*) immediately before the tool call, improving transparency and debugging without significantly increasing latency.

## Performance Tuning

- Prefer the Responses API over Chat Completions so you can pass prior chain-of-thought (CoT) tokens via `previous_response_id`. This increases cache hits, reduces duplicate reasoning, and boosts response quality.
- For latency-sensitive tasks, start with `reasoning.effort = "minimal"` and `text.verbosity = "low"`, then dial them up if you need richer answers.
- Use the prompt optimizer in the OpenAI dashboard to adapt legacy prompts to GPT-5 defaults.

## Migration Guidance

### Replacing Existing Models

- `o3` → `gpt-5` with `reasoning.effort = "medium"` as a baseline; raise to `high` if accuracy is insufficient.
- `gpt-4.1` → `gpt-5` with `reasoning.effort = "minimal"` or `"low"` to maintain similar latency.
- `o4-mini` / `gpt-4.1-mini` → `gpt-5-mini` with updated prompts.
- `gpt-4.1-nano` → `gpt-5-nano` with prompt optimizer support.

### API Differences

| Capability | Responses API (GPT-5) | Chat Completions |
| --- | --- | --- |
| Reasoning effort | `reasoning: { "effort": "minimal" | "low" | "medium" | "high" }` | Not available |
| Verbosity | `text: { "verbosity": "low" | "medium" | "high" }` | Not available |
| Custom tools | `"type": "custom"` with optional CFG and `allowed_tools` constraint | Not available |
| Chain of thought sharing | Supported via `previous_response_id` | Not supported |

Update API clients to remove unsupported parameters (`temperature`, `top_p`, `logprobs`) when migrating.

## Quickstart Snippets

```python
from openai import OpenAI
client = OpenAI()

result = client.responses.create(
    model="gpt-5",
    input="Write a haiku about code.",
    reasoning={"effort": "low"},
    text={"verbosity": "low"},
)

print(result.output_text)
```

```bash
curl --request POST \
  --url https://api.openai.com/v1/responses \
  --header "Authorization: Bearer $OPENAI_API_KEY" \
  --header 'Content-type: application/json' \
  --data '{
    "model": "gpt-5",
    "input": "Use the code_exec tool to calculate the area of a circle with radius equal to the number of r letters in blueberry",
    "tools": [
      {
        "type": "custom",
        "name": "code_exec",
        "description": "Executes arbitrary python code"
      }
    ]
  }'
```

## Prompting Tips

- Encourage the model to outline steps before answering when using minimal reasoning effort.
- Pair verbosity settings with explicit tone or formatting requirements in the prompt.
- For frontend deliverables, review the GPT-5 frontend prompting guide for component-specific patterns.
- Use preambles plus allowed tools to keep tool usage transparent and predictable in long-running agent flows.

## Deployment Checklist for Easymo

1. Verify Vercel builds use GPT-5-compatible environment variables and SDK versions.
2. Update backend services to call the Responses API with new parameters and without deprecated fields.
3. Ensure QA smoke tests cover low-verbosity flows so trimmed responses still satisfy acceptance criteria.
4. Capture latency metrics before and after enabling GPT-5 to validate minimal reasoning configurations.

Adopting GPT-5 unlocks richer agent behaviors, tighter tooling integration, and lower latency when tuned correctly. Use this guide as the baseline playbook for new GPT-5-powered features across Easymo products.


## Fullstack Reference Implementation

The following blueprint demonstrates how to roll GPT-5 into an end-to-end user flow using a Next.js
API route paired with a React client. The backend example targets the Responses API so we can
forward chain-of-thought identifiers between turns and unlock reasoning controls.

### Backend: Next.js Route Handler (`app/api/gpt5-chat/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { prompt, previousResponseId } = await req.json();

  const response = await client.responses.create({
    model: "gpt-5",
    input: prompt,
    reasoning: { effort: "low" },
    text: { verbosity: "medium" },
    previous_response_id: previousResponseId,
    max_output_tokens: 600,
    metadata: {
      source: "easymo-web",
      feature: "agent-handovers",
    },
  });

  return NextResponse.json({
    message: response.output_text,
    previousResponseId: response.id,
    latencyMs: response.usage?.total_time ?? null,
  });
}
```

Key backend notes:

- Store the GPT-5 API key in Vercel project settings (`OPENAI_API_KEY`) and never commit it locally.
- Capture `response.id` so the client can pass it back on the next turn to reuse GPT-5 reasoning.
- Use `max_output_tokens` to stay within latency budgets; tune verbosity per UI needs.
- Attach metadata for downstream observability (Axiom/Grafana dashboards).

### Frontend: React Hook (`apps/web/src/hooks/useGpt5Chat.ts`)

```ts
import { useCallback, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatState = {
  history: Message[];
  previousResponseId?: string;
  isStreaming: boolean;
  error?: string;
};

export function useGpt5Chat() {
  const [state, setState] = useState<ChatState>({ history: [], isStreaming: false });

  const sendMessage = useCallback(async (content: string) => {
    setState((prev) => ({
      ...prev,
      isStreaming: true,
      history: [...prev.history, { id: crypto.randomUUID(), role: "user", content }],
      error: undefined,
    }));

    try {
      const response = await fetch("/api/gpt5-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content, previousResponseId: state.previousResponseId }),
      });

      if (!response.ok) {
        throw new Error(`GPT-5 request failed: ${response.status}`);
      }

      const payload = await response.json();

      setState((prev) => ({
        history: [
          ...prev.history,
          {
            id: payload.previousResponseId,
            role: "assistant",
            content: payload.message,
          },
        ],
        previousResponseId: payload.previousResponseId,
        isStreaming: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : "Unknown GPT-5 failure",
      }));
    }
  }, [state.previousResponseId]);

  return { ...state, sendMessage };
}
```

Frontend considerations:

- `previousResponseId` allows multi-turn threads without storing full reasoning traces on the client.
- Provide user-visible latency indicators when `isStreaming` is true.
- Retry failed calls with exponential backoff when networking is unreliable (see `libs/network/retry.ts`).
- Gate access with feature flags (`FEATURE_AGENT_GPT5`) so you can flip rollout cohorts directly in LaunchDarkly.

### Observability

Instrument both layers with distributed tracing so GPT-5 latency shows up alongside Supabase and Twilio spans.
Start by forwarding the `request-id` header from the browser to the API route and into the Responses API metadata.
This keeps error correlation intact during post-mortems.

## Vercel Deployment Readiness Checklist

Extend the earlier deployment checklist with specific Vercel integration steps:

1. **Environment variables**: Configure `OPENAI_API_KEY`, `NEXT_PUBLIC_GPT5_ENABLED`, and `EASYMO_TRACE_ENDPOINT`.
2. **Edge runtime**: Mark chat routes with `export const runtime = "edge";` when streaming support ships to minimize cold starts.
3. **Prompt cache**: Enable Vercel Edge Config (or Supabase Config Sync) to store prompt templates so hotfixes avoid redeployments.
4. **Monitoring**: Wire the observability stack (Grafana/Prometheus per `ops/observability/*`) to receive GPT-5 latency + error metrics from Next.js logs.
5. **Secrets rotation**: Schedule monthly key rotation through `scripts/rotate-openai-key.ts` to maintain compliance.
6. **Smoke tests**: Run `pnpm test:e2e --filter gpt5` before every production promotion; tests seed Vercel preview data.
7. **Rollback**: Keep `OPENAI_MODEL_FALLBACK=gpt-4o-mini` in the environment so the API route can degrade gracefully.

When these items pass, update the deployment notes in `ROLLUP_PLAN.md` and announce GA in the release Slack channel.

## Operational Verification Playbook

After shipping GPT-5-backed flows, run the following validation loop each release candidate:

- ✅ **Runtime health**: Inspect Next.js server logs for `OpenAI request failed` entries; none should exceed 0.1% of traffic.
- ✅ **Latency**: P99 end-to-end chat latency must stay below 2.5s with `reasoning.effort = "low"`.
- ✅ **Prompt adherence**: QA verifies sample transcripts for hallucination regressions using the audit checklist in `QA_MATRIX.md`.
- ✅ **Analytics**: Confirm GPT-5 events stream into Segment under the `AI_AGENT_RESPONSE` schema.
- ✅ **Accessibility**: Screen reader output for GPT-5 responses meets WCAG 2.2 AA (aria-live regions updated).
- ✅ **Escalation path**: On-call runbook updated with GPT-5 troubleshooting steps (`INCIDENT_RUNBOOKS.md`).

Document verification results inside the release retro so learnings feed into future prompt or tooling adjustments.
