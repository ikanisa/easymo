# SACCO+ Design System Style Guide

## 📐 Design Tokens

### Colors

#### Neutral Palette

```typescript
neutral-50:  #fafafa  // Backgrounds
neutral-100: #f5f5f5  // Borders, disabled states
neutral-200: #e5e5e5  // Dividers
neutral-300: #d4d4d4  // Muted borders
neutral-400: #a3a3a3  // Placeholder text
neutral-500: #737373  // Secondary text
neutral-600: #525252  // Body text (avoid - use 700+)
neutral-700: #404040  // Body text (recommended)
neutral-800: #262626  // Headings
neutral-900: #171717  // Primary text
```

#### Brand Colors (Rwanda Flag)

```typescript
atlas-blue:      #00A1DE  // Primary actions, links
atlas-blue-dark: #0082B4  // Hover states
atlas-blue-light:#33B3E6  // Accents

rw-blue:   #00A1DE  // Rwanda flag blue
rw-yellow: #FFDA44  // Rwanda flag yellow
rw-green:  #00A859  // Rwanda flag green
```

#### Semantic Colors

```typescript
// Success
green-50:  #f0fdf4
green-500: #22c55e
green-600: #16a34a

// Warning
yellow-50:  #fefce8
yellow-500: #eab308
yellow-600: #ca8a04

// Error
red-50:  #fef2f2
red-500: #ef4444
red-600: #dc2626

// Info
blue-50:  #eff6ff
blue-500: #3b82f6
blue-600: #2563eb
```

### Typography

#### Font Family

```css
font-family:
  "Inter",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

#### Scale (8pt grid)

```typescript
text-xs:   12px / 16px  // 0.75rem / 1rem
text-sm:   14px / 20px  // 0.875rem / 1.25rem
text-base: 16px / 24px  // 1rem / 1.5rem
text-lg:   18px / 28px  // 1.125rem / 1.75rem
text-xl:   20px / 28px  // 1.25rem / 1.75rem
text-2xl:  24px / 32px  // 1.5rem / 2rem
text-3xl:  30px / 36px  // 1.875rem / 2.25rem
text-4xl:  36px / 40px  // 2.25rem / 2.5rem
```

#### Weights

```typescript
font-normal:    400  // Body text
font-medium:    500  // Emphasis
font-semibold:  600  // Headings
font-bold:      700  // Strong emphasis
```

### Spacing (8pt grid)

```typescript
0:    0px
1:    4px    // 0.25rem
2:    8px    // 0.5rem
3:    12px   // 0.75rem
4:    16px   // 1rem
5:    20px   // 1.25rem
6:    24px   // 1.5rem
8:    32px   // 2rem
10:   40px   // 2.5rem
12:   48px   // 3rem
16:   64px   // 4rem
20:   80px   // 5rem
24:   96px   // 6rem
```

### Border Radius

```typescript
rounded-sm:   4px   // Small elements (badges, chips)
rounded:      6px   // Inputs, buttons
rounded-md:   8px   // Cards (default)
rounded-lg:   12px  // Large cards
rounded-xl:   16px  // Prominent cards, modals
rounded-2xl:  24px  // Hero sections
rounded-full: 9999px // Avatars, pills
```

### Shadows

```typescript
// Light mode
shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.05)
shadow:     0 1px 3px 0 rgb(0 0 0 / 0.1)
shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.1)
shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.1)
shadow-xl:  0 20px 25px -5px rgb(0 0 0 / 0.1)
shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25)

// Dark mode (increase opacity by 2x)
dark:shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.2)
```

---

## 🎨 Component Library

### Buttons

```tsx
import { Button } from "@ibimina/ui";

// Variants
<Button variant="primary">Primary Action</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// States
<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>
```

### Cards

```tsx
import { Card, StatCard, ActionCard, ListCard, InfoCard, FormCard } from "@ibimina/ui";

// Base Card
<Card variant="default" padding="md">
  Content
</Card>

// Stat Card (metrics/KPIs)
<StatCard
  label="Total Members"
  value="1,234"
  change={{ value: "+12%", trend: "up" }}
  icon={<UsersIcon />}
/>

// Action Card (clickable features)
<ActionCard
  title="Create Group"
  description="Start a new ikimina"
  icon={<PlusIcon />}
  onAction={() => {}}
/>

// List Card (members/transactions)
<ListCard
  title="Jean Bosco"
  subtitle="Member since 2024"
  avatar={<Avatar />}
  status={<Badge>Active</Badge>}
  metadata={[
    { label: "Contributions", value: "RWF 50,000" },
    { label: "Groups", value: "3" }
  ]}
