ALTER TABLE public.batch_targets
  ADD CONSTRAINT batch_targets_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.batch_targets
  ADD CONSTRAINT batch_targets_client_website_id_fkey
    FOREIGN KEY (client_website_id) REFERENCES public.client_websites(id) ON DELETE CASCADE;