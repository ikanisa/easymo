# Code Reference

Generated on: 2025-12-02T21:57:27.095Z

---

## Functions

### `createRealtimeSession`

Initialize OpenAI Realtime session

*Source: supabase/functions/openai-realtime-sip/index.ts:24*

---

### `buildInstructions`

Build agent instructions based on locale and context

*Source: supabase/functions/openai-realtime-sip/index.ts:70*

---

### `parseDeepResearchOutput`

Parse deep research output and extract property listings

*Source: supabase/functions/openai-deep-research/index.ts:179*

---

### `extractPropertyFromSearchResult`

Extract structured property data from search result Uses OpenAI to parse unstructured text into property details

*Source: supabase/functions/openai-deep-research/index.ts:643*

---

### `normalizePhoneNumber`

Normalize phone number to international format with country code

*Source: supabase/functions/openai-deep-research/index.ts:752*

---

### `getCurrencyForCountry`

Get currency code for country

*Source: supabase/functions/openai-deep-research/index.ts:802*

---

### `validateAndNormalizeProperty`

Validate and normalize extracted property data

*Source: supabase/functions/openai-deep-research/index.ts:957*

---

### `unnamed`

Agent Registry Central registry for all AI agents Part of Unified AI Agent Architecture Created: 2025-11-27 Updated: 2025-12-01 - Added Rides and Insurance agents OFFICIAL AGENTS (10 production agents matching ai_agents database table): 1. waiter - Restaurant/Bar ordering, table booking 2. farmer - Agricultural support, market prices 3. jobs - Job search, employment, gigs 4. real_estate - Property rentals, listings 5. marketplace - Buy/sell products, business directory 6. rides - Transport, ride-sharing, delivery 7. insurance - Motor insurance, policies, claims 8. support - General help, customer service 9. sales_cold_caller - Sales/Marketing outreach 10. business_broker - Deprecated, use marketplace

*Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:1*

---

### `unnamed`

Register all available agents All agents use database-driven configuration via AgentConfigLoader

*Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:41*

---

### `unnamed`

Map intents/keywords to agent types

*Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:57*

---

### `unnamed`

Register a new agent

*Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:121*

---

### `unnamed`

Get agent by type

*Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:129*

---

### `unnamed`

Get agent by intent/keyword

*Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:142*

---

### `unnamed`

List all registered agents

*Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:154*

---

### `unnamed`

Check if agent exists

*Source: supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts:161*

---

### `unnamed`

Base Agent Interface All AI agents must extend this abstract class Part of Unified AI Agent Architecture Created: 2025-11-27 NOW USES DATABASE-DRIVEN CONFIGURATION: - Loads personas, system instructions, tools from database via AgentConfigLoader - Falls back to hardcoded prompts if database config not available - Provides tool execution via ToolExecutor

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:1*

---

### `unnamed`

Base Agent Class All agents (Waiter, Farmer, Jobs, etc.) extend this NOW DATABASE-DRIVEN: - System prompts loaded from ai_agent_system_instructions table - Personas loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:59*

---

### `unnamed`

The database agent slug - maps to ai_agents.slug Override this if agent type differs from database slug

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:73*

---

### `unnamed`

Main processing method - must be implemented by each agent

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:99*

---

### `unnamed`

Default system prompt for this agent - used as fallback if database config unavailable Subclasses should override this with their specific prompt

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:104*

---

### `unnamed`

System prompt for this agent - NOW LOADS FROM DATABASE Falls back to getDefaultSystemPrompt() if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:110*

---

### `unnamed`

Initialize database-driven config loader and tool executor Must be called with supabase client before using database features

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:123*

---

### `unnamed`

Load agent configuration from database Returns cached config if already loaded (5-min cache TTL in AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:136*

---

### `unnamed`

Get system prompt from database - async version Falls back to getDefaultSystemPrompt() if database unavailable

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:167*

---

### `unnamed`

Build complete system prompt from database config Combines persona, instructions, guardrails, and available tools

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:196*

---

### `unnamed`

Get available tools from database config

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:239*

---

### `unnamed`

Execute a tool by name using database-driven tool execution

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:247*

---

### `unnamed`

Get agent ID from database

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:295*

---

### `unnamed`

Helper to build conversation history from session NOW USES DATABASE-DRIVEN SYSTEM PROMPT

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:309*

---

### `unnamed`

Build conversation history with async database prompt loading

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:339*

---

### `unnamed`

Helper to update conversation history in session

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:373*

---

### `unnamed`

Helper to log agent interaction

*Source: supabase/functions/wa-webhook-ai-agents/core/base-agent.ts:412*

---

### `unnamed`

Unified AI Agent Orchestrator Single source of truth for all AI agent interactions Part of Unified AI Agent Architecture Created: 2025-11-27

*Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:1*

---

### `unnamed`

Main entry point - processes any message

*Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:34*

---

### `unnamed`

Intelligently determines which agent should handle the message

*Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:111*

---

### `unnamed`

Use AI to classify user intent

*Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:150*

---

### `unnamed`

Get AI provider (for agents that need direct access)

*Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:187*

---

### `unnamed`

Get agent registry (for testing/admin)

*Source: supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts:194*

---

### `unnamed`

Gemini AI Provider Unified AI provider using Google Gemini Part of Unified AI Agent Architecture Created: 2025-11-27

*Source: supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts:1*

---

### `unnamed`

Chat completion - main method for agent interactions

*Source: supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts:24*

---

### `unnamed`

Streaming chat (optional - for future use)

*Source: supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts:92*

---

### `unnamed`

Convert standard message format to Gemini format

*Source: supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts:159*

---

### `unnamed`

Session Manager Manages AI agent sessions and context Part of Unified AI Agent Architecture Created: 2025-11-27

*Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:1*

---

### `unnamed`

Get existing session or create new one

*Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:15*

---

### `unnamed`

Update session context

*Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:53*

---

### `unnamed`

Set current agent for session

*Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:73*

---

### `unnamed`

Clear current agent (back to home menu)

*Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:89*

---

### `unnamed`

End session

*Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:105*

---

### `unnamed`

Map database row to Session interface

*Source: supabase/functions/wa-webhook-ai-agents/core/session-manager.ts:121*

---

### `unnamed`

Sales AI Agent (Cold Caller) - Rebuilt with AI Core Uses Gemini 2.5 Pro + GPT-5 with shared tools

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/sales_agent.ts:1*

---

### `unnamed`

Execute sales agent with Gemini 2.5 Pro ReAct loop

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/sales_agent.ts:238*

---

### `runSalesAgent`

Run Sales Agent handler for wa-webhook

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/sales_agent.ts:336*

---

### `unnamed`

AI Agents Location Integration Helper Standard location integration for all AI agents in wa-webhook-ai-agents Provides unified location handling across jobs, farmer, business, waiter, and real estate agents Usage: ```typescript import { AgentLocationHelper } from './location-helper.ts'; const helper = new AgentLocationHelper(supabase); const location = await helper.resolveUserLocation(userId, 'jobs_agent'); if (!location) { await helper.promptForLocation(phone, locale, 'job_search'); return; } // Use location for search const results = await searchNearby(location.lat, location.lng); ```

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:1*

---

### `unnamed`

Resolve user location with standard priority logic Priority: Cache (30min) → Saved (home/work) → Prompt

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:97*

---

### `unnamed`

Save location to cache after user shares

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:188*

---

### `unnamed`

Prompt user to share location

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:220*

---

### `unnamed`

Format location context for display in agent responses

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:239*

---

### `unnamed`

Get nearby items using PostGIS search Generic helper for any table with lat/lng/geography columns

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:258*

---

### `createLocationAwareSearchTool`

Quick helper to add location-aware search to agent tools

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts:304*

---

### `unnamed`

Waiter AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for restaurant orders, menu queries, and reservations

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/waiter_agent.ts:1*

---

### `unnamed`

AI Agents Integration Module Connects database search agents with the WhatsApp webhook system. Agents search ONLY from database - NO web search or external APIs. All agents must have proper error handling and fallback messages.

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:1*

---

### `routeToAIAgent`

Route request to appropriate AI agent based on intent

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:40*

---

### `invokePropertyAgent`

Invoke Property Rental Agent - DATABASE SEARCH ONLY

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:90*

---

### `sendAgentOptions`

Send agent options to user as interactive list with fallback buttons

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:148*

---

### `handleAgentSelection`

Handle agent option selection with proper error handling

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:209*

---

### `checkAgentSessionStatus`

Check agent session status with proper error handling

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts:309*

---

### `unnamed`

Insurance AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for insurance quotes, claims, and policy management

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/insurance_agent.ts:1*

---

### `handleGeneralBrokerStart`

Start General Broker AI Agent Routes user to the general broker AI agent for service requests

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/general_broker.ts:6*

---

### `unnamed`

AI Agent Handlers for WhatsApp Flows Provides convenient handlers that can be called from the text router to initiate AI agent sessions for various use cases.

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:1*

---

### `unnamed`

Handle "Nearby Drivers" request with AI agent DATABASE SEARCH ONLY - No web search

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:28*

---

### `unnamed`

Handle "Nearby Pharmacies" request with AI agent

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:34*

---

### `unnamed`

Handle "Nearby Quincailleries" request with AI agent

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:39*

---

### `unnamed`

Handle "Nearby Shops" request with AI agent TWO-PHASE APPROACH: Phase 1: Immediately show top 9 nearby shops from database Phase 2: AI agent processes in background for curated shortlist

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:44*

---

### `handleAIPropertyRental`

Handle "Property Rental" request with AI agent

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:52*

---

### `unnamed`

Handle "Schedule Trip" request with AI agent

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:147*

---

### `handleAIAgentOptionSelection`

Handle AI agent selection from interactive list

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:152*

---

### `handleAIAgentLocationUpdate`

Handle location update for pending AI agent request

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:177*

---

### `unnamed`

Phase 2: Background AI agent processing for shops Agent contacts shops on behalf of user to create curated shortlist

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:201*

---

### `unnamed`

Phase 1: Send immediate database results (top 9 nearby shops) This provides instant results while AI agent processes in background

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts:207*

---

### `unnamed`

Business Broker AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for business discovery and recommendations

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/business_broker_agent.ts:1*

---

### `unnamed`

Rides AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for ride matching and transportation services

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/rides_agent.ts:1*

---

### `unnamed`

Farmer AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for agricultural services and marketplace

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/farmer_agent.ts:1*

---

### `unnamed`

AI Agents Module Central export point for all AI agent functionality in the WhatsApp webhook system.

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/index.ts:1*

---

### `unnamed`

Jobs AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for job matching and career guidance

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/jobs_agent.ts:1*

---

### `unnamed`

Real Estate AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro with vision for property search and viewings

*Source: supabase/functions/wa-webhook-ai-agents/ai-agents/real_estate_agent.ts:1*

---

### `unnamed`

Insurance AI Agent Handles motor insurance quotes, renewals, claims, and policy management Part of Unified AI Agent Architecture Created: 2025-12-01 DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/agents/insurance-agent.ts:1*

---

### `unnamed`

Default system prompt - fallback if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/agents/insurance-agent.ts:95*

---

### `unnamed`

Farmer AI Agent Handles agricultural support, market prices, crop advice Part of Unified AI Agent Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/agents/farmer-agent.ts:1*

---

### `unnamed`

Default system prompt - fallback if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/agents/farmer-agent.ts:95*

---

### `unnamed`

Rides AI Agent Handles transport services, ride-sharing, driver/passenger matching Part of Unified AI Agent Architecture Created: 2025-12-01 DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/agents/rides-agent.ts:1*

---

### `unnamed`

Default system prompt - fallback if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/agents/rides-agent.ts:95*

---

### `unnamed`

Jobs AI Agent Handles job search, posting, applications, gig work Part of Unified AI Agent Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/agents/jobs-agent.ts:1*

---

### `unnamed`

Default system prompt - fallback if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/agents/jobs-agent.ts:94*

---

### `unnamed`

Property AI Agent Handles rental property search, listings, inquiries Part of Unified AI Agent Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/agents/property-agent.ts:1*

---

### `unnamed`

Default system prompt - fallback if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/agents/property-agent.ts:94*

---

### `unnamed`

Support AI Agent General help, navigation, and customer support Part of Unified AI Agent Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/agents/support-agent.ts:1*

---

### `unnamed`

Default system prompt - fallback if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/agents/support-agent.ts:94*

---

### `unnamed`

Waiter AI Agent Handles restaurant/bar ordering, table booking, recommendations Part of Unified AI Agent Architecture Created: 2025-11-27 NOW DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/agents/waiter-agent.ts:1*

---

### `unnamed`

Default system prompt - fallback if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/agents/waiter-agent.ts:94*

---

### `unnamed`

Marketplace AI Agent Handles buying/selling products, business listings, shopping Part of Unified AI Agent Architecture Created: 2025-11-27 NOTE: This agent replaces the business_broker agent. The type is 'business_broker_agent' for backward compatibility but it maps to the 'marketplace' slug in the database. NOW DATABASE-DRIVEN: - System prompt loaded from ai_agent_system_instructions table - Persona loaded from ai_agent_personas table - Tools loaded from ai_agent_tools table (via AgentConfigLoader)

*Source: supabase/functions/wa-webhook-ai-agents/agents/marketplace-agent.ts:1*

---

### `unnamed`

Default system prompt - fallback if database config not available

*Source: supabase/functions/wa-webhook-ai-agents/agents/marketplace-agent.ts:97*

---

### `unnamed`

WA-Webhook-AI-Agents - Unified AI Agent System Single microservice for all AI-powered agents Part of Unified AI Agent Architecture Created: 2025-11-27

*Source: supabase/functions/wa-webhook-ai-agents/index.ts:1*

---

### `unnamed`

Notification Filters - Quiet Hours, Opt-out, and Policy Enforcement Ground Rules Compliance: Structured logging and security

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:1*

---

### `checkOptOut`

Check if contact has opted out of notifications

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:21*

---

### `checkQuietHours`

Check if current time is within contact's quiet hours

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:53*

---

### `calculateQuietHoursEnd`

Calculate when quiet hours end for a contact

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:105*

---

### `applyNotificationFilters`

Apply all notification filters

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:145*

---

### `maskWa`

Mask WhatsApp ID for logging (PII protection)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:173*

---

### `checkRateLimit`

Check if notification should be rate limited Simple implementation - can be enhanced with Redis

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:181*

---

### `ensureContactPreferences`

Initialize contact preferences if they don't exist

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/filters.ts:223*

---

### `unnamed`

Enhanced Notification Processing with Filters Integrates quiet hours, opt-out, and rate limiting Ground Rules Compliance: Structured logging, security, observability

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:1*

---

### `processNotificationWithFilters`

Process notification with filters before delivery Returns true if notification should be delivered, false if deferred/blocked

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:25*

---

### `handleFilterBlock`

Handle notification blocked by filters

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:66*

---

### `extractMetaErrorCode`

Extract Meta error code from WhatsApp API error response

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:151*

---

### `categorizeMetaError`

Categorize Meta error codes for retry logic

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:172*

---

### `calculateRateLimitBackoff`

Calculate backoff time for rate limit errors

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:204*

---

### `maskWa`

Mask WhatsApp ID for logging (PII protection)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:224*

---

### `getNotificationLocale`

Get preferred locale for notification

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:232*

---

### `logDeliveryMetrics`

Log notification delivery metrics by domain and message format

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/notify/processor.ts:258*

---

### `extractCountryCode`

Extract country code from phone number

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/exchange/country_support.ts:11*

---

### `checkCountrySupport`

Check if country supports a specific feature

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/exchange/country_support.ts:38*

---

### `getMomoProvider`

Get MOMO provider info for country

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/exchange/country_support.ts:127*

---

### `listSupportedCountries`

List all supported countries for a feature

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/exchange/country_support.ts:166*

---

### `showBusinessWhatsAppNumbers`

Display list of WhatsApp numbers for a business

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:19*

---

### `startAddWhatsAppNumber`

Start the flow to add a new WhatsApp number

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:95*

---

### `handleAddWhatsAppNumberText`

Handle text input for adding WhatsApp number

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:119*

---

### `handleWhatsAppNumberSelection`

Handle selection of a specific WhatsApp number (for future edit/delete)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:203*

---

### `maskPhoneNumber`

Mask phone number for display (show only last 4 digits)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:224*

---

### `formatDate`

Format date for display

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/whatsapp_numbers.ts:234*

---

### `showManageBusinesses`

Display list of businesses owned by the current user

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:41*

---

### `showBusinessDetail`

Show detail view for a specific business with management options

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:150*

---

### `handleBusinessDelete`

Handle business deletion with confirmation

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:254*

---

### `confirmBusinessDelete`

Confirm and execute business deletion

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:287*

---

### `handleBusinessSelection`

Handle business selection from the list

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/management.ts:335*

---

### `startBusinessClaim`

Start business claiming flow

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:40*

---

### `handleBusinessNameSearch`

Handle business name search with OpenAI semantic search

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:71*

---

### `handleBusinessClaim`

Handle business selection and claiming

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:175*

---

### `searchBusinessesSemantic`

OpenAI-powered semantic business search Uses embeddings and smart matching to find businesses

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:281*

---

### `searchBusinessesSimple`

Simple fallback search (no OpenAI)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:441*

---

### `searchBusinessesSmart`

Fuzzy/semantic business search (fast path)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:485*

---

### `claimBusiness`

Claim a business for the user

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:599*

---

### `createBusinessFromBar`

Create a business entry from a bars table record

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:654*

---

### `formatBusinessDescription`

Format business description for list display

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/business/claim.ts:720*

---

### `handleProfileMenu`

Profile Hub Unified entry point for managing: - Vehicles - Businesses - Properties - Tokens - Settings

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/profile/index.ts:12*

---

### `getProfileMenuItemId`

Map profile menu item action_targets to route IDs This ensures the router can handle actions from database-driven menu

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/profile/index.ts:160*

---

### `handleVehicleCertificateMedia`

Handle vehicle certificate media upload

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/profile/index.ts:270*

---

### `getLocalizedMenuName`

Get localized menu item name for a specific country

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:58*

---

### `fetchActiveMenuItems`

Fetch active menu items from database filtered by country Returns items with country-specific names applied

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:71*

---

### `normalizeMenuKey`

Normalize a menu key (legacy or canonical) to its canonical agent key.

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:150*

---

### `getMenuItemId`

Map menu item keys to IDS constants

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:159*

---

### `getMenuItemTranslationKeys`

Get translation key for menu item

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/domains/menu/dynamic_home_menu.ts:170*

---

### `normalizeMenuKey`

Normalizes a menu key to its canonical agent key

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/config/home_menu_aliases.ts:88*

---

### `isLegacyMenuKey`

Checks if a key is a legacy (aliased) key

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/config/home_menu_aliases.ts:95*

---

### `isCanonicalMenuKey`

Validates if a key is a canonical menu key

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/config/home_menu_aliases.ts:119*

---

### `unnamed`

Connection Pool Manager for Supabase Client Implements connection pooling to: - Reduce connection overhead - Improve performance - Manage connection lifecycle - Monitor pool health

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:1*

---

### `unnamed`

Initialize pool with minimum connections

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:71*

---

### `unnamed`

Create a new pooled connection

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:91*

---

### `unnamed`

Acquire a connection from the pool

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:138*

---

### `unnamed`

Release a connection back to the pool

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:188*

---

### `unnamed`

Execute operation with pooled connection

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:213*

---

### `unnamed`

Perform pool maintenance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:227*

---

### `unnamed`

Get pool statistics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:270*

---

### `unnamed`

Check pool health

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:287*

---

### `unnamed`

Destroy the pool

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:298*

---

### `unnamed`

Singleton pool instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:315*

---

### `withPooledConnection`

Helper function to execute with pooled connection

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/connection_pool.ts:327*

---

### `unnamed`

Streaming Response Handler for OpenAI Handles server-sent events (SSE) from OpenAI Chat Completions API Accumulates chunks and provides real-time updates ADDITIVE ONLY - New file, no modifications to existing code

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/streaming_handler.ts:1*

---

### `unnamed`

Stream chat completion responses Yields chunks as they arrive from OpenAI

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/streaming_handler.ts:42*

---

### `unnamed`

Accumulate full response from stream Useful when you want streaming internally but need the complete response

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/streaming_handler.ts:208*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/streaming_handler.ts:260*

---

### `unnamed`

Agent Context Builder Builds comprehensive context for AI agents from WhatsApp messages Extracts user profile, conversation history, and session state

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:1*

---

### `extractMessageContent`

Extract message content from different message types

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:115*

---

### `fetchUserProfile`

Fetch user profile from database

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:139*

---

### `fetchMessageHistory`

Fetch recent message history for context

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:174*

---

### `extractContentFromInteraction`

Extract content from stored interaction

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:229*

---

### `extractContentFromResponse`

Extract content from stored response

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:252*

---

### `saveAgentInteraction`

Save agent interaction to database

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_context.ts:267*

---

### `unnamed`

OpenAI Client for wa-webhook Provides OpenAI API integration with: - Chat completions with function calling - Streaming support - Token usage tracking - Cost calculation - Error handling & retries

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:1*

---

### `getErrorMessage`

Safely extract error message from unknown error

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:15*

---

### `unnamed`

Create chat completion

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:86*

---

### `unnamed`

Make HTTP request to OpenAI API

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:130*

---

### `unnamed`

Calculate API cost based on model and token usage

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:211*

---

### `unnamed`

Delay helper for retries

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:234*

---

### `unnamed`

Generate embeddings for text

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:241*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/openai_client.ts:290*

---

### `unnamed`

Comprehensive Error Handler for Webhook Provides error categorization, user notifications, and retry logic

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:1*

---

### `unnamed`

Handle error and return appropriate response

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:100*

---

### `unnamed`

Normalize error to WebhookError

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:124*

---

### `unnamed`

Log error with structured data

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:199*

---

### `unnamed`

Notify user via WhatsApp

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:216*

---

### `unnamed`

Create HTTP response

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:243*

---

### `unnamed`

Get error statistics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/error-handler.ts:279*

---

### `unnamed`

Response Formatting Utilities Helper methods for formatting agent responses with emoji-numbered lists and action buttons for chat-first architecture.

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:1*

---

### `formatAgentResponse`

Format agent response with emoji-numbered lists and action buttons

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:17*

---

### `extractOptionsFromText`

Extract options from response text

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:64*

---

### `extractHeaderFromText`

Extract header text before the list

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:102*

---

### `generateActionButtons`

Generate contextual action buttons based on agent type

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/response_formatter.ts:111*

---

### `unnamed`

Message Formatter Utilities Provides standardized formatting for AI agent chat messages including: - Emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) - Action buttons - User selection parsing - Fallback flow detection

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:1*

---

### `formatEmojiList`

Format options as emoji-numbered list

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:49*

---

### `parseEmojiSelection`

Parse user's emoji selection from message Supports multiple formats: - Numbers: "1", "2", "3" - Emojis: "1️⃣", "2️⃣", "3️⃣" - Text: "one", "two", "three", "first", "second" - Phrases: "option 1", "number 2", "the first one"

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:82*

---

### `formatMessageWithButtons`

Format message with action buttons

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:148*

---

### `shouldUseFallbackFlow`

Detect if message should trigger fallback to WhatsApp flow

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:176*

---

### `createListMessage`

Create a formatted list message with emoji numbers and action buttons

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:224*

---

### `validateActionButtons`

Validate action button configuration Ensures buttons meet WhatsApp requirements

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:268*

---

### `extractOptionsMetadata`

Extract option metadata from formatted list Useful for tracking what options were presented

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:283*

---

### `isSelectionMessage`

Check if user message is a valid selection from previous options

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:299*

---

### `getSelectionHelpText`

Generate help text for emoji selection

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/message_formatter.ts:318*

---

### `unnamed`

WhatsApp-Specific Tools for AI Agents Provides tools that agents can use to interact with WhatsApp Business API and EasyMO backend services ADDITIVE ONLY - New tools for agent system

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:1*

---

### `unnamed`

Register default tools

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:39*

---

### `unnamed`

Register a tool

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:623*

---

### `unnamed`

Get tool definition for OpenAI format

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:630*

---

### `unnamed`

Execute a tool

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:647*

---

### `unnamed`

Get all registered tools

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:687*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/whatsapp_tools.ts:695*

---

### `unnamed`

Agent Orchestrator Central hub for managing multiple specialized agents Routes messages to appropriate agents based on intent Handles agent-to-agent handoffs and conversation state ADDITIVE ONLY - New file, complements existing ai_agent_handler.ts

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:1*

---

### `unnamed`

Initialize default agent configurations

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:75*

---

### `unnamed`

Register an agent configuration

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:90*

---

### `unnamed`

Classify user intent and select appropriate agent

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:97*

---

### `unnamed`

Use LLM to classify intent

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:134*

---

### `unnamed`

Process message with selected agent

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:181*

---

### `unnamed`

Build message history for agent

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:303*

---

### `unnamed`

Get tools available for agent

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:354*

---

### `unnamed`

Extract topic from message

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:370*

---

### `unnamed`

Transfer conversation to different agent

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:394*

---

### `unnamed`

End conversation and cleanup

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:406*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_orchestrator.ts:441*

---

### `unnamed`

Advanced Rate Limiter with Blacklisting Provides per-user rate limiting, violation tracking, and blacklist management

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:1*

---

### `unnamed`

Check if request should be rate limited

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:42*

---

### `unnamed`

Manually unblock an identifier

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:130*

---

### `unnamed`

Get current state for monitoring

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:142*

---

### `unnamed`

Check health

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:157*

---

### `unnamed`

Clean up expired buckets

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/rate-limiter.ts:164*

---

### `unnamed`

Agent Configurations Centralized configurations for all AI agents in the EasyMO platform. Each agent has a chat-first interface with emoji-numbered lists and action buttons.

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_configs.ts:1*

---

### `unnamed`

Simple In-Memory Cache for Webhook Processing Provides TTL-based caching with LRU eviction

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:1*

---

### `unnamed`

Get value from cache

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:44*

---

### `unnamed`

Set value in cache

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:67*

---

### `unnamed`

Get or set value

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:90*

---

### `unnamed`

Delete from cache

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:108*

---

### `unnamed`

Clear all cache

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:119*

---

### `unnamed`

Evict least recently used entry

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:129*

---

### `unnamed`

Clean up expired entries

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:151*

---

### `unnamed`

Get cache statistics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:175*

---

### `unnamed`

Check if cache is healthy

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/cache.ts:186*

---

### `unnamed`

AI Agent Configuration Centralized configuration for all AI agent features Allows feature flags and dynamic configuration

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/ai_agent_config.ts:1*

---

### `getAIAgentConfig`

Get AI agent configuration Can be overridden by database settings or environment variables

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/ai_agent_config.ts:266*

---

### `validateAIAgentConfig`

Validate configuration

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/ai_agent_config.ts:288*

---

### `getAgentTypeConfig`

Get agent-specific configuration

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/ai_agent_config.ts:310*

---

### `unnamed`

Health & Metrics Endpoint for AI Agents Provides: - Health check status - Aggregated metrics - System diagnostics - Configuration status ADDITIVE ONLY - New endpoints for monitoring

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:1*

---

### `getHealthStatus`

Check overall system health

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:42*

---

### `checkDatabaseHealth`

Check database health

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:93*

---

### `getDetailedMetrics`

Get detailed metrics for monitoring

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:109*

---

### `handleHealthCheck`

Handle health check request

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:127*

---

### `handleMetricsRequest`

Handle metrics request

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:168*

---

### `handleMetricsSummaryRequest`

Handle metrics summary request (plain text)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:198*

---

### `handlePrometheusMetrics`

Handle Prometheus-style metrics export

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/health_metrics.ts:221*

---

### `unnamed`

Advanced Rate Limiter with Blacklisting Features: - Per-user rate limiting - Automatic blacklisting for abuse - Violation tracking - Exponential backoff - Redis-backed (future enhancement)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:1*

---

### `unnamed`

Check if request should be rate limited

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:62*

---

### `unnamed`

Manually unblock an identifier

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:172*

---

### `unnamed`

Get current state for monitoring

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:187*

---

### `unnamed`

Check health

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:207*

---

### `unnamed`

Clean up expired buckets and blacklist entries

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:217*

---

### `unnamed`

Destroy the rate limiter

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:251*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/advanced_rate_limiter.ts:266*

---

### `unnamed`

AI Agent Monitoring & Metrics Collection Comprehensive monitoring system for AI agent performance, cost tracking, and quality metrics ADDITIVE ONLY - New file

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:1*

---

### `unnamed`

Record metrics for an agent interaction

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:104*

---

### `unnamed`

Get aggregated metrics for a time period

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:158*

---

### `unnamed`

Calculate aggregations from raw metrics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:193*

---

### `unnamed`

Get empty aggregated metrics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:320*

---

### `unnamed`

Check for alert conditions

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:353*

---

### `unnamed`

Get real-time statistics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:402*

---

### `createMonitoringService`

Create monitoring service instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/monitoring.ts:453*

---

### `unnamed`

Enhanced Tool Library with External APIs Provides additional tools for AI agents: - Web search (Tavily API) - Deep research (Perplexity API) - Weather information - Currency conversion - Translation

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/enhanced_tools.ts:1*

---

### `getErrorMessage`

Safely extract error message from unknown error

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/enhanced_tools.ts:15*

---

### `getEnhancedTools`

Get all enhanced tools

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/enhanced_tools.ts:351*

---

### `registerEnhancedTools`

Register all enhanced tools with a tool manager

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/enhanced_tools.ts:363*

---

### `getAIAgentConfig`

Get AI Agent configuration from environment

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:56*

---

### `validateAIConfig`

Validate configuration

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:113*

---

### `getConfigSummary`

Get configuration summary for logging

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:157*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:185*

---

### `resetConfig`

Reset configuration (for testing)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/config_manager.ts:204*

---

### `unnamed`

Memory Manager for AI Agents Manages conversation memory using: - Short-term: Recent messages from wa_interactions table - Working memory: Session state - Long-term: Important facts stored in agent_conversations ENHANCED: Added caching layer for performance optimization

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:1*

---

### `getErrorMessage`

Safely extract error message from unknown error

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:18*

---

### `unnamed`

Get recent conversation history for a user ENHANCED: Added caching layer

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:52*

---

### `unnamed`

Save important information to long-term memory with embeddings

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:144*

---

### `unnamed`

Retrieve relevant memories using semantic search

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:196*

---

### `unnamed`

Calculate importance score for content

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:249*

---

### `unnamed`

Summarize conversation using OpenAI

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:280*

---

### `unnamed`

Save message interaction to memory

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:344*

---

### `unnamed`

Store important facts in agent_conversations for long-term memory

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:379*

---

### `unnamed`

Get conversation summary for a user

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:415*

---

### `unnamed`

Clear old conversation history (privacy/GDPR)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:457*

---

### `unnamed`

Extract message content from various formats

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:495*

---

### `unnamed`

Extract important information from conversation

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:498*

---

### `unnamed`

Clear old conversation history (privacy/GDPR)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:571*

---

### `unnamed`

Extract message content from various formats

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:609*

---

### `unnamed`

Extract response content from various formats

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:632*

---

### `unnamed`

Build context string from recent messages

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:647*

---

### `createMemoryManager`

Create memory manager instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/memory_manager.ts:671*

---

### `unnamed`

Agent Session Management Functions for tracking and managing agent chat sessions. Sessions track conversation state, presented options, and user selections.

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:1*

---

### `getAgentChatSession`

Get active agent chat session for user by phone number

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:26*

---

### `getAgentChatSessionByUserId`

Get active agent chat session for user by user ID

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:69*

---

### `saveAgentChatSession`

Save or update agent chat session

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:101*

---

### `updateSessionSelection`

Update session with user selection

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:182*

---

### `triggerSessionFallback`

Trigger fallback for session

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:211*

---

### `clearAgentChatSession`

Clear agent chat session

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:244*

---

### `clearUserSessions`

Clear all sessions for a user

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:269*

---

### `getSessionStats`

Get session statistics for monitoring

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/agent_session.ts:294*

---

### `unnamed`

Enhanced Webhook Verification with Security Features Provides signature verification, caching, and timing-safe comparison

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:1*

---

### `unnamed`

Verify WhatsApp webhook signature with caching

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:29*

---

### `unnamed`

Handle WhatsApp verification challenge

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:103*

---

### `unnamed`

Timing-safe string comparison

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:128*

---

### `unnamed`

Hash payload for cache key

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:144*

---

### `unnamed`

Cleanup expired cache entries

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:154*

---

### `unnamed`

Get verification statistics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/webhook-verification.ts:166*

---

### `unnamed`

Tool Manager for AI Agents Manages tool definitions and execution for OpenAI function calling Provides built-in tools for common operations: - check_wallet_balance - search_trips - create_booking - transfer_money - get_user_profile

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:1*

---

### `getErrorMessage`

Safely extract error message from unknown error

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:17*

---

### `unnamed`

Register built-in tools

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:53*

---

### `unnamed`

Register a custom tool

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:144*

---

### `unnamed`

Get all tool definitions for OpenAI

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:151*

---

### `unnamed`

Execute a tool call

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:161*

---

### `unnamed`

Execute multiple tool calls

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:249*

---

### `unnamed`

Save tool execution to database

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:262*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/tool_manager.ts:439*

---

### `unnamed`

Metrics Aggregator for AI Agents Collects and aggregates metrics for monitoring: - Request counts - Success/failure rates - Token usage & costs - Latency statistics - Tool execution metrics ADDITIVE ONLY - New file for enhanced monitoring

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:1*

