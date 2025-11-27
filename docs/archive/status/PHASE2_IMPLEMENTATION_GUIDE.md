# PHASE 2 - COMPLETE IMPLEMENTATION GUIDE

## Overview
All database tables are created and populated. This guide provides exact code changes needed to complete all 7 remaining tasks.

---

## TASK 1: Fix Profile Menu Display (CRITICAL)

### Problem
User only sees "MOMO QR code & Tokens" instead of all profile items.

### Root Cause
RPC function not filtering by region correctly.

### Solution

**File:** `supabase/functions/wa-webhook/utils/dynamic_submenu.ts`

```typescript
export async function fetchProfileMenuItems(
  countryCode: string = 'RW',
  language: string = 'en',
  client?: SupabaseClient,
): Promise<SubmenuItem[]> {
  const db = client || supabase;

  // Determine if country is in Africa
  const { data: countryData } = await db
    .from('countries')
    .select('code')
    .eq('code', countryCode)
    .single();

  const isAfrica = !!countryData; // If country exists in our countries table, it's Africa

  // Fetch menu items
  const { data, error } = await db
    .from('whatsapp_profile_menu_items')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('Failed to fetch profile menu items:', error);
    return [];
  }

  // Filter by region
  const filtered = (data || []).filter((item: any) => {
    if (!item.region_restrictions) return true; // No restriction = show everywhere
    
    if (item.region_restrictions.includes('africa')) {
      return isAfrica; // Only show in African countries
    }
    
    return true;
  });

  return filtered.map((item: any) => ({
    key: item.key,
    name: item.name,
    icon: item.icon,
    display_order: item.display_order,
    action_type: item.action_type,
    action_target: item.action_target,
    description: item.description_en || item.description || ''
  }));
}
```

**Test:**
- Rwanda user should see 8 items
- UK/Malta user should see 4 items (businesses, properties, language, help)

---

## TASK 2: Add Notary Services Route Handler

### Problem
No response when user taps "Notary Services"

### Solution

**File:** `supabase/functions/wa-webhook/router/interactive_list.ts`

Add this case handler (around line 730, with other service handlers):

```typescript
case IDS.NOTARY_SERVICES:
case "notary_services": {
  const { startNotarySearch } = await import("../domains/services/notary.ts");
  return await startNotarySearch(ctx);
}
```

**Verify IDS constant exists:**

**File:** `supabase/functions/wa-webhook/wa/ids.ts`

```typescript
export const IDS = {
  // ... existing
  NOTARY_SERVICES: "notary_services",
  // ... rest
};
```

---

## TASK 3: Fix Motor Insurance i18n Description

### Problem
Shows "home.rows.motorinsurance.description" instead of actual text.

### Solution

**File:** `supabase/functions/wa-webhook/i18n/messages/en.json`

Find and update:

```json
{
  "home.rows.motorinsurance.title": "🚗 Motor Insurance",
  "home.rows.motorinsurance.description": "Get instant motor insurance quotes and coverage for your vehicle"
}
```

**File:** `supabase/functions/wa-webhook/i18n/messages/fr.json`

```json
{
  "home.rows.motorinsurance.title": "🚗 Assurance Auto",
  "home.rows.motorinsurance.description": "Obtenez des devis d'assurance automobile instantanés et une couverture pour votre véhicule"
}
```

Add to new language files:

