# Quick Start: Unified Webhook Pipeline

**Purpose**: Get started implementing the unified WhatsApp pipeline  
**Time**: ~1 week for POC  
**Prerequisites**: Read IMPLEMENTATION_GUIDE.md

## Day 1: Setup & Planning

### Morning: Environment Setup

```bash
# 1. Create feature flag environment variables
cd /home/runner/work/easymo-/easymo-
cp .env.example .env.unified-pipeline

# Add to .env.unified-pipeline:
cat >> .env.unified-pipeline << 'EOF'
# Unified Pipeline Feature Flags
FEATURE_UNIFIED_WEBHOOK=false
FEATURE_UNIFIED_NORMALIZER=false
FEATURE_AGENT_DETECTION=false
FEATURE_AGENT_RUNTIME=false
FEATURE_INTENT_PARSING=false
FEATURE_APPLY_INTENT=false
FEATURE_REPLY_GENERATION=false

# Per-Agent Flags
FEATURE_WAITER_AGENT=false
FEATURE_FARMER_AGENT=false
FEATURE_BROKER_AGENT=false
FEATURE_REAL_ESTATE_AGENT=false
FEATURE_JOBS_AGENT=false
FEATURE_SALES_SDR_AGENT=false
FEATURE_RIDES_AGENT=false
FEATURE_INSURANCE_AGENT=false
EOF

# 2. Create pipeline directory structure
mkdir -p supabase/functions/wa-webhook/pipeline
mkdir -p supabase/functions/wa-webhook/pipeline/__tests__

# 3. Create apply-intent service structure
mkdir -p services/agent-core/src/apply-intent
mkdir -p services/agent-core/src/apply-intent/handlers
mkdir -p services/agent-core/src/apply-intent/handlers/{waiter,jobs,rides,real-estate,farmer,broker,insurance,sales-sdr}

# 4. Install dependencies (if needed)
pnpm install
```

### Afternoon: Review Current Code

1. **Read existing webhook handler**:
   ```bash
   # Main entry point
   view supabase/functions/wa-webhook/index.ts
   
   # Current router
   view supabase/functions/wa-webhook/router.ts
   view supabase/functions/wa-webhook/router/pipeline.ts
   view supabase/functions/wa-webhook/router/processor.ts
   ```

2. **Understand agent tables**:
   ```bash
   # Schema
   view supabase/migrations/20251121184617_ai_agent_ecosystem_whatsapp_first.sql
   
   # Data population
   view supabase/migrations/20251121192657_ai_agents_comprehensive_data_part1.sql
   ```

3. **Review agent implementations**:
   ```bash
   # Waiter agent (most complete)
   ls -la supabase/functions/waiter-ai-agent/
   
   # Jobs agent
   ls -la supabase/functions/job-board-ai-agent/
   ls -la supabase/functions/wa-webhook-jobs/
   ```

---

## Day 2-3: Event Normalizer Implementation

### Create Normalizer

**File**: `supabase/functions/wa-webhook/pipeline/normalizer.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface NormalizedEvent {
  correlationId: string;
  userId: string;
  phoneNumber: string;
  displayName?: string;
  messageType: string;
  content: string;
  payload: any;
  timestamp: Date;
  waMessageId?: string;
}

export interface NormalizationResult {
  event: NormalizedEvent;
  messageId: string;
}

export async function normalizeWhatsAppEvent(
  webhookPayload: any,
  correlationId: string
): Promise<NormalizationResult> {
  // TODO: Implement based on IMPLEMENTATION_GUIDE.md Task 2.1.1
  throw new Error("Not implemented");
}

export function validateWhatsAppSignature(
  payload: string,
  signature: string | null,
  appSecret: string
): boolean {
  // TODO: Implement based on IMPLEMENTATION_GUIDE.md Task 2.1.1
  throw new Error("Not implemented");
}
```

### Write Tests

**File**: `supabase/functions/wa-webhook/pipeline/__tests__/normalizer.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { normalizeWhatsAppEvent } from "../normalizer.ts";

Deno.test("normalizeWhatsAppEvent - text message", async () => {
  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: "+250788123456",
            id: "wamid.123",
            type: "text",
            timestamp: "1700000000",
            text: { body: "Hello" }
          }],
          contacts: [{
            profile: { name: "John Doe" }
          }]
        }
      }]
    }]
  };

  const result = await normalizeWhatsAppEvent(payload, "test-correlation-id");
  
  assertEquals(result.event.phoneNumber, "+250788123456");
  assertEquals(result.event.messageType, "text");
  assertEquals(result.event.content, "Hello");
});

// TODO: Add more test cases per IMPLEMENTATION_GUIDE.md
```

