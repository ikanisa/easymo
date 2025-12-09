-- Seed data for multi-tenant organizations, SACCOs, MFIs, groups and members
-- This seed creates a sample organizational hierarchy for testing

-- Clean up existing seed data (idempotent)
DELETE FROM public.loan_application_status_history WHERE application_id IN (
  SELECT id FROM public.loan_applications WHERE partner_reference LIKE 'SEED-%' OR applicant_name LIKE 'Seed%'
);
DELETE FROM public.loan_applications WHERE partner_reference LIKE 'SEED-%' OR applicant_name LIKE 'Seed%';
DELETE FROM public.loan_products WHERE name LIKE 'Seed%';
DELETE FROM public.transactions WHERE ref LIKE 'SEED-%';
DELETE FROM public.merchants WHERE display_name LIKE 'Seed%';
DELETE FROM public.group_members WHERE group_id IN (
  SELECT id FROM public.groups WHERE name LIKE 'Seed%'
);
DELETE FROM public.groups WHERE name LIKE 'Seed%';
DELETE FROM public.org_memberships WHERE org_id IN (
  SELECT id FROM public.organizations WHERE name LIKE 'Seed%'
);
DELETE FROM app.members WHERE sacco_id IN (
  SELECT id FROM app.saccos WHERE name LIKE 'Seed%'
);
DELETE FROM app.ikimina WHERE sacco_id IN (
  SELECT id FROM app.saccos WHERE name LIKE 'Seed%'
);
DELETE FROM app.saccos WHERE name LIKE 'Seed%';
DELETE FROM public.organizations WHERE name LIKE 'Seed%';

