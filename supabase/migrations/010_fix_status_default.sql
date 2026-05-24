-- 010_fix_status_default.sql
-- Fix: column default still referenced old values ('pending'/'approved')
-- after 007 changed the check constraint to ('new', 'reviewed').
ALTER TABLE tune_media ALTER COLUMN status SET DEFAULT 'new';
