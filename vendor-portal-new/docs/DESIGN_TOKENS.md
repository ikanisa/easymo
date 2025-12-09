# Design Tokens and CSS Architecture

This document describes the design token system used across the SACCO+ frontend
applications.

## Color System

### Brand Colors (Rwanda Flag)

- `--rw-blue`: #00a1de - Primary brand color (sky/water)
- `--rw-yellow`: #fad201 - Accent color (sun)
- `--rw-green`: #20603d - Success/growth color (land)

### Neutral Colors

- `--neutral-0`: #ffffff - Pure white, primary text on dark backgrounds
- `--neutral-1`: #f7f9fb - Light background, secondary text
- `--neutral-2`: #e8edf1 - Muted text, borders
- `--neutral-9`: #1a1f25 - Dark background

### Semantic Colors

Used for status indicators and feedback:

- `--brand-1`: #1bb06e - Success states
- `--brand-2`: #0674d6 - Information states
- Sky blue (#00a1de): Info badges
- Emerald green (#10b981): Success badges
- Amber (#f59e0b): Warning badges
- Red (#ef4444): Error/critical badges

## Glass Morphism System

The app uses a glass morphism design pattern with these tokens:

```css
--glass-bg: rgba(255, 255, 255, 0.14) --glass-stroke: rgba(255, 255, 255, 0.28)
  backdrop-filter: blur(12px) saturate(1.1);
```

Apply with the `[data-glass]` attribute or use the `GlassCard` component.

## Typography

### Font Families

- `--font-sans`: Inter (primary UI font)
- `--font-mono`: JetBrains Mono (code/data display)

### Scale

Tailwind's default scale is extended with custom sizes:

- `text-xs`: 0.75rem (labels, metadata)
- `text-sm`: 0.875rem (body text)
- `text-base`: 1rem (default)
- `text-md`: 1.125rem
- `text-lg`: 1.25rem (section headers)
- `text-xl`: 1.5rem
- `text-2xl`: 1.75rem (metrics, KPIs)
- `text-3xl`: 2.125rem (page headers)

### Letter Spacing for Labels

Uppercase labels use increased tracking for readability:

- `tracking-[0.25em]`: Standard uppercase labels
- `tracking-[0.3em]`: Emphasized labels/badges

## Spacing

Based on 4px grid system:

- `--space-1`: 4px (tight spacing)
- `--space-2`: 8px (compact spacing)
- `--space-3`: 12px (default spacing)
- `--space-4`: 16px (comfortable spacing)
- `--space-5`: 24px (section spacing)
- `--space-6`: 32px (large spacing)

## Border Radius

- `--radius-sm`: 12px (small elements)
- `--radius-md`: 16px (cards, inputs)
- `--radius-lg`: 28px (large containers)

## Shadows

- `--shadow-1`: 0 8px 24px rgba(0, 0, 0, 0.25) (elevated cards)
- `--shadow-2`: 0 2px 10px rgba(0, 0, 0, 0.35) (subtle elevation)

Apply with `shadow-glass` or `shadow-subtle` classes.

## Component Patterns

### Metric Cards

Use the `MetricCard` component from `@ibimina/ui`:

```tsx
<MetricCard
  label="Total Members"
  value="1,234"
  trend="+12% from last month"
  accent="blue"
/>
```

### Section Headers

Use the `SectionHeader` component for consistent section headers:

```tsx
<SectionHeader
  title="Dashboard Overview"
  subtitle="Track your key metrics"
  actions={<Button>Export</Button>}
/>
```

### Badges

Use the `Badge` component for status indicators:

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="critical">Failed</Badge>
```

### Glass Cards

For custom glass effect containers:

```tsx
<div
  className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-glass backdrop-blur"
  data-glass
>
  {/* Content */}
</div>
```

Or use the `GlassCard` component:

```tsx
<GlassCard>{/* Content */}</GlassCard>
```

## Animation

### Transitions

- `transition-interactive`: 200ms with custom easing
- Use `hover:-translate-y-0.5` for subtle lift effects
- Use `hover:shadow-xl` for depth on interaction

### Keyframes

- `animate-shimmer`: Loading skeleton animation
- `animate-pulseFade`: Subtle pulsing for live data

## Accessibility

### Focus States

All interactive elements have a consistent focus ring:

```css
--focus-ring: 0 0 0 3px rgba(0, 161, 222, 0.35);
```

### Motion Preferences

Respects `prefers-reduced-motion` - all animations are disabled for users who
prefer reduced motion.

## Usage Guidelines

1. **Always use design tokens** instead of hardcoded values
2. **Use component abstractions** (MetricCard, Badge, etc.) instead of repeating
   patterns
3. **Maintain consistency** - if a pattern appears 3+ times, extract it into a
   component
4. **Document new patterns** - update this guide when adding new design tokens
   or components
5. **Test accessibility** - ensure focus states, color contrast, and motion
   preferences are respected

## Tailwind Configuration

The design tokens are configured in:

- `/apps/admin/tailwind.config.ts` - Tailwind theme extensions
- `/apps/admin/styles/tokens.css` - CSS custom properties
- `/apps/admin/app/globals.css` - Global styles and utilities

## Migration Guide

When refactoring existing components:

1. Replace hardcoded colors with semantic token classes
2. Extract repetitive card patterns into `MetricCard` or `GlassCard`
3. Use `Badge` instead of custom status chips
4. Use `SectionHeader` for section titles
5. Apply the `cn()` utility for conditional class merging
