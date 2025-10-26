# Flow localization review

## Summary
- Normalised the primary customer flow CTA strings to Title Case to align with design tokens.
- Synced button copy with approved copy deck (`View Results`, `Back to Search`).
- Confirmed pagination affordances remain unchanged after copy tweaks.

## Approvals
- ✅ Product design (Figma spec `Flows > Customer v7` — approval recorded 2025-02-12)
- ✅ Localization (Transifex batch `admin_flow_v7` — confirmation thread `#loc-signoff` 2025-02-13)

## Regression validation
- ✅ `pnpm --filter admin-app test`
- ✅ Manual WhatsApp Flow preview using staging template `flow.admin.diag.v1`
- ✅ Snapshot diff against published Flow JSON (`tools/flows/diff.sh flow_live_final.json`)

> Store additional approvals or test notes here whenever the flow strings change.
