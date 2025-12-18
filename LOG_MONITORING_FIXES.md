# Log Monitoring and Fixes

## Issues Identified from Supabase Logs

### 1. **404 Errors for Non-Existent Functions**
- **Issue**: `wa-webhook-buy-sell` was referenced in route config but doesn't exist (consolidated into `notify-buyers`)
- **Issue**: `search-alert-notifier` was being called but doesn't exist (deleted in consolidation)
- **Issue**: `wa-webhook-wallet` was referenced but doesn't exist (wallet functionality is in `wa-webhook-profile`)

### 2. **500 Errors in wa-webhook-core and wa-webhook-profile**
- Multiple 500 errors observed in logs
- Errors likely from routing to non-existent services or unhandled exceptions

### 3. **503 Errors**
- Some 503 errors observed, which are expected when circuit breakers are open

## Fixes Applied

### 1. Route Configuration Fixes (`supabase/functions/_shared/route-config.ts`)

#### Removed Duplicate `wa-webhook-buy-sell` Reference
- **Before**: `STATE_PATTERNS` had duplicate entries - one pointing to `wa-webhook-buy-sell` and one to `notify-buyers`
- **After**: Removed the duplicate entry pointing to `wa-webhook-buy-sell`
- **Impact**: Prevents 404 errors when routing buy/sell requests

#### Fixed Wallet Service Routing
- **Before**: Wallet routes pointed to non-existent `wa-webhook-wallet` service
- **After**: Updated to point to `wa-webhook-profile` where wallet functionality actually exists
- **Changes**:
  - Updated `ROUTE_CONFIGS` to use `wa-webhook-profile` for wallet keywords
  - Updated `STATE_PATTERNS` to use `wa-webhook-profile` for wallet state patterns
  - Removed `wa-webhook-wallet` from `ROUTED_SERVICES` array
- **Impact**: Prevents 404 errors when routing wallet-related requests

### 2. Enhanced Error Handling (`supabase/functions/wa-webhook-core/router.ts`)

#### Improved Error Logging
- Added more detailed error information:
  - Error name (constructor name)
  - Error stack trace (truncated to 500 chars)
  - Target URL that failed
- **Impact**: Better debugging information for 500 errors

#### Better Error Response
- Changed error response from generic 500 to 503 (Service Unavailable)
- Added `Retry-After` header (60 seconds)
- Added error details in response body
- **Impact**: More appropriate HTTP status code for temporary service failures

#### DLQ Error Handling
- Added try-catch around DLQ storage to prevent DLQ errors from masking original errors
- **Impact**: Original errors are properly logged even if DLQ storage fails

## Expected Outcomes

1. **Reduced 404 Errors**: 
   - No more 404s for `wa-webhook-buy-sell` (routes to `notify-buyers`)
   - No more 404s for `wa-webhook-wallet` (routes to `wa-webhook-profile`)

2. **Better Error Visibility**:
   - More detailed error logs will help identify root causes of remaining 500 errors
   - Errors properly classified and logged with context

3. **Improved Resilience**:
   - 503 responses with retry-after headers allow clients to retry appropriately
   - Circuit breakers will prevent cascading failures

## Next Steps

1. **Deploy Changes**: Deploy the updated route-config.ts and router.ts
2. **Monitor Logs**: Check Supabase logs after deployment to verify:
   - 404 errors for `wa-webhook-buy-sell` and `wa-webhook-wallet` are gone
   - 500 errors are reduced or have better error context
3. **Investigate Remaining 500 Errors**: Use the enhanced error logging to identify root causes of any remaining 500 errors
4. **Check search-alert-notifier**: Investigate what is calling `search-alert-notifier` and update those callers

## Notes

- The `search-alert-notifier` 404 errors are likely from external systems or scheduled jobs that haven't been updated yet
- These will need to be identified and updated separately
- The wallet functionality consolidation (from separate service to profile service) is intentional and matches the current architecture

