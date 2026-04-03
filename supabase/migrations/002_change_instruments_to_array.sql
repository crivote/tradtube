-- Change main_instrument from TEXT to TEXT[] (array of instruments)
ALTER TABLE tune_video_entries ADD COLUMN instruments TEXT[];
UPDATE tune_video_entries SET instruments = ARRAY[main_instrument] WHERE main_instrument IS NOT NULL;
ALTER TABLE tune_video_entries DROP COLUMN main_instrument;
