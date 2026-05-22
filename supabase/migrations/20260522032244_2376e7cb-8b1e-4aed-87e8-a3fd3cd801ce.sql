CREATE POLICY "Users update own batch targets"
ON public.batch_targets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);