-- 1. Create District Organization
INSERT INTO public.organizations (id, type, name, district_code, parent_id)
VALUES 
  ('10000000-0000-0000-0000-000000000001', 'DISTRICT', 'Seed District - Gasabo', 'GASABO', NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  district_code = EXCLUDED.district_code;

-- 2. Create SACCO Organizations (children of district)
INSERT INTO public.organizations (id, type, name, district_code, parent_id)
VALUES 
  ('20000000-0000-0000-0000-000000000001', 'SACCO', 'Seed SACCO Alpha', NULL, '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'SACCO', 'Seed SACCO Beta', NULL, '10000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id;

-- 3. Create MFI Organization (child of district)
INSERT INTO public.organizations (id, type, name, district_code, parent_id)
VALUES 
  ('30000000-0000-0000-0000-000000000001', 'MFI', 'Seed MFI Capital', NULL, '10000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id;

-- 4. Create SACCO records linked to organizations
INSERT INTO app.saccos (id, name, district, sector_code, merchant_code, org_id, status)
VALUES 
  ('40000000-0000-0000-0000-000000000001', 'Seed SACCO Alpha', 'Gasabo', 'S001', 'MC-ALPHA', '20000000-0000-0000-0000-000000000001', 'ACTIVE'),
  ('40000000-0000-0000-0000-000000000002', 'Seed SACCO Beta', 'Gasabo', 'S002', 'MC-BETA', '20000000-0000-0000-0000-000000000002', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  org_id = EXCLUDED.org_id;

-- 5. Create sample Ikimina (groups) for each SACCO
INSERT INTO app.ikimina (id, sacco_id, code, name, type, org_id, status)
VALUES 
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'IK-ALPHA-01', 'Seed Alpha Savings Group 1', 'ASCA', '20000000-0000-0000-0000-000000000001', 'ACTIVE'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'IK-ALPHA-02', 'Seed Alpha Investment Group', 'ROSCA', '20000000-0000-0000-0000-000000000001', 'ACTIVE'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'IK-BETA-01', 'Seed Beta Community Group', 'ASCA', '20000000-0000-0000-0000-000000000002', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sacco_id = EXCLUDED.sacco_id,
  org_id = EXCLUDED.org_id;

-- 6. Create sample members
INSERT INTO app.members (id, ikimina_id, sacco_id, member_code, full_name, msisdn, org_id, status)
VALUES
  -- Members in SACCO Alpha, Group 1
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'MA-001', 'Seed Member Alice Mukamana', '250788111001', '20000000-0000-0000-0000-000000000001', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'MA-002', 'Seed Member Bob Ntwari', '250788111002', '20000000-0000-0000-0000-000000000001', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'MA-003', 'Seed Member Claire Uwase', '250788111003', '20000000-0000-0000-0000-000000000001', 'ACTIVE'),
  
  -- Members in SACCO Alpha, Group 2
  ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'MA-004', 'Seed Member David Habimana', '250788111004', '20000000-0000-0000-0000-000000000001', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'MA-005', 'Seed Member Eva Ingabire', '250788111005', '20000000-0000-0000-0000-000000000001', 'ACTIVE'),
  
  -- Members in SACCO Beta, Group 1
  ('60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'MB-001', 'Seed Member Frank Mugisha', '250788222001', '20000000-0000-0000-0000-000000000002', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'MB-002', 'Seed Member Grace Umutoni', '250788222002', '20000000-0000-0000-0000-000000000002', 'ACTIVE'),
  ('60000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'MB-003', 'Seed Member Henry Kalisa', '250788222003', '20000000-0000-0000-0000-000000000002', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  org_id = EXCLUDED.org_id;

-- 6b. Create digital-first groups for staff testing
INSERT INTO public.groups (id, code, name, org_id, status, country_id)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'GRP-ALPHA-CORE', 'Seed Atlas Alpha Core', '20000000-0000-0000-0000-000000000001', 'ACTIVE', NULL),
  ('80000000-0000-0000-0000-000000000002', 'GRP-ALPHA-EXP', 'Seed Atlas Alpha Expansion', '20000000-0000-0000-0000-000000000001', 'ACTIVE', NULL),
  ('80000000-0000-0000-0000-000000000003', 'GRP-BETA-TRADERS', 'Seed Atlas Beta Traders', '20000000-0000-0000-0000-000000000002', 'ACTIVE', NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  org_id = EXCLUDED.org_id,
  status = EXCLUDED.status;

INSERT INTO public.group_members (id, group_id, member_code, member_name, status, country_id)
VALUES
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'GM-ALPHA-001', 'Seed Member Alice Mukamana', 'ACTIVE', NULL),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'GM-ALPHA-002', 'Seed Member Bob Ntwari', 'ACTIVE', NULL),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', 'GM-ALPHA-003', 'Seed Member Claire Uwase', 'ACTIVE', NULL),
  ('81000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', 'GM-ALPHA-004', 'Seed Member David Habimana', 'ACTIVE', NULL),
  ('81000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000002', 'GM-ALPHA-005', 'Seed Member Eva Ingabire', 'ACTIVE', NULL),
  ('81000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000003', 'GM-BETA-001', 'Seed Member Frank Mugisha', 'ACTIVE', NULL),
  ('81000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000003', 'GM-BETA-002', 'Seed Member Grace Umutoni', 'ACTIVE', NULL),
  ('81000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000003', 'GM-BETA-003', 'Seed Member Henry Kalisa', 'ACTIVE', NULL)
ON CONFLICT (id) DO UPDATE SET
  member_name = EXCLUDED.member_name,
  group_id = EXCLUDED.group_id,
  status = EXCLUDED.status;

-- 7. Create test users for different roles
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES 
  -- System Admin
  ('70000000-0000-0000-0000-000000000001', 'seed.admin@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(), 
   '{"role": "SYSTEM_ADMIN"}'::jsonb, '{"name": "Seed System Admin"}'::jsonb, now(), now()),
  
  -- District Manager
  ('70000000-0000-0000-0000-000000000002', 'seed.district@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "DISTRICT_MANAGER"}'::jsonb, '{"name": "Seed District Manager"}'::jsonb, now(), now()),
  
  -- SACCO Alpha Manager
  ('70000000-0000-0000-0000-000000000003', 'seed.sacco.alpha.manager@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "SACCO_MANAGER"}'::jsonb, '{"name": "Seed SACCO Alpha Manager"}'::jsonb, now(), now()),
  
  -- SACCO Alpha Staff
  ('70000000-0000-0000-0000-000000000004', 'seed.sacco.alpha.staff@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "SACCO_STAFF"}'::jsonb, '{"name": "Seed SACCO Alpha Staff"}'::jsonb, now(), now()),
  
  -- SACCO Beta Manager
  ('70000000-0000-0000-0000-000000000005', 'seed.sacco.beta.manager@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "SACCO_MANAGER"}'::jsonb, '{"name": "Seed SACCO Beta Manager"}'::jsonb, now(), now()),
  
  -- MFI Manager
  ('70000000-0000-0000-0000-000000000006', 'seed.mfi.manager@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "MFI_MANAGER"}'::jsonb, '{"name": "Seed MFI Manager"}'::jsonb, now(), now()),
  
  -- MFI Staff
  ('70000000-0000-0000-0000-000000000007', 'seed.mfi.staff@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "MFI_STAFF"}'::jsonb, '{"name": "Seed MFI Staff"}'::jsonb, now(), now()),

  -- Client testers for loan applications
  ('71000000-0000-0000-0000-000000000001', 'seed.client.alpha.one@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "MEMBER"}'::jsonb, '{"name": "Seed Alpha Client One"}'::jsonb, now(), now()),
  ('71000000-0000-0000-0000-000000000002', 'seed.client.alpha.two@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "MEMBER"}'::jsonb, '{"name": "Seed Alpha Client Two"}'::jsonb, now(), now()),
  ('71000000-0000-0000-0000-000000000003', 'seed.client.beta.one@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "MEMBER"}'::jsonb, '{"name": "Seed Beta Client One"}'::jsonb, now(), now()),

  -- Merchant tester for TapMoMo flows
  ('71000000-0000-0000-0000-000000000004', 'seed.merchant.tapmomo@test.ibimina.rw', crypt('password123', gen_salt('bf')), now(),
   '{"role": "MERCHANT"}'::jsonb, '{"name": "Seed TapMoMo Merchant"}'::jsonb, now(), now())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- 8. Create organization memberships
INSERT INTO public.org_memberships (user_id, org_id, role)
VALUES 
  -- System Admin - no org membership needed (admin bypass)
  
  -- District Manager - member of district
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'DISTRICT_MANAGER'),
  
  -- SACCO Alpha Manager and Staff
  ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'SACCO_MANAGER'),
  ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'SACCO_STAFF'),
  
  -- SACCO Beta Manager
  ('70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'SACCO_MANAGER'),
  
  -- MFI Manager and Staff
  ('70000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', 'MFI_MANAGER'),
  ('70000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', 'MFI_STAFF')
ON CONFLICT (user_id, org_id) DO UPDATE SET
  role = EXCLUDED.role;

-- 9. Create user profiles for app.user_profiles (backwards compatibility)
INSERT INTO app.user_profiles (user_id, role, sacco_id)
VALUES
  ('70000000-0000-0000-0000-000000000001', 'SYSTEM_ADMIN', NULL),
  ('70000000-0000-0000-0000-000000000002', 'DISTRICT_MANAGER', NULL),
  ('70000000-0000-0000-0000-000000000003', 'SACCO_MANAGER', '40000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000004', 'SACCO_STAFF', '40000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000005', 'SACCO_MANAGER', '40000000-0000-0000-0000-000000000002'),
  ('70000000-0000-0000-0000-000000000006', 'MFI_MANAGER', NULL),
  ('70000000-0000-0000-0000-000000000007', 'MFI_STAFF', NULL),
  ('71000000-0000-0000-0000-000000000001', 'MEMBER', '40000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002', 'MEMBER', '40000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000003', 'MEMBER', '40000000-0000-0000-0000-000000000002'),
  ('71000000-0000-0000-0000-000000000004', 'MERCHANT', NULL)
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  sacco_id = EXCLUDED.sacco_id;

-- 10. Seed TapMoMo merchants for mobile money testing
INSERT INTO public.merchants (id, user_id, display_name, network, merchant_code, secret_key)
VALUES
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004', 'Seed TapMoMo Alpha Merchant', 'MTN', 'MC-SEED-ALPHA', decode('73656564616c7068616b657931323334', 'hex')),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000004', 'Seed TapMoMo Beta Merchant', 'Airtel', 'MC-SEED-BETA', decode('73656564626574616b657931323334', 'hex'))
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  merchant_code = EXCLUDED.merchant_code,
  network = EXCLUDED.network;

