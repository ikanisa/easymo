# RPC Audit

## Matching

- `match_drivers_for_trip_v2`, `match_passengers_for_trip_v2`
  (20251005132000 + 20251005133500)
  - Inputs: `_trip_id uuid`, `_limit`, `_prefer_dropoff`, `_radius_m`,
    `_window_days`.
  - Outputs: `trip_id`, `creator_user_id`, `whatsapp_e164`, `ref_code`,
    `distance_km`, `drop_bonus_m`, `created_at`.
  - Orders by pickup distance, optional dropoff distance when `_prefer_dropoff`.

## Wallet

- `wallet_apply_delta(_user_id uuid, _delta int)` ensures upsert + balance
  update.

## Legacy RPCs

- `recent_drivers_near`, `recent_passenger_trips_near`, `gate_pro_feature` kept
  for compatibility but not used by new flows.
- Future work: add admin diagnostic RPCs for match counts if necessary.
