# UI Components

This directory contains reusable UI components for the Ibimina Staff Console.

## Component Guidelines

All components in this directory should follow these principles:

1. **Accessibility First**: WCAG 2.1 AA compliance is mandatory
2. **Responsive Design**: Mobile-first approach with proper touch targets
3. **Performance**: Optimized for fast rendering and minimal bundle size
4. **Type Safety**: Full TypeScript typing with JSDoc documentation
5. **Reduced Motion**: Respect `prefers-reduced-motion` media query

## Available Components

### Loading States

#### `LoadingSpinner`

A versatile loading indicator with multiple size options and modes.

```tsx
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Simple spinner
<LoadingSpinner size="md" />

// With message
<LoadingSpinner size="lg" message="Loading data..." />

// Full-screen overlay
<LoadingSpinner fullScreen message="Processing..." />
```

**Props:**

- `size?: "sm" | "md" | "lg"` - Spinner size (default: "md")
- `className?: string` - Additional CSS classes
- `message?: string` - Optional loading message
- `fullScreen?: boolean` - Show as full-screen overlay (default: false)

**Accessibility:**

- Uses `role="status"` and `aria-live="polite"`
- Includes screen reader text
- Respects prefers-reduced-motion

#### `Skeleton`

Loading placeholder for content areas. Re-exported from `@ibimina/ui`.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

<Skeleton className="h-8 w-64" />;
```

### Layout Components

#### `ResponsiveContainer`

A container component with consistent spacing and responsive behavior.

```tsx
import { ResponsiveContainer } from "@/components/ui/responsive-container";

<ResponsiveContainer size="lg" padding>
  {/* Your content */}
</ResponsiveContainer>;
```

**Props:**

- `size?: "sm" | "md" | "lg" | "xl" | "full"` - Container max-width
- `padding?: boolean` - Apply responsive padding (default: true)
- `className?: string` - Additional CSS classes

#### `GlassCard`

A glass-morphism card component with consistent styling.

```tsx
import { GlassCard } from "@/components/ui/glass-card";

<GlassCard>{/* Your content */}</GlassCard>;
```

### Animation Components

#### `PageTransition`

Smooth page transitions using Framer Motion.

```tsx
import { PageTransition } from "@/components/ui/page-transition";

// In your layout
<PageTransition>{children}</PageTransition>;
```

**Features:**

- Fade and slide animations
- Automatic route detection
- Respects prefers-reduced-motion
- Optimized for performance

### Data Display

#### `EmptyState`

Displays when there's no data to show.

#### `StatusChip`

Small badge for displaying status information.

#### `Badge`

General-purpose badge component with variants.

## Design Tokens

All components use design tokens defined in `styles/tokens.css`:

- Colors: `--neutral-*`, `--kigali`, `--rw-blue`, etc.
- Spacing: Use Tailwind spacing scale
- Borders: `border-white/10` for subtle borders
- Shadows: `shadow-glass` for elevated elements
- Backgrounds: `glass` class for frosted glass effect

## Best Practices

### Do's ✅

- Use semantic HTML elements
- Add proper ARIA attributes
- Ensure minimum 48px touch targets on mobile
- Test with keyboard navigation
- Test with screen readers
- Respect user preferences (reduced motion, color scheme)
- Use design tokens for consistency

### Don'ts ❌

- Don't hardcode colors or spacing
- Don't use `div` when semantic elements exist
- Don't forget loading states
- Don't skip error handling
- Don't ignore accessibility
- Don't use animations without respecting prefers-reduced-motion

## Testing

All components should be tested for:

1. **Accessibility**
   - Keyboard navigation
   - Screen reader compatibility
   - ARIA attributes
   - Color contrast

2. **Responsiveness**
   - Mobile (320px - 767px)
   - Tablet (768px - 1023px)
   - Desktop (1024px+)

3. **Performance**
   - Bundle size impact
   - Render performance
   - Animation performance

## Contributing

When adding new components:

1. Follow the naming convention: `ComponentName.tsx`
2. Export from `index.ts` if widely used
3. Add JSDoc documentation
4. Include TypeScript types
5. Add usage examples in this README
6. Test for accessibility and responsiveness
7. Ensure it respects design tokens
