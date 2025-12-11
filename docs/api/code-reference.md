# Code Reference

Generated on: 2025-12-02T21:57:27.095Z

---

## Functions

### `createRealtimeSession`

Initialize OpenAI Realtime session

_Source: supabase/functions/openai-realtime-sip/index.ts:24_

---

### `buildInstructions`

Build agent instructions based on locale and context

_Source: supabase/functions/openai-realtime-sip/index.ts:70_

---

### `parseDeepResearchOutput`

Parse deep research output and extract property listings

_Source: supabase/functions/openai-deep-research/index.ts:179_

---

### `extractPropertyFromSearchResult`

Extract structured property data from search result Uses OpenAI to parse unstructured text into
property details

_Source: supabase/functions/openai-deep-research/index.ts:643_

---

### `normalizePhoneNumber`

Normalize phone number to international format with country code

_Source: supabase/functions/openai-deep-research/index.ts:752_

---

### `getCurrencyForCountry`

Get currency code for country

_Source: supabase/functions/openai-deep-research/index.ts:802_

---

### `validateAndNormalizeProperty`

Validate and normalize extracted property data

_Source: supabase/functions/openai-deep-research/index.ts:957_

---

### `unnamed`

Agent Registry Central registry for all AI agents Part of Unified AI Agent Architecture Created:
2025-11-27 Updated: 2025-12-01 - Added Rides and Insurance agents OFFICIAL AGENTS (10 production
agents matching ai_agents database table): 1. waiter - Restaurant/Bar ordering, table booking 2.
farmer - Agricultural support, market prices 3. jobs - Job search, employment, gigs 4. real_estate -
Property rentals, listings 5. marketplace - Buy/sell products, business directory 6. rides -
Transport, ride-sharing, delivery 7. insurance - Motor insurance, policies, claims 8. support -
General help, customer service 9. sales_cold_caller - Sales/Marketing outreach 10. business_broker -
Deprecated, use marketplace

_Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:1_

---

### `unnamed`

Register all available agents All agents use database-driven configuration via AgentConfigLoader

_Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:41_

---

### `unnamed`

Map intents/keywords to agent types

_Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:57_

---

### `unnamed`

Register a new agent

_Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:121_

---

### `unnamed`

Get agent by type

_Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:129_

---

### `unnamed`

Get agent by intent/keyword

_Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:142_

---

### `unnamed`

List all registered agents

_Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:154_

---

### `unnamed`

Check if agent exists

_Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:161_

---

### `unnamed`

Base Agent Interface All AI agents must extend this abstract class Part of Unified AI Agent
Architecture Created: 2025-11-27 NOW USES DATABASE-DRIVEN CONFIGURATION: - Loads personas, system
instructions, tools from database via AgentConfigLoader - Falls back to hardcoded prompts if
database config not available - Provides tool execution via ToolExecutor

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:1_

---

### `unnamed`

Base Agent Class All agents (Waiter, Farmer, Jobs, etc.) extend this NOW DATABASE-DRIVEN: - System
prompts loaded from ai_agent_system_instructions table - Personas loaded from ai_agent_personas
table - Tools loaded from ai_agent_tools table

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:59_

---

### `unnamed`

The database agent slug - maps to ai_agents.slug Override this if agent type differs from database
slug

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:73_

---

### `unnamed`

Main processing method - must be implemented by each agent

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:99_

---

### `unnamed`

Default system prompt for this agent - used as fallback if database config unavailable Subclasses
should override this with their specific prompt

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:104_

---

### `unnamed`

System prompt for this agent - NOW LOADS FROM DATABASE Falls back to getDefaultSystemPrompt() if
database config not available

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:110_

---

### `unnamed`

Initialize database-driven config loader and tool executor Must be called with supabase client
before using database features

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:123_

---

### `unnamed`