### Run Tests

```bash
deno test --allow-env --allow-net supabase/functions/wa-webhook/pipeline/__tests__/normalizer.test.ts
```

---

## Day 4: Agent Detector Implementation

### Create Agent Detector

**File**: `supabase/functions/wa-webhook/pipeline/agent-detector.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface AgentConfig {
  id: string;
  slug: string;
  name: string;
  default_persona_code: string;
  default_system_instruction_code: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  agent_id: string | null;
  status: string;
}

const MENU_TO_AGENT: Record<string, string> = {
  '1': 'waiter',
  '1️⃣': 'waiter',
  '2': 'farmer',
  '2️⃣': 'farmer',
  '3': 'business_broker',
  '3️⃣': 'business_broker',
  '4': 'real_estate',
  '4️⃣': 'real_estate',
  '5': 'jobs',
  '5️⃣': 'jobs',
  '6': 'sales_cold_caller',
  '6️⃣': 'sales_cold_caller',
  '7': 'rides',
  '7️⃣': 'rides',
  '8': 'insurance',
  '8️⃣': 'insurance',
  '9': null, // Profile - not an agent
  '9️⃣': null,
};

export async function detectAgent(
  userId: string,
  content: string,
  correlationId: string
): Promise<AgentConfig | null> {
  // TODO: Implement based on IMPLEMENTATION_GUIDE.md Task 2.1.2
  throw new Error("Not implemented");
}

export async function getOrCreateConversation(
  userId: string,
  agentId: string | null
): Promise<Conversation> {
  // TODO: Implement based on IMPLEMENTATION_GUIDE.md Task 2.1.2
  throw new Error("Not implemented");
}
```

### Write Tests

**File**: `supabase/functions/wa-webhook/pipeline/__tests__/agent-detector.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { detectAgent, MENU_TO_AGENT } from "../agent-detector.ts";

Deno.test("detectAgent - menu selection 1 -> waiter", async () => {
  const agent = await detectAgent("test-user-id", "1", "test-corr-id");
  assertEquals(agent?.slug, "waiter");
});

Deno.test("detectAgent - menu selection 1️⃣ -> waiter", async () => {
  const agent = await detectAgent("test-user-id", "1️⃣", "test-corr-id");
  assertEquals(agent?.slug, "waiter");
});

// TODO: Add more test cases per IMPLEMENTATION_GUIDE.md
```

---

## Day 5: Integration & Testing

### Create Integration Test

**File**: `supabase/functions/wa-webhook/pipeline/__tests__/integration.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("End-to-end pipeline - waiter order", async () => {
  // 1. Normalize event
  const payload = createMockWhatsAppPayload("1️⃣"); // Select waiter
  const normalized = await normalizeWhatsAppEvent(payload, "test-id");
  
  // 2. Detect agent
  const agent = await detectAgent(normalized.event.userId, normalized.event.content, "test-id");
  assertEquals(agent?.slug, "waiter");
  
  // 3. TODO: Test agent runtime
  // 4. TODO: Test intent parsing
  // 5. TODO: Test apply intent
  // 6. TODO: Test reply generation
});

function createMockWhatsAppPayload(message: string) {
  return {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: "+250788123456",
            id: "wamid.test",
            type: "text",
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: message }
          }],
          contacts: [{
            profile: { name: "Test User" }
          }]
        }
      }]
    }]
  };
}
```

### Update Main Webhook Handler

**File**: `supabase/functions/wa-webhook/index.ts`

Add feature flag routing:

```typescript
import { FEATURES } from "./config.ts";
import { normalizeWhatsAppEvent } from "./pipeline/normalizer.ts";
import { detectAgent } from "./pipeline/agent-detector.ts";

// In main serve() function, before existing router:
if (FEATURES.UNIFIED_WEBHOOK) {
  console.log(JSON.stringify({
    event: "USING_UNIFIED_WEBHOOK",
    correlationId,
  }));
  
  // TODO: Call unified pipeline
  // const result = await processUnifiedPipeline(req);
  // return finalize(result);
  
  // For now, fall through to legacy
}

// Existing logic continues...
```

---

## Week 2: Apply Intent Service

### Create Service Structure

```bash
cd services/agent-core
pnpm add @easymo/db @easymo/commons @easymo/messaging
```

