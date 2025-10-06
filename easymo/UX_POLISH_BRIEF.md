# UX Polish Brief

This brief consolidates copy, states, and accessibility requirements for the
final implementation pass.

## Global Components

- **Empty State**: Icon + headline + body text + primary CTA (if applicable).
  Reuse across tables and drawers.
- **Loading State**: Skeleton rows for tables, shimmer cards for KPIs, spinner
  with "Loading…" for modal content.
- **Error State**: Inline alert with retry button; include error reference code
  for logs.
- **Confirmation Dialogs**: Required for cancel/void voucher, stop campaign,
  delete station; include summary of impact and require reason when applicable.

## Copy Guidelines

- Prefer active voice and direct language ("Send blocked" vs "Sending has been
  blocked").
- Use currency format `#,### RWF` and show expiries as `DD MMM, HH:mm` with
  timezone suffix.
- Tooltips provide 1–2 sentence explanations; avoid jargon.

## Accessibility

- Maintain WCAG AA contrast (≥4.5:1) on text and controls; Station PWA aims for
  AAA on primary buttons.
- Ensure focus outlines visible on keyboard navigation; modals trap focus and
  provide `Esc` to close.
- Provide skip-to-content link in Admin layout.
- Announce toasts with ARIA live region (`aria-live="polite"`).

## Screen-Specific Notes

### Dashboard

- KPI cards include tooltip describing metric formula.
- Time-series chart accessible summary text: "Issued vs Redeemed vouchers for
  the last 30 days".

### Users Drawer

- Section headings: "Profile", "Vouchers", "Insurance".
- Provide copy "No vouchers yet" when empty.

### Insurance Review

- Thumbnail grid with alt text "Uploaded document X".
- Buttons: Approve (primary), Request Changes (secondary). Request dialog
  includes textarea placeholder "Explain what needs to change".

### Vouchers Modal

- When PNG available: show download button labeled "Download PNG".
- Degraded state message (from EF probe brief) with link to Integrations Status.

### Campaign Wizard

- Stepper shows Step x of y; review screen before save.
- CSV mapping help tooltip: "Map each column to a template variable or mark
  unused."

### Settings

- Quiet hours help text: "Messages will not send between these times (local)."
- Opt-out list input supports paste; show note "Hash numbers using SHA-256".

### Station PWA

- Home screen uses 20pt+ text buttons, high-contrast background (#0B0D17) with
  white text.
- Redeem success screen shows large check icon, amount in 48pt font, masked
  msisdn `+250 78* *** 012`.
- Error messages in red (#FF4D4F) with accessible contrast.

## Visual References

- Voucher preview mock: overlay glass card, code in monospaced font (e.g., Space
  Mono, 240px), QR placeholder 400×400 centered bottom.
- Station redeem mock: provide screenshot in design folder
  (`docs/design/voucher-preview.png`, `docs/design/station-redeem.png`) once
  assets ready.

## Final QA Checklist

- Tab order matches visual order.
- Keyboard shortcuts: `Cmd/Ctrl+K` opens global search; `Shift+/?` shows
  shortcut modal (future enhancement but placeholder copy required).
- Responsive layout tested at 1280px desktop, 1024px tablet, 375px mobile.