/>

// Info Card (alerts/banners)
<InfoCard
  variant="success"
  title="Payment Received"
  message="Your deposit of RWF 10,000 has been confirmed"
  icon={<CheckIcon />}
  dismissible
/>

// Form Card (settings sections)
<FormCard
  title="Profile Settings"
  description="Update your personal information"
  footer={<Button>Save Changes</Button>}
>
  <FormFields />
</FormCard>
```

### Inputs

```tsx
import { Input, SearchInput, FilterChips } from "@ibimina/ui";

// Text Input
<Input
  label="Phone Number"
  placeholder="078..."
  error="Invalid phone number"
  helperText="Enter your MTN or Airtel number"
  required
/>

// Search
<SearchInput
  value={query}
  onChange={setQuery}
  placeholder="Search members..."
  onClear={() => setQuery("")}
/>

// Filter Chips
<FilterChips
  filters={[
    { key: "status", label: "Active", value: "active" },
    { key: "group", label: "Savings Group", value: "123" }
  ]}
  onRemove={(key) => removeFilter(key)}
  onClearAll={() => clearFilters()}
/>
```

### Loading States

```tsx
import { Skeleton, CardSkeleton, ListItemSkeleton } from "@ibimina/ui";

// Skeleton (single element)
<Skeleton width="200px" height="24px" />

// Card Skeleton
<CardSkeleton />

// List Skeleton
{Array.from({ length: 5 }).map((_, i) => (
  <ListItemSkeleton key={i} />
))}
```

### Empty & Error States

```tsx
import { EmptyState, ErrorState } from "@ibimina/ui";

// Empty State
<EmptyState
  icon={<InboxIcon />}
  title="No groups yet"
  description="Create your first ikimina to get started"
  action={
    <Button onClick={onCreate}>Create Group</Button>
  }
/>

// Error State
<ErrorState
  title="Failed to load data"
  message="We couldn't fetch your groups. Please try again."
  onRetry={refetch}
/>
```

### Virtual Tables

```tsx
import { VirtualTable } from "@ibimina/ui";

<VirtualTable
  data={members}
  columns={[
    {
      key: "name",
      header: "Member Name",
      width: "200px",
      render: (member) => member.name,
    },
    {
      key: "amount",
      header: "Contributions",
      width: "150px",
      align: "right",
      render: (member) => formatCurrency(member.amount),
    },
  ]}
  rowHeight={56}
  estimatedHeight={600}
  getRowKey={(member) => member.id}
  onRowClick={(member) => navigate(`/members/${member.id}`)}
/>;
```

### Progressive Disclosure

```tsx
import { ProgressiveDisclosure, StepForm } from "@ibimina/ui";

// Expandable Sections
<ProgressiveDisclosure
  sections={[
    {
      id: "basic",
      title: "Basic Information",
      content: <BasicInfoForm />,
      defaultExpanded: true,
    },
    {
      id: "advanced",
      title: "Advanced Settings",
      content: <AdvancedForm />,
      required: false,
    },
  ]}
  expandMode="multiple"
/>

// Multi-Step Form
<StepForm
  steps={[
    {
      id: "details",
      title: "Group Details",
      content: <DetailsForm />,
      validation: () => validateDetails(),
    },
    {
      id: "members",
      title: "Add Members",
      content: <MembersForm />,
    },
  ]}
  currentStep={step}
  onStepChange={setStep}
  onComplete={handleCreate}
/>
```

### Pulse Insights

```tsx
import { PulseInsights } from "@ibimina/ui";

<PulseInsights
  insights={[
    {
      id: "1",
      type: "action",
      icon: <BellIcon />,
      title: "Payment Due Tomorrow",
      description: "Your monthly contribution of RWF 10,000 is due",
      timestamp: new Date(),
      action: {
        label: "Pay Now",
        onClick: () => navigate("/pay"),
      },
      dismissible: true,
    },
  ]}
  onDismiss={(id) => dismissInsight(id)}
/>;
```

### Saved Views

```tsx
import { SavedViews, useSavedViews } from "@ibimina/ui";

const { views, currentView, createView, updateView, deleteView } =
  useSavedViews("members-views");

<SavedViews
  views={views}
  currentView={currentView}
  onSelectView={setCurrentView}
  onCreateView={createView}
  onUpdateView={updateView}
  onDeleteView={deleteView}
