# Buy & Sell Pagination - Quick Reference

## User Experience

### Initial Search
```
User: Selects category → Shares location
Bot: Shows 9 businesses + [Show More] [New Search]
```

### Load More
```
User: Taps "Show More"
Bot: Shows next 9 businesses
```

### End of Results
```
Bot: ✅ That's all X businesses in this area!
```

## Button IDs
- `buy_sell_show_more` - Load next 9 businesses
- `buy_sell_new_search` - Clear state and restart

## State Keys
- `buy_sell_location_request` - Waiting for location
- `buy_sell_results` - Has results, can paginate
- `home` - No active search

## Files Modified
1. `handle_category.ts` - Fetch 19, show 9, save state
2. `handle_pagination.ts` - NEW - Handle "Show More" / "New Search"
3. `index.ts` - Route button clicks to pagination handler

## Database
- Function: `search_businesses_nearby()`
- Max limit: 100 results (capped for performance)

## Log Events
- `BUY_SELL_RESULTS_SENT_WITH_MORE` - Initial results with more available
- `BUY_SELL_SHOW_MORE_REQUESTED` - User clicked "Show More"
- `BUY_SELL_MORE_RESULTS_SENT` - Next batch sent
- `BUY_SELL_ALL_RESULTS_SHOWN` - Reached end
- `BUY_SELL_NEW_SEARCH_REQUESTED` - User wants new search

## Deployment
```bash
supabase functions deploy wa-webhook-buy-sell --project-ref lhbowpbcpwoiparwnwgt
```

## Status
✅ LIVE - v86 (2025-12-08 10:15 UTC)

## Docs
- Full Guide: `BUY_SELL_PAGINATION_DEPLOYMENT.md`
