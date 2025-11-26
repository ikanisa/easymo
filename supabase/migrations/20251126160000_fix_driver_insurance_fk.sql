-- Align driver_insurance_certificates.user_id with profiles table
ALTER TABLE public.driver_insurance_certificates
  DROP CONSTRAINT IF EXISTS driver_insurance_certificates_user_id_fkey;

ALTER TABLE public.driver_insurance_certificates
  ADD CONSTRAINT driver_insurance_certificates_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(user_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;
