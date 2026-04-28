ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS retry_scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS scans_retry_scan_id_idx ON public.scans(retry_scan_id);