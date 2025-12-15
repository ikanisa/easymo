# Buy & Sell AI Agent - Gaps Analysis & Fixes

**Date**: 2025-12-15  
**Status**: In Progress

## Priority 1 (Blocking) - Fixes Applied

### ✅ 1. Import BuyAndSellContext
- **Status**: Already fixed - Line 27 imports correctly

### ✅ 2. Button ID Format
- **Status**: Already correct - `BIZ::` is used consistently

### ✅ 3. Table/Column Names
- **Status**: Already correct - Uses `businesses` table and `profile_id` column

### ⏳ 4. Missing userId in notifyUser
- **Issue**: Documentation mentions userId but function uses userPhone directly
- **Fix**: Function is correct, but need to verify all call sites

### ⏳ 5. Business Detail View
- **Issue**: Incomplete implementation
- **Fix**: Need to implement full detail view with management options

### ⏳ 6. Profile Lookup Error Handling
- **Issue**: No error handling in profile lookups
- **Fix**: Add try-catch and proper error handling

### ⏳ 7. Location Validation
- **Issue**: No validation on location data
- **Fix**: Add validation for lat/lng values

### ⏳ 8. Rate Limit Response Typing
- **Issue**: Non-null assertion is risky
- **Fix**: Add proper type checking

### ⏳ 9. AI Model Configuration
- **Issue**: Hardcoded model name
- **Fix**: Make configurable via environment variable

### ⏳ 10. Conversation History
- **Status**: Already capped at MAX_CONVERSATION_HISTORY_SIZE (20)
- **Verification**: Need to verify it's working correctly

### ⏳ 11. Agent Config Fallback
- **Status**: Already has fallback instructions for buy_sell
- **Verification**: Need to verify it's being used correctly

## Priority 2 (High) - To Fix

1. Implement business detail view
2. Add error handling to profile lookups
3. Add location validation
4. Implement vendor messaging (TODOs)
5. Implement geocoding (TODOs)

## Priority 3 (Medium) - To Fix

1. Add observability to all handlers
2. Make AI model configurable
3. Improve error messages

## Database Migrations Needed

1. Create marketplace_conversations table
2. Create marketplace_listings table
3. Create marketplace_matches table
4. Create agent_outreach_sessions table
5. Create agent_vendor_messages table
6. Create agent_user_memory table
7. Create RPC functions

