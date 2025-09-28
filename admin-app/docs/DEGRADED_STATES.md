# Degraded States Playbook

The Admin Panel surfaces dependency health with `integration` badges. This
document explains what each status means and how operators should respond when a
surface is running in degraded mode.

## Reading the Badge

- **OK** – Upstream Edge Functions or Supabase writes succeeded. No action
  needed.
- **Degraded** – The UI fell back to mock data or a local acknowledgement.
  Review the `reason` and `message` strings to decide on follow-up steps.

Every API response that mutates state includes an optional `integration` object:

```json
{
  "integration": {
    "target": "voucherGenerate",
    "status": "degraded",
    "reason": "mock_signed_url",
    "message": "Voucher issuance bridge returned unexpected payload. Falling back to local generator."
  }
}
```

## Surface Cheat Sheet

| Target              | When it turns degraded                            | Immediate action                                       |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| `voucherGenerate`   | Edge Function missing or returned invalid payload | Check EF deploy, rerun job once bridge is healthy      |
| `voucherSend`       | WhatsApp bridge offline                           | Pause campaigns, notify on-call communications         |
| `voucherPreview`    | Preview EF missing/errored                        | Use design mock, inform design review chat             |
| `campaignDispatch`  | Dispatcher call failed                            | Confirm campaign state in backend before communicating |
| `insuranceWorkflow` | Insurance workflow bridge offline                 | Coordinate manually with underwriting, log follow-up   |
| `stationDirectory`  | Station propagation bridge unavailable            | Ping infra to replay directory sync                    |
| `orderOverride`     | Supabase unavailable; override stored locally     | Monitor once DB returns, repeat override if needed     |
| `policySettings`    | Settings stored in memory only                    | Schedule retry once Supabase credentials restored      |
| `notifications`     | Dispatcher not reachable                          | Re-run resend when bridge is back                      |
| `storageSignedUrl`  | Supabase storage credentials missing              | Provide signed URLs manually or wait for credentials   |
| `logs`              | Audit log falling back to fixtures                | Verify real audit trail via Supabase directly          |

## Operator Workflow

1. **Acknowledge** – Confirm the degraded badge and copy the message. Add to the
   ops channel for visibility.
2. **Diagnose** – Check Supabase status and the relevant Edge Function logs.
3. **Mitigate** – If a bridge is offline, coordinate manual procedures (e.g.,
   send vouchers through WhatsApp Business).
4. **Resolve** – Once the dependency is back, retry the action from the Admin
   Panel.
5. **Log** – Record the incident in the ops log referencing the badge `target`
   and `reason`.

## Notes

- Badges are cached per interaction, so a degraded state can clear after a
  subsequent refresh.
- For automation, scripts can assert that `integration.status !== 'degraded'`
  before considering a run successful.
- The QA matrix lists manual checks for degraded modes. Run them before each
  release candidate.
