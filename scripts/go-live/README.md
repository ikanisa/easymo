# Ibimina → EasyMO Go-Live Toolkit

Comprehensive toolkit for managing the operational cutover from Ibimina to EasyMO.

## Purpose

This toolkit provides:
- ✅ **Pre-flight health checks** - Validate system readiness
- ✅ **Parallel run monitoring** - Compare old vs new system behavior
- ✅ **Traffic cutover** - DNS, webhooks, routing changes
- ✅ **Live verification** - Post-cutover validation
- ✅ **Emergency rollback** - Instant revert capabilities
- ✅ **Decommission** - Safe old system shutdown

## Prerequisites

1. **Data migration completed** via `scripts/ibimina-migration/`
2. **Both systems operational** (Ibimina & EasyMO)
3. **Environment configured** (see `.env.example`)
4. **Monitoring setup** (Slack, optional PagerDuty)

## Quick Start

```bash
cd scripts/go-live
pnpm install
cp .env.example .env
# Edit .env with your credentials
```

## Workflow

### Phase 1: Pre-Flight Checks

Validate system readiness before cutover:

```bash
pnpm pre-flight
```

Checks:
- Database connectivity (old & new)
- Data synchronization
- API health endpoints
- SMS webhook configuration
- Authentication setup

### Phase 2: Parallel Run (Optional)

Monitor both systems side-by-side:

```bash
pnpm parallel-run --duration=1h
```

Compares:
- Request volumes
- Response times
- Error rates
- Data consistency

### Phase 3: Cutover

Execute the production switch:

```bash
pnpm cutover
```

Steps:
1. Final health check
2. Freeze writes (optional)
3. Final data sync
4. DNS/webhook updates
5. Traffic switch
6. Post-cutover verification

### Phase 4: Live Verification

Confirm production is healthy:

```bash
pnpm verify-live
```

### Phase 5: Rollback (If Needed)

Instant revert to old system:

```bash
pnpm rollback --reason="High error rate"
```

### Phase 6: Decommission

Safe shutdown of old system (post-stabilization):

```bash
pnpm decommission
```

## Environment Variables

See `.env.example` for full configuration.

**Critical:**
- `OLD_SUPABASE_URL` / `OLD_SUPABASE_SERVICE_KEY`
- `NEW_SUPABASE_URL` / `NEW_SUPABASE_SERVICE_KEY`
- `DRY_RUN=true` (for testing)

**Optional:**
- Slack webhook for alerting
- Cloudflare tokens for DNS
- SMS gateway credentials

## Runbooks

See `runbooks/` directory for detailed procedures:
- `PARALLEL_RUN.md` - Monitoring guide
- `CUTOVER.md` - Step-by-step cutover
- `ROLLBACK.md` - Emergency procedures
- `INCIDENT_RESPONSE.md` - Troubleshooting

## Safety Features

- ✅ **Dry-run mode** - Test without making changes
- ✅ **Rollback checkpoints** - Save state at each step
- ✅ **Automated health checks** - Fail-fast on issues
- ✅ **Slack alerts** - Real-time notifications
- ✅ **Comprehensive logging** - Audit trail

## Integration with Data Migration

This toolkit **complements** `scripts/ibimina-migration/`:

1. **Data migration** (`ibimina-migration/`) - Migrate DB records
2. **Go-live** (`go-live/`) - Switch production traffic

Both tools use shared utilities from `scripts/_shared/`.

## Development

```bash
pnpm typecheck  # Validate TypeScript
pnpm pre-flight # Test health checks
```

## Support

For issues:
1. Check runbooks in `runbooks/`
2. Review logs
3. Use `pnpm pre-flight` to diagnose
4. Rollback if needed

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Last Updated**: 2025-12-09
