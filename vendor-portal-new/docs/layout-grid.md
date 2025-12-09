# Staff workspace layout grid

This guide captures the shared grid primitives used by the staff console and how
high-traffic routes divide content between the primary work surface and
supporting panels.

## Inventory of primary and secondary panels

| Route (apps/pwa/staff-admin/app/(main)) | Primary panel (WorkspaceMain)                                    | Secondary panel (WorkspaceAside) | Notes                                                             |
| --------------------------------------- | ---------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `/dashboard`                            | KPI header, quick actions, contributor health, top Ikimina table | Sync queue summary               | Secondary panel hides on mobile and when the queue is empty.      |
| `/recon`                                | Statement ingest wizard, SMS inbox, reconciliation table         | Sync queue summary               | Wizard stays in the primary column so drop targets remain wide.   |
| `/analytics`                            | Executive overview cards                                         | Sync queue summary               | Currently the only supporting widget required.                    |
| `/ikimina`                              | Group roster tools, imports, and detail tabs                     | _(planned)_                      | Pending audit: reserve aside for roster filters or quick metrics. |
| `/ops`                                  | Incident feed and MFA alerts                                     | _(planned)_                      | Aside slot earmarked for alert acknowledgements.                  |
| `/reports`                              | Report composer and export history                               | _(planned)_                      | Aside slot will host saved presets.                               |

## Grid structure

The `WorkspaceLayout` component renders a single-column stack by default and
expands to a two-column CSS grid on large screens:

- **Desktop (`lg` breakpoint and above):**
  `grid-template-columns: minmax(0, 1fr) minmax(240px, 320px)` with a `gap-6`
  gutter (1.5rem). The aside column sticks to `top: 6rem` by default so support
  widgets stay in view while scrolling the main feed.
- **Mobile and tablet:** the layout collapses to a single column and the aside
  (if present) flows beneath the main content. When the aside would be empty
  (for example when all sync queues are clear) it is omitted entirely.

```
Desktop (lg+)
┌───────────────────────────────┬──────────────────────┐
│ WorkspaceMain (1fr)           │ WorkspaceAside (~280px)
└───────────────────────────────┴──────────────────────┘

Mobile / Tablet
┌───────────────────────────────┐
│ WorkspaceMain                 │
├───────────────────────────────┤
│ WorkspaceAside (if rendered)  │
└───────────────────────────────┘
```

## Hero slot and layout primitives

The app shell now exposes an optional `<AppShellHero>` slot. Pages can provide a
branded header, but routes that do not need a hero fall back to a compact
console label. Combine the hero slot with the workspace primitives as shown
below:

```tsx
<AppShellHero>
  <GradientHeader title="Route title" subtitle="Contextual blurb" />
</AppShellHero>

<WorkspaceLayout>
  <WorkspaceMain>
    {/* Primary work surface */}
  </WorkspaceMain>

  <WorkspaceAside>
    {/* Supporting widgets (queues, filters, summaries) */}
  </WorkspaceAside>
</WorkspaceLayout>
```

`WorkspaceAside` automatically removes itself when all children render `null`,
keeping the grid to a single column without additional guard logic in each
route.
