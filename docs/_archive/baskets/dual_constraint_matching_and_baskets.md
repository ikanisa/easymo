# Dual-Constraint Matching & Basket Confirmation

## Matching API

- Endpoint: `POST /api/match/search`
- Request:
  ```json
  {
    "actor_kind": "driver",
    "pickup": { "lat": -1.9445, "lng": 30.0610 },
    "dropoff": { "lat": -1.9490, "lng": 30.0640 },
    "radius_km": 10,
    "limit": 10
  }
  ```
- Response sample:
  ```json
  {
    "candidates": [
      {
        "id": "...",
        "kind": "request",
        "user_id": "...",
        "pickup_distance_km": 1.2,
        "dropoff_distance_km": 0.9,
        "created_at": "2025-10-14T10:00:00Z"
      }
    ]
  }
  ```
- SQL helper: `select * from public.search_live_market_candidates('driver', -1.9445, 30.0610, -1.9490, 30.0640, 10, 10);`
- Refresh MV if needed: `select public.refresh_live_market_mv();`

## Basket Confirmation

- Creation endpoint: `POST /api/baskets/create`
- Response includes `basketId`, `inviteToken`, `deeplink`, `expiresAt`.
- Deep link format: `https://easymo.link/join?t={token}`.
- Deeplink resolver: `GET /api/deeplink/join?t={token}` → returns basket metadata.
- WhatsApp payload preview:
  ```json
  {
    "to": "+2507...",
    "type": "interactive",
    "header": { "type": "text", "text": "Basket created 🎉" },
    "body": {
      "text": "Your basket **Co-op** is live.\nShare this link to invite members:\nhttps://easymo.link/join?t=XYZ123\n\nTap below to open it now."
    },
    "action": {
      "buttons": [ { "type": "url", "url": "https://easymo.link/join?t=XYZ123", "title": "View Basket" } ]
    }
  }
  ```