---

### `unnamed`

Record a request

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:76*

---

### `unnamed`

Get aggregated metrics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:121*

---

### `unnamed`

Get metrics summary for logging

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:164*

---

### `unnamed`

Reset metrics (for testing)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:185*

---

### `unnamed`

Cleanup resources

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:205*

---

### `unnamed`

Add metrics to hourly bucket

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:214*

---

### `unnamed`

Get last hour statistics

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:238*

---

### `unnamed`

Cleanup old hourly buckets (keep last 24 hours)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:262*

---

### `unnamed`

Check if metrics cross important thresholds

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:273*

---

### `unnamed`

Format duration in human-readable form

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:305*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:322*

---

### `resetMetrics`

Reset metrics (for testing)

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/shared/metrics_aggregator.ts:334*

---

### `unnamed`

Example: Integrating Enhanced Processor into wa-webhook This example shows how to integrate the enhanced processor into the existing wa-webhook handler. USAGE: 1. Import this in your index.ts 2. Set WA_ENHANCED_PROCESSING=true in environment 3. Monitor with health checks

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/integration-example.ts:1*

---

### `unnamed`

ALTERNATIVE: Gradual Rollout by User You can enable enhanced processing for specific users first:

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/integration-example.ts:125*

---

### `unnamed`

Enhanced Webhook Processor with Advanced Error Recovery This module extends the existing wa-webhook processor with: - Dead letter queue for failed messages - Conversation-level distributed locking - Timeout protection - Enhanced error recovery Can be enabled via WA_ENHANCED_PROCESSING environment variable.

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts:1*

---

### `handlePreparedWebhookEnhanced`

Enhanced webhook processing wrapper Adds DLQ, locking, and timeout protection to existing processor

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts:34*

---

### `processMessageEnhanced`

Process individual message with enhanced features

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts:147*

---

### `isEnhancedProcessingEnabled`

Get feature flag status

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/enhanced_processor.ts:253*

---

### `unnamed`

AI Agent Handler Routes WhatsApp messages to AI agents for intelligent processing Falls back to existing handlers if AI is not applicable This handler respects the additive-only guards by: - Being a completely new file - Not modifying existing handlers - Providing fallback to existing flows

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:1*

---

### `unnamed`

Singleton rate limiter instance

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:49*

---

### `isAIEligibleMessage`

Determines if a message should be processed by AI agents

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:90*

---

### `tryAIAgentHandler`

Try to handle message with AI agent Returns true if handled, false if should fallback to existing handlers

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:110*

---

### `processWithAIAgent`

Process message with AI agent using orchestrator Enhanced with full OpenAI integration and specialized agents

*Source: supabase/functions/.archive/wa-webhook-legacy-20251124/router/ai_agent_handler.ts:434*

---

### `unnamed`

Search Indexer Edge Function Automatically indexes content from various domains for semantic search Triggered by: - Database triggers on insert/update - Manual indexing requests - Scheduled batch jobs

*Source: supabase/functions/search-indexer/index.ts:1*

---

### `unnamed`

WA-Webhook-Jobs Microservice Handles WhatsApp webhook events for the Job Board domain. Part of Phase 2 webhook decomposition strategy. Features: - Job listings search - Job applications - Job alerts - Employer postings - Job categories

*Source: supabase/functions/wa-webhook-jobs/index.ts:1*

---

### `handleHealthCheck`

Health check handler - verifies database connectivity and table access

*Source: supabase/functions/wa-webhook-jobs/index.ts:294*

---

### `showJobBoardMenu`

Show job board menu with WhatsApp list message

*Source: supabase/functions/wa-webhook-jobs/index.ts:359*

---

### `handleMyApplications`

Handle my applications query

*Source: supabase/functions/wa-webhook-jobs/index.ts:395*

---

### `handleMyJobs`

Handle my posted jobs query

*Source: supabase/functions/wa-webhook-jobs/index.ts:455*

---

### `handleJobAgentQuery`

Route complex queries to job-board-ai-agent

*Source: supabase/functions/wa-webhook-jobs/index.ts:498*

---

### `extractInput`

Extract text/selection from WhatsApp message

*Source: supabase/functions/wa-webhook-jobs/index.ts:542*

---

### `getFirstMessage`

Get first message from webhook payload

*Source: supabase/functions/wa-webhook-jobs/index.ts:569*

---

### `detectLocale`

Detect user locale from payload

*Source: supabase/functions/wa-webhook-jobs/index.ts:580*

---

### `isMenuTrigger`

Check if text is a menu trigger

*Source: supabase/functions/wa-webhook-jobs/index.ts:595*

---

### `maskPhone`

Mask phone number for logging (privacy)

*Source: supabase/functions/wa-webhook-jobs/index.ts:603*

---

### `unnamed`

Job Applications Module Handles job application flow: - Apply to jobs - Track application status - Prevent duplicates - Employer notifications Audit Gap: Job application flow was missing (30% → 100%)

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:1*

---

### `getApplyButtonId`

Generate apply button ID for a job

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:30*

---

### `extractJobIdFromApply`

Extract job ID from apply button selection

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:37*

---

### `checkExistingApplication`

Check if user has already applied to this job

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:45*

---

### `isSelfApplication`

Check if user is trying to apply to their own job

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:63*

---

### `handleJobApplication`

Initiate job application process Called when user taps "Apply Now" button

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:79*

---

### `handleJobApplyMessage`

Handle cover message submission

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:169*

---

### `notifyEmployer`

Notify employer of new application

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:239*

---

### `showMyApplications`

Show user's application history

*Source: supabase/functions/wa-webhook-jobs/jobs/applications.ts:281*

---

### `showJobBoardMenu`

Show job board main menu

*Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:203*

---

### `startJobSearch`

Start job search conversation (job seeker)

*Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:261*

---

### `startJobPosting`

Start job posting conversation (job poster)

*Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:286*

---

### `handleJobBoardText`

Handle ongoing job board conversation Routes user messages to the job-board-ai-agent edge function

*Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:977*

---

### `showMyApplications`

Show user's job applications

*Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:1061*

---

### `startMyJobsMenu`

Show user's posted jobs

*Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:1149*

---

### `handleJobTextMessage`

Main text message router Handles state-based routing for text messages

*Source: supabase/functions/wa-webhook-jobs/jobs/index.ts:1277*

---

### `unnamed`

Job Seeker Profile Module Handles job seeker profile creation and onboarding: - 3-step onboarding (skills → locations → experience) - Profile retrieval and creation - Profile updates Audit Gap: Profile management was 20% → Now 100%

*Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:1*

---

### `getOrCreateSeeker`

Get existing seeker profile or initiate onboarding Returns null if onboarding started (not completed yet)

*Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:35*

---

### `startSeekerOnboarding`

Start seeker profile onboarding

*Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:60*

---

### `handleSeekerOnboardingStep`

Handle onboarding step input

*Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:89*

---

### `handleSkillsStep`

Handle skills input (Step 1)

*Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:124*

---

### `handleLocationsStep`

Handle locations input (Step 2)

*Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:170*

---

### `handleExperienceStep`

Handle experience input (Step 3 - Final)

*Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:216*

---

### `updateSeekerProfile`

Update seeker profile

*Source: supabase/functions/wa-webhook-jobs/jobs/seeker-profile.ts:296*

---

### `unnamed`

Location Message Handler for Jobs Service Handles WhatsApp location messages and integrates with: - 30-minute location cache - Saved locations (home/work) - GPS-based job search

*Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:1*

---

### `parseWhatsAppLocation`

Parse WhatsApp location message

*Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:25*

---

### `handleLocationMessage`

Handle location message for jobs service Flow: 1. Parse location from WhatsApp message 2. Save to 30-minute cache 3. Search nearby jobs 4. Send results to user

*Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:52*

---

### `searchAndSendNearbyJobs`

Search for nearby jobs and send results to user

*Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:129*

---

### `getUserLocation`

Get user location from cache or saved locations Returns null if no location available

*Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:225*

---

### `promptForLocation`

Prompt user to share location

*Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:296*

---

### `maskPhone`

Mask phone for logging (privacy)

*Source: supabase/functions/wa-webhook-jobs/handlers/location-handler.ts:311*

---

### `showJobBoardMenu`

Show job board main menu

*Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:30*

---

### `startJobSearch`

Start job search conversation (job seeker)

*Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:86*

---

### `startJobPosting`

Start job posting conversation (job poster)

*Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:115*

---

### `handleJobBoardText`

Handle ongoing job board conversation Routes user messages to the job-board-ai-agent edge function

*Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:145*

---

### `showMyApplications`

Show user's job applications

*Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:229*

---

### `showMyJobs`

Show user's posted jobs

*Source: supabase/functions/wa-webhook-jobs/handlers/jobs-handler.ts:300*

---

### `handleHealthCheck`

Comprehensive health check for wa-webhook-jobs service. Verifies connectivity to all job-related tables.

*Source: supabase/functions/wa-webhook-jobs/handlers/health.ts:11*

---

### `searchBusinessDirectory`

Search business directory using Gemini API directly Gets real-time results from Google Maps via Gemini

*Source: supabase/functions/agent-tools-general-broker/index.ts:515*

---

### `searchBusinessByLocation`

Search businesses by geographic location using Gemini Finds businesses near a specific location via Google Maps

*Source: supabase/functions/agent-tools-general-broker/index.ts:550*

---

### `getBusinessDetails`

Get detailed information about a specific business Note: Since we're not storing businesses, this searches by name

*Source: supabase/functions/agent-tools-general-broker/index.ts:578*

---

### `searchBusinessViaGemini`

Search businesses via Gemini API with Google Maps grounding Uses Google Maps tool to get real-time business data

*Source: supabase/functions/agent-tools-general-broker/index.ts:600*

---

### `searchBusinessViaGeminiWithLocation`

Search businesses via Gemini API with location context and Google Maps grounding

*Source: supabase/functions/agent-tools-general-broker/index.ts:705*

---

### `calculateDistance`

Calculate distance between two points using Haversine formula

*Source: supabase/functions/agent-tools-general-broker/index.ts:789*

---

### `unnamed`

Marketplace Payment Module Handles USSD-based MoMo payments for marketplace transactions. Uses tap-to-dial tel: links for seamless mobile payment experience. Payment Flow: 1. Buyer expresses interest in listing 2. System creates transaction record 3. Sends USSD link to buyer (tel:*182*8*1*MERCHANT*AMOUNT#) 4. Buyer taps link → dials USSD → completes MoMo payment 5. Buyer confirms payment in chat 6. Seller confirms receipt 7. Transaction marked complete

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:1*

---

### `generateMoMoUssd`

Generate USSD code for MoMo merchant payment

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:86*

---

### `createTelLink`

Create tap-to-dial tel: link Note: Keep unencoded for better Android compatibility

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:94*

---

### `formatUssdDisplay`

Format USSD code for display (user-friendly)

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:102*

---

### `initiatePayment`

Initiate a payment transaction

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:113*

---

### `buyerConfirmPayment`

Buyer confirms they've completed payment

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:273*

---

### `sellerConfirmPayment`

Seller confirms they've received payment

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:355*

---

### `cancelTransaction`

Cancel a transaction

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:458*

---

### `getTransactionDetails`

Get transaction details

*Source: supabase/functions/wa-webhook-marketplace/payment.ts:522*

---

### `unnamed`

Marketplace AI Agent Natural language AI agent for connecting buyers and sellers in Rwanda. Uses Gemini for intent recognition, entity extraction, and conversational flow. Features: - Intent classification (selling, buying, inquiry) - Entity extraction (product, price, location, attributes) - Conversation state management - Proximity-based matching

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:1*

---

### `unnamed`

Process a marketplace message and generate response

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:154*

---

### `unnamed`

Handle specific actions based on AI response

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:304*

---

### `unnamed`

Create a new listing

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:367*

---

### `unnamed`

Search for matching listings and businesses

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:427*

---

### `unnamed`

Format search results for WhatsApp message

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:497*

---

### `unnamed`

Notify matching buyers when a new listing is created

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:532*

---

### `unnamed`

Update conversation state in database

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:594*

---

### `unnamed`

Filter out null values from an object

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:638*

---

### `unnamed`

Load conversation state from database

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:649*

---

### `unnamed`

Reset conversation state

*Source: supabase/functions/wa-webhook-marketplace/agent.ts:687*

---

### `initiateMoMoPayment`

Initiate USSD-based Mobile Money payment Generates a USSD dial string and sends as clickable link

*Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:17*

---

### `generateMoMoUSSD`

Generate MTN Mobile Money USSD code Rwanda format: *182*8*1*amount*recipientPhone# For direct transfer to seller

*Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:101*

---

### `handlePaymentConfirmation`

Handle payment confirmation from user User manually confirms after completing USSD payment

*Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:119*

---

### `processPaymentReference`

Process payment reference submission

*Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:187*

---

### `markPaymentAsSuccess`

Mark payment as successful and notify both parties

*Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:261*

---

### `getTransactionStatus`

Get transaction status

*Source: supabase/functions/wa-webhook-marketplace/marketplace/payment.ts:336*

---

### `unnamed`

Marketplace Domain Handler Re-exports the AI agent and database operations for the marketplace domain. This module provides a unified interface for marketplace functionality.

*Source: supabase/functions/wa-webhook-marketplace/marketplace/index.ts:1*

---

### `getMarketplaceStatus`

Get marketplace feature status

*Source: supabase/functions/wa-webhook-marketplace/marketplace/index.ts:25*

---

### `unnamed`

Marketplace Utility Functions Location parsing, formatting, and notification utilities.

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:1*

---

### `parseWhatsAppLocation`

Parse location from WhatsApp location message

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:36*

---

### `parseLocationFromText`

Parse location from text (city/area names in Rwanda)

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:55*

---

### `calculateDistance`

Calculate distance between two points (Haversine formula)

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:112*

---

### `formatPrice`

Format price with currency

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:138*

---

### `formatDistance`

Format distance

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:151*

---

### `formatRating`

Format rating as stars

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:161*

---

### `formatListing`

Format listing for WhatsApp message

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:170*

---

### `formatBusiness`

Format business for WhatsApp message

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:204*

---

### `extractWhatsAppMessage`

Extract WhatsApp message from webhook payload

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:242*

---

### `buildBuyerNotification`

Build notification message for matching buyers

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:297*

---

### `buildSellerNotification`

Build notification message for sellers

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:314*

---

### `parsePriceFromText`

Parse price from text

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:334*

---

### `isValidPhone`

Validate phone number format

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:354*

---

### `normalizePhone`

Normalize phone number to international format

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:363*

---

### `maskPhone`

Mask phone number for logging (PII protection)

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:381*

---

### `logMarketplaceEvent`

Log marketplace event with masked PII

*Source: supabase/functions/wa-webhook-marketplace/utils/index.ts:389*

---

### `unnamed`

Payment Handler for Marketplace Integrates payment flow with the AI agent and WhatsApp conversation. Handles text-based payment commands and transaction state management.

*Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:1*

---

### `isPaymentCommand`

Check if message is a payment-related command

*Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:24*

---

### `handlePaymentCommand`

Handle payment-related commands

*Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:42*

---

### `showTransactionStatus`

Show user's transaction status

*Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:173*

---

### `handlePurchaseIntent`

Handle purchase intent from search results

*Source: supabase/functions/wa-webhook-marketplace/payment-handler.ts:218*

---

### `unnamed`

Marketplace Database Operations CRUD operations for marketplace listings, intents, and conversations.

*Source: supabase/functions/wa-webhook-marketplace/db/index.ts:1*

---

### `unnamed`

Marketplace AI Agent Webhook Handler Natural language AI agent for connecting buyers and sellers in Rwanda via WhatsApp. Features: - Conversational selling flow (create listings) - Conversational buying flow (search and match) - Proximity-based matching - Integration with business directory

*Source: supabase/functions/wa-webhook-marketplace/index.ts:1*

---

### `unnamed`

Media Upload Handler for Marketplace Handles photo uploads from WhatsApp messages for marketplace listings.

*Source: supabase/functions/wa-webhook-marketplace/media.ts:1*

---

### `downloadWhatsAppMedia`

Download media from WhatsApp servers

*Source: supabase/functions/wa-webhook-marketplace/media.ts:23*

---

### `uploadToStorage`

Upload image to Supabase Storage

*Source: supabase/functions/wa-webhook-marketplace/media.ts:76*

---

### `handleMediaUpload`

Handle media upload from WhatsApp message

*Source: supabase/functions/wa-webhook-marketplace/media.ts:114*

---

### `ensureStorageBucket`

Create storage bucket if it doesn't exist

*Source: supabase/functions/wa-webhook-marketplace/media.ts:217*

---

### `startNegotiation`

Start a new negotiation session

*Source: supabase/functions/agent-negotiation/index.ts:53*

---

### `findAndContactDrivers`

Find matching drivers and send quote requests

*Source: supabase/functions/agent-negotiation/index.ts:136*

---

### `findAndContactNearbyVendors`

Find matching vendors (pharmacy/quincaillerie/shops) and send quote requests

*Source: supabase/functions/agent-negotiation/index.ts:227*

---

### `addQuote`

Add a quote from a vendor

*Source: supabase/functions/agent-negotiation/index.ts:319*

---

### `getStatus`

Get session status

*Source: supabase/functions/agent-negotiation/index.ts:393*

---

### `completeNegotiation`

Complete negotiation with selected quote

*Source: supabase/functions/agent-negotiation/index.ts:441*

---

### `unnamed`

Main handler

*Source: supabase/functions/agent-negotiation/index.ts:500*

---

### `verifyHmacSignature`

HMAC-SHA256 signature verification for MomoTerminal webhooks

*Source: supabase/functions/momo-sms-webhook/utils/hmac.ts:1*

---

### `unnamed`

MomoTerminal SMS Webhook Handler Receives Mobile Money SMS from MomoTerminal Android app Routes to appropriate service matchers (rides, marketplace, jobs, insurance) Ground Rules Compliance: - Structured logging with correlation IDs - PII masking for phone numbers - HMAC signature verification - Rate limiting

*Source: supabase/functions/momo-sms-webhook/index.ts:1*

---

### `unnamed`

Marketplace Payment Matcher Matches MoMo SMS to pending marketplace orders

*Source: supabase/functions/momo-sms-webhook/matchers/marketplace.ts:1*

---

### `unnamed`

Rides Payment Matcher Matches MoMo SMS to pending ride payments

*Source: supabase/functions/momo-sms-webhook/matchers/rides.ts:1*

---

### `unnamed`

Jobs Payment Matcher Matches MoMo SMS to job-related payments

*Source: supabase/functions/momo-sms-webhook/matchers/jobs.ts:1*

---

### `unnamed`

Insurance Payment Matcher Matches MoMo SMS to insurance premium payments

*Source: supabase/functions/momo-sms-webhook/matchers/insurance.ts:1*

---

### `unnamed`

Property Rentals Flow User flow: Option A - Add Property: Collect criteria → Save to DB (NO AI) Option B - Find Property: Collect search criteria → AI Agent

*Source: supabase/functions/wa-webhook-property/property/rentals.ts:1*

---

### `handlePropertyAIChat`

Handle conversational AI agent chat for property rentals

*Source: supabase/functions/wa-webhook-property/property/rentals.ts:783*

---

### `startPropertyAISearch`

Start property search with AI Agent

*Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:17*

---

### `handlePropertySearchCriteria`

Handle property search criteria input

*Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:98*

---

### `executePropertyAISearch`

Execute property search with location

*Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:166*

---

### `addPropertyViaAI`

Add property listing via AI Agent

*Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:284*

---

### `clearPropertySearchState`

Clear property search state

*Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:329*

---

### `hasActivePropertySearch`

Check if user has active property search

*Source: supabase/functions/wa-webhook-property/property/ai_agent.ts:350*

---

### `showMyProperties`

Show user's own property listings

*Source: supabase/functions/wa-webhook-property/property/my_listings.ts:13*

---

### `handlePropertyDetailView`

Show details of a specific property

*Source: supabase/functions/wa-webhook-property/property/my_listings.ts:84*

---

### `handlePropertyActions`

Handle property actions (edit, delete, mark rented)

*Source: supabase/functions/wa-webhook-property/property/my_listings.ts:146*

---

### `sendPropertyInquiry`

Send inquiry to property owner

*Source: supabase/functions/wa-webhook-property/property/my_listings.ts:239*

---

### `promptInquiryMessage`

Prompt for inquiry message

*Source: supabase/functions/wa-webhook-property/property/my_listings.ts:322*

---

### `handleInquiryMessage`

Handle inquiry message input

*Source: supabase/functions/wa-webhook-property/property/my_listings.ts:344*

---

### `cachePropertyLocation`

Save user's shared location to cache (30-minute TTL) Allows reusing location across property searches without re-sharing

*Source: supabase/functions/wa-webhook-property/index.ts:396*

---

### `unnamed`

Property Location Handler Integrates location caching and saved locations for property search

*Source: supabase/functions/wa-webhook-property/handlers/location-handler.ts:1*

---

### `resolvePropertyLocation`

Resolve user location with priority: cache → saved home → prompt

*Source: supabase/functions/wa-webhook-property/handlers/location-handler.ts:20*

---

### `cachePropertyLocation`

Save shared location to cache

*Source: supabase/functions/wa-webhook-property/handlers/location-handler.ts:117*

---

### `formatLocationContext`

Format location context message for user

*Source: supabase/functions/wa-webhook-property/handlers/location-handler.ts:149*

---

### `unnamed`

Notification Filters - Quiet Hours, Opt-out, and Policy Enforcement Ground Rules Compliance: Structured logging and security

*Source: supabase/functions/wa-webhook/notify/filters.ts:1*

---

### `checkOptOut`

Check if contact has opted out of notifications

*Source: supabase/functions/wa-webhook/notify/filters.ts:21*

---

### `checkQuietHours`

Check if current time is within contact's quiet hours

*Source: supabase/functions/wa-webhook/notify/filters.ts:53*

---

### `calculateQuietHoursEnd`

Calculate when quiet hours end for a contact

*Source: supabase/functions/wa-webhook/notify/filters.ts:105*

---

### `applyNotificationFilters`

Apply all notification filters

*Source: supabase/functions/wa-webhook/notify/filters.ts:145*

---

### `maskWa`

Mask WhatsApp ID for logging (PII protection)

*Source: supabase/functions/wa-webhook/notify/filters.ts:173*

---

### `checkRateLimit`

Check if notification should be rate limited Simple implementation - can be enhanced with Redis

*Source: supabase/functions/wa-webhook/notify/filters.ts:181*

---

### `ensureContactPreferences`

Initialize contact preferences if they don't exist

*Source: supabase/functions/wa-webhook/notify/filters.ts:223*

---

### `unnamed`

Enhanced Notification Processing with Filters Integrates quiet hours, opt-out, and rate limiting Ground Rules Compliance: Structured logging, security, observability

*Source: supabase/functions/wa-webhook/notify/processor.ts:1*

---

### `processNotificationWithFilters`

Process notification with filters before delivery Returns true if notification should be delivered, false if deferred/blocked

*Source: supabase/functions/wa-webhook/notify/processor.ts:25*

---

### `handleFilterBlock`

Handle notification blocked by filters

*Source: supabase/functions/wa-webhook/notify/processor.ts:66*

---

### `extractMetaErrorCode`

Extract Meta error code from WhatsApp API error response

*Source: supabase/functions/wa-webhook/notify/processor.ts:151*

---

### `categorizeMetaError`

Categorize Meta error codes for retry logic

*Source: supabase/functions/wa-webhook/notify/processor.ts:172*

---

### `calculateRateLimitBackoff`

Calculate backoff time for rate limit errors

*Source: supabase/functions/wa-webhook/notify/processor.ts:204*

---

### `maskWa`

Mask WhatsApp ID for logging (PII protection)

*Source: supabase/functions/wa-webhook/notify/processor.ts:224*

---

### `getNotificationLocale`

Get preferred locale for notification

*Source: supabase/functions/wa-webhook/notify/processor.ts:232*

---

### `logDeliveryMetrics`

Log notification delivery metrics by domain and message format

*Source: supabase/functions/wa-webhook/notify/processor.ts:258*

---

### `unnamed`

Property Rentals Flow User flow: Option A - Add Property: Collect criteria → Save to DB (NO AI) Option B - Find Property: Collect search criteria → AI Agent

*Source: supabase/functions/wa-webhook/domains/property/rentals.ts:1*

---

### `handlePropertyAIChat`

Handle conversational AI agent chat for property rentals

*Source: supabase/functions/wa-webhook/domains/property/rentals.ts:714*

---

### `startPropertyAISearch`

Start property search with AI Agent

*Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:17*

---

### `handlePropertySearchCriteria`

Handle property search criteria input

*Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:68*

---

### `executePropertyAISearch`

Execute property search with location

*Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:136*

---

### `addPropertyViaAI`

Add property listing via AI Agent

*Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:248*

---

### `clearPropertySearchState`

Clear property search state

*Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:293*

---

### `hasActivePropertySearch`

Check if user has active property search

*Source: supabase/functions/wa-webhook/domains/property/ai_agent.ts:314*

---

### `unnamed`

Support AI Agent - Main Handler Routes support/help/customer service requests through the comprehensive AI agent

*Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:1*

---

### `handleSupportAgent`

Main entry point for Support Agent

*Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:15*

---

### `handleSupportAgentMessage`

Handle support agent text messages

*Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:31*

---

### `handleSupportAgentButton`

Handle support agent button callbacks

*Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:41*

---

### `unnamed`

Export all support functions

*Source: supabase/functions/wa-webhook/domains/ai-agents/support_agent.ts:56*

---

### `unnamed`

Sales AI Agent (Cold Caller) - Rebuilt with AI Core Uses Gemini 2.5 Pro + GPT-5 with shared tools

*Source: supabase/functions/wa-webhook/domains/ai-agents/sales_agent.ts:1*

---

### `unnamed`

Execute sales agent with Gemini 2.5 Pro ReAct loop

*Source: supabase/functions/wa-webhook/domains/ai-agents/sales_agent.ts:238*

---

### `runSalesAgent`

Run Sales Agent handler for wa-webhook

*Source: supabase/functions/wa-webhook/domains/ai-agents/sales_agent.ts:336*

---

### `unnamed`

Customer Support AI Agent - Handles general help, navigation, and support requests Integrated with WhatsApp webhook for natural language support conversations

*Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:1*

---

### `startCustomerSupportChat`

Start a customer support chat session

*Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:21*

---

### `handleSupportMessage`

Handle support message with AI agent

*Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:107*

---

### `escalateToHumanSupport`

Escalate to human support

*Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:191*

---

### `handleSupportButton`

Handle support button actions

*Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:256*

---

### `generateSupportResponse`

Generate AI response (simplified placeholder) In production, this would call OpenAI/Gemini API

*Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:347*

---

### `isResolutionMessage`

Check if message indicates resolution

*Source: supabase/functions/wa-webhook/domains/ai-agents/customer-support.ts:399*

---

### `unnamed`

AI Agents Integration Module Connects database search agents with the WhatsApp webhook system. Agents search ONLY from database - NO web search or external APIs. All agents must have proper error handling and fallback messages.

*Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:1*

---

### `routeToAIAgent`

Route request to appropriate AI agent based on intent

*Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:40*

---

### `invokePropertyAgent`

Invoke Property Rental Agent - DATABASE SEARCH ONLY

*Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:90*

---

### `sendAgentOptions`

Send agent options to user as interactive list with fallback buttons

*Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:148*

---

### `handleAgentSelection`

Handle agent option selection with proper error handling

*Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:209*

---

### `checkAgentSessionStatus`

Check agent session status with proper error handling

*Source: supabase/functions/wa-webhook/domains/ai-agents/integration.ts:309*

---

### `unnamed`

Insurance AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for insurance quotes, claims, and policy management

*Source: supabase/functions/wa-webhook/domains/ai-agents/insurance_agent.ts:1*

---

### `handleGeneralBrokerStart`

Start General Broker AI Agent Routes user to the general broker AI agent for service requests

*Source: supabase/functions/wa-webhook/domains/ai-agents/general_broker.ts:6*

---

### `unnamed`

AI Agent Handlers for WhatsApp Flows Provides convenient handlers that can be called from the text router to initiate AI agent sessions for various use cases.

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:1*

---

### `unnamed`

Handle "Nearby Drivers" request with AI agent DATABASE SEARCH ONLY - No web search

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:28*

---

### `unnamed`

Handle "Nearby Pharmacies" request with AI agent

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:34*

---

### `unnamed`

Handle "Nearby Quincailleries" request with AI agent

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:39*

---

### `unnamed`

Handle "Nearby Shops" request with AI agent TWO-PHASE APPROACH: Phase 1: Immediately show top 9 nearby shops from database Phase 2: AI agent processes in background for curated shortlist

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:44*

---

### `handleAIPropertyRental`

Handle "Property Rental" request with AI agent

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:52*

---

### `unnamed`

Handle "Schedule Trip" request with AI agent

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:147*

---

### `handleAIAgentOptionSelection`

Handle AI agent selection from interactive list

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:152*

---

### `handleAIAgentLocationUpdate`

Handle location update for pending AI agent request

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:177*

---

### `unnamed`

Phase 2: Background AI agent processing for shops Agent contacts shops on behalf of user to create curated shortlist

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:201*

---

### `unnamed`

Phase 1: Send immediate database results (top 9 nearby shops) This provides instant results while AI agent processes in background

*Source: supabase/functions/wa-webhook/domains/ai-agents/handlers.ts:207*

---

### `unnamed`

Business Broker AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for business discovery and recommendations

*Source: supabase/functions/wa-webhook/domains/ai-agents/business_broker_agent.ts:1*

---

### `unnamed`

Rides AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for ride matching and transportation services

*Source: supabase/functions/wa-webhook/domains/ai-agents/rides_agent.ts:1*

---

### `unnamed`

Farmer AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for agricultural services and marketplace

*Source: supabase/functions/wa-webhook/domains/ai-agents/farmer_agent.ts:1*

---

### `unnamed`

AI Agents Module Central export point for all AI agent functionality in the WhatsApp webhook system.

*Source: supabase/functions/wa-webhook/domains/ai-agents/index.ts:1*

---

### `unnamed`

Jobs AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro for job matching and career guidance

*Source: supabase/functions/wa-webhook/domains/ai-agents/jobs_agent.ts:1*

---

### `unnamed`

Real Estate AI Agent - Rebuilt with AI Core Uses Gemini 2.5 Pro with vision for property search and viewings

*Source: supabase/functions/wa-webhook/domains/ai-agents/real_estate_agent.ts:1*

---

### `unnamed`

Marketplace Domain Handler (Coming Soon) This is a stub implementation for the marketplace domain. Full marketplace functionality will be implemented in a future release.

*Source: supabase/functions/wa-webhook/domains/marketplace/index.ts:1*

---

### `handleMarketplace`

Handle marketplace-related messages Currently returns a "coming soon" message

*Source: supabase/functions/wa-webhook/domains/marketplace/index.ts:22*

---

### `getMarketplaceStatus`

Get marketplace feature status

*Source: supabase/functions/wa-webhook/domains/marketplace/index.ts:47*

---

### `showBusinessWhatsAppNumbers`

Display list of WhatsApp numbers for a business

*Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:19*

---

### `startAddWhatsAppNumber`

Start the flow to add a new WhatsApp number

*Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:95*

---

### `handleAddWhatsAppNumberText`

Handle text input for adding WhatsApp number

*Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:119*

---

### `handleWhatsAppNumberSelection`

Handle selection of a specific WhatsApp number (for future edit/delete)

*Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:203*

---

### `maskPhoneNumber`

Mask phone number for display (show only last 4 digits)

*Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:224*

---

### `formatDate`

Format date for display

*Source: supabase/functions/wa-webhook/domains/business/whatsapp_numbers.ts:234*

---

### `showManageBusinesses`

Display list of businesses owned by the current user

*Source: supabase/functions/wa-webhook/domains/business/management.ts:41*

---

### `showBusinessDetail`

Show detail view for a specific business with management options

*Source: supabase/functions/wa-webhook/domains/business/management.ts:150*

---

### `handleBusinessDelete`

Handle business deletion with confirmation

*Source: supabase/functions/wa-webhook/domains/business/management.ts:254*

---

### `confirmBusinessDelete`

Confirm and execute business deletion

*Source: supabase/functions/wa-webhook/domains/business/management.ts:287*

---

### `handleBusinessSelection`

Handle business selection from the list

*Source: supabase/functions/wa-webhook/domains/business/management.ts:335*

---

### `startBusinessClaim`

Start business claiming flow

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:40*

---

### `handleBusinessNameSearch`

Handle business name search with OpenAI semantic search

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:71*

---

### `handleBusinessClaim`

Handle business selection and claiming

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:175*

---

### `searchBusinessesSemantic`

OpenAI-powered semantic business search Uses embeddings and smart matching to find businesses

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:281*

---

### `searchBusinessesSimple`

Simple fallback search (no OpenAI)

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:441*

---

### `searchBusinessesSmart`

Fuzzy/semantic business search (fast path)

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:485*

---

### `claimBusiness`

Claim a business for the user

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:599*

---

### `createBusinessFromBar`

Create a business entry from a bars table record

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:654*

---

### `formatBusinessDescription`

Format business description for list display

*Source: supabase/functions/wa-webhook/domains/business/claim.ts:707*

---

### `handleProfileMenu`

Profile Hub Unified entry point for managing: - Vehicles - Businesses - Properties - Tokens - Settings

*Source: supabase/functions/wa-webhook/domains/profile/index.ts:12*

---

### `getProfileMenuItemId`

Map profile menu item action_targets to route IDs This ensures the router can handle actions from database-driven menu

*Source: supabase/functions/wa-webhook/domains/profile/index.ts:160*

---

### `handleVehicleCertificateMedia`

Handle vehicle certificate media upload

*Source: supabase/functions/wa-webhook/domains/profile/index.ts:270*

---

### `parseScheduledDateTime`

Parse date and time strings into a Date object for scheduled trip storage. The date/time is stored in UTC for consistency across timezones. Note: This simplified implementation treats the input as a local time string and converts to Date. For production use with multiple timezones, consider using a library like Temporal or date-fns-tz for proper timezone handling.

*Source: supabase/functions/wa-webhook/domains/mobility/schedule.ts:1267*

---

### `sendDriverQuoteRequest`

Send quote request to a driver

*Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:27*

---

### `formatDriverQuoteRequest`

Format driver quote request message

*Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:66*

---

### `parseDriverQuoteResponse`

Parse driver quote response

*Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:99*

---

### `handleDriverQuoteResponse`

Handle incoming quote response from driver

*Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:143*

---

### `sendQuotePresentationToUser`

Send quote presentation to user

*Source: supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts:221*

---

### `showRidesMenu`

Display the Rides submenu with 3 options: - Nearby Drivers - Nearby Passengers - Schedule Trip

*Source: supabase/functions/wa-webhook/domains/mobility/rides_menu.ts:7*

---

### `showRecentSearches`

Show recent searches as quick actions

*Source: supabase/functions/wa-webhook/domains/mobility/nearby.ts:196*

---

### `saveIntent`

Save user intent to mobility_intents table for better querying and recommendations

*Source: supabase/functions/wa-webhook/domains/mobility/intent_storage.ts:20*

---

### `getRecentIntents`

Get recent intents for a user

*Source: supabase/functions/wa-webhook/domains/mobility/intent_storage.ts:51*

---

### `cleanupExpiredIntents`

Clean up expired intents (can be called periodically or via cron)

*Source: supabase/functions/wa-webhook/domains/mobility/intent_storage.ts:76*

---

### `getLocalizedMenuName`

Get localized menu item name for a specific country

*Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:58*

---

### `fetchActiveMenuItems`

Fetch active menu items from database filtered by country Returns items with country-specific names applied

*Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:71*

---

### `normalizeMenuKey`

Normalize a menu key (legacy or canonical) to its canonical agent key.

*Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:150*

---

### `getMenuItemId`

Map menu item keys to IDS constants

*Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:159*

---

### `getMenuItemTranslationKeys`

Get translation key for menu item

*Source: supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts:170*

---

### `showJobBoardMenu`

Show job board main menu

*Source: supabase/functions/wa-webhook/domains/jobs/index.ts:196*

---

### `startJobSearch`

Start job search conversation (job seeker)

*Source: supabase/functions/wa-webhook/domains/jobs/index.ts:254*

---

### `startJobPosting`

Start job posting conversation (job poster)

*Source: supabase/functions/wa-webhook/domains/jobs/index.ts:279*

---

### `handleJobBoardText`

Handle ongoing job board conversation Routes user messages to the job-board-ai-agent edge function

*Source: supabase/functions/wa-webhook/domains/jobs/index.ts:963*

---

### `showMyApplications`

Show user's job applications

*Source: supabase/functions/wa-webhook/domains/jobs/index.ts:1047*

---

### `startMyJobsMenu`

Show user's posted jobs

*Source: supabase/functions/wa-webhook/domains/jobs/index.ts:1135*

---

### `handleInsuranceHelp`

Handle insurance help request - show admin contacts

*Source: supabase/functions/wa-webhook/domains/insurance/ins_handler.ts:369*

---

### `routeMessage`

Route message to appropriate microservice

*Source: supabase/functions/wa-webhook/router.ts:57*

---

### `getServiceFromState`

Get service from chat state

*Source: supabase/functions/wa-webhook/router.ts:104*

---

### `forwardToMicroservice`

Forward request to microservice

*Source: supabase/functions/wa-webhook/router.ts:123*

---

### `checkServiceHealth`

Get service health status

*Source: supabase/functions/wa-webhook/router.ts:183*

---

### `getAllServicesHealth`

Get all services health

*Source: supabase/functions/wa-webhook/router.ts:202*

---

### `normalizeMenuKey`

Normalizes a menu key to its canonical agent key

*Source: supabase/functions/wa-webhook/config/home_menu_aliases.ts:93*

---

### `isLegacyMenuKey`

Checks if a key is a legacy (aliased) key

*Source: supabase/functions/wa-webhook/config/home_menu_aliases.ts:100*

---

### `isCanonicalMenuKey`

Validates if a key is a canonical menu key

*Source: supabase/functions/wa-webhook/config/home_menu_aliases.ts:125*

---

### `unnamed`

Enhanced Middleware Integration for wa-webhook Provides middleware functions that integrate rate limiting, caching, error handling, and metrics without modifying existing code. These can be optionally integrated into the existing pipeline.

*Source: supabase/functions/wa-webhook/utils/middleware.ts:1*

---

### `applyRateLimiting`

Apply rate limiting middleware Can be called from existing pipeline to add rate limiting

*Source: supabase/functions/wa-webhook/utils/middleware.ts:21*

---

### `trackWebhookMetrics`

Track webhook metrics

*Source: supabase/functions/wa-webhook/utils/middleware.ts:68*

---

### `getCachedUserContext`

Cache user context with automatic expiration Can be used in message_context.ts to cache user lookups

*Source: supabase/functions/wa-webhook/utils/middleware.ts:92*

---

### `wrapError`

Wrap error with enhanced error handling Can be used in existing try-catch blocks to enhance error responses

*Source: supabase/functions/wa-webhook/utils/middleware.ts:109*

---

### `addRateLimitHeaders`

Add rate limit headers to response

*Source: supabase/functions/wa-webhook/utils/middleware.ts:135*

---

### `enhanceWebhookRequest`

Middleware function to enhance PreparedWebhook This can be called after processWebhookRequest to add enhancements

*Source: supabase/functions/wa-webhook/utils/middleware.ts:160*

---

### `logWebhookCompletion`

Log webhook processing completion

*Source: supabase/functions/wa-webhook/utils/middleware.ts:197*

---

### `processMessageWithEnhancements`

Example: Enhanced message processor wrapper This shows how to wrap existing handleMessage calls with enhancements

*Source: supabase/functions/wa-webhook/utils/middleware.ts:225*

---

### `areEnhancementsEnabled`

Utility to check if enhancements are enabled

*Source: supabase/functions/wa-webhook/utils/middleware.ts:288*

---

### `getEnhancementConfig`

Get enhancement configuration

*Source: supabase/functions/wa-webhook/utils/middleware.ts:297*

---

### `unnamed`

Message Deduplication and Queue Integration Provides deduplication checking against the database and queue integration for reliable message processing.

*Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:1*

---

### `isNewMessage`

Check if a message has already been processed (database-backed deduplication)

*Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:14*

---

### `markMessageProcessed`

Mark a message as processed

*Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:67*

---

### `enqueueMessage`

Add message to processing queue

*Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:115*

---

### `getOrCreateConversationMemory`

Get or create AI conversation memory

*Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:175*

---

### `updateConversationMemory`

Update AI conversation memory

*Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:272*

---

### `cleanupOldConversations`

Cleanup old conversation memories (older than 7 days with no activity)

*Source: supabase/functions/wa-webhook/utils/message-deduplication.ts:346*

---

### `unnamed`

Enhanced Error Handling for wa-webhook Provides structured error handling with classification, user notifications, and retry logic. Complements existing error handling.

*Source: supabase/functions/wa-webhook/utils/error_handler.ts:1*

---

### `normalizeError`

Normalize any error to WebhookError

*Source: supabase/functions/wa-webhook/utils/error_handler.ts:71*

---

### `handleWebhookError`

Handle webhook error with logging and optional user notification

*Source: supabase/functions/wa-webhook/utils/error_handler.ts:155*

---

### `notifyUserOfError`

Send error notification to user

*Source: supabase/functions/wa-webhook/utils/error_handler.ts:187*

---

### `createErrorResponse`

Create error response

*Source: supabase/functions/wa-webhook/utils/error_handler.ts:216*

---

### `maskPhone`

Mask phone number for logging (PII protection)

*Source: supabase/functions/wa-webhook/utils/error_handler.ts:264*

---

### `isRetryableError`

Check if error is retryable

*Source: supabase/functions/wa-webhook/utils/error_handler.ts:272*

---

### `getRetryDelay`

Get retry delay based on attempt number

*Source: supabase/functions/wa-webhook/utils/error_handler.ts:288*

---

### `unnamed`

Enhanced Health Check for wa-webhook Provides comprehensive health monitoring including rate limiter, cache, and database connectivity.

*Source: supabase/functions/wa-webhook/utils/health_check.ts:1*

---

### `checkDatabase`

Check database health

*Source: supabase/functions/wa-webhook/utils/health_check.ts:39*

---

### `checkRateLimiter`

Check rate limiter health

*Source: supabase/functions/wa-webhook/utils/health_check.ts:78*

---

### `checkCache`

Check cache health

*Source: supabase/functions/wa-webhook/utils/health_check.ts:100*

---

### `checkMetrics`

Check metrics collector health

*Source: supabase/functions/wa-webhook/utils/health_check.ts:122*

---

### `performHealthCheck`

Perform comprehensive health check

*Source: supabase/functions/wa-webhook/utils/health_check.ts:143*

---

### `createHealthCheckResponse`

Create health check response

*Source: supabase/functions/wa-webhook/utils/health_check.ts:180*

---

### `createLivenessResponse`

Simple liveness probe (for Kubernetes, etc.)

*Source: supabase/functions/wa-webhook/utils/health_check.ts:201*

---

### `createReadinessResponse`

Readiness probe (checks critical dependencies)

*Source: supabase/functions/wa-webhook/utils/health_check.ts:211*

---

### `unnamed`

Dynamic Submenu Helper Provides reusable functions to fetch and display dynamic submenus from database Eliminates hardcoded menu lists

*Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:1*

---

### `fetchSubmenuItems`

Fetch submenu items for a parent menu from database

*Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:21*

---

### `fetchProfileMenuItems`

Fetch profile menu items from database

*Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:51*

---

### `submenuItemsToRows`

Convert submenu items to WhatsApp list row format

*Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:85*

---

### `getSubmenuRows`

Get submenu items as WhatsApp rows with back button Convenience function that combines fetch + convert + add back button

*Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:106*

---

### `hasSubmenu`

Check if a submenu exists and has items

*Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:143*

---

### `getSubmenuAction`

Get the default action for a submenu item Used for routing based on action_type

*Source: supabase/functions/wa-webhook/utils/dynamic_submenu.ts:159*

---

### `unnamed`

Increment a counter

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:36*

---

### `unnamed`

Set a gauge value

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:50*

---

### `unnamed`

Record a histogram value (for durations, sizes, etc.)

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:63*

---

### `unnamed`

Get dimension key for grouping

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:81*

---

### `unnamed`

Parse dimension key back to object

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:95*

---

### `unnamed`

Calculate histogram statistics

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:110*

---

### `unnamed`

Flush metrics to logs

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:151*

---

### `unnamed`

Get metrics in Prometheus format (for /metrics endpoint)

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:206*

---

### `unnamed`

Get summary statistics

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:260*

---

### `unnamed`

Start periodic flushing

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:271*

---

### `unnamed`

Stop flushing and cleanup

*Source: supabase/functions/wa-webhook/utils/metrics_collector.ts:282*

---

### `unnamed`

Get value from cache

*Source: supabase/functions/wa-webhook/utils/cache.ts:48*

---

### `unnamed`

Set value in cache

*Source: supabase/functions/wa-webhook/utils/cache.ts:71*

---

### `unnamed`

Get or set value using factory function

*Source: supabase/functions/wa-webhook/utils/cache.ts:94*

---

### `unnamed`

Delete from cache

*Source: supabase/functions/wa-webhook/utils/cache.ts:112*

---

### `unnamed`

Clear all cache

*Source: supabase/functions/wa-webhook/utils/cache.ts:123*

---

### `unnamed`

Check if cache contains key

*Source: supabase/functions/wa-webhook/utils/cache.ts:135*

---

### `unnamed`

Evict least recently used entry

*Source: supabase/functions/wa-webhook/utils/cache.ts:148*

---

### `unnamed`

Clean up expired entries

*Source: supabase/functions/wa-webhook/utils/cache.ts:172*

---

### `unnamed`

Get cache statistics

*Source: supabase/functions/wa-webhook/utils/cache.ts:195*

---

### `unnamed`

Check if cache is healthy

*Source: supabase/functions/wa-webhook/utils/cache.ts:212*

---

### `unnamed`

Start periodic cleanup

*Source: supabase/functions/wa-webhook/utils/cache.ts:219*

---

### `unnamed`

Cleanup resources

*Source: supabase/functions/wa-webhook/utils/cache.ts:231*

---

### `unnamed`

Check if identifier should be rate limited

*Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:48*

---

### `unnamed`

Manually unblock an identifier

*Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:120*

---

### `unnamed`

Get statistics for monitoring

*Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:128*

---

### `unnamed`

Mask identifier for logging (PII protection)

*Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:143*

---

### `unnamed`

Cleanup expired buckets

*Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:151*

---

### `unnamed`

Start periodic cleanup

*Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:174*

---

### `unnamed`

Stop cleanup (for testing/shutdown)

*Source: supabase/functions/wa-webhook/utils/rate_limiter.ts:183*

---

### `validateAndLoadConfig`

Validate and load configuration

*Source: supabase/functions/wa-webhook/utils/config_validator.ts:54*

---

### `getEnv`

Get environment variable with fallback to multiple keys

*Source: supabase/functions/wa-webhook/utils/config_validator.ts:116*

---

### `loadConfig`

Load configuration with defaults

*Source: supabase/functions/wa-webhook/utils/config_validator.ts:127*

---

### `printConfigStatus`

Print configuration status

*Source: supabase/functions/wa-webhook/utils/config_validator.ts:174*

---

### `assertConfigValid`

Assert configuration is valid (throws if not)

*Source: supabase/functions/wa-webhook/utils/config_validator.ts:202*

---

### `encodeTelUriForQr`

Encodes a USSD string as a tel: URI for QR codes. Android QR scanner apps often fail to decode percent-encoded characters before passing the URI to the dialer. This function leaves * and # unencoded for better Android compatibility while maintaining iOS support.

*Source: supabase/functions/wa-webhook/utils/ussd.ts:14*

---

### `unnamed`

AI Agent Chat Interface Utilities Provides consistent, emoji-rich, button-enabled chat interfaces for all AI agents. All agents MUST use natural language chat with: - Emoji-numbered listings (1️⃣, 2️⃣, 3️⃣) - Action buttons for quick responses - Concise messages with emojis

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:1*

---

### `formatEmojiNumberedList`

Format options/items as emoji-numbered list

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:20*

---

### `createAgentActionButtons`

Create action buttons for agent responses

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:62*

---

### `sendAgentListResponse`

Send agent message with emoji-numbered list and action buttons

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:90*

---

### `sendAgentMessageWithActions`

Send concise agent message with action buttons

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:136*

---

### `sendAgentMessage`

Send simple agent text message with emoji

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:163*

---

### `formatAgentError`

Format error message for agent responses

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:178*

---

### `formatAgentSuccess`

Format success message for agent responses

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:186*

---

### `createQuickReplyInstruction`

Create quick reply instruction text

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:193*

---

### `parseEmojiNumber`

Parse emoji number from user input Supports both emoji (1️⃣) and plain numbers (1)

*Source: supabase/functions/wa-webhook/utils/ai-chat-interface.ts:210*

---

### `buildMomoUssdForQr`

Builds MOMO USSD code with tel URI optimized for QR codes. Uses unencoded * and # for better Android QR scanner compatibility.

*Source: supabase/functions/wa-webhook/utils/momo.ts:16*

---

### `unnamed`

Connection Pool Manager for Supabase Client Implements connection pooling to: - Reduce connection overhead - Improve performance - Manage connection lifecycle - Monitor pool health

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:1*

---

### `unnamed`

Initialize pool with minimum connections

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:71*

---

### `unnamed`

Create a new pooled connection

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:91*

---

### `unnamed`

Acquire a connection from the pool

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:138*

---

### `unnamed`

Release a connection back to the pool

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:188*

---

### `unnamed`

Execute operation with pooled connection

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:213*

---

### `unnamed`

Perform pool maintenance

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:227*

---

### `unnamed`

Get pool statistics

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:270*

---

### `unnamed`

Check pool health

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:287*

---

### `unnamed`

Destroy the pool

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:298*

---

### `unnamed`

Singleton pool instance

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:315*

---

### `withPooledConnection`

Helper function to execute with pooled connection

*Source: supabase/functions/wa-webhook/shared/connection_pool.ts:327*

---

### `unnamed`

Streaming Response Handler for OpenAI Handles server-sent events (SSE) from OpenAI Chat Completions API Accumulates chunks and provides real-time updates ADDITIVE ONLY - New file, no modifications to existing code

*Source: supabase/functions/wa-webhook/shared/streaming_handler.ts:1*

---

### `unnamed`

Stream chat completion responses Yields chunks as they arrive from OpenAI

*Source: supabase/functions/wa-webhook/shared/streaming_handler.ts:42*

---

### `unnamed`

Accumulate full response from stream Useful when you want streaming internally but need the complete response

*Source: supabase/functions/wa-webhook/shared/streaming_handler.ts:205*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/wa-webhook/shared/streaming_handler.ts:257*

---

### `unnamed`

Agent Context Builder Builds comprehensive context for AI agents from WhatsApp messages Extracts user profile, conversation history, and session state

*Source: supabase/functions/wa-webhook/shared/agent_context.ts:1*

---

### `extractMessageContent`

Extract message content from different message types

*Source: supabase/functions/wa-webhook/shared/agent_context.ts:115*

---

### `fetchUserProfile`

Fetch user profile from database

*Source: supabase/functions/wa-webhook/shared/agent_context.ts:139*

---

### `fetchMessageHistory`

Fetch recent message history for context

*Source: supabase/functions/wa-webhook/shared/agent_context.ts:174*

---

### `extractContentFromInteraction`

Extract content from stored interaction

*Source: supabase/functions/wa-webhook/shared/agent_context.ts:229*

---

### `extractContentFromResponse`

Extract content from stored response

*Source: supabase/functions/wa-webhook/shared/agent_context.ts:252*

---

### `saveAgentInteraction`

Save agent interaction to database

*Source: supabase/functions/wa-webhook/shared/agent_context.ts:267*

---

### `unnamed`

OpenAI Client for wa-webhook Provides OpenAI API integration with: - Chat completions with function calling - Streaming support - Token usage tracking - Cost calculation - Error handling & retries

*Source: supabase/functions/wa-webhook/shared/openai_client.ts:1*

---

### `getErrorMessage`

Safely extract error message from unknown error

*Source: supabase/functions/wa-webhook/shared/openai_client.ts:15*

---

### `unnamed`

Create chat completion

*Source: supabase/functions/wa-webhook/shared/openai_client.ts:86*

---

### `unnamed`

Make HTTP request to OpenAI API

*Source: supabase/functions/wa-webhook/shared/openai_client.ts:130*

---

### `unnamed`

Calculate API cost based on model and token usage

*Source: supabase/functions/wa-webhook/shared/openai_client.ts:208*

---

### `unnamed`

Delay helper for retries

*Source: supabase/functions/wa-webhook/shared/openai_client.ts:231*

---

### `unnamed`

Generate embeddings for text

*Source: supabase/functions/wa-webhook/shared/openai_client.ts:238*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/wa-webhook/shared/openai_client.ts:287*

---

### `unnamed`

Comprehensive Error Handler for Webhook Provides error categorization, user notifications, and retry logic

*Source: supabase/functions/wa-webhook/shared/error-handler.ts:1*

---

### `unnamed`

Handle error and return appropriate response

*Source: supabase/functions/wa-webhook/shared/error-handler.ts:100*

---

### `unnamed`

Normalize error to WebhookError

*Source: supabase/functions/wa-webhook/shared/error-handler.ts:124*

---

### `unnamed`

Log error with structured data

*Source: supabase/functions/wa-webhook/shared/error-handler.ts:199*

---

### `unnamed`

Notify user via WhatsApp

*Source: supabase/functions/wa-webhook/shared/error-handler.ts:216*

---

### `unnamed`

Create HTTP response

*Source: supabase/functions/wa-webhook/shared/error-handler.ts:243*

---

### `unnamed`

Get error statistics

*Source: supabase/functions/wa-webhook/shared/error-handler.ts:279*

---

### `unnamed`

Response Formatting Utilities Helper methods for formatting agent responses with emoji-numbered lists and action buttons for chat-first architecture.

*Source: supabase/functions/wa-webhook/shared/response_formatter.ts:1*

---

### `formatAgentResponse`

Format agent response with emoji-numbered lists and action buttons

*Source: supabase/functions/wa-webhook/shared/response_formatter.ts:17*

---

### `extractOptionsFromText`

Extract options from response text

*Source: supabase/functions/wa-webhook/shared/response_formatter.ts:64*

---

### `extractHeaderFromText`

Extract header text before the list

*Source: supabase/functions/wa-webhook/shared/response_formatter.ts:102*

---

### `generateActionButtons`

Generate contextual action buttons based on agent type

*Source: supabase/functions/wa-webhook/shared/response_formatter.ts:111*

---

### `unnamed`

Message Formatter Utilities Provides standardized formatting for AI agent chat messages including: - Emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) - Action buttons - User selection parsing - Fallback flow detection

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:1*

