-- Create storage bucket for KYC document uploads
BEGIN;
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;
COMMIT;
