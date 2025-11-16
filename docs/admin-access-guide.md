# Admin Invitations & Access Control

## Invitation workflow

1. Generate an invitation token from the admin console (Users → Invite).  
   *(Note: The `admin-users` Edge Function currently only supports GET requests to list users.  
   User invitations are typically handled through the admin console UI.)*
2. Share the invitation link with the recipient. Links expire according to the Supabase email token settings for the project.
3. Once accepted, confirm the profile record in `profiles` includes the correct `role` (`admin`, `analyst`, `viewer`) and `status` (`active`).
4. Rotate the invite token or delete the pending invite if the link was exposed.

## Access control checklist

- **Row Level Security:** RLS is enabled on `profiles`, `trips`, `subscriptions`, and `driver_presence`. Keep writes limited to service-role contexts.
- **Edge Function auth:** All admin functions verify `EASYMO_ADMIN_TOKEN`. Update the secret in both Supabase project settings and `.env/.env.local` when rotating.
- **Role mapping:**
  - `admin`: full access to settings, users, trips, and subscriptions.
  - `analyst`: read-only dashboards and reports; no mutations.
  - `viewer`: limited read-only access for demos.
- **Session secrets:** Ensure `ADMIN_SESSION_SECRET` is set to 16+ characters in `.env` before launching the app.
- **Audit trails:** Supabase logs all function invocations; enable Logflare export or integrate with your SIEM to retain audit history.

## Revoking access

1. Invalidate active sessions by rotating `ADMIN_SESSION_SECRET`.
2. Set the user’s `status` to `disabled` in `profiles` and remove any active invitations.
3. Rotate `EASYMO_ADMIN_TOKEN` and redeploy functions if a token leak is suspected.
