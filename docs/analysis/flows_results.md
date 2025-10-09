# Flow Results (pending manual execution)

| Flow                     | Status             | Notes                                                            |
| ------------------------ | ------------------ | ---------------------------------------------------------------- |
| flow.cust.bar_browser.v1 | Needs verification | Validate pagination + list row titles ≤24 chars.                 |
| flow.cust.bar_menu.v1    | Needs verification | Ensure cart flow + MoMo USSD works with sample data.             |
| flow.vend.orders.v1      | Needs verification | Confirm a_mark_paid/a_mark_served update events + notifications. |
| flow.admin.trips.v1      | Needs verification | Match now returns pickup-first results.                          |
| flow.admin.baskets.v1    | Needs verification | Approve/Regen tokens, audit log entries.                         |
| flow.admin.insurance.v1  | Needs verification | Mark reviewed, assign owner requires insurance admin number.     |
| flow.admin.wallet.v1     | Needs verification | Ledger insertion + balance updates.                              |
| flow.admin.momoqr.v1     | Needs verification | QR generation; tel URI dialable.                                 |

Evidence to be captured during QA pass.
