-- Per-member avatar color. Drives the initial-in-a-circle avatar shown across the app.
-- Null = fall back to the app's default blue.
ALTER TABLE family_members ADD COLUMN color TEXT;
