# Contributing to ULTRA-MINIMAL WhatsApp Mobility

## Development Setup

### Prerequisites
- Node.js 18+ 
- Modern browser (Chrome/Firefox/Safari)

### Installation
```bash
npm install
```

### Development Scripts
```bash
npm run dev        # Start development server
npm run build      # Production build
npm run test       # Run unit tests
npm run test:ui    # Visual test runner
npm run lint       # ESLint check
npm run type-check # TypeScript check
```

## Architecture Guidelines

### Phase-1 (Current) - Frontend Only
- **No network calls** - Everything uses mock adapter
- **localStorage persistence** - Settings and data survive refresh  
- **Ultra-minimal UX** - Buttons/lists only, no free text input
- **Strict TypeScript** - Zero `any` types, proper null checks

### Phase-2 (Future) - Supabase Backend  
- **Real adapter** - Switch `VITE_USE_MOCK=0`
- **WhatsApp webhook** - Replace simulator with real messaging
- **PostGIS queries** - Geospatial driver/passenger matching
- **RLS security** - Row-level security policies

## Code Standards

### TypeScript
- **Strict mode enabled** - No implicit any, proper null checks
- **Interface segregation** - Clean type definitions in `types.ts`
- **No `any` types** - Use proper typing for all values

### React Patterns
- **Functional components** - No class components
- **Custom hooks** - Extract reusable stateful logic
- **Minimal re-renders** - Use `useMemo`/`useCallback` for expensive ops

### File Structure
```
src/
├── components/ui/        # Reusable UI components
├── pages/               # Route components  
├── lib/                 # Core business logic
│   ├── adapter.mock.ts  # Phase-1 implementation
│   ├── adapter.real.ts  # Phase-2 placeholder
│   ├── types.ts         # TypeScript definitions
│   ├── env.ts           # Environment configuration
│   └── waSimFlows.ts    # WhatsApp UX state machine
└── hooks/               # Custom React hooks
```

## Testing Guidelines

### Unit Tests (Required)
- **Pure functions** - All utilities in `lib/format.ts`
- **State machines** - Flow logic in `waSimFlows.ts`  
- **Mock adapter** - CRUD operations and sorting

### Integration Tests
- **Admin pages** - Load with mock data
- **Simulator flows** - Complete user journeys
- **Data persistence** - localStorage operations

### Test Commands
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:ui         # Visual test runner
```

## Environment Configuration

### Phase-1 Settings
```bash
VITE_USE_MOCK=1         # Use mock adapter (required)
VITE_DEV_TOOLS=1        # Show debug features
VITE_ADMIN_TOKEN=demo   # Admin access (demo only)
```

### Development Tools
- **Simulator Access Toggle** - Simulate subscription/credits
- **Reset Mock Data** - Clear localStorage and reload seed
- **Flow State Inspector** - Debug WhatsApp journeys

## Ultra-Minimal UX Rules

### Core Principle
**Users never type anything** - All interactions via buttons/lists/location

### WhatsApp Journeys
1. **Home** → 4 buttons (See Drivers/Passengers, Schedule, Support)
2. **See Drivers** → Vehicle → Location → List (max 10) → Chat link  
3. **See Passengers** → Vehicle → Location → Access gate → List → Chat link
4. **Schedule** → Role → Vehicle → Location → Success message
5. **Support** → Chat/Back buttons → Chat link

### Sorting & Limits
- **Most recent first** - Drivers by `last_seen`, passengers by `created_at`
- **Max 10 results** - Enforced by `settings.max_results`
- **Access gates** - Check subscription OR credits for driver features

## Common Issues

### TypeScript Errors
```bash
# Enable strict mode gradually
npm run type-check       # See all type errors
```

### Mock Data Reset
```bash
# If localStorage gets corrupted
localStorage.clear()     # Browser console
# Or use "Reset Mock Data" button (dev tools only)
```

### Import Errors
```bash
# Use absolute imports
import { ADAPTER } from "@/lib/adapter"  # ✅ Good
import { ADAPTER } from "../../lib/adapter"  # ❌ Avoid
```

## Pull Request Process

1. **Fork & branch** - Create feature branch from main
2. **Tests pass** - All existing tests continue working  
3. **Lint clean** - Zero ESLint warnings/errors
4. **Type safe** - Strict TypeScript compilation
5. **No functionality breaks** - Mock adapter still works
6. **Documentation updated** - Update relevant .md files

## Phase-2 Preparation

When implementing Supabase integration:
- **Keep UI unchanged** - All existing components work as-is
- **Implement RealAdapter** - Replace throw statements with Supabase calls  
- **Add Edge Functions** - WhatsApp webhook, geospatial queries
- **Environment switch** - Change `VITE_USE_MOCK=0`

The beauty of the adapter pattern is that Phase-2 requires **zero UI changes**.