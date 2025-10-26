# Phase 1 — Foundation Implementation Plan

## Scope

Establish the design, theming, motion, and data scaffolding required by the
blueprint while keeping all existing surfaces functional. All work is
additive-only and avoids forbidden paths.

## Objectives

- Introduce Tailwind CSS, design tokens, and gradient/glass theming primitives
  without breaking current CSS modules.
- Layer motion primitives with Framer Motion and reduced-motion fallbacks.
- Stand up shared UI utilities (design tokens, layout primitives, icon system).
- Prepare TanStack Query-based data cache and @/lib/api helpers for future
  server communication.
- Maintain existing mock-data fallback behaviour and SSR compatibility.

## Architectural Approach

1. **Tailwind + Design Tokens**
   - Add Tailwind dependencies (`tailwindcss`, `postcss`, `autoprefixer`) to
     admin-app package.json.
   - Generate `tailwind.config.ts` with:
     - `content` scanning the app directory, components, lib.
     - Design token layer via CSS variables (`--color-*`, `--gradient-*`,
       spacing scale).
     - Custom screens for mobile-first breakpoints (xs=360px, sm=640px,
       md=768px, lg=1024px, xl=1280px).
     - Theme extensions for glass surfaces, shadows, border radii, and animation
       durations.
   - Create `styles/theme.css` (new) exporting CSS variables for
     light/dark/dynamic gradients; import in root layout.
   - Keep existing `globals.css` but refactor it to import new token styles and
     expose helper classes (additive).
   - Defer applying gradient background classes to panel layout until tokens
     land.

2. **shadcn/ui & Radix Primitives**
   - Introduce shadcn/ui scaffold under `components/ui/shadcn/` via additive
     installation notes.
   - Add Radix UI primitives for accessible modals, drawers, tooltips; wrap them
     with gradient/glass styles.
   - Document component registration process in
     `admin-app/docs/COMPONENT_LIBRARY.md` (to be created).

3. **Motion Layer (Framer Motion)**
   - Add `framer-motion` dependency.
   - Create `components/motion/MotionProviders.tsx` providing
     `<AnimatePresence>` wrappers and reduced-motion context.
   - Provide reusable transitions (page fade+slide, list stagger) via helper
     hooks in `components/motion/hooks.ts`.
   - Ensure motion respects `prefers-reduced-motion` with instant fallbacks.

4. **Data & State Layer**
   - Add `@tanstack/react-query` and `@tanstack/query-async-storage-persister`
     (offline support deferred to later phase).
   - Create `lib/api/client.ts` with fetch wrapper injecting auth headers,
     request ids, and logging.
   - Create `lib/api/queryClient.ts` exporting QueryClient configured for SSR
     hydration.
   - Add React Query provider in `app/layout.tsx` wrapping pages; reuse existing
     `lib/data-provider` via query functions until real APIs land.
   - Document query keys and caching expectations in
     `admin-app/docs/DATA_LAYER.md` (new).

5. **Design Tokens & Layout Primitives**
   - Introduce `lib/design-tokens.ts` exporting TypeScript definitions for
     colors, gradients, radii, z-index, spacing scale.
   - Add `components/layout/GlassPanel.tsx` and `GradientBackground.tsx` built
     on tokens.
   - Bring in `lucide-react` for iconography; wrap icons with shared component
     for consistent sizing and accessible labels.

6. **PWA Scaffold (Foundation)**
   - `public/manifest.webmanifest` ships with placeholder metadata and icon
     references that product can iterate on before launch.
   - `app/sw/register.ts` and `public/sw.js` provide registration + lifecycle
     scaffolds; background sync/cache persistence will remain TODOs for the Phase
     7 polish owners.
   - Note: `next.config.mjs` update to reference SW will occur once
     implementation is ready.

7. **Testing & Tooling**
   - Update `tests/setupTests.ts` to mock `matchMedia`, `ResizeObserver`, and
     `IntersectionObserver` for motion/components.
   - Document Tailwind class ordering guidelines; enable lint rule after
     configuration stabilizes.

## Implementation Checklist

- [ ] Add dependencies (Tailwind, PostCSS plugin, Framer Motion, React Query,
      lucide-react).
- [ ] Scaffold Tailwind config and PostCSS updates (add plugin while preserving
      defaults).
- [ ] Create design token CSS and TypeScript helpers.
- [x] Wrap root layout with theme and query providers.
- [ ] Add motion provider and helper hooks.
- [ ] Document component library usage and data layer patterns.
- [ ] Verify existing mock-driven pages continue to render.

## Risks & Mitigations

- **Tailwind purge removing classes:** keep CSS modules for legacy components;
  migrate gradually.
- **Hydration mismatch from motion:** default to non-animated initial state;
  enable `lazyMotion` if needed.
- **Offline caching complexity:** defer persistence until PWA phase; start with
  in-memory cache only.

## Out of Scope

- Rewriting current page layouts into Tailwind utility classes.
- Implementing server API routes or policy engine logic.
- Modifying forbidden Supabase function or migration files.

## Next Actions

1. Align on design token palette and gradient set.
2. Approve dependency additions.
3. Implement configuration scaffolding and verify builds/tests.

## Approvals Needed

- Design lead sign-off on gradients and glassmorphism token definitions.
- Engineering agreement on React Query adoption pattern.

## Document History

- v0.1 (YYYY-MM-DD): Initial foundation plan draft.
