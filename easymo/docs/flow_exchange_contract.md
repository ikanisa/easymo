# Flow Exchange Contract

## Request envelope

```json
{
  "flow_id": "flow.cust.bar_browser.v1",
  "screen_id": "s_find_bar",
  "action_id": "a_show_results",
  "wa_id": "+2507...",
  "session_id": "string",
  "page_token": "optional",
  "filters": {},
  "fields": {},
  "context": {}
}
```

## Response envelope

```json
{
  "next_screen_id": "s_bar_results",
  "data": { ... },
  "page_token_next": "optional",
  "messages": [ { "level": "info", "text": "..." } ],
  "field_errors": { "field": "message" }
}
```

## Action matrix (excerpt)

| Flow                     | Action            | Handler                  |
| ------------------------ | ----------------- | ------------------------ |
| flow.cust.bar_browser.v1 | a_show_results    | handleCustomerBarBrowser |
| flow.admin.trips.v1      | a_admin_match_now | handleAdminTrips         |
