# Evidence Index

| Reference | Description                                  | Location                                                                                            |
| --------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| E1        | Voucher generate API idempotency & messaging | `admin-app/app/api/vouchers/generate/route.ts:1-200`                                                |
| E2        | Voucher send policy enforcement              | `admin-app/app/api/vouchers/send/route.ts:1-120`                                                    |
| E3        | Policy evaluation order                      | `admin-app/lib/server/policy.ts:12-150`                                                             |
| E4        | Campaign API with bridge integration         | `admin-app/app/api/campaigns/route.ts:1-170`                                                        |
| E5        | Station API idempotency and bridge           | `admin-app/app/api/stations/route.ts:1-140`                                                         |
| E6        | Edge bridge helper with degraded handling    | `admin-app/lib/server/edge-bridges.ts:1-220`                                                        |
| E7        | Settings persistence + integration badges    | `admin-app/app/api/settings/route.ts:1-160`, `admin-app/components/settings/SettingsForm.tsx:1-160` |
| E8        | Logs endpoint degraded fallback              | `admin-app/app/api/logs/route.ts:1-80`                                                              |
| E9        | Integration badge component                  | `admin-app/components/ui/IntegrationStatusBadge.tsx:1-60`                                           |
| E10       | Voucher workflow documentation               | `DATA_MODEL_DELTA.md:52-123`, `VOUCHER_INTEGRITY_AUDIT.md`                                          |
| E11       | Messaging policy copy                        | `UX_POLISH_BRIEF.md:1-200`, `MESSAGING_POLICY_COMPLIANCE.md`                                        |
| E12       | QA coverage expectations                     | `QA_MATRIX.md:1-220`                                                                                |
| E13       | Incident/rollback baseline docs              | `INCIDENT_RUNBOOKS.md`, `ROLLBACK_PLAYBOOK.md` (root)                                               |
| E14       | Accessibility requirements                   | `UX_POLISH_BRIEF.md`, `ACCESSIBILITY_UX_AUDIT.md`                                                   |
| E15       | Privacy data mapping                         | `DATA_MODEL_DELTA.md`, `PRIVACY_DPIA_LITE.md`                                                       |
