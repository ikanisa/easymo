# Test & CI Preparation

## SQL / pgTAP
- Convert `tests/sql/*.sql` scaffolds to pgTAP (`pg_prove`) once modularization stabilises.
- Targeted scripts: matching_v2.sql, claim_notifications.sql, promote_draft_menu.sql.
- Add domain-specific scripts under `tests/sql/domains/` once feature code moves.

## Postman / Integration
- Update `tests/postman/flow-exchange.postman.json` folders to align with `domains/` (pending).
- Plan newman/CI command after flows stabilise.

## CI Pipeline TODO
- Add pg_prove step to CI (requires pgTAP) and run SQL scripts in staging pipeline.
- Add newman run for Postman collection.
- Gate deploy on SQL + Postman suites once Phase 3 complete.
