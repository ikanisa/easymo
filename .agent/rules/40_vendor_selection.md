# Rule 40 — Vendor Selection Policy

Defines eligibility, ranking, and hard limits for vendor outreach.

---

## Eligibility Filters (all must pass)

1. **Active**: `vendors.is_active = true`
2. **Has WhatsApp**: `vendors.phone IS NOT NULL`
3. **Category match**: Vendor tags contain request category
4. **Distance**: ≤ `location_radius_km` (default 5km, max 15km)
5. **Not blocked**: `vendor_id NOT IN blocked_vendor_ids`
6. **Not already contacted**: No row in `moltbot_vendor_outreach` for this (request_id, vendor_id)

---

## Ranking (deterministic, applied after filtering)

| Priority | Factor | Logic |
|----------|--------|-------|
| 1 | Category match strength | Exact category > partial tag match |
| 2 | Distance | Closer vendors ranked higher |
| 3 | Response SLA | Lower `avg_response_hours` ranked higher |
| 4 | Rating | Higher rating as tiebreaker |

---

## Hard Caps (never exceed)

| Limit | Value | Enforcement |
|-------|-------|-------------|
| `max_vendors_per_request` | 15 | Backend rejects outreach beyond this |
| `batch_size_max` | 5 | No more than 5 vendors messaged per cycle |

---

## Idempotency Key Format

```
request:{request_id}:vendor:{vendor_id}:qset:v1
```

Used to prevent double-messaging the same vendor for the same request.

---

## Geo-Filtering Notes

- If client location is available, use PostGIS `ST_DWithin` for distance
- If no geo index, fallback to bounding-box approximation
- Distances are in kilometers
