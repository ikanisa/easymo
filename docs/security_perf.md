# Security & Performance Notes

- All additive tables rely on service role access from Edge Functions; RLS policies to be defined for customer/vendor access before production.
- Basket share tokens are random 6-char hex; consider enforcing expiration for private baskets.
- MoMo QR generation uses QuickChart HTTPS. Add signature if downstream requires.
- Wallet RPCs expose aggregate data only; ensure limit parameters remain bounded to avoid large scans.
- Insurance uploads store to `insurance-docs` bucket without public ACL; continue serving through signed URLs only.
- Admin commands write audit rows in `admin_audit_log` for traceability.
