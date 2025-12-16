# Supabase Edge Functions Deployment Checklist

**Last Updated:** 2025-12-16  
**Purpose:** Ensure all security and configuration requirements are met before deploying

---

## Pre-Deployment Checklist

### ✅ Security Configuration

#### JWT Verification Setting
- [ ] **Verify JWT with legacy secret: OFF**
  - **Requirement:** JWT verification should be **DISABLED** in Supabase function settings
  - **Reason:** Authorization logic is implemented inside function code
  - **Location:** Supabase Dashboard → Edge Functions → Function Settings → Security
  - **Note:** The easy-to-obtain anon key can satisfy JWT requirement, but we handle auth internally

#### Function Authorization
- [ ] All functions implement internal authorization logic
- [ ] WhatsApp signature verification is implemented
- [ ] Internal forward tokens are validated
- [ ] Service role key is used for internal operations only

---

### ✅ Code Quality Checks

#### Syntax & Imports
- [ ] No duplicate imports
- [ ] All import paths are correct (relative paths verified)
- [ ] No TypeScript errors (check with `deno check`)

#### JSON Files
- [ ] All JSON files are valid (no trailing commas, proper syntax)
- [ ] i18n message files validated
- [ ] Run: `python3 -m json.tool <file.json>` for each JSON file

#### Database Constraints
- [ ] All required fields have fallback values
- [ ] No null values for NOT NULL columns
- [ ] Phone numbers always have a value (use "unknown" as fallback if needed)

---

### ✅ Function-Specific Checks

#### wa-webhook-core
- [ ] JSON syntax validated (especially fr.json)
- [ ] All imports resolve correctly
- [ ] Internal forward mechanism working

#### wa-webhook-mobility
- [ ] No duplicate imports (especially `sendText`)
- [ ] Import paths correct (use `../../_shared` not `../_shared`)
- [ ] Internal forward import path correct

#### wa-webhook-buy-sell
- [ ] Phone number fallback implemented in message deduplicator
- [ ] i18n welcome messages working
- [ ] No null phone_number in wa_events table

#### wa-webhook-profile
- [ ] JSON syntax validated
- [ ] Cache configuration correct
- [ ] Metrics recording working

---

### ✅ Environment Variables

- [ ] `SUPABASE_URL` configured
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] `WA_APP_SECRET` configured
- [ ] `WA_TOKEN` configured
- [ ] `WA_PHONE_ID` configured
- [ ] `WA_VERIFY_TOKEN` configured
- [ ] `WA_ALLOW_UNSIGNED_WEBHOOKS` set appropriately (false in production)
- [ ] `WA_ALLOW_INTERNAL_FORWARD` set appropriately

---

### ✅ Database Migrations

- [ ] All migrations applied (`supabase db push`)
- [ ] No migration errors
- [ ] Indexes created successfully
- [ ] RLS policies in place

---

## Deployment Steps

### 1. Pre-Deployment Verification

```bash
# Validate JSON files
for file in supabase/functions/_shared/wa-webhook-shared/i18n/messages/*.json; do
  python3 -m json.tool "$file" > /dev/null && echo "✅ $(basename $file)" || echo "❌ $(basename $file)"
done

# Check for duplicate imports
grep -r "^import.*sendText" supabase/functions/wa-webhook-mobility/

# Verify import paths
grep -r "\.\.\/_shared" supabase/functions/wa-webhook-mobility/ | grep -v "\.\.\/\.\.\/_shared"
```

### 2. Deploy Functions

```bash
# Deploy all webhook functions
supabase functions deploy wa-webhook-core
supabase functions deploy wa-webhook-mobility
supabase functions deploy wa-webhook-buy-sell
supabase functions deploy wa-webhook-profile
```

### 3. Post-Deployment Verification

- [ ] Check Supabase Dashboard for deployment success
- [ ] Verify function versions incremented
- [ ] Check logs for boot errors
- [ ] Test function endpoints
- [ ] Verify metrics are recording

---

## Security Best Practices

### JWT Verification (IMPORTANT)

**Setting:** Verify JWT with legacy secret → **OFF**

**Why:**
- Authorization is handled inside function code
- WhatsApp webhooks use signature verification, not JWT
- Internal forwards use token-based validation
- Service role operations are internal only

**Implementation:**
- Functions verify WhatsApp signatures using `WA_APP_SECRET`
- Internal forwards validated with `x-wa-internal-forward-token`
- Service role key used for database operations
- No reliance on Supabase's JWT verification

### Authorization Flow

1. **WhatsApp Webhooks:**
   - Verify signature using `WA_APP_SECRET`
   - Check for internal forward token if applicable
   - Process request if valid

2. **Internal Forwards:**
   - Validate `x-wa-internal-forward-token` header
   - Check `WA_ALLOW_INTERNAL_FORWARD` setting
   - Use service role key for authorization

3. **Service Operations:**
   - Use `SUPABASE_SERVICE_ROLE_KEY` for database access
   - No JWT required for internal operations

---

## Common Issues & Solutions

### Issue: JSON Syntax Error
**Solution:** Remove trailing commas, validate with `python3 -m json.tool`

### Issue: Module Not Found
**Solution:** Check import paths (use `../../_shared` from function directories)

### Issue: Duplicate Import
**Solution:** Remove duplicate import statements

### Issue: Database Constraint Violation
**Solution:** Add fallback values for required fields (e.g., `phone_number || "unknown"`)

### Issue: JWT Verification Required
**Solution:** Disable JWT verification in Supabase Dashboard, rely on internal auth

---

## Monitoring After Deployment

- [ ] Check function logs for errors
- [ ] Monitor metrics dashboard
- [ ] Verify webhook processing
- [ ] Check database operations
- [ ] Review error rates

---

## Rollback Procedure

If deployment fails:

1. Check Supabase Dashboard for error details
2. Review function logs
3. Fix issues in code
4. Redeploy specific function
5. Verify fix in logs

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-16  
**Maintained By:** Development Team

