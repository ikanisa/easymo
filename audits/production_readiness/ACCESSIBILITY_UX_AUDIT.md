# Accessibility & UX Audit

## Admin Panel

- **Keyboard Navigation:** Modals/Drawers manage focus via `Modal.tsx` and
  `Drawer.tsx`; Escape closes, focus restored
  (`admin-app/components/ui/Modal.tsx`, `Drawer.tsx`). Confirm tab order covers
  new confirm dialogs.
- **Focus Indicators:** Buttons use default outlines; ensure high-contrast
  themes respect WCAG AA.
- **Tooltips/Labels:** Notification actions now include titles; verify screen
  reader hints for integration badges.
- **Empty/Loading/Error States:** Implemented via `EmptyState`, `LoadingState`;
  confirm consistent messaging.
- **Color Contrast:** Sidebar uses dark theme (#0f172a). Run automated checks to
  ensure 4.5:1 ratio.

### Action-Specific Findings

- Voucher generation form supports multi-line input but needs aria-describedby
  linking helper text.
- Confirmation dialogs rely on modal; ensure `role=dialog` accessible names
  present (inherited from `Modal`).
- Logs viewer filters are input fields; add labels for screen readers.

## Station PWA

- **Outdoor Readability:** Requirement in `UX_POLISH_BRIEF.md` for high
  contrast, but PWA implementation unknown; ensure default background meets AAA.
- **Font Size:** Must support 20pt for primary actions; confirm CSS implements.
- **Scanner UX:** Provide clear instructions when camera unavailable.
- **Keyboard/Assistive:** On rugged devices, ensure barcode scanner focus
  remains on input.
- **Masked PII:** Confirm display matches `+250 78* *** 012` pattern.

## Recommendations

1. Run automated accessibility audits (Lighthouse/axe) on Admin and Station
   flows; log results.
2. Add `aria-live` attributes to integration badges if they convey status
   changes.
3. Implement high-contrast toggle for Station PWA outdoor mode.
4. Provide keyboard shortcuts documentation (Cmd+K global search placeholder)
   per `UX_POLISH_BRIEF.md`.
5. Extend QA matrix with accessibility checks (added in `QA_MATRIX.md`).

## Validation Steps

- Use screen reader (VoiceOver/NVDA) to navigate voucher issuance and campaign
  wizard.
- Inspect Station PWA on sunlight readability using real hardware.
- Confirm focus trap in modals by tabbing through elements.
