# Frontend Auth Architecture Plan

## Page map and shell
- **Layout shell**: persistent header (logo, org name, quick links), sidebar nav (role-aware menu groups), main content area with breadcrumbs + page title, global feedback toasts, and footer for build info.
- **Public surface**: `/` (marketing splash), `/login` (email sign-in), `/legal/*` (static content). Minimal shell with header/footer only.
- **Authenticated shell**: wraps all app pages with sidebar and top bar; guards routes via Supabase session/role gate; injects organization switcher and quick actions.
- **Primary flows**: Dashboard (`/app/home`), Inventory (`/app/inventory`), Orders (`/app/orders`), Customers (`/app/customers`), Settings (`/app/settings`), Admin (`/app/admin`).
- **Zero state pages**: onboarding checklist under `/app/home/onboarding`, and empty states for Inventory/Orders/Customers with guided CTAs.

## Component hierarchy (Next.js / React)
- **app/layout.tsx** → loads global providers (Supabase client, theme, query caching), renders `<AppShell>`.
  - `<AppShell>` → header + sidebar + `<AppContent>` slot.
    - `<Header>` → logo, org switcher, search, user menu (profile, sign out).
    - `<Sidebar>` → nav groups (Dashboard, Inventory, Orders, Customers, Settings, Admin) with role-based visibility and collapse state.
    - `<AppContent>` → `<Breadcrumbs>` + `<PageTitle>` + `children`; owns page-level toasts and suspense boundaries.
- **Page templates**:
  - DashboardPage → summary cards, recent orders, activity stream components.
  - InventoryPage → `<InventoryTable>` + filters + `<BulkActions>`.
  - OrdersPage → `<OrderList>` + `<OrderDetailDrawer>`.
  - CustomersPage → `<CustomerList>` + `<CustomerProfilePanel>`.
  - SettingsPage → tabs for Profile, Team, Billing, Integrations.
  - AdminPage → `<UserInvitePanel>`, `<RoleManager>`, audit log list.
- **Auth primitives**: `<AuthGate>` (protect routes), `<SessionProvider>` (Supabase session), `<RoleGuard>` (checks roles/scopes), `<InviteCTA>` (shows pending invites).

## Supabase auth flows
### Email sign-in
1. User enters email on `/login`; frontend calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <app url> } })`.
2. Supabase emails magic link; upon click, session is created and stored in Supabase client.
3. Frontend exchanges session and stores profile/role via `/api/auth/profile` (server pulls from Supabase `auth.users` + `public.profiles`).
4. Redirect to last-intended route (from `redirect_to` param or stored location) or `/app/home`.

### Admin invitation flow
1. Admin opens AdminPage → `<UserInvitePanel>` and submits invite form (email, role, org). Frontend calls backend `POST /api/admin/invitations`.
2. Backend uses service key to call `supabase.auth.admin.inviteUserByEmail(email, { data: { role, orgId }, redirectTo: <app url>/login })`; stores invite row in `public.invites` with status `pending`.
3. Supabase sends email with invite link (magic link token).
4. Recipient clicks link → Supabase creates user + session; frontend detects `invitation_token` and calls `POST /api/auth/accept-invite` with token.
5. Backend validates token with Supabase Admin API, reads invite metadata, assigns role/org membership (upsert into `public.user_roles`), marks invite `accepted`, and returns profile payload.
6. Frontend stores session + role, clears invite token, and routes to onboarding (`/app/home/onboarding`) if first login, else to `/app/home`.

## State/data contracts (frontend ↔ backend)
- **Session fetch**: `GET /api/auth/profile` → returns `{ userId, email, displayName, orgId, roles: string[], featureFlags?: Record<string, boolean> }`.
- **Invite creation**: `POST /api/admin/invitations` body `{ email, role, orgId, inviterId }` → returns `{ inviteId, status: 'pending', email, role, orgId, createdAt }`.
- **Invite acceptance**: `POST /api/auth/accept-invite` body `{ invitationToken }` → returns `{ userId, email, orgId, roles, requiresPassword: boolean }`.
- **Role guard helper**: frontend expects `roles` array + `orgId` to be present in session payload; API must ensure they are consistent with Supabase `auth.users` and `public.user_roles`.
- **Error envelope**: backend errors respond as `{ error: { code, message, hint? } }` with appropriate HTTP status; frontend surfaces `message` and logs `code`/`hint`.
- **Caching**: profile fetch is cached per session with SWR/React Query; mutation endpoints return updated profile to keep cache consistent.
