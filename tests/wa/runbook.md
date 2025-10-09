# WhatsApp Flow Test Runbook

## Nearby drivers (customer)

1. Send home menu, tap "Nearby Drivers" → choose vehicle.
2. Share location.
3. Expected: list of drivers (≤9) with masked numbers, `MATCHES_RESULT` log > 0.
4. Selecting a row returns WA chat link.

## Schedule trip (passenger)

1. From menu, tap "Schedule Trip" → choose Passenger → vehicle → share location.
2. Expected: v2 matching results list, `MATCHES_RESULT` logged.
3. Tap entry to receive chat link.

## Basket create & join

1. Create basket (flow.vend.onboard) and note join token.
2. New vendor sends `JB:<token>` via QR to confirm join.

## Marketplace add & approve

1. Submit business via flow; admin approves in `flow.admin.marketplace.v1`.
2. Customer `bar_browser` sees approved business.

## Insurance OCR

1. Vendor sends menu PDF via webhook; OCR job enqueued.

## Fuel voucher

1. Insurance admin opens Admin → Vouchers → Issue.
2. Enter client WhatsApp + policy; observe PNG sent to client.
3. Redeem with same code; verify status flips to redeemed and audit +
   notification recorded.

## Notifications

1. Place order in menu flow; verify vendor/customer notifications in
   `notifications` table (status transitions).
2. Run `notification-worker` and confirm statuses `sent`.

## Admin Hub

1. Admin number opens menu → enters PIN → navigates to Trips/Baskets/Wallet.
2. Confirm audit entries in `admin_audit_log` and structured logs
   `ADMIN_ACTION`.
