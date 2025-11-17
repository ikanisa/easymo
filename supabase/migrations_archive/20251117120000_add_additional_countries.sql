-- Add non-African countries for international support numbers
BEGIN;

INSERT INTO countries (
  code,
  name,
  currency_code,
  currency_symbol,
  phone_prefix,
  mobile_money_provider,
  mobile_money_brand,
  ussd_send_to_phone,
  ussd_pay_merchant,
  flag_emoji,
  timezone,
  sort_order
) VALUES
  ('MT', 'Malta', 'EUR', '€', '+356', 'Local Banking', 'Bank Transfer', 'N/A', 'N/A', '🇲🇹', 'Europe/Malta', 201),
  ('CA', 'Canada', 'CAD', '$', '+1', 'Interac e-Transfer', 'Interac', 'N/A', 'N/A', '🇨🇦', 'America/Toronto', 202),
  ('GB', 'United Kingdom', 'GBP', '£', '+44', 'Bank Transfer', 'Faster Payments', 'N/A', 'N/A', '🇬🇧', 'Europe/London', 203),
  ('FR', 'France', 'EUR', '€', '+33', 'SEPA Transfer', 'SEPA', 'N/A', 'N/A', '🇫🇷', 'Europe/Paris', 204),
  ('PT', 'Portugal', 'EUR', '€', '+351', 'SEPA Transfer', 'SEPA', 'N/A', 'N/A', '🇵🇹', 'Europe/Lisbon', 205),
  ('DE', 'Germany', 'EUR', '€', '+49', 'SEPA Transfer', 'SEPA', 'N/A', 'N/A', '🇩🇪', 'Europe/Berlin', 206),
  ('BE', 'Belgium', 'EUR', '€', '+32', 'SEPA Transfer', 'SEPA', 'N/A', 'N/A', '🇧🇪', 'Europe/Brussels', 207)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  currency_symbol = EXCLUDED.currency_symbol,
  phone_prefix = EXCLUDED.phone_prefix,
  mobile_money_provider = EXCLUDED.mobile_money_provider,
  mobile_money_brand = EXCLUDED.mobile_money_brand,
  ussd_send_to_phone = EXCLUDED.ussd_send_to_phone,
  ussd_pay_merchant = EXCLUDED.ussd_pay_merchant,
  flag_emoji = EXCLUDED.flag_emoji,
  timezone = EXCLUDED.timezone,
  sort_order = EXCLUDED.sort_order;

COMMIT;