---

### `formatEmojiList`

Format options as emoji-numbered list

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:49*

---

### `parseEmojiSelection`

Parse user's emoji selection from message Supports multiple formats: - Numbers: "1", "2", "3" - Emojis: "1️⃣", "2️⃣", "3️⃣" - Text: "one", "two", "three", "first", "second" - Phrases: "option 1", "number 2", "the first one"

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:82*

---

### `formatMessageWithButtons`

Format message with action buttons

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:148*

---

### `shouldUseFallbackFlow`

Detect if message should trigger fallback to WhatsApp flow

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:176*

---

### `createListMessage`

Create a formatted list message with emoji numbers and action buttons

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:224*

---

### `validateActionButtons`

Validate action button configuration Ensures buttons meet WhatsApp requirements

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:268*

---

### `extractOptionsMetadata`

Extract option metadata from formatted list Useful for tracking what options were presented

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:283*

---

### `isSelectionMessage`

Check if user message is a valid selection from previous options

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:299*

---

### `getSelectionHelpText`

Generate help text for emoji selection

*Source: supabase/functions/wa-webhook/shared/message_formatter.ts:318*

---

### `unnamed`

WhatsApp-Specific Tools for AI Agents Provides tools that agents can use to interact with WhatsApp Business API and EasyMO backend services ADDITIVE ONLY - New tools for agent system

*Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:1*

---

### `unnamed`

Register default tools

*Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:39*

---

### `unnamed`

Register a tool

*Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:623*

---

### `unnamed`

Get tool definition for OpenAI format

*Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:630*

---

### `unnamed`

Execute a tool

*Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:647*

---

### `unnamed`

Get all registered tools

*Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:687*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/wa-webhook/shared/whatsapp_tools.ts:695*

---

### `unnamed`

Agent Orchestrator Central hub for managing multiple specialized agents Routes messages to appropriate agents based on intent Handles agent-to-agent handoffs and conversation state ADDITIVE ONLY - New file, complements existing ai_agent_handler.ts

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:1*

---

### `unnamed`

Initialize default agent configurations

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:90*

---

### `unnamed`

Register an agent configuration

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:105*

---

### `unnamed`

Classify user intent and select appropriate agent

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:112*

---

### `unnamed`

Use LLM to classify intent

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:149*

---

### `unnamed`

Process message with selected agent

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:200*

---

### `unnamed`

Build message history for agent

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:322*

---

### `unnamed`

Get tools available for agent

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:373*

---

### `unnamed`

Extract topic from message

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:389*

---

### `unnamed`

Transfer conversation to different agent

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:413*

---

### `unnamed`

End conversation and cleanup

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:425*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/wa-webhook/shared/agent_orchestrator.ts:460*

---

### `unnamed`

Advanced Rate Limiter with Blacklisting Provides per-user rate limiting, violation tracking, and blacklist management

*Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:1*

---

### `unnamed`

Check if request should be rate limited

*Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:42*

---

### `unnamed`

Manually unblock an identifier

*Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:130*

---

### `unnamed`

Get current state for monitoring

*Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:142*

---

### `unnamed`

Check health

*Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:157*

---

### `unnamed`

Clean up expired buckets

*Source: supabase/functions/wa-webhook/shared/rate-limiter.ts:164*

---

### `unnamed`

Agent Configurations Centralized configurations for all AI agents in the EasyMO platform. Each agent has a chat-first interface with emoji-numbered lists and action buttons. OFFICIAL AGENTS (10 production agents matching agent_registry database): 1. farmer - Farmer AI Agent 2. insurance - Insurance AI Agent 3. sales_cold_caller - Sales/Marketing Cold Caller AI Agent 4. rides - Rides AI Agent 5. jobs - Jobs AI Agent 6. waiter - Waiter AI Agent 7. real_estate - Real Estate AI Agent 8. marketplace - Marketplace AI Agent (includes pharmacy, hardware, shop) 9. support - Support AI Agent (includes concierge routing) 10. business_broker - Business Broker AI Agent (includes legal intake)

*Source: supabase/functions/wa-webhook/shared/agent_configs.ts:1*

---

### `unnamed`

Simple In-Memory Cache for Webhook Processing Provides TTL-based caching with LRU eviction

*Source: supabase/functions/wa-webhook/shared/cache.ts:1*

---

### `unnamed`

Get value from cache

*Source: supabase/functions/wa-webhook/shared/cache.ts:44*

---

### `unnamed`

Set value in cache

*Source: supabase/functions/wa-webhook/shared/cache.ts:67*

---

### `unnamed`

Get or set value

*Source: supabase/functions/wa-webhook/shared/cache.ts:90*

---

### `unnamed`

Delete from cache

*Source: supabase/functions/wa-webhook/shared/cache.ts:108*

---

### `unnamed`

Clear all cache

*Source: supabase/functions/wa-webhook/shared/cache.ts:119*

---

### `unnamed`

Evict least recently used entry

*Source: supabase/functions/wa-webhook/shared/cache.ts:129*

---

### `unnamed`

Clean up expired entries

*Source: supabase/functions/wa-webhook/shared/cache.ts:151*

---

### `unnamed`

Get cache statistics

*Source: supabase/functions/wa-webhook/shared/cache.ts:175*

---

### `unnamed`

Check if cache is healthy

*Source: supabase/functions/wa-webhook/shared/cache.ts:186*

---

### `unnamed`

AI Agent Configuration Centralized configuration for all AI agent features Allows feature flags and dynamic configuration

*Source: supabase/functions/wa-webhook/shared/ai_agent_config.ts:1*

---

### `getAIAgentConfig`

Get AI agent configuration Can be overridden by database settings or environment variables

*Source: supabase/functions/wa-webhook/shared/ai_agent_config.ts:266*

---

### `validateAIAgentConfig`

Validate configuration

*Source: supabase/functions/wa-webhook/shared/ai_agent_config.ts:288*

---

### `getAgentTypeConfig`

Get agent-specific configuration

*Source: supabase/functions/wa-webhook/shared/ai_agent_config.ts:310*

---

### `unnamed`

Health & Metrics Endpoint for AI Agents Provides: - Health check status - Aggregated metrics - System diagnostics - Configuration status ADDITIVE ONLY - New endpoints for monitoring

*Source: supabase/functions/wa-webhook/shared/health_metrics.ts:1*

---

### `getHealthStatus`

Check overall system health

*Source: supabase/functions/wa-webhook/shared/health_metrics.ts:42*

---

### `checkDatabaseHealth`

Check database health

*Source: supabase/functions/wa-webhook/shared/health_metrics.ts:93*

---

### `getDetailedMetrics`

Get detailed metrics for monitoring

*Source: supabase/functions/wa-webhook/shared/health_metrics.ts:109*

---

### `handleHealthCheck`

Handle health check request

*Source: supabase/functions/wa-webhook/shared/health_metrics.ts:127*

---

### `handleMetricsRequest`

Handle metrics request

*Source: supabase/functions/wa-webhook/shared/health_metrics.ts:168*

---

### `handleMetricsSummaryRequest`

Handle metrics summary request (plain text)

*Source: supabase/functions/wa-webhook/shared/health_metrics.ts:198*

---

### `handlePrometheusMetrics`

Handle Prometheus-style metrics export

*Source: supabase/functions/wa-webhook/shared/health_metrics.ts:221*

---

### `unnamed`

Advanced Rate Limiter with Blacklisting Features: - Per-user rate limiting - Automatic blacklisting for abuse - Violation tracking - Exponential backoff - Redis-backed (future enhancement)

*Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:1*

---

### `unnamed`

Check if request should be rate limited

*Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:62*

---

### `unnamed`

Manually unblock an identifier

*Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:172*

---

### `unnamed`

Get current state for monitoring

*Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:187*

---

### `unnamed`

Check health

*Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:207*

---

### `unnamed`

Clean up expired buckets and blacklist entries

*Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:217*

---

### `unnamed`

Destroy the rate limiter

*Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:251*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/wa-webhook/shared/advanced_rate_limiter.ts:266*

---

### `unnamed`

AI Agent Monitoring & Metrics Collection Comprehensive monitoring system for AI agent performance, cost tracking, and quality metrics ADDITIVE ONLY - New file

*Source: supabase/functions/wa-webhook/shared/monitoring.ts:1*

---

### `unnamed`

Record metrics for an agent interaction

*Source: supabase/functions/wa-webhook/shared/monitoring.ts:104*

---

### `unnamed`

Get aggregated metrics for a time period

*Source: supabase/functions/wa-webhook/shared/monitoring.ts:158*

---

### `unnamed`

Calculate aggregations from raw metrics

*Source: supabase/functions/wa-webhook/shared/monitoring.ts:193*

---

### `unnamed`

Get empty aggregated metrics

*Source: supabase/functions/wa-webhook/shared/monitoring.ts:320*

---

### `unnamed`

Check for alert conditions

*Source: supabase/functions/wa-webhook/shared/monitoring.ts:353*

---

### `unnamed`

Get real-time statistics

*Source: supabase/functions/wa-webhook/shared/monitoring.ts:402*

---

### `createMonitoringService`

Create monitoring service instance

*Source: supabase/functions/wa-webhook/shared/monitoring.ts:453*

---

### `unnamed`

Enhanced Tool Library with External APIs Provides additional tools for AI agents: - Web search (Tavily API) - Deep research (Perplexity API) - Weather information - Currency conversion - Translation

*Source: supabase/functions/wa-webhook/shared/enhanced_tools.ts:1*

---

### `getErrorMessage`

Safely extract error message from unknown error

*Source: supabase/functions/wa-webhook/shared/enhanced_tools.ts:15*

---

### `getEnhancedTools`

Get all enhanced tools

*Source: supabase/functions/wa-webhook/shared/enhanced_tools.ts:351*

---

### `registerEnhancedTools`

Register all enhanced tools with a tool manager

*Source: supabase/functions/wa-webhook/shared/enhanced_tools.ts:363*

---

### `getAIAgentConfig`

Get AI Agent configuration from environment

*Source: supabase/functions/wa-webhook/shared/config_manager.ts:56*

---

### `validateAIConfig`

Validate configuration

*Source: supabase/functions/wa-webhook/shared/config_manager.ts:113*

---

### `getConfigSummary`

Get configuration summary for logging

*Source: supabase/functions/wa-webhook/shared/config_manager.ts:157*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/wa-webhook/shared/config_manager.ts:185*

---

### `resetConfig`

Reset configuration (for testing)

*Source: supabase/functions/wa-webhook/shared/config_manager.ts:204*

---

### `unnamed`

Memory Manager for AI Agents Manages conversation memory using: - Short-term: Recent messages from wa_interactions table - Working memory: Session state - Long-term: Important facts stored in agent_conversations ENHANCED: Added caching layer for performance optimization

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:1*

---

### `getErrorMessage`

Safely extract error message from unknown error

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:18*

---

### `unnamed`

Get recent conversation history for a user ENHANCED: Added caching layer

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:52*

---

### `unnamed`

Save important information to long-term memory with embeddings

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:144*

---

### `unnamed`

Retrieve relevant memories using semantic search

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:196*

---

### `unnamed`

Calculate importance score for content

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:249*

---

### `unnamed`

Summarize conversation using OpenAI

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:280*

---

### `unnamed`

Save message interaction to memory

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:344*

---

### `unnamed`

Store important facts in agent_conversations for long-term memory

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:379*

---

### `unnamed`

Get conversation summary for a user

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:415*

---

### `unnamed`

Clear old conversation history (privacy/GDPR)

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:457*

---

### `unnamed`

Extract message content from various formats

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:495*

---

### `unnamed`

Extract important information from conversation

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:498*

---

### `unnamed`

Clear old conversation history (privacy/GDPR)

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:571*

---

### `unnamed`

Extract message content from various formats

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:609*

---

### `unnamed`

Extract response content from various formats

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:632*

---

### `unnamed`

Build context string from recent messages

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:647*

---

### `createMemoryManager`

Create memory manager instance

*Source: supabase/functions/wa-webhook/shared/memory_manager.ts:671*

