ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'site',
  ADD COLUMN IF NOT EXISTS audit_type text;

ALTER TABLE public.scans
  ADD CONSTRAINT scans_kind_check CHECK (kind IN ('site', 'page'));