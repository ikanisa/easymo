# Agent Orchestration System

## Overview

The Agent Orchestration System provides admin UI for managing 14 AI agents that handle:
- Driver negotiation (5-minute SLA)
- Marketplace sourcing (pharmacy, quincaillerie, shop)
- Sales & marketing campaigns
- Scheduled trips
- Real-time session monitoring
- Vendor quote management

## Database Schema

### Tables Created
- `agent_registry` - 14 AI agents with configuration
- `agent_sessions` - Active negotiation/sourcing sessions
- `agent_quotes` - Vendor responses and quotes
- `vendor_quote_responses` - Raw vendor communication log
- `sales_campaigns`, `sales_contacts`, `sales_tasks` - Marketing automation
- `call_logs` - Voice agent call tracking
- `agent_metrics` - Performance metrics
- `agent_tool_catalog` - Available tools registry

Migration: `supabase/migrations/20260214100000_agent_orchestration_system.sql`

## API Routes

### Sessions
- `GET /api/agent-orchestration/sessions` - List sessions with filters
- `POST /api/agent-orchestration/sessions` - Create new session
- `GET /api/agent-orchestration/sessions/[id]` - Get session detail with quotes
- `PATCH /api/agent-orchestration/sessions/[id]` - Update session (extend deadline, cancel, select quote)

### Registry
- `GET /api/agent-orchestration/registry` - List all agents
- `GET /api/agent-orchestration/registry/[agent_type]` - Get agent config
- `PATCH /api/agent-orchestration/registry/[agent_type]` - Update agent config

### Metrics
- `GET /api/agent-orchestration/metrics` - Get KPIs and performance data

## UI Components

### Main Dashboard (`/agent-orchestration`)
Located at: `admin-app/app/(panel)/agent-orchestration/page.tsx`

Features:
- Performance metrics (4 KPI cards)
- Agent registry table (click row to configure agent)
- Live sessions table (click row to view details)
- Real-time auto-refresh

### SessionDrawer Component
Located at: `admin-app/components/agent-orchestration/SessionDrawer.tsx`

Features:
- Real-time SLA countdown (updates every second)
- Session status with color-coded badges
- Request data viewer (JSON formatted)
- Quotes timeline with vendor details
- Actions:
  - Extend deadline (+2 min, max 2 extensions)
  - Cancel session
  - Select quote
- Auto-refresh every 5 seconds

### AgentConfigDrawer Component
Located at: `admin-app/components/agent-orchestration/AgentConfigDrawer.tsx`

Features:
- Enable/disable agent toggle
- SLA policy settings:
  - SLA minutes (1-60)
  - Max extensions (0-5)
  - Vendor fan-out limit (1-50)
- Negotiation settings:
  - Counter-offer delta % (0-100)
  - Auto-negotiation toggle
- Rollout control:
  - disabled, staging, prod_10%, prod_50%, prod_100%
- System prompt editor
- Enabled tools display

## React Query Hooks

Located at: `admin-app/lib/queries/agent-orchestration.ts`

### Sessions
- `useAgentSessions(params?)` - List sessions
- `useAgentSessionDetail(id)` - Get session detail
- `useCreateAgentSession()` - Create session
- `useUpdateAgentSession(id)` - Update session

### Registry
- `useAgentRegistry()` - List all agents
- `useAgentConfig(agentType)` - Get agent config
- `useUpdateAgentConfig(agentType)` - Update agent config

### Metrics
- `useAgentMetrics(params?)` - Get KPIs and metrics

## Usage Examples

### View Agent Sessions
1. Navigate to `/agent-orchestration`
2. View live sessions in the table
3. Click any session row to open SessionDrawer
4. View quotes, extend deadline, or select a quote

### Configure an Agent
1. Navigate to `/agent-orchestration`
2. Click any agent row in the registry table
3. AgentConfigDrawer opens
4. Adjust settings and click "Save Configuration"

### Monitor Performance
1. Navigate to `/agent-orchestration`
2. View KPI cards at the top:
   - Active Sessions
   - Timeout Rate
   - Acceptance Rate
   - Total Sessions

## Key Features

### Real-time Updates
- SLA countdown updates every second
- Sessions auto-refresh every 5 seconds
- Visual indicators for urgent deadlines (< 1 min)

### Type Safety
- All APIs use Zod schema validation
- React Query hooks are fully typed
- TypeScript throughout

### User Experience
- Click-to-view pattern for sessions and agents
- Keyboard shortcuts (ESC to close drawers)
- Loading and error states
- Optimistic UI updates
- Responsive design

## Architecture

Follows existing codebase patterns:
- ✅ Uses Drawer, SectionCard, KpiCard components
- ✅ Follows API route structure with `createHandler`
- ✅ Uses React Query for data fetching
- ✅ Supabase for database access
- ✅ RLS policies for admin-only access

## Future Enhancements

Optional features not implemented:
- Supabase Realtime for push updates (currently using polling)
- Time-series charts for historical trends
- Vendor response rate analytics
- Tool catalog admin page
- Message template editor
- Agent-specific UI pages