**File**: `services/agent-core/src/apply-intent/index.ts`

```typescript
import { childLogger } from "@easymo/commons";
import { PrismaClient } from "@easymo/db";

const log = childLogger({ service: "apply-intent" });
const prisma = new PrismaClient();

export async function processIntents() {
  // Background worker that polls ai_agent_intents table
  log.info({ event: "INTENT_PROCESSOR_STARTED" }, "Starting intent processor");
  
  while (true) {
    try {
      // Get pending intents
      const intents = await getPendingIntents();
      
      for (const intent of intents) {
        await applyIntent(intent);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every 1s
    } catch (error) {
      log.error({ event: "INTENT_PROCESSOR_ERROR", error: error.message }, "Error processing intents");
    }
  }
}

async function getPendingIntents() {
  // TODO: Query supabase ai_agent_intents where status = 'pending'
  throw new Error("Not implemented");
}

async function applyIntent(intent: any) {
  // TODO: Route to handler based on agent_id and intent_type
  throw new Error("Not implemented");
}

if (import.meta.main) {
  processIntents();
}
```

### Create Waiter Intent Handler

**File**: `services/agent-core/src/apply-intent/handlers/waiter/order-food.ts`

```typescript
import { childLogger } from "@easymo/commons";
import { createClient } from "@supabase/supabase-js";

const log = childLogger({ handler: "waiter-order-food" });

export async function handleOrderFood(intent: any) {
  log.info({ event: "HANDLING_ORDER_FOOD", intentId: intent.id }, "Processing order");
  
  // Extract structured data from intent.structured_payload
  const { barId, menuItems, deliveryLocation, notes } = intent.structured_payload;
  
  // Insert into orders table
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: intent.conversation.user_id,
      bar_id: barId,
      items: menuItems,
      delivery_location: deliveryLocation,
      notes,
      status: "pending",
      created_via: "ai_agent",
      source_intent_id: intent.id,
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }
  
  log.info({ event: "ORDER_CREATED", orderId: order.id }, "Order created successfully");
  
  return {
    orderId: order.id,
    status: "pending",
  };
}
```

---

## Deployment Checklist

### Prerequisites

- [ ] All feature flags added to Supabase secrets
- [ ] Tests passing locally
- [ ] Code reviewed
- [ ] Documentation updated

### Deploy Steps

```bash
# 1. Deploy edge functions
supabase functions deploy wa-webhook --project-ref <your-ref>

# 2. Set feature flags (all false initially)
supabase secrets set FEATURE_UNIFIED_WEBHOOK=false --project-ref <your-ref>

# 3. Deploy agent-core service
docker build -t agent-core services/agent-core
docker push agent-core
kubectl apply -f infrastructure/k8s/agent-core.yaml

# 4. Monitor logs
supabase functions logs wa-webhook --tail
kubectl logs -f deployment/agent-core
```

### Gradual Rollout

```bash
# Enable for 1% of traffic
supabase secrets set FEATURE_UNIFIED_NORMALIZER=true
# Monitor for 1 hour

# Enable for 10%
# Monitor for 4 hours

# Enable for 50%
# Monitor for 1 day

# Enable for 100%
supabase secrets set FEATURE_UNIFIED_WEBHOOK=true
```

---

## Troubleshooting

### Common Issues

**Issue**: Feature flag not working  
**Solution**: Check Supabase secrets are set correctly
```bash
supabase secrets list --project-ref <your-ref>
```

**Issue**: Tests failing with database connection error  
**Solution**: Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env
```bash
cp .env.example .env
# Fill in values from Supabase dashboard
```

**Issue**: Intent not being applied  
**Solution**: Check apply-intent service logs
```bash
kubectl logs -f deployment/agent-core | grep INTENT
```

---

## Next Steps

After completing POC:

1. **Review with team**: Demo the unified pipeline
2. **Iterate**: Address feedback
3. **Complete Phase 2**: Implement all pipeline components
4. **Move to Phase 3**: Extract Profile module
5. **Continue**: Follow IMPLEMENTATION_GUIDE.md

---

## Resources

- **Main Guide**: `docs/architecture/IMPLEMENTATION_GUIDE.md`
- **Architecture**: `docs/architecture/whatsapp-pipeline.md`
- **Agent Map**: `docs/architecture/agents-map.md`
- **Ground Rules**: `docs/GROUND_RULES.md`

---

**Status**: Ready to start  
**Owner**: You!  
**Questions**: Check IMPLEMENTATION_GUIDE.md or ask the team
