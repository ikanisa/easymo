# Release Checklist — WA Legacy Features

- [ ] Apply migrations through `20251003160000_phase_a_legacy.sql` in staging.
- [ ] Verify baskets create/join/share flows via WA sandbox numbers.
- [ ] Exercise marketplace browse + add to confirm Supabase writes.
- [ ] Generate MoMo QR and confirm `momo_qr_requests` audit row.
- [ ] Upload insurance doc and confirm storage object + admin alert.
- [ ] Run wallet menu (earn/transactions/redeem/top) for fixture profile.
- [ ] Validate `/sub` admin commands log to `admin_audit_log` and update status.
- [ ] Inspect `webhook_logs` for new event scopes (MOMO_QR, OCR_STATUS, ADMIN_ACTION).