/>;
```

### PWA Install

```tsx
import { PWAInstallPrompt, PWAUpdateBanner, usePWAInstall } from "@ibimina/ui";

// Install Prompt
<PWAInstallPrompt
  appName="SACCO+"
  description="Install for quick access and offline support"
  onInstall={() => track("pwa_installed")}
/>

// Update Banner
<PWAUpdateBanner
  onUpdate={() => window.location.reload()}
/>

// Hook
const { canInstall, isInstalled, install } = usePWAInstall();

{canInstall && (
  <Button onClick={install}>Install App</Button>
)}
```

---

## ♿ Accessibility Guidelines

### WCAG Compliance

**Target: WCAG 2.1 Level AA**

✅ **Color Contrast**

- Text: 4.5:1 minimum (7:1 for large text)
- UI Components: 3:1 minimum
- Use `text-neutral-700+` for body text
- Never use `text-neutral-600` or lighter

✅ **Keyboard Navigation**

- All interactive elements focusable
- Logical tab order
- Visible focus indicators
- Skip links for navigation

✅ **Screen Readers**

- Semantic HTML (`<nav>`, `<main>`, `<button>`)
- ARIA labels where needed
- `aria-current` on active nav
- `role="alert"` for errors

✅ **Motion**

- Respect `prefers-reduced-motion`
- Provide toggle for animations
- Max duration: 220ms

### Accessibility Checklist

```tsx
// ✅ Good
<button
  onClick={handleClick}
  aria-label="Close dialog"
  className="focus:ring-2 focus:ring-atlas-blue"
>
  <CloseIcon aria-hidden="true" />
</button>

// ❌ Bad
<div onClick={handleClick}>
  <CloseIcon />
</div>

// ✅ Good
<img src={avatar} alt={`${name}'s profile picture`} />

// ❌ Bad
<img src={avatar} />

// ✅ Good
<nav aria-label="Main navigation">
  <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}>
    Dashboard
  </Link>
</nav>

// ❌ Bad
<div>
  <a href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}>
    Dashboard
  </a>
</div>
```

---

## 📱 Responsive Design

### Breakpoints

```typescript
sm:  640px   // Mobile landscape
md:  768px   // Tablet portrait
lg:  1024px  // Tablet landscape / Small desktop
xl:  1280px  // Desktop
2xl: 1536px  // Large desktop
```

### Mobile-First Approach

```tsx
// ✅ Good: Mobile-first
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-2xl md:text-3xl lg:text-4xl">
    Title
  </h1>
</div>

// ❌ Bad: Desktop-first
<div className="p-8 md:p-6 sm:p-4">
  Title
</div>
```

### Touch Targets

```typescript
Minimum: 44x44px (WCAG 2.5.5)
Recommended: 48x48px
Spacing: 8px minimum between targets
```

---

## 🎭 Dark Mode

### Implementation

```tsx
// Tailwind dark: prefix
<div className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
  Content
</div>;

// System preference detection
const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
```

### Color Guidelines

- **Backgrounds**: `bg-white` / `dark:bg-neutral-900`
- **Text**: `text-neutral-900` / `dark:text-neutral-100`
- **Borders**: `border-neutral-200` / `dark:border-neutral-700`
- **Shadows**: Increase opacity 2x in dark mode

---

## 🚀 Performance

### Bundle Optimization

```tsx
import { lazyWithRetry, withSuspense } from "@ibimina/ui";

// Lazy load heavy components
const HeavyChart = lazyWithRetry(() => import("./HeavyChart"), {
  retries: 3,
  fallback: <Skeleton />,
});

// Wrap with Suspense
const ChartWithSuspense = withSuspense(HeavyChart, <Skeleton />);

// Prefetch on hover
const { prefetch } = usePrefetch();
<Link onMouseEnter={() => prefetch("/reports")} href="/reports">
  Reports
</Link>;
```

### Performance Budgets

```typescript
First Load JS:     < 105 KB
Total Bundle:      < 300 KB
Lighthouse PWA:    ≥ 90
Lighthouse Perf:   ≥ 90
Lighthouse A11y:   ≥ 95
```

---

## 📚 Resources

- **Figma**: [Design Files](https://figma.com/sacco-plus)
- **GitHub**: [ibimina/ibimina](https://github.com/ikanisa/ibimina)
- **Docs**: `/packages/ui/README.md`
- **Storybook**: Coming soon

---

**Version**: 1.0.0  
**Last Updated**: 2025-11-10  
**Maintained by**: SACCO+ Design Team
