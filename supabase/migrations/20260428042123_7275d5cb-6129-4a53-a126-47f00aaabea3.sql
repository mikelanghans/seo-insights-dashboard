-- Wipe existing scans (fresh start under the new tenant-shared model).
DELETE FROM public.scans;

-- Allow scans without a user (Brand Aura mode).
ALTER TABLE public.scans ALTER COLUMN user_id DROP NOT NULL;

-- Track which app the scan came from.
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'standalone'
    CHECK (source IN ('standalone', 'brand_aura'));

-- Optional audit field for Brand Aura's user id (free-form text, not enforced).
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS brand_aura_user_id text;

CREATE INDEX IF NOT EXISTS scans_source_idx ON public.scans(source);

-- Replace the existing RLS policies so standalone users only see THEIR OWN
-- standalone rows. Brand Aura rows have no user_id and are invisible to
-- direct browser access — only the service role (used by the HMAC-protected
-- /api/integrations/brand-aura/* routes) can read or write them.
DROP POLICY IF EXISTS "Users can view their own scans" ON public.scans;
DROP POLICY IF EXISTS "Users can create their own scans" ON public.scans;
DROP POLICY IF EXISTS "Users can update their own scans" ON public.scans;
DROP POLICY IF EXISTS "Users can delete their own scans" ON public.scans;

CREATE POLICY "Standalone users can view their own scans"
ON public.scans FOR SELECT
TO authenticated
USING (source = 'standalone' AND auth.uid() = user_id);

CREATE POLICY "Standalone users can create their own scans"
ON public.scans FOR INSERT
TO authenticated
WITH CHECK (source = 'standalone' AND auth.uid() = user_id);

CREATE POLICY "Standalone users can update their own scans"
ON public.scans FOR UPDATE
TO authenticated
USING (source = 'standalone' AND auth.uid() = user_id);

CREATE POLICY "Standalone users can delete their own scans"
ON public.scans FOR DELETE
TO authenticated
USING (source = 'standalone' AND auth.uid() = user_id);