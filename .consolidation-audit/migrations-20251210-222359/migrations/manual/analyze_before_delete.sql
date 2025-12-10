-- ============================================================================
-- CAREFUL ANALYSIS BEFORE DELETION
-- ============================================================================
-- Step 1: Check row counts for tables we might delete
-- ============================================================================

\echo '=== ANALYZING TABLES BEFORE DELETION ==='
\echo ''

\echo '1. CHECKING ROW COUNTS FOR POTENTIAL DELETIONS'
\echo '------------------------------------------------'

SELECT 'business' as table_name, COUNT(*) as rows FROM business
UNION ALL SELECT 'carts', COUNT(*) FROM carts
UNION ALL SELECT 'cart_items', COUNT(*) FROM cart_items
UNION ALL SELECT 'items', COUNT(*) FROM items
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'ai_conversations', COUNT(*) FROM ai_conversations
UNION ALL SELECT 'ai_messages', COUNT(*) FROM ai_messages
UNION ALL SELECT 'agent_chat_sessions', COUNT(*) FROM agent_chat_sessions
UNION ALL SELECT 'agent_chat_messages', COUNT(*) FROM agent_chat_messages
UNION ALL SELECT 'legacy_customer_profile', COUNT(*) FROM legacy_customer_profile
ORDER BY rows DESC;

\echo ''
\echo '2. CHECKING FOREIGN KEY DEPENDENCIES'
\echo '-------------------------------------'

SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (
        tc.table_name IN ('business', 'carts', 'cart_items', 'items', 'payments',
                          'ai_conversations', 'ai_messages', 'agent_chat_sessions',
                          'agent_chat_messages', 'legacy_customer_profile')
        OR ccu.table_name IN ('business', 'carts', 'cart_items', 'items', 'payments',
                              'ai_conversations', 'ai_messages', 'agent_chat_sessions',
                              'agent_chat_messages', 'legacy_customer_profile')
    )
ORDER BY source_table, references_table;

\echo ''
\echo '3. CHECKING IF TABLES EXIST'
\echo '----------------------------'

SELECT tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('business', 'carts', 'cart_items', 'items', 'payments',
                    'ai_conversations', 'ai_messages', 'agent_chat_sessions',
                    'agent_chat_messages', 'legacy_customer_profile',
                    'bar_number_canonicalization_conflicts', 'whatsapp_home_menu_items')
ORDER BY tablename;

