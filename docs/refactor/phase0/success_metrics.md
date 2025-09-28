# Refactor Success Metrics

## Delivery
- **Migration lead time**: target < 30 minutes for schema deploy (Phase 1+), including verification.
- **Rollback readiness**: every migration ships with `down` or snapshot plan validated in staging.
- **Edge deploy time**: < 10 minutes from merge to Supabase function release with automated smoke tests.

## Quality
- **Automated coverage**: >= 80% of DB functions/triggers covered by pgTap or SQL assertions by end of Phase 2.
- **Integration tests**: WA flows, notification worker, and OCR processor have regression suites (CLI-driven) before Phase 3 exits.
- **Observability**: structured logs with correlation IDs and PII scrubbing enforced in all edge functions (Phase 4).

## Reliability
- **Zero data loss incidents**: no P0/P1 incidents attributable to migrations or edge refactors.
- **RLS enforcement**: 100% of customer-facing tables RLS-protected with test coverage before Phase 4.
- **SLO adherence**: messaging pipeline maintains 99.5% delivery success within 60s under load tests.

## Adoption
- **Documentation completeness**: `/docs/refactor/*` updated per phase with owners review sign-off.
- **Stakeholder signoff**: domain owners approve table/function changes before rollout.
- **Training**: admin/station teams receive release notes when legacy endpoints are retired (Phase 5).
