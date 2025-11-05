# Phase 2 Security Definer Backlog

| Function                                                 | Reason for DEF                                                        | Proposed remediation                                                                       | Notes                                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `security.claim_notifications(limit integer default 10)` | Needs to bypass RLS on `notifications` queue for worker.              | Add pgTAP coverage and monitor `service_role` grants (migration `20251011121000` applied). | Keep execution restricted to service role; audit logs for queue processing.               |
| `menu_admin.promote_draft_menu(menu_id uuid)`            | Updates multiple menu tables/published snapshot with elevated rights. | Already relocated to `menu_admin` schema; keep definer but limit grants to `service_role`. | Ensure all callers use schema-qualified name; add regression tests around promotion flow. |

Next steps: extend coverage + monitoring for these routines (tracked via Phase 2
test plan).
