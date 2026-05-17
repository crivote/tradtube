-- Add unavailable flag to tune_videos to mark videos no longer accessible on YouTube
ALTER TABLE public.tune_videos ADD COLUMN unavailable boolean NOT NULL DEFAULT false;
