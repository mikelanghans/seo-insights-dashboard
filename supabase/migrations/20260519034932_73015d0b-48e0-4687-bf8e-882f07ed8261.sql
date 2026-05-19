
-- batches: saved configuration
CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  scan_kind TEXT NOT NULL DEFAULT 'site' CHECK (scan_kind IN ('site','page')),
  audit_type TEXT NOT NULL DEFAULT 'seo' CHECK (audit_type IN ('seo','a11y')),
  scope TEXT NOT NULL DEFAULT 'standard' CHECK (scope IN ('quick','standard','deep')),
  schedule_type TEXT NOT NULL DEFAULT 'manual' CHECK (schedule_type IN ('manual','daily','weekly','monthly')),
  schedule_hour INT NOT NULL DEFAULT 9 CHECK (schedule_hour BETWEEN 0 AND 23),
  schedule_day_of_week INT CHECK (schedule_day_of_week BETWEEN 0 AND 6),
  schedule_day_of_month INT CHECK (schedule_day_of_month BETWEEN 1 AND 28),
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_user ON public.batches(user_id);
CREATE INDEX idx_batches_due ON public.batches(next_run_at) WHERE is_active = true AND schedule_type <> 'manual';

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own batches" ON public.batches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own batches" ON public.batches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own batches" ON public.batches FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own batches" ON public.batches FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- batch_targets: which client+website pairs to scan
CREATE TABLE public.batch_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  client_website_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, client_website_id)
);
CREATE INDEX idx_batch_targets_batch ON public.batch_targets(batch_id);
CREATE INDEX idx_batch_targets_user ON public.batch_targets(user_id);

ALTER TABLE public.batch_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own batch targets" ON public.batch_targets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own batch targets" ON public.batch_targets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own batch targets" ON public.batch_targets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- batch_runs: an execution
CREATE TABLE public.batch_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','scheduled')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','failed')),
  scans_total INT NOT NULL DEFAULT 0,
  scans_completed INT NOT NULL DEFAULT 0,
  scans_failed INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_batch_runs_batch ON public.batch_runs(batch_id, started_at DESC);
CREATE INDEX idx_batch_runs_user ON public.batch_runs(user_id, started_at DESC);

ALTER TABLE public.batch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own batch runs" ON public.batch_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- batch_run_scans: link each run to the scan rows created
CREATE TABLE public.batch_run_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_run_id UUID NOT NULL REFERENCES public.batch_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scan_id UUID NOT NULL,
  client_id UUID,
  client_website_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batch_run_scans_run ON public.batch_run_scans(batch_run_id);
CREATE INDEX idx_batch_run_scans_user ON public.batch_run_scans(user_id);

ALTER TABLE public.batch_run_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own batch run scans" ON public.batch_run_scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
