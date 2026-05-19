ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS grade_letter text,
  ADD COLUMN IF NOT EXISTS grade_score integer;

CREATE INDEX IF NOT EXISTS scans_client_id_created_at_idx
  ON public.scans (client_id, created_at DESC)
  WHERE client_id IS NOT NULL AND status = 'complete';