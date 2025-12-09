# Component Architecture Guide

This guide describes the component structure and best practices for the SACCO+
frontend.

## Component Organization

Components are organized by feature domain:

```
components/
├── admin/          # Admin panel specific components
├── analytics/      # Analytics and reporting components
├── auth/          # Authentication components
├── common/        # Shared UI patterns (StatusChip, Trans, etc.)
├── dashboard/     # Dashboard widgets and stats
├── datagrid/      # Data table components
├── ikimina/       # Ikimina management components
├── layout/        # Layout shells and navigation
├── member/        # Member management components
├── pwa/           # PWA-specific components
├── recon/         # Reconciliation components
├── reports/       # Report generation components
├── saccos/        # SACCO management components
├── system/        # System utilities and tools
└── ui/            # Re-exports from @ibimina/ui package
```

## Shared UI Package (@ibimina/ui)

Reusable components are published in the `@ibimina/ui` package for use across
applications:

### Available Components

- **Button** - Primary action button with variants
- **Badge** - Status indicators and labels
- **EmptyState** - Empty state placeholders
- **GlassCard** - Glass morphism container
- **GradientHeader** - Gradient page headers
- **Input** - Form input component
- **LottieSlot** - Lottie animation container
- **MetricCard** - KPI/metric display card
- **OptimizedImage** - Optimized Next.js image wrapper
- **SectionHeader** - Consistent section headers
- **SegmentedControl** - Segmented button group
- **Select** - Dropdown select component
- **Skeleton** - Loading skeleton
- **Sparkline** - Mini trend chart
- **StickyActionBar** - Floating action bar

### Adding New Shared Components

When creating a new shared component:

1. Create the component in `packages/ui/src/components/`
2. Export it from `packages/ui/src/index.ts`
3. Document usage in this guide
4. Update DESIGN_TOKENS.md if it introduces new patterns

## Component Best Practices

### TypeScript

Always define explicit prop interfaces:

```tsx
interface MyComponentProps {
  title: string;
  count: number;
  onAction?: () => void;
}

export function MyComponent({ title, count, onAction }: MyComponentProps) {
  // Component implementation
}
```

Avoid:

- `any` types
- Implicit types
- `React.FC` (use function declarations instead)
- Prop spreading without types

### Styling

Use Tailwind classes with the `cn()` utility for conditional styles:

```tsx
import { cn } from "@/lib/utils";

<div
  className={cn(
    "base-classes",
    condition && "conditional-classes",
    variant === "primary" && "variant-classes"
  )}
>
  {/* Content */}
</div>;
```

Prefer:

- Design token classes over arbitrary values
- Component composition over conditional rendering
- Semantic class names from design system

### Server vs Client Components

Mark components as client-side only when they use:

- React hooks (useState, useEffect, etc.)
- Browser APIs (window, localStorage, etc.)
- Event handlers

```tsx
"use client";

import { useState } from "react";

export function InteractiveComponent() {
  const [count, setCount] = useState(0);
  // ...
}
```

Server components (default) are preferred for:

- Data fetching
- Static content
- Layout shells
- Performance-critical views

### Composition Patterns

Favor composition over configuration:

```tsx
// Good: Composable
<SectionHeader
  title="Users"
  subtitle="Manage user accounts"
  actions={
    <>
      <Button variant="secondary">Export</Button>
      <Button>Add User</Button>
    </>
  }
/>

// Avoid: Over-configured
<SectionHeader
  title="Users"
  subtitle="Manage user accounts"
  showExportButton
  showAddButton
  onExport={handleExport}
  onAdd={handleAdd}
/>
```

### Accessibility

Ensure all components are accessible:

- Use semantic HTML elements
- Add ARIA labels where needed
- Support keyboard navigation
- Maintain focus management
- Respect reduced motion preferences

```tsx
<button type="button" aria-label="Close dialog" onClick={onClose}>
  <CloseIcon aria-hidden="true" />
</button>
```

## Internationalization (i18n)

Use the translation hook for all user-facing text:

```tsx
import { useTranslation } from "@/providers/i18n-provider";

export function MyComponent() {
  const { t } = useTranslation();

  return <h1>{t("dashboard.title", "Dashboard")}</h1>;
}
```

For complex translations with React elements:

```tsx
import { Trans } from "@/components/common/trans";

<Trans
  i18nKey="welcome.message"
  defaults="Welcome, <strong>{{name}}</strong>!"
  values={{ name: userName }}
/>;
```

## Performance Optimization

### Code Splitting

Use dynamic imports for heavy components:

```tsx
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("./heavy-chart"), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### Memoization

Use React.memo for expensive pure components:

```tsx
import { memo } from "react";

export const ExpensiveList = memo(function ExpensiveList({ items }: Props) {
  // Expensive rendering logic
});
```

Use useMemo for expensive calculations:

```tsx
const sortedData = useMemo(
  () => data.sort((a, b) => a.value - b.value),
  [data]
);
```

## Testing

Components should be testable. Avoid:

- Tight coupling to external services
- Hard-coded configuration
- Side effects in render

Prefer:

- Dependency injection via props
- Pure functions where possible
- Separate business logic from UI

## Migration Checklist

When refactoring components:

- [ ] Extract repeated patterns into shared components
- [ ] Replace inline styles with design token classes
- [ ] Add explicit TypeScript types for all props
- [ ] Use semantic HTML elements
- [ ] Add ARIA labels for accessibility
- [ ] Implement keyboard navigation
- [ ] Add i18n support for text content
- [ ] Consider server vs client component needs
- [ ] Add loading and error states
- [ ] Document usage patterns

## Examples

See these components for reference implementations:

- `MetricCard` - Clean API, composition, TypeScript
- `Badge` - Variant system, semantic props
- `SectionHeader` - Flexible composition with actions
- `MfaInsightsCard` - Complex component using shared primitives
