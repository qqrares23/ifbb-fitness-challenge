-- Competition lifecycle, enforced by the database so no code path can bypass it:
--   draft    → setup (stations, categories, entries, details) editable, no reps
--   running  → setup frozen, reps editable
--   finished → everything frozen (can be reopened to running to correct a result)
--
-- During a cascade delete of a competition its row is already gone when the children are
-- deleted, so the status lookups below return NULL and the cleanup is never blocked.
-- RAISE messages are shown to the user verbatim.

CREATE TRIGGER competitions_status_flow BEFORE UPDATE OF status ON competitions
WHEN OLD.status <> NEW.status
  AND (OLD.status, NEW.status) NOT IN (VALUES ('draft', 'running'), ('running', 'finished'), ('finished', 'running'))
BEGIN
  SELECT RAISE(ABORT, 'That competition status change is not allowed.');
END;

CREATE TRIGGER competitions_details_locked BEFORE UPDATE OF name, date, location ON competitions
WHEN OLD.status <> 'draft'
  AND (NEW.name IS NOT OLD.name OR NEW.date IS NOT OLD.date OR NEW.location IS NOT OLD.location)
BEGIN
  SELECT RAISE(ABORT, 'Competition details are locked once the competition has started.');
END;

-- competition_stations

CREATE TRIGGER stations_locked_insert BEFORE INSERT ON competition_stations
WHEN (SELECT status FROM competitions WHERE id = NEW.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'Stations are locked once the competition has started.');
END;

CREATE TRIGGER stations_locked_update BEFORE UPDATE ON competition_stations
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'Stations are locked once the competition has started.');
END;

CREATE TRIGGER stations_locked_delete BEFORE DELETE ON competition_stations
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'Stations are locked once the competition has started.');
END;

-- categories

CREATE TRIGGER categories_locked_insert BEFORE INSERT ON categories
WHEN (SELECT status FROM competitions WHERE id = NEW.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'Categories are locked once the competition has started.');
END;

CREATE TRIGGER categories_locked_update BEFORE UPDATE ON categories
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'Categories are locked once the competition has started.');
END;

CREATE TRIGGER categories_locked_delete BEFORE DELETE ON categories
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'Categories are locked once the competition has started.');
END;

-- entries

CREATE TRIGGER entries_locked_insert BEFORE INSERT ON entries
WHEN (SELECT status FROM competitions WHERE id = NEW.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'The athlete list is locked once the competition has started.');
END;

CREATE TRIGGER entries_locked_update BEFORE UPDATE ON entries
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'The athlete list is locked once the competition has started.');
END;

CREATE TRIGGER entries_locked_delete BEFORE DELETE ON entries
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) IN ('running', 'finished')
BEGIN
  SELECT RAISE(ABORT, 'The athlete list is locked once the competition has started.');
END;

CREATE TRIGGER entries_category_same_competition_insert BEFORE INSERT ON entries
WHEN (SELECT competition_id FROM categories WHERE id = NEW.category_id) IS NOT NEW.competition_id
BEGIN
  SELECT RAISE(ABORT, 'The category belongs to a different competition.');
END;

CREATE TRIGGER entries_category_same_competition_update BEFORE UPDATE OF category_id, competition_id ON entries
WHEN (SELECT competition_id FROM categories WHERE id = NEW.category_id) IS NOT NEW.competition_id
BEGIN
  SELECT RAISE(ABORT, 'The category belongs to a different competition.');
END;

-- scores

CREATE TRIGGER scores_only_while_running_insert BEFORE INSERT ON scores
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) <> 'running'
BEGIN
  SELECT RAISE(ABORT, 'Reps can only be entered while the competition is running.');
END;

CREATE TRIGGER scores_only_while_running_update BEFORE UPDATE ON scores
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) <> 'running'
BEGIN
  SELECT RAISE(ABORT, 'Reps can only be entered while the competition is running.');
END;

CREATE TRIGGER scores_locked_when_finished_delete BEFORE DELETE ON scores
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = OLD.entry_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'Results are locked once the competition is finished.');
END;
