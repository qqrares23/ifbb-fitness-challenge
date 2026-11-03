-- Competitions can span several days. `date` stays the first day (athlete ages are counted on it);
-- end_date is the last day, NULL for a one-day competition. Unlike the first day, it can be
-- corrected at any time: it decides nothing but what is printed.

ALTER TABLE competitions ADD COLUMN end_date TEXT CHECK (end_date IS NULL OR (date(end_date) IS end_date AND end_date >= date));
