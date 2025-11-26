-- Ensure momo_qr_requests table supports the extended logging payload used by the QR flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'momo_qr_requests' AND column_name = 'target_value'
  ) THEN
    ALTER TABLE public.momo_qr_requests ADD COLUMN target_value TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'momo_qr_requests' AND column_name = 'target_type'
  ) THEN
    ALTER TABLE public.momo_qr_requests ADD COLUMN target_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'momo_qr_requests' AND column_name = 'amount_minor'
  ) THEN
    ALTER TABLE public.momo_qr_requests ADD COLUMN amount_minor INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'momo_qr_requests' AND column_name = 'ussd_code'
  ) THEN
    ALTER TABLE public.momo_qr_requests ADD COLUMN ussd_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'momo_qr_requests' AND column_name = 'msisdn_or_code'
  ) THEN
    ALTER TABLE public.momo_qr_requests ADD COLUMN msisdn_or_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'momo_qr_requests' AND column_name = 'amount'
  ) THEN
    ALTER TABLE public.momo_qr_requests ADD COLUMN amount NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'momo_qr_requests' AND column_name = 'ussd'
  ) THEN
    ALTER TABLE public.momo_qr_requests ADD COLUMN ussd TEXT;
  END IF;
END $$;
