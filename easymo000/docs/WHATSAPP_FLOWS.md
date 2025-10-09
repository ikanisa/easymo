# WhatsApp Flows — Baskets Module (Skeleton)

## Entry Points
- `[ROOT] SACCOs`

## Menus
- Member menu (key: `baskets_member`)
- Non-member menu (key: `baskets_non_member`)
- Committee quick actions (key: `baskets_committee`)

## Flows
1. Create Ikimina
2. Join Ikimina (search/invite)
3. My Ikimina
4. Contributions
5. Loan Request and Status

## DB-Driven Intents & Payload IDs

Intent definitions live in `public.whatsapp_intents`, grouped by menu in
`public.whatsapp_menu_items`. The current catalog is seeded via
`20251031131000_baskets_whatsapp_intents.sql` and can be extended without code
changes.

| Intent | Payload ID | Audience | Template | Notes |
| ------ | ---------- | -------- | -------- | ----- |
| `BKT_CREATE` | `baskets_create` | Non-member | `tmpl_baskets_invite` | Starts the create wizard. |
| `BKT_JOIN` | `baskets_join` | Shared | — | Opens invite-code prompt. |
| `BKT_MY` | `baskets_my` | Member/committee | — | Lists active ikimina. |
| `BKT_SHARE` | `baskets_share` | Member/committee | `tmpl_baskets_invite` | Surfaces invite link + QR. |
| `BKT_QR` | `baskets_qr` | Member | — | Regenerates MoMo QR via `basket_generate_qr`. |
| `BKT_CLOSE` | `baskets_close` | Committee | `tmpl_baskets_close_notice` | Prompts to close basket (owner only). |
| `BKT_LEAVE` | `baskets_leave` | Member | — | Removes the member from the basket. |
| `BKT_BACK_HOME` | `back_menu` | Shared | — | Returns to the main services menu. |

> Menu keys are stored in `public.settings` (`baskets.menu_keys`) so the
> runtime can resolve the correct intent set per audience.

## Template Catalogue

`public.settings -> baskets.templates` tracks the Meta template names used by
reminders and committee flows.

| Template Name | Purpose |
| ------------- | ------- |
| `tmpl_baskets_invite` | Share codes and deep links with prospective members. |
| `tmpl_baskets_due_in_3` | Contribution reminder sent three days before deadline. |
| `tmpl_baskets_due_today` | Day-of contribution reminder. |
| `tmpl_baskets_overdue` | Escalation when contributions are missed. |
| `tmpl_baskets_loan_submitted` | Acknowledge a loan request submission. |
| `tmpl_baskets_loan_status` | Notify members of loan approval/rejection. |
| `tmpl_baskets_committee_prompt` | Prompt committee to review a pending task. |
| `tmpl_baskets_close_notice` | Confirm basket closure and share follow-up steps. |

## Deep Links

- Deep link resolver: `POST/GET /functions/v1/deeplink-resolver?token=XXXX`
- Generates a `wa.me` redirect with the share code (`JB:XXXX`).
- Stores resolution stats (`basket_invites.resolved_count`) without consuming the invite.
- Admin UI surfaces both the deep-link URL and the direct WhatsApp link for
  copy/share actions.

## Quiet Hours & Throttle Policy
- Reference reminder engine (Phase 7).

## Deep Links
- Resolved via `deeplink-resolver`; see above.
