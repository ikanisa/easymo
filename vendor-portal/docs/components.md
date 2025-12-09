# Staff admin UI component usage notes

These guidelines describe how to work with the refreshed foundational components
that power the staff admin PWA. They consolidate the latest design-token driven
theming, typography scale, and component API updates so that designers and
engineers have a shared reference when building new surfaces.

## Typography

The global typographic scale is declared in `app/globals.css` and exposed
through the `Typography` component. Use the component whenever you need
consistent hierarchy, tone, or alignment.

| Variant   | Default element | Use case                                |
| --------- | --------------- | --------------------------------------- |
| `h1`–`h6` | matching `h*`   | Page and section headings               |
| `body-lg` | `p`             | Lead paragraphs / metric summaries      |
| `body`    | `p`             | Standard body copy                      |
| `body-sm` | `p`             | Form labels, helper text                |
| `caption` | `span`          | Eyebrow labels, chips, meta annotations |

Additional props:

- `tone`: `default`, `muted`, `subtle`, `inverse`, or feedback tones (`success`,
  `warning`, `danger`, `info`).
- `weight`: `regular`, `medium`, `semibold`, `bold`.
- `align`: `start`, `center`, `end`, `justify`.
- `as`: render the typography as another semantic element without losing the
  prescribed scale.

```tsx
import { Typography } from "@/components/ui";

<Typography variant="h3" tone="inverse">
  TapMoMo settlements
</Typography>;
```

## Button

Buttons follow a single base style with semantic variants that stay within WCAG
AA contrast requirements. Every button supports `loading` (shows a spinner and
disables the button), `disabled`, and keyboard focus states that respect the
current theme.

Variants map directly to design tokens:

- `primary`: Solid brand action (`--color-primary-*`).
- `secondary`: Surface fill with neutral border.
- `outline`: Transparent background with strong border.
- `ghost`: Bare, text-forward action for low emphasis.
- `danger`: High-risk destructive actions (`--color-danger-*`).
- `link`: Text-only action, inherits inline flow.

Sizes ensure the 44px minimum tap target:

- `sm`, `md`, `lg`, `xl` (48px).

Example:

```tsx
import { Button } from "@/components/ui";

<Button variant="secondary" size="lg" onClick={handleExport} loading={pending}>
  Export statement
</Button>;
```

State styling reference:

| State    | Tokens / classes used                                                                              |
| -------- | -------------------------------------------------------------------------------------------------- |
| Hover    | `background-color` transitions to `--color-surface-subtle` (or variant equivalent).                |
| Focus    | `focus-visible:ring-[var(--state-focus-ring)]` with `ring-offset` derived from the active surface. |
| Active   | Dims background via `--state-active` overlay.                                                      |
| Disabled | `disabled:opacity-60` and neutralised borders/backgrounds.                                         |
| Loading  | Built-in spinner with accessible `aria-busy` attributes.                                           |

## Input

Inputs now use the shared typography and color tokens, with optional adornments
and error messaging:

```tsx
import { Input } from "@/components/ui";

<Input
  label={t("filters.search")}
  placeholder={t("filters.placeholder")}
  helperText={t("filters.helper")}
  leftIcon={<SearchIcon className="h-4 w-4" />}
/>;
```

- Sizes: `md` (44px) and `lg` (52px).
- Error state: border + focus ring swap to `--color-danger-500` with inline
  alert icon.
- Disabled state: `--color-surface-subtle` background and muted text.
- Helper text and labels leverage the typography scale automatically.

## Card & GlassCard

Cards are the primary container surface. They expose a `surface` prop that
controls the token-backed appearance:

| Surface       | Description                                            |
| ------------- | ------------------------------------------------------ |
| `base`        | Default solid card on `--color-surface` with border.   |
| `subtle`      | Low-emphasis container using `--color-surface-subtle`. |
| `contrast`    | Inverse surface for hero moments.                      |
| `elevated`    | Adds `--shadow-lg` depth while keeping the base fill.  |
| `translucent` | Token-backed glass variant (`GlassCard` reuses this).  |

The `CardHeader`, `CardContent`, and `CardFooter` helpers apply consistent
spacing and typography.

```tsx
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
} from "@/components/ui";

<Card surface="elevated" interactive>
  <CardHeader title="Daily settlement" description="Updated 3 minutes ago" />
  <CardContent>
    <Typography variant="body-lg" tone="muted">
      RWF 4,205,000
    </Typography>
  </CardContent>
  <CardFooter>
    <Button variant="secondary">View report</Button>
  </CardFooter>
</Card>;
```

Use `GlassCard` for translucent panels that previously relied on bespoke
gradient/glass classes:

```tsx
import { GlassCard } from "@/components/ui";

<GlassCard title="TapMoMo" subtitle="Realtime settlement status">
  <TapMoMoDashboard />
</GlassCard>;
```

## Badge

Badges are compact status indicators powered by semantic token palettes.
Variants include `neutral`, `info`, `success`, `warning`, `critical`, and
`pending` (animated pulse). Sizes follow the typography scale so that badges can
flex between dense tables and roomy hero headers.

```tsx
import { Badge } from "@/components/ui";

<Badge variant="success" dot>
  Active
</Badge>;
```

## Theming

The `ThemeProvider` now exposes a high-contrast theme alongside light, dark, and
Nyungwe. The existing `ThemeToggle` automatically lists the new mode, and all
components above derive colors from CSS variables so they immediately honour the
active theme.

When building custom components, prefer the design token custom properties (e.g.
`var(--color-border)`, `var(--state-focus-ring)`) or the
data-surface/data-gradient utilities defined in `app/globals.css`.
