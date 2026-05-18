-- Multiple websites per client
CREATE TABLE public.client_websites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_websites_client_id ON public.client_websites(client_id);
CREATE INDEX idx_client_websites_user_id ON public.client_websites(user_id);

ALTER TABLE public.client_websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own client websites"
  ON public.client_websites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create their own client websites"
  ON public.client_websites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own client websites"
  ON public.client_websites FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own client websites"
  ON public.client_websites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_client_websites_updated_at
  BEFORE UPDATE ON public.client_websites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track which website a scan was for
ALTER TABLE public.scans
  ADD COLUMN client_website_id UUID REFERENCES public.client_websites(id) ON DELETE SET NULL;