---

### `unnamed`

Agent Session Management Functions for tracking and managing agent chat sessions. Sessions track conversation state, presented options, and user selections.

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:1*

---

### `getAgentChatSession`

Get active agent chat session for user by phone number

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:26*

---

### `getAgentChatSessionByUserId`

Get active agent chat session for user by user ID

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:69*

---

### `saveAgentChatSession`

Save or update agent chat session

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:101*

---

### `updateSessionSelection`

Update session with user selection

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:182*

---

### `triggerSessionFallback`

Trigger fallback for session

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:211*

---

### `clearAgentChatSession`

Clear agent chat session

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:244*

---

### `clearUserSessions`

Clear all sessions for a user

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:269*

---

### `getSessionStats`

Get session statistics for monitoring

*Source: supabase/functions/wa-webhook/shared/agent_session.ts:294*

---

### `unnamed`

Enhanced Webhook Verification with Security Features Provides signature verification, caching, and timing-safe comparison

*Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:1*

---

### `unnamed`

Verify WhatsApp webhook signature with caching

*Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:29*

---

### `unnamed`

Handle WhatsApp verification challenge

*Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:103*

---

### `unnamed`

Timing-safe string comparison

*Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:128*

---

### `unnamed`

Hash payload for cache key

*Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:144*

---

### `unnamed`

Cleanup expired cache entries

*Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:154*

---

### `unnamed`

Get verification statistics

*Source: supabase/functions/wa-webhook/shared/webhook-verification.ts:166*

---

### `unnamed`

Tool Manager for AI Agents Manages tool definitions and execution for OpenAI function calling Provides built-in tools for common operations: - check_wallet_balance - search_trips - create_booking - transfer_money - get_user_profile

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:1*

---

### `getErrorMessage`

Safely extract error message from unknown error

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:17*

---

### `unnamed`

Register built-in tools

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:53*

---

### `unnamed`

Register a custom tool

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:144*

---

### `unnamed`

Get all tool definitions for OpenAI

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:151*

---

### `unnamed`

Execute a tool call

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:161*

---

### `unnamed`

Execute multiple tool calls

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:249*

---

### `unnamed`

Save tool execution to database

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:262*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/wa-webhook/shared/tool_manager.ts:439*

---

### `unnamed`

Metrics Aggregator for AI Agents Collects and aggregates metrics for monitoring: - Request counts - Success/failure rates - Token usage & costs - Latency statistics - Tool execution metrics ADDITIVE ONLY - New file for enhanced monitoring

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:1*

---

### `unnamed`

Record a request

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:76*

---

### `unnamed`

Get aggregated metrics

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:121*

---

### `unnamed`

Get metrics summary for logging

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:164*

---

### `unnamed`

Reset metrics (for testing)

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:185*

---

### `unnamed`

Cleanup resources

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:205*

---

### `unnamed`

Add metrics to hourly bucket

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:214*

---

### `unnamed`

Get last hour statistics

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:238*

---

### `unnamed`

Cleanup old hourly buckets (keep last 24 hours)

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:262*

---

### `unnamed`

Check if metrics cross important thresholds

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:273*

---

### `unnamed`

Format duration in human-readable form

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:305*

---

### `unnamed`

Singleton instance

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:322*

---

### `resetMetrics`

Reset metrics (for testing)

*Source: supabase/functions/wa-webhook/shared/metrics_aggregator.ts:334*

---

### `unnamed`

⚠️ DEPRECATED - DO NOT DEPLOY ⚠️ This function has been deprecated and replaced by the microservice architecture: WhatsApp → wa-webhook-core (router) → domain microservices ├─ wa-webhook-ai-agents ├─ wa-webhook-mobility ├─ wa-webhook-wallet ├─ wa-webhook-jobs ├─ wa-webhook-property ├─ wa-webhook-insurance └─ wa-webhook-marketplace This directory is kept for: 1. Reference/documentation purposes 2. Shared library code (being migrated to _shared/wa-webhook-shared) DO NOT DEPLOY THIS FUNCTION Use wa-webhook-core instead: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core Migration date: 2025-11-24 Reason: Microservice architecture for better scalability and maintainability

*Source: supabase/functions/wa-webhook/DEPRECATED.ts:1*

---

### `unnamed`

Example: Integrating Enhanced Processor into wa-webhook This example shows how to integrate the enhanced processor into the existing wa-webhook handler. USAGE: 1. Import this in your index.ts 2. Set WA_ENHANCED_PROCESSING=true in environment 3. Monitor with health checks

*Source: supabase/functions/wa-webhook/integration-example.ts:1*

---

### `unnamed`

ALTERNATIVE: Gradual Rollout by User You can enable enhanced processing for specific users first:

*Source: supabase/functions/wa-webhook/integration-example.ts:125*

---

### `unnamed`

⚠️ DEPRECATION NOTICE ⚠️ This function (wa-webhook) is DEPRECATED and should NOT be deployed. This directory now serves as a SHARED CODE LIBRARY for WhatsApp webhook microservices. The actual webhook routing is handled by wa-webhook-core. Deployed microservices that use this shared code: - wa-webhook-core (ingress/router) - wa-webhook-ai-agents - wa-webhook-mobility - wa-webhook-wallet - wa-webhook-jobs - wa-webhook-property - wa-webhook-marketplace - wa-webhook-insurance If you need to make changes, edit files here but deploy the microservices above. To deploy all WhatsApp functions: pnpm run functions:deploy:wa DO NOT USE: supabase functions deploy wa-webhook USE INSTEAD: supabase functions deploy wa-webhook-core (and other microservices)

*Source: supabase/functions/wa-webhook/index.ts:10*

---

### `sendProfileMenu`

Display the Profile menu with options for managing businesses, vehicles, and tokens Delegates to the comprehensive Profile hub implementation

*Source: supabase/functions/wa-webhook/flows/profile.ts:6*

---

### `unnamed`

Voice Handler for WhatsApp Processes voice notes using the Unified AI Gateway. 1. Transcribes audio (Whisper or Gemini) 2. Routes to appropriate agent 3. Generates audio response (TTS or Realtime)

*Source: supabase/functions/wa-webhook/handlers/voice-handler.ts:1*

---

### `unnamed`

Enhanced Webhook Processor with Advanced Error Recovery This module extends the existing wa-webhook processor with: - Dead letter queue for failed messages - Conversation-level distributed locking - Timeout protection - Enhanced error recovery Can be enabled via WA_ENHANCED_PROCESSING environment variable.

*Source: supabase/functions/wa-webhook/router/enhanced_processor.ts:1*

---

### `handlePreparedWebhookEnhanced`

Enhanced webhook processing wrapper Adds DLQ, locking, and timeout protection to existing processor

*Source: supabase/functions/wa-webhook/router/enhanced_processor.ts:34*

---

### `processMessageEnhanced`

Process individual message with enhanced features

*Source: supabase/functions/wa-webhook/router/enhanced_processor.ts:147*

---

### `isEnhancedProcessingEnabled`

Get feature flag status

*Source: supabase/functions/wa-webhook/router/enhanced_processor.ts:253*

---

### `unnamed`

AI Agent Handler Routes WhatsApp messages to AI agents for intelligent processing Falls back to existing handlers if AI is not applicable This handler respects the additive-only guards by: - Being a completely new file - Not modifying existing handlers - Providing fallback to existing flows

*Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:1*

---

### `unnamed`

Singleton rate limiter instance

*Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:49*

---

### `isAIEligibleMessage`

Determines if a message should be processed by AI agents

*Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:90*

---

### `tryAIAgentHandler`

Try to handle message with AI agent Returns true if handled, false if should fallback to existing handlers

*Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:110*

---

### `processWithAIAgent`

Process message with AI agent using orchestrator Enhanced with full OpenAI integration and specialized agents

*Source: supabase/functions/wa-webhook/router/ai_agent_handler.ts:434*

---

### `unnamed`

Business Handlers Index Consolidates business CRUD operations

*Source: supabase/functions/wa-webhook-profile/business/index.ts:1*

---

### `unnamed`

wa-webhook-profile - Profile & Wallet Service Handles user profiles, wallet operations, and business management

*Source: supabase/functions/wa-webhook-profile/index-refactored.ts:1*

---

### `getUserCountry`

Get user's country code from profile or default to RW

*Source: supabase/functions/wa-webhook-profile/profile/home_dynamic.ts:19*

---

### `fetchProfileMenuItems`

Fetch dynamic profile menu items from database

*Source: supabase/functions/wa-webhook-profile/profile/home_dynamic.ts:49*

---

### `getFallbackMenuItems`

Fallback menu items if database fetch fails

*Source: supabase/functions/wa-webhook-profile/profile/home_dynamic.ts:89*

---

### `trackMenuItemClick`

Track menu item click analytics

*Source: supabase/functions/wa-webhook-profile/profile/home_dynamic.ts:225*

---

### `getUserCountry`

Get user's country code from profile or default to RW

*Source: supabase/functions/wa-webhook-profile/profile/home.ts:20*

---

### `fetchProfileMenuItems`

Fetch dynamic profile menu items from database

*Source: supabase/functions/wa-webhook-profile/profile/home.ts:50*

---

### `getFallbackMenuItems`

Fallback menu items if database fetch fails

*Source: supabase/functions/wa-webhook-profile/profile/home.ts:90*

---

### `unnamed`

Google Places API Integration Tool Provides real-time business search using Google Places API. Features: - Text search (find businesses by query) - Nearby search (find businesses near coordinates) - Place details (get full business information) - Caching to reduce API costs - Fallback to local database Usage: const placesTool = new GooglePlacesTool(); const results = await placesTool.searchNearby({ lat, lng, radius, keyword });

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:1*

---

### `unnamed`

Check if API is available

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:89*

---

### `unnamed`

Search for nearby places

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:96*

---

### `unnamed`

Search by text query

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:160*

---

### `unnamed`

Get detailed information about a place

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:222*

---

### `unnamed`

Get photo URL

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:274*

---

### `unnamed`

Transform Google Places results to our format

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:285*

---

### `unnamed`

Transform place details

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:324*

---

### `unnamed`

Calculate distance between two coordinates (Haversine formula)

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:350*

---

### `unnamed`

Generate cache key

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:378*

---

### `unnamed`

Get from cache

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:386*

---

### `unnamed`

Save to cache

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:416*

---

### `unnamed`

Import places to local business directory

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:431*

---

### `createGooglePlacesTool`

Create Google Places tool instance

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:474*

---

### `searchHybrid`

Hybrid search: Local DB + Google Places

*Source: supabase/functions/wa-webhook-unified/tools/google-places.ts:481*

---

### `getFeatureFlags`

Get feature flags from database or environment

*Source: supabase/functions/wa-webhook-unified/core/feature-flags.ts:36*

---

### `shouldUseUnifiedService`

Check if user should use unified service Uses consistent hashing for stable rollout

*Source: supabase/functions/wa-webhook-unified/core/feature-flags.ts:80*

---

### `hashString`

Simple string hash function

*Source: supabase/functions/wa-webhook-unified/core/feature-flags.ts:97*

---

### `updateFeatureFlags`

Update feature flags in database

*Source: supabase/functions/wa-webhook-unified/core/feature-flags.ts:110*

---

### `unnamed`

Location Handler for Unified Service Provides location resolution with the standard 3-tier approach: 1. Use incoming location message (if provided) 2. Check 30-minute cache 3. Use saved home location

*Source: supabase/functions/wa-webhook-unified/core/location-handler.ts:1*

---

### `resolveUnifiedLocation`

Resolve location for a user using the 3-tier approach

*Source: supabase/functions/wa-webhook-unified/core/location-handler.ts:28*

---

### `cacheUnifiedLocation`

Cache location for future use (30-minute TTL)

*Source: supabase/functions/wa-webhook-unified/core/location-handler.ts:137*

---

### `formatLocationContext`

Format location context for display to user

*Source: supabase/functions/wa-webhook-unified/core/location-handler.ts:182*

---

### `unnamed`

Unified Agent Orchestrator Central routing and session management for all domain agents. Handles: - Session lifecycle (create, load, save) - Intent classification (keyword + LLM hybrid) - Agent registry and routing - Agent handoff coordination - Response formatting and sending

*Source: supabase/functions/wa-webhook-unified/core/orchestrator.ts:1*

---

### `unnamed`

Main entry point: Process incoming WhatsApp message Returns the agent's response text for synchronous callers (e.g., admin panel)

*Source: supabase/functions/wa-webhook-unified/core/orchestrator.ts:39*

---

### `unnamed`

Determine which agent should handle this message

*Source: supabase/functions/wa-webhook-unified/core/orchestrator.ts:161*

---

### `unnamed`

Send response to user via WhatsApp

*Source: supabase/functions/wa-webhook-unified/core/orchestrator.ts:215*

---

### `unnamed`

Unified Types for All Domain Agents

*Source: supabase/functions/wa-webhook-unified/core/types.ts:1*

---

### `unnamed`

Session Manager Manages unified session lifecycle: - Load/create sessions from database - Update session state - Save sessions back to database - Handle session expiration

*Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:1*

---

### `unnamed`

Get or create a session for a user

*Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:17*

---

### `unnamed`

Save session to database

*Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:70*

---

### `unnamed`

Add message to session conversation history

*Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:90*

---

### `unnamed`

Clear session flow state

*Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:112*

---

### `unnamed`

Expire session

*Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:121*

---

### `unnamed`

Map database row to UnifiedSession

*Source: supabase/functions/wa-webhook-unified/core/session-manager.ts:131*

---

### `unnamed`

Intent Classifier Hybrid intent classification using: 1. Keyword matching (fast, deterministic) 2. LLM classification (accurate, context-aware) Determines which agent should handle a message based on: - Keywords in message - Conversation history - User context

*Source: supabase/functions/wa-webhook-unified/core/intent-classifier.ts:1*

---

### `unnamed`

Classify intent to determine which agent should handle the message

*Source: supabase/functions/wa-webhook-unified/core/intent-classifier.ts:64*

---

### `unnamed`

Classify based on keyword matching

*Source: supabase/functions/wa-webhook-unified/core/intent-classifier.ts:97*

---

### `unnamed`

Classify using LLM (Gemini) TODO: Implement this for more accurate classification

*Source: supabase/functions/wa-webhook-unified/core/intent-classifier.ts:159*

---

### `unnamed`

Insurance Agent Motor insurance assistant for Rwanda. Helps with quotes, renewals, and policy management.

*Source: supabase/functions/wa-webhook-unified/agents/insurance-agent.ts:1*

---

### `unnamed`

Farmer Agent Agricultural assistant for farmers in Rwanda. Helps with marketplace, advisory, and services.

*Source: supabase/functions/wa-webhook-unified/agents/farmer-agent.ts:1*

---

### `unnamed`

Base Agent Class Abstract base class that all domain agents extend. Provides common functionality: - AI processing logic - Flow management (structured multi-step processes) - Tool execution framework - Session context building - Handoff protocol

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:1*

---

### `unnamed`

Main processing logic - called by orchestrator

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:54*

---

### `unnamed`

Start a structured flow Override in subclasses to implement domain-specific flows

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:94*

---

### `unnamed`

Continue a structured flow Override in subclasses to implement domain-specific flows

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:105*

---

### `unnamed`

Call AI (Gemini) to process message with database-driven config

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:116*

---

### `unnamed`

Load agent configuration from database

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:143*

---

### `unnamed`

Build system prompt with database config and session context

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:153*

---

### `unnamed`

Build system prompt with session context (synchronous fallback)

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:208*

---

### `unnamed`

Build conversation history for AI context

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:231*

---

### `unnamed`

Parse AI response JSON

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:244*

---

### `unnamed`

Execute a tool call Override in subclasses to implement domain-specific tools

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:268*

---

### `unnamed`

Helper: Send WhatsApp message

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:282*

---

### `unnamed`

Helper: Format list response

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:294*

---

### `unnamed`

Helper: Format button response

*Source: supabase/functions/wa-webhook-unified/agents/base-agent.ts:311*

---

### `unnamed`

Rides Agent Transport and ride-sharing assistant. Connects drivers with passengers and manages trip scheduling.

*Source: supabase/functions/wa-webhook-unified/agents/rides-agent.ts:1*

---

### `unnamed`

Jobs Agent Hybrid AI + structured flows for job search and posting. Combines conversational AI with multi-step structured processes.

*Source: supabase/functions/wa-webhook-unified/agents/jobs-agent.ts:1*

---

### `unnamed`

Override to handle structured flows

*Source: supabase/functions/wa-webhook-unified/agents/jobs-agent.ts:125*

---

### `unnamed`

Override to handle flow continuation

*Source: supabase/functions/wa-webhook-unified/agents/jobs-agent.ts:157*

---

### `unnamed`

Property Agent Hybrid AI + structured flows for property rentals. Combines conversational AI with multi-step structured processes.

*Source: supabase/functions/wa-webhook-unified/agents/property-agent.ts:1*

---

### `unnamed`

Business Broker Agent Business opportunities and partnership facilitation.

*Source: supabase/functions/wa-webhook-unified/agents/business-broker-agent.ts:1*

---

### `unnamed`

Sales Agent Sales and customer management assistant.

*Source: supabase/functions/wa-webhook-unified/agents/sales-agent.ts:1*

---

### `unnamed`

Support Agent Fallback agent for general queries and navigation. Helps users understand available services and routes to appropriate agents.

*Source: supabase/functions/wa-webhook-unified/agents/support-agent.ts:1*

---

### `unnamed`

Override process to handle simple menu-based navigation

*Source: supabase/functions/wa-webhook-unified/agents/support-agent.ts:81*

---

### `unnamed`

Show services menu

*Source: supabase/functions/wa-webhook-unified/agents/support-agent.ts:99*

---

### `unnamed`

Execute tool calls

*Source: supabase/functions/wa-webhook-unified/agents/support-agent.ts:146*

---

### `unnamed`

Agent Registry Central registry for all domain agents. Manages agent instantiation and lookup. OFFICIAL AGENTS (10 production agents matching agent_registry database): 1. farmer - Farmer AI Agent 2. insurance - Insurance AI Agent 3. sales_cold_caller - Sales/Marketing Cold Caller AI Agent 4. rides - Rides AI Agent 5. jobs - Jobs AI Agent 6. waiter - Waiter AI Agent 7. real_estate - Real Estate AI Agent 8. marketplace - Marketplace AI Agent (includes pharmacy, hardware, shop) 9. support - Support AI Agent (includes concierge routing) 10. business_broker - Business Broker AI Agent (includes legal intake)

*Source: supabase/functions/wa-webhook-unified/agents/registry.ts:1*

---

### `unnamed`

Get agent instance by type Lazy-loads agents on first access

*Source: supabase/functions/wa-webhook-unified/agents/registry.ts:40*

---

### `unnamed`

Create agent instance based on the 10 official agent types

*Source: supabase/functions/wa-webhook-unified/agents/registry.ts:51*

---

### `unnamed`

Clear agent cache (useful for testing)

*Source: supabase/functions/wa-webhook-unified/agents/registry.ts:110*

---

### `unnamed`

Waiter Agent Restaurant and food ordering assistant. Helps users discover restaurants, view menus, and place orders.

*Source: supabase/functions/wa-webhook-unified/agents/waiter-agent.ts:1*

---

### `unnamed`

Unified Commerce Agent World-class commerce agent that combines: - Marketplace (buy/sell products) - Business Directory (find businesses/services) - Business Broker (partnerships/investments) Features: - Natural language conversational flows - Location-based proximity matching - Payment integration (MoMo USSD) - Photo uploads - Google Places API integration - Rating & review system - Content moderation - Escrow for high-value transactions

*Source: supabase/functions/wa-webhook-unified/agents/commerce-agent.ts:1*

---

### `unnamed`

Override process to handle commerce-specific logic

*Source: supabase/functions/wa-webhook-unified/agents/commerce-agent.ts:455*

---

### `unnamed`

Get welcome message

*Source: supabase/functions/wa-webhook-unified/agents/commerce-agent.ts:506*

---

### `unnamed`

Execute tool calls

*Source: supabase/functions/wa-webhook-unified/agents/commerce-agent.ts:533*

---

### `unnamed`

Marketplace Agent Natural language AI agent for connecting buyers and sellers in Rwanda. Migrated from wa-webhook-marketplace to unified architecture. Features: - Conversational selling flow (create listings) - Conversational buying flow (search and match) - Proximity-based matching - Integration with business directory

*Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:1*

---

### `unnamed`

Override process to handle marketplace-specific logic

*Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:134*

---

### `unnamed`

Execute tool calls

*Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:205*

---

### `unnamed`

Create a new marketplace listing

*Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:243*

---

### `unnamed`

Search for matching listings and businesses

*Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:301*

---

### `unnamed`

Notify matching buyers when a new listing is created

*Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:372*

---

### `unnamed`

Format search results for display

*Source: supabase/functions/wa-webhook-unified/agents/marketplace-agent.ts:427*

---

### `unnamed`

WA-Webhook-Unified - Unified AI Agent Microservice Consolidates all AI agent-based WhatsApp webhook services: - wa-webhook-ai-agents (Farmer, Waiter, Support, Insurance, Rides, Sales, Business Broker) - wa-webhook-marketplace (Buy/Sell, Shops) - wa-webhook-jobs (Job Board) - wa-webhook-property (Real Estate) Features: - Unified session management - Hybrid intent classification (keyword + LLM) - Seamless cross-domain agent handoffs - Structured flows for complex processes

*Source: supabase/functions/wa-webhook-unified/index.ts:1*

---

### `maskPhone`

Mask phone number for logging (PII protection)

*Source: supabase/functions/wa-webhook-unified/index.ts:278*

---

### `extractWhatsAppMessage`

Extract WhatsApp message from webhook payload

*Source: supabase/functions/wa-webhook-unified/index.ts:292*

---

### `checkExpiringSessions`

Check for sessions approaching deadline Send "need more time?" prompts to users

*Source: supabase/functions/agent-monitor/index.ts:28*

---

### `checkTimeouts`

Check for timed out sessions Mark sessions past deadline as timeout

*Source: supabase/functions/agent-monitor/index.ts:88*

---

### `expireOldQuotes`

Expire old quotes

*Source: supabase/functions/agent-monitor/index.ts:160*

---

### `sendExpiringWarning`

Send warning about approaching deadline

*Source: supabase/functions/agent-monitor/index.ts:193*

---

### `sendPartialResultsOffer`

Offer to present partial results

*Source: supabase/functions/agent-monitor/index.ts:211*

---

### `presentPartialResults`

Present partial results to user

*Source: supabase/functions/agent-monitor/index.ts:230*

---

### `notifyNoResults`

Notify user of no results

*Source: supabase/functions/agent-monitor/index.ts:241*

---

### `unnamed`

Main handler

*Source: supabase/functions/agent-monitor/index.ts:254*

---

### `unnamed`

wa-webhook-insurance - Insurance Service Handles insurance document submission, OCR, claims, and support

*Source: supabase/functions/wa-webhook-insurance/index-refactored.ts:1*

---

### `handleInsuranceHelp`

Handle insurance help request - show admin contacts

*Source: supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts:544*

---

### `startCustomerSupportChat`

Start customer support AI chat

*Source: supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts:33*

---

### `handleCustomerSupportMessage`

Handle customer support AI message

*Source: supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts:93*

---

### `escalateToHumanSupport`

Escalate to human support - show contact numbers

*Source: supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts:204*

---

### `endAIChat`

End AI chat session

*Source: supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts:261*

---

### `unnamed`

AI Agents Integration Module Connects database search agents with the WhatsApp webhook system. Agents search ONLY from database - NO web search or external APIs. All agents must have proper error handling and fallback messages.

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:1*

---

### `routeToAIAgent`

Route request to appropriate AI agent based on intent

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:40*

---

### `invokeDriverAgent`

Invoke Nearby Drivers Agent - DATABASE SEARCH ONLY

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:103*

---

### `invokePharmacyAgent`

Invoke Pharmacy Agent - DATABASE SEARCH ONLY

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:159*

---

### `invokePropertyAgent`

Invoke Property Rental Agent - DATABASE SEARCH ONLY

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:213*

---

### `unnamed`

Invoke Schedule Trip Agent - DATABASE SEARCH ONLY

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:271*

---

### `invokeScheduleTripAgent`

Invoke Schedule Trip Agent - WITH ENHANCED 3-TIER FALLBACK Fallback strategy: 1. Try AI agent scheduling (primary) 2. Fall back to direct database insert (manual scheduling) 3. Return user-friendly error with alternatives

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:274*

---

### `invokeShopsAgent`

Invoke General Shops Agent - DATABASE SEARCH ONLY

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:403*

---

### `invokeQuincaillerieAgent`

Invoke Quincaillerie (Hardware Store) Agent - DATABASE SEARCH ONLY

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:457*

---

### `sendAgentOptions`

Send agent options to user as interactive list with fallback buttons

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:509*

---

### `handleAgentSelection`

Handle agent option selection with proper error handling

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:570*

---

### `checkAgentSessionStatus`

Check agent session status with proper error handling

*Source: supabase/functions/wa-webhook-mobility/ai-agents/integration.ts:670*

---

### `handleGeneralBrokerStart`

Start General Broker AI Agent Routes user to the general broker AI agent for service requests

*Source: supabase/functions/wa-webhook-mobility/ai-agents/general_broker.ts:6*

---

### `unnamed`

AI Agent Handlers for WhatsApp Flows Provides convenient handlers that can be called from the text router to initiate AI agent sessions for various use cases.

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:1*

---

### `handleAINearbyDrivers`

Handle "Nearby Drivers" request with AI agent DATABASE SEARCH ONLY - No web search

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:39*

---

### `handleAINearbyPharmacies`

Handle "Nearby Pharmacies" request with AI agent

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:136*

---

### `handleAINearbyQuincailleries`

Handle "Nearby Quincailleries" request with AI agent

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:263*

---

### `handleAINearbyShops`

Handle "Nearby Shops" request with AI agent TWO-PHASE APPROACH: Phase 1: Immediately show top 9 nearby shops from database Phase 2: AI agent processes in background for curated shortlist

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:390*

---

### `handleAIPropertyRental`

Handle "Property Rental" request with AI agent

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:446*

---

### `handleAIScheduleTrip`

Handle "Schedule Trip" request with AI agent

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:541*

---

### `handleAIAgentOptionSelection`

Handle AI agent selection from interactive list

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:602*

---

### `handleAIAgentLocationUpdate`

Handle location update for pending AI agent request

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:627*

---

### `triggerShopsAgentBackground`

Phase 2: Background AI agent processing for shops Agent contacts shops on behalf of user to create curated shortlist

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:699*

---

### `sendShopDatabaseResults`

Phase 1: Send immediate database results (top 9 nearby shops) This provides instant results while AI agent processes in background

*Source: supabase/functions/wa-webhook-mobility/ai-agents/handlers.ts:763*

---

### `unnamed`

AI Agents Module Central export point for all AI agent functionality in the WhatsApp webhook system.

*Source: supabase/functions/wa-webhook-mobility/ai-agents/index.ts:1*

---

### `unnamed`

Enhanced Middleware Integration for wa-webhook Provides middleware functions that integrate rate limiting, caching, error handling, and metrics without modifying existing code. These can be optionally integrated into the existing pipeline.

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:1*

---

### `applyRateLimiting`

Apply rate limiting middleware Can be called from existing pipeline to add rate limiting

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:21*

---

### `trackWebhookMetrics`

Track webhook metrics

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:68*

---

### `getCachedUserContext`

Cache user context with automatic expiration Can be used in message_context.ts to cache user lookups

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:92*

---

### `wrapError`

Wrap error with enhanced error handling Can be used in existing try-catch blocks to enhance error responses

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:109*

---

### `addRateLimitHeaders`

Add rate limit headers to response

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:135*

---

### `enhanceWebhookRequest`

Middleware function to enhance PreparedWebhook This can be called after processWebhookRequest to add enhancements

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:160*

---

### `logWebhookCompletion`

Log webhook processing completion

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:197*

---

### `processMessageWithEnhancements`

Example: Enhanced message processor wrapper This shows how to wrap existing handleMessage calls with enhancements

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:225*

---

### `areEnhancementsEnabled`

Utility to check if enhancements are enabled

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:288*

---

### `getEnhancementConfig`

Get enhancement configuration

*Source: supabase/functions/wa-webhook-mobility/utils/middleware.ts:297*

---

### `unnamed`

Message Deduplication and Queue Integration Provides deduplication checking against the database and queue integration for reliable message processing.

*Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:1*

---

### `isNewMessage`

Check if a message has already been processed (database-backed deduplication)

*Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:14*

---

### `markMessageProcessed`

Mark a message as processed

*Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:67*

---

### `enqueueMessage`

Add message to processing queue

*Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:115*

---

### `getOrCreateConversationMemory`

Get or create AI conversation memory

*Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:175*

---

### `updateConversationMemory`

Update AI conversation memory

*Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:272*

---

### `cleanupOldConversations`

Cleanup old conversation memories (older than 7 days with no activity)

*Source: supabase/functions/wa-webhook-mobility/utils/message-deduplication.ts:346*

---

### `unnamed`

Enhanced Error Handling for wa-webhook Provides structured error handling with classification, user notifications, and retry logic. Complements existing error handling.

*Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:1*

---

### `normalizeError`

Normalize any error to WebhookError

*Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:71*

---

### `handleWebhookError`

Handle webhook error with logging and optional user notification

*Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:155*

---

### `notifyUserOfError`

Send error notification to user

*Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:187*

---

### `createErrorResponse`

Create error response

*Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:216*

---

### `maskPhone`

Mask phone number for logging (PII protection)

*Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:264*

---

### `isRetryableError`

Check if error is retryable

*Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:272*

---

### `getRetryDelay`

Get retry delay based on attempt number

*Source: supabase/functions/wa-webhook-mobility/utils/error_handler.ts:288*

---

### `unnamed`

Enhanced Health Check for wa-webhook Provides comprehensive health monitoring including rate limiter, cache, and database connectivity.

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:1*

---

### `checkDatabase`

Check database health

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:39*

---

### `checkRateLimiter`

Check rate limiter health

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:78*

---

### `checkCache`

Check cache health

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:100*

---

### `checkMetrics`

Check metrics collector health

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:122*

---

### `performHealthCheck`

Perform comprehensive health check

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:143*

---

### `createHealthCheckResponse`

Create health check response

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:180*

---

### `createLivenessResponse`

Simple liveness probe (for Kubernetes, etc.)

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:201*

---

### `createReadinessResponse`

Readiness probe (checks critical dependencies)

*Source: supabase/functions/wa-webhook-mobility/utils/health_check.ts:211*

---

### `unnamed`

Dynamic Submenu Helper Provides reusable functions to fetch and display dynamic submenus from database Eliminates hardcoded menu lists

*Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:1*

---

### `fetchSubmenuItems`

Fetch submenu items for a parent menu from database

*Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:21*

---

### `fetchProfileMenuItems`

Fetch profile menu items from database

*Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:51*

---

### `submenuItemsToRows`

Convert submenu items to WhatsApp list row format

*Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:85*

---

### `getSubmenuRows`

Get submenu items as WhatsApp rows with back button Convenience function that combines fetch + convert + add back button

*Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:106*

---

### `hasSubmenu`

Check if a submenu exists and has items

*Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:143*

---

### `getSubmenuAction`

Get the default action for a submenu item Used for routing based on action_type

*Source: supabase/functions/wa-webhook-mobility/utils/dynamic_submenu.ts:159*

---

### `unnamed`

Increment a counter

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:36*

---

### `unnamed`

Set a gauge value

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:50*

---

### `unnamed`

Record a histogram value (for durations, sizes, etc.)

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:63*

---

### `unnamed`

Get dimension key for grouping

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:81*

---

### `unnamed`

Parse dimension key back to object

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:95*

---

### `unnamed`

Calculate histogram statistics

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:110*

---

### `unnamed`

Flush metrics to logs

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:151*

---

### `unnamed`

Get metrics in Prometheus format (for /metrics endpoint)

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:206*

---

### `unnamed`

Get summary statistics

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:260*

---

### `unnamed`

Start periodic flushing

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:271*

---

### `unnamed`

Stop flushing and cleanup

*Source: supabase/functions/wa-webhook-mobility/utils/metrics_collector.ts:282*

---

### `unnamed`

Get value from cache

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:48*

---

### `unnamed`

Set value in cache

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:71*

---

### `unnamed`

Get or set value using factory function

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:94*

---

### `unnamed`

Delete from cache

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:112*

---

### `unnamed`

Clear all cache

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:123*

---

### `unnamed`

Check if cache contains key

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:135*

---

### `unnamed`

Evict least recently used entry

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:148*

---

### `unnamed`

Clean up expired entries

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:172*

---

### `unnamed`

Get cache statistics

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:195*

---

### `unnamed`

Check if cache is healthy

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:212*

---

### `unnamed`

Start periodic cleanup

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:219*

---

### `unnamed`

Cleanup resources

*Source: supabase/functions/wa-webhook-mobility/utils/cache.ts:231*

---

### `unnamed`

Check if identifier should be rate limited

*Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:48*

---

### `unnamed`

Manually unblock an identifier

*Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:120*

---

### `unnamed`

Get statistics for monitoring

*Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:128*

---

### `unnamed`

Mask identifier for logging (PII protection)

*Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:143*

---

### `unnamed`

Cleanup expired buckets

*Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:151*

---

### `unnamed`

Start periodic cleanup

*Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:174*

---

### `unnamed`

Stop cleanup (for testing/shutdown)

*Source: supabase/functions/wa-webhook-mobility/utils/rate_limiter.ts:183*

