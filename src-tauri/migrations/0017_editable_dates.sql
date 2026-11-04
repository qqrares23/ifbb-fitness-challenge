-- The start date can be corrected in any state, like the name and end date (0014, 0015), e.g. a
-- competition created with the wrong date and noticed only after it started. Ages are counted on
-- it, so athletes may stop fitting their categories; the app flags them. Only the location stays
-- locked once the competition has started (replacing 0014).

DROP TRIGGER competitions_details_locked;

CREATE TRIGGER competitions_details_locked BEFORE UPDATE OF location ON competitions
WHEN OLD.status <> 'draft' AND NEW.location IS NOT OLD.location
BEGIN
  SELECT RAISE(ABORT, 'The location is locked once the competition has started.');
END;
