# Secure Vendor Search Patterns

## Purpose
Ensure vendor search operations run server-side only and never expose sensitive vendor data to Moltbot or clients prematurely.

## Core Rules

### Rule 1: Server-Side Only
- `search_vendors` tool runs exclusively in backend/edge functions
- Never implement client-side vendor search
- Always use service role client for vendor queries

### Rule 2: Mask Vendor Phone in Planning
- During vendor selection and outreach planning, mask vendor phones
- Moltbot context packs receive `vendor_phone_masked: "***456"` (last 3 digits only)
- Full vendor phone never appears in Moltbot prompts

### Rule 3: Full Phone Only in Final Shortlist
- Only the final shortlist (after client approval) includes full vendor phone
- Full phone is used solely for generating `wa.me` handoff links
- wa.me links are the last step before "handed_off" state

## Implementation Checklist

### Vendor Search Tool
```typescript
// ✅ Correct: Mask phone in search results
function searchVendors(query): VendorSearchResult[] {
  const results = await supabase.from('vendors').select(...);
  return results.map(v => ({
    ...v,
    phone_masked: maskPhone(v.phone),
    phone: undefined, // Remove full phone
  }));
}
```

### Shortlist Generation
```typescript
// ✅ Correct: Full phone only in final shortlist
function generateShortlist(vendorIds): ShortlistItem[] {
  const vendors = await supabase.from('vendors').select('*').in('id', vendorIds);
  return vendors.map(v => ({
    ...v,
    waLink: `https://wa.me/${cleanPhone(v.phone)}`,
  }));
}
```

## Prohibited Patterns

### ❌ Never:
- Return full vendor phone in intermediate tool responses
- Include vendor phone in Moltbot context packs (except final shortlist)
- Allow client-side code to query vendors table directly
- Log full vendor phones (use masking)

## Audit Trail
- All vendor searches logged with `request_id`, masked results, and timestamp
- Shortlist generation logged with final vendor IDs (hashed)
