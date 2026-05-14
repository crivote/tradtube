-- Add key column to tune_video_entries to store the musical key/tonality of the recording
ALTER TABLE tune_video_entries ADD COLUMN key TEXT;
