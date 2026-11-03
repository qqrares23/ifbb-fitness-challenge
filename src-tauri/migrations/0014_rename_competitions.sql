-- A competition can be renamed at any time (e.g. a typo noticed on the printed list). Its date
-- (which decides every athlete's age) and location stay locked once it has started (replacing 0002).

DROP TRIGGER competitions_details_locked;

CREATE TRIGGER competitions_details_locked BEFORE UPDATE OF date, location ON competitions
WHEN OLD.status <> 'draft'
  AND (NEW.date IS NOT OLD.date OR NEW.location IS NOT OLD.location)
BEGIN
  SELECT RAISE(ABORT, 'The date and location are locked once the competition has started.');
END;
