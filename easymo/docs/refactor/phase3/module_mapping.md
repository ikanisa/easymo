# WA Webhook Module Mapping (Phase 3)

| Current    | Target                                         | Notes                                                                  |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `exchange` | domains/<feature>/actions (split by domain)    | Split actions into domain-specific services (admin, customer, vendor). |
| `flows`    | domains/<feature>/flows (TS + JSON separation) | Keep JSON flows but relocate TS orchestrators into domain folders.     |
| `router`   | router/ (entry + pipelines)                    |                                                                        |
| `state`    | state/                                         |                                                                        |
| `notify`   | services/notifications                         |                                                                        |
| `observe`  | shared/logging                                 |                                                                        |
| `rpc`      | services/supabase (wrap RPC calls)             |                                                                        |
| `utils`    | shared/utils (split generic vs domain helpers) | Identify cross-domain helpers vs domain-specific logic.                |
| `vouchers` | domains/wallet or services/vouchers            |                                                                        |
| `wa`       | services/wa (client, ids, verify)              |                                                                        |
