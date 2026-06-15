-- Add sync scheduling to portal credentials
ALTER TABLE portal_credentials ADD COLUMN sync_schedule TEXT DEFAULT 'manual';
ALTER TABLE portal_credentials ADD COLUMN sync_time TEXT;
ALTER TABLE portal_credentials ADD COLUMN sync_day_of_week INTEGER;
ALTER TABLE portal_credentials ADD COLUMN sync_day_of_month INTEGER;
ALTER TABLE portal_credentials ADD COLUMN auto_sync_on_open INTEGER DEFAULT 0;
ALTER TABLE portal_credentials ADD COLUMN notify_on_sync INTEGER DEFAULT 1;
