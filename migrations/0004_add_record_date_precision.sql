-- How much of a record's event_date is actually known. Vaccines and older events
-- are often remembered only by month or year. event_date stays a full ISO date
-- (normalised to the start of the known period, e.g. year-only -> YYYY-01-01) so
-- existing sorting/date math keep working; this column tells the UI how much to show.
-- 'day' | 'month' | 'year'; 'day' matches every pre-existing full-date record.
ALTER TABLE records ADD COLUMN date_precision TEXT NOT NULL DEFAULT 'day';
