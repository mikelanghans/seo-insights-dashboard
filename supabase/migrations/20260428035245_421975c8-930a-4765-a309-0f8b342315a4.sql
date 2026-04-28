-- Add status/progress columns to scans
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS pages_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Constrain status to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scans_status_check'
  ) THEN
    ALTER TABLE public.scans
      ADD CONSTRAINT scans_status_check
      CHECK (status IN ('pending','running','complete','failed'));
  END IF;
END $$;

-- Backfill: any existing rows are already finished
UPDATE public.scans SET status = 'complete' WHERE status IS NULL OR status = 'pending';

-- Index for "is this scan still running" lookups
CREATE INDEX IF NOT EXISTS scans_user_status_idx ON public.scans (user_id, status, created_at DESC);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS scans_set_updated_at ON public.scans;
CREATE TRIGGER scans_set_updated_at
BEFORE UPDATE ON public.scans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();