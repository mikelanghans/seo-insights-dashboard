ALTER TABLE public.scans ADD COLUMN is_public boolean NOT NULL DEFAULT false;

CREATE POLICY "Public scans are viewable by anyone"
ON public.scans
FOR SELECT
TO anon, authenticated
USING (is_public = true);