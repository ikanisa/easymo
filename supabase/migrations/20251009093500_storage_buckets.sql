INSERT INTO storage.buckets (id, name, public)
VALUES
  ('insurance-docs', 'insurance-docs', false),
  ('menu-source-files', 'menu-source-files', false),
  ('ocr-json-cache', 'ocr-json-cache', false)
ON CONFLICT (id) DO NOTHING;
