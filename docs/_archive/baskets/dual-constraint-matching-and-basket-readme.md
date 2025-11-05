# Dual-Constraint Matching & Basket Deeplink Reference

## Matching API

**Endpoint**: `POST /api/match/search`

```json
{
  "actor_kind": "driver",
  "pickup": { "lat": -1.9499, "lng": 30.0588 },
  "dropoff": { "lat": -1.9572, "lng": 30.0871 },
  "radius_km": 10,
  "limit": 20
}
```

### Response

```json
{
  "data": [
    {
      "id": "candidate-1",
      "kind": "offer",
      "pickupDistanceKm": 3.2,
      "dropoffDistanceKm": 4.1,
      "createdAt": "2025-10-10T09:30:00Z"
    }
  ],
  "meta": {
    "radiusKm": 10,
    "hasDropoff": true,
    "dualConstraintApplied": true
  }
}
```

If `dropoff` is omitted the handler falls back to pickup-only radius filtering, mirroring legacy behaviour.

## Basket Creation Flow

1. `POST /api/baskets/create`
2. Receive `basketId`, `deeplink`, and token metadata
3. WhatsApp confirmation is dispatched (feature-flagged) with interactive **View Basket** button

### Deeplink Format

```
https://easymo.link/join?t={token}
```

### Deeplink Resolver

`GET /api/deeplink/join?t={token}` returns basket metadata or `410 Gone` when the token is expired/used.

## Observability Events

- `match_query_executed`
- `match_search_failed`
- `basket_create_success`
- `basket_invite_token_issued`
- `basket_confirmation_whatsapp_failed`
- `wa_message_sent`

## Feature Flags

- `dualConstraintMatching.enabled` — toggles the drop-off radius constraint while keeping pickup-only matching online when disabled.
- `basket.confirmation.enabled` — controls whether WhatsApp confirmations are dispatched after invite token creation.
