-- Allow general reports not linked to a specific video
ALTER TABLE public.tune_video_reports
  ALTER COLUMN video_id DROP NOT NULL;
