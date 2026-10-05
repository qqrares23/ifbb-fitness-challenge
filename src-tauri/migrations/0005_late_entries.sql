-- Late entries: athletes (and the categories they need) can be added while a competition is
-- running, so a missed athlete never forces the competition to be rebuilt.
--   draft    → everything editable (unchanged)
--   running  → entries can be added / removed / re-numbered; an entry may change category only
--              while it has no results; categories can be added, and removed only while empty
--   finished → still fully frozen (reopen to make changes)
-- Stations, category rules and competition details stay frozen once started (see 0002).

DROP TRIGGER entries_locked_insert;
DROP TRIGGER entries_locked_update;
DROP TRIGGER entries_locked_delete;
DROP TRIGGER categories_locked_insert;
DROP TRIGGER categories_locked_delete;

-- Marks entries added after the start, so officials can see who came in late.
ALTER TABLE entries ADD COLUMN late_entry INTEGER NOT NULL DEFAULT 0 CHECK (late_entry IN (0, 1));

CREATE TRIGGER entries_locked_when_finished_insert BEFORE INSERT ON entries
WHEN (SELECT status FROM competitions WHERE id = NEW.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to add athletes.');
END;

CREATE TRIGGER entries_mark_late AFTER INSERT ON entries
WHEN (SELECT status FROM competitions WHERE id = NEW.competition_id) = 'running'
BEGIN
  UPDATE entries SET late_entry = 1 WHERE id = NEW.id;
END;

CREATE TRIGGER entries_locked_when_finished_update BEFORE UPDATE ON entries
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change athletes.');
END;

CREATE TRIGGER entries_locked_when_finished_delete BEFORE DELETE ON entries
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to remove athletes.');
END;

-- An entry always belongs to the same athlete and competition; only its category and bib move.
CREATE TRIGGER entries_identity_fixed BEFORE UPDATE OF athlete_id, competition_id ON entries
WHEN NEW.athlete_id IS NOT OLD.athlete_id OR NEW.competition_id IS NOT OLD.competition_id
BEGIN
  SELECT RAISE(ABORT, 'An entry can''t be moved to another athlete or competition.');
END;

-- Moving an athlete with results would silently carry those results into another ranking.
CREATE TRIGGER entries_category_fixed_once_scored BEFORE UPDATE OF category_id ON entries
WHEN NEW.category_id IS NOT OLD.category_id
  AND (EXISTS (SELECT 1 FROM scores WHERE entry_id = OLD.id) OR EXISTS (SELECT 1 FROM speed_fit_times WHERE entry_id = OLD.id))
BEGIN
  SELECT RAISE(ABORT, 'This athlete already has results, so their category can''t change.');
END;

CREATE TRIGGER categories_locked_when_finished_insert BEFORE INSERT ON categories
WHEN (SELECT status FROM competitions WHERE id = NEW.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to add categories.');
END;

CREATE TRIGGER categories_locked_delete BEFORE DELETE ON categories
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
  OR ((SELECT status FROM competitions WHERE id = OLD.competition_id) = 'running'
      AND EXISTS (SELECT 1 FROM entries WHERE category_id = OLD.id))
BEGIN
  SELECT RAISE(ABORT, 'Once the competition has started, only an empty category can be removed.');
END;
