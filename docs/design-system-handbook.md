# Admin Design System Handbook

This handbook connects the design tokens, React components, and interaction
principles that govern the admin workspace. Reference it whenever you add a new
surface, tweak styling, or plan cross-team QA.

## Foundations

### Design tokens

- **Color, elevation, spacing, typography variables** live in
  [`admin-app/styles/theme.css`](../admin-app/styles/theme.css). The file exposes
  CSS custom properties (`--color-background`, `--motion-duration-fast`, etc.)
  and handles light/dark modes.
- For JavaScript/TypeScript consumption, use the typed exports in
  [`admin-app/lib/design-tokens.ts`](../admin-app/lib/design-tokens.ts).
  Components can import constants such as `COLOR_TOKENS.accent` or
  `RADIUS_TOKENS.lg` for consistent styling.
- Gradients and glassmorphism utilities are centralized in the same files;
  avoid redefining bespoke blends within components.

### Typography & icons

- Default font stack is defined via `--font-sans` in `theme.css`. Heading styles
  inherit from the scale tokens (`--type-scale-lg`, etc.).
- Emoji icons are acceptable for navigation and quick prototypes. When you need
  vector icons, prefer `lucide-react` imports already in the bundle.

## Components

The `admin-app/components` tree groups UI by domain. Reusable primitives live in
[`admin-app/components/ui`](../admin-app/components/ui) while higher-level
patterns are organized by feature (`analytics`, `insurance`, `mobility`, etc.).

- Add new primitives to `ui/` with Storybook-friendly props (see below) and a
  short usage note in the component file header.
- Domain workbenches should assemble primitives, leverage hooks from
  `admin-app/lib`, and respect the microcopy guide for labels.

### Design system showcase

Run `pnpm --filter @easymo/admin-app dev` and open `/design-system` to view the
[`UiShowcase`](../admin-app/components/design-system/UiShowcase.tsx). This page
renders form fields, buttons, data tables, and cards with live props so product
and design can validate states quickly.

### Widget backlog (cross-surface)

- **Integration health badge** (admin dashboard) – implemented via `IntegrationHealthWidget`; reuse hook outputs wherever telemetry is surfaced (e.g., WhatsApp health, agent detail pages).
- **Google Places-style cards** – shipped as `PlaceWidget` inside `@easymo/ui`. Currently used for property rentals (admin) and venue spotlights (Waiter PWA). Extend it for Real Estate PWA search results and marketplace vendor reviews.
- **Session timeline widget** – shipped as `SessionTimelineWidget` and mounted on the agent orchestration page to narrate flow-exchange status ticks.
- **Payments widget** – delivered via `PaymentStatusWidget` feeding the dashboard wallet health card; extend it to Waiter AI’s payment center next.
- **Geo heatmap widget** – implemented with lightweight gradient cells (`GeoHeatmapWidget`) and currently used for property demand clusters; hook it into mobility routes when telemetry lands.

## Interaction guidelines

- **Motion**: stay within the transition tokens defined in
  `design-tokens.ts` (`durationFast`, `durationMedium`, etc.). Do not import raw
  numbers.
- **Focus management**: when building dialogs, use the shared `Drawer`, `Modal`,
  and `ConfirmDialog` primitives under `components/ui/` so keyboard trapping and
  aria attributes stay consistent.
- **Loading and error states**: follow the messaging patterns from the
  [Microcopy Style Guide](./microcopy-style-guide.md). Surface progress in-line
  where possible instead of redirecting users to a separate page.
- **Responsive behavior**: utility components already include responsive
  Tailwind classes. When introducing new breakpoints, note them in this handbook
  with rationale.

## Documentation & Storybook alignment

We maintain Storybook documentation in the `docs` tab for each component. Add a
`*.stories.tsx` entry alongside new primitives and include:

1. **Usage description** referencing the matching token(s).
2. **Props table** with required vs. optional details.
3. **Interaction notes** for hover, focus, and loading behavior.

If Storybook coverage is not feasible, append a markdown section to this
handbook summarizing the component contract.

## Contribution workflow

1. Confirm vocabulary with the microcopy guide before naming props or labels.
2. Update the checklist in the pull-request template (see below) with any new
   design QA steps introduced by your change.
3. Add screenshots or recordings for notable UI updates and link them in PRs.
4. Ping `#design-system` in Slack when shared tokens/components change so mobile
   and PWA teams stay in sync.