**File:** `supabase/functions/wa-webhook/i18n/messages/es.json` (create if doesn't exist)

```json
{
  "home.rows.motorinsurance.title": "🚗 Seguro de Auto",
  "home.rows.motorinsurance.description": "Obtén cotizaciones instantáneas de seguro de auto y cobertura para tu vehículo"
}
```

**File:** `supabase/functions/wa-webhook/i18n/messages/pt.json`

```json
{
  "home.rows.motorinsurance.title": "🚗 Seguro Auto",
  "home.rows.motorinsurance.description": "Obtenha cotações instantâneas de seguro automóvel e cobertura para o seu veículo"
}
```

**File:** `supabase/functions/wa-webhook/i18n/messages/de.json`

```json
{
  "home.rows.motorinsurance.title": "🚗 Autoversicherung",
  "home.rows.motorinsurance.description": "Erhalten Sie sofortige Autoversicherungsangebote und Deckung für Ihr Fahrzeug"
}
```

---

## TASK 4: Add Motor Insurance Help Button

### Solution

**File:** `supabase/functions/wa-webhook/domains/insurance/ins_handler.ts`

Add help handler function:

```typescript
export async function handleInsuranceHelp(ctx: RouterContext): Promise<boolean> {
  // Fetch insurance admin contacts
  const { data: contacts } = await ctx.supabase
    .from('insurance_admin_contacts')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (!contacts || contacts.length === 0) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "insurance.help.no_contacts"),
      homeOnly()
    );
    return true;
  }

  // Build contact buttons
  const buttons = contacts.slice(0, 3).map((contact: any) => ({
    id: `contact_insurance_${contact.id}`,
    title: contact.display_name
  }));

  buttons.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back")
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "insurance.help.message", {
      contacts: contacts.map((c: any) => `${c.display_name}: ${c.contact_value}`).join('\n')
    }),
    buttons,
    { emoji: "🏥" }
  );

  return true;
}
```

**In insurance flow, add help button:**

```typescript
// Where insurance options are shown
case "insurance_help":
case IDS.INSURANCE_HELP: {
  const { handleInsuranceHelp } = await import("../domains/insurance/ins_handler.ts");
  return await handleInsuranceHelp(ctx);
}
```

**Add i18n:**

```json
{
  "insurance.help.message": "Contact our insurance support team:\n\n{contacts}\n\nTap a number to chat on WhatsApp.",
  "insurance.help.no_contacts": "Insurance support contacts are currently unavailable. Please try again later."
}
```

---

## TASK 5: Implement Customer Support AI Agent

### Solution

**File:** `supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts` (CREATE NEW)

```typescript
import type { RouterContext } from "../../types.ts";
import { sendText, sendButtonsMessage } from "../../wa/client.ts";
import { t } from "../../i18n/translator.ts";
import { homeOnly } from "../../utils/reply.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.20.1/mod.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

interface AIAgentConfig {
  agent_key: string;
  agent_name: string;
  persona: string;
  system_prompt: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  tools: any[];
}

export async function startCustomerSupportChat(ctx: RouterContext): Promise<boolean> {
  // Fetch AI agent config from database
  const { data: agentConfig, error } = await ctx.supabase
    .from('ai_agents_config')
    .select('*')
    .eq('agent_key', 'customer_support')
    .eq('is_active', true)
    .single();

  if (error || !agentConfig) {
    console.error("Failed to load customer support agent config:", error);
    await sendButtonsMessage(
      ctx,
      "Customer support AI is currently unavailable. Please contact human support.",
      homeOnly()
    );
    return true;
  }

  // Show initial message
  await sendText(
    ctx,
    `${agentConfig.agent_name} is here to help! 👋\n\nAsk me anything about your account, services, payments, or technical issues.\n\nType your question or concern...`
  );

  // Set state to capture next message
  await ctx.supabase
    .from('user_states')
    .upsert({
      profile_id: ctx.profileId,
      key: 'ai_customer_support_active',
      data: {
        agent_config: agentConfig,
        conversation_history: []
      }
    });

  return true;
}

export async function handleCustomerSupportMessage(
  ctx: RouterContext,
  userMessage: string,
  agentConfig: AIAgentConfig,
  conversationHistory: any[]
): Promise<boolean> {
  
  // Build messages
  const messages = [
    {
      role: "system",
      content: `${agentConfig.persona}\n\n${agentConfig.system_prompt}`
    },
    ...conversationHistory,
    {
      role: "user",
      content: userMessage
    }
  ];

  try {
    // Call OpenAI with dynamic config
    const completion = await openai.chat.completions.create({
      model: agentConfig.model_name,
      messages: messages as any,
      temperature: agentConfig.temperature,
      max_tokens: agentConfig.max_tokens,
    });

    const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";

    // Send response
    await sendText(ctx, aiResponse);

    // Update conversation history
    conversationHistory.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: aiResponse }
    );

    // Save state
    await ctx.supabase
      .from('user_states')
      .upsert({
        profile_id: ctx.profileId,
        key: 'ai_customer_support_active',
        data: {
          agent_config: agentConfig,
          conversation_history: conversationHistory.slice(-10) // Keep last 10 messages
        }
      });

    // Show options
    await sendButtonsMessage(
      ctx,
      "Need more help?",
      [
        { id: "continue_ai_chat", title: "Continue chatting" },
        { id: "escalate_to_human", title: "Talk to human" },
        { id: IDS.BACK_MENU, title: "Back to menu" }
      ]
    );

    return true;
  } catch (error) {
    console.error("AI agent error:", error);
    await sendButtonsMessage(
      ctx,
      "I'm having trouble right now. Would you like to talk to a human support agent?",
      [
        { id: "escalate_to_human", title: "Yes, connect me" },
        { id: IDS.BACK_MENU, title: "Back to menu" }
      ]
    );
    return true;
  }
}

export async function escalateToHumanSupport(ctx: RouterContext): Promise<boolean> {
  // Fetch customer support contacts
  const { data: contacts } = await ctx.supabase
    .from('customer_support_contacts')
    .select('*')
    .eq('is_active', true)
    .eq('department', 'customer_support')
    .order('display_order');

  if (!contacts || contacts.length === 0) {
    await sendButtonsMessage(
      ctx,
      "Support contacts are currently unavailable.",
      homeOnly()
    );
    return true;
  }

  const contactList = contacts
    .map((c: any) => `${c.display_name}: ${c.contact_value}`)
    .join('\n');

  await sendButtonsMessage(
    ctx,
    `Our support team is ready to help:\n\n${contactList}\n\nTap a number to start chatting on WhatsApp.`,
    contacts.slice(0, 3).map((c: any) => ({
      id: `whatsapp_${c.id}`,
      title: c.display_name
    })).concat([{ id: IDS.BACK_MENU, title: "Back" }])
  );

  return true;
}
```

**Add route handler:**

**File:** `supabase/functions/wa-webhook/router/interactive_list.ts`

```typescript
case "help_support":
case "show_help":
case "customer_support": {
  const { startCustomerSupportChat } = await import("../domains/ai-agents/customer-support.ts");
  return await startCustomerSupportChat(ctx);
}

case "escalate_to_human": {
  const { escalateToHumanSupport } = await import("../domains/ai-agents/customer-support.ts");
  return await escalateToHumanSupport(ctx);
}
```

**Handle ongoing conversation in text router:**

**File:** `supabase/functions/wa-webhook/router/text.ts`

```typescript
// Check for active AI chat
const { data: aiState } = await ctx.supabase
  .from('user_states')
  .select('*')
  .eq('profile_id', ctx.profileId)
  .eq('key', 'ai_customer_support_active')
  .single();

if (aiState?.data) {
  const { handleCustomerSupportMessage } = await import("../domains/ai-agents/customer-support.ts");
  return await handleCustomerSupportMessage(
    ctx,
    text,
    aiState.data.agent_config,
    aiState.data.conversation_history || []
  );
}
```

---

## TASK 6: Update Language Selector

### Solution

**File:** `supabase/functions/wa-webhook/router/interactive_list.ts`

Replace hardcoded language list:

```typescript
case "change_language": {
  // Fetch languages from database
  const { data: languages } = await ctx.supabase
    .from('supported_languages')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (!languages || languages.length === 0) {
    // Fallback
    await sendListMessage(ctx, {
      title: "Change Language",
      body: "Select your preferred language:",
      sectionTitle: "Available Languages",
      rows: [
        { id: "lang_en", title: "🇬🇧 English", description: "English" },
        { id: "lang_fr", title: "🇫🇷 Français", description: "French" }
      ],
      buttonText: "Select"
    });
    return true;
  }

  // Build dynamic language list
  const rows = languages.map((lang: any) => ({
    id: `lang_${lang.code}`,
    title: `${lang.flag_emoji} ${lang.name}`,
    description: lang.native_name
  }));

  rows.push({
    id: IDS.BACK_MENU,
    title: t(ctx.locale, "common.menu_back"),
    description: ""
  });

  await sendListMessage(ctx, {
    title: t(ctx.locale, "language.select.title", { default: "Change Language" }),
    body: t(ctx.locale, "language.select.body", { default: "Select your preferred language:" }),
    sectionTitle: t(ctx.locale, "language.select.section", { default: "Available Languages" }),
    rows,
    buttonText: t(ctx.locale, "common.buttons.select", { default: "Select" })
  });

  return true;
}
```

---

## TASK 7: Remove Unsupported Countries

### Solution

Run these commands to find and remove references:

```bash
# Find all references to unsupported countries
cd /Users/jeanbosco/workspace/easymo-
grep -r "KE\|UG\|NG\|ZA" supabase/functions/wa-webhook/ --include="*.ts" | grep -v "node_modules"

# Common places to check:
# 1. Country arrays
# 2. Switch statements with country codes
# 3. Hardcoded country lists
```

**Remove from:**

1. Any hardcoded country arrays
2. Profile menu active_countries (already done in migration)
3. Test files
4. Documentation

**Example fixes:**

```typescript
// BEFORE
const supportedCountries = ['RW', 'KE', 'UG', 'TZ', 'BI'];

// AFTER - Use database
const { data: countries } = await supabase
  .from('countries')
  .select('code')
  .eq('is_active', true);

const supportedCountries = countries?.map(c => c.code) || [];
```

---

## TESTING CHECKLIST

After implementing all fixes:

- [ ] Profile menu shows 8 items for Rwanda user
- [ ] Profile menu shows 4 items for UK/Malta user
- [ ] Notary services responds when tapped
- [ ] Motor insurance shows description (not translation key)
- [ ] Motor insurance help button shows contacts
- [ ] Customer support launches AI agent
- [ ] AI agent uses database config (check persona)
- [ ] Escalate to human shows WhatsApp contacts
- [ ] Language selector shows 5 languages (EN, FR, ES, PT, DE)
- [ ] No references to KE, UG, NG, ZA in code

---

## DEPLOYMENT

After all code changes:

```bash
# 1. Commit changes
git add -A
git commit -m "feat: Complete Phase 2 - All critical fixes implemented

- Fix profile menu with region filtering
- Add notary services route handler  
- Fix motor insurance i18n (all languages)
- Add motor insurance help with admin contacts
- Implement customer support AI agent (database-driven)
- Update language selector (5 languages from DB)
- Remove Kenya, Uganda, Nigeria, South Africa references

All functionality now database-driven with no hardcoding."

# 2. Push to GitHub
git push origin main

# 3. Deploy functions
supabase functions deploy wa-webhook --no-verify-jwt

# 4. Test all flows
```

---

## NOTES

- All AI agent configurations are in `ai_agents_config` table - update there, not in code
- Customer support numbers in `customer_support_contacts` - easy to add/remove
- Languages in `supported_languages` - add new languages via database
- Profile menu controlled by `whatsapp_profile_menu_items` - no code changes needed for new items

**Everything is now database-driven as required!**