INSERT INTO public.transactions (id, merchant_id, nonce, amount, currency, ref, created_at, status, payer_hint, notes)
VALUES
  ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000101', 15000, 'RWF', 'SEED-TXN-0001', now() - interval '2 days', 'settled', '250788111001', 'Weekly savings payment for Alpha Core'),
  ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000102', 25000, 'RWF', 'SEED-TXN-0002', now() - interval '1 day', 'pending', '250788111002', 'Investment top-up for Alpha Expansion'),
  ('73000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000103', 10000, 'RWF', 'SEED-TXN-0003', now() - interval '3 days', 'failed', '250788222001', 'Beta Traders contribution retry')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;

-- 11. Seed loan products and loan applications
INSERT INTO public.loan_products (id, org_id, name, description, partner_name, partner_logo_url, min_amount, max_amount,
  min_tenor_months, max_tenor_months, interest_rate, interest_rate_description, required_documents, eligibility_criteria,
  terms_url, enabled, display_order)
VALUES
  ('74000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Seed Alpha Working Capital Loan',
   'Short-term liquidity for Alpha SACCO groups', 'Seed SACCO Alpha', NULL, 100000, 5000000, 3, 12, 12.50,
   '12.5% APR - reducing balance', ARRAY['NID', 'Group resolution'], 'Groups with 6+ months contribution history',
   'https://docs.ibimina.rw/alpha-working-capital', true, 1),
  ('74000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Seed Alpha Asset Purchase Loan',
   'Equipment financing with flexible tenor', 'Seed SACCO Alpha', NULL, 500000, 15000000, 6, 24, 15.00,
   '15% APR - flat rate', ARRAY['NID', 'Business plan', 'Collateral photo'], 'Businesses with positive cash flow',
   'https://docs.ibimina.rw/alpha-asset', true, 2),
  ('74000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Seed Beta Trade Booster Loan',
   'Inventory financing for Beta Traders', 'Seed SACCO Beta', NULL, 200000, 8000000, 4, 18, 13.75,
   '13.75% APR - reducing balance', ARRAY['NID', 'Market license'], 'Active traders in Beta groups',
   'https://docs.ibimina.rw/beta-trade', true, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled;

INSERT INTO public.loan_applications (
  id, org_id, group_member_id, user_id, product_id, requested_amount, tenor_months, purpose, applicant_name,
  applicant_phone, applicant_email, applicant_nid, documents, status, status_updated_at, affordability_score,
  credit_check_result, partner_reference, partner_callback_url, partner_notes, reviewed_by, reviewed_at, approval_notes,
  decline_reason, disbursed_amount, disbursed_at, disbursement_reference, created_at, updated_at
)
VALUES
  ('75000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001',
   '71000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 1500000, 9, 'Purchase irrigation pump for Alpha Core',
   'Seed Member Alice Mukamana', '250788111001', 'seed.client.alpha.one@test.ibimina.rw', '1199770065432111',
   jsonb_build_array(jsonb_build_object('type', 'NID', 'url', 'https://cdn.ibimina.rw/docs/alice-nid.pdf', 'uploaded_at', now() - interval '3 days')),
   'UNDER_REVIEW', now() - interval '1 day', 0.72, '{"scorecard":"standard","risk":"low"}'::jsonb,
   'SEED-LOAN-ALPHA-001', NULL, 'Awaiting collateral verification', '70000000-0000-0000-0000-000000000003', now() - interval '1 day',
   'Group collateral verified', NULL, NULL, NULL, NULL, now() - interval '4 days', now() - interval '1 day'),
  ('75000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000004',
   '71000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', 6000000, 18, 'Purchase milling machine',
   'Seed Member David Habimana', '250788111004', 'seed.client.alpha.two@test.ibimina.rw', '1199770099991111',
   jsonb_build_array(jsonb_build_object('type', 'Business Plan', 'url', 'https://cdn.ibimina.rw/docs/david-plan.pdf', 'uploaded_at', now() - interval '7 days')),
   'APPROVED', now() - interval '12 hours', 0.64, '{"scorecard":"asset","risk":"medium"}'::jsonb,
   'SEED-LOAN-ALPHA-002', NULL, 'Ready for disbursement', '70000000-0000-0000-0000-000000000003', now() - interval '2 days',
   'Approved with guarantor support', NULL, 5800000, now() - interval '6 hours', 'DISB-ALPHA-002', now() - interval '5 days', now() - interval '6 hours'),
  ('75000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000006',
   '71000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000003', 1200000, 10, 'Restock dry goods stall',
   'Seed Member Frank Mugisha', '250788222001', 'seed.client.beta.one@test.ibimina.rw', '1199770088883333',
   jsonb_build_array(jsonb_build_object('type', 'NID', 'url', 'https://cdn.ibimina.rw/docs/frank-nid.pdf', 'uploaded_at', now() - interval '1 day')),
   'DECLINED', now() - interval '8 hours', 0.48, '{"scorecard":"trade","risk":"high"}'::jsonb,
   'SEED-LOAN-BETA-001', NULL, 'Debt ratio exceeds policy', '70000000-0000-0000-0000-000000000005', now() - interval '10 hours',
   NULL, 'Existing arrears detected', NULL, NULL, NULL, now() - interval '2 days', now() - interval '8 hours')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  status_updated_at = EXCLUDED.status_updated_at,
  partner_notes = EXCLUDED.partner_notes;

INSERT INTO public.loan_application_status_history (id, application_id, from_status, to_status, changed_by, notes)
VALUES
  ('76000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'SUBMITTED', 'UNDER_REVIEW', '70000000-0000-0000-0000-000000000003', 'Loan officer acknowledged receipt'),
  ('76000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002', 'UNDER_REVIEW', 'APPROVED', '70000000-0000-0000-0000-000000000003', 'Approved pending disbursement'),
  ('76000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000003', 'UNDER_REVIEW', 'DECLINED', '70000000-0000-0000-0000-000000000005', 'Debt service ratio above limit')
ON CONFLICT (id) DO UPDATE SET
  to_status = EXCLUDED.to_status,
  notes = EXCLUDED.notes;

-- 10. Summary output
DO $$
DECLARE
  org_count INTEGER;
  sacco_count INTEGER;
  ikimina_count INTEGER;
  app_member_count INTEGER;
  digital_group_count INTEGER;
  digital_member_count INTEGER;
  user_count INTEGER;
  membership_count INTEGER;
  loan_product_count INTEGER;
  loan_application_count INTEGER;
  transaction_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM public.organizations WHERE name LIKE 'Seed%';
  SELECT COUNT(*) INTO sacco_count FROM app.saccos WHERE name LIKE 'Seed%';
  SELECT COUNT(*) INTO ikimina_count FROM app.ikimina WHERE name LIKE 'Seed%';
  SELECT COUNT(*) INTO app_member_count FROM app.members WHERE full_name LIKE 'Seed Member%';
  SELECT COUNT(*) INTO digital_group_count FROM public.groups WHERE name LIKE 'Seed%';
  SELECT COUNT(*) INTO digital_member_count FROM public.group_members WHERE member_name LIKE 'Seed Member%';
  SELECT COUNT(*) INTO user_count FROM auth.users WHERE email LIKE 'seed.%@test.ibimina.rw';
  SELECT COUNT(*) INTO membership_count FROM public.org_memberships WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'seed.%@test.ibimina.rw'
  );
  SELECT COUNT(*) INTO loan_product_count FROM public.loan_products WHERE name LIKE 'Seed%';
  SELECT COUNT(*) INTO loan_application_count FROM public.loan_applications WHERE partner_reference LIKE 'SEED-%';
  SELECT COUNT(*) INTO transaction_count FROM public.transactions WHERE ref LIKE 'SEED-%';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Multi-tenancy Seed Data Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Organizations created: %', org_count;
  RAISE NOTICE '  - 1 District (Gasabo)';
  RAISE NOTICE '  - 2 SACCOs (Alpha, Beta)';
  RAISE NOTICE '  - 1 MFI (Capital)';
  RAISE NOTICE 'SACCO records created: %', sacco_count;
  RAISE NOTICE 'Groups (Ikimina) created: %', ikimina_count;
  RAISE NOTICE 'Digital groups created: %', digital_group_count;
  RAISE NOTICE 'Members created (app schema): %', app_member_count;
  RAISE NOTICE 'Group members created (public schema): %', digital_member_count;
  RAISE NOTICE 'Test users created: %', user_count;
  RAISE NOTICE 'Organization memberships: %', membership_count;
  RAISE NOTICE 'Loan products created: %', loan_product_count;
  RAISE NOTICE 'Loan applications created: %', loan_application_count;
  RAISE NOTICE 'TapMoMo transactions created: %', transaction_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Test user credentials (password: password123):';
  RAISE NOTICE '  - seed.admin@test.ibimina.rw (SYSTEM_ADMIN)';
  RAISE NOTICE '  - seed.district@test.ibimina.rw (DISTRICT_MANAGER)';
  RAISE NOTICE '  - seed.sacco.alpha.manager@test.ibimina.rw (SACCO_MANAGER)';
  RAISE NOTICE '  - seed.sacco.alpha.staff@test.ibimina.rw (SACCO_STAFF)';
  RAISE NOTICE '  - seed.sacco.beta.manager@test.ibimina.rw (SACCO_MANAGER)';
  RAISE NOTICE '  - seed.mfi.manager@test.ibimina.rw (MFI_MANAGER)';
  RAISE NOTICE '  - seed.mfi.staff@test.ibimina.rw (MFI_STAFF)';
  RAISE NOTICE '  - seed.client.alpha.one@test.ibimina.rw (MEMBER)';
  RAISE NOTICE '  - seed.client.alpha.two@test.ibimina.rw (MEMBER)';
  RAISE NOTICE '  - seed.client.beta.one@test.ibimina.rw (MEMBER)';
  RAISE NOTICE '  - seed.merchant.tapmomo@test.ibimina.rw (MERCHANT)';
  RAISE NOTICE '========================================';
END $$;
