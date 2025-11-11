-- Seed data for Phase A legacy features
-- Run with `supabase db remote commit` or in SQL editor after applying migrations.
BEGIN;

-- Profiles & wallet
INSERT INTO public.profiles (whatsapp_e164, display_name)
VALUES
  ('+250788000001', 'Fixture Rider'),
  ('+250788000002', 'Fixture Vendor')
ON CONFLICT (whatsapp_e164) DO NOTHING;

INSERT INTO public.wallet_accounts (profile_id, balance_minor, pending_minor, currency, tokens)
SELECT user_id, 250000, 0, 'RWF', 120 FROM public.profiles WHERE whatsapp_e164 = '+250788000001'
ON CONFLICT (profile_id) DO UPDATE SET balance_minor = EXCLUDED.balance_minor, tokens = EXCLUDED.tokens;

INSERT INTO public.wallet_transactions (profile_id, amount_minor, currency, direction, description)
SELECT user_id, 15000, 'RWF', 'credit', 'Referral bonus' FROM public.profiles WHERE whatsapp_e164 = '+250788000001'
UNION ALL
SELECT user_id, 5000, 'RWF', 'debit', 'Token redeem' FROM public.profiles WHERE whatsapp_e164 = '+250788000001';

INSERT INTO public.wallet_earn_actions (id, title, description, reward_tokens, referral_code, share_text)
VALUES
  (gen_random_uuid(), 'Share referral', 'Invite a friend and earn', 10, 'REF123', 'Join easyMO today!')
ON CONFLICT DO NOTHING;

INSERT INTO public.wallet_promoters (display_name, whatsapp, tokens)
VALUES ('Alpha Promoter', '+250788000010', 150)
ON CONFLICT DO NOTHING;

-- Marketplace example
INSERT INTO public.businesses (owner_whatsapp, name, description, lat, lng, location_text)
VALUES ('+250788000002', 'Seed Bistro', 'Demo marketplace entry', -1.9501, 30.0588, 'Kigali City Tower')
ON CONFLICT DO NOTHING;

COMMIT;