---

### `validateAndLoadConfig`

Validate and load configuration

*Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:54*

---

### `getEnv`

Get environment variable with fallback to multiple keys

*Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:116*

---

### `loadConfig`

Load configuration with defaults

*Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:127*

---

### `printConfigStatus`

Print configuration status

*Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:174*

---

### `assertConfigValid`

Assert configuration is valid (throws if not)

*Source: supabase/functions/wa-webhook-mobility/utils/config_validator.ts:202*

---

### `encodeTelUriForQr`

Encodes a USSD string as a tel: URI for QR codes. Android QR scanner apps often fail to decode percent-encoded characters before passing the URI to the dialer. This function leaves * and # unencoded for better Android compatibility while maintaining iOS support.

*Source: supabase/functions/wa-webhook-mobility/utils/ussd.ts:14*

---

### `buildMomoUssdForQr`

Builds MOMO USSD code with tel URI optimized for QR codes. Uses unencoded * and # for better Android QR scanner compatibility.

*Source: supabase/functions/wa-webhook-mobility/utils/momo.ts:16*

---

### `unnamed`

wa-webhook-mobility - Mobility Service Handles ride-hailing, scheduling, and driver management

*Source: supabase/functions/wa-webhook-mobility/index-refactored.ts:1*

---

### `logEvent`

Observability Logger Simple event logging for mobility webhook

*Source: supabase/functions/wa-webhook-mobility/observe/logger.ts:1*

---

### `saveLocationToCache`

Save user's location to cache (profile.last_location)

*Source: supabase/functions/wa-webhook-mobility/locations/cache.ts:15*

---

### `getCachedLocation`

Get cached location if still valid (within 30 minutes) Returns null if no cached location or if expired

*Source: supabase/functions/wa-webhook-mobility/locations/cache.ts:34*

---

### `hasValidCachedLocation`

Check if user has valid cached location

*Source: supabase/functions/wa-webhook-mobility/locations/cache.ts:70*

---

### `unnamed`

Driver License OCR Module Processes driver's licenses using OCR (OpenAI Vision + Gemini fallback) Validates license data including expiry dates

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:1*

---

### `runGeminiOCR`

Process license using Gemini Vision API

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:75*

---

### `runOpenAIOCR`

Process license using OpenAI Vision API

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:136*

---

### `processDriverLicense`

Process driver license with OCR Uses OpenAI Vision API with Gemini fallback

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:238*

---

### `validateLicenseData`

Validate extracted license data

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:264*

---

### `saveLicenseCertificate`

Save license certificate to database

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_license_ocr.ts:320*

---

### `unnamed`

Driver Insurance OCR Module Processes driver insurance certificates using OCR (OpenAI Vision + Gemini fallback) Validates insurance data and checks for duplicate vehicles

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:1*

---

### `runGeminiOCR`

Process insurance certificate using Gemini Vision API

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:89*

---

### `runOpenAIOCR`

Process insurance certificate using OpenAI Vision API

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:150*

---

### `processDriverInsuranceCertificate`

Process driver insurance certificate with OCR Uses OpenAI Vision API with Gemini fallback

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:252*

---

### `validateInsuranceData`

Validate extracted insurance data

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:278*

---

### `checkDuplicateVehicle`

Check if vehicle plate is already registered by another user

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:325*

---

### `saveInsuranceCertificate`

Save insurance certificate to database

*Source: supabase/functions/wa-webhook-mobility/insurance/driver_insurance_ocr.ts:346*

---

### `sendProfileMenu`

Display the Profile menu with options for managing businesses, vehicles, and tokens Delegates to the comprehensive Profile hub implementation

*Source: supabase/functions/wa-webhook-mobility/flows/profile.ts:6*

---

### `initiateTripPayment`

Initiates trip payment via MOMO USSD Generates USSD code and QR for user to dial

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:44*

---

### `handlePaymentConfirmation`

Handles payment confirmation from user Verifies via transaction reference number

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:165*

---

### `processTransactionReference`

Processes transaction reference submitted by user

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:206*

---

### `handleSkipPayment`

Handles skip payment action

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:288*

---

### `normalizeToLocal`

Normalizes phone number to local format (07XXXXXXXX)

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:336*

---

### `buildQrCodeUrl`

Builds QR code URL for USSD code

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:360*

---

### `logPaymentRequest`

Logs payment request to database

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_payment.ts:368*

---

### `handleTripStart`

Handles trip start confirmation 1. Verify both driver and passenger ready 2. Update trip status to 'in_progress' 3. Notify both parties 4. Start real-time tracking 5. Record metric: TRIP_STARTED

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:44*

---

### `handleTripArrivedAtPickup`

Handles driver arrival at pickup location 1. Update trip status to 'driver_arrived' 2. Notify passenger 3. Record metric: DRIVER_ARRIVED

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:139*

---

### `handleTripPickedUp`

Handles trip start (passenger picked up) 1. Update trip status to 'in_progress' 2. Notify passenger trip started 3. Record metric: TRIP_PICKED_UP

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:204*

---

### `handleTripComplete`

Handles trip completion 1. Update trip status to 'completed' 2. Calculate final fare 3. Initiate payment 4. Request ratings from both parties 5. Record metrics: TRIP_COMPLETED, TRIP_DURATION

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:270*

---

### `handleTripCancel`

Handles trip cancellation 1. Update trip status 2. Calculate cancellation fee (if applicable) 3. Notify other party 4. Record metric: TRIP_CANCELLED

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:439*

---

### `handleTripRating`

Handles trip rating 1. Validate rating (1-5) 2. Insert into trip_ratings table 3. Update user's average rating 4. Record metric: TRIP_RATED

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:573*

---

### `getTripStatus`

Get trip status

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:684*

---

### `canPerformAction`

Check if user can perform action on trip

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.ts:712*

---

### `calculateFareEstimate`

Calculates fare estimate for a trip Used before trip starts to show estimated cost

*Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:255*

---

### `calculateActualFare`

Calculates actual fare after trip completion Uses actual distance and time from trip

*Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:365*

---

### `calculateSurgeMultiplier`

Calculates surge pricing multiplier based on current conditions TODO: Implement dynamic surge based on real demand/supply data

*Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:444*

---

### `calculateCancellationFee`

Calculates cancellation fee based on trip status TODO: Make configurable per business rules

*Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:482*

---

### `formatFare`

Formats fare for display

*Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:513*

---

### `formatFareBreakdown`

Formats fare breakdown for display

*Source: supabase/functions/wa-webhook-mobility/handlers/fare.ts:527*

---

### `updateDriverLocation`

Updates driver location during active trip 1. Validate trip is in progress 2. Update driver_status table 3. Calculate new ETA 4. Notify passenger if ETA changes significantly (>5 minutes) 5. Record metric: LOCATION_UPDATE

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:43*

---

### `calculateETA`

Calculates estimated time of arrival Uses simple haversine distance + average speed In production, should integrate with Google Maps Distance Matrix API

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:183*

---

### `unnamed`

