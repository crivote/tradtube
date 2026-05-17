-- Reports table: users can report issues with videos
CREATE TABLE IF NOT EXISTS public.tune_video_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  video_id    uuid NOT NULL REFERENCES public.tune_videos(id) ON DELETE CASCADE,
  tune_id     integer,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email       text,
  issue_type  text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'tracking', 'solved', 'discarded')),
  admin_comments text,
  closed_at   timestamptz
);

ALTER TABLE public.tune_video_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (even anonymous) can submit a report
CREATE POLICY "anyone_can_insert_reports" ON public.tune_video_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can read all reports
CREATE POLICY "admins_can_select_reports" ON public.tune_video_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admins can update reports (status, comments, closed_at)
CREATE POLICY "admins_can_update_reports" ON public.tune_video_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
