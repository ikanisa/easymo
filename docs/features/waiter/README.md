# 🍽️ Waiter AI System

**Status:** Production-Ready (with minor refactoring needed)  
**Last Updated:** 2025-12-10

---

## 📚 Documentation Index

- **[DOCUMENTATION_HUB.md](./DOCUMENTATION_HUB.md)** - Complete documentation index and navigation
- **[COMPLETE_SYSTEM_ANALYSIS.md](./COMPLETE_SYSTEM_ANALYSIS.md)** - Full code, database, and architecture audit
- **This README** - Quick overview and getting started

💡 **New here?** Start with [DOCUMENTATION_HUB.md](./DOCUMENTATION_HUB.md) for guided navigation.

---

## 🎯 Quick Overview

The Waiter AI system enables customers to order food and drinks via WhatsApp, with AI-powered natural language understanding and real-time order management for restaurant staff.

### System Components

```
Customer (WhatsApp) → Waiter AI Agent → Bar Manager App
                           ↓
                     Database (Supabase)
```

**3 Main Parts:**
1. **Customer Interface:** WhatsApp chat
2. **AI Agent:** Processes orders, manages cart, handles payments
3. **Bar Manager App:** Staff order queue and menu management

---

## ✅ What Works

✅ **Real Database Queries** - No mock data!  
✅ **8+ AI Tools** - Menu search, cart, payments, reservations  
✅ **Multi-Language** - EN, FR, ES, PT, DE, RW, SW  
✅ **Payment Processing** - MTN MoMo, Airtel Money, Revolut, Cash  
✅ **QR Code Discovery** - Scan table QR to start ordering  
✅ **Dual AI Providers** - GPT-4 + Gemini fallback  

---

## ⚠️ Known Issues

⚠️ **4 Different Implementations** - Need consolidation (see analysis)  
⚠️ **Duplicate Payment Tools** - 400 lines duplicated in _shared/waiter-tools.ts  
⚠️ **Inconsistent Table Names** - menu_items vs restaurant_menu_items  
🔴 **Bar Manager App** - CSS build issue prevents running  

---

## 🚀 Quick Start

### For Developers

**1. Main Agent Implementation:**
```typescript
// packages/agents/src/agents/waiter/waiter.agent.ts
import { WaiterAgent } from '@easymo/agents/waiter';

const agent = new WaiterAgent();
const result = await agent.execute({
  message: "Show me the menu",
  context: {
    userId: "user123",
    restaurantId: "bar-uuid",
    language: "en"
  }
});
```

**2. Shared Tools:**
```typescript
// supabase/functions/_shared/waiter-tools.ts
import { waiterTools } from '../_shared/waiter-tools.ts';

const result = await waiterTools.search_menu(context, {
  query: "pizza",
  category: "main",
  is_vegan: false
});
```

**3. Database Tables:**
```sql
-- Primary tables
menu_items              -- Menu items
orders                  -- All orders
order_items             -- Line items
bars                    -- Restaurants/bars
payments                -- Payment records
reservations            -- Table bookings
waiter_conversations    -- Chat history
```

---

## 📁 File Locations

```
packages/agents/src/agents/waiter/
├── waiter.agent.ts              ⭐ Main implementation (531 LOC)
└── __tests__/waiter.agent.test.ts

supabase/functions/
├── wa-webhook-waiter/           WhatsApp webhook (800+ LOC)
├── wa-agent-waiter/             Unified architecture (483 LOC)
└── _shared/waiter-tools.ts      Shared tools (1,547 LOC)

services/agent-core/src/agents/
└── waiter-broker.ts             NestJS broker (356 LOC)

admin-app/                       Bar Manager (partial)
└── lib/
    ├── bars/                    Bar services
    └── queries/                 Database queries

docs/features/waiter/
├── COMPLETE_SYSTEM_ANALYSIS.md  ⭐ Full analysis
└── README.md                    This file
```

---

## 🔧 Refactoring Needed

See [COMPLETE_SYSTEM_ANALYSIS.md](./COMPLETE_SYSTEM_ANALYSIS.md) for detailed plan.

**Priority Tasks:**

1. **P0:** Fix Bar Manager CSS build (1 day)
2. **P1:** Consolidate 4 agent implementations → 1 (2-3 days)
3. **P1:** Standardize database table names (1 day)
4. **P2:** Remove duplicate payment tools (1 hour)
5. **P2:** Consolidate documentation (2 hours)

**Expected Results:**
- 66% reduction in code (2,358 → ~800 LOC)
- Single source of truth for agent logic
- Functional Bar Manager app
- Consistent table naming

---

## 🎓 Learning Resources

**Key Concepts:**
- AI Agent architecture with tools
- Supabase Realtime for order updates
- WhatsApp webhook handling
- Payment processing (MoMo, Revolut)
- Multi-language NLP

**Code Examples:**
- `packages/agents/src/agents/waiter/waiter.agent.ts` - Well-structured agent class
- `supabase/functions/_shared/waiter-tools.ts` - Comprehensive tool suite
- `supabase/functions/wa-webhook-waiter/agent.ts` - Session management

---

## 📊 System Stats

| Metric | Value |
|--------|-------|
| **Total LOC** | 2,358 |
| **AI Tools** | 16+ |
| **Languages** | 7 |
| **Payment Methods** | 4 |
| **Database Tables** | 12+ |
| **Edge Functions** | 2 main + 1 unified |
| **Documentation** | 17 files |

---

## 🆘 Troubleshooting

**"Cannot find menu items"**
- Check restaurant_id is correct
- Verify menu_items table has data
- Check available = true

**"Payment failed"**
- Verify payment provider credentials
- Check order status is 'pending_payment'
- Ensure payment method is enabled for restaurant

**"Bar Manager won't start"**
- Known CSS build issue
- Follow fix in BAR_MANAGER_COMPLETE_SUMMARY.md
- Use create-next-app template

**"Multiple system prompts"**
- Different implementations have different prompts
- Use packages/agents/waiter.agent.ts as canonical
- See refactoring plan in analysis

---

## 🤝 Contributing

When making changes:

1. **Use packages/agents/waiter.agent.ts** as source of truth
2. **Update shared tools** in _shared/waiter-tools.ts
3. **Follow GROUND_RULES.md** for observability
4. **Test with real restaurant data**
5. **Update this documentation**

---

## 📞 Support

For questions or issues:
1. Check [COMPLETE_SYSTEM_ANALYSIS.md](./COMPLETE_SYSTEM_ANALYSIS.md)
2. Review code in packages/agents/waiter/
3. Check docs/GROUND_RULES.md for system requirements

---

**Last Updated:** 2025-12-10  
**Status:** ✅ Functional (refactoring recommended)