TODO: Enhanced ETA calculation using Google Maps Distance Matrix API export async function calculateETAWithMaps( origin: Coordinates, destination: Coordinates ): Promise<ETACalculation> { const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY"); const response = await fetch( `https://maps.googleapis.com/maps/api/distancematrix/json?` + `origins=${origin.latitude},${origin.longitude}&` + `destinations=${destination.latitude},${destination.longitude}&` + `mode=driving&` + `key=${apiKey}` ); const data = await response.json(); const element = data.rows[0].elements[0]; if (element.status === "OK") { const distanceKm = element.distance.value / 1000; const durationMinutes = Math.ceil(element.duration.value / 60); const estimatedArrival = new Date(Date.now() + durationMinutes * 60000); return { distanceKm, durationMinutes, estimatedArrival }; } // Fallback to haversine if API fails return calculateETA(origin, destination); }

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:234*

---

### `startDriverTracking`

Starts driver tracking for active trip In production, this would enable real-time location streaming

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:271*

---

### `stopDriverTracking`

Stops driver tracking when trip ends

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:308*

---

### `getDriverLocation`

Gets driver's current location

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:347*

---

### `getTripProgress`

Gets trip progress (for passenger view)

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:378*

---

### `isValidCoordinates`

Validates coordinates are within valid ranges

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:444*

---

### `calculateHaversineDistance`

Calculates distance between two coordinates using Haversine formula Returns distance in kilometers

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:460*

---

### `toRadians`

Converts degrees to radians

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:485*

---

### `calculateSpeed`

Estimates speed based on consecutive location updates

*Source: supabase/functions/wa-webhook-mobility/handlers/tracking.ts:492*

---

### `unnamed`

Location cache validation utilities Helpers for validating cached location timestamps and ensuring location data is fresh enough for nearby matching.

*Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:1*

---

### `isLocationCacheValid`

Check if a cached location timestamp is still valid

*Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:14*

---

### `getLocationCacheAge`

Calculate how many minutes ago a location was cached

*Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:48*

---

### `formatLocationCacheAge`

Format cache age as human-readable string

*Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:74*

---

### `checkLocationCache`

Check if location needs refresh and return appropriate message

*Source: supabase/functions/wa-webhook-mobility/handlers/location_cache.ts:95*

---

### `checkDriverVerificationStatus`

Checks complete driver verification status

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:56*

---

### `showVerificationMenu`

Shows driver verification menu

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:133*

---

### `startLicenseVerification`

Starts driver's license verification flow

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:213*

---

### `handleLicenseUpload`

Handles driver's license upload

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:250*

---

### `isLicenseExpired`

Checks if license is expired

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:367*

---

### `fetchMediaUrl`

Fetch media from WhatsApp and get data URL

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts:377*

---

### `unnamed`

Driver Insurance Handler Handles driver insurance certificate upload and validation Replaces the old vehicle plate text input flow

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:1*

---

### `hasValidInsurance`

Check if user has valid insurance certificate

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:29*

---

### `getActiveInsurance`

Get active insurance for user

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:48*

---

### `ensureDriverInsurance`

Ensure driver has valid insurance, prompt for upload if not

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:74*

---

### `fetchMediaUrl`

Fetch media from WhatsApp and get signed URL

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:129*

---

### `handleInsuranceCertificateUpload`

Handle insurance certificate upload

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:175*

---

### `ensureVehiclePlate`

Legacy function for backward compatibility Now redirects to insurance upload

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:275*

---

### `getVehiclePlate`

Get vehicle plate from active insurance

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts:286*

---

### `sendDriverQuoteRequest`

Send quote request to a driver

*Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:27*

---

### `formatDriverQuoteRequest`

Format driver quote request message

*Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:66*

---

### `parseDriverQuoteResponse`

Parse driver quote response

*Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:99*

---

### `handleDriverQuoteResponse`

Handle incoming quote response from driver

*Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:143*

---

### `sendQuotePresentationToUser`

Send quote presentation to user

*Source: supabase/functions/wa-webhook-mobility/handlers/agent_quotes.ts:221*

---

### `unnamed`

Driver Verification with OCR Handles driver license and insurance certificate verification Uses OpenAI GPT-4 Vision and Google Gemini for OCR

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:1*

---

### `extractLicenseWithOpenAI`

Extract license data using OpenAI GPT-4 Vision

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:55*

---

### `extractLicenseWithGemini`

Extract license data using Google Gemini Vision

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:154*

---

### `extractInsuranceWithOpenAI`

Extract insurance certificate data using OpenAI

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:256*

---

### `extractInsuranceWithGemini`

Extract insurance certificate data using Gemini

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:335*

---

### `processDriverLicense`

Process driver license upload

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:401*

---

### `processInsuranceCertificate`

Process insurance certificate upload

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_verification_ocr.ts:519*

---

### `parseDriverActionId`

Parse driver action button ID Format: "driver_offer_ride::tripId" or "driver_view_details::tripId"

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_response.ts:17*

---

### `handleDriverOfferRide`

Handle when driver taps "Offer Ride"

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_response.ts:30*

---

### `handleDriverViewDetails`

Handle when driver taps "View Details"

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_response.ts:130*

---

### `routeDriverAction`

Route driver action button presses

*Source: supabase/functions/wa-webhook-mobility/handlers/driver_response.ts:224*

---

### `handleTripStart`

Handles trip start confirmation 1. Verify both driver and passenger ready 2. Update trip status to 'in_progress' 3. Notify both parties 4. Start real-time tracking 5. Record metric: TRIP_STARTED

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:47*

---

### `handleTripArrivedAtPickup`

Handles driver arrival at pickup location 1. Update trip status to 'driver_arrived' 2. Notify passenger 3. Record metric: DRIVER_ARRIVED

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:143*

---

### `handleTripComplete`

Handles trip completion 1. Update trip status to 'completed' 2. Calculate final fare 3. Initiate payment 4. Request ratings from both parties 5. Record metrics: TRIP_COMPLETED, TRIP_DURATION

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:205*

---

### `handleTripCancel`

Handles trip cancellation 1. Update trip status 2. Calculate cancellation fee (if applicable) 3. Notify other party 4. Record metric: TRIP_CANCELLED

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:316*

---

### `handleTripRating`

Handles trip rating 1. Validate rating (1-5) 2. Insert into trip_ratings table 3. Update user's average rating 4. Record metric: TRIP_RATED

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:425*

---

### `getTripStatus`

Get trip status

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:524*

---

### `canPerformAction`

Check if user can perform action on trip

*Source: supabase/functions/wa-webhook-mobility/handlers/trip_lifecycle.backup.ts:552*

---

### `handleRecentSearchSelection`

Handle selection from recent searches list

*Source: supabase/functions/wa-webhook-mobility/handlers/nearby.ts:234*

---

### `showRecentSearches`

Show user's recent search locations for quick re-search Returns true if recent searches were shown, false if none available

*Source: supabase/functions/wa-webhook-mobility/handlers/nearby.ts:704*

---

### `unnamed`

Mobility Handlers Registry Lazy-loaded handler registration for optimal cold starts

*Source: supabase/functions/wa-webhook-mobility/handlers/index.ts:1*

---

### `preloadCriticalHandlers`

Preload handlers that are commonly used Called after initial request to warm up subsequent calls

*Source: supabase/functions/wa-webhook-mobility/handlers/index.ts:56*

---

### `getHandler`

Get handler for action

*Source: supabase/functions/wa-webhook-mobility/handlers/index.ts:71*

---

### `startGoOnline`

Start Go Online flow - prompt driver to share location

*Source: supabase/functions/wa-webhook-mobility/handlers/go_online.ts:21*

---

### `handleGoOnlineLocation`

Handle when driver shares location to go online

*Source: supabase/functions/wa-webhook-mobility/handlers/go_online.ts:68*

---

### `handleGoOnlineUseCached`

Handle using cached location to go online

*Source: supabase/functions/wa-webhook-mobility/handlers/go_online.ts:159*

---

### `handleGoOffline`

Handle going offline

*Source: supabase/functions/wa-webhook-mobility/handlers/go_online.ts:184*

---

### `unnamed`

MOMO USSD Payment Handler Handles MTN Mobile Money USSD payments for ride fares Uses USSD flow: *182*7*1# for payment initiation

*Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:1*

---

### `calculateTripFare`

Calculate fare for a trip

*Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:25*

---

### `initiateTripPayment`

Initialize MOMO payment for a trip

*Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:75*

---

### `handlePaymentConfirmation`

Handle payment confirmation from user

*Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:146*

---

### `verifyMomoPayment`

Verify MOMO payment In production, this would query MTN MOMO API or check reconciliation table

*Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:261*

---

### `handleRefund`

Handle refund request

*Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:289*

---

### `getMomoPaymentStateKey`

Get payment state

*Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:355*

---

### `parsePaymentState`

Parse payment state from stored data

*Source: supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts:362*

---

### `findOnlineDriversForTrip`

Find nearby online drivers for a trip

*Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:19*

---

### `notifyDriver`

Send notification to a driver about a nearby passenger

*Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:53*

---

### `notifyMultipleDrivers`

Notify multiple drivers about a trip

*Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:113*

---

### `handleDriverResponse`

Handle driver's response to ride offer

*Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:151*

---

### `notifyPassengerOfDriverAcceptance`

Notify passenger that a driver has accepted

*Source: supabase/functions/wa-webhook-mobility/notifications/drivers.ts:199*

---

### `unnamed`

Supabase Edge Function: geocode-locations Geocodes bars and businesses using Google Maps Geocoding API Can be triggered manually or via scheduled cron job

*Source: supabase/functions/geocode-locations/index.ts:1*

---

### `unnamed`

wa-webhook-core - Optimized Entry Point Performance-optimized version with caching and lazy loading

*Source: supabase/functions/wa-webhook-core/index.optimized.ts:1*

---

### `sleep`

Sleep for a given duration with optional jitter

*Source: supabase/functions/wa-webhook-core/router.ts:74*

---

### `isRetriable`

Check if an error or status code is retriable

*Source: supabase/functions/wa-webhook-core/router.ts:82*

---

### `unnamed`

wa-webhook-core - Central Router Service Entry point for all WhatsApp webhook messages

*Source: supabase/functions/wa-webhook-core/index-refactored.ts:1*

---

### `unnamed`

Routing Test Script for wa-webhook-core Tests keyword-based routing using the consolidated route config

*Source: supabase/functions/wa-webhook-core/test_routing.ts:3*

---

### `extractPhoneFromPayload`

Extract phone number from WhatsApp webhook payload

*Source: supabase/functions/wa-webhook-core/index.ts:232*

---

### `unnamed`

Health Check Handler Provides service health status

*Source: supabase/functions/wa-webhook-core/handlers/health.ts:1*

---

### `performHealthCheck`

Perform health check

*Source: supabase/functions/wa-webhook-core/handlers/health.ts:13*

---

### `healthResponse`

Create health check response

*Source: supabase/functions/wa-webhook-core/handlers/health.ts:61*

---

### `unnamed`

Webhook Verification Handler Handles WhatsApp webhook verification

*Source: supabase/functions/wa-webhook-core/handlers/webhook.ts:1*

---

### `handleWebhookVerification`

Handle webhook verification (GET request)

*Source: supabase/functions/wa-webhook-core/handlers/webhook.ts:9*

---

### `unnamed`

Home Menu Handler Handles home menu display and navigation

*Source: supabase/functions/wa-webhook-core/handlers/home.ts:1*

---

### `handleHomeMenu`

Handle home menu request

*Source: supabase/functions/wa-webhook-core/handlers/home.ts:12*

---

### `handleBackHome`

Handle back to home button

*Source: supabase/functions/wa-webhook-core/handlers/home.ts:53*

---

### `unnamed`

State Router Routes messages based on current user state

*Source: supabase/functions/wa-webhook-core/router/state-router.ts:1*

---

### `routeByState`

Route message based on current user state

*Source: supabase/functions/wa-webhook-core/router/state-router.ts:51*

---

### `unnamed`

Keyword Router Routes messages based on text content keywords

*Source: supabase/functions/wa-webhook-core/router/keyword-router.ts:1*

---

### `routeByKeyword`

Route message based on keywords in text

*Source: supabase/functions/wa-webhook-core/router/keyword-router.ts:51*

---

### `calculateKeywordScore`

Calculate keyword match score

*Source: supabase/functions/wa-webhook-core/router/keyword-router.ts:114*

---

### `unnamed`

Message Router Determines which service should handle incoming messages

*Source: supabase/functions/wa-webhook-core/router/index.ts:1*

---

### `routeMessage`

Route incoming message to appropriate service

*Source: supabase/functions/wa-webhook-core/router/index.ts:18*

---

### `unnamed`

Service Forwarder Forwards requests to appropriate microservices

*Source: supabase/functions/wa-webhook-core/router/forwarder.ts:1*

---

### `forwardToService`

Forward webhook payload to target service

*Source: supabase/functions/wa-webhook-core/router/forwarder.ts:14*

---

### `forward`

Forward to service by name (convenience function)

*Source: supabase/functions/wa-webhook-core/router/forwarder.ts:88*

---

### `detectLanguage`

Detect dominant language from text

*Source: supabase/functions/_shared/multilingual-utils.ts:18*

---

### `translateText`

Translate text between languages

*Source: supabase/functions/_shared/multilingual-utils.ts:58*

---

### `getLanguageName`

Get language name

*Source: supabase/functions/_shared/multilingual-utils.ts:98*

---

### `getCountryFromLanguage`

Get country from language

*Source: supabase/functions/_shared/multilingual-utils.ts:110*

---

### `unnamed`

Feature Flags for Supabase Edge Functions Provides feature flag checking to control feature rollout. Flags are controlled via environment variables.

*Source: supabase/functions/_shared/feature-flags.ts:1*

---

### `flagToEnvKey`

Convert feature flag name to environment variable name

*Source: supabase/functions/_shared/feature-flags.ts:65*

---

### `getEnvFlag`

Get feature flag value from environment

*Source: supabase/functions/_shared/feature-flags.ts:75*

---

### `isFeatureEnabled`

Check if a feature flag is enabled Priority: 1. Environment variable (FEATURE_*) 2. Consolidated flag for agent.* features (FEATURE_AGENT_ALL) 3. Default value

*Source: supabase/functions/_shared/feature-flags.ts:88*

---

### `requireFeatureFlag`

Require feature flag or throw error

*Source: supabase/functions/_shared/feature-flags.ts:122*

---

### `getAllFeatureFlags`

Get all feature flag states (for debugging/admin endpoints)

*Source: supabase/functions/_shared/feature-flags.ts:138*

---

### `validateBody`

Validate request body against schema Returns parsed data or throws validation error

*Source: supabase/functions/_shared/validation.ts:61*

---

### `validationErrorResponse`

Create validation error response

*Source: supabase/functions/_shared/validation.ts:77*

---

### `isRateLimited`

Check if request exceeds rate limit

*Source: supabase/functions/_shared/validation.ts:114*

---

### `rateLimitErrorResponse`

Create rate limit error response

*Source: supabase/functions/_shared/validation.ts:159*

---

### `cleanupRateLimitStore`

Cleanup expired rate limit entries (run periodically)

*Source: supabase/functions/_shared/validation.ts:181*

---

### `getClientIP`

Extract IP address from request

*Source: supabase/functions/_shared/validation.ts:196*

---

### `getUserIdentifier`

Extract user identifier from request (for user-based rate limiting)

*Source: supabase/functions/_shared/validation.ts:215*

---

### `withCorrelationId`

Wrap a handler function with correlation ID handling

*Source: supabase/functions/_shared/middleware/correlation.ts:27*

---

### `getCorrelationId`

Extract correlation ID from request (for use without middleware)

*Source: supabase/functions/_shared/middleware/correlation.ts:74*

---

### `unnamed`

Request Deduplication Middleware Prevents duplicate message processing

*Source: supabase/functions/_shared/middleware/deduplication.ts:1*

---

### `unnamed`

Time window for deduplication in milliseconds

*Source: supabase/functions/_shared/middleware/deduplication.ts:14*

---

### `unnamed`

Maximum entries to track

*Source: supabase/functions/_shared/middleware/deduplication.ts:16*

---

### `unnamed`

Key extraction function

*Source: supabase/functions/_shared/middleware/deduplication.ts:18*

---

### `checkDuplicate`

Check if request is a duplicate

*Source: supabase/functions/_shared/middleware/deduplication.ts:51*

---

### `deduplicationMiddleware`

Deduplication middleware

*Source: supabase/functions/_shared/middleware/deduplication.ts:80*

---

### `getDeduplicationStats`

Get deduplication stats

*Source: supabase/functions/_shared/middleware/deduplication.ts:136*

---

### `clearDeduplicationCache`

Clear deduplication cache

*Source: supabase/functions/_shared/middleware/deduplication.ts:143*

---

### `unnamed`

Supabase Client Pool Manages Supabase client instances for optimal connection reuse

*Source: supabase/functions/_shared/database/client-pool.ts:1*

---

### `unnamed`

Maximum number of clients to pool

*Source: supabase/functions/_shared/database/client-pool.ts:15*

---

### `unnamed`

Idle timeout in milliseconds

*Source: supabase/functions/_shared/database/client-pool.ts:17*

---

### `unnamed`

Enable health checks

*Source: supabase/functions/_shared/database/client-pool.ts:19*

---

### `unnamed`

Health check interval in milliseconds

*Source: supabase/functions/_shared/database/client-pool.ts:21*

---

### `unnamed`

Initialize the pool

*Source: supabase/functions/_shared/database/client-pool.ts:58*

---

### `unnamed`

Get a client from the pool

*Source: supabase/functions/_shared/database/client-pool.ts:78*

---

### `unnamed`

Get pool statistics

*Source: supabase/functions/_shared/database/client-pool.ts:107*

---

### `unnamed`

Cleanup idle clients

*Source: supabase/functions/_shared/database/client-pool.ts:127*

---

### `unnamed`

Shutdown the pool

*Source: supabase/functions/_shared/database/client-pool.ts:149*

---

### `getClientPool`

Get the client pool instance

*Source: supabase/functions/_shared/database/client-pool.ts:215*

---

### `getPooledClient`

Get a Supabase client from the pool

*Source: supabase/functions/_shared/database/client-pool.ts:225*

---

### `getSupabaseClient`

Quick access to Supabase client (creates if needed)

*Source: supabase/functions/_shared/database/client-pool.ts:232*

---

### `unnamed`

Query Builder Optimized query construction with common patterns

*Source: supabase/functions/_shared/database/query-builder.ts:1*

---

### `unnamed`

Select specific columns

*Source: supabase/functions/_shared/database/query-builder.ts:52*

---

### `unnamed`

Add equality filter

*Source: supabase/functions/_shared/database/query-builder.ts:60*

---

### `unnamed`

Add not equal filter

*Source: supabase/functions/_shared/database/query-builder.ts:68*

---

### `unnamed`

Add greater than filter

*Source: supabase/functions/_shared/database/query-builder.ts:76*

---

### `unnamed`

Add greater than or equal filter

*Source: supabase/functions/_shared/database/query-builder.ts:84*

---

### `unnamed`

Add less than filter

*Source: supabase/functions/_shared/database/query-builder.ts:92*

---

### `unnamed`

Add less than or equal filter

*Source: supabase/functions/_shared/database/query-builder.ts:100*

---

### `unnamed`

Add IN filter

*Source: supabase/functions/_shared/database/query-builder.ts:108*

---

### `unnamed`

Add LIKE filter

*Source: supabase/functions/_shared/database/query-builder.ts:116*

---

### `unnamed`

Add ILIKE filter (case insensitive)

*Source: supabase/functions/_shared/database/query-builder.ts:124*

---

### `unnamed`

Add IS NULL filter

*Source: supabase/functions/_shared/database/query-builder.ts:132*

---

### `unnamed`

Add IS NOT NULL filter

*Source: supabase/functions/_shared/database/query-builder.ts:140*

---

### `unnamed`

Set order by

*Source: supabase/functions/_shared/database/query-builder.ts:148*

---

### `unnamed`

Set limit

*Source: supabase/functions/_shared/database/query-builder.ts:157*

---

### `unnamed`

Set offset

*Source: supabase/functions/_shared/database/query-builder.ts:165*

---

### `unnamed`

Enable count

*Source: supabase/functions/_shared/database/query-builder.ts:173*

---

### `unnamed`

Apply pagination

*Source: supabase/functions/_shared/database/query-builder.ts:181*

---

### `unnamed`

Execute query

*Source: supabase/functions/_shared/database/query-builder.ts:191*

---

### `unnamed`

Execute and get single result

*Source: supabase/functions/_shared/database/query-builder.ts:261*

---

### `query`

Create query builder for table

*Source: supabase/functions/_shared/database/query-builder.ts:273*

---

### `unnamed`

Optimized Queries Pre-built optimized queries for common operations

*Source: supabase/functions/_shared/database/optimized-queries.ts:1*

---

### `getProfileById`

Get profile by ID (optimized with minimal fields)

*Source: supabase/functions/_shared/database/optimized-queries.ts:15*

---

### `getProfileByPhone`

Get profile by phone (optimized)

*Source: supabase/functions/_shared/database/optimized-queries.ts:38*

---

### `findNearbyDrivers`

Find nearby drivers (optimized with spatial query hint)

*Source: supabase/functions/_shared/database/optimized-queries.ts:60*

---

### `findNearbyDriversFallback`

Fallback query without PostGIS

*Source: supabase/functions/_shared/database/optimized-queries.ts:113*

---

### `getActiveTrip`

Get active trip for user

*Source: supabase/functions/_shared/database/optimized-queries.ts:158*

---

### `getRecentInsuranceLead`

Get recent insurance lead

*Source: supabase/functions/_shared/database/optimized-queries.ts:179*

---

### `getUserClaims`

Get user claims

*Source: supabase/functions/_shared/database/optimized-queries.ts:199*

---

### `getWalletBalance`

Get wallet balance (optimized)

*Source: supabase/functions/_shared/database/optimized-queries.ts:223*

---

### `getTransactionHistory`

Get transaction history

*Source: supabase/functions/_shared/database/optimized-queries.ts:238*

---

### `calculateDistance`

Calculate distance between two points (Haversine formula)

*Source: supabase/functions/_shared/database/optimized-queries.ts:263*

---

### `downloadWhatsAppAudio`

Download audio from WhatsApp Cloud API

*Source: supabase/functions/_shared/voice-handler.ts:13*

---

### `transcribeAudio`

Transcribe audio using OpenAI Whisper

*Source: supabase/functions/_shared/voice-handler.ts:56*

---

### `textToSpeech`

Generate speech from text using OpenAI TTS

*Source: supabase/functions/_shared/voice-handler.ts:92*

---

### `uploadWhatsAppMedia`

Upload media to WhatsApp Cloud API

*Source: supabase/functions/_shared/voice-handler.ts:117*

---

### `unnamed`

OpenAI LLM Provider Implementation Wraps OpenAI API with the standard LLM Provider interface

*Source: supabase/functions/_shared/llm-provider-openai.ts:1*

---

### `unnamed`

Marketplace Payment Module Handles USSD-based MoMo payments for marketplace transactions. Uses tap-to-dial tel: links for seamless mobile payment experience. Payment Flow: 1. Buyer expresses interest in listing 2. System creates transaction record 3. Sends USSD link to buyer (tel:*182*8*1*MERCHANT*AMOUNT#) 4. Buyer taps link → dials USSD → completes MoMo payment 5. Buyer confirms payment in chat 6. Seller confirms receipt 7. Transaction marked complete

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:1*

---

### `generateMoMoUssd`

Generate USSD code for MoMo merchant payment

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:86*

---

### `createTelLink`

Create tap-to-dial tel: link Note: Keep unencoded for better Android compatibility

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:94*

---

### `formatUssdDisplay`

Format USSD code for display (user-friendly)

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:102*

---

### `initiatePayment`

Initiate a payment transaction

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:113*

---

### `buyerConfirmPayment`

Buyer confirms they've completed payment

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:273*

---

### `sellerConfirmPayment`

Seller confirms they've received payment

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:355*

---

### `cancelTransaction`

Cancel a transaction

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:458*

---

### `getTransactionDetails`

Get transaction details

*Source: supabase/functions/_shared/tools/marketplace-payment-core.ts:522*

---

### `unnamed`

Payment Handler for Marketplace Integrates payment flow with the AI agent and WhatsApp conversation. Handles text-based payment commands and transaction state management.

*Source: supabase/functions/_shared/tools/marketplace-payment.ts:1*

---

### `isPaymentCommand`

Check if message is a payment-related command

*Source: supabase/functions/_shared/tools/marketplace-payment.ts:24*

---

### `handlePaymentCommand`

Handle payment-related commands

*Source: supabase/functions/_shared/tools/marketplace-payment.ts:42*

---

### `showTransactionStatus`

Show user's transaction status

*Source: supabase/functions/_shared/tools/marketplace-payment.ts:173*

---

### `handlePurchaseIntent`

Handle purchase intent from search results

*Source: supabase/functions/_shared/tools/marketplace-payment.ts:218*

---

### `unnamed`

Message Types WhatsApp message type definitions

*Source: supabase/functions/_shared/types/messages.ts:1*

---

### `unnamed`

Context Types Shared context types used across all services

*Source: supabase/functions/_shared/types/context.ts:1*

---

### `unnamed`

Supabase client instance

*Source: supabase/functions/_shared/types/context.ts:17*

---

### `unnamed`

WhatsApp user phone number (E.164 format)

*Source: supabase/functions/_shared/types/context.ts:19*

---

### `unnamed`

User's profile ID (if exists)

*Source: supabase/functions/_shared/types/context.ts:21*

---

### `unnamed`

User's preferred language

*Source: supabase/functions/_shared/types/context.ts:23*

---

### `unnamed`

Unique request ID

*Source: supabase/functions/_shared/types/context.ts:31*

---

### `unnamed`

Correlation ID for distributed tracing

*Source: supabase/functions/_shared/types/context.ts:33*

---

### `unnamed`

Originating service

*Source: supabase/functions/_shared/types/context.ts:35*

---

### `unnamed`

Request timestamp

*Source: supabase/functions/_shared/types/context.ts:37*

---

### `unnamed`

Current user state

*Source: supabase/functions/_shared/types/context.ts:45*

---

### `unnamed`

State key identifier

*Source: supabase/functions/_shared/types/context.ts:57*

---

### `unnamed`

State data

*Source: supabase/functions/_shared/types/context.ts:59*

---

### `unnamed`

When state was created

*Source: supabase/functions/_shared/types/context.ts:61*

---

### `unnamed`

When state expires

*Source: supabase/functions/_shared/types/context.ts:63*

---

### `unnamed`

Whether the message was handled

*Source: supabase/functions/_shared/types/context.ts:91*

---

### `unnamed`

Optional response to send

*Source: supabase/functions/_shared/types/context.ts:93*

---

### `unnamed`

Optional error

*Source: supabase/functions/_shared/types/context.ts:95*

---

### `unnamed`

Types Module Exports

*Source: supabase/functions/_shared/types/index.ts:1*

---

### `unnamed`

Response Types API response type definitions

*Source: supabase/functions/_shared/types/responses.ts:1*

---

### `unnamed`

Media Upload Handler for Marketplace Handles photo uploads from WhatsApp messages for marketplace listings.

*Source: supabase/functions/_shared/media-upload.ts:1*

---

### `downloadWhatsAppMedia`

Download media from WhatsApp servers

*Source: supabase/functions/_shared/media-upload.ts:23*

---

### `uploadToStorage`

Upload image to Supabase Storage

*Source: supabase/functions/_shared/media-upload.ts:76*

---

### `handleMediaUpload`

Handle media upload from WhatsApp message

*Source: supabase/functions/_shared/media-upload.ts:114*

---

### `ensureStorageBucket`

Create storage bucket if it doesn't exist

*Source: supabase/functions/_shared/media-upload.ts:217*

---

### `unnamed`

In-Memory Cache High-performance caching with TTL support

*Source: supabase/functions/_shared/cache/memory-cache.ts:1*

---

### `unnamed`

Time to live in milliseconds

*Source: supabase/functions/_shared/cache/memory-cache.ts:19*

---

### `unnamed`

Maximum number of entries

*Source: supabase/functions/_shared/cache/memory-cache.ts:21*

---

### `unnamed`

Enable LRU eviction

*Source: supabase/functions/_shared/cache/memory-cache.ts:23*

---

### `unnamed`

Clone values on get/set (prevents mutation)

*Source: supabase/functions/_shared/cache/memory-cache.ts:25*

---

### `unnamed`

Get value from cache

*Source: supabase/functions/_shared/cache/memory-cache.ts:67*

---

### `unnamed`

Set value in cache

*Source: supabase/functions/_shared/cache/memory-cache.ts:97*

---

### `unnamed`

Check if key exists and is not expired

*Source: supabase/functions/_shared/cache/memory-cache.ts:120*

---

### `unnamed`

Delete key from cache

*Source: supabase/functions/_shared/cache/memory-cache.ts:133*

---

### `unnamed`

Clear all entries

*Source: supabase/functions/_shared/cache/memory-cache.ts:142*

---

### `unnamed`

Get or set with factory function

*Source: supabase/functions/_shared/cache/memory-cache.ts:150*

---

### `unnamed`

Get cache statistics

*Source: supabase/functions/_shared/cache/memory-cache.ts:168*

---

### `unnamed`

Get all keys

*Source: supabase/functions/_shared/cache/memory-cache.ts:175*

---

### `unnamed`

Cleanup expired entries

*Source: supabase/functions/_shared/cache/memory-cache.ts:182*

---

### `createCache`

Create a new cache instance

*Source: supabase/functions/_shared/cache/memory-cache.ts:270*

---

### `unnamed`

Cached Data Accessors High-level caching for common data access patterns

*Source: supabase/functions/_shared/cache/cached-accessors.ts:1*

---

### `getCachedProfile`

Get profile with caching

*Source: supabase/functions/_shared/cache/cached-accessors.ts:14*

---

### `getCachedProfileByPhone`

Get profile by phone with caching

*Source: supabase/functions/_shared/cache/cached-accessors.ts:39*

---

### `invalidateProfileCache`

Invalidate profile cache

*Source: supabase/functions/_shared/cache/cached-accessors.ts:64*

---

### `getCachedState`

Get state with caching

*Source: supabase/functions/_shared/cache/cached-accessors.ts:75*

---

### `invalidateStateCache`

Invalidate state cache

*Source: supabase/functions/_shared/cache/cached-accessors.ts:102*

---

### `getCachedAppConfig`

Get app config with caching

*Source: supabase/functions/_shared/cache/cached-accessors.ts:113*

---

### `invalidateConfigCache`

Invalidate config cache

*Source: supabase/functions/_shared/cache/cached-accessors.ts:140*

---

### `getCachedLocation`

Get cached location for user

*Source: supabase/functions/_shared/cache/cached-accessors.ts:151*

---

### `setCachedLocation`

Set cached location for user

*Source: supabase/functions/_shared/cache/cached-accessors.ts:162*

---

### `invalidateLocationCache`

Invalidate location cache

*Source: supabase/functions/_shared/cache/cached-accessors.ts:176*

---

### `getAllCacheStats`

Get all cache statistics

*Source: supabase/functions/_shared/cache/cached-accessors.ts:187*

---

### `clearAllCaches`

Clear all caches

*Source: supabase/functions/_shared/cache/cached-accessors.ts:199*

---

### `cleanupAllCaches`

Cleanup expired entries in all caches

*Source: supabase/functions/_shared/cache/cached-accessors.ts:209*

---

### `unnamed`

Cache Middleware HTTP response caching for frequently accessed endpoints

*Source: supabase/functions/_shared/cache/cache-middleware.ts:1*

---

### `unnamed`

Cache key generator

*Source: supabase/functions/_shared/cache/cache-middleware.ts:21*

---

### `unnamed`

TTL in milliseconds

*Source: supabase/functions/_shared/cache/cache-middleware.ts:23*

---

### `unnamed`

Paths to cache

*Source: supabase/functions/_shared/cache/cache-middleware.ts:25*

---

### `unnamed`

Paths to exclude

*Source: supabase/functions/_shared/cache/cache-middleware.ts:27*

---

### `unnamed`

Methods to cache

*Source: supabase/functions/_shared/cache/cache-middleware.ts:29*

---

### `unnamed`

Cache condition

*Source: supabase/functions/_shared/cache/cache-middleware.ts:31*

---

### `cacheMiddleware`

Cache middleware for HTTP responses

*Source: supabase/functions/_shared/cache/cache-middleware.ts:56*

---

### `shouldCache`

Check if request should be cached

*Source: supabase/functions/_shared/cache/cache-middleware.ts:125*

---

### `clearResponseCache`

Clear response cache

*Source: supabase/functions/_shared/cache/cache-middleware.ts:154*

---

### `getResponseCacheStats`

Get cache stats

*Source: supabase/functions/_shared/cache/cache-middleware.ts:161*

---

### `unnamed`

Cache Module Exports

*Source: supabase/functions/_shared/cache/index.ts:1*

---

### `unnamed`

Error Handler Module for Supabase Edge Functions Provides structured error handling, recovery mechanisms, and retry queue integration following EasyMO observability ground rules.

*Source: supabase/functions/_shared/error-handler.ts:1*

---

### `withErrorBoundary`

Wraps an async operation with error boundary and automatic retry queue integration

*Source: supabase/functions/_shared/error-handler.ts:85*

---

### `queueForRetry`

Queue a failed operation for retry in the webhook DLQ

*Source: supabase/functions/_shared/error-handler.ts:167*

---

### `scheduleMessageRetry`

Schedule a message for retry in the message queue

*Source: supabase/functions/_shared/error-handler.ts:213*

---

### `withTimeout`

Safely execute an operation with timeout

*Source: supabase/functions/_shared/error-handler.ts:239*

---

### `createSafeHandler`

Create a safe handler that catches and logs errors

*Source: supabase/functions/_shared/error-handler.ts:280*

---

### `isRetryableError`

Check if an error is retryable

*Source: supabase/functions/_shared/error-handler.ts:337*

---

### `unnamed`

WhatsApp Webhook Configuration Centralized configuration for webhook processing including timeouts, retry policies, circuit breakers, and deduplication settings.

*Source: supabase/functions/_shared/webhook-config.ts:1*

---

### `unnamed`

Default timeout for normal webhook operations (30 seconds)

*Source: supabase/functions/_shared/webhook-config.ts:14*

---

### `unnamed`

Timeout for AI agent operations (2 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:17*

---

### `unnamed`

Timeout for payment operations (1 minute)

*Source: supabase/functions/_shared/webhook-config.ts:20*

---

### `unnamed`

Timeout for external API calls (30 seconds)

*Source: supabase/functions/_shared/webhook-config.ts:23*

---

### `unnamed`

Timeout for database operations (10 seconds)

*Source: supabase/functions/_shared/webhook-config.ts:26*

---

### `unnamed`

Timeout for media upload/download (5 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:29*

---

### `unnamed`

Maximum number of retry attempts

*Source: supabase/functions/_shared/webhook-config.ts:37*

---

### `unnamed`

Backoff multiplier for exponential backoff

*Source: supabase/functions/_shared/webhook-config.ts:40*

---

### `unnamed`

Initial delay in milliseconds before first retry

*Source: supabase/functions/_shared/webhook-config.ts:43*

---

### `unnamed`

Maximum delay between retries

*Source: supabase/functions/_shared/webhook-config.ts:46*

---

### `unnamed`

Jitter factor (0-1) to add randomness to backoff

*Source: supabase/functions/_shared/webhook-config.ts:49*

---

### `unnamed`

Failure threshold percentage before opening circuit (0-100)

*Source: supabase/functions/_shared/webhook-config.ts:57*

---

### `unnamed`

Time in milliseconds to wait before attempting to close circuit

*Source: supabase/functions/_shared/webhook-config.ts:60*

---

### `unnamed`

Number of requests to allow in half-open state

*Source: supabase/functions/_shared/webhook-config.ts:63*

---

### `unnamed`

Minimum number of requests before evaluating error rate

*Source: supabase/functions/_shared/webhook-config.ts:66*

---

### `unnamed`

Request timeout in milliseconds

*Source: supabase/functions/_shared/webhook-config.ts:69*

---

### `unnamed`

Time window in milliseconds for deduplication (5 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:88*

---

### `unnamed`

Storage key prefix for deduplication cache

*Source: supabase/functions/_shared/webhook-config.ts:91*

---

### `unnamed`

Enable deduplication by default

*Source: supabase/functions/_shared/webhook-config.ts:94*

---

### `unnamed`

Maximum requests per user per minute

*Source: supabase/functions/_shared/webhook-config.ts:102*

---

### `unnamed`

Maximum requests per IP per minute

*Source: supabase/functions/_shared/webhook-config.ts:105*

---

### `unnamed`

Maximum concurrent processing per user

*Source: supabase/functions/_shared/webhook-config.ts:108*

---

### `unnamed`

Burst allowance (extra requests allowed in short bursts)

*Source: supabase/functions/_shared/webhook-config.ts:111*

---

### `unnamed`

Order workflow timeout (15 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:119*

---

### `unnamed`

Payment workflow timeout (10 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:122*

---

### `unnamed`

Job application workflow timeout (30 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:125*

---

### `unnamed`

Property inquiry workflow timeout (1 hour)

*Source: supabase/functions/_shared/webhook-config.ts:128*

---

### `unnamed`

Ride request workflow timeout (5 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:131*

---

### `unnamed`

Insurance claim workflow timeout (1 hour)

*Source: supabase/functions/_shared/webhook-config.ts:134*

---

### `unnamed`

Default workflow timeout (30 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:137*

---

### `unnamed`

Maximum conversation history length to keep

*Source: supabase/functions/_shared/webhook-config.ts:145*

---

### `unnamed`

Maximum token count before truncating history

*Source: supabase/functions/_shared/webhook-config.ts:148*

---

### `unnamed`

Session timeout in milliseconds (30 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:151*

---

### `unnamed`

Maximum concurrent AI requests per user

*Source: supabase/functions/_shared/webhook-config.ts:154*

---

### `unnamed`

Enable context persistence

*Source: supabase/functions/_shared/webhook-config.ts:157*

---

### `unnamed`

Context TTL in milliseconds (24 hours)

*Source: supabase/functions/_shared/webhook-config.ts:160*

---

### `unnamed`

Maximum queue size before rejecting new messages

*Source: supabase/functions/_shared/webhook-config.ts:168*

---

### `unnamed`

Message processing timeout (5 minutes)

*Source: supabase/functions/_shared/webhook-config.ts:171*

---

### `unnamed`

Batch size for processing messages

*Source: supabase/functions/_shared/webhook-config.ts:174*

---

### `unnamed`

Polling interval in milliseconds

*Source: supabase/functions/_shared/webhook-config.ts:177*

---

### `unnamed`

Enable priority processing

*Source: supabase/functions/_shared/webhook-config.ts:180*

---

### `unnamed`

Retention period for completed messages (7 days)

*Source: supabase/functions/_shared/webhook-config.ts:183*

---

### `unnamed`

Interval for checking service health (30 seconds)

*Source: supabase/functions/_shared/webhook-config.ts:191*

---

### `unnamed`

Timeout for health check requests (3 seconds)

*Source: supabase/functions/_shared/webhook-config.ts:194*

---

### `unnamed`

Number of consecutive failures before marking unhealthy

*Source: supabase/functions/_shared/webhook-config.ts:197*

---

### `unnamed`

Enable automatic recovery checks

*Source: supabase/functions/_shared/webhook-config.ts:200*

---

### `unnamed`

Enable structured logging

*Source: supabase/functions/_shared/webhook-config.ts:208*

---

### `unnamed`

Enable metrics collection

*Source: supabase/functions/_shared/webhook-config.ts:211*

---

### `unnamed`

Enable distributed tracing

*Source: supabase/functions/_shared/webhook-config.ts:214*

---

### `unnamed`

Sample rate for traces (0-1)

*Source: supabase/functions/_shared/webhook-config.ts:217*

---

### `unnamed`

Log level for production

*Source: supabase/functions/_shared/webhook-config.ts:220*

---

### `unnamed`

Mask PII in logs

*Source: supabase/functions/_shared/webhook-config.ts:223*

---

### `getWorkflowTimeout`

Get timeout for specific workflow type

*Source: supabase/functions/_shared/webhook-config.ts:227*

---

### `calculateRetryDelay`

Calculate retry delay with exponential backoff and jitter

*Source: supabase/functions/_shared/webhook-config.ts:239*

---

### `shouldProcessMessage`

Check if a message should be deduplicated

*Source: supabase/functions/_shared/webhook-config.ts:257*

---

### `unnamed`

Phone Number Utilities Common utilities for phone number handling including normalization and masking. Used across wa-webhook services for consistent phone number processing.

*Source: supabase/functions/_shared/phone-utils.ts:1*

---

### `normalizePhone`

Normalize phone number by removing non-numeric characters except leading +

*Source: supabase/functions/_shared/phone-utils.ts:8*

---

### `maskPhone`

Mask phone number for logging (privacy protection) Shows first few and last few digits with asterisks in between.

*Source: supabase/functions/_shared/phone-utils.ts:23*

---

### `isValidPhone`

Validate if a string looks like a phone number Basic validation - starts with + and contains 10-15 digits

*Source: supabase/functions/_shared/phone-utils.ts:46*

---

### `getCountryCode`

Extract country code from phone number (assumes E.164 format)

*Source: supabase/functions/_shared/phone-utils.ts:57*

---

### `unnamed`

Application Constants Centralized constants used across all services

*Source: supabase/functions/_shared/config/constants.ts:1*

---

### `unnamed`

Configuration Module Exports

*Source: supabase/functions/_shared/config/index.ts:1*

---

### `unnamed`

Environment Configuration Module Centralized environment variable management with validation

*Source: supabase/functions/_shared/config/env.ts:1*

---

### `unnamed`

Get environment variable with fallbacks

*Source: supabase/functions/_shared/config/env.ts:54*

---

### `unnamed`

Get required environment variable

*Source: supabase/functions/_shared/config/env.ts:69*

---

### `unnamed`

Get boolean environment variable

*Source: supabase/functions/_shared/config/env.ts:80*

---

### `unnamed`

Get number environment variable

*Source: supabase/functions/_shared/config/env.ts:89*

---

### `unnamed`

Load and validate all environment variables

*Source: supabase/functions/_shared/config/env.ts:99*

---

### `unnamed`

Clear cache (useful for testing)

*Source: supabase/functions/_shared/config/env.ts:156*

---

### `getEnv`

Get environment configuration

*Source: supabase/functions/_shared/config/env.ts:167*

---

### `validateEnv`

Validate environment and throw if invalid

*Source: supabase/functions/_shared/config/env.ts:174*

---

### `unnamed`

Security Middleware Layer Provides comprehensive security controls for all microservices

*Source: supabase/functions/_shared/security/middleware.ts:1*

---

### `unnamed`

Maximum request body size in bytes (default: 1MB)

*Source: supabase/functions/_shared/security/middleware.ts:13*

---

### `unnamed`

Allowed content types

*Source: supabase/functions/_shared/security/middleware.ts:15*

---

### `unnamed`

Enable request ID tracking

*Source: supabase/functions/_shared/security/middleware.ts:17*

---

### `unnamed`

Enable audit logging

*Source: supabase/functions/_shared/security/middleware.ts:19*

---

### `unnamed`

Rate limit configuration

*Source: supabase/functions/_shared/security/middleware.ts:21*

---

### `unnamed`

Signature verification

*Source: supabase/functions/_shared/security/middleware.ts:27*

---

### `unnamed`

Run all security checks on incoming request

*Source: supabase/functions/_shared/security/middleware.ts:95*

---

### `unnamed`

Build security context from request

*Source: supabase/functions/_shared/security/middleware.ts:134*

---

### `unnamed`

Validate Content-Type header

*Source: supabase/functions/_shared/security/middleware.ts:152*

---

### `unnamed`

Validate request body size

*Source: supabase/functions/_shared/security/middleware.ts:196*

---

### `unnamed`

Check rate limiting

*Source: supabase/functions/_shared/security/middleware.ts:235*

---

### `unnamed`

Audit logging for security events

*Source: supabase/functions/_shared/security/middleware.ts:266*

---

### `unnamed`

Create response with security headers

*Source: supabase/functions/_shared/security/middleware.ts:286*

---

### `createSecurityMiddleware`

Factory function to create security middleware

*Source: supabase/functions/_shared/security/middleware.ts:307*

---

### `unnamed`

Enhanced Signature Verification Module Provides HMAC-SHA256 signature verification for WhatsApp webhooks

*Source: supabase/functions/_shared/security/signature.ts:1*

---

### `unnamed`

Require valid signature (default: true)

*Source: supabase/functions/_shared/security/signature.ts:27*

---

### `unnamed`

Allow unsigned requests for development (default: false)

*Source: supabase/functions/_shared/security/signature.ts:29*

---

### `unnamed`

Allow internal service forwarding (default: false)

*Source: supabase/functions/_shared/security/signature.ts:31*

---

### `unnamed`

App secret for verification

*Source: supabase/functions/_shared/security/signature.ts:33*

---

### `verifySignature`

Verify WhatsApp webhook signature

*Source: supabase/functions/_shared/security/signature.ts:41*

---

### `timingSafeEqual`

Timing-safe string comparison to prevent timing attacks

*Source: supabase/functions/_shared/security/signature.ts:80*

---

### `extractSignatureMetadata`

Extract signature metadata for logging

*Source: supabase/functions/_shared/security/signature.ts:96*

---

### `verifyWebhookRequest`

Full signature verification with configuration

*Source: supabase/functions/_shared/security/signature.ts:131*

---

### `unnamed`

Audit Logging System Tracks sensitive operations for security and compliance

*Source: supabase/functions/_shared/security/audit-logger.ts:1*

---

### `unnamed`

Security Configuration for All Microservices

*Source: supabase/functions/_shared/security/config.ts:1*

---

### `unnamed`

Input Validation and Sanitization Module Provides comprehensive input validation for all user inputs

*Source: supabase/functions/_shared/security/input-validator.ts:1*

---

### `sanitizeString`

Sanitize string input - remove dangerous characters

*Source: supabase/functions/_shared/security/input-validator.ts:36*

---

### `sanitizeForSQL`

Sanitize for SQL - escape special characters Note: Always use parameterized queries, this is defense in depth

*Source: supabase/functions/_shared/security/input-validator.ts:51*

---

### `sanitizeForHTML`

Sanitize for HTML - prevent XSS

*Source: supabase/functions/_shared/security/input-validator.ts:67*

---

### `sanitizePhoneNumber`

Sanitize phone number - keep only digits and leading +

*Source: supabase/functions/_shared/security/input-validator.ts:85*

---

### `maskPhoneNumber`

Mask phone number for logging

*Source: supabase/functions/_shared/security/input-validator.ts:99*

---

### `maskEmail`

Mask email for logging

*Source: supabase/functions/_shared/security/input-validator.ts:107*

---

### `isValidPhoneNumber`

Validate phone number format (E.164)

*Source: supabase/functions/_shared/security/input-validator.ts:123*

---

### `isValidEmail`

Validate email format

*Source: supabase/functions/_shared/security/input-validator.ts:132*

---

### `isValidUUID`

Validate UUID format

*Source: supabase/functions/_shared/security/input-validator.ts:140*

---

### `hasSQLInjectionPatterns`

Check for potential SQL injection patterns

*Source: supabase/functions/_shared/security/input-validator.ts:148*

---

### `hasXSSPatterns`

Check for potential XSS patterns

*Source: supabase/functions/_shared/security/input-validator.ts:163*

---

### `validateInput`

Validate input against schema

*Source: supabase/functions/_shared/security/input-validator.ts:184*

---

### `unnamed`

Waiter AI Tools This module provides tools for the Waiter AI agent to interact with restaurant data, manage orders, and provide recommendations.

*Source: supabase/functions/_shared/waiter-tools.ts:1*

---

### `search_menu`

Tool: search_menu Search menu items by name, category, dietary restrictions

*Source: supabase/functions/_shared/waiter-tools.ts:25*

---

### `get_menu_item_details`

Tool: get_menu_item_details Get detailed information about a specific menu item

*Source: supabase/functions/_shared/waiter-tools.ts:88*

---

### `add_to_cart`

Tool: add_to_cart Add an item to the current draft order

*Source: supabase/functions/_shared/waiter-tools.ts:123*

---

### `view_cart`

Tool: view_cart Get current cart contents

*Source: supabase/functions/_shared/waiter-tools.ts:246*

---

### `update_cart_item`

Tool: update_cart_item Update quantity or remove an item from cart

*Source: supabase/functions/_shared/waiter-tools.ts:295*

---

### `send_order`

Tool: send_order Finalize the order for payment

*Source: supabase/functions/_shared/waiter-tools.ts:359*

---

### `recommend_wine`

Tool: recommend_wine Get wine recommendations for a dish

*Source: supabase/functions/_shared/waiter-tools.ts:425*

---

### `book_table`

Tool: book_table Create a table reservation

*Source: supabase/functions/_shared/waiter-tools.ts:461*

---

### `get_order_status`

Tool: get_order_status Check the status of an order

*Source: supabase/functions/_shared/waiter-tools.ts:530*

---

### `updateOrderTotal`

Update order total by summing order items

*Source: supabase/functions/_shared/waiter-tools.ts:576*

---

### `getOrderSummary`

Get order summary

*Source: supabase/functions/_shared/waiter-tools.ts:609*

---

### `initiate_payment`

Tool: initiate_payment Initiate a payment for an order (MoMo, Revolut, or Cash)

*Source: supabase/functions/_shared/waiter-tools.ts:625*

---

### `confirm_payment`

Tool: confirm_payment User confirms they have completed the payment

*Source: supabase/functions/_shared/waiter-tools.ts:785*

---

### `cancel_payment`

Tool: cancel_payment Cancel a pending payment

*Source: supabase/functions/_shared/waiter-tools.ts:868*

---

### `get_payment_status`

Tool: get_payment_status Check status of a payment

*Source: supabase/functions/_shared/waiter-tools.ts:932*

---

### `save_payment_method`

Tool: save_payment_method Save a payment method for future use

*Source: supabase/functions/_shared/waiter-tools.ts:981*

---

### `get_saved_payment_methods`

Tool: get_saved_payment_methods Get user's saved payment methods

*Source: supabase/functions/_shared/waiter-tools.ts:1032*

---

### `initiate_payment`

Tool: initiate_payment Initiate a payment for an order (MoMo, Revolut, or Cash)

*Source: supabase/functions/_shared/waiter-tools.ts:1088*

---

### `confirm_payment`

Tool: confirm_payment User confirms they have completed the payment

*Source: supabase/functions/_shared/waiter-tools.ts:1248*

---

### `cancel_payment`

Tool: cancel_payment Cancel a pending payment

*Source: supabase/functions/_shared/waiter-tools.ts:1331*

---

### `get_payment_status`

Tool: get_payment_status Check status of a payment

*Source: supabase/functions/_shared/waiter-tools.ts:1395*

---

### `save_payment_method`

Tool: save_payment_method Save a payment method for future use

*Source: supabase/functions/_shared/waiter-tools.ts:1444*

---

### `get_saved_payment_methods`

Tool: get_saved_payment_methods Get user's saved payment methods

*Source: supabase/functions/_shared/waiter-tools.ts:1495*

---

### `errorHandler`

Error handler middleware for webhook processing Converts errors to proper HTTP responses with structured error objects

*Source: supabase/functions/_shared/errors.ts:101*

---

### `unnamed`

AI Agent Orchestrator for WhatsApp Webhook Processing Provides centralized AI agent management with: - Context persistence and retrieval - Token limit management and truncation - Retry logic with exponential backoff - Session tracking and metrics

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:1*

---

### `unnamed`

Process a message through the AI agent pipeline

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:47*

---

### `unnamed`

Load conversation context from database

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:129*

---

### `unnamed`

Truncate context to fit within token limits Uses a sliding window approach to keep recent messages

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:164*

---

### `unnamed`

Estimate token count for text Rough estimation: 1 token ≈ 4 characters

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:206*

---

### `unnamed`

Call AI service with retry logic and exponential backoff

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:214*

---

### `unnamed`

Call AI service (placeholder - implement with actual AI provider)

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:263*

---

### `unnamed`

Get agent configuration based on type

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:291*

---

### `unnamed`

Save updated context to database

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:355*

---

### `unnamed`

Update session metrics

*Source: supabase/functions/_shared/ai-agent-orchestrator.ts:403*

---

### `unnamed`

Dead Letter Queue (DLQ) Manager Handles storage and retrieval of failed webhook payloads for later reprocessing.

*Source: supabase/functions/_shared/dlq-manager.ts:1*

---

### `storeDLQEntry`

Store a failed webhook in the DLQ

*Source: supabase/functions/_shared/dlq-manager.ts:33*

---

### `getPendingDLQEntries`

Get pending DLQ entries ready for retry

*Source: supabase/functions/_shared/dlq-manager.ts:73*

---

### `markDLQProcessing`

Mark a DLQ entry as processing

*Source: supabase/functions/_shared/dlq-manager.ts:101*

---

### `markDLQReprocessed`

Mark a DLQ entry as reprocessed

*Source: supabase/functions/_shared/dlq-manager.ts:120*

---

### `markDLQFailed`

Mark a DLQ entry as failed (after max retries)

*Source: supabase/functions/_shared/dlq-manager.ts:142*

---

### `incrementDLQRetry`

Increment retry count and update next retry time

*Source: supabase/functions/_shared/dlq-manager.ts:166*

---

### `getDLQStats`

Get DLQ statistics

*Source: supabase/functions/_shared/dlq-manager.ts:191*

---

### `calculateNextRetry`

Calculate next retry time with exponential backoff Max 5 retries: 5min, 15min, 1hr, 4hr, 12hr

*Source: supabase/functions/_shared/dlq-manager.ts:242*

---

### `unnamed`

Webhook Processing Utilities Provides core utilities for WhatsApp webhook processing: - Signature verification (timing-safe) - Payload validation (Zod schemas) - Webhook queue management - Rate limiting - Circuit breaker pattern - Logging and metrics

*Source: supabase/functions/_shared/webhook-utils.ts:1*

---

### `verifyWebhookSignature`

Verify webhook signature using HMAC-SHA256 with timing-safe comparison

*Source: supabase/functions/_shared/webhook-utils.ts:136*

---

### `validateWebhookPayload`

Validate webhook payload structure using Zod schemas

*Source: supabase/functions/_shared/webhook-utils.ts:188*

---

### `checkIdempotency`

Check if a WhatsApp message has already been processed (idempotency)

*Source: supabase/functions/_shared/webhook-utils.ts:680*

---

### `recordProcessedMessage`

Record that a message has been processed

*Source: supabase/functions/_shared/webhook-utils.ts:723*

---

### `acquireConversationLock`

Acquire a distributed lock for conversation processing

*Source: supabase/functions/_shared/webhook-utils.ts:771*

---

### `releaseConversationLock`

Release a distributed lock for conversation processing

*Source: supabase/functions/_shared/webhook-utils.ts:824*

---

### `addToDeadLetterQueue`

Add failed message to dead letter queue

*Source: supabase/functions/_shared/webhook-utils.ts:869*

---

### `processWithTimeout`

Process webhook with timeout protection

*Source: supabase/functions/_shared/webhook-utils.ts:933*

---

### `updateConversationState`

Update conversation state with audit trail

*Source: supabase/functions/_shared/webhook-utils.ts:971*

---

### `getOrCreateConversation`

Get or create webhook conversation

*Source: supabase/functions/_shared/webhook-utils.ts:1039*

---

### `unnamed`

Circuit Breaker Pattern Implementation Prevents cascading failures by tracking service health and temporarily blocking requests to failing services. States: - CLOSED: Normal operation, requests pass through - OPEN: Service is failing, requests are blocked - HALF_OPEN: Testing if service has recovered

*Source: supabase/functions/_shared/circuit-breaker.ts:1*

---

### `unnamed`

Check if the circuit breaker allows the request

*Source: supabase/functions/_shared/circuit-breaker.ts:47*

---

### `unnamed`

Record a successful execution

*Source: supabase/functions/_shared/circuit-breaker.ts:65*

---

### `unnamed`

Record a failed execution

*Source: supabase/functions/_shared/circuit-breaker.ts:80*

---

### `unnamed`

Get current circuit state

*Source: supabase/functions/_shared/circuit-breaker.ts:102*

---

### `unnamed`

Get circuit breaker metrics

*Source: supabase/functions/_shared/circuit-breaker.ts:109*

---

### `unnamed`

Manually reset the circuit breaker

*Source: supabase/functions/_shared/circuit-breaker.ts:122*

---

### `unnamed`

Service Resilience Module Provides circuit breaker and rate limiting patterns for microservices routing. Implements resilience patterns as recommended in WA_WEBHOOK_CORE architecture.

*Source: supabase/functions/_shared/service-resilience.ts:1*

---

### `isServiceCircuitOpen`

Circuit Breaker: Check if circuit is open for a service Circuit states: - closed: Normal operation, requests pass through - open: Circuit tripped, requests are rejected immediately - half-open: Testing if service has recovered, limited requests allowed

*Source: supabase/functions/_shared/service-resilience.ts:78*

---

### `recordServiceSuccess`

Record a successful request to a service Closes the circuit if in half-open state

*Source: supabase/functions/_shared/service-resilience.ts:118*

---

### `recordServiceFailure`

Record a failed request to a service Opens the circuit if failures exceed threshold

*Source: supabase/functions/_shared/service-resilience.ts:140*

---

### `getCircuitState`

Get current circuit state for a service (for monitoring/health checks)

*Source: supabase/functions/_shared/service-resilience.ts:202*

---

### `checkRateLimit`

Rate Limiter: Check if a phone number has exceeded rate limit Returns { allowed: boolean, remaining: number, resetAt: number }

*Source: supabase/functions/_shared/service-resilience.ts:221*

---

### `fetchWithRetry`

Retry with exponential backoff Implements retry for transient failures (configurable via WA_RETRIABLE_STATUS_CODES)

*Source: supabase/functions/_shared/service-resilience.ts:261*

---

### `sleep`

Sleep helper for retry delays

*Source: supabase/functions/_shared/service-resilience.ts:348*

---

### `getAllCircuitStates`

Get all services' circuit states (for health check aggregation)

*Source: supabase/functions/_shared/service-resilience.ts:355*

---

### `cleanupRateLimitState`

Clean up expired rate limit entries (memory management) Call periodically to prevent memory leaks in long-running instances

*Source: supabase/functions/_shared/service-resilience.ts:366*

---

### `unnamed`

Performance Middleware Tracks request performance and reports metrics

*Source: supabase/functions/_shared/observability/performance-middleware.ts:1*

---

### `unnamed`

Performance Dashboard Endpoint Exposes metrics and performance data

*Source: supabase/functions/_shared/observability/performance-endpoint.ts:1*

---

### `unnamed`

Metrics Collector Performance metrics collection and reporting

*Source: supabase/functions/_shared/observability/metrics.ts:1*

---

### `unnamed`

Typed State Machine Provides type-safe state transitions with validation

*Source: supabase/functions/_shared/state/state-machine.ts:1*

---

### `unnamed`

Default TTL for states

*Source: supabase/functions/_shared/state/state-machine.ts:38*

---

### `unnamed`

Whether to validate transitions

*Source: supabase/functions/_shared/state/state-machine.ts:40*

---

### `unnamed`

Whether to log transitions

*Source: supabase/functions/_shared/state/state-machine.ts:42*

---

### `unnamed`

Get current state for user

*Source: supabase/functions/_shared/state/state-machine.ts:113*

---

### `unnamed`

Transition to new state

*Source: supabase/functions/_shared/state/state-machine.ts:140*

---

### `unnamed`

Clear user state (return to home)

*Source: supabase/functions/_shared/state/state-machine.ts:218*

---

### `unnamed`

Check if transition is allowed

*Source: supabase/functions/_shared/state/state-machine.ts:232*

---

### `unnamed`

Get allowed transitions for a state

*Source: supabase/functions/_shared/state/state-machine.ts:241*

---

### `createStateMachine`

Create state machine instance

*Source: supabase/functions/_shared/state/state-machine.ts:249*

---

### `unnamed`

State Module Exports

*Source: supabase/functions/_shared/state/index.ts:1*

---

### `unnamed`

State Store Simple state storage and retrieval

*Source: supabase/functions/_shared/state/store.ts:1*

---

### `getState`

Get user state

*Source: supabase/functions/_shared/state/store.ts:15*

---

### `setState`

Set user state

*Source: supabase/functions/_shared/state/store.ts:54*

---

### `clearState`

Clear user state

*Source: supabase/functions/_shared/state/store.ts:96*

---

### `updateStateData`

Update state data without changing key

*Source: supabase/functions/_shared/state/store.ts:127*

---

### `ensureProfile`

Ensure user profile exists

*Source: supabase/functions/_shared/state/store.ts:149*

---

### `unnamed`

Keywords for natural language matching

*Source: supabase/functions/_shared/route-config.ts:21*

---

### `unnamed`

Menu selection keys (exact match)

*Source: supabase/functions/_shared/route-config.ts:23*

---

### `unnamed`

Priority for conflict resolution (lower = higher priority)

*Source: supabase/functions/_shared/route-config.ts:25*

---

### `unnamed`

If true, this service is deprecated and traffic should be routed to wa-webhook-unified when FEATURE_AGENT_UNIFIED_WEBHOOK is enabled.

*Source: supabase/functions/_shared/route-config.ts:27*

---

### `unnamed`

The service to redirect to when deprecated

*Source: supabase/functions/_shared/route-config.ts:32*

---

### `buildMenuKeyMap`

Build a lookup map from menu keys to services

*Source: supabase/functions/_shared/route-config.ts:134*

---

### `getServiceFromState`

Get service from chat state

*Source: supabase/functions/_shared/route-config.ts:160*

---

### `matchKeywordsToService`

Match message text to service based on keywords Returns the best matching service or null if no match

*Source: supabase/functions/_shared/route-config.ts:175*

---

### `isServiceDeprecated`

Check if a service is deprecated

*Source: supabase/functions/_shared/route-config.ts:201*

---

### `getServiceRedirect`

Get the redirect target for a deprecated service Returns the original service if not deprecated or no redirect configured

*Source: supabase/functions/_shared/route-config.ts:209*

---

### `resolveServiceWithMigration`

Resolve the final service to route to, taking into account deprecation and the FEATURE_UNIFIED_AGENTS feature flag. When useUnified is true and the service is deprecated, returns the redirect target. When useUnified is false, always returns the original service (even if deprecated). When the service is not deprecated, always returns the original service.

*Source: supabase/functions/_shared/route-config.ts:221*

---

### `unnamed`

Test Fixtures Pre-defined test data for consistent testing

*Source: supabase/functions/_shared/testing/fixtures.ts:1*

---

### `unnamed`

Test Utilities and Helpers Shared testing infrastructure for all microservices

*Source: supabase/functions/_shared/testing/test-utils.ts:1*

---

### `createMockSupabase`

Create a mock Supabase client

*Source: supabase/functions/_shared/testing/test-utils.ts:63*

---

### `createMockContext`

Create a mock router context

*Source: supabase/functions/_shared/testing/test-utils.ts:130*

---

### `createMockWebhookPayload`

Create a mock WhatsApp webhook payload

*Source: supabase/functions/_shared/testing/test-utils.ts:143*

---

### `createMockRequest`

Create a mock HTTP request

*Source: supabase/functions/_shared/testing/test-utils.ts:234*

---

### `assertResponse`

Assert response status and body

*Source: supabase/functions/_shared/testing/test-utils.ts:264*

---

### `assertSuccess`

Assert that a response is successful

*Source: supabase/functions/_shared/testing/test-utils.ts:280*

---

### `assertError`

Assert that a response is an error

*Source: supabase/functions/_shared/testing/test-utils.ts:288*

---

### `createMockWhatsAppAPI`

Create a mock WhatsApp API

*Source: supabase/functions/_shared/testing/test-utils.ts:320*

---

### `createTestProfile`

Create test profile data

*Source: supabase/functions/_shared/testing/test-utils.ts:386*

---

### `createTestTrip`

Create test trip data

*Source: supabase/functions/_shared/testing/test-utils.ts:401*

---

### `createTestInsuranceLead`

Create test insurance lead data

*Source: supabase/functions/_shared/testing/test-utils.ts:418*

---

### `createTestClaim`

Create test claim data

*Source: supabase/functions/_shared/testing/test-utils.ts:432*

---

### `createTestSuite`

Setup and teardown helpers

*Source: supabase/functions/_shared/testing/test-utils.ts:453*

---

### `logStructuredEvent`

Log a structured event with consistent formatting

*Source: supabase/functions/_shared/observability.ts:13*

---

### `logError`

Log an error with context Stack traces are only included in development environment to prevent information leakage in production.

*Source: supabase/functions/_shared/observability.ts:55*

---

### `normalizeDimensions`

Normalize metric dimensions to string values

*Source: supabase/functions/_shared/observability.ts:95*

---

### `recordMetric`

Record a metric/counter

*Source: supabase/functions/_shared/observability.ts:105*

---

### `recordDurationMetric`

Record a duration metric

*Source: supabase/functions/_shared/observability.ts:135*

---

### `recordGauge`

Record a gauge metric (current value snapshot)

*Source: supabase/functions/_shared/observability.ts:159*

---

### `maskPII`

Mask sensitive data for logging

*Source: supabase/functions/_shared/observability.ts:179*

---

### `generateCorrelationId`

Create a correlation ID for request tracing

*Source: supabase/functions/_shared/observability.ts:203*

---

### `getCorrelationId`

Extract correlation ID from request headers

*Source: supabase/functions/_shared/observability.ts:210*

---

### `logRequest`

Log request with correlation tracking

*Source: supabase/functions/_shared/observability.ts:219*

---

### `logResponse`

Log response with correlation tracking

*Source: supabase/functions/_shared/observability.ts:251*

---

### `withRequestInstrumentation`

Wraps a Supabase Edge Function handler with request tracing and structured logging. This function instruments the handler to: - Automatically propagate and inject a request/correlation ID into all outgoing fetch requests. - Log structured request and response events with timing and status. - Intercept and restore the global fetch function for the duration of the handler.

*Source: supabase/functions/_shared/observability.ts:320*

---

### `unnamed`

Webhook Error Boundary Module Comprehensive error handling for all webhook services with: - Standardized error responses - User-friendly messages - Automatic retry logic - Circuit breaker integration - DLQ support

*Source: supabase/functions/_shared/webhook-error-boundary.ts:1*

---

### `withWebhookErrorBoundary`

Wrap a webhook handler with comprehensive error boundary

*Source: supabase/functions/_shared/webhook-error-boundary.ts:84*

---

### `handleWebhookError`

Handle webhook errors with recovery mechanisms

*Source: supabase/functions/_shared/webhook-error-boundary.ts:179*

---

### `extractErrorDetails`

Extract error details from various error types

*Source: supabase/functions/_shared/webhook-error-boundary.ts:287*

---

### `getUserFriendlyMessage`

Get user-friendly error message

*Source: supabase/functions/_shared/webhook-error-boundary.ts:337*

---

### `withTimeout`

Create a safe async operation wrapper with timeout

*Source: supabase/functions/_shared/webhook-error-boundary.ts:344*

---

### `validatePayload`

Validate webhook payload with structured errors

*Source: supabase/functions/_shared/webhook-error-boundary.ts:377*

---

### `isWhatsAppPayload`

Type guard for WhatsApp webhook payload

*Source: supabase/functions/_shared/webhook-error-boundary.ts:394*

---

### `withRetry`

Retry an operation with exponential backoff

*Source: supabase/functions/_shared/webhook-error-boundary.ts:414*

---

### `unnamed`

Export error classes for use in services

*Source: supabase/functions/_shared/webhook-error-boundary.ts:464*

---

### `addToDeadLetterQueue`

Add failed message to dead letter queue

*Source: supabase/functions/_shared/dead-letter-queue.ts:13*

---

### `getRetriableMessages`

Get messages ready for retry

*Source: supabase/functions/_shared/dead-letter-queue.ts:67*

---

### `markMessageProcessed`

Mark message as processed

*Source: supabase/functions/_shared/dead-letter-queue.ts:91*

---

### `unnamed`

Check if a request is allowed for the given key (e.g., phone number)

*Source: supabase/functions/_shared/rate-limiter.ts:29*

---

### `unnamed`

Get current usage for a key

*Source: supabase/functions/_shared/rate-limiter.ts:60*

---

### `unnamed`

Reset rate limit for a specific key

*Source: supabase/functions/_shared/rate-limiter.ts:80*

---

### `unnamed`

Clear all rate limit data

*Source: supabase/functions/_shared/rate-limiter.ts:87*

---

### `unnamed`

Cleanup old entries (call periodically)

*Source: supabase/functions/_shared/rate-limiter.ts:94*

---

### `unnamed`

Embedding Generator Service Generates vector embeddings for semantic search using OpenAI or Gemini

*Source: supabase/functions/_shared/embedding-service.ts:1*

---

### `generateEmbeddingOpenAI`

Generate embeddings using OpenAI text-embedding-3-small (1536 dimensions)

*Source: supabase/functions/_shared/embedding-service.ts:17*

---

### `generateEmbeddingGemini`

Generate embeddings using Google Gemini (embedding-001) Note: Gemini embeddings are 768 dimensions, we'll need to pad to 1536

*Source: supabase/functions/_shared/embedding-service.ts:54*

---

### `generateEmbedding`

Generate embedding with automatic fallback

*Source: supabase/functions/_shared/embedding-service.ts:100*

---

### `hybridSearch`

Hybrid search (vector + full-text)

*Source: supabase/functions/_shared/embedding-service.ts:224*

---

### `unnamed`

Agent Observability Utilities Specialized logging and metrics for AI agent operations. Extends the base observability utilities with agent-specific events.

*Source: supabase/functions/_shared/agent-observability.ts:1*

---

### `logAgentEvent`

Log an agent event with structured data

*Source: supabase/functions/_shared/agent-observability.ts:49*

---

### `logNegotiationStart`

Log agent negotiation start

*Source: supabase/functions/_shared/agent-observability.ts:73*

---

### `logQuoteReceived`

Log quote collection event

*Source: supabase/functions/_shared/agent-observability.ts:96*

---

### `logNegotiationCompleted`

Log negotiation completion

*Source: supabase/functions/_shared/agent-observability.ts:121*

---

### `logSessionTimeout`

Log session timeout

*Source: supabase/functions/_shared/agent-observability.ts:144*

---

### `logVendorContact`

Log vendor contact attempt

*Source: supabase/functions/_shared/agent-observability.ts:163*

---

### `logAgentError`

Log agent error with context

*Source: supabase/functions/_shared/agent-observability.ts:185*

---

### `maskIdentifier`

Mask identifier for PII protection Shows first 4 and last 4 characters, masks the middle

*Source: supabase/functions/_shared/agent-observability.ts:203*

---

### `maskPhone`

Mask phone number for PII protection Shows country code and last 3 digits

*Source: supabase/functions/_shared/agent-observability.ts:220*

---

### `recordAgentMetric`

Record agent session metrics Helper to record common agent metrics with consistent dimensions. NOTE: This function is a placeholder for future implementation. The recordMetric function needs to be implemented in observability.ts first.

*Source: supabase/functions/_shared/agent-observability.ts:246*

---

### `unnamed`

Security utilities for Supabase Edge Functions Provides signature verification, secret management helpers, and security best practices enforcement.

*Source: supabase/functions/_shared/security.ts:1*

---

### `verifyWhatsAppSignature`

Verify WhatsApp webhook signature using HMAC SHA-256

*Source: supabase/functions/_shared/security.ts:12*

---

### `verifyHmacSignature`

Verify generic webhook HMAC signature

*Source: supabase/functions/_shared/security.ts:82*

---

### `constantTimeCompare`

Constant-time string comparison to prevent timing attacks

*Source: supabase/functions/_shared/security.ts:126*

---

### `validateRequiredEnvVars`

Validate that required environment variables are set

*Source: supabase/functions/_shared/security.ts:146*

---

### `isPlaceholderValue`

Check if an environment variable contains a placeholder value

*Source: supabase/functions/_shared/security.ts:176*

---

### `sanitizeErrorMessage`

Sanitize error messages to prevent information leakage

*Source: supabase/functions/_shared/security.ts:202*

---

### `cleanupRateLimitStore`

Clean up expired rate limit entries Call periodically to prevent memory leaks

*Source: supabase/functions/_shared/security.ts:265*

---

### `isValidJwtStructure`

Validate JWT token structure (without verification) Useful for basic validation before costly verification

*Source: supabase/functions/_shared/security.ts:278*

---

### `unnamed`

Logging utilities with correlation ID support Ensures all logs include correlation ID for distributed tracing. Part of CORE-002 fix for consistent correlation ID propagation.

*Source: supabase/functions/_shared/correlation-logging.ts:1*

---

### `withCorrelation`

Create a logging function with correlation context

*Source: supabase/functions/_shared/correlation-logging.ts:19*

---

### `logError`

Enhanced console.error with correlation ID Use this instead of raw console.error

*Source: supabase/functions/_shared/correlation-logging.ts:43*

---

### `logWarn`

Enhanced console.warn with correlation ID Use this instead of raw console.warn

*Source: supabase/functions/_shared/correlation-logging.ts:64*

---

### `logInfo`

Enhanced console.log with correlation ID Use this instead of raw console.log for structured events

*Source: supabase/functions/_shared/correlation-logging.ts:81*

---

### `unnamed`

WhatsApp API Client with Circuit Breaker Protection Wraps all WhatsApp Graph API calls with circuit breaker pattern to prevent cascading failures when WhatsApp API is down.

*Source: supabase/functions/_shared/whatsapp-client.ts:1*

---

### `sendWhatsAppMessage`

Send a WhatsApp message with circuit breaker protection

*Source: supabase/functions/_shared/whatsapp-client.ts:45*

---

### `getWhatsAppCircuitStatus`

Get WhatsApp API circuit breaker status

*Source: supabase/functions/_shared/whatsapp-client.ts:138*

---

### `resetWhatsAppCircuit`

Reset WhatsApp API circuit breaker (manual intervention)

*Source: supabase/functions/_shared/whatsapp-client.ts:148*

---

### `maskPhone`

Mask phone number for logging (PII protection)

*Source: supabase/functions/_shared/whatsapp-client.ts:158*

---

### `getMomoProvider`

Get MoMo provider configuration for a phone number Returns null if no provider-specific configuration exists Falls back to default USSD codes in qr.ts

*Source: supabase/functions/_shared/wa-webhook-shared/domains/exchange/country_support.ts:97*

---

### `getLocalizedMenuName`

Get localized menu item name for a specific country

*Source: supabase/functions/_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:58*

---

### `fetchActiveMenuItems`

Fetch active menu items from database filtered by country Returns items with country-specific names applied

*Source: supabase/functions/_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:71*

---

### `normalizeMenuKey`

Normalize a menu key (legacy or canonical) to its canonical agent key.

*Source: supabase/functions/_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:150*

---

### `getMenuItemId`

Map menu item keys to IDS constants

*Source: supabase/functions/_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:159*

---

### `getMenuItemTranslationKeys`

Get translation key for menu item

*Source: supabase/functions/_shared/wa-webhook-shared/domains/menu/dynamic_home_menu.ts:170*

---

### `getAllowedCountries`

Get allowed countries for insurance feature. Tries to load from app_config table, falls back to default if not configured.

*Source: supabase/functions/_shared/wa-webhook-shared/domains/insurance/gate.ts:25*

---

### `saveIntent`

Save user intent to mobility_intents table for better querying and recommendations

*Source: supabase/functions/_shared/wa-webhook-shared/domains/intent_storage.ts:20*

---

### `getRecentIntents`

Get recent intents for a user

*Source: supabase/functions/_shared/wa-webhook-shared/domains/intent_storage.ts:51*

---

### `cleanupExpiredIntents`

Clean up expired intents (can be called periodically or via cron)

*Source: supabase/functions/_shared/wa-webhook-shared/domains/intent_storage.ts:76*

---

### `unnamed`

AI Agent Location Integration Helper Standardized location resolution before agent execution All AI agents MUST use this before processing user requests

*Source: supabase/functions/_shared/wa-webhook-shared/ai-agents/location-integration.ts:1*

---

### `prepareAgentLocation`

Prepare agent context with location This MUST be called before any agent processes a user request Flow: 1. If user just shared location → save to cache and use it 2. Check 30-minute cache 3. Check saved locations (home/work based on agent type) 4. Prompt user to share location

*Source: supabase/functions/_shared/wa-webhook-shared/ai-agents/location-integration.ts:33*

---

### `formatLocationContext`

Format location for display in agent responses

*Source: supabase/functions/_shared/wa-webhook-shared/ai-agents/location-integration.ts:138*

---

### `extractUserIntent`

Standard intent extraction from user message Agents should use this to identify what user wants

*Source: supabase/functions/_shared/wa-webhook-shared/ai-agents/location-integration.ts:173*

---

### `unnamed`

Enhanced Middleware Integration for wa-webhook Provides middleware functions that integrate rate limiting, caching, error handling, and metrics without modifying existing code. These can be optionally integrated into the existing pipeline.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:1*

---

### `applyRateLimiting`

Apply rate limiting middleware Can be called from existing pipeline to add rate limiting

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:21*

---

### `trackWebhookMetrics`

Track webhook metrics

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:68*

---

### `getCachedUserContext`

Cache user context with automatic expiration Can be used in message_context.ts to cache user lookups

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:92*

---

### `wrapError`

Wrap error with enhanced error handling Can be used in existing try-catch blocks to enhance error responses

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:109*

---

### `addRateLimitHeaders`

Add rate limit headers to response

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:135*

---

### `enhanceWebhookRequest`

Middleware function to enhance PreparedWebhook This can be called after processWebhookRequest to add enhancements

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:160*

---

### `logWebhookCompletion`

Log webhook processing completion

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:197*

---

### `processMessageWithEnhancements`

Example: Enhanced message processor wrapper This shows how to wrap existing handleMessage calls with enhancements

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:225*

---

### `areEnhancementsEnabled`

Utility to check if enhancements are enabled

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:288*

---

### `getEnhancementConfig`

Get enhancement configuration

*Source: supabase/functions/_shared/wa-webhook-shared/utils/middleware.ts:297*

---

### `unnamed`

Message Deduplication and Queue Integration Provides deduplication checking against the database and queue integration for reliable message processing.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts:1*

---

### `isNewMessage`

Check if a message has already been processed (database-backed deduplication)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts:14*

---

### `markMessageProcessed`

Mark a message as processed

*Source: supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts:67*

---

### `enqueueMessage`

Add message to processing queue

*Source: supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts:115*

---

### `getOrCreateConversationMemory`

Get or create AI conversation memory

*Source: supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts:175*

---

### `updateConversationMemory`

Update AI conversation memory

*Source: supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts:272*

---

### `cleanupOldConversations`

Cleanup old conversation memories (older than 7 days with no activity)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/message-deduplication.ts:346*

---

### `unnamed`

Enhanced Error Handling for wa-webhook Provides structured error handling with classification, user notifications, and retry logic. Complements existing error handling.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/error_handler.ts:1*

---

### `normalizeError`

Normalize any error to WebhookError

*Source: supabase/functions/_shared/wa-webhook-shared/utils/error_handler.ts:83*

---

### `handleWebhookError`

Handle webhook error with logging and optional user notification

*Source: supabase/functions/_shared/wa-webhook-shared/utils/error_handler.ts:167*

---

### `notifyUserOfError`

Send error notification to user

*Source: supabase/functions/_shared/wa-webhook-shared/utils/error_handler.ts:199*

---

### `createErrorResponse`

Create error response

*Source: supabase/functions/_shared/wa-webhook-shared/utils/error_handler.ts:228*

---

### `maskPhone`

Mask phone number for logging (PII protection)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/error_handler.ts:276*

---

### `isRetryableError`

Check if error is retryable

*Source: supabase/functions/_shared/wa-webhook-shared/utils/error_handler.ts:284*

---

### `getRetryDelay`

Get retry delay based on attempt number

*Source: supabase/functions/_shared/wa-webhook-shared/utils/error_handler.ts:300*

---

### `unnamed`

Enhanced Health Check for wa-webhook Provides comprehensive health monitoring including rate limiter, cache, and database connectivity.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:1*

---

### `checkDatabase`

Check database health

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:39*

---

### `checkRateLimiter`

Check rate limiter health

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:78*

---

### `checkCache`

Check cache health

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:100*

---

### `checkMetrics`

Check metrics collector health

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:122*

---

### `performHealthCheck`

Perform comprehensive health check

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:143*

---

### `createHealthCheckResponse`

Create health check response

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:180*

---

### `createLivenessResponse`

Simple liveness probe (for Kubernetes, etc.)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:201*

---

### `createReadinessResponse`

Readiness probe (checks critical dependencies)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/health_check.ts:211*

---

### `unnamed`

What to prioritize in sorting. Defaults to 'distance' for nearby flows, 'time' for scheduled flows.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts:11*

---

### `getMatchTimestamp`

Get the timestamp from a match result, preferring matched_at over created_at.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts:18*

---

### `timestampMs`

Convert a match's timestamp to milliseconds for comparison.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts:25*

---

### `getDistance`

Get the distance from a match, returning MAX_SAFE_INTEGER if not available.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts:33*

---

### `sortMatches`

Shared sorting function for match results. Provides consistent sorting across all mobility flows.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts:42*

---

### `compareByDistance`

Comparator function for sorting by distance first. Can be used directly with Array.sort().

*Source: supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts:91*

---

### `compareByTime`

Comparator function for sorting by time first. Can be used directly with Array.sort().

*Source: supabase/functions/_shared/wa-webhook-shared/utils/sortMatches.ts:107*

---

### `unnamed`

Dynamic Submenu Helper Provides reusable functions to fetch and display dynamic submenus from database Eliminates hardcoded menu lists

*Source: supabase/functions/_shared/wa-webhook-shared/utils/dynamic_submenu.ts:1*

---

### `fetchSubmenuItems`

Fetch submenu items for a parent menu from database

*Source: supabase/functions/_shared/wa-webhook-shared/utils/dynamic_submenu.ts:21*

---

### `fetchProfileMenuItems`

Fetch profile menu items from database

*Source: supabase/functions/_shared/wa-webhook-shared/utils/dynamic_submenu.ts:51*

---

### `submenuItemsToRows`

Convert submenu items to WhatsApp list row format

*Source: supabase/functions/_shared/wa-webhook-shared/utils/dynamic_submenu.ts:85*

---

### `getSubmenuRows`

Get submenu items as WhatsApp rows with back button Convenience function that combines fetch + convert + add back button

*Source: supabase/functions/_shared/wa-webhook-shared/utils/dynamic_submenu.ts:106*

---

### `hasSubmenu`

Check if a submenu exists and has items

*Source: supabase/functions/_shared/wa-webhook-shared/utils/dynamic_submenu.ts:143*

---

### `getSubmenuAction`

Get the default action for a submenu item Used for routing based on action_type

*Source: supabase/functions/_shared/wa-webhook-shared/utils/dynamic_submenu.ts:159*

---

### `unnamed`

Increment a counter

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:36*

---

### `unnamed`

Set a gauge value

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:50*

---

### `unnamed`

Record a histogram value (for durations, sizes, etc.)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:63*

---

### `unnamed`

Get dimension key for grouping

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:81*

---

### `unnamed`

Parse dimension key back to object

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:95*

---

### `unnamed`

Calculate histogram statistics

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:110*

---

### `unnamed`

Flush metrics to logs

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:151*

---

### `unnamed`

Get metrics in Prometheus format (for /metrics endpoint)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:206*

---

### `unnamed`

Get summary statistics

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:260*

---

### `unnamed`

Start periodic flushing

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:271*

---

### `unnamed`

Stop flushing and cleanup

*Source: supabase/functions/_shared/wa-webhook-shared/utils/metrics_collector.ts:282*

---

### `unnamed`

Get value from cache

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:48*

---

### `unnamed`

Set value in cache

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:71*

---

### `unnamed`

Get or set value using factory function

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:94*

---

### `unnamed`

Delete from cache

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:112*

---

### `unnamed`

Clear all cache

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:123*

---

### `unnamed`

Check if cache contains key

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:135*

---

### `unnamed`

Evict least recently used entry

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:148*

---

### `unnamed`

Clean up expired entries

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:172*

---

### `unnamed`

Get cache statistics

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:195*

---

### `unnamed`

Check if cache is healthy

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:212*

---

### `unnamed`

Start periodic cleanup

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:219*

---

### `unnamed`

Cleanup resources

*Source: supabase/functions/_shared/wa-webhook-shared/utils/cache.ts:231*

---

### `unnamed`

Check if identifier should be rate limited

*Source: supabase/functions/_shared/wa-webhook-shared/utils/rate_limiter.ts:48*

---

### `unnamed`

Manually unblock an identifier

*Source: supabase/functions/_shared/wa-webhook-shared/utils/rate_limiter.ts:120*

---

### `unnamed`

Get statistics for monitoring

*Source: supabase/functions/_shared/wa-webhook-shared/utils/rate_limiter.ts:128*

---

### `unnamed`

Mask identifier for logging (PII protection)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/rate_limiter.ts:143*

---

### `unnamed`

Cleanup expired buckets

*Source: supabase/functions/_shared/wa-webhook-shared/utils/rate_limiter.ts:151*

---

### `unnamed`

Start periodic cleanup

*Source: supabase/functions/_shared/wa-webhook-shared/utils/rate_limiter.ts:174*

---

### `unnamed`

Stop cleanup (for testing/shutdown)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/rate_limiter.ts:183*

---

### `unnamed`

Standardized Location Resolution for AI Agents Critical component for all AI agents to obtain user location Priority: 30-min cache → Saved locations → Prompt user

*Source: supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts:1*

---

### `resolveUserLocation`

Resolve user location with standard priority logic

*Source: supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts:64*

---

### `buildLocationPrompt`

Build context-aware location prompt message

*Source: supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts:180*

---

### `saveLocationToCache`

Save location to cache after user shares Call this when user shares a fresh location

*Source: supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts:202*

---

### `getUserSavedLocations`

Get all saved locations for a user Useful for showing user their saved locations to choose from

*Source: supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts:231*

---

### `isLocationCacheValid`

Check if location cache is still valid Useful for conditional prompts

*Source: supabase/functions/_shared/wa-webhook-shared/utils/location-resolver.ts:262*

---

### `ensureProfile`

Thin wrapper around the shared ensureProfile() helper so every webhook surface reuses the same normalization and user-id mapping logic.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/profile.ts:9*

---

### `validateAndLoadConfig`

Validate and load configuration

*Source: supabase/functions/_shared/wa-webhook-shared/utils/config_validator.ts:54*

---

### `getEnv`

Get environment variable with fallback to multiple keys

*Source: supabase/functions/_shared/wa-webhook-shared/utils/config_validator.ts:116*

---

### `loadConfig`

Load configuration with defaults

*Source: supabase/functions/_shared/wa-webhook-shared/utils/config_validator.ts:127*

---

### `printConfigStatus`

Print configuration status

*Source: supabase/functions/_shared/wa-webhook-shared/utils/config_validator.ts:174*

---

### `assertConfigValid`

Assert configuration is valid (throws if not)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/config_validator.ts:202*

---

### `encodeTelUriForQr`

Encodes a USSD string as a tel: URI for QR codes. Android QR scanner apps often fail to decode percent-encoded characters before passing the URI to the dialer. This function leaves * and # unencoded for better Android compatibility while maintaining iOS support.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ussd.ts:14*

---

### `unnamed`

AI Agent Chat Interface Utilities Provides consistent, emoji-rich, button-enabled chat interfaces for all AI agents. All agents MUST use natural language chat with: - Emoji-numbered listings (1️⃣, 2️⃣, 3️⃣) - Action buttons for quick responses - Concise messages with emojis

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:1*

---

### `formatEmojiNumberedList`

Format options/items as emoji-numbered list

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:20*

---

### `createAgentActionButtons`

Create action buttons for agent responses

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:62*

---

### `sendAgentListResponse`

Send agent message with emoji-numbered list and action buttons

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:90*

---

### `sendAgentMessageWithActions`

Send concise agent message with action buttons

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:136*

---

### `sendAgentMessage`

Send simple agent text message with emoji

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:163*

---

### `formatAgentError`

Format error message for agent responses

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:178*

---

### `formatAgentSuccess`

Format success message for agent responses

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:186*

---

### `createQuickReplyInstruction`

Create quick reply instruction text

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:193*

---

### `parseEmojiNumber`

Parse emoji number from user input Supports both emoji (1️⃣) and plain numbers (1)

*Source: supabase/functions/_shared/wa-webhook-shared/utils/ai-chat-interface.ts:210*

---

### `buildMomoUssdForQr`

Builds MOMO USSD code with tel URI optimized for QR codes. Uses unencoded * and # for better Android QR scanner compatibility.

*Source: supabase/functions/_shared/wa-webhook-shared/utils/momo.ts:16*

---

### `unnamed`

Phase 3.1: Post-Trip Save Prompts Prompt users to save trip destinations as saved locations

*Source: supabase/functions/_shared/wa-webhook-shared/locations/trip-completion.ts:1*

---

### `parseSaveLocationAction`

Handle SAVE_LOC_* button clicks from post-trip prompts

*Source: supabase/functions/_shared/wa-webhook-shared/locations/trip-completion.ts:69*

---

### `getEmptyLocationsMessage`

Standardized location-related messages Phase 2.3: Update empty state messages with sharing instructions

*Source: supabase/functions/_shared/wa-webhook-shared/locations/messages.ts:1*

---

### `reverseGeocode`

Reverse geocode coordinates to human-readable address Uses OpenStreetMap Nominatim API (free, no API key required) Rate limit: 1 request per second Usage Policy: https://operations.osmfoundation.org/policies/nominatim/

*Source: supabase/functions/_shared/wa-webhook-shared/locations/geocoding.ts:21*

---

### `formatAddress`

Format Nominatim address into concise human-readable format

*Source: supabase/functions/_shared/wa-webhook-shared/locations/geocoding.ts:106*

---

### `getAddressOrCoords`

Get formatted address or fallback to coordinates

*Source: supabase/functions/_shared/wa-webhook-shared/locations/geocoding.ts:137*

---

### `clearGeocodeCache`

Clear geocoding cache (useful for testing)

*Source: supabase/functions/_shared/wa-webhook-shared/locations/geocoding.ts:154*

---

### `getGeocodeStats`

Get cache stats (for monitoring)

*Source: supabase/functions/_shared/wa-webhook-shared/locations/geocoding.ts:161*

---

### `findNearbyLocations`

Check if a location already exists within a specified radius Uses Haversine formula to calculate distance between coordinates

*Source: supabase/functions/_shared/wa-webhook-shared/locations/deduplication.ts:3*

---

### `calculateDistance`

Calculate distance between two coordinates using Haversine formula Returns distance in meters

*Source: supabase/functions/_shared/wa-webhook-shared/locations/deduplication.ts:50*

---

### `checkDuplicateLocation`

Check if location is duplicate and return appropriate message

*Source: supabase/functions/_shared/wa-webhook-shared/locations/deduplication.ts:74*

---

### `unnamed`

Phase 3.3 & 3.4: Smart Location Suggestions Time-based and usage-based location recommendations

*Source: supabase/functions/_shared/wa-webhook-shared/locations/suggestions.ts:1*

---

### `getSmartLocationSuggestion`

Get smart location suggestion based on time of day and usage patterns

*Source: supabase/functions/_shared/wa-webhook-shared/locations/suggestions.ts:18*

---

### `getSuggestionMessage`

Get greeting message with smart suggestion

*Source: supabase/functions/_shared/wa-webhook-shared/locations/suggestions.ts:79*

---

### `trackLocationUsage`

Increment usage counter when location is used

*Source: supabase/functions/_shared/wa-webhook-shared/locations/suggestions.ts:108*

---

### `allocateTokens`

Admin allocates tokens to a user

*Source: supabase/functions/_shared/wa-webhook-shared/wallet/allocate.ts:12*

---

### `allocateInsuranceBonus`

Allocate insurance bonus tokens

*Source: supabase/functions/_shared/wa-webhook-shared/wallet/allocate.ts:141*

---

### `allocateReferralBonus`

Allocate referral bonus tokens

*Source: supabase/functions/_shared/wa-webhook-shared/wallet/allocate.ts:228*

---

### `sendProfileMenu`

Display the Profile menu with options for managing businesses, vehicles, and tokens Delegates to the comprehensive Profile hub implementation

*Source: supabase/functions/_shared/wa-webhook-shared/flows/profile.ts:6*

---

### `unnamed`

Gemini-Backed Tools for EasyMO Agents Specialized tools leveraging Gemini's Google ecosystem integration: - Maps & Places API integration - Document parsing and OCR - Data normalization and enrichment - Cross-checking and validation All tools remain grounded in EasyMO data - Gemini is a processing engine, not a data source.

*Source: supabase/functions/_shared/gemini-tools.ts:1*

---

### `normalizeVendorPayload`

Normalize vendor payload using Gemini Extracts structured data from messy text/images

*Source: supabase/functions/_shared/gemini-tools.ts:48*

---

### `geocodeAddress`

Geocode an address using Gemini (can integrate with Google Maps) For now, returns null - integrate with actual geocoding API

*Source: supabase/functions/_shared/gemini-tools.ts:179*

---

### `findVendorsNearby`

Find vendors nearby using Google Maps/Places Filters results to only EasyMO-registered vendors

*Source: supabase/functions/_shared/gemini-tools.ts:197*

---

### `parseDocument`

Parse and structure document/image (menus, property listings, job postings, etc.)

*Source: supabase/functions/_shared/gemini-tools.ts:266*

---

### `crossCheckResponse`

Cross-check and validate critical information Used for insurance quotes, legal summaries, compliance checks

*Source: supabase/functions/_shared/gemini-tools.ts:380*

---

### `unnamed`

Send a chat completion request

*Source: supabase/functions/_shared/llm-provider-interface.ts:62*

---

### `unnamed`

Generate embeddings for semantic search

*Source: supabase/functions/_shared/llm-provider-interface.ts:67*

---

### `unnamed`

Analyze an image with vision capabilities

*Source: supabase/functions/_shared/llm-provider-interface.ts:72*

---

### `unnamed`

Check if provider is healthy

*Source: supabase/functions/_shared/llm-provider-interface.ts:77*

---

### `unnamed`

Enhanced Error Handler with i18n Support Provides user-friendly error messages with multi-language support

*Source: supabase/functions/_shared/errors/error-handler.ts:1*

---

### `unnamed`

Marketplace Utility Functions Location parsing, formatting, and notification utilities.

*Source: supabase/functions/_shared/marketplace-utils.ts:1*

---

### `parseWhatsAppLocation`

Parse location from WhatsApp location message

*Source: supabase/functions/_shared/marketplace-utils.ts:36*

---

### `parseLocationFromText`

Parse location from text (city/area names in Rwanda)

*Source: supabase/functions/_shared/marketplace-utils.ts:55*

---

### `calculateDistance`

Calculate distance between two points (Haversine formula)

*Source: supabase/functions/_shared/marketplace-utils.ts:112*

---

### `formatPrice`

Format price with currency

*Source: supabase/functions/_shared/marketplace-utils.ts:138*

---

### `formatDistance`

Format distance

*Source: supabase/functions/_shared/marketplace-utils.ts:151*

---

### `formatRating`

Format rating as stars

*Source: supabase/functions/_shared/marketplace-utils.ts:161*

---

### `formatListing`

Format listing for WhatsApp message

*Source: supabase/functions/_shared/marketplace-utils.ts:170*

---

### `formatBusiness`

Format business for WhatsApp message

*Source: supabase/functions/_shared/marketplace-utils.ts:204*

---

### `extractWhatsAppMessage`

Extract WhatsApp message from webhook payload

*Source: supabase/functions/_shared/marketplace-utils.ts:242*

---

### `buildBuyerNotification`

Build notification message for matching buyers

*Source: supabase/functions/_shared/marketplace-utils.ts:297*

---

### `buildSellerNotification`

Build notification message for sellers

*Source: supabase/functions/_shared/marketplace-utils.ts:314*

---

### `parsePriceFromText`

Parse price from text

*Source: supabase/functions/_shared/marketplace-utils.ts:334*

---

### `isValidPhone`

Validate phone number format

*Source: supabase/functions/_shared/marketplace-utils.ts:354*

---

### `normalizePhone`

Normalize phone number to international format

*Source: supabase/functions/_shared/marketplace-utils.ts:363*

---

### `maskPhone`

Mask phone number for logging (PII protection)

*Source: supabase/functions/_shared/marketplace-utils.ts:381*

---

### `logMarketplaceEvent`

Log marketplace event with masked PII

*Source: supabase/functions/_shared/marketplace-utils.ts:389*

---

### `unnamed`

AI Agent Orchestrator - Core Logic Manages WhatsApp message routing to appropriate AI agents, intent parsing, and domain action execution. NOW WITH DATABASE-DRIVEN CONFIGURATION & TOOL EXECUTION: - Loads personas, system instructions, tools, tasks, KBs from database - Caches configs for 5 minutes to reduce DB load - Falls back to hardcoded configs if DB fails - Executes tools with validation and logging

*Source: supabase/functions/_shared/agent-orchestrator.ts:1*

---

### `unnamed`

Main entry point: Process incoming WhatsApp message

*Source: supabase/functions/_shared/agent-orchestrator.ts:53*

---

### `unnamed`

Get or create a chat session for session persistence

*Source: supabase/functions/_shared/agent-orchestrator.ts:128*

---

### `unnamed`

Fallback method to get or create session without RPC

*Source: supabase/functions/_shared/agent-orchestrator.ts:158*

---

### `unnamed`

Add message to session history

*Source: supabase/functions/_shared/agent-orchestrator.ts:200*

---

### `unnamed`

Get session conversation history

*Source: supabase/functions/_shared/agent-orchestrator.ts:243*

---

### `unnamed`

Get or create WhatsApp user by phone number

*Source: supabase/functions/_shared/agent-orchestrator.ts:270*

---

### `unnamed`

Save user's location to cache (30-minute TTL) Used when user shares GPS coordinates

*Source: supabase/functions/_shared/agent-orchestrator.ts:298*

---

### `unnamed`

Determine which agent should handle this message Can be based on: - User's last active conversation - Keywords in message - User context/roles

*Source: supabase/functions/_shared/agent-orchestrator.ts:330*

---

### `unnamed`

Get or create conversation for user × agent

*Source: supabase/functions/_shared/agent-orchestrator.ts:408*

---

### `unnamed`

Store WhatsApp message in database

*Source: supabase/functions/_shared/agent-orchestrator.ts:475*

---

### `unnamed`

Parse intent from user message using LLM NOW LOADS SYSTEM INSTRUCTIONS FROM DATABASE

*Source: supabase/functions/_shared/agent-orchestrator.ts:499*

---

### `unnamed`

Simple intent parsing (placeholder for LLM integration) NOW RECEIVES AGENT CONFIG WITH TOOLS AND TASKS

*Source: supabase/functions/_shared/agent-orchestrator.ts:537*

---

### `unnamed`

Extract job search parameters from message

*Source: supabase/functions/_shared/agent-orchestrator.ts:709*

---

### `unnamed`

Extract property search parameters from message

*Source: supabase/functions/_shared/agent-orchestrator.ts:738*

---

### `unnamed`

Extract ride parameters from message

*Source: supabase/functions/_shared/agent-orchestrator.ts:765*

---

### `unnamed`

Extract insurance parameters from message

*Source: supabase/functions/_shared/agent-orchestrator.ts:803*

---

### `unnamed`

Store parsed intent in database

*Source: supabase/functions/_shared/agent-orchestrator.ts:835*

---

### `unnamed`

Execute agent-specific action based on intent NOW WITH TOOL EXECUTION FROM DATABASE

*Source: supabase/functions/_shared/agent-orchestrator.ts:864*

---

### `unnamed`

Legacy action handlers (fallback when no tool matches)

*Source: supabase/functions/_shared/agent-orchestrator.ts:944*

---

### `unnamed`

Jobs agent actions

*Source: supabase/functions/_shared/agent-orchestrator.ts:984*

---

### `unnamed`

Real estate agent actions

*Source: supabase/functions/_shared/agent-orchestrator.ts:1004*

---

### `unnamed`

Waiter agent actions

*Source: supabase/functions/_shared/agent-orchestrator.ts:1022*

---

### `unnamed`

Farmer agent actions

*Source: supabase/functions/_shared/agent-orchestrator.ts:1042*

---

### `unnamed`

Business broker agent actions

*Source: supabase/functions/_shared/agent-orchestrator.ts:1056*

---

### `unnamed`

Rides agent actions

*Source: supabase/functions/_shared/agent-orchestrator.ts:1070*

---

### `unnamed`

Insurance agent actions

*Source: supabase/functions/_shared/agent-orchestrator.ts:1101*

---

### `unnamed`

Send response back to user via WhatsApp Returns the response text for session history

*Source: supabase/functions/_shared/agent-orchestrator.ts:1130*

---

### `unnamed`

Generate response text based on intent and persona

*Source: supabase/functions/_shared/agent-orchestrator.ts:1172*

---

### `unnamed`

Standardized Health Check Implementation Used across all microservices for consistent health reporting

*Source: supabase/functions/_shared/health-check.ts:1*

---

### `healthResponse`

Create health check response

*Source: supabase/functions/_shared/health-check.ts:110*

---

### `unnamed`

Performance Module Exports

*Source: supabase/functions/_shared/performance/index.ts:1*

---

### `unnamed`

Kinyarwanda Translations

*Source: supabase/functions/_shared/i18n/locales/rw.ts:1*

---

### `unnamed`

English Translations

*Source: supabase/functions/_shared/i18n/locales/en.ts:1*

---

### `unnamed`

French Translations

*Source: supabase/functions/_shared/i18n/locales/fr.ts:1*

---

### `unnamed`

Translator Simple translation function with fallback support

*Source: supabase/functions/_shared/i18n/translator.ts:1*

---

### `t`

Translate a key to the given language

*Source: supabase/functions/_shared/i18n/translator.ts:35*

---

### `getTranslations`

Get all translations for a locale

*Source: supabase/functions/_shared/i18n/translator.ts:57*

---

### `hasTranslation`

Check if a translation key exists

*Source: supabase/functions/_shared/i18n/translator.ts:64*

---

### `unnamed`

I18n Module Exports

*Source: supabase/functions/_shared/i18n/index.ts:1*

---

### `checkRateLimit`

Check rate limit using sliding window algorithm

*Source: supabase/functions/_shared/rate-limit.ts:18*

---

### `rateLimitResponse`

Create a 429 Too Many Requests response

*Source: supabase/functions/_shared/rate-limit.ts:91*

---

### `getClientIdentifier`

Extract client identifier for rate limiting Tries multiple sources: custom header, forwarded IP, or fallback

*Source: supabase/functions/_shared/rate-limit.ts:120*

---

### `unnamed`

Message Deduplicator Centralized service for detecting and preventing duplicate message processing Uses wa_events table as source of truth for message tracking Created: 2025-12-01 Part of: Platform cleanup - standardize deduplication across webhooks

*Source: supabase/functions/_shared/message-deduplicator.ts:1*

---

### `unnamed`

Check if a message has already been processed Returns true if message exists in wa_events table

*Source: supabase/functions/_shared/message-deduplicator.ts:36*

---

### `unnamed`

Check and get full deduplication info

*Source: supabase/functions/_shared/message-deduplicator.ts:60*

---

### `unnamed`

Record a message as processed Stores in wa_events table for future deduplication checks

*Source: supabase/functions/_shared/message-deduplicator.ts:93*

---

### `unnamed`

Check and record in a single operation Returns true if message should be processed (not a duplicate)

*Source: supabase/functions/_shared/message-deduplicator.ts:136*

---

### `unnamed`

Clean up old deduplication records Call this periodically to prevent table bloat

*Source: supabase/functions/_shared/message-deduplicator.ts:159*

---

### `checkDuplicate`

Convenience function for quick duplicate checks

*Source: supabase/functions/_shared/message-deduplicator.ts:194*

---

### `processIfUnique`

Convenience function for check + record pattern

*Source: supabase/functions/_shared/message-deduplicator.ts:205*

---

### `assertEnvironmentValid`

Validate and throw if critical errors

*Source: supabase/functions/_shared/env-validator.ts:119*

---

### `unnamed`

LLM Router - Intelligent routing between OpenAI and Gemini Provides: - Transparent provider switching - Failover and retry logic - Provider-specific tool routing - Load balancing and cost optimization

*Source: supabase/functions/_shared/llm-router.ts:1*

---

### `unnamed`

Execute an LLM request with intelligent routing

*Source: supabase/functions/_shared/llm-router.ts:85*

---

### `unnamed`

Execute a tool call with provider-specific routing

*Source: supabase/functions/_shared/llm-router.ts:160*

---

### `unnamed`

Execute failover to backup provider

*Source: supabase/functions/_shared/llm-router.ts:208*

---

### `unnamed`

Select the appropriate provider based on rules and context

*Source: supabase/functions/_shared/llm-router.ts:252*

---

### `unnamed`

Load agent provider rules from database

*Source: supabase/functions/_shared/llm-router.ts:275*

---

### `unnamed`

Get default provider rules for an agent

*Source: supabase/functions/_shared/llm-router.ts:340*

---

### `unnamed`

Health check all providers

*Source: supabase/functions/_shared/llm-router.ts:385*

---

### `unnamed`

Message Builder Fluent API for building WhatsApp messages

*Source: supabase/functions/_shared/messaging/builder.ts:1*

---

### `unnamed`

Add text content

*Source: supabase/functions/_shared/messaging/builder.ts:17*

---

### `unnamed`

Add bold text

*Source: supabase/functions/_shared/messaging/builder.ts:25*

---

### `unnamed`

Add italic text

*Source: supabase/functions/_shared/messaging/builder.ts:33*

---

### `unnamed`

Add line break

*Source: supabase/functions/_shared/messaging/builder.ts:41*

---

### `unnamed`

Add double line break

*Source: supabase/functions/_shared/messaging/builder.ts:49*

---

### `unnamed`

Add bullet point

*Source: supabase/functions/_shared/messaging/builder.ts:57*

---

### `unnamed`

Add numbered item

*Source: supabase/functions/_shared/messaging/builder.ts:65*

---

### `unnamed`

Add emoji prefix

*Source: supabase/functions/_shared/messaging/builder.ts:73*

---

### `unnamed`

Build final message

*Source: supabase/functions/_shared/messaging/builder.ts:81*

---

### `unnamed`

Set message body

*Source: supabase/functions/_shared/messaging/builder.ts:103*

---

### `unnamed`

Set header text

*Source: supabase/functions/_shared/messaging/builder.ts:111*

---

### `unnamed`

Set footer text

*Source: supabase/functions/_shared/messaging/builder.ts:119*

---

### `unnamed`

Add a button

*Source: supabase/functions/_shared/messaging/builder.ts:127*

---

### `unnamed`

Add back button

*Source: supabase/functions/_shared/messaging/builder.ts:141*

---

### `unnamed`

Add cancel button

*Source: supabase/functions/_shared/messaging/builder.ts:148*

---

### `unnamed`

Build button message payload

*Source: supabase/functions/_shared/messaging/builder.ts:155*

---

### `unnamed`

Set list title

*Source: supabase/functions/_shared/messaging/builder.ts:179*

---

### `unnamed`

Set message body

*Source: supabase/functions/_shared/messaging/builder.ts:187*

---

### `unnamed`

Set button text

*Source: supabase/functions/_shared/messaging/builder.ts:195*

---

### `unnamed`

Set section title

*Source: supabase/functions/_shared/messaging/builder.ts:203*

---

### `unnamed`

Add a row

*Source: supabase/functions/_shared/messaging/builder.ts:211*

---

### `unnamed`

Add back row

*Source: supabase/functions/_shared/messaging/builder.ts:225*

---

### `unnamed`

Build list message options

*Source: supabase/functions/_shared/messaging/builder.ts:232*

---

### `text`

Create text message builder

*Source: supabase/functions/_shared/messaging/builder.ts:250*

---

### `buttons`

Create button message builder

*Source: supabase/functions/_shared/messaging/builder.ts:257*

---

### `list`

Create list message builder

*Source: supabase/functions/_shared/messaging/builder.ts:264*

---

### `unnamed`

Reusable UI Components Pre-built message components for common patterns

*Source: supabase/functions/_shared/messaging/components/index.ts:1*

---

### `successMessage`

Success confirmation message

*Source: supabase/functions/_shared/messaging/components/index.ts:16*

---

### `errorMessage`

Error message

*Source: supabase/functions/_shared/messaging/components/index.ts:36*

---

### `warningMessage`

Warning message

*Source: supabase/functions/_shared/messaging/components/index.ts:55*

---

### `infoMessage`

Info message

*Source: supabase/functions/_shared/messaging/components/index.ts:68*

---

### `confirmationDialog`

Confirmation dialog with yes/no buttons

*Source: supabase/functions/_shared/messaging/components/index.ts:85*

---

### `actionConfirmation`

Action confirmation with custom buttons

*Source: supabase/functions/_shared/messaging/components/index.ts:101*

---

### `homeMenuList`

Home menu list

*Source: supabase/functions/_shared/messaging/components/index.ts:122*

---

### `homeOnlyButton`

Back to home button only

*Source: supabase/functions/_shared/messaging/components/index.ts:140*

---

### `backHomeButtons`

Back and home buttons

*Source: supabase/functions/_shared/messaging/components/index.ts:147*

---

### `mobilityMenuList`

Mobility menu list

*Source: supabase/functions/_shared/messaging/components/index.ts:161*

---

### `vehicleSelectionList`

Vehicle selection list

*Source: supabase/functions/_shared/messaging/components/index.ts:178*

---

### `shareLocationPrompt`

Share location prompt

*Source: supabase/functions/_shared/messaging/components/index.ts:196*

---

### `insuranceMenuList`

Insurance menu list

*Source: supabase/functions/_shared/messaging/components/index.ts:219*

---

### `claimTypeSelectionList`

Claim type selection list

*Source: supabase/functions/_shared/messaging/components/index.ts:234*

---

### `walletMenuList`

Wallet menu list

*Source: supabase/functions/_shared/messaging/components/index.ts:255*

---

### `transferConfirmation`

Transfer confirmation

*Source: supabase/functions/_shared/messaging/components/index.ts:271*

---

### `tripStatusMessage`

Trip status message

*Source: supabase/functions/_shared/messaging/components/index.ts:293*

---

### `tripActionButtons`

Trip action buttons based on status

*Source: supabase/functions/_shared/messaging/components/index.ts:323*

---

### `processingMessage`

Processing message

*Source: supabase/functions/_shared/messaging/components/index.ts:363*

---

### `searchingMessage`

Searching message

*Source: supabase/functions/_shared/messaging/components/index.ts:373*

---

### `unnamed`

WhatsApp Client Wrapper Unified interface for sending WhatsApp messages

*Source: supabase/functions/_shared/messaging/client.ts:1*

---

### `unnamed`

Send API request

*Source: supabase/functions/_shared/messaging/client.ts:38*

---

### `unnamed`

Send text message

*Source: supabase/functions/_shared/messaging/client.ts:86*

---

### `unnamed`

Send button message

*Source: supabase/functions/_shared/messaging/client.ts:99*

---

### `unnamed`

Send list message

*Source: supabase/functions/_shared/messaging/client.ts:135*

---

### `unnamed`

Send location message

*Source: supabase/functions/_shared/messaging/client.ts:165*

---

### `unnamed`

Send template message

*Source: supabase/functions/_shared/messaging/client.ts:183*

---

### `unnamed`

Get media URL

*Source: supabase/functions/_shared/messaging/client.ts:209*

---

### `unnamed`

Download media

*Source: supabase/functions/_shared/messaging/client.ts:227*

---

### `getWhatsAppClient`

Get WhatsApp client instance

*Source: supabase/functions/_shared/messaging/client.ts:251*

---

### `sendText`

Send text message using context

*Source: supabase/functions/_shared/messaging/client.ts:265*

---

### `sendButtons`

Send buttons message using context

*Source: supabase/functions/_shared/messaging/client.ts:279*

---

### `sendList`

Send list message using context

*Source: supabase/functions/_shared/messaging/client.ts:298*

---

### `sendLocation`

Send location message using context

*Source: supabase/functions/_shared/messaging/client.ts:315*

---

### `unnamed`

Messaging Module Exports

*Source: supabase/functions/_shared/messaging/index.ts:1*

---

### `unnamed`

Google Gemini LLM Provider Implementation Wraps Google Gemini API with the standard LLM Provider interface Provides access to Gemini's Google-connected tools (Maps, Search, etc.)

*Source: supabase/functions/_shared/llm-provider-gemini.ts:1*

---

### `unnamed`

Convert OpenAI-style JSON schema to Gemini format

*Source: supabase/functions/_shared/llm-provider-gemini.ts:262*

---

### `unnamed`

WhatsApp API wrapper Provides a unified interface for sending WhatsApp messages

*Source: supabase/functions/_shared/whatsapp-api.ts:1*

---

### `sendWhatsAppMessage`

Send a WhatsApp message (text, list, or buttons)

*Source: supabase/functions/_shared/whatsapp-api.ts:14*

---

### `unnamed`

Lazy Handler Loader Deferred loading of handlers to optimize cold starts

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:1*

---

### `unnamed`

Check if module is loaded

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:34*

---

### `unnamed`

Get loaded module (null if not loaded)

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:41*

---

### `unnamed`

Get load time in ms

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:48*

---

### `unnamed`

Load the module

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:55*

---

### `unnamed`

Preload the module (fire and forget)

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:85*

---

### `registerLazyHandler`

Register a lazy handler

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:106*

---

### `getLazyHandler`

Get a lazy handler

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:116*

---

### `isHandlerLoaded`

Check if handler is loaded

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:128*

---

### `preloadHandlers`

Preload handlers

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:135*

---

### `getHandlerLoadingStats`

Get handler loading stats

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:145*

---

### `lazy`

Create a lazy handler function

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:165*

---

### `lazyExecute`

Execute a handler function lazily

*Source: supabase/functions/_shared/handlers/lazy-loader.ts:182*

---

### `unnamed`

Warm-up Module Optimizes cold start times through preloading

*Source: supabase/functions/_shared/warmup/index.ts:1*

---

### `unnamed`

Preload database connection

*Source: supabase/functions/_shared/warmup/index.ts:16*

---

### `unnamed`

Preload app configuration

*Source: supabase/functions/_shared/warmup/index.ts:18*

---

### `unnamed`

Handler names to preload

*Source: supabase/functions/_shared/warmup/index.ts:20*

---

### `unnamed`

Timeout for warmup in ms

*Source: supabase/functions/_shared/warmup/index.ts:22*

---

### `warmup`

Run warmup sequence

*Source: supabase/functions/_shared/warmup/index.ts:52*

---

### `backgroundWarmup`

Background warmup (fire and forget)

*Source: supabase/functions/_shared/warmup/index.ts:139*

---

### `unnamed`

Warmup on first request

*Source: supabase/functions/_shared/warmup/index.ts:151*

---

### `isWarmedUp`

Check if warmup has completed

*Source: supabase/functions/_shared/warmup/index.ts:163*

---

### `unnamed`

Rate Limiting Module for Supabase Edge Functions Uses Redis (Upstash) with sliding window algorithm Implements best practices from GROUND_RULES.md

*Source: supabase/functions/_shared/rate-limit/index.ts:1*

---

### `unnamed`

Unique identifier for rate limit (e.g., "wa-webhook:user-id" or IP)

*Source: supabase/functions/_shared/rate-limit/index.ts:11*

---

### `unnamed`

Maximum number of requests allowed in the window

*Source: supabase/functions/_shared/rate-limit/index.ts:13*

---

### `unnamed`

Time window in seconds

*Source: supabase/functions/_shared/rate-limit/index.ts:15*

---

### `unnamed`

Whether the request is allowed

*Source: supabase/functions/_shared/rate-limit/index.ts:20*

---

### `unnamed`

Number of requests remaining in current window

*Source: supabase/functions/_shared/rate-limit/index.ts:22*

---

### `unnamed`

Timestamp when the rate limit resets

*Source: supabase/functions/_shared/rate-limit/index.ts:24*

---

### `unnamed`

Current request count in window

*Source: supabase/functions/_shared/rate-limit/index.ts:26*

---

### `checkRateLimit`

Check if a request should be rate limited

*Source: supabase/functions/_shared/rate-limit/index.ts:30*

---

### `rateLimitResponse`

Create a 429 Rate Limit Exceeded response

*Source: supabase/functions/_shared/rate-limit/index.ts:90*

---

### `getClientIdentifier`

Extract client identifier from request

*Source: supabase/functions/_shared/rate-limit/index.ts:118*

---

### `rateLimitMiddleware`

Rate limit middleware for edge functions

*Source: supabase/functions/_shared/rate-limit/index.ts:135*

---

### `unnamed`

WhatsApp Business API Sender Provides utilities for sending messages via WhatsApp Business API - Text messages - Media messages (image, document) - Template messages - Interactive messages (buttons, lists) - Automatic retry with exponential backoff

*Source: supabase/functions/_shared/whatsapp-sender.ts:1*

---

### `sendMessageWithRetry`

Send message with automatic retry and exponential backoff

*Source: supabase/functions/_shared/whatsapp-sender.ts:373*

---

### `createWhatsAppSender`

Create a WhatsAppSender instance from environment variables

*Source: supabase/functions/_shared/whatsapp-sender.ts:417*

---

### `unnamed`

AI Agent Tool Executor Executes tools loaded from database configurations Supports multiple tool types: db, http, external, momo, etc. Validates inputs against JSON schemas Logs all executions for monitoring

*Source: supabase/functions/_shared/tool-executor.ts:1*

---

### `unnamed`

Execute a tool with given inputs

*Source: supabase/functions/_shared/tool-executor.ts:44*

---

### `unnamed`

Validate inputs against JSON schema

*Source: supabase/functions/_shared/tool-executor.ts:156*

---

### `unnamed`

Execute database tool (search, query, etc.)

*Source: supabase/functions/_shared/tool-executor.ts:199*

---

### `unnamed`

Search marketplace listings

*Source: supabase/functions/_shared/tool-executor.ts:294*

---

### `unnamed`

Sanitize search query to prevent SQL injection in LIKE patterns

*Source: supabase/functions/_shared/tool-executor.ts:364*

---

### `unnamed`

Format phone number for WhatsApp URL (remove non-digit characters except leading +)

*Source: supabase/functions/_shared/tool-executor.ts:377*

---

### `unnamed`

Create a new marketplace listing

*Source: supabase/functions/_shared/tool-executor.ts:386*

---

### `unnamed`

Get nearby listings based on user's cached location

*Source: supabase/functions/_shared/tool-executor.ts:439*

---

### `unnamed`

Get user information from whatsapp_users table

*Source: supabase/functions/_shared/tool-executor.ts:505*

---

### `unnamed`

Mask phone number for privacy (show last 4 digits)

*Source: supabase/functions/_shared/tool-executor.ts:557*

---

### `unnamed`

Create a support ticket for complex issues

*Source: supabase/functions/_shared/tool-executor.ts:565*

---

### `unnamed`

Search jobs database

*Source: supabase/functions/_shared/tool-executor.ts:700*

---

### `unnamed`

Search properties database

*Source: supabase/functions/_shared/tool-executor.ts:732*

---

### `unnamed`

Search menu items

*Source: supabase/functions/_shared/tool-executor.ts:769*

---

### `unnamed`

Search business directory

*Source: supabase/functions/_shared/tool-executor.ts:805*

---

### `unnamed`

Search produce listings

*Source: supabase/functions/_shared/tool-executor.ts:837*

---

### `unnamed`

Lookup loyalty points

*Source: supabase/functions/_shared/tool-executor.ts:864*

---

### `unnamed`

Generic table query

*Source: supabase/functions/_shared/tool-executor.ts:880*

---

### `unnamed`

Execute HTTP tool (API calls)

*Source: supabase/functions/_shared/tool-executor.ts:896*

---

### `unnamed`

Execute deep search tool (semantic vector search + web search fallback)

*Source: supabase/functions/_shared/tool-executor.ts:927*

---

### `unnamed`

Execute MoMo payment tool

*Source: supabase/functions/_shared/tool-executor.ts:1034*

---

### `unnamed`

Execute location tool

*Source: supabase/functions/_shared/tool-executor.ts:1176*

---

### `unnamed`

Execute external tool (Sora, etc.)

*Source: supabase/functions/_shared/tool-executor.ts:1197*

---

### `unnamed`

Execute WhatsApp tool (contact_seller, etc.)

*Source: supabase/functions/_shared/tool-executor.ts:1213*

---

### `unnamed`

Generate WhatsApp link to contact a seller

*Source: supabase/functions/_shared/tool-executor.ts:1232*

---

### `unnamed`

Get user account information

*Source: supabase/functions/_shared/tool-executor.ts:1289*

---

### `unnamed`

Check user wallet balance

*Source: supabase/functions/_shared/tool-executor.ts:1327*

---

### `unnamed`

Create a support ticket for complex issues

*Source: supabase/functions/_shared/tool-executor.ts:1376*

---

### `unnamed`

Search FAQ/knowledge base for answers

*Source: supabase/functions/_shared/tool-executor.ts:1433*

---

### `unnamed`

Find nearby available drivers

*Source: supabase/functions/_shared/tool-executor.ts:1476*

---

### `unnamed`

Request a ride

*Source: supabase/functions/_shared/tool-executor.ts:1576*

---

### `unnamed`

Get fare estimate for a trip

*Source: supabase/functions/_shared/tool-executor.ts:1643*

---

### `unnamed`

Track ride status

*Source: supabase/functions/_shared/tool-executor.ts:1667*

---

### `unnamed`

Calculate insurance quote

*Source: supabase/functions/_shared/tool-executor.ts:1708*

---

### `unnamed`

Check insurance policy status

*Source: supabase/functions/_shared/tool-executor.ts:1778*

---

### `unnamed`

Submit an insurance claim

*Source: supabase/functions/_shared/tool-executor.ts:1822*

---

### `unnamed`

Log tool execution to database

*Source: supabase/functions/_shared/tool-executor.ts:1884*

---

### `unnamed`

Execute weather tool (OpenWeather API)

*Source: supabase/functions/_shared/tool-executor.ts:1919*

---

### `unnamed`

Execute translation tool (Google Translate API)

*Source: supabase/functions/_shared/tool-executor.ts:1971*

---

### `unnamed`

Execute geocoding tool (Google Maps API)

*Source: supabase/functions/_shared/tool-executor.ts:2033*

---

### `unnamed`

Execute scheduling tool

*Source: supabase/functions/_shared/tool-executor.ts:2095*

---

### `unnamed`

Centralized Message Library for AI Agents All user-facing messages should be defined here for consistency. This ensures uniform tone, voice, and easier i18n integration.

*Source: supabase/functions/_shared/agent-messages.ts:1*

---

### `unnamed`

Loading/Progress Messages Used while system is processing requests

*Source: supabase/functions/_shared/agent-messages.ts:23*

---

### `unnamed`

Success Messages Confirming successful actions

*Source: supabase/functions/_shared/agent-messages.ts:36*

---

### `unnamed`

No Results Messages When searches return empty results

*Source: supabase/functions/_shared/agent-messages.ts:52*

---

### `unnamed`

Error Messages When things go wrong, with recovery steps

*Source: supabase/functions/_shared/agent-messages.ts:79*

---

### `unnamed`

Instructions Guiding users on what to do

*Source: supabase/functions/_shared/agent-messages.ts:130*

---

### `unnamed`

Headers Section headers in messages

*Source: supabase/functions/_shared/agent-messages.ts:141*

---

### `buildFallbackMessage`

Helper function to format fallback messages consistently

*Source: supabase/functions/_shared/agent-messages.ts:154*

---

### `getAgentEmoji`

Get appropriate emoji for agent type

*Source: supabase/functions/_shared/agent-messages.ts:174*

---

### `buildErrorMessage`

Build a consistent error message with recovery options

*Source: supabase/functions/_shared/agent-messages.ts:194*

---

### `unnamed`

AI Agent Database Loader Loads agent configurations (personas, instructions, tools, tasks, KBs) from database Provides caching and fallback to hardcoded configs

*Source: supabase/functions/_shared/agent-config-loader.ts:1*

---

### `unnamed`

Load complete agent configuration from database

*Source: supabase/functions/_shared/agent-config-loader.ts:106*

---

### `unnamed`

Invalidate cache for a specific agent (used by webhooks)

*Source: supabase/functions/_shared/agent-config-loader.ts:237*

---

### `unnamed`

Load default persona for an agent

*Source: supabase/functions/_shared/agent-config-loader.ts:266*

---

### `unnamed`

Load active system instructions

*Source: supabase/functions/_shared/agent-config-loader.ts:280*

---

### `unnamed`

Load active tools

*Source: supabase/functions/_shared/agent-config-loader.ts:295*

---

### `unnamed`

Load tasks

*Source: supabase/functions/_shared/agent-config-loader.ts:309*

---

### `unnamed`

Load knowledge bases

*Source: supabase/functions/_shared/agent-config-loader.ts:322*

---

### `unnamed`

Create fallback config when database loading fails

*Source: supabase/functions/_shared/agent-config-loader.ts:335*

---

### `unnamed`

Clear cache for an agent (useful for testing or forced reload)

*Source: supabase/functions/_shared/agent-config-loader.ts:356*

---

### `unnamed`

Get cache statistics

*Source: supabase/functions/_shared/agent-config-loader.ts:367*

---

### `getMockResponse`

Mock response generator TODO: Replace with actual agent execution

*Source: supabase/functions/agent-runner/index.ts:141*

---

### `getMockTools`

Mock tools list TODO: Replace with actual tools invoked

*Source: supabase/functions/agent-runner/index.ts:182*

---

### `unnamed`

Agent Config Cache Invalidator Edge Function that invalidates agent config caches when database changes occur Triggered by database triggers on config table changes

*Source: supabase/functions/agent-config-invalidator/index.ts:1*

---
