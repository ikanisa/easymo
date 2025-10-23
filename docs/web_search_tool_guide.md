# OpenAI Web Search Tool Integration Guide

This guide documents how to wire OpenAI's web search tooling into Easymo agents so they can source the latest public information before responding to users.

## 1. Web Search Modes

OpenAI exposes three flavours of web search. Pick the lightest mode that meets the use case to balance freshness, latency, and cost.

| Mode | Description | Latency profile | Ideal use cases |
| --- | --- | --- | --- |
| **Non-reasoning search** | Forwards the user query directly to the web search service and streams back the aggregated result. | Fastest. | Quick fact lookups where one-shot answers are sufficient. |
| **Agentic search (reasoning models)** | Reasoning models orchestrate the search, deciding when to branch, open pages, or refine the query. | Medium. | Research tasks that need light synthesis or multi-hop browsing. |
| **Deep research** | Long-running, agent-driven investigations that may hit hundreds of sources. Requires models such as `o3-deep-research`, `o4-mini-deep-research`, or `gpt-5` with high reasoning. | Slowest (minutes). | Background briefs, diligence reports, or competitive research. |

## 2. Enabling Web Search in the Responses API

Add the `web_search` tool in the `tools` array when calling the Responses API. The model will decide whether and how to invoke search based on the prompt.

```ts
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  tools: [
    { type: "web_search" },
  ],
  input: "What was a positive news story from today?",
});

console.log(response.output_text);
```

### Tool Invocation Details

Responses that leverage web search include:

- A `web_search_call` item describing the executed action (`search`, `open_page`, or `find_in_page`). Only `search` is currently available for non-reasoning models.
- A standard assistant message whose `annotations` array contains URL citations. Display citations inline and make them clickable in user-facing surfaces.

## 3. Domain Filtering

To constrain web results to vetted sources, supply `filters.allowed_domains` (up to 20 entries) when configuring the tool.

```bash
curl "https://api.openai.com/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5",
    "reasoning": { "effort": "low" },
    "tools": [
      {
        "type": "web_search",
        "filters": {
          "allowed_domains": [
            "pubmed.ncbi.nlm.nih.gov",
            "clinicaltrials.gov",
            "www.who.int",
            "www.cdc.gov",
            "www.fda.gov"
          ]
        }
      }
    ],
    "tool_choice": "auto",
    "include": ["web_search_call.action.sources"],
    "input": "Please perform a web search on how semaglutide is used in the treatment of diabetes."
  }'
```

Domain filters accept bare domains (no protocol) and automatically cover subdomains.

## 4. Inspecting Sources and Citations

When the model executes web search:

- Inline citations surface the most relevant references and should always be rendered to end users.
- The `sources` field lists every URL retrieved during the search, including real-time feeds labelled `oai-sports`, `oai-weather`, or `oai-finance`. Request the field via the `include` array if you need the complete audit trail.

## 5. Location-Aware Searches

Supply an approximate user location to bias results geographically:

```ts
const response = await client.responses.create({
  model: "o4-mini",
  tools: [{
    type: "web_search",
    user_location: {
      type: "approximate",
      country: "GB",
      city: "London",
      region: "London"
    }
  }],
  input: "What are the best restaurants near me?",
});
```

Supported location fields:

- `country`: ISO-3166 two-letter code (required for location biasing).
- `city` and `region`: Free-form strings (optional).
- `timezone`: IANA timezone (optional).

Deep research models do not currently respect the location hint.

## 6. Compatibility and Limits

- **API surfaces:** `web_search` (Responses API) and `web_search_preview` (legacy). In the Chat Completions API, use models `gpt-5-search-api`, `gpt-4o-search-preview`, or `gpt-4o-mini-search-preview`.
- **Context window:** 128,000 tokens max even on `gpt-4.1` and `gpt-4.1-mini`.
- **Unsupported configurations:** `gpt-5` with minimal reasoning and `gpt-4.1-nano` do not currently expose web search.
- **Rate limits:** Mirror the tiered rate limits of the underlying model.

## 7. Operational Notes

- Always render inline citations when displaying content derived from web search.
- Tool calls incur additional cost; budget usage accordingly for agentic and deep research flows.
- For production deployments, ensure environment variables containing API keys allow the Responses API to access the `web_search` tool.
- Monitor latency when enabling agentic or deep research modes—consider background execution paths if responses may take minutes.

By following this guide, Easymo agents can safely enrich their responses with live web context while keeping observability, compliance, and deployment requirements in check.

## 8. Implementation Checklist for Easymo Agents

When wiring the `web_search` tool into an existing Easymo stack, work through the following steps to make sure both the server-side
agent logic and the user interface remain compliant with OpenAI's requirements:

1. **Backend configuration**
   - Expose a `webSearchEnabled` feature flag (or reuse an existing experimental flag) so the capability can be rolled out gradually.
   - Thread the `tools` array into the Responses API client wrapper that the agent runtime already uses (see `packages/openai-client/src/responses.ts`).
   - Capture and persist the `web_search_call` metadata in the agent telemetry pipeline so downstream analytics can distinguish organic answers from searched answers.
2. **Citation-aware rendering**
   - Extend the chat transcript component (e.g., `apps/web/src/components/chat/Message.tsx`) to highlight inline URL markers rendered by the assistant payload.
   - Add hover tooltips or footnotes so end users can inspect the source title before opening the link in a new tab.
3. **Observability and alerting**
   - Update existing Prometheus/Grafana dashboards (`dashboards/agent-search.json`) to track the per-mode latency and error rates for `web_search` calls.
   - Wire log-based alerts that fire if search calls start failing or exceed latency SLOs for more than five minutes.
4. **Compliance reviews**
   - Document how citations are surfaced in the trust-and-safety checklist (`audits/data_provenance.md`).
   - Coordinate with legal/compliance stakeholders if new domains are added to the allow list.

## 9. Self-Hosted Deployment Notes

Teams deploying Easymo's front-end on self-hosted infrastructure should keep the following best practices in mind when shipping web search support:

- **Environment variables:** Define `OPENAI_API_KEY`, `EASYMO_WEB_SEARCH_ENABLED`, and any domain allow-lists in the hosting secret store. Mark secrets as encrypted and restart services after changes.
- **Edge vs. serverless functions:** Web search calls can increase cold-start times. For latency-sensitive experiences, dedicate lightweight Node workers or Supabase Edge Functions and pre-warm them through synthetic traffic.
- **Incremental rollouts:** Use staging/prod environments to validate citation rendering before promoting.
- **Monitoring hooks:** Forward logs to the central observability stack (Grafana, Loki, DataDog) so search-related regressions surface quickly.
- **Incident response:** Update the rollback playbook (`ROLLOUT_PLAN.md`) with search-specific mitigations, including toggling off the feature flag if web search outages occur.
