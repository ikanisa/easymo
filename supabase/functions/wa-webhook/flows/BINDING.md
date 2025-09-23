# WhatsApp Flow Binding Instructions

For each Flow below, set the Data Channel URI to the deployed `flows/exchange` Edge Function URL (e.g. `https://<project>.functions.supabase.co/flow-exchange`).

1. `flow.cust.bar_browser.v1`
2. `flow.cust.bar_menu.v1`
3. `flow.cust.order_tracker.v1`
4. `flow.vend.onboard.v1`
5. `flow.vend.menu_review.v1`
6. `flow.vend.orders.v1`
7. `flow.vend.staff.v1`
8. `flow.vend.settings.v1`

Meta UI steps:
1. WhatsApp Manager → Flows → select the flow.
2. Paste the matching JSON from `flows/json/` into the editor, validate, save, publish.
3. Flow settings (gear icon) → Data channel URI → enter the exchange endpoint → Save.
4. Repeat for all flow IDs.

After binding, use a template with a Flow button or an in-session interactive flow message to launch each flow and verify the exchange requests hit the new handler.
