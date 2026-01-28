# Admin Access Patterns

This document defines how admin users access Moltbot data securely.

---

## Principles

1. **No Direct Table Access**: Admins never query Supabase tables directly
2. **Server Endpoints Only**: All admin data flows through authenticated backend APIs
3. **Role Enforcement**: Every endpoint validates admin role before returning data
4. **Audit Everything**: All admin actions logged to `moltbot_audit_events`

---

## Authentication

### Recommended Flow
1. Admin authenticates via Supabase Auth (JWT) or SSO provider
2. Backend validates JWT and extracts `role` claim
3. Role must be `admin` or `super_admin` for sensitive endpoints
4. Session tracked for audit purposes

### Token Claims
```json
{
  "sub": "admin-user-id",
  "role": "admin",
  "permissions": ["read:conversations", "read:audit", "manage:vendors"]
}
```

---

## Endpoint Patterns

### Read Operations
```typescript
// ✅ Correct: Server endpoint with role check
app.get('/admin/conversations/:id', requireRole('admin'), async (req, res) => {
  const data = await supabase
    .from('moltbot_conversations')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  // Mask PII before returning
  res.json(maskConversation(data));
});
```

### Write Operations
```typescript
// ✅ Correct: Audited admin action
app.post('/admin/vendors/:id/approve', requireRole('admin'), async (req, res) => {
  await writeAuditEvent({
    event_type: 'admin.vendor.approved',
    actor: req.user.id,
    resource_id: req.params.id,
  });
  
  await supabase.from('vendors').update({ status: 'approved' }).eq('id', req.params.id);
  res.json({ success: true });
});
```

---

## Dashboard Guidelines

### DO:
- Fetch data via `/admin/*` endpoints
- Display masked phone numbers by default
- Require confirmation for sensitive actions
- Show audit trail for all admin views

### DON'T:
- Initialize Supabase client in frontend with service role key
- Display raw PII without explicit "reveal" action
- Allow bulk operations without rate limiting
- Skip audit logging for "read" operations on sensitive data

---

## Audit Requirements

All admin actions must log:
- `actor`: Admin user ID
- `action`: What was done
- `resource_type`: Table/entity affected
- `resource_id`: Specific record ID
- `timestamp`: When it happened
- `ip_address`: Request origin (optional)
