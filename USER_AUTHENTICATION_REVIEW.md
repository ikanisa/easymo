# User Authentication Deep Review

## Current Issues

1. **Not Using Anonymous Authentication**: Current implementation uses `auth.admin.createUser()` with phone, which creates regular authenticated users, not anonymous users.

2. **Missing Profile Creation**: When a new user is created in `auth.users`, the corresponding profile in `profiles` table is not always created automatically.

3. **WhatsApp Number Not Unique**: The `profiles` table doesn't have a unique constraint on `phone_number` or `wa_id`, which could lead to duplicates.

4. **Error Handling**: The `getOrCreateAuthUserId` function throws errors that aren't properly handled, causing "Failed to resolve auth user id" errors.

## Required Fixes

### 1. Anonymous Authentication
- Create users without password (anonymous)
- Use phone number as the unique identifier
- Mark users as anonymous in metadata

### 2. Automatic Profile Creation
- When a new auth user is created, automatically create a profile
- Use WhatsApp number as unique identifier in profiles table
- Link auth.users.id to profiles.user_id

### 3. Database Schema
- Ensure `profiles.phone_number` has UNIQUE constraint
- Ensure `profiles.wa_id` has UNIQUE constraint (if exists)
- Add proper indexes

### 4. Error Handling
- Better error handling for duplicate phone numbers
- Retry logic for race conditions
- Proper logging

## Implementation Plan

1. Create migration to add unique constraints
2. Update `getOrCreateAuthUserId` to create anonymous users
3. Update `ensureProfile` to automatically create profile when auth user is created
4. Add proper error handling and logging
5. Test with new WhatsApp messages