Load agent configuration from database Returns cached config if already loaded (5-min cache TTL in
AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:136_

---

### `unnamed`

Get system prompt from database - async version Falls back to getDefaultSystemPrompt() if database
unavailable

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:167_

---

### `unnamed`

Build complete system prompt from database config Combines persona, instructions, guardrails, and
available tools

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:196_

---

### `unnamed`

Get available tools from database config

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:239_

---

### `unnamed`

Execute a tool by name using database-driven tool execution

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:247_

---

### `unnamed`

Get agent ID from database

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:295_

---

### `unnamed`

Helper to build conversation history from session NOW USES DATABASE-DRIVEN SYSTEM PROMPT

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:309_

---

### `unnamed`

Build conversation history with async database prompt loading

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:339_

---

### `unnamed`

Helper to update conversation history in session

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:373_

---

### `unnamed`

Helper to log agent interaction

_Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:412_

---

### `unnamed`

Unified AI Agent Orchestrator Single source of truth for all AI agent interactions Part of Unified
AI Agent Architecture Created: 2025-11-27

_Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:1_

---

### `unnamed`

Main entry point - processes any message

_Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:34_

---

### `unnamed`

Intelligently determines which agent should handle the message

_Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:111_

---

### `unnamed`

Use AI to classify user intent

_Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:150_

---

### `unnamed`

Get AI provider (for agents that need direct access)

_Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:187_

---

### `unnamed`

Get agent registry (for testing/admin)

_Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:194_

---

### `unnamed`

Gemini AI Provider Unified AI provider using Google Gemini Part of Unified AI Agent Architecture
Created: 2025-11-27

_Source: supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts:1_

---

### `unnamed`

Chat completion - main method for agent interactions

_Source: supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts:24_

---

### `unnamed`

Streaming chat (optional - for future use)

_Source: supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts:92_

---

### `unnamed`

Convert standard message format to Gemini format

_Source: supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts:159_

---

### `unnamed`

Session Manager Manages AI agent sessions and context Part of Unified AI Agent Architecture Created:
2025-11-27

_Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:1_

---

### `unnamed`

Get existing session or create new one

_Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:15_

---

### `unnamed`

Update session context

_Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:53_

---

### `unnamed`

Set current agent for session

_Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:73_

---

### `unnamed`

Clear current agent (back to home menu)

_Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:89_

---

### `unnamed`

End session

_Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:105_

---

### `unnamed`

Map database row to Session interface

_Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:121_

---

### `unnamed`

Sales AI Agent (Cold Caller) - Rebuilt with AI Core Uses Gemini 2.5 Pro + GPT-5 with shared tools

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/sales_agent.ts:1_

---

### `unnamed`

Execute sales agent with Gemini 2.5 Pro ReAct loop

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/sales_agent.ts:238_

---

### `runSalesAgent`

Run Sales Agent handler for wa-webhook

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/sales_agent.ts:336_

---

### `unnamed`

AI Agents Location Integration Helper Standard location integration for all AI agents in
wa-webhook-ai-agents Provides unified location handling across jobs, farmer, business, waiter, and
real estate agents Usage:
`typescript import { AgentLocationHelper } from './location-helper.ts'; const helper = new AgentLocationHelper(supabase); const location = await helper.resolveUserLocation(userId, 'jobs_agent'); if (!location) { await helper.promptForLocation(phone, locale, 'job_search'); return; } // Use location for search const results = await searchNearby(location.lat, location.lng); `

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:1_

---

### `unnamed`

Resolve user location with standard priority logic Priority: Cache (30min) → Saved (home/work) →
Prompt

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:97_

---

### `unnamed`

Save location to cache after user shares

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:188_

---

### `unnamed`

Prompt user to share location

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:220_

---

### `unnamed`

Format location context for display in agent responses

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:239_

---

### `unnamed`

Get nearby items using PostGIS search Generic helper for any table with lat/lng/geography columns

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:258_

---

### `createLocationAwareSearchTool`

Quick helper to add location-aware search to agent tools

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:304_

---

### `unnamed`

Waiter AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for restaurant orders, menu queries, and
reservations

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/waiter_agent.ts:1_

---

### `unnamed`

AI Agents Integration Module Connects database search agents with the WhatsApp webhook system.
Agents search ONLY from database - NO web search or external APIs. All agents must have proper error
handling and fallback messages.

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:1_

---

### `routeToAIAgent`

Route request to appropriate AI agent based on intent

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:40_

---

### `invokePropertyAgent`

Invoke Property Rental Agent - DATABASE SEARCH ONLY

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:90_

---

### `sendAgentOptions`

Send agent options to user as interactive list with fallback buttons

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:148_

---

### `handleAgentSelection`

Handle agent option selection with proper error handling

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:209_

---

### `checkAgentSessionStatus`

Check agent session status with proper error handling

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:309_

---

### `unnamed`

Insurance AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for insurance quotes, claims, and
policy management

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/insurance_agent.ts:1_

---

### `handleGeneralBrokerStart`

Start General Broker AI Agent Routes user to the general broker AI agent for service requests

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/general_broker.ts:6_

---

### `unnamed`

AI Agent Handlers for WhatsApp Flows Provides convenient handlers that can be called from the text
router to initiate AI agent sessions for various use cases.

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:1_

---

### `unnamed`

Handle "Nearby Drivers" request with AI agent DATABASE SEARCH ONLY - No web search

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:28_

---

### `unnamed`

Handle "Nearby Pharmacies" request with AI agent

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:34_

---

### `unnamed`

Handle "Nearby Quincailleries" request with AI agent

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:39_

---

### `unnamed`

Handle "Nearby Shops" request with AI agent TWO-PHASE APPROACH: Phase 1: Immediately show top 9
nearby shops from database Phase 2: AI agent processes in background for curated shortlist

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:44_

---

### `handleAIPropertyRental`

Handle "Property Rental" request with AI agent

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:52_

---

### `unnamed`

Handle "Schedule Trip" request with AI agent

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:147_

---

### `handleAIAgentOptionSelection`

Handle AI agent selection from interactive list

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:152_

---

### `handleAIAgentLocationUpdate`

Handle location update for pending AI agent request

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:177_

---

### `unnamed`

Phase 2: Background AI agent processing for shops Agent contacts shops on behalf of user to create
curated shortlist

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:201_

---

### `unnamed`

Phase 1: Send immediate database results (top 9 nearby shops) This provides instant results while AI
agent processes in background

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:207_

---

### `unnamed`

Business Broker AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for business discovery and
recommendations

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/business_broker_agent.ts:1_

---

### `unnamed`

Rides AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for ride matching and transportation
services

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/rides_agent.ts:1_

---

### `unnamed`

Farmer AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for agricultural services and marketplace

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/farmer_agent.ts:1_

---

### `unnamed`

AI Agents Module Central export point for all AI agent functionality in the WhatsApp webhook system.

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/index.ts:1_

---

### `unnamed`

Jobs AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for job matching and career guidance

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/jobs_agent.ts:1_

---

### `unnamed`

Real Estate AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro with vision for property search and
viewings

_Source: supabase/functions/wa-webhook-ai-agents/ai-agents/real_estate_agent.ts:1_

---

### `unnamed`

Insurance AI Agent Handles motor insurance quotes, renewals, claims, and policy management Part of
Unified AI Agent Architecture Created: 2025-12-01 DATABASE-DRIVEN: - System prompt loaded from
ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from
ai_agent_tools table (via AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/agents/insurance-agent.ts:1_

---

### `unnamed`

Default system prompt - fallback if database config not available

_Source: supabase/functions/wa-webhook-ai-agents/agents/insurance-agent.ts:95_

---

### `unnamed`

Farmer AI Agent Handles agricultural support, market prices, crop advice Part of Unified AI Agent
Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from
ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from
ai_agent_tools table (via AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/agents/farmer-agent.ts:1_

---

### `unnamed`

Default system prompt - fallback if database config not available

_Source: supabase/functions/wa-webhook-ai-agents/agents/farmer-agent.ts:95_

---

### `unnamed`

Rides AI Agent Handles transport services, ride-sharing, driver/passenger matching Part of Unified
AI Agent Architecture Created: 2025-12-01 DATABASE-DRIVEN: - System prompt loaded from
ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from
ai_agent_tools table (via AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/agents/rides-agent.ts:1_

---

### `unnamed`

Default system prompt - fallback if database config not available

_Source: supabase/functions/wa-webhook-ai-agents/agents/rides-agent.ts:95_

---

### `unnamed`

Jobs AI Agent Handles job search, posting, applications, gig work Part of Unified AI Agent
Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from
ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from
ai_agent_tools table (via AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/agents/jobs-agent.ts:1_

---

### `unnamed`

Default system prompt - fallback if database config not available

_Source: supabase/functions/wa-webhook-ai-agents/agents/jobs-agent.ts:94_

---

### `unnamed`

Property AI Agent Handles rental property search, listings, inquiries Part of Unified AI Agent
Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from
ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from
ai_agent_tools table (via AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/agents/property-agent.ts:1_

---

### `unnamed`

Default system prompt - fallback if database config not available

_Source: supabase/functions/wa-webhook-ai-agents/agents/property-agent.ts:94_

---

### `unnamed`

Support AI Agent General help, navigation, and customer support Part of Unified AI Agent
Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from
ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from
ai_agent_tools table (via AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/agents/support-agent.ts:1_

---

### `unnamed`

Default system prompt - fallback if database config not available

_Source: supabase/functions/wa-webhook-ai-agents/agents/support-agent.ts:94_

---

### `unnamed`

Waiter AI Agent Handles restaurant/bar ordering, table booking, recommendations Part of Unified AI
Agent Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from
ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from
ai_agent_tools table (via AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/agents/waiter-agent.ts:1_

---

### `unnamed`

Default system prompt - fallback if database config not available

_Source: supabase/functions/wa-webhook-ai-agents/agents/waiter-agent.ts:94_

---

### `unnamed`

Marketplace AI Agent Handles buying/selling products, business listings, shopping Part of Unified AI
Agent Architecture Created: 2025-11-27 NOTE: This agent replaces the business_broker agent. The type
is 'business_broker_agent' for backward compatibility but it maps to the 'marketplace' slug in the
database. NOW DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table -
Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via
AgentConfigLoader)

_Source: supabase/functions/wa-webhook-ai-agents/agents/marketplace-agent.ts:1_

---

### `unnamed`

Default system prompt - fallback if database config not available

_Source: supabase/functions/wa-webhook-ai-agents/agents/marketplace-agent.ts:97_

---

### `unnamed`

WA-Webhook-AI-Agents - Unified AI Agent System Single microservice for all AI-powered agents Part of
Unified AI Agent Architecture Created: 2025-11-27

_Source: supabase/functions/wa-webhook-ai-agents/index.ts:1_

---

### `unnamed`

Notification Filters - Quiet Hours, Opt-out, and Policy Enforcement Ground Rules Compliance:
Structured logging and security

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:1_

---

### `checkOptOut`

Check if contact has opted out of notifications

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:21_

---

### `checkQuietHours`

Check if current time is within contact's quiet hours

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:53_

---

### `calculateQuietHoursEnd`

Calculate when quiet hours end for a contact

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:105_

---

### `applyNotificationFilters`

Apply all notification filters

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:145_

---

### `maskWa`

Mask WhatsApp ID for logging (PII protection)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:173_

---

### `checkRateLimit`

Check if notification should be rate limited Simple implementation - can be enhanced with Redis

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:181_

---

### `ensureContactPreferences`

Initialize contact preferences if they don't exist

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:223_

---

### `unnamed`

Enhanced Notification Processing with Filters Integrates quiet hours, opt-out, and rate limiting
Ground Rules Compliance: Structured logging, security, observability

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:1_

---

### `processNotificationWithFilters`

Process notification with filters before delivery Returns true if notification should be delivered,
false if deferred/blocked

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:25_

---

### `handleFilterBlock`

Handle notification blocked by filters

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:66_

---

### `extractMetaErrorCode`

Extract Meta error code from WhatsApp API error response

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:151_

---

### `categorizeMetaError`

Categorize Meta error codes for retry logic

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:172_

---

### `calculateRateLimitBackoff`

Calculate backoff time for rate limit errors

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:204_

---

### `maskWa`

Mask WhatsApp ID for logging (PII protection)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:224_

---

### `getNotificationLocale`

Get preferred locale for notification

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:232_

---

### `logDeliveryMetrics`

Log notification delivery metrics by domain and message format

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:258_

---

### `extractCountryCode`

Extract country code from phone number

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/exchange/country_support.ts:11_

---

### `checkCountrySupport`

Check if country supports a specific feature

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/exchange/country_support.ts:38_

---

### `getMomoProvider`

Get MOMO provider info for country

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/exchange/country_support.ts:127_

---

### `listSupportedCountries`

List all supported countries for a feature

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/exchange/country_support.ts:166_

---

### `showBusinessWhatsAppNumbers`

Display list of WhatsApp numbers for a business

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:19_

---

### `startAddWhatsAppNumber`

Start the flow to add a new WhatsApp number

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:95_

---

### `handleAddWhatsAppNumberText`

Handle text input for adding WhatsApp number

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:119_

---

### `handleWhatsAppNumberSelection`

Handle selection of a specific WhatsApp number (for future edit/delete)

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:203_

---

### `maskPhoneNumber`

Mask phone number for display (show only last 4 digits)

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:224_

---

### `formatDate`

Format date for display

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:234_

---

### `showManageBusinesses`

Display list of businesses owned by the current user

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:41_

---

### `showBusinessDetail`

Show detail view for a specific business with management options

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:150_

---

### `handleBusinessDelete`

Handle business deletion with confirmation

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:254_

---

### `confirmBusinessDelete`

Confirm and execute business deletion

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:287_

---

### `handleBusinessSelection`

Handle business selection from the list

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:335_

---

### `startBusinessClaim`

Start business claiming flow

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:40_

---

### `handleBusinessNameSearch`

Handle business name search with OpenAI semantic search

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:71_

---

### `handleBusinessClaim`

Handle business selection and claiming

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:175_

---

### `searchBusinessesSemantic`

OpenAI-powered semantic business search Uses embeddings and smart matching to find businesses

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:281_

---

### `searchBusinessesSimple`

Simple fallback search (no OpenAI)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:441_

---

### `searchBusinessesSmart`

Fuzzy/semantic business search (fast path)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:485_

---

### `claimBusiness`

Claim a business for the user

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:599_

---

### `createBusinessFromBar`

Create a business entry from a bars table record

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:654_

---

### `formatBusinessDescription`

Format business description for list display

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:720_

---

### `handleProfileMenu`

Profile Hub Unified entry point for managing: - Vehicles - Businesses - Properties - Tokens -
Settings

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/profile/index.ts:12_

---

### `getProfileMenuItemId`

Map profile menu item action_targets to route IDs This ensures the router can handle actions from
database-driven menu

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/profile/index.ts:160_

---

### `handleVehicleCertificateMedia`

Handle vehicle certificate media upload

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/profile/index.ts:270_

---

### `getLocalizedMenuName`

Get localized menu item name for a specific country

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:58_

---

### `fetchActiveMenuItems`

Fetch active menu items from database filtered by country Returns items with country-specific names
applied

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:71_

---

### `normalizeMenuKey`

Normalize a menu key (legacy or canonical) to its canonical agent key.

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:150_

---

### `getMenuItemId`

Map menu item keys to IDS constants

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:159_

---

### `getMenuItemTranslationKeys`

Get translation key for menu item

_Source:
supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:170_

---

### `normalizeMenuKey`

Normalizes a menu key to its canonical agent key

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/config/home_menu_aliases.ts:88_

---

### `isLegacyMenuKey`

Checks if a key is a legacy (aliased) key

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/config/home_menu_aliases.ts:95_

---

### `isCanonicalMenuKey`

Validates if a key is a canonical menu key

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/config/home_menu_aliases.ts:119_

---

### `unnamed`

Connection Pool Manager for Supabase Client Implements connection pooling to: - Reduce connection
overhead - Improve performance - Manage connection lifecycle - Monitor pool health

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:1_

---

### `unnamed`

Initialize pool with minimum connections

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:71_

---

### `unnamed`

Create a new pooled connection

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:91_

---

### `unnamed`

Acquire a connection from the pool

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:138_

---

### `unnamed`

Release a connection back to the pool

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:188_

---

### `unnamed`

Execute operation with pooled connection

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:213_

---

### `unnamed`

Perform pool maintenance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:227_

---

### `unnamed`

Get pool statistics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:270_

---

### `unnamed`

Check pool health

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:287_

---

### `unnamed`

Destroy the pool

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:298_

---

### `unnamed`

Singleton pool instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:315_

---

### `withPooledConnection`

Helper function to execute with pooled connection

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:327_

---

### `unnamed`

Streaming Response Handler for OpenAI Handles server-sent events (SSE) from OpenAI Chat Completions
API Accumulates chunks and provides real-time updates ADDITIVE ONLY - New file, no modifications to
existing code

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/streaming_handler.ts:1_

---

### `unnamed`

Stream chat completion responses Yields chunks as they arrive from OpenAI

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/streaming_handler.ts:42_

---

### `unnamed`

Accumulate full response from stream Useful when you want streaming internally but need the complete
response

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/streaming_handler.ts:208_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/streaming_handler.ts:260_

---

### `unnamed`

Agent Context Builder Builds comprehensive context for AI agents from WhatsApp messages Extracts
user profile, conversation history, and session state

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:1_

---

### `extractMessageContent`

Extract message content from different message types

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:115_

---

### `fetchUserProfile`

Fetch user profile from database

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:139_

---

### `fetchMessageHistory`

Fetch recent message history for context

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:174_

---

### `extractContentFromInteraction`

Extract content from stored interaction

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:229_

---

### `extractContentFromResponse`

Extract content from stored response

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:252_

---

### `saveAgentInteraction`

Save agent interaction to database

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:267_

---

### `unnamed`

OpenAI Client for wa-webhook Provides OpenAI API integration with: - Chat completions with function
calling - Streaming support - Token usage tracking - Cost calculation - Error handling & retries

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:1_

---

### `getErrorMessage`

Safely extract error message from unknown error

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:15_

---

### `unnamed`

Create chat completion

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:86_

---

### `unnamed`

Make HTTP request to OpenAI API

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:130_

---

### `unnamed`

Calculate API cost based on model and token usage

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:211_

---

### `unnamed`

Delay helper for retries

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:234_

---

### `unnamed`

Generate embeddings for text

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:241_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:290_

---

### `unnamed`

Comprehensive Error Handler for Webhook Provides error categorization, user notifications, and retry
logic

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:1_

---

### `unnamed`

Handle error and return appropriate response

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:100_

---

### `unnamed`

Normalize error to WebhookError

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:124_

---

### `unnamed`

Log error with structured data

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:199_

---

### `unnamed`

Notify user via WhatsApp

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:216_

---

### `unnamed`

Create HTTP response

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:243_

---

### `unnamed`

Get error statistics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:279_

---

### `unnamed`

Response Formatting Utilities Helper methods for formatting agent responses with emoji-numbered
lists and action buttons for chat-first architecture.

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:1_

---

### `formatAgentResponse`

Format agent response with emoji-numbered lists and action buttons

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:17_

---

### `extractOptionsFromText`

Extract options from response text

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:64_

---

### `extractHeaderFromText`

Extract header text before the list

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:102_

---

### `generateActionButtons`

Generate contextual action buttons based on agent type

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:111_

---

### `unnamed`

Message Formatter Utilities Provides standardized formatting for AI agent chat messages including: -
Emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) - Action buttons - User selection parsing - Fallback flow
detection

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:1_

---

### `formatEmojiList`

Format options as emoji-numbered list

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:49_

---

### `parseEmojiSelection`

Parse user's emoji selection from message Supports multiple formats: - Numbers: "1", "2", "3" -
Emojis: "1️⃣", "2️⃣", "3️⃣" - Text: "one", "two", "three", "first", "second" - Phrases: "option 1",
"number 2", "the first one"

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:82_

---

### `formatMessageWithButtons`

Format message with action buttons

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:148_

---

### `shouldUseFallbackFlow`

Detect if message should trigger fallback to WhatsApp flow

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:176_

---

### `createListMessage`

Create a formatted list message with emoji numbers and action buttons

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:224_

---

### `validateActionButtons`

Validate action button configuration Ensures buttons meet WhatsApp requirements

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:268_

---

### `extractOptionsMetadata`

Extract option metadata from formatted list Useful for tracking what options were presented

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:283_

---

### `isSelectionMessage`

Check if user message is a valid selection from previous options

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:299_

---

### `getSelectionHelpText`

Generate help text for emoji selection

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:318_

---

### `unnamed`

WhatsApp-Specific Tools for AI Agents Provides tools that agents can use to interact with WhatsApp
Business API and EasyMO backend services ADDITIVE ONLY - New tools for agent system

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:1_

---

### `unnamed`

Register default tools

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:39_

---

### `unnamed`

Register a tool

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:623_

---

### `unnamed`

Get tool definition for OpenAI format

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:630_

---

### `unnamed`

Execute a tool

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:647_

---

### `unnamed`

Get all registered tools

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:687_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:695_

---

### `unnamed`

Agent Orchestrator Central hub for managing multiple specialized agents Routes messages to
appropriate agents based on intent Handles agent-to-agent handoffs and conversation state ADDITIVE
ONLY - New file, complements existing ai_agent_handler.ts

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:1_

---

### `unnamed`

Initialize default agent configurations

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:75_

---

### `unnamed`

Register an agent configuration

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:90_

---

### `unnamed`

Classify user intent and select appropriate agent

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:97_

---

### `unnamed`

Use LLM to classify intent

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:134_

---

### `unnamed`

Process message with selected agent

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:181_

---

### `unnamed`

Build message history for agent

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:303_

---

### `unnamed`

Get tools available for agent

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:354_

---

### `unnamed`

Extract topic from message

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:370_

---

### `unnamed`

Transfer conversation to different agent

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:394_

---

### `unnamed`

End conversation and cleanup

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:406_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:441_

---

### `unnamed`

Advanced Rate Limiter with Blacklisting Provides per-user rate limiting, violation tracking, and
blacklist management

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:1_

---

### `unnamed`

Check if request should be rate limited

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:42_

---

### `unnamed`

Manually unblock an identifier

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:130_

---

### `unnamed`

Get current state for monitoring

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:142_

---

### `unnamed`

Check health

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:157_

---

### `unnamed`

Clean up expired buckets

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:164_

---

### `unnamed`

Agent Configurations Centralized configurations for all AI agents in the EasyMO platform. Each agent
has a chat-first interface with emoji-numbered lists and action buttons.

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_configs.ts:1_

---

### `unnamed`

Simple In-Memory Cache for Webhook Processing Provides TTL-based caching with LRU eviction

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:1_

---

### `unnamed`

Get value from cache

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:44_

---

### `unnamed`

Set value in cache

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:67_

---

### `unnamed`

Get or set value

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:90_

---

### `unnamed`

Delete from cache

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:108_

---

### `unnamed`

Clear all cache

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:119_

---

### `unnamed`

Evict least recently used entry

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:129_

---

### `unnamed`

Clean up expired entries

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:151_

---

### `unnamed`

Get cache statistics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:175_

---

### `unnamed`

Check if cache is healthy

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:186_

---

### `unnamed`

AI Agent Configuration Centralized configuration for all AI agent features Allows feature flags and
dynamic configuration

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/ai_agent_config.ts:1_

---

### `getAIAgentConfig`

Get AI agent configuration Can be overridden by database settings or environment variables

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/ai_agent_config.ts:266_

---

### `validateAIAgentConfig`

Validate configuration

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/ai_agent_config.ts:288_

---

### `getAgentTypeConfig`

Get agent-specific configuration

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/ai_agent_config.ts:310_

---

### `unnamed`

Health & Metrics Endpoint for AI Agents Provides: - Health check status - Aggregated metrics -
System diagnostics - Configuration status ADDITIVE ONLY - New endpoints for monitoring

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:1_

---

### `getHealthStatus`

Check overall system health

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:42_

---

### `checkDatabaseHealth`

Check database health

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:93_

---

### `getDetailedMetrics`

Get detailed metrics for monitoring

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:109_

---

### `handleHealthCheck`

Handle health check request

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:127_

---

### `handleMetricsRequest`

Handle metrics request

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:168_

---

### `handleMetricsSummaryRequest`

Handle metrics summary request (plain text)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:198_

---

### `handlePrometheusMetrics`

Handle Prometheus-style metrics export

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:221_

---

### `unnamed`

Advanced Rate Limiter with Blacklisting Features: - Per-user rate limiting - Automatic blacklisting
for abuse - Violation tracking - Exponential backoff - Redis-backed (future enhancement)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:1_

---

### `unnamed`

Check if request should be rate limited

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:62_

---

### `unnamed`

Manually unblock an identifier

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:172_

---

### `unnamed`

Get current state for monitoring

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:187_

---

### `unnamed`

Check health

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:207_

---

### `unnamed`

Clean up expired buckets and blacklist entries

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:217_

---

### `unnamed`

Destroy the rate limiter

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:251_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:266_

---

### `unnamed`

AI Agent Monitoring & Metrics Collection Comprehensive monitoring system for AI agent performance,
cost tracking, and quality metrics ADDITIVE ONLY - New file

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:1_

---

### `unnamed`

Record metrics for an agent interaction

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:104_

---

### `unnamed`

Get aggregated metrics for a time period

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:158_

---

### `unnamed`

Calculate aggregations from raw metrics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:193_

---

### `unnamed`

Get empty aggregated metrics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:320_

---

### `unnamed`

Check for alert conditions

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:353_

---

### `unnamed`

Get real-time statistics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:402_

---

### `createMonitoringService`

Create monitoring service instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:453_

---

### `unnamed`

Enhanced Tool Library with External APIs Provides additional tools for AI agents: - Web search
(Tavily API) - Deep research (Perplexity API) - Weather information - Currency conversion -
Translation

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/enhanced_tools.ts:1_

---

### `getErrorMessage`

Safely extract error message from unknown error

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/enhanced_tools.ts:15_

---

### `getEnhancedTools`

Get all enhanced tools

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/enhanced_tools.ts:351_

---

### `registerEnhancedTools`

Register all enhanced tools with a tool manager

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/enhanced_tools.ts:363_

---

### `getAIAgentConfig`

Get AI Agent configuration from environment

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:56_

---

### `validateAIConfig`

Validate configuration

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:113_

---

### `getConfigSummary`

Get configuration summary for logging

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:157_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:185_

---

### `resetConfig`

Reset configuration (for testing)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:204_

---

### `unnamed`

Memory Manager for AI Agents Manages conversation memory using: - Short-term: Recent messages from
wa_interactions table - Working memory: Session state - Long-term: Important facts stored in
agent_conversations ENHANCED: Added caching layer for performance optimization

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:1_

---

### `getErrorMessage`

Safely extract error message from unknown error

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:18_

---

### `unnamed`

Get recent conversation history for a user ENHANCED: Added caching layer

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:52_

---

### `unnamed`

Save important information to long-term memory with embeddings

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:144_

---

### `unnamed`

Retrieve relevant memories using semantic search

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:196_

---

### `unnamed`

Calculate importance score for content

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:249_

---

### `unnamed`

Summarize conversation using OpenAI

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:280_

---

### `unnamed`

Save message interaction to memory

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:344_

---

### `unnamed`

Store important facts in agent_conversations for long-term memory

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:379_

---

### `unnamed`

Get conversation summary for a user

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:415_

---

### `unnamed`

Clear old conversation history (privacy/GDPR)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:457_

---

### `unnamed`

Extract message content from various formats

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:495_

---

### `unnamed`

Extract important information from conversation

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:498_

---

### `unnamed`

Clear old conversation history (privacy/GDPR)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:571_

---

### `unnamed`

Extract message content from various formats

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:609_

---

### `unnamed`

Extract response content from various formats

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:632_

---

### `unnamed`

Build context string from recent messages

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:647_

---

### `createMemoryManager`

Create memory manager instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:671_

---

### `unnamed`

Agent Session Management Functions for tracking and managing agent chat sessions. Sessions track
conversation state, presented options, and user selections.

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:1_

---

### `getAgentChatSession`

Get active agent chat session for user by phone number

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:26_

---

### `getAgentChatSessionByUserId`

Get active agent chat session for user by user ID

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:69_

---

### `saveAgentChatSession`

Save or update agent chat session

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:101_

---

### `updateSessionSelection`

Update session with user selection

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:182_

---

### `triggerSessionFallback`

Trigger fallback for session

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:211_

---

### `clearAgentChatSession`

Clear agent chat session

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:244_

---

### `clearUserSessions`

Clear all sessions for a user

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:269_

---

### `getSessionStats`

Get session statistics for monitoring

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:294_

---

### `unnamed`

Enhanced Webhook Verification with Security Features Provides signature verification, caching, and
timing-safe comparison

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:1_

---

### `unnamed`

Verify WhatsApp webhook signature with caching

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:29_

---

### `unnamed`

Handle WhatsApp verification challenge

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:103_

---

### `unnamed`

Timing-safe string comparison

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:128_

---

### `unnamed`

Hash payload for cache key

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:144_

---

### `unnamed`

Cleanup expired cache entries

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:154_

---

### `unnamed`

Get verification statistics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:166_

---

### `unnamed`

Tool Manager for AI Agents Manages tool definitions and execution for OpenAI function calling
Provides built-in tools for common operations: - check_wallet_balance - search_trips -
create_booking - transfer_money - get_user_profile

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:1_

---

### `getErrorMessage`

Safely extract error message from unknown error

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:17_

---

### `unnamed`

Register built-in tools

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:53_

---

### `unnamed`

Register a custom tool

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:144_

---

### `unnamed`

Get all tool definitions for OpenAI

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:151_

---

### `unnamed`

Execute a tool call

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:161_

---

### `unnamed`

Execute multiple tool calls

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:249_

---

### `unnamed`

Save tool execution to database

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:262_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:439_

---

### `unnamed`

Metrics Aggregator for AI Agents Collects and aggregates metrics for monitoring: - Request counts -
Success/failure rates - Token usage & costs - Latency statistics - Tool execution metrics ADDITIVE
ONLY - New file for enhanced monitoring

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:1_

---

### `unnamed`

Record a request

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:76_

---

### `unnamed`

Get aggregated metrics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:121_

---

### `unnamed`

Get metrics summary for logging

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:164_

---

### `unnamed`

Reset metrics (for testing)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:185_

---

### `unnamed`

Cleanup resources

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:205_

---

### `unnamed`

Add metrics to hourly bucket

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:214_

---

### `unnamed`

Get last hour statistics

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:238_

---

### `unnamed`

Cleanup old hourly buckets (keep last 24 hours)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:262_

---

### `unnamed`

Check if metrics cross important thresholds

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:273_

---

### `unnamed`

Format duration in human-readable form

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:305_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:322_

---

### `resetMetrics`

Reset metrics (for testing)

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:334_

---

### `unnamed`

Example: Integrating Enhanced Processor into wa-webhook This example shows how to integrate the
enhanced processor into the existing wa-webhook handler. USAGE: 1. Import this in your index.ts 2.
Set WA_ENHANCED_PROCESSING=true in environment 3. Monitor with health checks

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/integration-example.ts:1_

---

### `unnamed`

ALTERNATIVE: Gradual Rollout by User You can enable enhanced processing for specific users first:

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/integration-example.ts:125_

---

### `unnamed`

Enhanced Webhook Processor with Advanced Error Recovery This module extends the existing wa-webhook
processor with: - Dead letter queue for failed messages - Conversation-level distributed locking -
Timeout protection - Enhanced error recovery Can be enabled via WA_ENHANCED_PROCESSING environment
variable.

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts:1_

---

### `handlePreparedWebhookEnhanced`

Enhanced webhook processing wrapper Adds DLQ, locking, and timeout protection to existing processor

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts:34_

---

### `processMessageEnhanced`

Process individual message with enhanced features

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts:147_

---

### `isEnhancedProcessingEnabled`

Get feature flag status

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts:253_

---

### `unnamed`

AI Agent Handler Routes WhatsApp messages to AI agents for intelligent processing Falls back to
existing handlers if AI is not applicable This handler respects the additive-only guards by: - Being
a completely new file - Not modifying existing handlers - Providing fallback to existing flows

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:1_

---

### `unnamed`

Singleton rate limiter instance

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:49_

---

### `isAIEligibleMessage`

Determines if a message should be processed by AI agents

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:90_

---

### `tryAIAgentHandler`

Try to handle message with AI agent Returns true if handled, false if should fallback to existing
handlers

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:110_

---

### `processWithAIAgent`

Process message with AI agent using orchestrator Enhanced with full OpenAI integration and
specialized agents

_Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:434_

---

### `unnamed`

Search Indexer Edge Function Automatically indexes content from various domains for semantic search
Triggered by: - Database triggers on insert/update - Manual indexing requests - Scheduled batch jobs

_Source: supabase/functions/search-indexer/index.ts:1_

---

### `unnamed`

WA-Webhook-Jobs Microservice Handles WhatsApp webhook events for the Job Board domain. Part of Phase
2 webhook decomposition strategy. Features: - Job listings search - Job applications - Job alerts -
Employer postings - Job categories

_Source: supabase/functions/wa-webhook-jobs/index.ts:1_

---

### `handleHealthCheck`

Health check handler - verifies database connectivity and table access

_Source: supabase/functions/wa-webhook-jobs/index.ts:294_

---

### `showJobBoardMenu`

Show job board menu with WhatsApp list message

_Source: supabase/functions/wa-webhook-jobs/index.ts:359_

---

### `handleMyApplications`

Handle my applications query

_Source: supabase/functions/wa-webhook-jobs/index.ts:395_

---

### `handleMyJobs`

Handle my posted jobs query

_Source: supabase/functions/wa-webhook-jobs/index.ts:455_

---

### `handleJobAgentQuery`

Route complex queries to job-board-ai-agent

_Source: supabase/functions/wa-webhook-jobs/index.ts:498_

---

### `extractInput`

Extract text/selection from WhatsApp message

_Source: supabase/functions/wa-webhook-jobs/index.ts:542_

---

### `getFirstMessage`

Get first message from webhook payload

_Source: supabase/functions/wa-webhook-jobs/index.ts:569_

---

### `detectLocale`

Detect user locale from payload

_Source: supabase/functions/wa-webhook-jobs/index.ts:580_

---

### `isMenuTrigger`

Check if text is a menu trigger

_Source: supabase/functions/wa-webhook-jobs/index.ts:595_

---

### `maskPhone`

Mask phone number for logging (privacy)

_Source: supabase/functions/wa-webhook-jobs/index.ts:603_

---

### `unnamed`

Job Applications Module Handles job application flow: - Apply to jobs - Track application status -
Prevent duplicates - Employer notifications Audit Gap: Job application flow was missing (30% → 100%)

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:1_

---

### `getApplyButtonId`

Generate apply button ID for a job

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:30_

---

### `extractJobIdFromApply`

Extract job ID from apply button selection

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:37_

---

### `checkExistingApplication`

Check if user has already applied to this job

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:45_

---

### `isSelfApplication`

Check if user is trying to apply to their own job

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:63_

---

### `handleJobApplication`

Initiate job application process Called when user taps "Apply Now" button

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:79_

---

### `handleJobApplyMessage`

Handle cover message submission

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:169_

---

### `notifyEmployer`

Notify employer of new application

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:239_

---

### `showMyApplications`

Show user's application history

_Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:281_

---

### `showJobBoardMenu`

Show job board main menu

_Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:203_

---

### `startJobSearch`

Start job search conversation (job seeker)

_Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:261_

---

### `startJobPosting`

Start job posting conversation (job poster)

_Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:286_

---

### `handleJobBoardText`

Handle ongoing job board conversation Routes user messages to the job-board-ai-agent edge function

_Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:977_

---

### `showMyApplications`

Show user's job applications

_Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:1061_

---

### `startMyJobsMenu`

Show user's posted jobs

_Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:1149_

---

### `handleJobTextMessage`

Main text message router Handles state-based routing for text messages

_Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:1277_

---

### `unnamed`

Job Seeker Profile Module Handles job seeker profile creation and onboarding: - 3-step onboarding
(skills → locations → experience) - Profile retrieval and creation - Profile updates Audit Gap:
Profile management was 20% → Now 100%

_Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:1_

---

### `getOrCreateSeeker`

Get existing seeker profile or initiate onboarding Returns null if onboarding started (not completed
yet)

_Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:35_

---

### `startSeekerOnboarding`

Start seeker profile onboarding

_Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:60_

---

### `handleSeekerOnboardingStep`

Handle onboarding step input

_Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:89_

---

### `handleSkillsStep`

Handle skills input (Step 1)

_Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:124_

---

### `handleLocationsStep`

Handle locations input (Step 2)

_Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:170_

---

### `handleExperienceStep`

Handle experience input (Step 3 - Final)

_Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:216_

---

### `updateSeekerProfile`

Update seeker profile

_Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:296_

---

### `unnamed`

Location Message Handler for Jobs Service Handles WhatsApp location messages and integrates with: -
30-minute location cache - Saved locations (home/work) - GPS-based job search

_Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:1_

---

### `parseWhatsAppLocation`

Parse WhatsApp location message

_Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:25_

---

### `handleLocationMessage`

Handle location message for jobs service Flow: 1. Parse location from WhatsApp message 2. Save to
30-minute cache 3. Search nearby jobs 4. Send results to user

_Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:52_

---

### `searchAndSendNearbyJobs`

Search for nearby jobs and send results to user

_Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:129_

---

### `getUserLocation`

Get user location from cache or saved locations Returns null if no location available

_Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:225_

---

### `promptForLocation`

Prompt user to share location

_Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:296_

---

### `maskPhone`

Mask phone for logging (privacy)

_Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:311_

---

### `showJobBoardMenu`

Show job board main menu

_Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:30_

---

### `startJobSearch`

Start job search conversation (job seeker)

_Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:86_

---

### `startJobPosting`

Start job posting conversation (job poster)

_Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:115_

---

### `handleJobBoardText`

Handle ongoing job board conversation Routes user messages to the job-board-ai-agent edge function

_Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:145_

---

### `showMyApplications`

Show user's job applications

_Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:229_

---

### `showMyJobs`

Show user's posted jobs

_Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:300_

---

### `handleHealthCheck`

Comprehensive health check for wa-webhook-jobs service. Verifies connectivity to all job-related
tables.

_Source: supabase/functions/wa-webhook-jobs/handlers/health.ts:11_

---

### `searchBusinessDirectory`

Search business directory using Gemini API directly Gets real-time results from Google Maps via
Gemini

_Source: supabase/functions/agent-tools-general-broker/index.ts:515_

---

### `searchBusinessByLocation`

Search businesses by geographic location using Gemini Finds businesses near a specific location via
Google Maps

_Source: supabase/functions/agent-tools-general-broker/index.ts:550_

---

### `getBusinessDetails`

Get detailed information about a specific business Note: Since we're not storing businesses, this
searches by name

_Source: supabase/functions/agent-tools-general-broker/index.ts:578_

---

### `searchBusinessViaGemini`

Search businesses via Gemini API with Google Maps grounding Uses Google Maps tool to get real-time
business data

_Source: supabase/functions/agent-tools-general-broker/index.ts:600_

---

### `searchBusinessViaGeminiWithLocation`

Search businesses via Gemini API with location context and Google Maps grounding

_Source: supabase/functions/agent-tools-general-broker/index.ts:705_

---

### `calculateDistance`

Calculate distance between two points using Haversine formula

_Source: supabase/functions/agent-tools-general-broker/index.ts:789_

---

### `unnamed`

Marketplace Payment Module Handles USSD-based MoMo payments for marketplace transactions. Uses
tap-to-dial tel: links for seamless mobile payment experience. Payment Flow: 1. Buyer expresses
interest in listing 2. System creates transaction record 3. Sends USSD link to buyer
(tel:*182*8*1*MERCHANT\*AMOUNT#) 4. Buyer taps link → dials USSD → completes MoMo payment 5. Buyer
confirms payment in chat 6. Seller confirms receipt 7. Transaction marked complete

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:1_

---

### `generateMoMoUssd`

Generate USSD code for MoMo merchant payment

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:86_

---

### `createTelLink`

Create tap-to-dial tel: link Note: Keep unencoded for better Android compatibility

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:94_

---

### `formatUssdDisplay`

Format USSD code for display (user-friendly)

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:102_

---

### `initiatePayment`

Initiate a payment transaction

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:113_

---

### `buyerConfirmPayment`

Buyer confirms they've completed payment

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:273_

---

### `sellerConfirmPayment`

Seller confirms they've received payment

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:355_

---

### `cancelTransaction`

Cancel a transaction

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:458_

---

### `getTransactionDetails`

Get transaction details

_Source: supabase/functions/wa-webhook-marketplace/payment.ts:522_

---

### `unnamed`

Marketplace AI Agent Natural language AI agent for connecting buyers and sellers in Rwanda. Uses
Gemini for intent recognition, entity extraction, and conversational flow. Features: - Intent
classification (selling, buying, inquiry) - Entity extraction (product, price, location,
attributes) - Conversation state management - Proximity-based matching

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:1_

---

### `unnamed`

Process a marketplace message and generate response

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:154_

---

### `unnamed`

Handle specific actions based on AI response

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:304_

---

### `unnamed`

Create a new listing

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:367_

---

### `unnamed`

Search for matching listings and businesses

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:427_

---

### `unnamed`

Format search results for WhatsApp message

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:497_

---

### `unnamed`

Notify matching buyers when a new listing is created

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:532_

---

### `unnamed`

Update conversation state in database

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:594_

---

### `unnamed`

Filter out null values from an object

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:638_

---

### `unnamed`

Load conversation state from database

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:649_

---

### `unnamed`

Reset conversation state

_Source: supabase/functions/wa-webhook-marketplace/agent.ts:687_

---

### `initiateMoMoPayment`

Initiate USSD-based Mobile Money payment Generates a USSD dial string and sends as clickable link

_Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:17_

---

### `generateMoMoUSSD`

Generate MTN Mobile Money USSD code Rwanda format: *182*8*1*amount\*recipientPhone# For direct
transfer to seller

_Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:101_

---

### `handlePaymentConfirmation`

Handle payment confirmation from user User manually confirms after completing USSD payment

_Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:119_

---

### `processPaymentReference`

Process payment reference submission

_Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:187_

---

### `markPaymentAsSuccess`

Mark payment as successful and notify both parties

_Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:261_

---

### `getTransactionStatus`

Get transaction status

_Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:336_

---

### `unnamed`

Marketplace Domain Handler Re-exports the AI agent and database operations for the marketplace
domain. This module provides a unified interface for marketplace functionality.

_Source: supabase/functions/wa-webhook-marketplace/marketplace/index.ts:1_

---

### `getMarketplaceStatus`

Get marketplace feature status

_Source: supabase/functions/wa-webhook-marketplace/marketplace/index.ts:25_

---

### `unnamed`

Marketplace Utility Functions Location parsing, formatting, and notification utilities.

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:1_

---

### `parseWhatsAppLocation`

Parse location from WhatsApp location message

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:36_

---

### `parseLocationFromText`

Parse location from text (city/area names in Rwanda)

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:55_

---

### `calculateDistance`

Calculate distance between two points (Haversine formula)

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:112_

---

### `formatPrice`

Format price with currency

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:138_

---

### `formatDistance`

Format distance

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:151_

---

### `formatRating`

Format rating as stars

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:161_

---

### `formatListing`

Format listing for WhatsApp message

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:170_

---

### `formatBusiness`

Format business for WhatsApp message

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:204_

---

### `extractWhatsAppMessage`

Extract WhatsApp message from webhook payload

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:242_

---

### `buildBuyerNotification`

Build notification message for matching buyers

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:297_

---

### `buildSellerNotification`

Build notification message for sellers

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:314_

---

### `parsePriceFromText`

Parse price from text

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:334_

---

### `isValidPhone`

Validate phone number format

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:354_

---

### `normalizePhone`

Normalize phone number to international format

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:363_

---

### `maskPhone`

Mask phone number for logging (PII protection)

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:381_

---

### `logMarketplaceEvent`

Log marketplace event with masked PII

_Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:389_

---

### `unnamed`

Payment Handler for Marketplace Integrates payment flow with the AI agent and WhatsApp conversation.
Handles text-based payment commands and transaction state management.

_Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:1_

---

### `isPaymentCommand`

Check if message is a payment-related command

_Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:24_

---

### `handlePaymentCommand`

Handle payment-related commands

_Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:42_

---

### `showTransactionStatus`

Show user's transaction status

_Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:173_

---

### `handlePurchaseIntent`

Handle purchase intent from search results

_Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:218_

---

### `unnamed`

Marketplace Database Operations CRUD operations for marketplace listings, intents, and
conversations.

_Source: supabase/functions/wa-webhook-marketplace/db/index.ts:1_

---

### `unnamed`

Marketplace AI Agent Webhook Handler Natural language AI agent for connecting buyers and sellers in
Rwanda via WhatsApp. Features: - Conversational selling flow (create listings) - Conversational
buying flow (search and match) - Proximity-based matching - Integration with business directory

_Source: supabase/functions/wa-webhook-marketplace/index.ts:1_

---

### `unnamed`

Media Upload Handler for Marketplace Handles photo uploads from WhatsApp messages for marketplace
listings.

_Source: supabase/functions/wa-webhook-marketplace/media.ts:1_

---

### `downloadWhatsAppMedia`

Download media from WhatsApp servers

_Source: supabase/functions/wa-webhook-marketplace/media.ts:23_

---

### `uploadToStorage`

Upload image to Supabase Storage

_Source: supabase/functions/wa-webhook-marketplace/media.ts:76_

---

### `handleMediaUpload`

Handle media upload from WhatsApp message

_Source: supabase/functions/wa-webhook-marketplace/media.ts:114_

---

### `ensureStorageBucket`

Create storage bucket if it doesn't exist

_Source: supabase/functions/wa-webhook-marketplace/media.ts:217_

---

### `startNegotiation`

Start a new negotiation session

_Source: supabase/functions/agent-negotiation/index.ts:53_

---

### `findAndContactDrivers`

Find matching drivers and send quote requests

_Source: supabase/functions/agent-negotiation/index.ts:136_

---

### `findAndContactNearbyVendors`

Find matching vendors (pharmacy/quincaillerie/shops) and send quote requests

_Source: supabase/functions/agent-negotiation/index.ts:227_

---

### `addQuote`

Add a quote from a vendor

_Source: supabase/functions/agent-negotiation/index.ts:319_

---

### `getStatus`

Get session status

_Source: supabase/functions/agent-negotiation/index.ts:393_

---

### `completeNegotiation`

Complete negotiation with selected quote

_Source: supabase/functions/agent-negotiation/index.ts:441_

---

### `unnamed`

Main handler

_Source: supabase/functions/agent-negotiation/index.ts:500_

---

### `verifyHmacSignature`

HMAC-SHA256 signature verification for MomoTerminal webhooks

_Source: supabase/functions/momo-sms-webhook/utils/hmac.ts:1_

---

### `unnamed`

MomoTerminal SMS Webhook Handler Receives Mobile Money SMS from MomoTerminal Android app Routes to
appropriate service matchers (rides, marketplace, jobs, insurance) Ground Rules Compliance: -
Structured logging with correlation IDs - PII masking for phone numbers - HMAC signature
verification - Rate limiting

_Source: supabase/functions/momo-sms-webhook/index.ts:1_

---

### `unnamed`

Marketplace Payment Matcher Matches MoMo SMS to pending marketplace orders

_Source: supabase/functions/momo-sms-webhook/matchers/marketplace.ts:1_

---

### `unnamed`

Rides Payment Matcher Matches MoMo SMS to pending ride payments

_Source: supabase/functions/momo-sms-webhook/matchers/rides.ts:1_

---

### `unnamed`

Jobs Payment Matcher Matches MoMo SMS to job-related payments

_Source: supabase/functions/momo-sms-webhook/matchers/jobs.ts:1_

---

### `unnamed`

Insurance Payment Matcher Matches MoMo SMS to insurance premium payments

_Source: supabase/functions/momo-sms-webhook/matchers/insurance.ts:1_

---

### `unnamed`

Property Rentals Flow User flow: Option A - Add Property: Collect criteria → Save to DB (NO AI)
Option B - Find Property: Collect search criteria → AI Agent

_Source: supabase/functions/wa-webhook-property/property/rentals.ts:1_

---

### `handlePropertyAIChat`

Handle conversational AI agent chat for property rentals

_Source: supabase/functions/wa-webhook-property/property/rentals.ts:783_

---

### `startPropertyAISearch`

Start property search with AI Agent

_Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:17_

---

### `handlePropertySearchCriteria`

Handle property search criteria input

_Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:98_

---

### `executePropertyAISearch`

Execute property search with location

_Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:166_

---

### `addPropertyViaAI`

Add property listing via AI Agent

_Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:284_

---

### `clearPropertySearchState`

Clear property search state

_Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:329_

---

### `hasActivePropertySearch`

Check if user has active property search

_Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:350_

---

### `showMyProperties`

Show user's own property listings

_Source: supabase/functions/wa-webhook-property/property/my_listings.ts:13_

---

### `handlePropertyDetailView`

Show details of a specific property

_Source: supabase/functions/wa-webhook-property/property/my_listings.ts:84_

---

### `handlePropertyActions`

Handle property actions (edit, delete, mark rented)

_Source: supabase/functions/wa-webhook-property/property/my_listings.ts:146_

---

### `sendPropertyInquiry`

Send inquiry to property owner

_Source: supabase/functions/wa-webhook-property/property/my_listings.ts:239_

---

### `promptInquiryMessage`

Prompt for inquiry message

_Source: supabase/functions/wa-webhook-property/property/my_listings.ts:322_

---

### `handleInquiryMessage`

Handle inquiry message input

_Source: supabase/functions/wa-webhook-property/property/my_listings.ts:344_

---

### `cachePropertyLocation`

Save user's shared location to cache (30-minute TTL) Allows reusing location across property
searches without re-sharing

_Source: supabase/functions/wa-webhook-property/index.ts:396_

---

### `unnamed`

Property Location Handler Integrates location caching and saved locations for property search

_Source: supabase/functions/wa-webhook-property/handlers/location-handler.ts:1_

---

### `resolvePropertyLocation`

Resolve user location with priority: cache → saved home → prompt

_Source: supabase/functions/wa-webhook-property/handlers/location-handler.ts:20_

---

### `cachePropertyLocation`

Save shared location to cache

_Source: supabase/functions/wa-webhook-property/handlers/location-handler.ts:117_

---

### `formatLocationContext`

Format location context message for user

_Source: supabase/functions/wa-webhook-property/handlers/location-handler.ts:149_

---

### `unnamed`

Notification Filters - Quiet Hours, Opt-out, and Policy Enforcement Ground Rules Compliance:
Structured logging and security

_Source: supabase/functions/wa-webhook/notify/filters.ts:1_

---

### `checkOptOut`

Check if contact has opted out of notifications

_Source: supabase/functions/wa-webhook/notify/filters.ts:21_

---

### `checkQuietHours`

Check if current time is within contact's quiet hours

_Source: supabase/functions/wa-webhook/notify/filters.ts:53_

---

### `calculateQuietHoursEnd`

Calculate when quiet hours end for a contact

_Source: supabase/functions/wa-webhook/notify/filters.ts:105_

---

### `applyNotificationFilters`

Apply all notification filters

_Source: supabase/functions/wa-webhook/notify/filters.ts:145_

---

### `maskWa`

Mask WhatsApp ID for logging (PII protection)

_Source: supabase/functions/wa-webhook/notify/filters.ts:173_

---

### `checkRateLimit`

Check if notification should be rate limited Simple implementation - can be enhanced with Redis

_Source: supabase/functions/wa-webhook/notify/filters.ts:181_

---

### `ensureContactPreferences`

Initialize contact preferences if they don't exist

_Source: supabase/functions/wa-webhook/notify/filters.ts:223_

---

### `unnamed`

Enhanced Notification Processing with Filters Integrates quiet hours, opt-out, and rate limiting
Ground Rules Compliance: Structured logging, security, observability

_Source: supabase/functions/wa-webhook/notify/processor.ts:1_

---

### `processNotificationWithFilters`

Process notification with filters before delivery Returns true if notification should be delivered,
false if deferred/blocked

_Source: supabase/functions/wa-webhook/notify/processor.ts:25_

---

### `handleFilterBlock`

Handle notification blocked by filters

_Source: supabase/functions/wa-webhook/notify/processor.ts:66_

---

### `extractMetaErrorCode`

Extract Meta error code from WhatsApp API error response

_Source: supabase/functions/wa-webhook/notify/processor.ts:151_

---

### `categorizeMetaError`

Categorize Meta error codes for retry logic

_Source: supabase/functions/wa-webhook/notify/processor.ts:172_

---

### `calculateRateLimitBackoff`

Calculate backoff time for rate limit errors

_Source: supabase/functions/wa-webhook/notify/processor.ts:204_

---

### `maskWa`

Mask WhatsApp ID for logging (PII protection)

_Source: supabase/functions/wa-webhook/notify/processor.ts:224_

---

### `getNotificationLocale`

Get preferred locale for notification

_Source: supabase/functions/wa-webhook/notify/processor.ts:232_

---

### `logDeliveryMetrics`

Log notification delivery metrics by domain and message format

_Source: supabase/functions/wa-webhook/notify/processor.ts:258_

---

### `unnamed`

Property Rentals Flow User flow: Option A - Add Property: Collect criteria → Save to DB (NO AI)
Option B - Find Property: Collect search criteria → AI Agent

_Source: supabase/functions/wa-webhook/domains/property/rentals.ts:1_

---

### `handlePropertyAIChat`

Handle conversational AI agent chat for property rentals

_Source: supabase/functions/wa-webhook/domains/property/rentals.ts:714_

---

### `startPropertyAISearch`

Start property search with AI Agent

_Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:17_

---

### `handlePropertySearchCriteria`

Handle property search criteria input

_Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:68_

---

### `executePropertyAISearch`

Execute property search with location

_Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:136_

---

### `addPropertyViaAI`

Add property listing via AI Agent

_Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:248_

---

### `clearPropertySearchState`

Clear property search state

_Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:293_

---

### `hasActivePropertySearch`

Check if user has active property search

_Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:314_

---

### `unnamed`

Support AI Agent - Main Handler Routes support/help/customer service requests through the
comprehensive AI agent

_Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:1_

---

### `handleSupportAgent`

Main entry point for Support Agent

_Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:15_

---

### `handleSupportAgentMessage`

Handle support agent text messages

_Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:31_

---

### `handleSupportAgentButton`

Handle support agent button callbacks

_Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:41_

---

### `unnamed`

Export all support functions

_Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:56_

---

### `unnamed`

Sales AI Agent (Cold Caller) - Rebuilt with AI Core Uses Gemini 2.5 Pro + GPT-5 with shared tools

_Source: supabase/functions/wa-webhook/domains/ai-agents/sales_agent.ts:1_

---

### `unnamed`

Execute sales agent with Gemini 2.5 Pro ReAct loop

_Source: supabase/functions/wa-webhook/domains/ai-agents/sales_agent.ts:238_

---

### `runSalesAgent`

Run Sales Agent handler for wa-webhook

_Source: supabase/functions/wa-webhook/domains/ai-agents/sales_agent.ts:336_

---

### `unnamed`

Customer Support AI Agent - Handles general help, navigation, and support requests Integrated with
WhatsApp webhook for natural language support conversations

_Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:1_

---

### `startCustomerSupportChat`

Start a customer support chat session

_Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:21_

---

### `handleSupportMessage`

Handle support message with AI agent

_Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:107_

---

### `escalateToHumanSupport`

Escalate to human support

_Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:191_

---

### `handleSupportButton`

Handle support button actions

_Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:256_

---

### `generateSupportResponse`

Generate AI response (simplified placeholder) In production, this would call OpenAI/Gemini API

_Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:347_

---

### `isResolutionMessage`

Check if message indicates resolution

_Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:399_

---

### `unnamed`

AI Agents Integration Module Connects database search agents with the WhatsApp webhook system.
Agents search ONLY from database - NO web search or external APIs. All agents must have proper error
handling and fallback messages.

_Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:1_

---

### `routeToAIAgent`

Route request to appropriate AI agent based on intent

_Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:40_

---

### `invokePropertyAgent`

Invoke Property Rental Agent - DATABASE SEARCH ONLY

_Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:90_

---

### `sendAgentOptions`

Send agent options to user as interactive list with fallback buttons

_Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:148_

---

### `handleAgentSelection`

Handle agent option selection with proper error handling

_Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:209_

---

### `checkAgentSessionStatus`

Check agent session status with proper error handling

_Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:309_

---

### `unnamed`

Insurance AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for insurance quotes, claims, and
policy management

_Source: supabase/functions/wa-webhook/domains/ai-agents/insurance_agent.ts:1_

---

### `handleGeneralBrokerStart`

Start General Broker AI Agent Routes user to the general broker AI agent for service requests

_Source: supabase/functions/wa-webhook/domains/ai-agents/general_broker.ts:6_

---

### `unnamed`

AI Agent Handlers for WhatsApp Flows Provides convenient handlers that can be called from the text
router to initiate AI agent sessions for various use cases.

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:1_

---

### `unnamed`

Handle "Nearby Drivers" request with AI agent DATABASE SEARCH ONLY - No web search

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:28_

---

### `unnamed`

Handle "Nearby Pharmacies" request with AI agent

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:34_

---

### `unnamed`

Handle "Nearby Quincailleries" request with AI agent

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:39_

---

### `unnamed`

Handle "Nearby Shops" request with AI agent TWO-PHASE APPROACH: Phase 1: Immediately show top 9
nearby shops from database Phase 2: AI agent processes in background for curated shortlist

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:44_

---

### `handleAIPropertyRental`

Handle "Property Rental" request with AI agent

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:52_

---

### `unnamed`

Handle "Schedule Trip" request with AI agent

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:147_

---

### `handleAIAgentOptionSelection`

Handle AI agent selection from interactive list

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:152_

---

### `handleAIAgentLocationUpdate`

Handle location update for pending AI agent request

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:177_

---

### `unnamed`

Phase 2: Background AI agent processing for shops Agent contacts shops on behalf of user to create
curated shortlist

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:201_

---

### `unnamed`

Phase 1: Send immediate database results (top 9 nearby shops) This provides instant results while AI
agent processes in background

_Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:207_

---

### `unnamed`

Business Broker AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for business discovery and
recommendations

_Source: supabase/functions/wa-webhook/domains/ai-agents/business_broker_agent.ts:1_

---

### `unnamed`

Rides AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for ride matching and transportation
services

_Source: supabase/functions/wa-webhook/domains/ai-agents/rides_agent.ts:1_

---

### `unnamed`

Farmer AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for agricultural services and marketplace

_Source: supabase/functions/wa-webhook/domains/ai-agents/farmer_agent.ts:1_

---

### `unnamed`

AI Agents Module Central export point for all AI agent functionality in the WhatsApp webhook system.

_Source: supabase/functions/wa-webhook/domains/ai-agents/index.ts:1_

---

### `unnamed`

Jobs AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for job matching and career guidance

_Source: supabase/functions/wa-webhook/domains/ai-agents/jobs_agent.ts:1_

---

### `unnamed`

Real Estate AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro with vision for property search and
viewings

_Source: supabase/functions/wa-webhook/domains/ai-agents/real_estate_agent.ts:1_

---

### `unnamed`

Marketplace Domain Handler (Coming Soon) This is a stub implementation for the marketplace domain.
Full marketplace functionality will be implemented in a future release.

_Source: supabase/functions/wa-webhook/domains/marketplace/index.ts:1_

---

### `handleMarketplace`

Handle marketplace-related messages Currently returns a "coming soon" message

_Source: supabase/functions/wa-webhook/domains/marketplace/index.ts:22_

---

### `getMarketplaceStatus`

Get marketplace feature status

_Source: supabase/functions/wa-webhook/domains/marketplace/index.ts:47_

---

### `showBusinessWhatsAppNumbers`

Display list of WhatsApp numbers for a business

_Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:19_

---

### `startAddWhatsAppNumber`

Start the flow to add a new WhatsApp number

_Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:95_

---

### `handleAddWhatsAppNumberText`

Handle text input for adding WhatsApp number

_Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:119_

---

### `handleWhatsAppNumberSelection`

Handle selection of a specific WhatsApp number (for future edit/delete)

_Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:203_

---

### `maskPhoneNumber`

Mask phone number for display (show only last 4 digits)

_Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:224_

---

### `formatDate`

Format date for display

_Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:234_

---

### `showManageBusinesses`

Display list of businesses owned by the current user

_Source: supabase/functions/wa-webhook/domains/business/management.ts:41_

---

### `showBusinessDetail`

Show detail view for a specific business with management options

_Source: supabase/functions/wa-webhook/domains/business/management.ts:150_

---

### `handleBusinessDelete`

Handle business deletion with confirmation

_Source: supabase/functions/wa-webhook/domains/business/management.ts:254_

---

### `confirmBusinessDelete`

Confirm and execute business deletion

_Source: supabase/functions/wa-webhook/domains/business/management.ts:287_

---

### `handleBusinessSelection`

Handle business selection from the list

_Source: supabase/functions/wa-webhook/domains/business/management.ts:335_

---

### `startBusinessClaim`

Start business claiming flow

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:40_

---

### `handleBusinessNameSearch`

Handle business name search with OpenAI semantic search

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:71_

---

### `handleBusinessClaim`

Handle business selection and claiming

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:175_

---

### `searchBusinessesSemantic`

OpenAI-powered semantic business search Uses embeddings and smart matching to find businesses

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:281_

---

### `searchBusinessesSimple`

Simple fallback search (no OpenAI)

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:441_

---

### `searchBusinessesSmart`

Fuzzy/semantic business search (fast path)

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:485_

---

### `claimBusiness`

Claim a business for the user

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:599_

---

### `createBusinessFromBar`

Create a business entry from a bars table record

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:654_

---

### `formatBusinessDescription`

Format business description for list display

_Source: supabase/functions/wa-webhook/domains/business/claim.ts:707_

---

### `handleProfileMenu`

Profile Hub Unified entry point for managing: - Vehicles - Businesses - Properties - Tokens -
Settings

_Source: supabase/functions/wa-webhook/domains/profile/index.ts:12_

---

### `getProfileMenuItemId`

Map profile menu item action_targets to route IDs This ensures the router can handle actions from
database-driven menu

_Source: supabase/functions/wa-webhook/domains/profile/index.ts:160_

---

### `handleVehicleCertificateMedia`

Handle vehicle certificate media upload

_Source: supabase/functions/wa-webhook/domains/profile/index.ts:270_

---

### `parseScheduledDateTime`

Parse date and time strings into a Date object for scheduled trip storage. The date/time is stored
in UTC for consistency across timezones. Note: This simplified implementation treats the input as a
local time string and converts to Date. For production use with multiple timezones, consider using a
library like Temporal or date-fns-tz for proper timezone handling.

_Source: supabase/functions/wa-webhook/domains/mobility/schedule.ts:1267_

---

### `sendDriverQuoteRequest`

Send quote request to a driver

_Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:27_

---

### `formatDriverQuoteRequest`

Format driver quote request message

_Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:66_

---

### `parseDriverQuoteResponse`

Parse driver quote response

_Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:99_

---

### `handleDriverQuoteResponse`

Handle incoming quote response from driver

_Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:143_

---

### `sendQuotePresentationToUser`

Send quote presentation to user

_Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:221_

---

### `showRidesMenu`

Display the Rides submenu with 3 options: - Nearby Drivers - Nearby Passengers - Schedule Trip

_Source: supabase/functions/wa-webhook/domains/mobility/rides_menu.ts:7_

---

### `showRecentSearches`

Show recent searches as quick actions

_Source: supabase/functions/wa-webhook/domains/mobility/nearby.ts:196_

---

### `saveIntent`

Save user intent to mobility_intents table for better querying and recommendations

_Source: supabase/functions/wa-webhook/domains/mobility/intent_storage.ts:20_

---

### `getRecentIntents`

Get recent intents for a user

_Source: supabase/functions/wa-webhook/domains/mobility/intent_storage.ts:51_

---

### `cleanupExpiredIntents`

Clean up expired intents (can be called periodically or via cron)

_Source: supabase/functions/wa-webhook/domains/mobility/intent_storage.ts:76_

---

### `getLocalizedMenuName`

Get localized menu item name for a specific country

_Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:58_

---

### `fetchActiveMenuItems`

Fetch active menu items from database filtered by country Returns items with country-specific names
applied

_Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:71_

---

### `normalizeMenuKey`

Normalize a menu key (legacy or canonical) to its canonical agent key.

_Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:150_

---

### `getMenuItemId`

Map menu item keys to IDS constants

_Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:159_

---

### `getMenuItemTranslationKeys`

Get translation key for menu item

_Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:170_

---

### `showJobBoardMenu`

Show job board main menu

_Source: supabase/functions/wa-webhook/domains/jobs/index.ts:196_

---

### `startJobSearch`

Start job search conversation (job seeker)

_Source: supabase/functions/wa-webhook/domains/jobs/index.ts:254_

---

### `startJobPosting`

Start job posting conversation (job poster)

_Source: supabase/functions/wa-webhook/domains/jobs/index.ts:279_

---

### `handleJobBoardText`

Handle ongoing job board conversation Routes user messages to the job-board-ai-agent edge function

_Source: supabase/functions/wa-webhook/domains/jobs/index.ts:963_

---

### `showMyApplications`

Show user's job applications

_Source: supabase/functions/wa-webhook/domains/jobs/index.ts:1047_

---

### `startMyJobsMenu`

Show user's posted jobs

_Source: supabase/functions/wa-webhook/domains/jobs/index.ts:1135_

---

### `handleInsuranceHelp`

Handle insurance help request - show admin contacts

_Source: supabase/functions/wa-webhook/domains/insurance/ins_handler.ts:369_

---

### `routeMessage`

Route message to appropriate microservice

_Source: supabase/functions/wa-webhook/router.ts:57_

---

### `getServiceFromState`

Get service from chat state

_Source: supabase/functions/wa-webhook/router.ts:104_

---

### `forwardToMicroservice`

Forward request to microservice

_Source: supabase/functions/wa-webhook/router.ts:123_

---

### `checkServiceHealth`

Get service health status

_Source: supabase/functions/wa-webhook/router.ts:183_

---

### `getAllServicesHealth`

Get all services health

_Source: supabase/functions/wa-webhook/router.ts:202_

---

### `normalizeMenuKey`

Normalizes a menu key to its canonical agent key

_Source: supabase/functions/wa-webhook/config/home_menu_aliases.ts:93_

---

### `isLegacyMenuKey`

Checks if a key is a legacy (aliased) key

_Source: supabase/functions/wa-webhook/config/home_menu_aliases.ts:100_

---

### `isCanonicalMenuKey`

Validates if a key is a canonical menu key

_Source: supabase/functions/wa-webhook/config/home_menu_aliases.ts:125_

---

### `unnamed`

Enhanced Middleware Integration for wa-webhook Provides middleware functions that integrate rate
limiting, caching, error handling, and metrics without modifying existing code. These can be
optionally integrated into the existing pipeline.

_Source: supabase/functions/wa-webhook/utils/middleware.ts:1_

---

### `applyRateLimiting`

Apply rate limiting middleware Can be called from existing pipeline to add rate limiting

_Source: supabase/functions/wa-webhook/utils/middleware.ts:21_

---

### `trackWebhookMetrics`

Track webhook metrics

_Source: supabase/functions/wa-webhook/utils/middleware.ts:68_

---

### `getCachedUserContext`

Cache user context with automatic expiration Can be used in message_context.ts to cache user lookups

_Source: supabase/functions/wa-webhook/utils/middleware.ts:92_

---

### `wrapError`

Wrap error with enhanced error handling Can be used in existing try-catch blocks to enhance error
responses

_Source: supabase/functions/wa-webhook/utils/middleware.ts:109_

---

### `addRateLimitHeaders`

Add rate limit headers to response

_Source: supabase/functions/wa-webhook/utils/middleware.ts:135_

---

### `enhanceWebhookRequest`

Middleware function to enhance PreparedWebhook This can be called after processWebhookRequest to add
enhancements

_Source: supabase/functions/wa-webhook/utils/middleware.ts:160_

---

### `logWebhookCompletion`

Log webhook processing completion

_Source: supabase/functions/wa-webhook/utils/middleware.ts:197_

---

### `processMessageWithEnhancements`

Example: Enhanced message processor wrapper This shows how to wrap existing handleMessage calls with
enhancements

_Source: supabase/functions/wa-webhook/utils/middleware.ts:225_

---

### `areEnhancementsEnabled`

Utility to check if enhancements are enabled

_Source: supabase/functions/wa-webhook/utils/middleware.ts:288_

---

### `getEnhancementConfig`

Get enhancement configuration

_Source: supabase/functions/wa-webhook/utils/middleware.ts:297_

---

### `unnamed`

Message Deduplication and Queue Integration Provides deduplication checking against the database and
queue integration for reliable message processing.

_Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:1_

---

### `isNewMessage`

Check if a message has already been processed (database-backed deduplication)

_Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:14_

---

### `markMessageProcessed`

Mark a message as processed

_Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:67_

---

### `enqueueMessage`

Add message to processing queue

_Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:115_

---

### `getOrCreateConversationMemory`

Get or create AI conversation memory

_Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:175_

---

### `updateConversationMemory`

Update AI conversation memory

_Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:272_

---

### `cleanupOldConversations`

Cleanup old conversation memories (older than 7 days with no activity)

_Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:346_

---

### `unnamed`

Enhanced Error Handling for wa-webhook Provides structured error handling with classification, user
notifications, and retry logic. Complements existing error handling.

_Source: supabase/functions/wa-webhook/utils/error_handler.ts:1_

---

### `normalizeError`

Normalize any error to WebhookError

_Source: supabase/functions/wa-webhook/utils/error_handler.ts:71_

---

### `handleWebhookError`

Handle webhook error with logging and optional user notification

_Source: supabase/functions/wa-webhook/utils/error_handler.ts:155_

---

### `notifyUserOfError`

Send error notification to user

_Source: supabase/functions/wa-webhook/utils/error_handler.ts:187_

---

### `createErrorResponse`

Create error response

_Source: supabase/functions/wa-webhook/utils/error_handler.ts:216_

---

### `maskPhone`

Mask phone number for logging (PII protection)

_Source: supabase/functions/wa-webhook/utils/error_handler.ts:264_

---

### `isRetryableError`

Check if error is retryable

_Source: supabase/functions/wa-webhook/utils/error_handler.ts:272_

---

### `getRetryDelay`

Get retry delay based on attempt number

_Source: supabase/functions/wa-webhook/utils/error_handler.ts:288_

---

### `unnamed`

Enhanced Health Check for wa-webhook Provides comprehensive health monitoring including rate
limiter, cache, and database connectivity.

_Source: supabase/functions/wa-webhook/utils/health_check.ts:1_

---

### `checkDatabase`

Check database health

_Source: supabase/functions/wa-webhook/utils/health_check.ts:39_

---

### `checkRateLimiter`

Check rate limiter health

_Source: supabase/functions/wa-webhook/utils/health_check.ts:78_

---

### `checkCache`

Check cache health

_Source: supabase/functions/wa-webhook/utils/health_check.ts:100_

---

### `checkMetrics`

Check metrics collector health

_Source: supabase/functions/wa-webhook/utils/health_check.ts:122_

---

### `performHealthCheck`

Perform comprehensive health check

_Source: supabase/functions/wa-webhook/utils/health_check.ts:143_

---

### `createHealthCheckResponse`

Create health check response

_Source: supabase/functions/wa-webhook/utils/health_check.ts:180_

---

### `createLivenessResponse`

Simple liveness probe (for Kubernetes, etc.)

_Source: supabase/functions/wa-webhook/utils/health_check.ts:201_

---

### `createReadinessResponse`

Readiness probe (checks critical dependencies)

_Source: supabase/functions/wa-webhook/utils/health_check.ts:211_

---

### `unnamed`

Dynamic Submenu Helper Provides reusable functions to fetch and display dynamic submenus from
database Eliminates hardcoded menu lists

_Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:1_

---

### `fetchSubmenuItems`

Fetch submenu items for a parent menu from database

_Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:21_

---

### `fetchProfileMenuItems`

Fetch profile menu items from database

_Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:51_

---

### `submenuItemsToRows`

Convert submenu items to WhatsApp list row format

_Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:85_

---

### `getSubmenuRows`

Get submenu items as WhatsApp rows with back button Convenience function that combines fetch +
convert + add back button

_Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:106_

---

### `hasSubmenu`

Check if a submenu exists and has items

_Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:143_

---

### `getSubmenuAction`

Get the default action for a submenu item Used for routing based on action_type

_Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:159_

---

### `unnamed`

Increment a counter

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:36_

---

### `unnamed`

Set a gauge value

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:50_

---

### `unnamed`

Record a histogram value (for durations, sizes, etc.)

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:63_

---

### `unnamed`

Get dimension key for grouping

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:81_

---

### `unnamed`

Parse dimension key back to object

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:95_

---

### `unnamed`

Calculate histogram statistics

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:110_

---

### `unnamed`

Flush metrics to logs

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:151_

---

### `unnamed`

Get metrics in Prometheus format (for /metrics endpoint)

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:206_

---

### `unnamed`

Get summary statistics

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:260_

---

### `unnamed`

Start periodic flushing

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:271_

---

### `unnamed`

Stop flushing and cleanup

_Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:282_

---

### `unnamed`

Get value from cache

_Source: supabase/functions/wa-webhook/utils/cache.ts:48_

---

### `unnamed`

Set value in cache

_Source: supabase/functions/wa-webhook/utils/cache.ts:71_

---

### `unnamed`

Get or set value using factory function

_Source: supabase/functions/wa-webhook/utils/cache.ts:94_

---

### `unnamed`

Delete from cache

_Source: supabase/functions/wa-webhook/utils/cache.ts:112_

---

### `unnamed`

Clear all cache

_Source: supabase/functions/wa-webhook/utils/cache.ts:123_

---

### `unnamed`

Check if cache contains key

_Source: supabase/functions/wa-webhook/utils/cache.ts:135_

---

### `unnamed`

Evict least recently used entry

_Source: supabase/functions/wa-webhook/utils/cache.ts:148_

---

### `unnamed`

Clean up expired entries

_Source: supabase/functions/wa-webhook/utils/cache.ts:172_

---

### `unnamed`

Get cache statistics

_Source: supabase/functions/wa-webhook/utils/cache.ts:195_

---

### `unnamed`

Check if cache is healthy

_Source: supabase/functions/wa-webhook/utils/cache.ts:212_

---

### `unnamed`

Start periodic cleanup

_Source: supabase/functions/wa-webhook/utils/cache.ts:219_

---

### `unnamed`

Cleanup resources

_Source: supabase/functions/wa-webhook/utils/cache.ts:231_

---

### `unnamed`

Check if identifier should be rate limited

_Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:48_

---

### `unnamed`

Manually unblock an identifier

_Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:120_

---

### `unnamed`

Get statistics for monitoring

_Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:128_

---

### `unnamed`

Mask identifier for logging (PII protection)

_Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:143_

---

### `unnamed`

Cleanup expired buckets

_Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:151_

---

### `unnamed`

Start periodic cleanup

_Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:174_

---

### `unnamed`

Stop cleanup (for testing/shutdown)

_Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:183_

---

### `validateAndLoadConfig`

Validate and load configuration

_Source: supabase/functions/wa-webhook/utils/config_validator.ts:54_

---

### `getEnv`

Get environment variable with fallback to multiple keys

_Source: supabase/functions/wa-webhook/utils/config_validator.ts:116_

---

### `loadConfig`

Load configuration with defaults

_Source: supabase/functions/wa-webhook/utils/config_validator.ts:127_

---

### `printConfigStatus`

Print configuration status

_Source: supabase/functions/wa-webhook/utils/config_validator.ts:174_

---

### `assertConfigValid`

Assert configuration is valid (throws if not)

_Source: supabase/functions/wa-webhook/utils/config_validator.ts:202_

---

### `encodeTelUriForQr`

Encodes a USSD string as a tel: URI for QR codes. Android QR scanner apps often fail to decode
percent-encoded characters before passing the URI to the dialer. This function leaves \* and #
unencoded for better Android compatibility while maintaining iOS support.

_Source: supabase/functions/wa-webhook/utils/ussd.ts:14_

---

### `unnamed`

AI Agent Chat Interface Utilities Provides consistent, emoji-rich, button-enabled chat interfaces
for all AI agents. All agents MUST use natural language chat with: - Emoji-numbered listings (1️⃣,
2️⃣, 3️⃣) - Action buttons for quick responses - Concise messages with emojis

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:1_

---

### `formatEmojiNumberedList`

Format options/items as emoji-numbered list

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:20_

---

### `createAgentActionButtons`

Create action buttons for agent responses

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:62_

---

### `sendAgentListResponse`

Send agent message with emoji-numbered list and action buttons

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:90_

---

### `sendAgentMessageWithActions`

Send concise agent message with action buttons

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:136_

---

### `sendAgentMessage`

Send simple agent text message with emoji

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:163_

---

### `formatAgentError`

Format error message for agent responses

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:178_

---

### `formatAgentSuccess`

Format success message for agent responses

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:186_

---

### `createQuickReplyInstruction`

Create quick reply instruction text

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:193_

---

### `parseEmojiNumber`

Parse emoji number from user input Supports both emoji (1️⃣) and plain numbers (1)

_Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:210_

---

### `buildMomoUssdForQr`

Builds MOMO USSD code with tel URI optimized for QR codes. Uses unencoded \* and # for better
Android QR scanner compatibility.

_Source: supabase/functions/wa-webhook/utils/momo.ts:16_

---

### `unnamed`

Connection Pool Manager for Supabase Client Implements connection pooling to: - Reduce connection
overhead - Improve performance - Manage connection lifecycle - Monitor pool health

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:1_

---

### `unnamed`

Initialize pool with minimum connections

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:71_

---

### `unnamed`

Create a new pooled connection

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:91_

---

### `unnamed`

Acquire a connection from the pool

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:138_

---

### `unnamed`

Release a connection back to the pool

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:188_

---

### `unnamed`

Execute operation with pooled connection

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:213_

---

### `unnamed`

Perform pool maintenance

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:227_

---

### `unnamed`

Get pool statistics

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:270_

---

### `unnamed`

Check pool health

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:287_

---

### `unnamed`

Destroy the pool

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:298_

---

### `unnamed`

Singleton pool instance

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:315_

---

### `withPooledConnection`

Helper function to execute with pooled connection

_Source: supabase/functions/wa-webhook/shared/connection_pool.ts:327_

---

### `unnamed`

Streaming Response Handler for OpenAI Handles server-sent events (SSE) from OpenAI Chat Completions
API Accumulates chunks and provides real-time updates ADDITIVE ONLY - New file, no modifications to
existing code

_Source: supabase/functions/wa-webhook/shared/streaming_handler.ts:1_

---

### `unnamed`

Stream chat completion responses Yields chunks as they arrive from OpenAI

_Source: supabase/functions/wa-webhook/shared/streaming_handler.ts:42_

---

### `unnamed`

Accumulate full response from stream Useful when you want streaming internally but need the complete
response

_Source: supabase/functions/wa-webhook/shared/streaming_handler.ts:205_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/wa-webhook/shared/streaming_handler.ts:257_

---

### `unnamed`

Agent Context Builder Builds comprehensive context for AI agents from WhatsApp messages Extracts
user profile, conversation history, and session state

_Source: supabase/functions/wa-webhook/shared/agent_context.ts:1_

---

### `extractMessageContent`

Extract message content from different message types

_Source: supabase/functions/wa-webhook/shared/agent_context.ts:115_

---

### `fetchUserProfile`

Fetch user profile from database

_Source: supabase/functions/wa-webhook/shared/agent_context.ts:139_

---

### `fetchMessageHistory`

Fetch recent message history for context

_Source: supabase/functions/wa-webhook/shared/agent_context.ts:174_

---

### `extractContentFromInteraction`

Extract content from stored interaction

_Source: supabase/functions/wa-webhook/shared/agent_context.ts:229_

---

### `extractContentFromResponse`

Extract content from stored response

_Source: supabase/functions/wa-webhook/shared/agent_context.ts:252_

---

### `saveAgentInteraction`

Save agent interaction to database

_Source: supabase/functions/wa-webhook/shared/agent_context.ts:267_

---

### `unnamed`

OpenAI Client for wa-webhook Provides OpenAI API integration with: - Chat completions with function
calling - Streaming support - Token usage tracking - Cost calculation - Error handling & retries

_Source: supabase/functions/wa-webhook/shared/openai_client.ts:1_

---

### `getErrorMessage`

Safely extract error message from unknown error

_Source: supabase/functions/wa-webhook/shared/openai_client.ts:15_

---

### `unnamed`

Create chat completion

_Source: supabase/functions/wa-webhook/shared/openai_client.ts:86_

---

### `unnamed`

Make HTTP request to OpenAI API

_Source: supabase/functions/wa-webhook/shared/openai_client.ts:130_

---

### `unnamed`

Calculate API cost based on model and token usage

_Source: supabase/functions/wa-webhook/shared/openai_client.ts:208_

---

### `unnamed`

Delay helper for retries

_Source: supabase/functions/wa-webhook/shared/openai_client.ts:231_

---

### `unnamed`

Generate embeddings for text

_Source: supabase/functions/wa-webhook/shared/openai_client.ts:238_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/wa-webhook/shared/openai_client.ts:287_

---

### `unnamed`

Comprehensive Error Handler for Webhook Provides error categorization, user notifications, and retry
logic

_Source: supabase/functions/wa-webhook/shared/error-handler.ts:1_

---

### `unnamed`

Handle error and return appropriate response

_Source: supabase/functions/wa-webhook/shared/error-handler.ts:100_

---

### `unnamed`

Normalize error to WebhookError

_Source: supabase/functions/wa-webhook/shared/error-handler.ts:124_

---

### `unnamed`

Log error with structured data

_Source: supabase/functions/wa-webhook/shared/error-handler.ts:199_

---

### `unnamed`

Notify user via WhatsApp

_Source: supabase/functions/wa-webhook/shared/error-handler.ts:216_

---

### `unnamed`

Create HTTP response

_Source: supabase/functions/wa-webhook/shared/error-handler.ts:243_

---

### `unnamed`

Get error statistics

_Source: supabase/functions/wa-webhook/shared/error-handler.ts:279_

---

### `unnamed`

Response Formatting Utilities Helper methods for formatting agent responses with emoji-numbered
lists and action buttons for chat-first architecture.

_Source: supabase/functions/wa-webhook/shared/response_formatter.ts:1_

---

### `formatAgentResponse`

Format agent response with emoji-numbered lists and action buttons

_Source: supabase/functions/wa-webhook/shared/response_formatter.ts:17_

---

### `extractOptionsFromText`

Extract options from response text

_Source: supabase/functions/wa-webhook/shared/response_formatter.ts:64_

---

### `extractHeaderFromText`

Extract header text before the list

_Source: supabase/functions/wa-webhook/shared/response_formatter.ts:102_

---

### `generateActionButtons`

Generate contextual action buttons based on agent type

_Source: supabase/functions/wa-webhook/shared/response_formatter.ts:111_

---

### `unnamed`

Message Formatter Utilities Provides standardized formatting for AI agent chat messages including: -
Emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) - Action buttons - User selection parsing - Fallback flow
detection

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:1_

---

### `formatEmojiList`

Format options as emoji-numbered list

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:49_

---

### `parseEmojiSelection`

Parse user's emoji selection from message Supports multiple formats: - Numbers: "1", "2", "3" -
Emojis: "1️⃣", "2️⃣", "3️⃣" - Text: "one", "two", "three", "first", "second" - Phrases: "option 1",
"number 2", "the first one"

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:82_

---

### `formatMessageWithButtons`

Format message with action buttons

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:148_

---

### `shouldUseFallbackFlow`

Detect if message should trigger fallback to WhatsApp flow

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:176_

---

### `createListMessage`

Create a formatted list message with emoji numbers and action buttons

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:224_

---

### `validateActionButtons`

Validate action button configuration Ensures buttons meet WhatsApp requirements

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:268_

---

### `extractOptionsMetadata`

Extract option metadata from formatted list Useful for tracking what options were presented

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:283_

---

### `isSelectionMessage`

Check if user message is a valid selection from previous options

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:299_

---

### `getSelectionHelpText`

Generate help text for emoji selection

_Source: supabase/functions/wa-webhook/shared/message_formatter.ts:318_

---

### `unnamed`

WhatsApp-Specific Tools for AI Agents Provides tools that agents can use to interact with WhatsApp
Business API and EasyMO backend services ADDITIVE ONLY - New tools for agent system

_Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:1_

---

### `unnamed`

Register default tools

_Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:39_

---

### `unnamed`

Register a tool

_Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:623_

---

### `unnamed`

Get tool definition for OpenAI format

_Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:630_

---

### `unnamed`

Execute a tool

_Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:647_

---

### `unnamed`

Get all registered tools

_Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:687_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:695_

---

### `unnamed`

Agent Orchestrator Central hub for managing multiple specialized agents Routes messages to
appropriate agents based on intent Handles agent-to-agent handoffs and conversation state ADDITIVE
ONLY - New file, complements existing ai_agent_handler.ts

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:1_

---

### `unnamed`

Initialize default agent configurations

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:90_

---

### `unnamed`

Register an agent configuration

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:105_

---

### `unnamed`

Classify user intent and select appropriate agent

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:112_

---

### `unnamed`

Use LLM to classify intent

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:149_

---

### `unnamed`

Process message with selected agent

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:200_

---

### `unnamed`

Build message history for agent

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:322_

---

### `unnamed`

Get tools available for agent

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:373_

---

### `unnamed`

Extract topic from message

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:389_

---

### `unnamed`

Transfer conversation to different agent

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:413_

---

### `unnamed`

End conversation and cleanup

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:425_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:460_

---

### `unnamed`

Advanced Rate Limiter with Blacklisting Provides per-user rate limiting, violation tracking, and
blacklist management

_Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:1_

---

### `unnamed`

Check if request should be rate limited

_Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:42_

---

### `unnamed`

Manually unblock an identifier

_Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:130_

---

### `unnamed`

Get current state for monitoring

_Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:142_

---

### `unnamed`

Check health

_Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:157_

---

### `unnamed`

Clean up expired buckets

_Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:164_

---

### `unnamed`

Agent Configurations Centralized configurations for all AI agents in the EasyMO platform. Each agent
has a chat-first interface with emoji-numbered lists and action buttons. OFFICIAL AGENTS (10
production agents matching agent_registry database): 1. farmer - Farmer AI Agent 2. insurance -
Insurance AI Agent 3. sales_cold_caller - Sales/Marketing Cold Caller AI Agent 4. rides - Rides AI
Agent 5. jobs - Jobs AI Agent 6. waiter - Waiter AI Agent 7. real_estate - Real Estate AI Agent 8.
marketplace - Marketplace AI Agent (includes pharmacy, hardware, shop) 9. support - Support AI Agent
(includes concierge routing) 10. business_broker - Business Broker AI Agent (includes legal intake)

_Source: supabase/functions/wa-webhook/shared/agent_configs.ts:1_

---

### `unnamed`

Simple In-Memory Cache for Webhook Processing Provides TTL-based caching with LRU eviction

_Source: supabase/functions/wa-webhook/shared/cache.ts:1_

---

### `unnamed`

Get value from cache

_Source: supabase/functions/wa-webhook/shared/cache.ts:44_

---

### `unnamed`

Set value in cache

_Source: supabase/functions/wa-webhook/shared/cache.ts:67_

---

### `unnamed`

Get or set value

_Source: supabase/functions/wa-webhook/shared/cache.ts:90_

---

### `unnamed`

Delete from cache

_Source: supabase/functions/wa-webhook/shared/cache.ts:108_

---

### `unnamed`

Clear all cache

_Source: supabase/functions/wa-webhook/shared/cache.ts:119_

---

### `unnamed`

Evict least recently used entry

_Source: supabase/functions/wa-webhook/shared/cache.ts:129_

---

### `unnamed`

Clean up expired entries

_Source: supabase/functions/wa-webhook/shared/cache.ts:151_

---

### `unnamed`

Get cache statistics

_Source: supabase/functions/wa-webhook/shared/cache.ts:175_

---

### `unnamed`

Check if cache is healthy

_Source: supabase/functions/wa-webhook/shared/cache.ts:186_

---

### `unnamed`

AI Agent Configuration Centralized configuration for all AI agent features Allows feature flags and
dynamic configuration

_Source: supabase/functions/wa-webhook/shared/ai_agent_config.ts:1_

---

### `getAIAgentConfig`

Get AI agent configuration Can be overridden by database settings or environment variables

_Source: supabase/functions/wa-webhook/shared/ai_agent_config.ts:266_

---

### `validateAIAgentConfig`

Validate configuration

_Source: supabase/functions/wa-webhook/shared/ai_agent_config.ts:288_

---

### `getAgentTypeConfig`

Get agent-specific configuration

_Source: supabase/functions/wa-webhook/shared/ai_agent_config.ts:310_

---

### `unnamed`

Health & Metrics Endpoint for AI Agents Provides: - Health check status - Aggregated metrics -
System diagnostics - Configuration status ADDITIVE ONLY - New endpoints for monitoring

_Source: supabase/functions/wa-webhook/shared/health_metrics.ts:1_

---

### `getHealthStatus`

Check overall system health

_Source: supabase/functions/wa-webhook/shared/health_metrics.ts:42_

---

### `checkDatabaseHealth`

Check database health

_Source: supabase/functions/wa-webhook/shared/health_metrics.ts:93_

---

### `getDetailedMetrics`

Get detailed metrics for monitoring

_Source: supabase/functions/wa-webhook/shared/health_metrics.ts:109_

---

### `handleHealthCheck`

Handle health check request

_Source: supabase/functions/wa-webhook/shared/health_metrics.ts:127_

---

### `handleMetricsRequest`

Handle metrics request

_Source: supabase/functions/wa-webhook/shared/health_metrics.ts:168_

---

### `handleMetricsSummaryRequest`

Handle metrics summary request (plain text)

_Source: supabase/functions/wa-webhook/shared/health_metrics.ts:198_

---

### `handlePrometheusMetrics`

Handle Prometheus-style metrics export

_Source: supabase/functions/wa-webhook/shared/health_metrics.ts:221_

---

### `unnamed`

Advanced Rate Limiter with Blacklisting Features: - Per-user rate limiting - Automatic blacklisting
for abuse - Violation tracking - Exponential backoff - Redis-backed (future enhancement)

_Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:1_

---

### `unnamed`

Check if request should be rate limited

_Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:62_

---

### `unnamed`

Manually unblock an identifier

_Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:172_

---

### `unnamed`

Get current state for monitoring

_Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:187_

---

### `unnamed`

Check health

_Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:207_

---

### `unnamed`

Clean up expired buckets and blacklist entries

_Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:217_

---

### `unnamed`

Destroy the rate limiter

_Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:251_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:266_

---

### `unnamed`

AI Agent Monitoring & Metrics Collection Comprehensive monitoring system for AI agent performance,
cost tracking, and quality metrics ADDITIVE ONLY - New file

_Source: supabase/functions/wa-webhook/shared/monitoring.ts:1_

---

### `unnamed`

Record metrics for an agent interaction

_Source: supabase/functions/wa-webhook/shared/monitoring.ts:104_

---

### `unnamed`

Get aggregated metrics for a time period

_Source: supabase/functions/wa-webhook/shared/monitoring.ts:158_

---

### `unnamed`

Calculate aggregations from raw metrics

_Source: supabase/functions/wa-webhook/shared/monitoring.ts:193_

---

### `unnamed`

Get empty aggregated metrics

_Source: supabase/functions/wa-webhook/shared/monitoring.ts:320_

---

### `unnamed`

Check for alert conditions

_Source: supabase/functions/wa-webhook/shared/monitoring.ts:353_

---

### `unnamed`

Get real-time statistics

_Source: supabase/functions/wa-webhook/shared/monitoring.ts:402_

---

### `createMonitoringService`

Create monitoring service instance

_Source: supabase/functions/wa-webhook/shared/monitoring.ts:453_

---

### `unnamed`

Enhanced Tool Library with External APIs Provides additional tools for AI agents: - Web search
(Tavily API) - Deep research (Perplexity API) - Weather information - Currency conversion -
Translation

_Source: supabase/functions/wa-webhook/shared/enhanced_tools.ts:1_

---

### `getErrorMessage`

Safely extract error message from unknown error

_Source: supabase/functions/wa-webhook/shared/enhanced_tools.ts:15_

---

### `getEnhancedTools`

Get all enhanced tools

_Source: supabase/functions/wa-webhook/shared/enhanced_tools.ts:351_

---

### `registerEnhancedTools`

Register all enhanced tools with a tool manager

_Source: supabase/functions/wa-webhook/shared/enhanced_tools.ts:363_

---

### `getAIAgentConfig`

Get AI Agent configuration from environment

_Source: supabase/functions/wa-webhook/shared/config_manager.ts:56_

---

### `validateAIConfig`

Validate configuration

_Source: supabase/functions/wa-webhook/shared/config_manager.ts:113_

---

### `getConfigSummary`

Get configuration summary for logging

_Source: supabase/functions/wa-webhook/shared/config_manager.ts:157_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/wa-webhook/shared/config_manager.ts:185_

---

### `resetConfig`

Reset configuration (for testing)

_Source: supabase/functions/wa-webhook/shared/config_manager.ts:204_

---

### `unnamed`

Memory Manager for AI Agents Manages conversation memory using: - Short-term: Recent messages from
wa_interactions table - Working memory: Session state - Long-term: Important facts stored in
agent_conversations ENHANCED: Added caching layer for performance optimization

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:1_

---

### `getErrorMessage`

Safely extract error message from unknown error

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:18_

---

### `unnamed`

Get recent conversation history for a user ENHANCED: Added caching layer

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:52_

---

### `unnamed`

Save important information to long-term memory with embeddings

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:144_

---

### `unnamed`

Retrieve relevant memories using semantic search

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:196_

---

### `unnamed`

Calculate importance score for content

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:249_

---

### `unnamed`

Summarize conversation using OpenAI

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:280_

---

### `unnamed`

Save message interaction to memory

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:344_

---

### `unnamed`

Store important facts in agent_conversations for long-term memory

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:379_

---

### `unnamed`

Get conversation summary for a user

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:415_

---

### `unnamed`

Clear old conversation history (privacy/GDPR)

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:457_

---

### `unnamed`

Extract message content from various formats

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:495_

---

### `unnamed`

Extract important information from conversation

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:498_

---

### `unnamed`

Clear old conversation history (privacy/GDPR)

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:571_

---

### `unnamed`

Extract message content from various formats

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:609_

---

### `unnamed`

Extract response content from various formats

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:632_

---

### `unnamed`

Build context string from recent messages

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:647_

---

### `createMemoryManager`

Create memory manager instance

_Source: supabase/functions/wa-webhook/shared/memory_manager.ts:671_

---

### `unnamed`

Agent Session Management Functions for tracking and managing agent chat sessions. Sessions track
conversation state, presented options, and user selections.

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:1_

---

### `getAgentChatSession`

Get active agent chat session for user by phone number

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:26_

---

### `getAgentChatSessionByUserId`

Get active agent chat session for user by user ID

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:69_

---

### `saveAgentChatSession`

Save or update agent chat session

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:101_

---

### `updateSessionSelection`

Update session with user selection

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:182_

---

### `triggerSessionFallback`

Trigger fallback for session

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:211_

---

### `clearAgentChatSession`

Clear agent chat session

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:244_

---

### `clearUserSessions`

Clear all sessions for a user

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:269_

---

### `getSessionStats`

Get session statistics for monitoring

_Source: supabase/functions/wa-webhook/shared/agent_session.ts:294_

---

### `unnamed`

Enhanced Webhook Verification with Security Features Provides signature verification, caching, and
timing-safe comparison

_Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:1_

---

### `unnamed`

Verify WhatsApp webhook signature with caching

_Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:29_

---

### `unnamed`

Handle WhatsApp verification challenge

_Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:103_

---

### `unnamed`

Timing-safe string comparison

_Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:128_

---

### `unnamed`

Hash payload for cache key

_Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:144_

---

### `unnamed`

Cleanup expired cache entries

_Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:154_

---

### `unnamed`

Get verification statistics

_Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:166_

---

### `unnamed`

Tool Manager for AI Agents Manages tool definitions and execution for OpenAI function calling
Provides built-in tools for common operations: - check_wallet_balance - search_trips -
create_booking - transfer_money - get_user_profile

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:1_

---

### `getErrorMessage`

Safely extract error message from unknown error

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:17_

---

### `unnamed`

Register built-in tools

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:53_

---

### `unnamed`

Register a custom tool

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:144_

---

### `unnamed`

Get all tool definitions for OpenAI

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:151_

---

### `unnamed`

Execute a tool call

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:161_

---

### `unnamed`

Execute multiple tool calls

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:249_

---

### `unnamed`

Save tool execution to database

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:262_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/wa-webhook/shared/tool_manager.ts:439_

---

### `unnamed`

Metrics Aggregator for AI Agents Collects and aggregates metrics for monitoring: - Request counts -
Success/failure rates - Token usage & costs - Latency statistics - Tool execution metrics ADDITIVE
ONLY - New file for enhanced monitoring

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:1_

---

### `unnamed`

Record a request

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:76_

---

### `unnamed`

Get aggregated metrics

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:121_

---

### `unnamed`

Get metrics summary for logging

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:164_

---

### `unnamed`

Reset metrics (for testing)

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:185_

---

### `unnamed`

Cleanup resources

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:205_

---

### `unnamed`

Add metrics to hourly bucket

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:214_

---

### `unnamed`

Get last hour statistics

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:238_

---

### `unnamed`

Cleanup old hourly buckets (keep last 24 hours)

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:262_

---

### `unnamed`

Check if metrics cross important thresholds

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:273_

---

### `unnamed`

Format duration in human-readable form

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:305_

---

### `unnamed`

Singleton instance

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:322_

---

### `resetMetrics`

Reset metrics (for testing)

_Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:334_

---

### `unnamed`

⚠️ DEPRECATED - DO NOT DEPLOY ⚠️ This function has been deprecated and replaced by the microservice
architecture: WhatsApp → wa-webhook-core (router) → domain microservices ├─ wa-webhook-ai-agents ├─
wa-webhook-mobility ├─ wa-webhook-wallet ├─ wa-webhook-jobs ├─ wa-webhook-property ├─
wa-webhook-insurance └─ wa-webhook-marketplace This directory is kept for: 1.
Reference/documentation purposes 2. Shared library code (being migrated to
\_shared/wa-webhook-shared) DO NOT DEPLOY THIS FUNCTION Use wa-webhook-core instead:
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core Migration date: 2025-11-24
Reason: Microservice architecture for better scalability and maintainability

_Source: supabase/functions/wa-webhook/DEPRECATED.ts:1_

---

### `unnamed`

Example: Integrating Enhanced Processor into wa-webhook This example shows how to integrate the
enhanced processor into the existing wa-webhook handler. USAGE: 1. Import this in your index.ts 2.
Set WA_ENHANCED_PROCESSING=true in environment 3. Monitor with health checks

_Source: supabase/functions/wa-webhook/integration-example.ts:1_

---

### `unnamed`

ALTERNATIVE: Gradual Rollout by User You can enable enhanced processing for specific users first:

_Source: supabase/functions/wa-webhook/integration-example.ts:125_

---

### `unnamed`

⚠️ DEPRECATION NOTICE ⚠️ This function (wa-webhook) is DEPRECATED and should NOT be deployed. This
directory now serves as a SHARED CODE LIBRARY for WhatsApp webhook microservices. The actual webhook
routing is handled by wa-webhook-core. Deployed microservices that use this shared code: -
wa-webhook-core (ingress/router) - wa-webhook-ai-agents - wa-webhook-mobility - wa-webhook-wallet -
wa-webhook-jobs - wa-webhook-property - wa-webhook-marketplace - wa-webhook-insurance If you need to
make changes, edit files here but deploy the microservices above. To deploy all WhatsApp functions:
pnpm run functions:deploy:wa DO NOT USE: supabase functions deploy wa-webhook USE INSTEAD: supabase
functions deploy wa-webhook-core (and other microservices)

_Source: supabase/functions/wa-webhook/index.ts:10_

---

### `sendProfileMenu`

Display the Profile menu with options for managing businesses, vehicles, and tokens Delegates to the
comprehensive Profile hub implementation

_Source: supabase/functions/wa-webhook/flows/profile.ts:6_

---

### `unnamed`

Voice Handler for WhatsApp Processes voice notes using the Unified AI Gateway. 1. Transcribes audio
(Whisper or Gemini) 2. Routes to appropriate agent 3. Generates audio response (TTS or Realtime)

_Source: supabase/functions/wa-webhook/handlers/voice-handler.ts:1_

---

### `unnamed`

Enhanced Webhook Processor with Advanced Error Recovery This module extends the existing wa-webhook
processor with: - Dead letter queue for failed messages - Conversation-level distributed locking -
Timeout protection - Enhanced error recovery Can be enabled via WA_ENHANCED_PROCESSING environment
variable.

_Source: supabase/functions/wa-webhook/router/enhanced_processor.ts:1_

---

### `handlePreparedWebhookEnhanced`

Enhanced webhook processing wrapper Adds DLQ, locking, and timeout protection to existing processor

_Source: supabase/functions/wa-webhook/router/enhanced_processor.ts:34_

---

### `processMessageEnhanced`

Process individual message with enhanced features

_Source: supabase/functions/wa-webhook/router/enhanced_processor.ts:147_

---

### `isEnhancedProcessingEnabled`

Get feature flag status

_Source: supabase/functions/wa-webhook/router/enhanced_processor.ts:253_

---

### `unnamed`

AI Agent Handler Routes WhatsApp messages to AI agents for intelligent processing Falls back to
existing handlers if AI is not applicable This handler respects the additive-only guards by: - Being
a completely new file - Not modifying existing handlers - Providing fallback to existing flows

_Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:1_

---

### `unnamed`

Singleton rate limiter instance

_Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:49_

---

### `isAIEligibleMessage`

Determines if a message should be processed by AI agents

_Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:90_

---

### `tryAIAgentHandler`

Try to handle message with AI agent Returns true if handled, false if should fallback to existing
handlers

_Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:110_

---

### `processWithAIAgent`

Process message with AI agent using orchestrator Enhanced with full OpenAI integration and
specialized agents

_Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:434_

---

### `unnamed`

Business Handlers Index Consolidates business CRUD operations

_Source: supabase/functions/wa-webhook-profile/business/index.ts:1_

---

### `unnamed`

wa-webhook-profile - Profile & Wallet Service Handles user profiles, wallet operations, and business
management

_Source: supabase/functions/wa-webhook-profile/index-refactored.ts:1_

---

### `getUserCountry`

Get user's country code from profile or default to RW

_Source: supabase/functions/wa-webhook-profile/profile/home_dynamic.ts:19_

---

### `fetchProfileMenuItems`

Fetch dynamic profile menu items from database

_Source: supabase/functions/wa-webhook-profile/profile/home_dynamic.ts:49_

---

### `getFallbackMenuItems`

Fallback menu items if database fetch fails

_Source: supabase/functions/wa-webhook-profile/profile/home_dynamic.ts:89_

---

### `trackMenuItemClick`

Track menu item click analytics

_Source: supabase/functions/wa-webhook-profile/profile/home_dynamic.ts:225_

---

### `getUserCountry`

Get user's country code from profile or default to RW

_Source: supabase/functions/wa-webhook-profile/profile/home.ts:20_

---

### `fetchProfileMenuItems`

Fetch dynamic profile menu items from database

_Source: supabase/functions/wa-webhook-profile/profile/home.ts:50_

---

### `getFallbackMenuItems`

Fallback menu items if database fetch fails

_Source: supabase/functions/wa-webhook-profile/profile/home.ts:90_

---

### `unnamed`

Google Places API Integration Tool Provides real-time business search using Google Places API.
Features: - Text search (find businesses by query) - Nearby search (find businesses near
coordinates) - Place details (get full business information) - Caching to reduce API costs -
Fallback to local database Usage: const placesTool = new GooglePlacesTool(); const results = await
placesTool.searchNearby({ lat, lng, radius, keyword });

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:1_

---

### `unnamed`

Check if API is available

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:89_

---

### `unnamed`

Search for nearby places

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:96_

---

### `unnamed`

Search by text query

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:160_

---

### `unnamed`

Get detailed information about a place

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:222_

---

### `unnamed`

Get photo URL

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:274_

---

### `unnamed`

Transform Google Places results to our format

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:285_

---

### `unnamed`

Transform place details

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:324_

---

### `unnamed`

Calculate distance between two coordinates (Haversine formula)

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:350_

---

### `unnamed`

Generate cache key

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:378_

---

### `unnamed`

Get from cache

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:386_

---

### `unnamed`

Save to cache

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:416_

---

### `unnamed`

Import places to local business directory

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:431_

---

### `createGooglePlacesTool`

Create Google Places tool instance

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:474_

---

### `searchHybrid`

Hybrid search: Local DB + Google Places

_Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:481_

---

### `getFeatureFlags`

Get feature flags from database or environment

_Source: supabase/functions/wa-webhook-unified/core/feature-flags.ts:36_

---

### `shouldUseUnifiedService`

Check if user should use unified service Uses consistent hashing for stable rollout

_Source: supabase/functions/wa-webhook-unified/core/feature-flags.ts:80_

---

### `hashString`

Simple string hash function

_Source: supabase/functions/wa-webhook-unified/core/feature-flags.ts:97_

---

### `updateFeatureFlags`

Update feature flags in database

_Source: supabase/functions/wa-webhook-unified/core/feature-flags.ts:110_

---

### `unnamed`

Location Handler for Unified Service Provides location resolution with the standard 3-tier
approach: 1. Use incoming location message (if provided) 2. Check 30-minute cache 3. Use saved home
location

_Source: supabase/functions/wa-webhook-unified/core/location-handler.ts:1_

---

### `resolveUnifiedLocation`

Resolve location for a user using the 3-tier approach

_Source: supabase/functions/wa-webhook-unified/core/location-handler.ts:28_

---

### `cacheUnifiedLocation`

Cache location for future use (30-minute TTL)

_Source: supabase/functions/wa-webhook-unified/core/location-handler.ts:137_

---

### `formatLocationContext`

Format location context for display to user

_Source: supabase/functions/wa-webhook-unified/core/location-handler.ts:182_

---

### `unnamed`

Unified Agent Orchestrator Central routing and session management for all domain agents. Handles: -
Session lifecycle (create, load, save) - Intent classification (keyword + LLM hybrid) - Agent
registry and routing - Agent handoff coordination - Response formatting and sending

_Source: supabase/functions/wa-webhook-unified/core/orchestrator.ts:1_

---

### `unnamed`

Main entry point: Process incoming WhatsApp message Returns the agent's response text for
synchronous callers (e.g., admin panel)

_Source: supabase/functions/wa-webhook-unified/core/orchestrator.ts:39_

---

### `unnamed`

Determine which agent should handle this message

_Source: supabase/functions/wa-webhook-unified/core/orchestrator.ts:161_

---

### `unnamed`

Send response to user via WhatsApp

_Source: supabase/functions/wa-webhook-unified/core/orchestrator.ts:215_

---

### `unnamed`

Unified Types for All Domain Agents

_Source: supabase/functions/wa-webhook-unified/core/types.ts:1_

---

### `unnamed`

Session Manager Manages unified session lifecycle: - Load/create sessions from database - Update
session state - Save sessions back to database - Handle session expiration

_Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:1_

---

### `unnamed`

Get or create a session for a user

_Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:17_

---

### `unnamed`

Save session to database

_Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:70_

---

### `unnamed`

Add message to session conversation history

_Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:90_

---

### `unnamed`

Clear session flow state

_Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:112_

---

### `unnamed`

Expire session

_Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:121_

---

### `unnamed`

Map database row to UnifiedSession

_Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:131_

---

### `unnamed`

Intent Classifier Hybrid intent classification using: 1. Keyword matching (fast, deterministic) 2.
LLM classification (accurate, context-aware) Determines which agent should handle a message based
on: - Keywords in message - Conversation history - User context

_Source: supabase/functions/wa-webhook-unified/core/intent-classifier.ts:1_

---

### `unnamed`

Classify intent to determine which agent should handle the message

_Source: supabase/functions/wa-webhook-unified/core/intent-classifier.ts:64_

---

### `unnamed`

Classify based on keyword matching

_Source: supabase/functions/wa-webhook-unified/core/intent-classifier.ts:97_

---

### `unnamed`

Classify using LLM (Gemini) TODO: Implement this for more accurate classification

_Source: supabase/functions/wa-webhook-unified/core/intent-classifier.ts:159_

---

### `unnamed`

Insurance Agent Motor insurance assistant for Rwanda. Helps with quotes, renewals, and policy
management.

_Source: supabase/functions/wa-webhook-unified/agents/insurance-agent.ts:1_

---

### `unnamed`

Farmer Agent Agricultural assistant for farmers in Rwanda. Helps with marketplace, advisory, and
services.

_Source: supabase/functions/wa-webhook-unified/agents/farmer-agent.ts:1_

---

### `unnamed`

Base Agent Class Abstract base class that all domain agents extend. Provides common functionality: -
AI processing logic - Flow management (structured multi-step processes) - Tool execution framework -
Session context building - Handoff protocol

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:1_

---

### `unnamed`

Main processing logic - called by orchestrator

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:54_

---

### `unnamed`

Start a structured flow Override in subclasses to implement domain-specific flows

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:94_

---

### `unnamed`

Continue a structured flow Override in subclasses to implement domain-specific flows

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:105_

---

### `unnamed`

Call AI (Gemini) to process message with database-driven config

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:116_

---

### `unnamed`

Load agent configuration from database

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:143_

---

### `unnamed`

Build system prompt with database config and session context

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:153_

---

### `unnamed`

Build system prompt with session context (synchronous fallback)

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:208_

---

### `unnamed`

Build conversation history for AI context

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:231_

---

### `unnamed`

Parse AI response JSON

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:244_

---

### `unnamed`

Execute a tool call Override in subclasses to implement domain-specific tools

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:268_

---

### `unnamed`

Helper: Send WhatsApp message

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:282_

---

### `unnamed`

Helper: Format list response

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:294_

---

### `unnamed`

Helper: Format button response

_Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:311_

---

### `unnamed`

Rides Agent Transport and ride-sharing assistant. Connects drivers with passengers and manages trip
scheduling.

_Source: supabase/functions/wa-webhook-unified/agents/rides-agent.ts:1_

---

### `unnamed`

Jobs Agent Hybrid AI + structured flows for job search and posting. Combines conversational AI with
multi-step structured processes.

_Source: supabase/functions/wa-webhook-unified/agents/jobs-agent.ts:1_

---

### `unnamed`

Override to handle structured flows

_Source: supabase/functions/wa-webhook-unified/agents/jobs-agent.ts:125_

---

### `unnamed`

Override to handle flow continuation

_Source: supabase/functions/wa-webhook-unified/agents/jobs-agent.ts:157_

---

### `unnamed`

Property Agent Hybrid AI + structured flows for property rentals. Combines conversational AI with
multi-step structured processes.

_Source: supabase/functions/wa-webhook-unified/agents/property-agent.ts:1_

---

### `unnamed`

Business Broker Agent Business opportunities and partnership facilitation.

_Source: supabase/functions/wa-webhook-unified/agents/business-broker-agent.ts:1_

---

### `unnamed`

Sales Agent Sales and customer management assistant.

_Source: supabase/functions/wa-webhook-unified/agents/sales-agent.ts:1_

---

### `unnamed`

Support Agent Fallback agent for general queries and navigation. Helps users understand available
services and routes to appropriate agents.

_Source: supabase/functions/wa-webhook-unified/agents/support-agent.ts:1_

---

### `unnamed`

Override process to handle simple menu-based navigation

_Source: supabase/functions/wa-webhook-unified/agents/support-agent.ts:81_

---

### `unnamed`

Show services menu

_Source: supabase/functions/wa-webhook-unified/agents/support-agent.ts:99_

---

### `unnamed`

Execute tool calls

_Source: supabase/functions/wa-webhook-unified/agents/support-agent.ts:146_

---

### `unnamed`

Agent Registry Central registry for all domain agents. Manages agent instantiation and lookup.
OFFICIAL AGENTS (10 production agents matching agent_registry database): 1. farmer - Farmer AI
Agent 2. insurance - Insurance AI Agent 3. sales_cold_caller - Sales/Marketing Cold Caller AI
Agent 4. rides - Rides AI Agent 5. jobs - Jobs AI Agent 6. waiter - Waiter AI Agent 7. real_estate -
Real Estate AI Agent 8. marketplace - Marketplace AI Agent (includes pharmacy, hardware, shop) 9.
support - Support AI Agent (includes concierge routing) 10. business_broker - Business Broker AI
Agent (includes legal intake)

_Source: supabase/functions/wa-webhook-unified/agents/registry.ts:1_

---

### `unnamed`

Get agent instance by type Lazy-loads agents on first access

_Source: supabase/functions/wa-webhook-unified/agents/registry.ts:40_

---

### `unnamed`

Create agent instance based on the 10 official agent types

_Source: supabase/functions/wa-webhook-unified/agents/registry.ts:51_

---

### `unnamed`

Clear agent cache (useful for testing)

_Source: supabase/functions/wa-webhook-unified/agents/registry.ts:110_

---

### `unnamed`

Waiter Agent Restaurant and food ordering assistant. Helps users discover restaurants, view menus,
and place orders.

_Source: supabase/functions/wa-webhook-unified/agents/waiter-agent.ts:1_

---

### `unnamed`

Unified Commerce Agent World-class commerce agent that combines: - Marketplace (buy/sell products) -
Business Directory (find businesses/services) - Business Broker (partnerships/investments)
Features: - Natural language conversational flows - Location-based proximity matching - Payment
integration (MoMo USSD) - Photo uploads - Google Places API integration - Rating & review system -
Content moderation - Escrow for high-value transactions

_Source: supabase/functions/wa-webhook-unified/agents/commerce-agent.ts:1_

---

### `unnamed`

Override process to handle commerce-specific logic

_Source: supabase/functions/wa-webhook-unified/agents/commerce-agent.ts:455_

---

### `unnamed`

Get welcome message

_Source: supabase/functions/wa-webhook-unified/agents/commerce-agent.ts:506_

---

### `unnamed`

Execute tool calls

_Source: supabase/functions/wa-webhook-unified/agents/commerce-agent.ts:533_

---

### `unnamed`

Marketplace Agent Natural language AI agent for connecting buyers and sellers in Rwanda. Migrated
from wa-webhook-marketplace to unified architecture. Features: - Conversational selling flow (create
listings) - Conversational buying flow (search and match) - Proximity-based matching - Integration
with business directory

_Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:1_

---

### `unnamed`

Override process to handle marketplace-specific logic

_Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:134_

---

### `unnamed`

Execute tool calls

_Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:205_

---

### `unnamed`

Create a new marketplace listing

_Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:243_

---

### `unnamed`

Search for matching listings and businesses

_Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:301_

---

### `unnamed`

Notify matching buyers when a new listing is created

_Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:372_

---

### `unnamed`

Format search results for display

_Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:427_

---

### `unnamed`

WA-Webhook-Unified - Unified AI Agent Microservice Consolidates all AI agent-based WhatsApp webhook
services: - wa-webhook-ai-agents (Farmer, Waiter, Support, Insurance, Rides, Sales, Business
Broker) - wa-webhook-marketplace (Buy/Sell, Shops) - wa-webhook-jobs (Job Board) -
wa-webhook-property (Real Estate) Features: - Unified session management - Hybrid intent
classification (keyword + LLM) - Seamless cross-domain agent handoffs - Structured flows for complex
processes

_Source: supabase/functions/wa-webhook-unified/index.ts:1_

---

### `maskPhone`

Mask phone number for logging (PII protection)

_Source: supabase/functions/wa-webhook-unified/index.ts:278_

---

### `extractWhatsAppMessage`

Extract WhatsApp message from webhook payload

_Source: supabase/functions/wa-webhook-unified/index.ts:292_

---

### `checkExpiringSessions`

Check for sessions approaching deadline Send "need more time?" prompts to users

_Source: supabase/functions/agent-monitor/index.ts:28_

---

### `checkTimeouts`

Check for timed out sessions Mark sessions past deadline as timeout

_Source: supabase/functions/agent-monitor/index.ts:88_

---

### `expireOldQuotes`

Expire old quotes

_Source: supabase/functions/agent-monitor/index.ts:160_

---

### `sendExpiringWarning`

Send warning about approaching deadline

_Source: supabase/functions/agent-monitor/index.ts:193_

---

### `sendPartialResultsOffer`

Offer to present partial results

_Source: supabase/functions/agent-monitor/index.ts:211_

---

### `presentPartialResults`

Present partial results to user

_Source: supabase/functions/agent-monitor/index.ts:230_

---

### `notifyNoResults`

Notify user of no results

_Source: supabase/functions/agent-monitor/index.ts:241_

---

### `unnamed`

Main handler

_Source: supabase/functions/agent-monitor/index.ts:254_

---

### `unnamed`

wa-webhook-insurance - Insurance Service Handles insurance document submission, OCR, claims, and
support

_Source: supabase/functions/wa-webhook-insurance/index-refactored.ts:1_

---

### `handleInsuranceHelp`

Handle insurance help request - show admin contacts

_Source: supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts:544_

---

### `startCustomerSupportChat`

Start customer support AI chat

_Source: supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts:33_

---

### `handleCustomerSupportMessage`

Handle customer support AI message

_Source: supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts:93_

---

### `escalateToHumanSupport`

Escalate to human support - show contact numbers

_Source: supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts:204_

---

### `endAIChat`

End AI chat session

_Source: supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts:261_

---

### `unnamed`

AI Agents Integration Module Connects database search agents with the WhatsApp webhook system.
Agents search ONLY from database - NO web search or external APIs. All agents must have proper error
handling and fallback messages.

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:1_

---

### `routeToAIAgent`

Route request to appropriate AI agent based on intent

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:40_

---

### `invokeDriverAgent`

Invoke Nearby Drivers Agent - DATABASE SEARCH ONLY

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:103_

---

### `invokePharmacyAgent`

Invoke Pharmacy Agent - DATABASE SEARCH ONLY

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:159_

---

### `invokePropertyAgent`

Invoke Property Rental Agent - DATABASE SEARCH ONLY

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:213_

---

### `unnamed`

Invoke Schedule Trip Agent - DATABASE SEARCH ONLY

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:271_

---

### `invokeScheduleTripAgent`

Invoke Schedule Trip Agent - WITH ENHANCED 3-TIER FALLBACK Fallback strategy: 1. Try AI agent
scheduling (primary) 2. Fall back to direct database insert (manual scheduling) 3. Return
user-friendly error with alternatives

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:274_

---

### `invokeShopsAgent`

Invoke General Shops Agent - DATABASE SEARCH ONLY

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:403_

---

### `invokeQuincaillerieAgent`

Invoke Quincaillerie (Hardware Store) Agent - DATABASE SEARCH ONLY

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:457_

---

### `sendAgentOptions`

Send agent options to user as interactive list with fallback buttons

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:509_

---

### `handleAgentSelection`

Handle agent option selection with proper error handling

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:570_

---

### `checkAgentSessionStatus`

Check agent session status with proper error handling

_Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:670_

---

### `handleGeneralBrokerStart`

Start General Broker AI Agent Routes user to the general broker AI agent for service requests

_Source: supabase/functions/wa-webhook-mobility/ai-agents/general_broker.ts:6_

---

### `unnamed`

AI Agent Handlers for WhatsApp Flows Provides convenient handlers that can be called from the text
router to initiate AI agent sessions for various use cases.

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:1_

---

### `handleAINearbyDrivers`

Handle "Nearby Drivers" request with AI agent DATABASE SEARCH ONLY - No web search

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:39_

---

### `handleAINearbyPharmacies`

Handle "Nearby Pharmacies" request with AI agent

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:136_

---

### `handleAINearbyQuincailleries`

Handle "Nearby Quincailleries" request with AI agent

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:263_

---

### `handleAINearbyShops`

Handle "Nearby Shops" request with AI agent TWO-PHASE APPROACH: Phase 1: Immediately show top 9
nearby shops from database Phase 2: AI agent processes in background for curated shortlist

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:390_

---

### `handleAIPropertyRental`

Handle "Property Rental" request with AI agent

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:446_

---

### `handleAIScheduleTrip`

Handle "Schedule Trip" request with AI agent

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:541_

---

### `handleAIAgentOptionSelection`

Handle AI agent selection from interactive list

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:602_

---

### `handleAIAgentLocationUpdate`

Handle location update for pending AI agent request

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:627_

---

### `triggerShopsAgentBackground`

Phase 2: Background AI agent processing for shops Agent contacts shops on behalf of user to create
curated shortlist

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:699_

---

### `sendShopDatabaseResults`

Phase 1: Send immediate database results (top 9 nearby shops) This provides instant results while AI
agent processes in background

_Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:763_

---

### `unnamed`

AI Agents Module Central export point for all AI agent functionality in the WhatsApp webhook system.

_Source: supabase/functions/wa-webhook-mobility/ai-agents/index.ts:1_

---

### `unnamed`

Enhanced Middleware Integration for wa-webhook Provides middleware functions that integrate rate
limiting, caching, error handling, and metrics without modifying existing code. These can be
optionally integrated into the existing pipeline.

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:1_

---

### `applyRateLimiting`

Apply rate limiting middleware Can be called from existing pipeline to add rate limiting

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:21_

---

### `trackWebhookMetrics`

Track webhook metrics

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:68_

---

### `getCachedUserContext`

Cache user context with automatic expiration Can be used in message_context.ts to cache user lookups

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:92_

---

### `wrapError`

Wrap error with enhanced error handling Can be used in existing try-catch blocks to enhance error
responses

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:109_

---

### `addRateLimitHeaders`

Add rate limit headers to response

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:135_

---

### `enhanceWebhookRequest`

Middleware function to enhance PreparedWebhook This can be called after processWebhookRequest to add
enhancements

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:160_

---

### `logWebhookCompletion`

Log webhook processing completion

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:197_

---

### `processMessageWithEnhancements`

Example: Enhanced message processor wrapper This shows how to wrap existing handleMessage calls with
enhancements

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:225_

---

### `areEnhancementsEnabled`

Utility to check if enhancements are enabled

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:288_

---

### `getEnhancementConfig`

Get enhancement configuration

_Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:297_

---

### `unnamed`

Message Deduplication and Queue Integration Provides deduplication checking against the database and
queue integration for reliable message processing.

_Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:1_

---

### `isNewMessage`

Check if a message has already been processed (database-backed deduplication)

_Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:14_

---

### `markMessageProcessed`

Mark a message as processed

_Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:67_

---

### `enqueueMessage`

Add message to processing queue

_Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:115_

---

### `getOrCreateConversationMemory`

Get or create AI conversation memory

_Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:175_

---

### `updateConversationMemory`

Update AI conversation memory

_Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:272_

---

### `cleanupOldConversations`

Cleanup old conversation memories (older than 7 days with no activity)

_Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:346_

---

### `unnamed`

Enhanced Error Handling for wa-webhook Provides structured error handling with classification, user
notifications, and retry logic. Complements existing error handling.

_Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:1_

---

### `normalizeError`

Normalize any error to WebhookError

_Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:71_

---

### `handleWebhookError`

Handle webhook error with logging and optional user notification

_Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:155_

---

### `notifyUserOfError`

Send error notification to user

_Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:187_

---

### `createErrorResponse`

Create error response

_Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:216_

---

### `maskPhone`

Mask phone number for logging (PII protection)

_Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:264_

---

### `isRetryableError`

Check if error is retryable

_Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:272_

---

### `getRetryDelay`

Get retry delay based on attempt number

_Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:288_

---

### `unnamed`

Enhanced Health Check for wa-webhook Provides comprehensive health monitoring including rate
limiter, cache, and database connectivity.

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:1_

---

### `checkDatabase`

Check database health

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:39_

---

### `checkRateLimiter`

Check rate limiter health

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:78_

---

### `checkCache`

Check cache health

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:100_

---

### `checkMetrics`

Check metrics collector health

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:122_

---

### `performHealthCheck`

Perform comprehensive health check

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:143_

---

### `createHealthCheckResponse`

Create health check response

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:180_

---

### `createLivenessResponse`

Simple liveness probe (for Kubernetes, etc.)

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:201_

---

### `createReadinessResponse`

Readiness probe (checks critical dependencies)

_Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:211_

---

### `unnamed`

Dynamic Submenu Helper Provides reusable functions to fetch and display dynamic submenus from
database Eliminates hardcoded menu lists

_Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:1_

---

### `fetchSubmenuItems`

Fetch submenu items for a parent menu from database

_Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:21_

---

### `fetchProfileMenuItems`

Fetch profile menu items from database

_Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:51_

---

### `submenuItemsToRows`

Convert submenu items to WhatsApp list row format

_Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:85_

---

### `getSubmenuRows`

Get submenu items as WhatsApp rows with back button Convenience function that combines fetch +
convert + add back button

_Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:106_

---

### `hasSubmenu`

Check if a submenu exists and has items

_Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:143_

---

### `getSubmenuAction`

Get the default action for a submenu item Used for routing based on action_type

_Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:159_

---

### `unnamed`

Increment a counter

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:36_

---

### `unnamed`

Set a gauge value

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:50_

---

### `unnamed`

Record a histogram value (for durations, sizes, etc.)

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:63_

---

### `unnamed`

Get dimension key for grouping

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:81_

---

### `unnamed`

Parse dimension key back to object

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:95_

---

### `unnamed`

Calculate histogram statistics

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:110_

---

### `unnamed`

Flush metrics to logs

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:151_

---

### `unnamed`

Get metrics in Prometheus format (for /metrics endpoint)

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:206_

---

### `unnamed`

Get summary statistics

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:260_

---

### `unnamed`

Start periodic flushing

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:271_

---

### `unnamed`

Stop flushing and cleanup

_Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:282_

---

### `unnamed`

Get value from cache

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:48_

---

### `unnamed`

Set value in cache

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:71_

---

### `unnamed`

Get or set value using factory function

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:94_

---

### `unnamed`

Delete from cache

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:112_

---

### `unnamed`

Clear all cache

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:123_

---

### `unnamed`

Check if cache contains key

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:135_

---

### `unnamed`

Evict least recently used entry

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:148_

---

### `unnamed`

Clean up expired entries

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:172_

---

### `unnamed`

Get cache statistics

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:195_

---

### `unnamed`

Check if cache is healthy

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:212_

---

### `unnamed`

Start periodic cleanup

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:219_

---

### `unnamed`

Cleanup resources

_Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:231_

---

### `unnamed`

Check if identifier should be rate limited

_Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:48_

---

### `unnamed`

Manually unblock an identifier

_Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:120_

---

### `unnamed`

Get statistics for monitoring

_Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:128_

---

### `unnamed`

Mask identifier for logging (PII protection)

_Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:143_

---

### `unnamed`

Cleanup expired buckets

_Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:151_

---

### `unnamed`

Start periodic cleanup

_Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:174_

---

### `unnamed`

Stop cleanup (for testing/shutdown)

_Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:183_

---

### `validateAndLoadConfig`

Validate and load configuration

_Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:54_

---

### `getEnv`

Get environment variable with fallback to multiple keys

_Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:116_

---

### `loadConfig`

Load configuration with defaults

_Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:127_

---

### `printConfigStatus`

Print configuration status

_Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:174_

---

### `assertConfigValid`

Assert configuration is valid (throws if not)

_Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:202_

---

### `encodeTelUriForQr`

Encodes a USSD string as a tel: URI for QR codes. Android QR scanner apps often fail to decode
percent-encoded characters before passing the URI to the dialer. This function leaves \* and #
unencoded for better Android compatibility while maintaining iOS support.

_Source: supabase/functions/wa-webhook-mobility/utils/ussd.ts:14_

---

### `buildMomoUssdForQr`

Builds MOMO USSD code with tel URI optimized for QR codes. Uses unencoded \* and # for better
Android QR scanner compatibility.

_Source: supabase/functions/wa-webhook-mobility/utils/momo.ts:16_

---

### `unnamed`

wa-webhook-mobility - Mobility Service Handles ride-hailing, scheduling, and driver management

_Source: supabase/functions/wa-webhook-mobility/index-refactored.ts:1_

---

### `logEvent`

Observability Logger Simple event logging for mobility webhook

_Source: supabase/functions/wa-webhook-mobility/observe/logger.ts:1_

---

### `saveLocationToCache`

Save user's location to cache (profile.last_location)

_Source: supabase/functions/wa-webhook-mobility/locations/cache.ts:15_

---

### `getCachedLocation`

Get cached location if still valid (within 30 minutes) Returns null if no cached location or if
expired

_Source: supabase/functions/wa-webhook-mobility/locations/cache.ts:34_

---

### `hasValidCachedLocation`

Check if user has valid cached location

_Source: supabase/functions/wa-webhook-mobility/locations/cache.ts:70_

---

### `unnamed`

Driver License OCR Module Processes driver's licenses using OCR (OpenAI Vision + Gemini fallback)
Validates license data including expiry dates

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:1_

---

### `runGeminiOCR`

Process license using Gemini Vision API

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:75_

---

### `runOpenAIOCR`

Process license using OpenAI Vision API

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:136_

---

### `processDriverLicense`

Process driver license with OCR Uses OpenAI Vision API with Gemini fallback

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:238_

---

### `validateLicenseData`

Validate extracted license data

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:264_

---

### `saveLicenseCertificate`

Save license certificate to database

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:320_

---

### `unnamed`

Driver Insurance OCR Module Processes driver insurance certificates using OCR (OpenAI Vision +
Gemini fallback) Validates insurance data and checks for duplicate vehicles

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:1_

---

### `runGeminiOCR`

Process insurance certificate using Gemini Vision API

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:89_

---

### `runOpenAIOCR`

Process insurance certificate using OpenAI Vision API

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:150_

---

### `processDriverInsuranceCertificate`

Process driver insurance certificate with OCR Uses OpenAI Vision API with Gemini fallback

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:252_

---

### `validateInsuranceData`

Validate extracted insurance data

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:278_

---

### `checkDuplicateVehicle`

Check if vehicle plate is already registered by another user

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:325_

---

### `saveInsuranceCertificate`

Save insurance certificate to database

_Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:346_

---

### `sendProfileMenu`

Display the Profile menu with options for managing businesses, vehicles, and tokens Delegates to the
comprehensive Profile hub implementation

_Source: supabase/functions/wa-webhook-mobility/flows/profile.ts:6_

---

### `initiateTripPayment`

Initiates trip payment via MOMO USSD Generates USSD code and QR for user to dial

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:44_

---

### `handlePaymentConfirmation`

Handles payment confirmation from user Verifies via transaction reference number

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:165_

---

### `processTransactionReference`

Processes transaction reference submitted by user

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:206_

---

### `handleSkipPayment`

Handles skip payment action

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:288_

---

### `normalizeToLocal`

Normalizes phone number to local format (07XXXXXXXX)

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:336_

---

### `buildQrCodeUrl`

Builds QR code URL for USSD code

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:360_

---

### `logPaymentRequest`

Logs payment request to database

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:368_

---

### `handleTripStart`

Handles trip start confirmation 1. Verify both driver and passenger ready 2. Update trip status to
'in_progress' 3. Notify both parties 4. Start real-time tracking 5. Record metric: TRIP_STARTED

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:44_

---

### `handleTripArrivedAtPickup`

Handles driver arrival at pickup location 1. Update trip status to 'driver_arrived' 2. Notify
passenger 3. Record metric: DRIVER_ARRIVED

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:139_

---

### `handleTripPickedUp`

Handles trip start (passenger picked up) 1. Update trip status to 'in_progress' 2. Notify passenger
trip started 3. Record metric: TRIP_PICKED_UP

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:204_

---

### `handleTripComplete`

Handles trip completion 1. Update trip status to 'completed' 2. Calculate final fare 3. Initiate
payment 4. Request ratings from both parties 5. Record metrics: TRIP_COMPLETED, TRIP_DURATION

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:270_

---

### `handleTripCancel`

Handles trip cancellation 1. Update trip status 2. Calculate cancellation fee (if applicable) 3.
Notify other party 4. Record metric: TRIP_CANCELLED

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:439_

---

### `handleTripRating`

Handles trip rating 1. Validate rating (1-5) 2. Insert into trip_ratings table 3. Update user's
average rating 4. Record metric: TRIP_RATED

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:573_

---

### `getTripStatus`

Get trip status

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:684_

---

### `canPerformAction`

Check if user can perform action on trip

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:712_

---

### `calculateFareEstimate`

Calculates fare estimate for a trip Used before trip starts to show estimated cost

_Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:255_

---

### `calculateActualFare`

Calculates actual fare after trip completion Uses actual distance and time from trip

_Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:365_

---

### `calculateSurgeMultiplier`

Calculates surge pricing multiplier based on current conditions TODO: Implement dynamic surge based
on real demand/supply data

_Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:444_

---

### `calculateCancellationFee`

Calculates cancellation fee based on trip status TODO: Make configurable per business rules

_Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:482_

---

### `formatFare`

Formats fare for display

_Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:513_

---

### `formatFareBreakdown`

Formats fare breakdown for display

_Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:527_

---

### `updateDriverLocation`

Updates driver location during active trip 1. Validate trip is in progress 2. Update driver_status
table 3. Calculate new ETA 4. Notify passenger if ETA changes significantly (>5 minutes) 5. Record
metric: LOCATION_UPDATE

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:43_

---

### `calculateETA`

Calculates estimated time of arrival Uses simple haversine distance + average speed In production,
should integrate with Google Maps Distance Matrix API

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:183_

---

### `unnamed`

TODO: Enhanced ETA calculation using Google Maps Distance Matrix API export async function
calculateETAWithMaps( origin: Coordinates, destination: Coordinates ): Promise<ETACalculation> {
const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY"); const response = await fetch(
`https://maps.googleapis.com/maps/api/distancematrix/json?` +
`origins=${origin.latitude},${origin.longitude}&` +
`destinations=${destination.latitude},${destination.longitude}&` + `mode=driving&` + `key=${apiKey}`
); const data = await response.json(); const element = data.rows[0].elements[0]; if (element.status
=== "OK") { const distanceKm = element.distance.value / 1000; const durationMinutes =
Math.ceil(element.duration.value / 60); const estimatedArrival = new Date(Date.now() +
durationMinutes \* 60000); return { distanceKm, durationMinutes, estimatedArrival }; } // Fallback
to haversine if API fails return calculateETA(origin, destination); }

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:234_

---

### `startDriverTracking`

Starts driver tracking for active trip In production, this would enable real-time location streaming

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:271_

---

### `stopDriverTracking`

Stops driver tracking when trip ends

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:308_

---

### `getDriverLocation`

Gets driver's current location

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:347_

---

### `getTripProgress`

Gets trip progress (for passenger view)

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:378_

---

### `isValidCoordinates`

Validates coordinates are within valid ranges

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:444_

---

### `calculateHaversineDistance`

Calculates distance between two coordinates using Haversine formula Returns distance in kilometers

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:460_

---

### `toRadians`

Converts degrees to radians

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:485_

---

### `calculateSpeed`

Estimates speed based on consecutive location updates

_Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:492_

---

### `unnamed`

Location cache validation utilities Helpers for validating cached location timestamps and ensuring
location data is fresh enough for nearby matching.

_Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:1_

---

### `isLocationCacheValid`

Check if a cached location timestamp is still valid

_Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:14_

---

### `getLocationCacheAge`

Calculate how many minutes ago a location was cached

_Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:48_

---

### `formatLocationCacheAge`

Format cache age as human-readable string

_Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:74_

---

### `checkLocationCache`

Check if location needs refresh and return appropriate message

_Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:95_

---

### `checkDriverVerificationStatus`

Checks complete driver verification status

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:56_

---

### `showVerificationMenu`

Shows driver verification menu

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:133_

---

### `startLicenseVerification`

Starts driver's license verification flow

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:213_

---

### `handleLicenseUpload`

Handles driver's license upload

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:250_

---

### `isLicenseExpired`

Checks if license is expired

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:367_

---

### `fetchMediaUrl`

Fetch media from WhatsApp and get data URL

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:377_

---

### `unnamed`

Driver Insurance Handler Handles driver insurance certificate upload and validation Replaces the old
vehicle plate text input flow

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:1_

---

### `hasValidInsurance`

Check if user has valid insurance certificate

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:29_

---

### `getActiveInsurance`

Get active insurance for user

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:48_

---

### `ensureDriverInsurance`

Ensure driver has valid insurance, prompt for upload if not

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:74_

---

### `fetchMediaUrl`

Fetch media from WhatsApp and get signed URL

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:129_

---

### `handleInsuranceCertificateUpload`

Handle insurance certificate upload

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:175_

---

### `ensureVehiclePlate`

Legacy function for backward compatibility Now redirects to insurance upload

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:275_

---

### `getVehiclePlate`

Get vehicle plate from active insurance

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:286_

---

### `sendDriverQuoteRequest`

Send quote request to a driver

_Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:27_

---

### `formatDriverQuoteRequest`

Format driver quote request message

_Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:66_

---

### `parseDriverQuoteResponse`

Parse driver quote response

_Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:99_

---

### `handleDriverQuoteResponse`

Handle incoming quote response from driver

_Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:143_

---

### `sendQuotePresentationToUser`

Send quote presentation to user

_Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:221_

---

### `unnamed`

Driver Verification with OCR Handles driver license and insurance certificate verification Uses
OpenAI GPT-4 Vision and Google Gemini for OCR

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:1_

---

### `extractLicenseWithOpenAI`

Extract license data using OpenAI GPT-4 Vision

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:55_

---

### `extractLicenseWithGemini`

Extract license data using Google Gemini Vision

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:154_

---

### `extractInsuranceWithOpenAI`

Extract insurance certificate data using OpenAI

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:256_

---

### `extractInsuranceWithGemini`

Extract insurance certificate data using Gemini

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:335_

---

### `processDriverLicense`

Process driver license upload

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:401_

---

### `processInsuranceCertificate`

Process insurance certificate upload

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:519_

---

### `parseDriverActionId`

Parse driver action button ID Format: "driver_offer_ride::tripId" or "driver_view_details::tripId"

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_response.ts:17_

---

### `handleDriverOfferRide`

Handle when driver taps "Offer Ride"

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_response.ts:30_

---

### `handleDriverViewDetails`

Handle when driver taps "View Details"

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_response.ts:130_

---

### `routeDriverAction`

Route driver action button presses

_Source: supabase/functions/wa-webhook-mobility/handlers/driver_response.ts:224_

---

### `handleTripStart`

Handles trip start confirmation 1. Verify both driver and passenger ready 2. Update trip status to
'in_progress' 3. Notify both parties 4. Start real-time tracking 5. Record metric: TRIP_STARTED

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:47_

---

### `handleTripArrivedAtPickup`

Handles driver arrival at pickup location 1. Update trip status to 'driver_arrived' 2. Notify
passenger 3. Record metric: DRIVER_ARRIVED

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:143_

---

### `handleTripComplete`

Handles trip completion 1. Update trip status to 'completed' 2. Calculate final fare 3. Initiate
payment 4. Request ratings from both parties 5. Record metrics: TRIP_COMPLETED, TRIP_DURATION

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:205_

---

### `handleTripCancel`

Handles trip cancellation 1. Update trip status 2. Calculate cancellation fee (if applicable) 3.
Notify other party 4. Record metric: TRIP_CANCELLED

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:316_

---

### `handleTripRating`

Handles trip rating 1. Validate rating (1-5) 2. Insert into trip_ratings table 3. Update user's
average rating 4. Record metric: TRIP_RATED

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:425_

---

### `getTripStatus`

Get trip status

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:524_

---

### `canPerformAction`

Check if user can perform action on trip

_Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:552_

---

### `handleRecentSearchSelection`

Handle selection from recent searches list

_Source: supabase/functions/wa-webhook-mobility/handlers/nearby.ts:234_

---

### `showRecentSearches`

Show user's recent search locations for quick re-search Returns true if recent searches were shown,
false if none available

_Source: supabase/functions/wa-webhook-mobility/handlers/nearby.ts:704_

---

### `unnamed`

Mobility Handlers Registry Lazy-loaded handler registration for optimal cold starts

_Source: supabase/functions/wa-webhook-mobility/handlers/index.ts:1_

---

### `preloadCriticalHandlers`

Preload handlers that are commonly used Called after initial request to warm up subsequent calls

_Source: supabase/functions/wa-webhook-mobility/handlers/index.ts:56_

---

### `getHandler`

Get handler for action

_Source: supabase/functions/wa-webhook-mobility/handlers/index.ts:71_

---

### `startGoOnline`

Start Go Online flow - prompt driver to share location

_Source: supabase/functions/wa-webhook-mobility/handlers/go_online.ts:21_

---

### `handleGoOnlineLocation`

Handle when driver shares location to go online

_Source: supabase/functions/wa-webhook-mobility/handlers/go_online.ts:68_

---

### `handleGoOnlineUseCached`

Handle using cached location to go online

_Source: supabase/functions/wa-webhook-mobility/handlers/go_online.ts:159_

---

### `handleGoOffline`

Handle going offline

_Source: supabase/functions/wa-webhook-mobility/handlers/go_online.ts:184_

---

### `unnamed`

MOMO USSD Payment Handler Handles MTN Mobile Money USSD payments for ride fares Uses USSD flow:
*182*7\*1# for payment initiation

_Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:1_

---

### `calculateTripFare`

Calculate fare for a trip

_Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:25_

---

### `initiateTripPayment`

Initialize MOMO payment for a trip

_Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:75_

---

### `handlePaymentConfirmation`

Handle payment confirmation from user

_Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:146_

---

### `verifyMomoPayment`

Verify MOMO payment In production, this would query MTN MOMO API or check reconciliation table

_Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:261_

---

### `handleRefund`

Handle refund request

_Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:289_

---

### `getMomoPaymentStateKey`

Get payment state

_Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:355_

---

### `parsePaymentState`

Parse payment state from stored data

_Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:362_

---

### `findOnlineDriversForTrip`

Find nearby online drivers for a trip

_Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:19_

---

### `notifyDriver`

Send notification to a driver about a nearby passenger

_Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:53_

---

### `notifyMultipleDrivers`

Notify multiple drivers about a trip

_Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:113_

---

### `handleDriverResponse`

Handle driver's response to ride offer

_Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:151_

---

### `notifyPassengerOfDriverAcceptance`

Notify passenger that a driver has accepted

_Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:199_

---

### `unnamed`

Supabase Edge Function: geocode-locations Geocodes bars and businesses using Google Maps Geocoding
API Can be triggered manually or via scheduled cron job

_Source: supabase/functions/geocode-locations/index.ts:1_

---

### `unnamed`

wa-webhook-core - Optimized Entry Point Performance-optimized version with caching and lazy loading

_Source: supabase/functions/wa-webhook-core/index.optimized.ts:1_

---

### `sleep`

Sleep for a given duration with optional jitter

_Source: supabase/functions/wa-webhook-core/router.ts:74_

---

### `isRetriable`

Check if an error or status code is retriable

_Source: supabase/functions/wa-webhook-core/router.ts:82_

---

### `unnamed`

wa-webhook-core - Central Router Service Entry point for all WhatsApp webhook messages

_Source: supabase/functions/wa-webhook-core/index-refactored.ts:1_

---

### `unnamed`

Routing Test Script for wa-webhook-core Tests keyword-based routing using the consolidated route
config

_Source: supabase/functions/wa-webhook-core/test_routing.ts:3_

---

### `extractPhoneFromPayload`

Extract phone number from WhatsApp webhook payload

_Source: supabase/functions/wa-webhook-core/index.ts:232_

---

### `unnamed`

Health Check Handler Provides service health status

_Source: supabase/functions/wa-webhook-core/handlers/health.ts:1_

---

### `performHealthCheck`

Perform health check

_Source: supabase/functions/wa-webhook-core/handlers/health.ts:13_

---

### `healthResponse`

Create health check response

_Source: supabase/functions/wa-webhook-core/handlers/health.ts:61_

---

### `unnamed`

Webhook Verification Handler Handles WhatsApp webhook verification

_Source: supabase/functions/wa-webhook-core/handlers/webhook.ts:1_

---

### `handleWebhookVerification`

Handle webhook verification (GET request)

_Source: supabase/functions/wa-webhook-core/handlers/webhook.ts:9_

---

### `unnamed`

Home Menu Handler Handles home menu display and navigation

_Source: supabase/functions/wa-webhook-core/handlers/home.ts:1_

---

### `handleHomeMenu`

Handle home menu request

_Source: supabase/functions/wa-webhook-core/handlers/home.ts:12_

---

### `handleBackHome`

Handle back to home button

_Source: supabase/functions/wa-webhook-core/handlers/home.ts:53_

---

### `unnamed`

State Router Routes messages based on current user state

_Source: supabase/functions/wa-webhook-core/router/state-router.ts:1_

---

### `routeByState`

Route message based on current user state

_Source: supabase/functions/wa-webhook-core/router/state-router.ts:51_

---

### `unnamed`

Keyword Router Routes messages based on text content keywords

_Source: supabase/functions/wa-webhook-core/router/keyword-router.ts:1_

---

### `routeByKeyword`

Route message based on keywords in text

_Source: supabase/functions/wa-webhook-core/router/keyword-router.ts:51_

---

### `calculateKeywordScore`

Calculate keyword match score

_Source: supabase/functions/wa-webhook-core/router/keyword-router.ts:114_

---

### `unnamed`

Message Router Determines which service should handle incoming messages

_Source: supabase/functions/wa-webhook-core/router/index.ts:1_

---

### `routeMessage`

Route incoming message to appropriate service

_Source: supabase/functions/wa-webhook-core/router/index.ts:18_

---

### `unnamed`

Service Forwarder Forwards requests to appropriate microservices

_Source: supabase/functions/wa-webhook-core/router/forwarder.ts:1_

---

### `forwardToService`

Forward webhook payload to target service

_Source: supabase/functions/wa-webhook-core/router/forwarder.ts:14_

---

### `forward`

Forward to service by name (convenience function)

_Source: supabase/functions/wa-webhook-core/router/forwarder.ts:88_

---

### `detectLanguage`

Detect dominant language from text

_Source: supabase/functions/\_shared/multilingual-utils.ts:18_

---

### `translateText`

Translate text between languages

_Source: supabase/functions/\_shared/multilingual-utils.ts:58_

---

### `getLanguageName`

Get language name

_Source: supabase/functions/\_shared/multilingual-utils.ts:98_

---

### `getCountryFromLanguage`

Get country from language

_Source: supabase/functions/\_shared/multilingual-utils.ts:110_

---

### `unnamed`

Feature Flags for Supabase Edge Functions Provides feature flag checking to control feature rollout.
Flags are controlled via environment variables.

_Source: supabase/functions/\_shared/feature-flags.ts:1_

---

### `flagToEnvKey`

Convert feature flag name to environment variable name

_Source: supabase/functions/\_shared/feature-flags.ts:65_

---

### `getEnvFlag`

Get feature flag value from environment

_Source: supabase/functions/\_shared/feature-flags.ts:75_

---

### `isFeatureEnabled`

Check if a feature flag is enabled Priority: 1. Environment variable (FEATURE\__) 2. Consolidated
flag for agent._ features (FEATURE_AGENT_ALL) 3. Default value

_Source: supabase/functions/\_shared/feature-flags.ts:88_

---

### `requireFeatureFlag`

Require feature flag or throw error

_Source: supabase/functions/\_shared/feature-flags.ts:122_

---

### `getAllFeatureFlags`

Get all feature flag states (for debugging/admin endpoints)

_Source: supabase/functions/\_shared/feature-flags.ts:138_

---

### `validateBody`

Validate request body against schema Returns parsed data or throws validation error

_Source: supabase/functions/\_shared/validation.ts:61_

---

### `validationErrorResponse`

Create validation error response

_Source: supabase/functions/\_shared/validation.ts:77_

---

### `isRateLimited`

Check if request exceeds rate limit

_Source: supabase/functions/\_shared/validation.ts:114_

---

### `rateLimitErrorResponse`

Create rate limit error response

_Source: supabase/functions/\_shared/validation.ts:159_

---

### `cleanupRateLimitStore`

Cleanup expired rate limit entries (run periodically)

_Source: supabase/functions/\_shared/validation.ts:181_

---

### `getClientIP`

Extract IP address from request

_Source: supabase/functions/\_shared/validation.ts:196_

---

### `getUserIdentifier`

Extract user identifier from request (for user-based rate limiting)

_Source: supabase/functions/\_shared/validation.ts:215_

---

### `withCorrelationId`

Wrap a handler function with correlation ID handling

_Source: supabase/functions/\_shared/middleware/correlation.ts:27_

---

### `getCorrelationId`

Extract correlation ID from request (for use without middleware)

_Source: supabase/functions/\_shared/middleware/correlation.ts:74_

---

### `unnamed`

Request Deduplication Middleware Prevents duplicate message processing

_Source: supabase/functions/\_shared/middleware/deduplication.ts:1_

---

### `unnamed`

Time window for deduplication in milliseconds

_Source: supabase/functions/\_shared/middleware/deduplication.ts:14_

---

### `unnamed`

Maximum entries to track

_Source: supabase/functions/\_shared/middleware/deduplication.ts:16_

---

### `unnamed`

Key extraction function

_Source: supabase/functions/\_shared/middleware/deduplication.ts:18_

---

### `checkDuplicate`

Check if request is a duplicate

_Source: supabase/functions/\_shared/middleware/deduplication.ts:51_

---

### `deduplicationMiddleware`

Deduplication middleware

_Source: supabase/functions/\_shared/middleware/deduplication.ts:80_

---

### `getDeduplicationStats`

Get deduplication stats

_Source: supabase/functions/\_shared/middleware/deduplication.ts:136_

---

### `clearDeduplicationCache`

Clear deduplication cache

_Source: supabase/functions/\_shared/middleware/deduplication.ts:143_

---

### `unnamed`

Supabase Client Pool Manages Supabase client instances for optimal connection reuse

_Source: supabase/functions/\_shared/database/client-pool.ts:1_

---

### `unnamed`

Maximum number of clients to pool

_Source: supabase/functions/\_shared/database/client-pool.ts:15_

---

### `unnamed`

Idle timeout in milliseconds

_Source: supabase/functions/\_shared/database/client-pool.ts:17_

---

### `unnamed`

Enable health checks

_Source: supabase/functions/\_shared/database/client-pool.ts:19_

---

### `unnamed`

Health check interval in milliseconds

_Source: supabase/functions/\_shared/database/client-pool.ts:21_

---

### `unnamed`

Initialize the pool

_Source: supabase/functions/\_shared/database/client-pool.ts:58_

---

### `unnamed`

Get a client from the pool

_Source: supabase/functions/\_shared/database/client-pool.ts:78_

---

### `unnamed`

Get pool statistics

_Source: supabase/functions/\_shared/database/client-pool.ts:107_

---

### `unnamed`

Cleanup idle clients

_Source: supabase/functions/\_shared/database/client-pool.ts:127_

---

### `unnamed`

Shutdown the pool

_Source: supabase/functions/\_shared/database/client-pool.ts:149_

---

### `getClientPool`

Get the client pool instance

_Source: supabase/functions/\_shared/database/client-pool.ts:215_

---

### `getPooledClient`

Get a Supabase client from the pool

_Source: supabase/functions/\_shared/database/client-pool.ts:225_

---

### `getSupabaseClient`

Quick access to Supabase client (creates if needed)

_Source: supabase/functions/\_shared/database/client-pool.ts:232_

---

### `unnamed`

Query Builder Optimized query construction with common patterns

_Source: supabase/functions/\_shared/database/query-builder.ts:1_

---

### `unnamed`

Select specific columns

_Source: supabase/functions/\_shared/database/query-builder.ts:52_

---

### `unnamed`

Add equality filter

_Source: supabase/functions/\_shared/database/query-builder.ts:60_

---

### `unnamed`

Add not equal filter

_Source: supabase/functions/\_shared/database/query-builder.ts:68_

---

### `unnamed`

Add greater than filter

_Source: supabase/functions/\_shared/database/query-builder.ts:76_

---

### `unnamed`

Add greater than or equal filter

_Source: supabase/functions/\_shared/database/query-builder.ts:84_

---

### `unnamed`

Add less than filter

_Source: supabase/functions/\_shared/database/query-builder.ts:92_

---

### `unnamed`

Add less than or equal filter

_Source: supabase/functions/\_shared/database/query-builder.ts:100_

---

### `unnamed`

Add IN filter

_Source: supabase/functions/\_shared/database/query-builder.ts:108_

---

### `unnamed`

Add LIKE filter

_Source: supabase/functions/\_shared/database/query-builder.ts:116_

---

### `unnamed`

Add ILIKE filter (case insensitive)

_Source: supabase/functions/\_shared/database/query-builder.ts:124_

---

### `unnamed`

Add IS NULL filter

_Source: supabase/functions/\_shared/database/query-builder.ts:132_

---

### `unnamed`

Add IS NOT NULL filter

_Source: supabase/functions/\_shared/database/query-builder.ts:140_

---

### `unnamed`

Set order by

_Source: supabase/functions/\_shared/database/query-builder.ts:148_

---

### `unnamed`

Set limit

_Source: supabase/functions/\_shared/database/query-builder.ts:157_

---

### `unnamed`

Set offset

_Source: supabase/functions/\_shared/database/query-builder.ts:165_

---

### `unnamed`

Enable count

_Source: supabase/functions/\_shared/database/query-builder.ts:173_

---

### `unnamed`

Apply pagination

_Source: supabase/functions/\_shared/database/query-builder.ts:181_

---

### `unnamed`

Execute query

_Source: supabase/functions/\_shared/database/query-builder.ts:191_

---

### `unnamed`

Execute and get single result

_Source: supabase/functions/\_shared/database/query-builder.ts:261_

---

### `query`

Create query builder for table

_Source: supabase/functions/\_shared/database/query-builder.ts:273_

---

### `unnamed`

Optimized Queries Pre-built optimized queries for common operations

_Source: supabase/functions/\_shared/database/optimized-queries.ts:1_

---

### `getProfileById`

Get profile by ID (optimized with minimal fields)

_Source: supabase/functions/\_shared/database/optimized-queries.ts:15_

---

### `getProfileByPhone`

Get profile by phone (optimized)

_Source: supabase/functions/\_shared/database/optimized-queries.ts:38_

---

### `findNearbyDrivers`

Find nearby drivers (optimized with spatial query hint)

_Source: supabase/functions/\_shared/database/optimized-queries.ts:60_

---

### `findNearbyDriversFallback`

Fallback query without PostGIS

_Source: supabase/functions/\_shared/database/optimized-queries.ts:113_

---

### `getActiveTrip`

Get active trip for user

_Source: supabase/functions/\_shared/database/optimized-queries.ts:158_

---

### `getRecentInsuranceLead`

Get recent insurance lead

_Source: supabase/functions/\_shared/database/optimized-queries.ts:179_

---

### `getUserClaims`

Get user claims

_Source: supabase/functions/\_shared/database/optimized-queries.ts:199_

---

### `getWalletBalance`

Get wallet balance (optimized)

_Source: supabase/functions/\_shared/database/optimized-queries.ts:223_

---

### `getTransactionHistory`

Get transaction history

_Source: supabase/functions/\_shared/database/optimized-queries.ts:238_

---

### `calculateDistance`

Calculate distance between two points (Haversine formula)

_Source: supabase/functions/\_shared/database/optimized-queries.ts:263_

---

### `downloadWhatsAppAudio`

Download audio from WhatsApp Cloud API

_Source: supabase/functions/\_shared/voice-handler.ts:13_

---

### `transcribeAudio`

Transcribe audio using OpenAI Whisper

_Source: supabase/functions/\_shared/voice-handler.ts:56_

---

### `textToSpeech`

Generate speech from text using OpenAI TTS

_Source: supabase/functions/\_shared/voice-handler.ts:92_

---

### `uploadWhatsAppMedia`

Upload media to WhatsApp Cloud API

_Source: supabase/functions/\_shared/voice-handler.ts:117_

---

### `unnamed`

OpenAI LLM Provider Implementation Wraps OpenAI API with the standard LLM Provider interface

_Source: supabase/functions/\_shared/llm-provider-openai.ts:1_

---

### `unnamed`

Marketplace Payment Module Handles USSD-based MoMo payments for marketplace transactions. Uses
tap-to-dial tel: links for seamless mobile payment experience. Payment Flow: 1. Buyer expresses
interest in listing 2. System creates transaction record 3. Sends USSD link to buyer
(tel:*182*8*1*MERCHANT\*AMOUNT#) 4. Buyer taps link → dials USSD → completes MoMo payment 5. Buyer
confirms payment in chat 6. Seller confirms receipt 7. Transaction marked complete

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:1_

---

### `generateMoMoUssd`

Generate USSD code for MoMo merchant payment

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:86_

---

### `createTelLink`

Create tap-to-dial tel: link Note: Keep unencoded for better Android compatibility

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:94_

---

### `formatUssdDisplay`

Format USSD code for display (user-friendly)

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:102_

---

### `initiatePayment`

Initiate a payment transaction

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:113_

---

### `buyerConfirmPayment`

Buyer confirms they've completed payment

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:273_

---

### `sellerConfirmPayment`

Seller confirms they've received payment

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:355_

---

### `cancelTransaction`

Cancel a transaction

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:458_

---

### `getTransactionDetails`

Get transaction details

_Source: supabase/functions/\_shared/tools/marketplace-payment-core.ts:522_

---

### `unnamed`

Payment Handler for Marketplace Integrates payment flow with the AI agent and WhatsApp conversation.
Handles text-based payment commands and transaction state management.

_Source: supabase/functions/\_shared/tools/marketplace-payment.ts:1_

---

### `isPaymentCommand`

Check if message is a payment-related command

_Source: supabase/functions/\_shared/tools/marketplace-payment.ts:24_

---

### `handlePaymentCommand`

Handle payment-related commands

_Source: supabase/functions/\_shared/tools/marketplace-payment.ts:42_

---

### `showTransactionStatus`

Show user's transaction status

_Source: supabase/functions/\_shared/tools/marketplace-payment.ts:173_

---

### `handlePurchaseIntent`

Handle purchase intent from search results

_Source: supabase/functions/\_shared/tools/marketplace-payment.ts:218_

---

### `unnamed`

Message Types WhatsApp message type definitions

_Source: supabase/functions/\_shared/types/messages.ts:1_

---

### `unnamed`

Context Types Shared context types used across all services

_Source: supabase/functions/\_shared/types/context.ts:1_

---

### `unnamed`

Supabase client instance

_Source: supabase/functions/\_shared/types/context.ts:17_

---

### `unnamed`

WhatsApp user phone number (E.164 format)

_Source: supabase/functions/\_shared/types/context.ts:19_

---

### `unnamed`

User's profile ID (if exists)

_Source: supabase/functions/\_shared/types/context.ts:21_

---

### `unnamed`

User's preferred language

_Source: supabase/functions/\_shared/types/context.ts:23_

---

### `unnamed`

Unique request ID

_Source: supabase/functions/\_shared/types/context.ts:31_

---

### `unnamed`

Correlation ID for distributed tracing

_Source: supabase/functions/\_shared/types/context.ts:33_

---

### `unnamed`

Originating service

_Source: supabase/functions/\_shared/types/context.ts:35_

---

### `unnamed`

Request timestamp

_Source: supabase/functions/\_shared/types/context.ts:37_

---

### `unnamed`

Current user state

_Source: supabase/functions/\_shared/types/context.ts:45_

---

### `unnamed`

State key identifier

_Source: supabase/functions/\_shared/types/context.ts:57_

---

### `unnamed`

State data

_Source: supabase/functions/\_shared/types/context.ts:59_

---

### `unnamed`

When state was created

_Source: supabase/functions/\_shared/types/context.ts:61_

---

### `unnamed`

When state expires

_Source: supabase/functions/\_shared/types/context.ts:63_

---

### `unnamed`

Whether the message was handled

_Source: supabase/functions/\_shared/types/context.ts:91_

---

### `unnamed`

Optional response to send

_Source: supabase/functions/\_shared/types/context.ts:93_

---

### `unnamed`

Optional error

_Source: supabase/functions/\_shared/types/context.ts:95_

---

### `unnamed`

Types Module Exports

_Source: supabase/functions/\_shared/types/index.ts:1_

---

### `unnamed`

Response Types API response type definitions

_Source: supabase/functions/\_shared/types/responses.ts:1_

---

### `unnamed`

Media Upload Handler for Marketplace Handles photo uploads from WhatsApp messages for marketplace
listings.

_Source: supabase/functions/\_shared/media-upload.ts:1_

---

### `downloadWhatsAppMedia`

Download media from WhatsApp servers

_Source: supabase/functions/\_shared/media-upload.ts:23_

---

### `uploadToStorage`

Upload image to Supabase Storage

_Source: supabase/functions/\_shared/media-upload.ts:76_

---

### `handleMediaUpload`

Handle media upload from WhatsApp message

_Source: supabase/functions/\_shared/media-upload.ts:114_

---

### `ensureStorageBucket`

Create storage bucket if it doesn't exist

_Source: supabase/functions/\_shared/media-upload.ts:217_

---

### `unnamed`

In-Memory Cache High-performance caching with TTL support

_Source: supabase/functions/\_shared/cache/memory-cache.ts:1_

---

### `unnamed`

Time to live in milliseconds

_Source: supabase/functions/\_shared/cache/memory-cache.ts:19_

---

### `unnamed`

Maximum number of entries

_Source: supabase/functions/\_shared/cache/memory-cache.ts:21_

---

### `unnamed`

Enable LRU eviction

_Source: supabase/functions/\_shared/cache/memory-cache.ts:23_

---

### `unnamed`

Clone values on get/set (prevents mutation)

_Source: supabase/functions/\_shared/cache/memory-cache.ts:25_

---

### `unnamed`

Get value from cache

_Source: supabase/functions/\_shared/cache/memory-cache.ts:67_

---

### `unnamed`

Set value in cache

_Source: supabase/functions/\_shared/cache/memory-cache.ts:97_

---

### `unnamed`

Check if key exists and is not expired

_Source: supabase/functions/\_shared/cache/memory-cache.ts:120_

---

### `unnamed`

Delete key from cache

_Source: supabase/functions/\_shared/cache/memory-cache.ts:133_

---

### `unnamed`

Clear all entries

_Source: supabase/functions/\_shared/cache/memory-cache.ts:142_

---

### `unnamed`

Get or set with factory function

_Source: supabase/functions/\_shared/cache/memory-cache.ts:150_

---

### `unnamed`

Get cache statistics

_Source: supabase/functions/\_shared/cache/memory-cache.ts:168_

---

### `unnamed`

Get all keys

_Source: supabase/functions/\_shared/cache/memory-cache.ts:175_

---

### `unnamed`

Cleanup expired entries

_Source: supabase/functions/\_shared/cache/memory-cache.ts:182_

---

### `createCache`

Create a new cache instance

_Source: supabase/functions/\_shared/cache/memory-cache.ts:270_

---

### `unnamed`

Cached Data Accessors High-level caching for common data access patterns

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:1_

---

### `getCachedProfile`

Get profile with caching

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:14_

---

### `getCachedProfileByPhone`

Get profile by phone with caching

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:39_

---

### `invalidateProfileCache`

Invalidate profile cache

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:64_

---

### `getCachedState`

Get state with caching

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:75_

---

### `invalidateStateCache`

Invalidate state cache

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:102_

---

### `getCachedAppConfig`

Get app config with caching

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:113_

---

### `invalidateConfigCache`

Invalidate config cache

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:140_

---

### `getCachedLocation`

Get cached location for user

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:151_

---

### `setCachedLocation`

Set cached location for user

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:162_

---

### `invalidateLocationCache`

Invalidate location cache

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:176_

---

### `getAllCacheStats`

Get all cache statistics

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:187_

---

### `clearAllCaches`

Clear all caches

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:199_

---

### `cleanupAllCaches`

Cleanup expired entries in all caches

_Source: supabase/functions/\_shared/cache/cached-accessors.ts:209_

---

### `unnamed`

Cache Middleware HTTP response caching for frequently accessed endpoints

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:1_

---

### `unnamed`

Cache key generator

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:21_

---

### `unnamed`

TTL in milliseconds

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:23_

---

### `unnamed`

Paths to cache

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:25_

---

### `unnamed`

Paths to exclude

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:27_

---

### `unnamed`

Methods to cache

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:29_

---

### `unnamed`

Cache condition

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:31_

---

### `cacheMiddleware`

Cache middleware for HTTP responses

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:56_

---

### `shouldCache`

Check if request should be cached

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:125_

---

### `clearResponseCache`

Clear response cache

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:154_

---

### `getResponseCacheStats`

Get cache stats

_Source: supabase/functions/\_shared/cache/cache-middleware.ts:161_

---

### `unnamed`

Cache Module Exports

_Source: supabase/functions/\_shared/cache/index.ts:1_

---

### `unnamed`

Error Handler Module for Supabase Edge Functions Provides structured error handling, recovery
mechanisms, and retry queue integration following EasyMO observability ground rules.

_Source: supabase/functions/\_shared/error-handler.ts:1_

---

### `withErrorBoundary`

Wraps an async operation with error boundary and automatic retry queue integration

_Source: supabase/functions/\_shared/error-handler.ts:85_

---

### `queueForRetry`

Queue a failed operation for retry in the webhook DLQ

_Source: supabase/functions/\_shared/error-handler.ts:167_

---

### `scheduleMessageRetry`

Schedule a message for retry in the message queue

_Source: supabase/functions/\_shared/error-handler.ts:213_

---

### `withTimeout`

Safely execute an operation with timeout

_Source: supabase/functions/\_shared/error-handler.ts:239_

---

### `createSafeHandler`

Create a safe handler that catches and logs errors

_Source: supabase/functions/\_shared/error-handler.ts:280_

---

### `isRetryableError`

Check if an error is retryable

_Source: supabase/functions/\_shared/error-handler.ts:337_

---

### `unnamed`

WhatsApp Webhook Configuration Centralized configuration for webhook processing including timeouts,
retry policies, circuit breakers, and deduplication settings.

_Source: supabase/functions/\_shared/webhook-config.ts:1_

---

### `unnamed`

Default timeout for normal webhook operations (30 seconds)

_Source: supabase/functions/\_shared/webhook-config.ts:14_

---

### `unnamed`

Timeout for AI agent operations (2 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:17_

---

### `unnamed`

Timeout for payment operations (1 minute)

_Source: supabase/functions/\_shared/webhook-config.ts:20_

---

### `unnamed`

Timeout for external API calls (30 seconds)

_Source: supabase/functions/\_shared/webhook-config.ts:23_

---

### `unnamed`

Timeout for database operations (10 seconds)

_Source: supabase/functions/\_shared/webhook-config.ts:26_

---

### `unnamed`

Timeout for media upload/download (5 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:29_

---

### `unnamed`

Maximum number of retry attempts

_Source: supabase/functions/\_shared/webhook-config.ts:37_

---

### `unnamed`

Backoff multiplier for exponential backoff

_Source: supabase/functions/\_shared/webhook-config.ts:40_

---

### `unnamed`

Initial delay in milliseconds before first retry

_Source: supabase/functions/\_shared/webhook-config.ts:43_

---

### `unnamed`

Maximum delay between retries

_Source: supabase/functions/\_shared/webhook-config.ts:46_

---

### `unnamed`

Jitter factor (0-1) to add randomness to backoff

_Source: supabase/functions/\_shared/webhook-config.ts:49_

---

### `unnamed`

Failure threshold percentage before opening circuit (0-100)

_Source: supabase/functions/\_shared/webhook-config.ts:57_

---

### `unnamed`

Time in milliseconds to wait before attempting to close circuit

_Source: supabase/functions/\_shared/webhook-config.ts:60_

---

### `unnamed`

Number of requests to allow in half-open state

_Source: supabase/functions/\_shared/webhook-config.ts:63_

---

### `unnamed`

Minimum number of requests before evaluating error rate

_Source: supabase/functions/\_shared/webhook-config.ts:66_

---

### `unnamed`

Request timeout in milliseconds

_Source: supabase/functions/\_shared/webhook-config.ts:69_

---

### `unnamed`

Time window in milliseconds for deduplication (5 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:88_

---

### `unnamed`

Storage key prefix for deduplication cache

_Source: supabase/functions/\_shared/webhook-config.ts:91_

---

### `unnamed`

Enable deduplication by default

_Source: supabase/functions/\_shared/webhook-config.ts:94_

---

### `unnamed`

Maximum requests per user per minute

_Source: supabase/functions/\_shared/webhook-config.ts:102_

---

### `unnamed`

Maximum requests per IP per minute

_Source: supabase/functions/\_shared/webhook-config.ts:105_

---

### `unnamed`

Maximum concurrent processing per user

_Source: supabase/functions/\_shared/webhook-config.ts:108_

---

### `unnamed`

Burst allowance (extra requests allowed in short bursts)

_Source: supabase/functions/\_shared/webhook-config.ts:111_

---

### `unnamed`

Order workflow timeout (15 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:119_

---

### `unnamed`

Payment workflow timeout (10 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:122_

---

### `unnamed`

Job application workflow timeout (30 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:125_

---

### `unnamed`

Property inquiry workflow timeout (1 hour)

_Source: supabase/functions/\_shared/webhook-config.ts:128_

---

### `unnamed`

Ride request workflow timeout (5 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:131_

---

### `unnamed`

Insurance claim workflow timeout (1 hour)

_Source: supabase/functions/\_shared/webhook-config.ts:134_

---

### `unnamed`

Default workflow timeout (30 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:137_

---

### `unnamed`

Maximum conversation history length to keep

_Source: supabase/functions/\_shared/webhook-config.ts:145_

---

### `unnamed`

Maximum token count before truncating history

_Source: supabase/functions/\_shared/webhook-config.ts:148_

---

### `unnamed`

Session timeout in milliseconds (30 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:151_

---

### `unnamed`

Maximum concurrent AI requests per user

_Source: supabase/functions/\_shared/webhook-config.ts:154_

---

### `unnamed`

Enable context persistence

_Source: supabase/functions/\_shared/webhook-config.ts:157_

---

### `unnamed`

Context TTL in milliseconds (24 hours)

_Source: supabase/functions/\_shared/webhook-config.ts:160_

---

### `unnamed`

Maximum queue size before rejecting new messages

_Source: supabase/functions/\_shared/webhook-config.ts:168_

---

### `unnamed`

Message processing timeout (5 minutes)

_Source: supabase/functions/\_shared/webhook-config.ts:171_

---

### `unnamed`

Batch size for processing messages

_Source: supabase/functions/\_shared/webhook-config.ts:174_

---

### `unnamed`

Polling interval in milliseconds

_Source: supabase/functions/\_shared/webhook-config.ts:177_

---

### `unnamed`

Enable priority processing

_Source: supabase/functions/\_shared/webhook-config.ts:180_

---

### `unnamed`

Retention period for completed messages (7 days)

_Source: supabase/functions/\_shared/webhook-config.ts:183_

---

### `unnamed`

Interval for checking service health (30 seconds)

_Source: supabase/functions/\_shared/webhook-config.ts:191_

---

### `unnamed`

Timeout for health check requests (3 seconds)

_Source: supabase/functions/\_shared/webhook-config.ts:194_

---

### `unnamed`

Number of consecutive failures before marking unhealthy

_Source: supabase/functions/\_shared/webhook-config.ts:197_

---

### `unnamed`

Enable automatic recovery checks

_Source: supabase/functions/\_shared/webhook-config.ts:200_

---

### `unnamed`

Enable structured logging

_Source: supabase/functions/\_shared/webhook-config.ts:208_

---

### `unnamed`

Enable metrics collection

_Source: supabase/functions/\_shared/webhook-config.ts:211_

---

### `unnamed`

Enable distributed tracing

_Source: supabase/functions/\_shared/webhook-config.ts:214_

---

### `unnamed`

Sample rate for traces (0-1)

_Source: supabase/functions/\_shared/webhook-config.ts:217_

---

### `unnamed`

Log level for production

_Source: supabase/functions/\_shared/webhook-config.ts:220_

---

### `unnamed`

Mask PII in logs

_Source: supabase/functions/\_shared/webhook-config.ts:223_

---

### `getWorkflowTimeout`

Get timeout for specific workflow type

_Source: supabase/functions/\_shared/webhook-config.ts:227_

---

### `calculateRetryDelay`

Calculate retry delay with exponential backoff and jitter

_Source: supabase/functions/\_shared/webhook-config.ts:239_

---

### `shouldProcessMessage`

Check if a message should be deduplicated

_Source: supabase/functions/\_shared/webhook-config.ts:257_

---

### `unnamed`

Phone Number Utilities Common utilities for phone number handling including normalization and
masking. Used across wa-webhook services for consistent phone number processing.

_Source: supabase/functions/\_shared/phone-utils.ts:1_

---

### `normalizePhone`

Normalize phone number by removing non-numeric characters except leading +

_Source: supabase/functions/\_shared/phone-utils.ts:8_

---

### `maskPhone`

Mask phone number for logging (privacy protection) Shows first few and last few digits with
asterisks in between.

_Source: supabase/functions/\_shared/phone-utils.ts:23_

---

### `isValidPhone`

Validate if a string looks like a phone number Basic validation - starts with + and contains 10-15
digits

_Source: supabase/functions/\_shared/phone-utils.ts:46_

---

### `getCountryCode`

Extract country code from phone number (assumes E.164 format)

_Source: supabase/functions/\_shared/phone-utils.ts:57_

---

### `unnamed`

Application Constants Centralized constants used across all services

_Source: supabase/functions/\_shared/config/constants.ts:1_

---

### `unnamed`

Configuration Module Exports

_Source: supabase/functions/\_shared/config/index.ts:1_

---

### `unnamed`

Environment Configuration Module Centralized environment variable management with validation

_Source: supabase/functions/\_shared/config/env.ts:1_

---

### `unnamed`

Get environment variable with fallbacks

_Source: supabase/functions/\_shared/config/env.ts:54_

---

### `unnamed`

Get required environment variable

_Source: supabase/functions/\_shared/config/env.ts:69_

---

### `unnamed`

Get boolean environment variable

_Source: supabase/functions/\_shared/config/env.ts:80_

---

### `unnamed`

Get number environment variable

_Source: supabase/functions/\_shared/config/env.ts:89_

---

### `unnamed`

Load and validate all environment variables

_Source: supabase/functions/\_shared/config/env.ts:99_

---

### `unnamed`

Clear cache (useful for testing)

_Source: supabase/functions/\_shared/config/env.ts:156_

---

### `getEnv`

Get environment configuration

_Source: supabase/functions/\_shared/config/env.ts:167_

---

### `validateEnv`

Validate environment and throw if invalid

_Source: supabase/functions/\_shared/config/env.ts:174_

---

### `unnamed`

Security Middleware Layer Provides comprehensive security controls for all microservices

_Source: supabase/functions/\_shared/security/middleware.ts:1_

---

### `unnamed`

Maximum request body size in bytes (default: 1MB)

_Source: supabase/functions/\_shared/security/middleware.ts:13_

---

### `unnamed`

Allowed content types

_Source: supabase/functions/\_shared/security/middleware.ts:15_

---

### `unnamed`

Enable request ID tracking

_Source: supabase/functions/\_shared/security/middleware.ts:17_

---

### `unnamed`

Enable audit logging

_Source: supabase/functions/\_shared/security/middleware.ts:19_

---

### `unnamed`

Rate limit configuration

_Source: supabase/functions/\_shared/security/middleware.ts:21_

---

### `unnamed`

Signature verification

_Source: supabase/functions/\_shared/security/middleware.ts:27_

---

### `unnamed`

Run all security checks on incoming request

_Source: supabase/functions/\_shared/security/middleware.ts:95_

---

### `unnamed`

Build security context from request

_Source: supabase/functions/\_shared/security/middleware.ts:134_

---

### `unnamed`

Validate Content-Type header

_Source: supabase/functions/\_shared/security/middleware.ts:152_

---

### `unnamed`

Validate request body size

_Source: supabase/functions/\_shared/security/middleware.ts:196_

---

### `unnamed`

Check rate limiting

_Source: supabase/functions/\_shared/security/middleware.ts:235_

---

### `unnamed`

Audit logging for security events

_Source: supabase/functions/\_shared/security/middleware.ts:266_

---

### `unnamed`

Create response with security headers

_Source: supabase/functions/\_shared/security/middleware.ts:286_

---

### `createSecurityMiddleware`

Factory function to create security middleware

_Source: supabase/functions/\_shared/security/middleware.ts:307_

---

### `unnamed`

Enhanced Signature Verification Module Provides HMAC-SHA256 signature verification for WhatsApp
webhooks

_Source: supabase/functions/\_shared/security/signature.ts:1_

---

### `unnamed`

Require valid signature (default: true)

_Source: supabase/functions/\_shared/security/signature.ts:27_

---

### `unnamed`

Allow unsigned requests for development (default: false)

_Source: supabase/functions/\_shared/security/signature.ts:29_

---

### `unnamed`

Allow internal service forwarding (default: false)

_Source: supabase/functions/\_shared/security/signature.ts:31_

---

### `unnamed`

App secret for verification

_Source: supabase/functions/\_shared/security/signature.ts:33_

---

### `verifySignature`

Verify WhatsApp webhook signature

_Source: supabase/functions/\_shared/security/signature.ts:41_

---

### `timingSafeEqual`

Timing-safe string comparison to prevent timing attacks

_Source: supabase/functions/\_shared/security/signature.ts:80_

---

### `extractSignatureMetadata`

Extract signature metadata for logging

_Source: supabase/functions/\_shared/security/signature.ts:96_

---

### `verifyWebhookRequest`

Full signature verification with configuration

_Source: supabase/functions/\_shared/security/signature.ts:131_

---

### `unnamed`

Audit Logging System Tracks sensitive operations for security and compliance

_Source: supabase/functions/\_shared/security/audit-logger.ts:1_

---

### `unnamed`

Security Configuration for All Microservices

_Source: supabase/functions/\_shared/security/config.ts:1_

---

### `unnamed`

Input Validation and Sanitization Module Provides comprehensive input validation for all user inputs

_Source: supabase/functions/\_shared/security/input-validator.ts:1_

---

### `sanitizeString`

Sanitize string input - remove dangerous characters

_Source: supabase/functions/\_shared/security/input-validator.ts:36_

---

### `sanitizeForSQL`

Sanitize for SQL - escape special characters Note: Always use parameterized queries, this is defense
in depth

_Source: supabase/functions/\_shared/security/input-validator.ts:51_

---

### `sanitizeForHTML`

Sanitize for HTML - prevent XSS

_Source: supabase/functions/\_shared/security/input-validator.ts:67_

---

### `sanitizePhoneNumber`

Sanitize phone number - keep only digits and leading +

_Source: supabase/functions/\_shared/security/input-validator.ts:85_

---

### `maskPhoneNumber`

Mask phone number for logging

_Source: supabase/functions/\_shared/security/input-validator.ts:99_

---

### `maskEmail`

Mask email for logging

_Source: supabase/functions/\_shared/security/input-validator.ts:107_

---

### `isValidPhoneNumber`

Validate phone number format (E.164)

_Source: supabase/functions/\_shared/security/input-validator.ts:123_

---

### `isValidEmail`

Validate email format

_Source: supabase/functions/\_shared/security/input-validator.ts:132_

---

### `isValidUUID`

Validate UUID format

_Source: supabase/functions/\_shared/security/input-validator.ts:140_

---

### `hasSQLInjectionPatterns`

Check for potential SQL injection patterns

_Source: supabase/functions/\_shared/security/input-validator.ts:148_

---

### `hasXSSPatterns`

Check for potential XSS patterns

_Source: supabase/functions/\_shared/security/input-validator.ts:163_

---

### `validateInput`

Validate input against schema

_Source: supabase/functions/\_shared/security/input-validator.ts:184_

---

### `unnamed`

Waiter AI Tools This module provides tools for the Waiter AI agent to interact with restaurant data,
manage orders, and provide recommendations.

_Source: supabase/functions/\_shared/waiter-tools.ts:1_

---

### `search_menu`

Tool: search_menu Search menu items by name, category, dietary restrictions

_Source: supabase/functions/\_shared/waiter-tools.ts:25_

---

### `get_menu_item_details`

Tool: get_menu_item_details Get detailed information about a specific menu item

_Source: supabase/functions/\_shared/waiter-tools.ts:88_

---

### `add_to_cart`

Tool: add_to_cart Add an item to the current draft order

_Source: supabase/functions/\_shared/waiter-tools.ts:123_

---

### `view_cart`

Tool: view_cart Get current cart contents

_Source: supabase/functions/\_shared/waiter-tools.ts:246_

---

### `update_cart_item`

Tool: update_cart_item Update quantity or remove an item from cart

_Source: supabase/functions/\_shared/waiter-tools.ts:295_

---

### `send_order`

Tool: send_order Finalize the order for payment

_Source: supabase/functions/\_shared/waiter-tools.ts:359_

---

### `recommend_wine`

Tool: recommend_wine Get wine recommendations for a dish

_Source: supabase/functions/\_shared/waiter-tools.ts:425_

---

### `book_table`

Tool: book_table Create a table reservation

_Source: supabase/functions/\_shared/waiter-tools.ts:461_

---

### `get_order_status`

Tool: get_order_status Check the status of an order

_Source: supabase/functions/\_shared/waiter-tools.ts:530_

---

### `updateOrderTotal`

Update order total by summing order items

_Source: supabase/functions/\_shared/waiter-tools.ts:576_

---

### `getOrderSummary`

Get order summary

_Source: supabase/functions/\_shared/waiter-tools.ts:609_

---

### `initiate_payment`

Tool: initiate_payment Initiate a payment for an order (MoMo, Revolut, or Cash)

_Source: supabase/functions/\_shared/waiter-tools.ts:625_

---

### `confirm_payment`

Tool: confirm_payment User confirms they have completed the payment

_Source: supabase/functions/\_shared/waiter-tools.ts:785_

---

### `cancel_payment`

Tool: cancel_payment Cancel a pending payment

_Source: supabase/functions/\_shared/waiter-tools.ts:868_

---

### `get_payment_status`

Tool: get_payment_status Check status of a payment

_Source: supabase/functions/\_shared/waiter-tools.ts:932_

---

### `save_payment_method`

Tool: save_payment_method Save a payment method for future use

_Source: supabase/functions/\_shared/waiter-tools.ts:981_

---

### `get_saved_payment_methods`

Tool: get_saved_payment_methods Get user's saved payment methods

_Source: supabase/functions/\_shared/waiter-tools.ts:1032_

---

### `initiate_payment`

Tool: initiate_payment Initiate a payment for an order (MoMo, Revolut, or Cash)

_Source: supabase/functions/\_shared/waiter-tools.ts:1088_

---

### `confirm_payment`

Tool: confirm_payment User confirms they have completed the payment

_Source: supabase/functions/\_shared/waiter-tools.ts:1248_

---

### `cancel_payment`

Tool: cancel_payment Cancel a pending payment

_Source: supabase/functions/\_shared/waiter-tools.ts:1331_

---

### `get_payment_status`

Tool: get_payment_status Check status of a payment

_Source: supabase/functions/\_shared/waiter-tools.ts:1395_

---

### `save_payment_method`

Tool: save_payment_method Save a payment method for future use

_Source: supabase/functions/\_shared/waiter-tools.ts:1444_

---

### `get_saved_payment_methods`

Tool: get_saved_payment_methods Get user's saved payment methods

_Source: supabase/functions/\_shared/waiter-tools.ts:1495_

---

### `errorHandler`

Error handler middleware for webhook processing Converts errors to proper HTTP responses with
structured error objects

_Source: supabase/functions/\_shared/errors.ts:101_

---

### `unnamed`

AI Agent Orchestrator for WhatsApp Webhook Processing Provides centralized AI agent management
with: - Context persistence and retrieval - Token limit management and truncation - Retry logic with
exponential backoff - Session tracking and metrics

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:1_

---

### `unnamed`

Process a message through the AI agent pipeline

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:47_

---

### `unnamed`

Load conversation context from database

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:129_

---

### `unnamed`

Truncate context to fit within token limits Uses a sliding window approach to keep recent messages

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:164_

---

### `unnamed`

Estimate token count for text Rough estimation: 1 token ≈ 4 characters

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:206_

---

### `unnamed`

Call AI service with retry logic and exponential backoff

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:214_

---

### `unnamed`

Call AI service (placeholder - implement with actual AI provider)

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:263_

---

### `unnamed`

Get agent configuration based on type

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:291_

---

### `unnamed`

Save updated context to database

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:355_

---

### `unnamed`

Update session metrics

_Source: supabase/functions/\_shared/ai-agent-orchestrator.ts:403_

---

### `unnamed`

Dead Letter Queue (DLQ) Manager Handles storage and retrieval of failed webhook payloads for later
reprocessing.

_Source: supabase/functions/\_shared/dlq-manager.ts:1_

---

### `storeDLQEntry`

Store a failed webhook in the DLQ

_Source: supabase/functions/\_shared/dlq-manager.ts:33_

---

### `getPendingDLQEntries`

Get pending DLQ entries ready for retry

_Source: supabase/functions/\_shared/dlq-manager.ts:73_

---

### `markDLQProcessing`

Mark a DLQ entry as processing

_Source: supabase/functions/\_shared/dlq-manager.ts:101_

---

### `markDLQReprocessed`

Mark a DLQ entry as reprocessed

_Source: supabase/functions/\_shared/dlq-manager.ts:120_

---

### `markDLQFailed`

Mark a DLQ entry as failed (after max retries)

_Source: supabase/functions/\_shared/dlq-manager.ts:142_

---

### `incrementDLQRetry`

Increment retry count and update next retry time

_Source: supabase/functions/\_shared/dlq-manager.ts:166_

---

### `getDLQStats`

Get DLQ statistics

_Source: supabase/functions/\_shared/dlq-manager.ts:191_

---

### `calculateNextRetry`

Calculate next retry time with exponential backoff Max 5 retries: 5min, 15min, 1hr, 4hr, 12hr

_Source: supabase/functions/\_shared/dlq-manager.ts:242_

---

### `unnamed`

Webhook Processing Utilities Provides core utilities for WhatsApp webhook processing: - Signature
verification (timing-safe) - Payload validation (Zod schemas) - Webhook queue management - Rate
limiting - Circuit breaker pattern - Logging and metrics

_Source: supabase/functions/\_shared/webhook-utils.ts:1_

---

### `verifyWebhookSignature`

Verify webhook signature using HMAC-SHA256 with timing-safe comparison

_Source: supabase/functions/\_shared/webhook-utils.ts:136_

---

### `validateWebhookPayload`

Validate webhook payload structure using Zod schemas

_Source: supabase/functions/\_shared/webhook-utils.ts:188_

---

### `checkIdempotency`

Check if a WhatsApp message has already been processed (idempotency)

_Source: supabase/functions/\_shared/webhook-utils.ts:680_

---

### `recordProcessedMessage`

Record that a message has been processed

_Source: supabase/functions/\_shared/webhook-utils.ts:723_

---

### `acquireConversationLock`

Acquire a distributed lock for conversation processing

_Source: supabase/functions/\_shared/webhook-utils.ts:771_

---

### `releaseConversationLock`

Release a distributed lock for conversation processing

_Source: supabase/functions/\_shared/webhook-utils.ts:824_

---

### `addToDeadLetterQueue`

Add failed message to dead letter queue

_Source: supabase/functions/\_shared/webhook-utils.ts:869_

---

### `processWithTimeout`

Process webhook with timeout protection

_Source: supabase/functions/\_shared/webhook-utils.ts:933_

---

### `updateConversationState`

Update conversation state with audit trail

_Source: supabase/functions/\_shared/webhook-utils.ts:971_

---

### `getOrCreateConversation`

Get or create webhook conversation

_Source: supabase/functions/\_shared/webhook-utils.ts:1039_

---

### `unnamed`

Circuit Breaker Pattern Implementation Prevents cascading failures by tracking service health and
temporarily blocking requests to failing services. States: - CLOSED: Normal operation, requests pass
through - OPEN: Service is failing, requests are blocked - HALF_OPEN: Testing if service has
recovered

_Source: supabase/functions/\_shared/circuit-breaker.ts:1_

---

### `unnamed`

Check if the circuit breaker allows the request

_Source: supabase/functions/\_shared/circuit-breaker.ts:47_

---

### `unnamed`

Record a successful execution

_Source: supabase/functions/\_shared/circuit-breaker.ts:65_

---

### `unnamed`

Record a failed execution

_Source: supabase/functions/\_shared/circuit-breaker.ts:80_

---

### `unnamed`

Get current circuit state

_Source: supabase/functions/\_shared/circuit-breaker.ts:102_

---

### `unnamed`

Get circuit breaker metrics

_Source: supabase/functions/\_shared/circuit-breaker.ts:109_

---

### `unnamed`

Manually reset the circuit breaker

_Source: supabase/functions/\_shared/circuit-breaker.ts:122_

---

### `unnamed`

Service Resilience Module Provides circuit breaker and rate limiting patterns for microservices
routing. Implements resilience patterns as recommended in WA_WEBHOOK_CORE architecture.

_Source: supabase/functions/\_shared/service-resilience.ts:1_

---

### `isServiceCircuitOpen`

Circuit Breaker: Check if circuit is open for a service Circuit states: - closed: Normal operation,
requests pass through - open: Circuit tripped, requests are rejected immediately - half-open:
Testing if service has recovered, limited requests allowed

_Source: supabase/functions/\_shared/service-resilience.ts:78_

---

### `recordServiceSuccess`

Record a successful request to a service Closes the circuit if in half-open state

_Source: supabase/functions/\_shared/service-resilience.ts:118_

---

### `recordServiceFailure`

Record a failed request to a service Opens the circuit if failures exceed threshold

_Source: supabase/functions/\_shared/service-resilience.ts:140_

---

### `getCircuitState`

Get current circuit state for a service (for monitoring/health checks)

_Source: supabase/functions/\_shared/service-resilience.ts:202_

---

### `checkRateLimit`

Rate Limiter: Check if a phone number has exceeded rate limit Returns { allowed: boolean, remaining:
number, resetAt: number }

_Source: supabase/functions/\_shared/service-resilience.ts:221_

---

### `fetchWithRetry`

Retry with exponential backoff Implements retry for transient failures (configurable via
WA_RETRIABLE_STATUS_CODES)

_Source: supabase/functions/\_shared/service-resilience.ts:261_

---

### `sleep`

Sleep helper for retry delays

_Source: supabase/functions/\_shared/service-resilience.ts:348_

---

### `getAllCircuitStates`

Get all services' circuit states (for health check aggregation)

_Source: supabase/functions/\_shared/service-resilience.ts:355_

---

### `cleanupRateLimitState`

Clean up expired rate limit entries (memory management) Call periodically to prevent memory leaks in
long-running instances

_Source: supabase/functions/\_shared/service-resilience.ts:366_

---

### `unnamed`

Performance Middleware Tracks request performance and reports metrics

_Source: supabase/functions/\_shared/observability/performance-middleware.ts:1_

---

### `unnamed`

Performance Dashboard Endpoint Exposes metrics and performance data

_Source: supabase/functions/\_shared/observability/performance-endpoint.ts:1_

---

### `unnamed`

Metrics Collector Performance metrics collection and reporting

_Source: supabase/functions/\_shared/observability/metrics.ts:1_

---

### `unnamed`

Typed State Machine Provides type-safe state transitions with validation

_Source: supabase/functions/\_shared/state/state-machine.ts:1_

---

### `unnamed`

Default TTL for states

_Source: supabase/functions/\_shared/state/state-machine.ts:38_

---

### `unnamed`

Whether to validate transitions

_Source: supabase/functions/\_shared/state/state-machine.ts:40_

---

### `unnamed`

Whether to log transitions

_Source: supabase/functions/\_shared/state/state-machine.ts:42_

---

### `unnamed`

Get current state for user

_Source: supabase/functions/\_shared/state/state-machine.ts:113_

---

### `unnamed`

Transition to new state

_Source: supabase/functions/\_shared/state/state-machine.ts:140_

---

### `unnamed`

Clear user state (return to home)

_Source: supabase/functions/\_shared/state/state-machine.ts:218_

---

### `unnamed`

Check if transition is allowed

_Source: supabase/functions/\_shared/state/state-machine.ts:232_

---

### `unnamed`

Get allowed transitions for a state

_Source: supabase/functions/\_shared/state/state-machine.ts:241_

---

### `createStateMachine`

Create state machine instance

_Source: supabase/functions/\_shared/state/state-machine.ts:249_

---

### `unnamed`

State Module Exports

_Source: supabase/functions/\_shared/state/index.ts:1_

---

### `unnamed`

State Store Simple state storage and retrieval

_Source: supabase/functions/\_shared/state/store.ts:1_

---

### `getState`

Get user state

_Source: supabase/functions/\_shared/state/store.ts:15_

---

### `setState`

Set user state

_Source: supabase/functions/\_shared/state/store.ts:54_

---

### `clearState`

Clear user state

_Source: supabase/functions/\_shared/state/store.ts:96_

---

### `updateStateData`

Update state data without changing key

_Source: supabase/functions/\_shared/state/store.ts:127_

---

### `ensureProfile`

Ensure user profile exists

_Source: supabase/functions/\_shared/state/store.ts:149_

---

### `unnamed`

Keywords for natural language matching

_Source: supabase/functions/\_shared/route-config.ts:21_

---

### `unnamed`

Menu selection keys (exact match)

_Source: supabase/functions/\_shared/route-config.ts:23_

---

### `unnamed`

Priority for conflict resolution (lower = higher priority)

_Source: supabase/functions/\_shared/route-config.ts:25_

---

### `unnamed`

If true, this service is deprecated and traffic should be routed to wa-webhook-unified when
FEATURE_AGENT_UNIFIED_WEBHOOK is enabled.

_Source: supabase/functions/\_shared/route-config.ts:27_

---

### `unnamed`

The service to redirect to when deprecated

_Source: supabase/functions/\_shared/route-config.ts:32_

---

### `buildMenuKeyMap`

Build a lookup map from menu keys to services

_Source: supabase/functions/\_shared/route-config.ts:134_

---

### `getServiceFromState`

Get service from chat state

_Source: supabase/functions/\_shared/route-config.ts:160_

---

### `matchKeywordsToService`

Match message text to service based on keywords Returns the best matching service or null if no
match

_Source: supabase/functions/\_shared/route-config.ts:175_

---

### `isServiceDeprecated`

Check if a service is deprecated

_Source: supabase/functions/\_shared/route-config.ts:201_

---

### `getServiceRedirect`

Get the redirect target for a deprecated service Returns the original service if not deprecated or
no redirect configured

_Source: supabase/functions/\_shared/route-config.ts:209_

---

### `resolveServiceWithMigration`

Resolve the final service to route to, taking into account deprecation and the
FEATURE_UNIFIED_AGENTS feature flag. When useUnified is true and the service is deprecated, returns
the redirect target. When useUnified is false, always returns the original service (even if
deprecated). When the service is not deprecated, always returns the original service.

_Source: supabase/functions/\_shared/route-config.ts:221_

---

### `unnamed`

Test Fixtures Pre-defined test data for consistent testing

_Source: supabase/functions/\_shared/testing/fixtures.ts:1_

---

### `unnamed`

Test Utilities and Helpers Shared testing infrastructure for all microservices

_Source: supabase/functions/\_shared/testing/test-utils.ts:1_

---

### `createMockSupabase`

Create a mock Supabase client

_Source: supabase/functions/\_shared/testing/test-utils.ts:63_

---

### `createMockContext`

Create a mock router context

_Source: supabase/functions/\_shared/testing/test-utils.ts:130_

---

### `createMockWebhookPayload`

Create a mock WhatsApp webhook payload

_Source: supabase/functions/\_shared/testing/test-utils.ts:143_

---

### `createMockRequest`

Create a mock HTTP request

_Source: supabase/functions/\_shared/testing/test-utils.ts:234_

---

### `assertResponse`

Assert response status and body

_Source: supabase/functions/\_shared/testing/test-utils.ts:264_

---

### `assertSuccess`

Assert that a response is successful

_Source: supabase/functions/\_shared/testing/test-utils.ts:280_

---

### `assertError`

Assert that a response is an error

_Source: supabase/functions/\_shared/testing/test-utils.ts:288_

---

### `createMockWhatsAppAPI`

Create a mock WhatsApp API

_Source: supabase/functions/\_shared/testing/test-utils.ts:320_

---

### `createTestProfile`

Create test profile data

_Source: supabase/functions/\_shared/testing/test-utils.ts:386_

---

### `createTestTrip`

Create test trip data

_Source: supabase/functions/\_shared/testing/test-utils.ts:401_

---

### `createTestInsuranceLead`

Create test insurance lead data

_Source: supabase/functions/\_shared/testing/test-utils.ts:418_

---

### `createTestClaim`

Create test claim data

_Source: supabase/functions/\_shared/testing/test-utils.ts:432_

---

### `createTestSuite`

Setup and teardown helpers

_Source: supabase/functions/\_shared/testing/test-utils.ts:453_

---

### `logStructuredEvent`

Log a structured event with consistent formatting

_Source: supabase/functions/\_shared/observability.ts:13_

---

### `logError`

Log an error with context Stack traces are only included in development environment to prevent
information leakage in production.

_Source: supabase/functions/\_shared/observability.ts:55_

---

### `normalizeDimensions`

Normalize metric dimensions to string values

_Source: supabase/functions/\_shared/observability.ts:95_

---

### `recordMetric`

Record a metric/counter

_Source: supabase/functions/\_shared/observability.ts:105_

---

### `recordDurationMetric`

Record a duration metric

_Source: supabase/functions/\_shared/observability.ts:135_

---

### `recordGauge`

Record a gauge metric (current value snapshot)

_Source: supabase/functions/\_shared/observability.ts:159_

---

### `maskPII`

Mask sensitive data for logging

_Source: supabase/functions/\_shared/observability.ts:179_

---

### `generateCorrelationId`

Create a correlation ID for request tracing

_Source: supabase/functions/\_shared/observability.ts:203_

---

### `getCorrelationId`

Extract correlation ID from request headers

_Source: supabase/functions/\_shared/observability.ts:210_

---

### `logRequest`

Log request with correlation tracking

_Source: supabase/functions/\_shared/observability.ts:219_

---

### `logResponse`

Log response with correlation tracking

_Source: supabase/functions/\_shared/observability.ts:251_

---

### `withRequestInstrumentation`

Wraps a Supabase Edge Function handler with request tracing and structured logging. This function
instruments the handler to: - Automatically propagate and inject a request/correlation ID into all
outgoing fetch requests. - Log structured request and response events with timing and status. -
Intercept and restore the global fetch function for the duration of the handler.

_Source: supabase/functions/\_shared/observability.ts:320_

---

### `unnamed`

Webhook Error Boundary Module Comprehensive error handling for all webhook services with: -
Standardized error responses - User-friendly messages - Automatic retry logic - Circuit breaker
integration - DLQ support

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:1_

---

### `withWebhookErrorBoundary`

Wrap a webhook handler with comprehensive error boundary

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:84_

---

### `handleWebhookError`

Handle webhook errors with recovery mechanisms

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:179_

---

### `extractErrorDetails`

Extract error details from various error types

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:287_

---

### `getUserFriendlyMessage`

Get user-friendly error message

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:337_

---

### `withTimeout`

Create a safe async operation wrapper with timeout

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:344_

---

### `validatePayload`

Validate webhook payload with structured errors

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:377_

---

### `isWhatsAppPayload`

Type guard for WhatsApp webhook payload

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:394_

---

### `withRetry`

Retry an operation with exponential backoff

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:414_

---

### `unnamed`

Export error classes for use in services

_Source: supabase/functions/\_shared/webhook-error-boundary.ts:464_

---

### `addToDeadLetterQueue`

Add failed message to dead letter queue

_Source: supabase/functions/\_shared/dead-letter-queue.ts:13_

---

### `getRetriableMessages`

Get messages ready for retry

_Source: supabase/functions/\_shared/dead-letter-queue.ts:67_

---

### `markMessageProcessed`

Mark message as processed

_Source: supabase/functions/\_shared/dead-letter-queue.ts:91_

---

### `unnamed`

Check if a request is allowed for the given key (e.g., phone number)

_Source: supabase/functions/\_shared/rate-limiter.ts:29_

---

### `unnamed`

Get current usage for a key

_Source: supabase/functions/\_shared/rate-limiter.ts:60_

---

### `unnamed`

Reset rate limit for a specific key

_Source: supabase/functions/\_shared/rate-limiter.ts:80_

---

### `unnamed`

Clear all rate limit data

_Source: supabase/functions/\_shared/rate-limiter.ts:87_

---

### `unnamed`

Cleanup old entries (call periodically)

_Source: supabase/functions/\_shared/rate-limiter.ts:94_

---

### `unnamed`

Embedding Generator Service Generates vector embeddings for semantic search using OpenAI or Gemini

_Source: supabase/functions/\_shared/embedding-service.ts:1_

---

### `generateEmbeddingOpenAI`

Generate embeddings using OpenAI text-embedding-3-small (1536 dimensions)

_Source: supabase/functions/\_shared/embedding-service.ts:17_

---

### `generateEmbeddingGemini`

Generate embeddings using Google Gemini (embedding-001) Note: Gemini embeddings are 768 dimensions,
we'll need to pad to 1536

_Source: supabase/functions/\_shared/embedding-service.ts:54_

---

### `generateEmbedding`

Generate embedding with automatic fallback

_Source: supabase/functions/\_shared/embedding-service.ts:100_

---

### `hybridSearch`

Hybrid search (vector + full-text)

_Source: supabase/functions/\_shared/embedding-service.ts:224_

---

### `unnamed`

Agent Observability Utilities Specialized logging and metrics for AI agent operations. Extends the
base observability utilities with agent-specific events.

_Source: supabase/functions/\_shared/agent-observability.ts:1_

---

### `logAgentEvent`

Log an agent event with structured data

_Source: supabase/functions/\_shared/agent-observability.ts:49_

---

### `logNegotiationStart`

Log agent negotiation start

_Source: supabase/functions/\_shared/agent-observability.ts:73_

---

### `logQuoteReceived`

Log quote collection event

_Source: supabase/functions/\_shared/agent-observability.ts:96_

---

### `logNegotiationCompleted`

Log negotiation completion

_Source: supabase/functions/\_shared/agent-observability.ts:121_

---

### `logSessionTimeout`

Log session timeout

_Source: supabase/functions/\_shared/agent-observability.ts:144_

---

### `logVendorContact`

Log vendor contact attempt

_Source: supabase/functions/\_shared/agent-observability.ts:163_

---

### `logAgentError`

Log agent error with context

_Source: supabase/functions/\_shared/agent-observability.ts:185_

---

### `maskIdentifier`

Mask identifier for PII protection Shows first 4 and last 4 characters, masks the middle

_Source: supabase/functions/\_shared/agent-observability.ts:203_

---

### `maskPhone`

Mask phone number for PII protection Shows country code and last 3 digits

_Source: supabase/functions/\_shared/agent-observability.ts:220_

---

### `recordAgentMetric`

Record agent session metrics Helper to record common agent metrics with consistent dimensions. NOTE:
This function is a placeholder for future implementation. The recordMetric function needs to be
implemented in observability.ts first.

_Source: supabase/functions/\_shared/agent-observability.ts:246_

---

### `unnamed`

Security utilities for Supabase Edge Functions Provides signature verification, secret management
helpers, and security best practices enforcement.

_Source: supabase/functions/\_shared/security.ts:1_

---

### `verifyWhatsAppSignature`

Verify WhatsApp webhook signature using HMAC SHA-256

_Source: supabase/functions/\_shared/security.ts:12_

---

### `verifyHmacSignature`

Verify generic webhook HMAC signature

_Source: supabase/functions/\_shared/security.ts:82_

---

### `constantTimeCompare`

Constant-time string comparison to prevent timing attacks

_Source: supabase/functions/\_shared/security.ts:126_

---

### `validateRequiredEnvVars`

Validate that required environment variables are set

_Source: supabase/functions/\_shared/security.ts:146_

---

### `isPlaceholderValue`

Check if an environment variable contains a placeholder value

_Source: supabase/functions/\_shared/security.ts:176_

---

### `sanitizeErrorMessage`

Sanitize error messages to prevent information leakage

_Source: supabase/functions/\_shared/security.ts:202_

---

### `cleanupRateLimitStore`

Clean up expired rate limit entries Call periodically to prevent memory leaks

_Source: supabase/functions/\_shared/security.ts:265_

---

### `isValidJwtStructure`

Validate JWT token structure (without verification) Useful for basic validation before costly
verification

_Source: supabase/functions/\_shared/security.ts:278_

---

### `unnamed`

Logging utilities with correlation ID support Ensures all logs include correlation ID for
distributed tracing. Part of CORE-002 fix for consistent correlation ID propagation.

_Source: supabase/functions/\_shared/correlation-logging.ts:1_

---

### `withCorrelation`

Create a logging function with correlation context

_Source: supabase/functions/\_shared/correlation-logging.ts:19_

---

### `logError`

Enhanced console.error with correlation ID Use this instead of raw console.error

_Source: supabase/functions/\_shared/correlation-logging.ts:43_

---

### `logWarn`

Enhanced console.warn with correlation ID Use this instead of raw console.warn

_Source: supabase/functions/\_shared/correlation-logging.ts:64_

---

### `logInfo`

Enhanced console.log with correlation ID Use this instead of raw console.log for structured events

_Source: supabase/functions/\_shared/correlation-logging.ts:81_

---

### `unnamed`

WhatsApp API Client with Circuit Breaker Protection Wraps all WhatsApp Graph API calls with circuit
breaker pattern to prevent cascading failures when WhatsApp API is down.

_Source: supabase/functions/\_shared/whatsapp-client.ts:1_

---

### `sendWhatsAppMessage`

Send a WhatsApp message with circuit breaker protection

_Source: supabase/functions/\_shared/whatsapp-client.ts:45_

---

### `getWhatsAppCircuitStatus`

Get WhatsApp API circuit breaker status

_Source: supabase/functions/\_shared/whatsapp-client.ts:138_

---

### `resetWhatsAppCircuit`

Reset WhatsApp API circuit breaker (manual intervention)

_Source: supabase/functions/\_shared/whatsapp-client.ts:148_

---

### `maskPhone`

Mask phone number for logging (PII protection)

_Source: supabase/functions/\_shared/whatsapp-client.ts:158_

---

### `getMomoProvider`

Get MoMo provider configuration for a phone number Returns null if no provider-specific
configuration exists Falls back to default USSD codes in qr.ts

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/exchange/country_support.ts:97_

---

### `getLocalizedMenuName`

Get localized menu item name for a specific country

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:58_

---

### `fetchActiveMenuItems`

Fetch active menu items from database filtered by country Returns items with country-specific names
applied

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:71_

---

### `normalizeMenuKey`

Normalize a menu key (legacy or canonical) to its canonical agent key.

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:150_

---

### `getMenuItemId`

Map menu item keys to IDS constants

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:159_

---

### `getMenuItemTranslationKeys`

Get translation key for menu item

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:170_

---

### `getAllowedCountries`

Get allowed countries for insurance feature. Tries to load from app_config table, falls back to
default if not configured.

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/insurance/gate.ts:25_

---

### `saveIntent`

Save user intent to mobility_intents table for better querying and recommendations

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/intent_storage.ts:20_

---

### `getRecentIntents`

Get recent intents for a user

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/intent_storage.ts:51_

---

### `cleanupExpiredIntents`

Clean up expired intents (can be called periodically or via cron)

_Source: supabase/functions/\_shared/wa-webhook-shared/domains/intent_storage.ts:76_

---

### `unnamed`

AI Agent Location Integration Helper Standardized location resolution before agent execution All AI
agents MUST use this before processing user requests

_Source: supabase/functions/\_shared/wa-webhook-shared/ai-agents/location-integration.ts:1_

---

### `prepareAgentLocation`

Prepare agent context with location This MUST be called before any agent processes a user request
Flow: 1. If user just shared location → save to cache and use it 2. Check 30-minute cache 3. Check
saved locations (home/work based on agent type) 4. Prompt user to share location

_Source: supabase/functions/\_shared/wa-webhook-shared/ai-agents/location-integration.ts:33_

---

### `formatLocationContext`

Format location for display in agent responses

_Source: supabase/functions/\_shared/wa-webhook-shared/ai-agents/location-integration.ts:138_

---

### `extractUserIntent`

Standard intent extraction from user message Agents should use this to identify what user wants

_Source: supabase/functions/\_shared/wa-webhook-shared/ai-agents/location-integration.ts:173_

---

### `unnamed`

Enhanced Middleware Integration for wa-webhook Provides middleware functions that integrate rate
limiting, caching, error handling, and metrics without modifying existing code. These can be
optionally integrated into the existing pipeline.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:1_

---

### `applyRateLimiting`

Apply rate limiting middleware Can be called from existing pipeline to add rate limiting

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:21_

---

### `trackWebhookMetrics`

Track webhook metrics

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:68_

---

### `getCachedUserContext`

Cache user context with automatic expiration Can be used in message_context.ts to cache user lookups

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:92_

---

### `wrapError`

Wrap error with enhanced error handling Can be used in existing try-catch blocks to enhance error
responses

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:109_

---

### `addRateLimitHeaders`

Add rate limit headers to response

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:135_

---

### `enhanceWebhookRequest`

Middleware function to enhance PreparedWebhook This can be called after processWebhookRequest to add
enhancements

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:160_

---

### `logWebhookCompletion`

Log webhook processing completion

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:197_

---

### `processMessageWithEnhancements`

Example: Enhanced message processor wrapper This shows how to wrap existing handleMessage calls with
enhancements

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:225_

---

### `areEnhancementsEnabled`

Utility to check if enhancements are enabled

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:288_

---

### `getEnhancementConfig`

Get enhancement configuration

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/middleware.ts:297_

---

### `unnamed`

Message Deduplication and Queue Integration Provides deduplication checking against the database and
queue integration for reliable message processing.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/message-deduplication.ts:1_

---

### `isNewMessage`

Check if a message has already been processed (database-backed deduplication)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/message-deduplication.ts:14_

---

### `markMessageProcessed`

Mark a message as processed

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/message-deduplication.ts:67_

---

### `enqueueMessage`

Add message to processing queue

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/message-deduplication.ts:115_

---

### `getOrCreateConversationMemory`

Get or create AI conversation memory

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/message-deduplication.ts:175_

---

### `updateConversationMemory`

Update AI conversation memory

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/message-deduplication.ts:272_

---

### `cleanupOldConversations`

Cleanup old conversation memories (older than 7 days with no activity)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/message-deduplication.ts:346_

---

### `unnamed`

Enhanced Error Handling for wa-webhook Provides structured error handling with classification, user
notifications, and retry logic. Complements existing error handling.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/error_handler.ts:1_

---

### `normalizeError`

Normalize any error to WebhookError

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/error_handler.ts:83_

---

### `handleWebhookError`

Handle webhook error with logging and optional user notification

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/error_handler.ts:167_

---

### `notifyUserOfError`

Send error notification to user

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/error_handler.ts:199_

---

### `createErrorResponse`

Create error response

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/error_handler.ts:228_

---

### `maskPhone`

Mask phone number for logging (PII protection)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/error_handler.ts:276_

---

### `isRetryableError`

Check if error is retryable

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/error_handler.ts:284_

---

### `getRetryDelay`

Get retry delay based on attempt number

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/error_handler.ts:300_

---

### `unnamed`

Enhanced Health Check for wa-webhook Provides comprehensive health monitoring including rate
limiter, cache, and database connectivity.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:1_

---

### `checkDatabase`

Check database health

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:39_

---

### `checkRateLimiter`

Check rate limiter health

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:78_

---

### `checkCache`

Check cache health

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:100_

---

### `checkMetrics`

Check metrics collector health

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:122_

---

### `performHealthCheck`

Perform comprehensive health check

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:143_

---

### `createHealthCheckResponse`

Create health check response

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:180_

---

### `createLivenessResponse`

Simple liveness probe (for Kubernetes, etc.)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:201_

---

### `createReadinessResponse`

Readiness probe (checks critical dependencies)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/health_check.ts:211_

---

### `unnamed`

What to prioritize in sorting. Defaults to 'distance' for nearby flows, 'time' for scheduled flows.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/sortMatches.ts:11_

---

### `getMatchTimestamp`

Get the timestamp from a match result, preferring matched_at over created_at.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/sortMatches.ts:18_

---

### `timestampMs`

Convert a match's timestamp to milliseconds for comparison.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/sortMatches.ts:25_

---

### `getDistance`

Get the distance from a match, returning MAX_SAFE_INTEGER if not available.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/sortMatches.ts:33_

---

### `sortMatches`

Shared sorting function for match results. Provides consistent sorting across all mobility flows.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/sortMatches.ts:42_

---

### `compareByDistance`

Comparator function for sorting by distance first. Can be used directly with Array.sort().

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/sortMatches.ts:91_

---

### `compareByTime`

Comparator function for sorting by time first. Can be used directly with Array.sort().

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/sortMatches.ts:107_

---

### `unnamed`

Dynamic Submenu Helper Provides reusable functions to fetch and display dynamic submenus from
database Eliminates hardcoded menu lists

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/dynamic_submenu.ts:1_

---

### `fetchSubmenuItems`

Fetch submenu items for a parent menu from database

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/dynamic_submenu.ts:21_

---

### `fetchProfileMenuItems`

Fetch profile menu items from database

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/dynamic_submenu.ts:51_

---

### `submenuItemsToRows`

Convert submenu items to WhatsApp list row format

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/dynamic_submenu.ts:85_

---

### `getSubmenuRows`

Get submenu items as WhatsApp rows with back button Convenience function that combines fetch +
convert + add back button

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/dynamic_submenu.ts:106_

---

### `hasSubmenu`

Check if a submenu exists and has items

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/dynamic_submenu.ts:143_

---

### `getSubmenuAction`

Get the default action for a submenu item Used for routing based on action_type

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/dynamic_submenu.ts:159_

---

### `unnamed`

Increment a counter

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:36_

---

### `unnamed`

Set a gauge value

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:50_

---

### `unnamed`

Record a histogram value (for durations, sizes, etc.)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:63_

---

### `unnamed`

Get dimension key for grouping

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:81_

---

### `unnamed`

Parse dimension key back to object

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:95_

---

### `unnamed`

Calculate histogram statistics

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:110_

---

### `unnamed`

Flush metrics to logs

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:151_

---

### `unnamed`

Get metrics in Prometheus format (for /metrics endpoint)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:206_

---

### `unnamed`

Get summary statistics

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:260_

---

### `unnamed`

Start periodic flushing

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:271_

---

### `unnamed`

Stop flushing and cleanup

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/metrics_collector.ts:282_

---

### `unnamed`

Get value from cache

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:48_

---

### `unnamed`

Set value in cache

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:71_

---

### `unnamed`

Get or set value using factory function

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:94_

---

### `unnamed`

Delete from cache

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:112_

---

### `unnamed`

Clear all cache

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:123_

---

### `unnamed`

Check if cache contains key

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:135_

---

### `unnamed`

Evict least recently used entry

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:148_

---

### `unnamed`

Clean up expired entries

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:172_

---

### `unnamed`

Get cache statistics

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:195_

---

### `unnamed`

Check if cache is healthy

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:212_

---

### `unnamed`

Start periodic cleanup

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:219_

---

### `unnamed`

Cleanup resources

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/cache.ts:231_

---

### `unnamed`

Check if identifier should be rate limited

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/rate_limiter.ts:48_

---

### `unnamed`

Manually unblock an identifier

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/rate_limiter.ts:120_

---

### `unnamed`

Get statistics for monitoring

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/rate_limiter.ts:128_

---

### `unnamed`

Mask identifier for logging (PII protection)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/rate_limiter.ts:143_

---

### `unnamed`

Cleanup expired buckets

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/rate_limiter.ts:151_

---

### `unnamed`

Start periodic cleanup

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/rate_limiter.ts:174_

---

### `unnamed`

Stop cleanup (for testing/shutdown)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/rate_limiter.ts:183_

---

### `unnamed`

Standardized Location Resolution for AI Agents Critical component for all AI agents to obtain user
location Priority: 30-min cache → Saved locations → Prompt user

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/location-resolver.ts:1_

---

### `resolveUserLocation`

Resolve user location with standard priority logic

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/location-resolver.ts:64_

---

### `buildLocationPrompt`

Build context-aware location prompt message

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/location-resolver.ts:180_

---

### `saveLocationToCache`

Save location to cache after user shares Call this when user shares a fresh location

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/location-resolver.ts:202_

---

### `getUserSavedLocations`

Get all saved locations for a user Useful for showing user their saved locations to choose from

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/location-resolver.ts:231_

---

### `isLocationCacheValid`

Check if location cache is still valid Useful for conditional prompts

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/location-resolver.ts:262_

---

### `ensureProfile`

Thin wrapper around the shared ensureProfile() helper so every webhook surface reuses the same
normalization and user-id mapping logic.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/profile.ts:9_

---

### `validateAndLoadConfig`

Validate and load configuration

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/config_validator.ts:54_

---

### `getEnv`

Get environment variable with fallback to multiple keys

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/config_validator.ts:116_

---

### `loadConfig`

Load configuration with defaults

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/config_validator.ts:127_

---

### `printConfigStatus`

Print configuration status

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/config_validator.ts:174_

---

### `assertConfigValid`

Assert configuration is valid (throws if not)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/config_validator.ts:202_

---

### `encodeTelUriForQr`

Encodes a USSD string as a tel: URI for QR codes. Android QR scanner apps often fail to decode
percent-encoded characters before passing the URI to the dialer. This function leaves \* and #
unencoded for better Android compatibility while maintaining iOS support.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ussd.ts:14_

---

### `unnamed`

AI Agent Chat Interface Utilities Provides consistent, emoji-rich, button-enabled chat interfaces
for all AI agents. All agents MUST use natural language chat with: - Emoji-numbered listings (1️⃣,
2️⃣, 3️⃣) - Action buttons for quick responses - Concise messages with emojis

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:1_

---

### `formatEmojiNumberedList`

Format options/items as emoji-numbered list

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:20_

---

### `createAgentActionButtons`

Create action buttons for agent responses

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:62_

---

### `sendAgentListResponse`

Send agent message with emoji-numbered list and action buttons

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:90_

---

### `sendAgentMessageWithActions`

Send concise agent message with action buttons

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:136_

---

### `sendAgentMessage`

Send simple agent text message with emoji

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:163_

---

### `formatAgentError`

Format error message for agent responses

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:178_

---

### `formatAgentSuccess`

Format success message for agent responses

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:186_

---

### `createQuickReplyInstruction`

Create quick reply instruction text

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:193_

---

### `parseEmojiNumber`

Parse emoji number from user input Supports both emoji (1️⃣) and plain numbers (1)

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/ai-chat-interface.ts:210_

---

### `buildMomoUssdForQr`

Builds MOMO USSD code with tel URI optimized for QR codes. Uses unencoded \* and # for better
Android QR scanner compatibility.

_Source: supabase/functions/\_shared/wa-webhook-shared/utils/momo.ts:16_

---

### `unnamed`

Phase 3.1: Post-Trip Save Prompts Prompt users to save trip destinations as saved locations

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/trip-completion.ts:1_

---

### `parseSaveLocationAction`

Handle SAVE*LOC*\* button clicks from post-trip prompts

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/trip-completion.ts:69_

---

### `getEmptyLocationsMessage`

Standardized location-related messages Phase 2.3: Update empty state messages with sharing
instructions

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/messages.ts:1_

---

### `reverseGeocode`

Reverse geocode coordinates to human-readable address Uses OpenStreetMap Nominatim API (free, no API
key required) Rate limit: 1 request per second Usage Policy:
https://operations.osmfoundation.org/policies/nominatim/

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/geocoding.ts:21_

---

### `formatAddress`

Format Nominatim address into concise human-readable format

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/geocoding.ts:106_

---

### `getAddressOrCoords`

Get formatted address or fallback to coordinates

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/geocoding.ts:137_

---

### `clearGeocodeCache`

Clear geocoding cache (useful for testing)

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/geocoding.ts:154_

---

### `getGeocodeStats`

Get cache stats (for monitoring)

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/geocoding.ts:161_

---

### `findNearbyLocations`

Check if a location already exists within a specified radius Uses Haversine formula to calculate
distance between coordinates

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/deduplication.ts:3_

---

### `calculateDistance`

Calculate distance between two coordinates using Haversine formula Returns distance in meters

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/deduplication.ts:50_

---

### `checkDuplicateLocation`

Check if location is duplicate and return appropriate message

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/deduplication.ts:74_

---

### `unnamed`

Phase 3.3 & 3.4: Smart Location Suggestions Time-based and usage-based location recommendations

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/suggestions.ts:1_

---

### `getSmartLocationSuggestion`

Get smart location suggestion based on time of day and usage patterns

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/suggestions.ts:18_

---

### `getSuggestionMessage`

Get greeting message with smart suggestion

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/suggestions.ts:79_

---

### `trackLocationUsage`

Increment usage counter when location is used

_Source: supabase/functions/\_shared/wa-webhook-shared/locations/suggestions.ts:108_

---

### `allocateTokens`

Admin allocates tokens to a user

_Source: supabase/functions/\_shared/wa-webhook-shared/wallet/allocate.ts:12_

---

### `allocateInsuranceBonus`

Allocate insurance bonus tokens

_Source: supabase/functions/\_shared/wa-webhook-shared/wallet/allocate.ts:141_

---

### `allocateReferralBonus`

Allocate referral bonus tokens

_Source: supabase/functions/\_shared/wa-webhook-shared/wallet/allocate.ts:228_

---

### `sendProfileMenu`

Display the Profile menu with options for managing businesses, vehicles, and tokens Delegates to the
comprehensive Profile hub implementation

_Source: supabase/functions/\_shared/wa-webhook-shared/flows/profile.ts:6_

---

### `unnamed`

Gemini-Backed Tools for EasyMO Agents Specialized tools leveraging Gemini's Google ecosystem
integration: - Maps & Places API integration - Document parsing and OCR - Data normalization and
enrichment - Cross-checking and validation All tools remain grounded in EasyMO data - Gemini is a
processing engine, not a data source.

_Source: supabase/functions/\_shared/gemini-tools.ts:1_

---

### `normalizeVendorPayload`

Normalize vendor payload using Gemini Extracts structured data from messy text/images

_Source: supabase/functions/\_shared/gemini-tools.ts:48_

---

### `geocodeAddress`

Geocode an address using Gemini (can integrate with Google Maps) For now, returns null - integrate
with actual geocoding API

_Source: supabase/functions/\_shared/gemini-tools.ts:179_

---

### `findVendorsNearby`

Find vendors nearby using Google Maps/Places Filters results to only EasyMO-registered vendors

_Source: supabase/functions/\_shared/gemini-tools.ts:197_

---

### `parseDocument`

Parse and structure document/image (menus, property listings, job postings, etc.)

_Source: supabase/functions/\_shared/gemini-tools.ts:266_

---

### `crossCheckResponse`

Cross-check and validate critical information Used for insurance quotes, legal summaries, compliance
checks

_Source: supabase/functions/\_shared/gemini-tools.ts:380_

---

### `unnamed`

Send a chat completion request

_Source: supabase/functions/\_shared/llm-provider-interface.ts:62_

---

### `unnamed`

Generate embeddings for semantic search

_Source: supabase/functions/\_shared/llm-provider-interface.ts:67_

---

### `unnamed`

Analyze an image with vision capabilities

_Source: supabase/functions/\_shared/llm-provider-interface.ts:72_

---

### `unnamed`

Check if provider is healthy

_Source: supabase/functions/\_shared/llm-provider-interface.ts:77_

---

### `unnamed`

Enhanced Error Handler with i18n Support Provides user-friendly error messages with multi-language
support

_Source: supabase/functions/\_shared/errors/error-handler.ts:1_

---

### `unnamed`

Marketplace Utility Functions Location parsing, formatting, and notification utilities.

_Source: supabase/functions/\_shared/marketplace-utils.ts:1_

---

### `parseWhatsAppLocation`

Parse location from WhatsApp location message

_Source: supabase/functions/\_shared/marketplace-utils.ts:36_

---

### `parseLocationFromText`

Parse location from text (city/area names in Rwanda)

_Source: supabase/functions/\_shared/marketplace-utils.ts:55_

---

### `calculateDistance`

Calculate distance between two points (Haversine formula)

_Source: supabase/functions/\_shared/marketplace-utils.ts:112_

---

### `formatPrice`

Format price with currency

_Source: supabase/functions/\_shared/marketplace-utils.ts:138_

---

### `formatDistance`

Format distance

_Source: supabase/functions/\_shared/marketplace-utils.ts:151_

---

### `formatRating`

Format rating as stars

_Source: supabase/functions/\_shared/marketplace-utils.ts:161_

---

### `formatListing`

Format listing for WhatsApp message

_Source: supabase/functions/\_shared/marketplace-utils.ts:170_

---

### `formatBusiness`

Format business for WhatsApp message

_Source: supabase/functions/\_shared/marketplace-utils.ts:204_

---

### `extractWhatsAppMessage`

Extract WhatsApp message from webhook payload

_Source: supabase/functions/\_shared/marketplace-utils.ts:242_

---

### `buildBuyerNotification`

Build notification message for matching buyers

_Source: supabase/functions/\_shared/marketplace-utils.ts:297_

---

### `buildSellerNotification`

Build notification message for sellers

_Source: supabase/functions/\_shared/marketplace-utils.ts:314_

---

### `parsePriceFromText`

Parse price from text

_Source: supabase/functions/\_shared/marketplace-utils.ts:334_

---

### `isValidPhone`

Validate phone number format

_Source: supabase/functions/\_shared/marketplace-utils.ts:354_

---

### `normalizePhone`

Normalize phone number to international format

_Source: supabase/functions/\_shared/marketplace-utils.ts:363_

---

### `maskPhone`

Mask phone number for logging (PII protection)

_Source: supabase/functions/\_shared/marketplace-utils.ts:381_

---

### `logMarketplaceEvent`

Log marketplace event with masked PII

_Source: supabase/functions/\_shared/marketplace-utils.ts:389_

---

### `unnamed`

AI Agent Orchestrator - Core Logic Manages WhatsApp message routing to appropriate AI agents, intent
parsing, and domain action execution. NOW WITH DATABASE-DRIVEN CONFIGURATION & TOOL EXECUTION: -
Loads personas, system instructions, tools, tasks, KBs from database - Caches configs for 5 minutes
to reduce DB load - Falls back to hardcoded configs if DB fails - Executes tools with validation and
logging

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1_

---

### `unnamed`

Main entry point: Process incoming WhatsApp message

_Source: supabase/functions/\_shared/agent-orchestrator.ts:53_

---

### `unnamed`

Get or create a chat session for session persistence

_Source: supabase/functions/\_shared/agent-orchestrator.ts:128_

---

### `unnamed`

Fallback method to get or create session without RPC

_Source: supabase/functions/\_shared/agent-orchestrator.ts:158_

---

### `unnamed`

Add message to session history

_Source: supabase/functions/\_shared/agent-orchestrator.ts:200_

---

### `unnamed`

Get session conversation history

_Source: supabase/functions/\_shared/agent-orchestrator.ts:243_

---

### `unnamed`

Get or create WhatsApp user by phone number

_Source: supabase/functions/\_shared/agent-orchestrator.ts:270_

---

### `unnamed`

Save user's location to cache (30-minute TTL) Used when user shares GPS coordinates

_Source: supabase/functions/\_shared/agent-orchestrator.ts:298_

---

### `unnamed`

Determine which agent should handle this message Can be based on: - User's last active
conversation - Keywords in message - User context/roles

_Source: supabase/functions/\_shared/agent-orchestrator.ts:330_

---

### `unnamed`

Get or create conversation for user × agent

_Source: supabase/functions/\_shared/agent-orchestrator.ts:408_

---

### `unnamed`

Store WhatsApp message in database

_Source: supabase/functions/\_shared/agent-orchestrator.ts:475_

---

### `unnamed`

Parse intent from user message using LLM NOW LOADS SYSTEM INSTRUCTIONS FROM DATABASE

_Source: supabase/functions/\_shared/agent-orchestrator.ts:499_

---

### `unnamed`

Simple intent parsing (placeholder for LLM integration) NOW RECEIVES AGENT CONFIG WITH TOOLS AND
TASKS

_Source: supabase/functions/\_shared/agent-orchestrator.ts:537_

---

### `unnamed`

Extract job search parameters from message

_Source: supabase/functions/\_shared/agent-orchestrator.ts:709_

---

### `unnamed`

Extract property search parameters from message

_Source: supabase/functions/\_shared/agent-orchestrator.ts:738_

---

### `unnamed`

Extract ride parameters from message

_Source: supabase/functions/\_shared/agent-orchestrator.ts:765_

---

### `unnamed`

Extract insurance parameters from message

_Source: supabase/functions/\_shared/agent-orchestrator.ts:803_

---

### `unnamed`

Store parsed intent in database

_Source: supabase/functions/\_shared/agent-orchestrator.ts:835_

---

### `unnamed`

Execute agent-specific action based on intent NOW WITH TOOL EXECUTION FROM DATABASE

_Source: supabase/functions/\_shared/agent-orchestrator.ts:864_

---

### `unnamed`

Legacy action handlers (fallback when no tool matches)

_Source: supabase/functions/\_shared/agent-orchestrator.ts:944_

---

### `unnamed`

Jobs agent actions

_Source: supabase/functions/\_shared/agent-orchestrator.ts:984_

---

### `unnamed`

Real estate agent actions

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1004_

---

### `unnamed`

Waiter agent actions

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1022_

---

### `unnamed`

Farmer agent actions

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1042_

---

### `unnamed`

Business broker agent actions

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1056_

---

### `unnamed`

Rides agent actions

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1070_

---

### `unnamed`

Insurance agent actions

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1101_

---

### `unnamed`

Send response back to user via WhatsApp Returns the response text for session history

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1130_

---

### `unnamed`

Generate response text based on intent and persona

_Source: supabase/functions/\_shared/agent-orchestrator.ts:1172_

---

### `unnamed`

Standardized Health Check Implementation Used across all microservices for consistent health
reporting

_Source: supabase/functions/\_shared/health-check.ts:1_

---

### `healthResponse`

Create health check response

_Source: supabase/functions/\_shared/health-check.ts:110_

---

### `unnamed`

Performance Module Exports

_Source: supabase/functions/\_shared/performance/index.ts:1_

---

### `unnamed`

Kinyarwanda Translations

_Source: supabase/functions/\_shared/i18n/locales/rw.ts:1_

---

### `unnamed`

English Translations

_Source: supabase/functions/\_shared/i18n/locales/en.ts:1_

---

### `unnamed`

French Translations

_Source: supabase/functions/\_shared/i18n/locales/fr.ts:1_

---

### `unnamed`

Translator Simple translation function with fallback support

_Source: supabase/functions/\_shared/i18n/translator.ts:1_

---

### `t`

Translate a key to the given language

_Source: supabase/functions/\_shared/i18n/translator.ts:35_

---

### `getTranslations`

Get all translations for a locale

_Source: supabase/functions/\_shared/i18n/translator.ts:57_

---

### `hasTranslation`

Check if a translation key exists

_Source: supabase/functions/\_shared/i18n/translator.ts:64_

---

### `unnamed`

I18n Module Exports

_Source: supabase/functions/\_shared/i18n/index.ts:1_

---

### `checkRateLimit`

Check rate limit using sliding window algorithm

_Source: supabase/functions/\_shared/rate-limit.ts:18_

---

### `rateLimitResponse`

Create a 429 Too Many Requests response

_Source: supabase/functions/\_shared/rate-limit.ts:91_

---

### `getClientIdentifier`

Extract client identifier for rate limiting Tries multiple sources: custom header, forwarded IP, or
fallback

_Source: supabase/functions/\_shared/rate-limit.ts:120_

---

### `unnamed`

Message Deduplicator Centralized service for detecting and preventing duplicate message processing
Uses wa_events table as source of truth for message tracking Created: 2025-12-01 Part of: Platform
cleanup - standardize deduplication across webhooks

_Source: supabase/functions/\_shared/message-deduplicator.ts:1_

---

### `unnamed`

Check if a message has already been processed Returns true if message exists in wa_events table

_Source: supabase/functions/\_shared/message-deduplicator.ts:36_

---

### `unnamed`

Check and get full deduplication info

_Source: supabase/functions/\_shared/message-deduplicator.ts:60_

---

### `unnamed`

Record a message as processed Stores in wa_events table for future deduplication checks

_Source: supabase/functions/\_shared/message-deduplicator.ts:93_

---

### `unnamed`

Check and record in a single operation Returns true if message should be processed (not a duplicate)

_Source: supabase/functions/\_shared/message-deduplicator.ts:136_

---

### `unnamed`

Clean up old deduplication records Call this periodically to prevent table bloat

_Source: supabase/functions/\_shared/message-deduplicator.ts:159_

---

### `checkDuplicate`

Convenience function for quick duplicate checks

_Source: supabase/functions/\_shared/message-deduplicator.ts:194_

---

### `processIfUnique`

Convenience function for check + record pattern

_Source: supabase/functions/\_shared/message-deduplicator.ts:205_

---

### `assertEnvironmentValid`

Validate and throw if critical errors

_Source: supabase/functions/\_shared/env-validator.ts:119_

---

### `unnamed`

LLM Router - Intelligent routing between OpenAI and Gemini Provides: - Transparent provider
switching - Failover and retry logic - Provider-specific tool routing - Load balancing and cost
optimization

_Source: supabase/functions/\_shared/llm-router.ts:1_

---

### `unnamed`

Execute an LLM request with intelligent routing

_Source: supabase/functions/\_shared/llm-router.ts:85_

---

### `unnamed`

Execute a tool call with provider-specific routing

_Source: supabase/functions/\_shared/llm-router.ts:160_

---

### `unnamed`

Execute failover to backup provider

_Source: supabase/functions/\_shared/llm-router.ts:208_

---

### `unnamed`

Select the appropriate provider based on rules and context

_Source: supabase/functions/\_shared/llm-router.ts:252_

---

### `unnamed`

Load agent provider rules from database

_Source: supabase/functions/\_shared/llm-router.ts:275_

---

### `unnamed`

Get default provider rules for an agent

_Source: supabase/functions/\_shared/llm-router.ts:340_

---

### `unnamed`

Health check all providers

_Source: supabase/functions/\_shared/llm-router.ts:385_

---

### `unnamed`

Message Builder Fluent API for building WhatsApp messages

_Source: supabase/functions/\_shared/messaging/builder.ts:1_

---

### `unnamed`

Add text content

_Source: supabase/functions/\_shared/messaging/builder.ts:17_

---

### `unnamed`

Add bold text

_Source: supabase/functions/\_shared/messaging/builder.ts:25_

---

### `unnamed`

Add italic text

_Source: supabase/functions/\_shared/messaging/builder.ts:33_

---

### `unnamed`

Add line break

_Source: supabase/functions/\_shared/messaging/builder.ts:41_

---

### `unnamed`

Add double line break

_Source: supabase/functions/\_shared/messaging/builder.ts:49_

---

### `unnamed`

Add bullet point

_Source: supabase/functions/\_shared/messaging/builder.ts:57_

---

### `unnamed`

Add numbered item

_Source: supabase/functions/\_shared/messaging/builder.ts:65_

---

### `unnamed`

Add emoji prefix

_Source: supabase/functions/\_shared/messaging/builder.ts:73_

---

### `unnamed`

Build final message

_Source: supabase/functions/\_shared/messaging/builder.ts:81_

---

### `unnamed`

Set message body

_Source: supabase/functions/\_shared/messaging/builder.ts:103_

---

### `unnamed`

Set header text

_Source: supabase/functions/\_shared/messaging/builder.ts:111_

---

### `unnamed`

Set footer text

_Source: supabase/functions/\_shared/messaging/builder.ts:119_

---

### `unnamed`

Add a button

_Source: supabase/functions/\_shared/messaging/builder.ts:127_

---

### `unnamed`

Add back button

_Source: supabase/functions/\_shared/messaging/builder.ts:141_

---

### `unnamed`

Add cancel button

_Source: supabase/functions/\_shared/messaging/builder.ts:148_

---

### `unnamed`

Build button message payload

_Source: supabase/functions/\_shared/messaging/builder.ts:155_

---

### `unnamed`

Set list title

_Source: supabase/functions/\_shared/messaging/builder.ts:179_

---

### `unnamed`

Set message body

_Source: supabase/functions/\_shared/messaging/builder.ts:187_

---

### `unnamed`

Set button text

_Source: supabase/functions/\_shared/messaging/builder.ts:195_

---

### `unnamed`

Set section title

_Source: supabase/functions/\_shared/messaging/builder.ts:203_

---

### `unnamed`

Add a row

_Source: supabase/functions/\_shared/messaging/builder.ts:211_

---

### `unnamed`

Add back row

_Source: supabase/functions/\_shared/messaging/builder.ts:225_

---

### `unnamed`

Build list message options

_Source: supabase/functions/\_shared/messaging/builder.ts:232_

---

### `text`

Create text message builder

_Source: supabase/functions/\_shared/messaging/builder.ts:250_

---

### `buttons`

Create button message builder

_Source: supabase/functions/\_shared/messaging/builder.ts:257_

---

### `list`

Create list message builder

_Source: supabase/functions/\_shared/messaging/builder.ts:264_

---

### `unnamed`

Reusable UI Components Pre-built message components for common patterns

_Source: supabase/functions/\_shared/messaging/components/index.ts:1_

---

### `successMessage`

Success confirmation message

_Source: supabase/functions/\_shared/messaging/components/index.ts:16_

---

### `errorMessage`

Error message

_Source: supabase/functions/\_shared/messaging/components/index.ts:36_

---

### `warningMessage`

Warning message

_Source: supabase/functions/\_shared/messaging/components/index.ts:55_

---

### `infoMessage`

Info message

_Source: supabase/functions/\_shared/messaging/components/index.ts:68_

---

### `confirmationDialog`

Confirmation dialog with yes/no buttons

_Source: supabase/functions/\_shared/messaging/components/index.ts:85_

---

### `actionConfirmation`

Action confirmation with custom buttons

_Source: supabase/functions/\_shared/messaging/components/index.ts:101_

---

### `homeMenuList`

Home menu list

_Source: supabase/functions/\_shared/messaging/components/index.ts:122_

---

### `homeOnlyButton`

Back to home button only

_Source: supabase/functions/\_shared/messaging/components/index.ts:140_

---

### `backHomeButtons`

Back and home buttons

_Source: supabase/functions/\_shared/messaging/components/index.ts:147_

---

### `mobilityMenuList`

Mobility menu list

_Source: supabase/functions/\_shared/messaging/components/index.ts:161_

---

### `vehicleSelectionList`

Vehicle selection list

_Source: supabase/functions/\_shared/messaging/components/index.ts:178_

---

### `shareLocationPrompt`

Share location prompt

_Source: supabase/functions/\_shared/messaging/components/index.ts:196_

---

### `insuranceMenuList`

Insurance menu list

_Source: supabase/functions/\_shared/messaging/components/index.ts:219_

---

### `claimTypeSelectionList`

Claim type selection list

_Source: supabase/functions/\_shared/messaging/components/index.ts:234_

---

### `walletMenuList`

Wallet menu list

_Source: supabase/functions/\_shared/messaging/components/index.ts:255_

---

### `transferConfirmation`

Transfer confirmation

_Source: supabase/functions/\_shared/messaging/components/index.ts:271_

---

### `tripStatusMessage`

Trip status message

_Source: supabase/functions/\_shared/messaging/components/index.ts:293_

---

### `tripActionButtons`

Trip action buttons based on status

_Source: supabase/functions/\_shared/messaging/components/index.ts:323_

---

### `processingMessage`

Processing message

_Source: supabase/functions/\_shared/messaging/components/index.ts:363_

---

### `searchingMessage`

Searching message

_Source: supabase/functions/\_shared/messaging/components/index.ts:373_

---

### `unnamed`

WhatsApp Client Wrapper Unified interface for sending WhatsApp messages

_Source: supabase/functions/\_shared/messaging/client.ts:1_

---

### `unnamed`

Send API request

_Source: supabase/functions/\_shared/messaging/client.ts:38_

---

### `unnamed`

Send text message

_Source: supabase/functions/\_shared/messaging/client.ts:86_

---

### `unnamed`

Send button message

_Source: supabase/functions/\_shared/messaging/client.ts:99_

---

### `unnamed`

Send list message

_Source: supabase/functions/\_shared/messaging/client.ts:135_

---

### `unnamed`

Send location message

_Source: supabase/functions/\_shared/messaging/client.ts:165_

---

### `unnamed`

Send template message

_Source: supabase/functions/\_shared/messaging/client.ts:183_

---

### `unnamed`

Get media URL

_Source: supabase/functions/\_shared/messaging/client.ts:209_

---

### `unnamed`

Download media

_Source: supabase/functions/\_shared/messaging/client.ts:227_

---

### `getWhatsAppClient`

Get WhatsApp client instance

_Source: supabase/functions/\_shared/messaging/client.ts:251_

---

### `sendText`

Send text message using context

_Source: supabase/functions/\_shared/messaging/client.ts:265_

---

### `sendButtons`

Send buttons message using context

_Source: supabase/functions/\_shared/messaging/client.ts:279_

---

### `sendList`

Send list message using context

_Source: supabase/functions/\_shared/messaging/client.ts:298_

---

### `sendLocation`

Send location message using context

_Source: supabase/functions/\_shared/messaging/client.ts:315_

---

### `unnamed`

Messaging Module Exports

_Source: supabase/functions/\_shared/messaging/index.ts:1_

---

### `unnamed`

Google Gemini LLM Provider Implementation Wraps Google Gemini API with the standard LLM Provider
interface Provides access to Gemini's Google-connected tools (Maps, Search, etc.)

_Source: supabase/functions/\_shared/llm-provider-gemini.ts:1_

---

### `unnamed`

Convert OpenAI-style JSON schema to Gemini format

_Source: supabase/functions/\_shared/llm-provider-gemini.ts:262_

---

### `unnamed`

WhatsApp API wrapper Provides a unified interface for sending WhatsApp messages

_Source: supabase/functions/\_shared/whatsapp-api.ts:1_

---

### `sendWhatsAppMessage`

Send a WhatsApp message (text, list, or buttons)

_Source: supabase/functions/\_shared/whatsapp-api.ts:14_

---

### `unnamed`

Lazy Handler Loader Deferred loading of handlers to optimize cold starts

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:1_

---

### `unnamed`

Check if module is loaded

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:34_

---

### `unnamed`

Get loaded module (null if not loaded)

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:41_

---

### `unnamed`

Get load time in ms

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:48_

---

### `unnamed`

Load the module

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:55_

---

### `unnamed`

Preload the module (fire and forget)

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:85_

---

### `registerLazyHandler`

Register a lazy handler

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:106_

---

### `getLazyHandler`

Get a lazy handler

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:116_

---

### `isHandlerLoaded`

Check if handler is loaded

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:128_

---

### `preloadHandlers`

Preload handlers

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:135_

---

### `getHandlerLoadingStats`

Get handler loading stats

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:145_

---

### `lazy`

Create a lazy handler function

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:165_

---

### `lazyExecute`

Execute a handler function lazily

_Source: supabase/functions/\_shared/handlers/lazy-loader.ts:182_

---

### `unnamed`

Warm-up Module Optimizes cold start times through preloading

_Source: supabase/functions/\_shared/warmup/index.ts:1_

---

### `unnamed`

Preload database connection

_Source: supabase/functions/\_shared/warmup/index.ts:16_

---

### `unnamed`

Preload app configuration

_Source: supabase/functions/\_shared/warmup/index.ts:18_

---

### `unnamed`

Handler names to preload

_Source: supabase/functions/\_shared/warmup/index.ts:20_

---

### `unnamed`

Timeout for warmup in ms

_Source: supabase/functions/\_shared/warmup/index.ts:22_

---

### `warmup`

Run warmup sequence

_Source: supabase/functions/\_shared/warmup/index.ts:52_

---

### `backgroundWarmup`

Background warmup (fire and forget)

_Source: supabase/functions/\_shared/warmup/index.ts:139_

---

### `unnamed`

Warmup on first request

_Source: supabase/functions/\_shared/warmup/index.ts:151_

---

### `isWarmedUp`

Check if warmup has completed

_Source: supabase/functions/\_shared/warmup/index.ts:163_

---

### `unnamed`

Rate Limiting Module for Supabase Edge Functions Uses Redis (Upstash) with sliding window algorithm
Implements best practices from GROUND_RULES.md

_Source: supabase/functions/\_shared/rate-limit/index.ts:1_

---

### `unnamed`

Unique identifier for rate limit (e.g., "wa-webhook:user-id" or IP)

_Source: supabase/functions/\_shared/rate-limit/index.ts:11_

---

### `unnamed`

Maximum number of requests allowed in the window

_Source: supabase/functions/\_shared/rate-limit/index.ts:13_

---

### `unnamed`

Time window in seconds

_Source: supabase/functions/\_shared/rate-limit/index.ts:15_

---

### `unnamed`

Whether the request is allowed

_Source: supabase/functions/\_shared/rate-limit/index.ts:20_

---

### `unnamed`

Number of requests remaining in current window

_Source: supabase/functions/\_shared/rate-limit/index.ts:22_

---

### `unnamed`

Timestamp when the rate limit resets

_Source: supabase/functions/\_shared/rate-limit/index.ts:24_

---

### `unnamed`

Current request count in window

_Source: supabase/functions/\_shared/rate-limit/index.ts:26_

---

### `checkRateLimit`

Check if a request should be rate limited

_Source: supabase/functions/\_shared/rate-limit/index.ts:30_

---

### `rateLimitResponse`

Create a 429 Rate Limit Exceeded response

_Source: supabase/functions/\_shared/rate-limit/index.ts:90_

---

### `getClientIdentifier`

Extract client identifier from request

_Source: supabase/functions/\_shared/rate-limit/index.ts:118_

---

### `rateLimitMiddleware`

Rate limit middleware for edge functions

_Source: supabase/functions/\_shared/rate-limit/index.ts:135_

---

### `unnamed`

WhatsApp Business API Sender Provides utilities for sending messages via WhatsApp Business API -
Text messages - Media messages (image, document) - Template messages - Interactive messages
(buttons, lists) - Automatic retry with exponential backoff

_Source: supabase/functions/\_shared/whatsapp-sender.ts:1_

---

### `sendMessageWithRetry`

Send message with automatic retry and exponential backoff

_Source: supabase/functions/\_shared/whatsapp-sender.ts:373_

---

### `createWhatsAppSender`

Create a WhatsAppSender instance from environment variables

_Source: supabase/functions/\_shared/whatsapp-sender.ts:417_

---

### `unnamed`

AI Agent Tool Executor Executes tools loaded from database configurations Supports multiple tool
types: db, http, external, momo, etc. Validates inputs against JSON schemas Logs all executions for
monitoring

_Source: supabase/functions/\_shared/tool-executor.ts:1_

---

### `unnamed`

Execute a tool with given inputs

_Source: supabase/functions/\_shared/tool-executor.ts:44_

---

### `unnamed`

Validate inputs against JSON schema

_Source: supabase/functions/\_shared/tool-executor.ts:156_

---

### `unnamed`

Execute database tool (search, query, etc.)

_Source: supabase/functions/\_shared/tool-executor.ts:199_

---

### `unnamed`

Search marketplace listings

_Source: supabase/functions/\_shared/tool-executor.ts:294_

---

### `unnamed`

Sanitize search query to prevent SQL injection in LIKE patterns

_Source: supabase/functions/\_shared/tool-executor.ts:364_

---

### `unnamed`

Format phone number for WhatsApp URL (remove non-digit characters except leading +)

_Source: supabase/functions/\_shared/tool-executor.ts:377_

---

### `unnamed`

Create a new marketplace listing

_Source: supabase/functions/\_shared/tool-executor.ts:386_

---

### `unnamed`

Get nearby listings based on user's cached location

_Source: supabase/functions/\_shared/tool-executor.ts:439_

---

### `unnamed`

Get user information from whatsapp_users table

_Source: supabase/functions/\_shared/tool-executor.ts:505_

---

### `unnamed`

Mask phone number for privacy (show last 4 digits)

_Source: supabase/functions/\_shared/tool-executor.ts:557_

---

### `unnamed`

Create a support ticket for complex issues

_Source: supabase/functions/\_shared/tool-executor.ts:565_

---

### `unnamed`

Search jobs database

_Source: supabase/functions/\_shared/tool-executor.ts:700_

---

### `unnamed`

Search properties database

_Source: supabase/functions/\_shared/tool-executor.ts:732_

---

### `unnamed`

Search menu items

_Source: supabase/functions/\_shared/tool-executor.ts:769_

---

### `unnamed`

Search business directory

_Source: supabase/functions/\_shared/tool-executor.ts:805_

---

### `unnamed`

Search produce listings

_Source: supabase/functions/\_shared/tool-executor.ts:837_

---

### `unnamed`

Lookup loyalty points

_Source: supabase/functions/\_shared/tool-executor.ts:864_

---

### `unnamed`

Generic table query

_Source: supabase/functions/\_shared/tool-executor.ts:880_

---

### `unnamed`

Execute HTTP tool (API calls)

_Source: supabase/functions/\_shared/tool-executor.ts:896_

---

### `unnamed`

Execute deep search tool (semantic vector search + web search fallback)

_Source: supabase/functions/\_shared/tool-executor.ts:927_

---

### `unnamed`

Execute MoMo payment tool

_Source: supabase/functions/\_shared/tool-executor.ts:1034_

---

### `unnamed`

Execute location tool

_Source: supabase/functions/\_shared/tool-executor.ts:1176_

---

### `unnamed`

Execute external tool (Sora, etc.)

_Source: supabase/functions/\_shared/tool-executor.ts:1197_

---

### `unnamed`

Execute WhatsApp tool (contact_seller, etc.)

_Source: supabase/functions/\_shared/tool-executor.ts:1213_

---

### `unnamed`

Generate WhatsApp link to contact a seller

_Source: supabase/functions/\_shared/tool-executor.ts:1232_

---

### `unnamed`

Get user account information

_Source: supabase/functions/\_shared/tool-executor.ts:1289_

---

### `unnamed`

Check user wallet balance

_Source: supabase/functions/\_shared/tool-executor.ts:1327_

---

### `unnamed`

Create a support ticket for complex issues

_Source: supabase/functions/\_shared/tool-executor.ts:1376_

---

### `unnamed`

Search FAQ/knowledge base for answers

_Source: supabase/functions/\_shared/tool-executor.ts:1433_

---

### `unnamed`

Find nearby available drivers

_Source: supabase/functions/\_shared/tool-executor.ts:1476_

---

### `unnamed`

Request a ride

_Source: supabase/functions/\_shared/tool-executor.ts:1576_

---

### `unnamed`

Get fare estimate for a trip

_Source: supabase/functions/\_shared/tool-executor.ts:1643_

---

### `unnamed`

Track ride status

_Source: supabase/functions/\_shared/tool-executor.ts:1667_

---

### `unnamed`

Calculate insurance quote

_Source: supabase/functions/\_shared/tool-executor.ts:1708_

---

### `unnamed`

Check insurance policy status

_Source: supabase/functions/\_shared/tool-executor.ts:1778_

---

### `unnamed`

Submit an insurance claim

_Source: supabase/functions/\_shared/tool-executor.ts:1822_

---

### `unnamed`

Log tool execution to database

_Source: supabase/functions/\_shared/tool-executor.ts:1884_

---

### `unnamed`

Execute weather tool (OpenWeather API)

_Source: supabase/functions/\_shared/tool-executor.ts:1919_

---

### `unnamed`

Execute translation tool (Google Translate API)

_Source: supabase/functions/\_shared/tool-executor.ts:1971_

---

### `unnamed`

Execute geocoding tool (Google Maps API)

_Source: supabase/functions/\_shared/tool-executor.ts:2033_

---

### `unnamed`

Execute scheduling tool

_Source: supabase/functions/\_shared/tool-executor.ts:2095_

---

### `unnamed`

Centralized Message Library for AI Agents All user-facing messages should be defined here for
consistency. This ensures uniform tone, voice, and easier i18n integration.

_Source: supabase/functions/\_shared/agent-messages.ts:1_

---

### `unnamed`

Loading/Progress Messages Used while system is processing requests

_Source: supabase/functions/\_shared/agent-messages.ts:23_

---

### `unnamed`

Success Messages Confirming successful actions

_Source: supabase/functions/\_shared/agent-messages.ts:36_

---

### `unnamed`

No Results Messages When searches return empty results

_Source: supabase/functions/\_shared/agent-messages.ts:52_

---

### `unnamed`

Error Messages When things go wrong, with recovery steps

_Source: supabase/functions/\_shared/agent-messages.ts:79_

---

### `unnamed`

Instructions Guiding users on what to do

_Source: supabase/functions/\_shared/agent-messages.ts:130_

---

### `unnamed`

Headers Section headers in messages

_Source: supabase/functions/\_shared/agent-messages.ts:141_

---

### `buildFallbackMessage`

Helper function to format fallback messages consistently

_Source: supabase/functions/\_shared/agent-messages.ts:154_

---

### `getAgentEmoji`

Get appropriate emoji for agent type

_Source: supabase/functions/\_shared/agent-messages.ts:174_

---

### `buildErrorMessage`

Build a consistent error message with recovery options

_Source: supabase/functions/\_shared/agent-messages.ts:194_

---

### `unnamed`

AI Agent Database Loader Loads agent configurations (personas, instructions, tools, tasks, KBs) from
database Provides caching and fallback to hardcoded configs

_Source: supabase/functions/\_shared/agent-config-loader.ts:1_

---

### `unnamed`

Load complete agent configuration from database

_Source: supabase/functions/\_shared/agent-config-loader.ts:106_

---

### `unnamed`

Invalidate cache for a specific agent (used by webhooks)

_Source: supabase/functions/\_shared/agent-config-loader.ts:237_

---

### `unnamed`

Load default persona for an agent

_Source: supabase/functions/\_shared/agent-config-loader.ts:266_

---

### `unnamed`

Load active system instructions

_Source: supabase/functions/\_shared/agent-config-loader.ts:280_

---

### `unnamed`

Load active tools

_Source: supabase/functions/\_shared/agent-config-loader.ts:295_

---

### `unnamed`

Load tasks

_Source: supabase/functions/\_shared/agent-config-loader.ts:309_

---

### `unnamed`

Load knowledge bases

_Source: supabase/functions/\_shared/agent-config-loader.ts:322_

---

### `unnamed`

Create fallback config when database loading fails

_Source: supabase/functions/\_shared/agent-config-loader.ts:335_

---

### `unnamed`

Clear cache for an agent (useful for testing or forced reload)

_Source: supabase/functions/\_shared/agent-config-loader.ts:356_

---

### `unnamed`

Get cache statistics

_Source: supabase/functions/\_shared/agent-config-loader.ts:367_

---

### `getMockResponse`

Mock response generator TODO: Replace with actual agent execution

_Source: supabase/functions/agent-runner/index.ts:141_

---

### `getMockTools`

Mock tools list TODO: Replace with actual tools invoked

_Source: supabase/functions/agent-runner/index.ts:182_

---

### `unnamed`

Agent Config Cache Invalidator Edge Function that invalidates agent config caches when database
changes occur Triggered by database triggers on config table changes

_Source: supabase/functions/agent-config-invalidator/index.ts:1_

---
