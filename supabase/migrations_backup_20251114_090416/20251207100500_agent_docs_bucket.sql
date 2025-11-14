-- Create private storage bucket for agent documents

BEGIN;
INSERT INTO storage.buckets(id, name, public)
  VALUES ('agent-docs','agent-docs', false)
ON CONFLICT (id) DO NOTHING;
COMMIT;
