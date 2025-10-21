# Flow Binding Instructions

For each WhatsApp Flow below, set the Data Channel URI to the deployed
`/flow/exchange` endpoint (e.g.
`https://<project>.supabase.co/functions/v1/flow-exchange`).

1. `flow.cust.bar_browser.v1`
2. `flow.cust.bar_menu.v1`
3. `flow.cust.order_tracker.v1`
4. `flow.vend.onboard.v1`
5. `flow.vend.menu_review.v1`
6. `flow.vend.orders.v1`
7. `flow.vend.staff.v1`
8. `flow.vend.settings.v1`
9. `flow.admin.hub.v1` and the related admin flows (`trips`, `baskets`,
   `insurance`, `marketplace`, `wallet`, `momoqr`, `vouchers`, `promoters`,
   `broadcast`, `templates`, `referrals`, `freeze`, `diag`, `alerts`,
   `settings`).

## Steps (Meta Flow Builder)

Latest JSON versions ready for upload:

| Flow                         | Version |
| ---------------------------- | ------- |
| `flow.cust.bar_browser.v1`   | 6.4     |
| `flow.cust.bar_menu.v1`      | 6.5     |
| `flow.cust.order_tracker.v1` | 6.4     |
| `flow.vend.onboard.v1`       | 6.4     |
| `flow.vend.menu_review.v1`   | 6.4     |
| `flow.vend.orders.v1`        | 6.4     |
| `flow.vend.staff.v1`         | 6.3     |
| `flow.vend.settings.v1`      | 6.3     |

1. Open [WhatsApp Manager](https://business.facebook.com/latest/wa/manage/flows)
   and select the target flow.
2. Paste the JSON from `supabase/functions/wa-webhook/flows/json/<flow_id>.json`
   (matching the version above), validate, and publish.
3. Go to **Settings → Data channel URI** and enter the `/flow/exchange` URL.
4. Repeat for each flow.

## Verification Checklist

- Trigger the flow from WhatsApp and confirm `/flow/exchange` logs
  `FLOW_EXCHANGE_REQUEST/RESPONSE` with the expected `action_id`.
- Admin flows should prompt for PIN if required before returning data.
- Customer/vendor flows must display list rows (≤24 characters) and respect
  button limits (≤3) per design.
