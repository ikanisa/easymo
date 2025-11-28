# AI Provider Integration - Next Steps

## Immediate Tasks (This Week)

### 1. Update Package Dependencies
```bash
cd packages/ai
pnpm add @google/generative-ai@^0.21.0
pnpm add @google/genai@^1.0.0
pnpm build
```

### 2. Update AgentsService
**File:** `services/agent-core/src/modules/agents/agents.service.ts`

Replace current implementation:
```typescript
// OLD:
const input = options.messages
  .map((message) => `[${message.role}] ${message.content}`)
  .join("\n");
const response = await this.client.responses.create({ model, metadata, input });

// NEW:
import { UnifiedAIProvider } from '@easymo/ai/core/unified-provider';

constructor(private readonly config: ConfigService) {
  this.unifiedProvider = new UnifiedAIProvider({
    openai: { 
      apiKey: config.get<string>("openai.apiKey"),
      defaultModel: 'gpt-4o',
    },
    gemini: { 
      apiKey: config.get<string>("gemini.apiKey"),
    },
    primaryProvider: 'openai',
    costOptimizationEnabled: true,
    fallbackEnabled: true,
  });
}

async runAgent(options: AgentRunOptions) {
  return await this.unifiedProvider.chat({
    messages: options.messages,
    model: options.agentId,
    metadata: options.metadata,
  });
}
```

### 3. Add Environment Variables
```bash
# .env
GEMINI_API_KEY=AIza...
AI_PRIMARY_PROVIDER=openai
AI_COST_OPTIMIZATION=true
AI_FALLBACK_ENABLED=true
```

### 4. Test Integration
```bash
# Unit tests
pnpm --filter @easymo/ai test

# Integration test
pnpm --filter @easymo/agent-core test:integration
```

## Week 1 Deliverables
- [ ] Package dependencies updated
- [ ] AgentsService migrated to UnifiedProvider
- [ ] Environment variables configured
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Observability logs validated

## Week 2 Deliverables
- [ ] Cost tracking implemented
- [ ] Provider health monitoring
- [ ] A/B test in staging (10% traffic)
- [ ] Cost savings validated (target: 60%+)

## Validation Checklist

### Functional
- [ ] Simple queries route to Gemini Flash-Lite
- [ ] Complex queries route to GPT-4o
- [ ] Fallback triggers on provider failure
- [ ] Circuit breaker prevents cascade failures

### Performance
- [ ] Gemini Flash-Lite responses < 300ms
- [ ] GPT-4o responses < 2s
- [ ] Fallback adds < 500ms overhead

### Cost
- [ ] Gemini usage > 70% for simple queries
- [ ] Total cost reduced by 60%+ vs baseline
- [ ] No quality degradation

### Observability
- [ ] Structured logs include provider, model, cost
- [ ] Metrics track provider distribution
- [ ] Alerts trigger on circuit breaker events

## Questions for Product/Business
1. **Budget:** What's the monthly AI budget target?
2. **Priority:** Which agents should prioritize cost vs. quality?
3. **Voice:** Should we invest in voice (Phase 2) or defer?
4. **Images:** Is image generation (Imagen) a requirement?

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gemini API instability | High | Circuit breaker + fallback to OpenAI |
| Quality degradation | Medium | A/B test, monitor user satisfaction |
| Increased latency | Low | Cache responses, optimize routing |
| Vendor lock-in | Low | Abstraction layer enables easy swap |

---

**Owner:** DevOps + Backend Team  
**Timeline:** 2 weeks  
**Success Criteria:** 60%+ cost reduction, no quality loss, 99.9% uptime
