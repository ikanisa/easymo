# Supabase Project Ownership & Secrets

This matrix tracks who administers each Supabase project and where the
corresponding service-role credentials live. Keep this document current whenever
ownership or secrets rotate so that incident responders know whom to contact.

## Project Matrix

| Environment | Project Ref              | Primary Owner                 | Backup Owner                 | Secrets Manager Path                         |
| ----------- | ------------------------ | ----------------------------- | ---------------------------- | -------------------------------------------- |
| Production  | qhzxyfymnjbggqvmszti     | Data Platform Lead (Amara N.) | Engineering Manager (Jon K.) | `aws secretsmanager`: `prod/easymo/supabase/service-role` |
| Staging     | mtyuvkndqpjcwxlsfrbo     | QA Manager (Lydia M.)         | Data Platform Lead (Amara N.) | `aws secretsmanager`: `stg/easymo/supabase/service-role`  |

- **Primary owner**: accountable for schema changes, access grants, and rota
  sign-off.
- **Backup owner**: empowered to approve access or rotations when the primary is
  unavailable.
- **Secrets manager path**: canonical key/value storing the Supabase
  service-role key. Use this path whenever you need to fetch or rotate the
  credential (see below).

## Accessing the Service-Role Key

1. Authenticate with the production AWS account (`aws sso login --profile easymo-admin`).
2. Fetch the secret:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id prod/easymo/supabase/service-role \
     --query 'SecretString' --output text
   ```
3. Inject the value into the deployment environment (Vercel/Render secrets or
   GitHub Actions) instead of copying it into `.env` files.
4. Repeat with the staging secret path when preparing test deployments.

## Rotation Procedure

- Owners schedule quarterly rotations with at least one business day's notice.
- Use `aws secretsmanager put-secret-value` to stage a new value, update the
  Admin app + Edge function environments, then deactivate the old key in the
  Supabase dashboard.
- Update this document with the rotation date and any owner changes; mention the
  update in the #ops Slack channel for visibility.

## Verification Log

- 2025-01-15 — Production and staging keys imported into AWS Secrets Manager and
  verified via Supabase dashboard login (Amara N.).
