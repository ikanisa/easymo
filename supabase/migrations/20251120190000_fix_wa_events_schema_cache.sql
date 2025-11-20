-- Reload schema cache to fix "Could not find the 'wa_message_id' column" error
-- This is necessary because the column name changed from wa_message_id to message_id
-- and PostgREST might still be holding onto the old schema definition.

NOTIFY pgrst, 'reload schema';
