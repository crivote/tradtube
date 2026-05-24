-- Allow authenticated users to read their own reports
CREATE POLICY "users_can_read_own_reports" ON public.tune_media_reports
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
