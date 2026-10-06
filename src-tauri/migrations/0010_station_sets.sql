-- 1) Station sets. A Fitness Challenge competition has one or more sets of stations (Set A,
--    Set B…). Each category is scored on one set and can be switched to another. Reps are stored
--    per set, so switching a category back brings its earlier reps back.
-- 2) Stations, station sets and categories stay editable while a competition is running; they
--    freeze once it is finished. Changing a station's exercise keeps its reps; removing a station
--    deletes them (scores → stations cascade). Competition details stay locked after the start.
--
-- Every existing Fitness Challenge competition gets "Set A" with its current stations, used by
-- all its categories; its reps move to that set. Speed Fit competitions have no sets.

CREATE TABLE station_sets (
  id             INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions (id) ON DELETE CASCADE,
  name           TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  UNIQUE (competition_id, name)
);

INSERT INTO station_sets (competition_id, name) SELECT id, 'Set A' FROM competitions WHERE kind = 'fitness_challenge';

-- Rebuild stations (keyed by set now) and scores (keyed by set, cascading from their station).
-- scores has no children and is dropped first, so nothing cascades.
CREATE TABLE competition_stations_backup AS SELECT * FROM competition_stations;
CREATE TABLE scores_backup AS SELECT * FROM scores;
DROP TABLE scores;
DROP TABLE competition_stations;

CREATE TABLE competition_stations (
  set_id         INTEGER NOT NULL REFERENCES station_sets (id) ON DELETE CASCADE,
  station_number INTEGER NOT NULL CHECK (station_number >= 1),
  exercise_id    INTEGER REFERENCES exercises (id) ON DELETE RESTRICT,
  PRIMARY KEY (set_id, station_number)
);

CREATE TABLE scores (
  entry_id       INTEGER NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  set_id         INTEGER NOT NULL,
  station_number INTEGER NOT NULL,
  reps           INTEGER NOT NULL CHECK (reps BETWEEN 0 AND 9999),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entry_id, set_id, station_number),
  FOREIGN KEY (set_id, station_number) REFERENCES competition_stations (set_id, station_number) ON DELETE CASCADE
);
CREATE INDEX scores_by_station ON scores (set_id, station_number);

INSERT INTO competition_stations (set_id, station_number, exercise_id)
SELECT s.id, b.station_number, b.exercise_id
FROM competition_stations_backup b JOIN station_sets s ON s.competition_id = b.competition_id;

INSERT INTO scores (entry_id, set_id, station_number, reps, updated_at)
SELECT b.entry_id, s.id, b.station_number, b.reps, b.updated_at
FROM scores_backup b
JOIN entries e ON e.id = b.entry_id
JOIN station_sets s ON s.competition_id = e.competition_id
WHERE EXISTS (SELECT 1 FROM competition_stations st WHERE st.set_id = s.id AND st.station_number = b.station_number);

DROP TABLE competition_stations_backup;
DROP TABLE scores_backup;

-- Categories: which set they are scored on, and editable until the competition is finished.
DROP TRIGGER categories_locked_update;
DROP TRIGGER categories_locked_delete;

ALTER TABLE categories ADD COLUMN station_set_id INTEGER REFERENCES station_sets (id) ON DELETE SET NULL;
UPDATE categories SET station_set_id = (SELECT s.id FROM station_sets s WHERE s.competition_id = categories.competition_id);

CREATE TRIGGER categories_locked_when_finished_update BEFORE UPDATE ON categories
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change categories.');
END;

CREATE TRIGGER categories_locked_when_finished_delete BEFORE DELETE ON categories
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to remove categories.');
END;

CREATE TRIGGER categories_station_set_same_competition_insert BEFORE INSERT ON categories
WHEN NEW.station_set_id IS NOT NULL AND (SELECT competition_id FROM station_sets WHERE id = NEW.station_set_id) IS NOT NEW.competition_id
BEGIN
  SELECT RAISE(ABORT, 'That station set belongs to a different competition.');
END;

CREATE TRIGGER categories_station_set_same_competition_update BEFORE UPDATE OF station_set_id ON categories
WHEN NEW.station_set_id IS NOT NULL AND (SELECT competition_id FROM station_sets WHERE id = NEW.station_set_id) IS NOT NEW.competition_id
BEGIN
  SELECT RAISE(ABORT, 'That station set belongs to a different competition.');
END;

-- Station sets and stations: Fitness Challenge only, frozen once finished. During a cascade
-- delete of a competition its row is already gone, so the status lookups return NULL.

-- A new Fitness Challenge competition starts with "Set A".
CREATE TRIGGER competitions_first_station_set AFTER INSERT ON competitions
WHEN NEW.kind = 'fitness_challenge'
BEGIN
  INSERT INTO station_sets (competition_id, name) VALUES (NEW.id, 'Set A');
END;

CREATE TRIGGER station_sets_only_fitness_challenge BEFORE INSERT ON station_sets
WHEN (SELECT kind FROM competitions WHERE id = NEW.competition_id) <> 'fitness_challenge'
BEGIN
  SELECT RAISE(ABORT, 'Speed Fit competitions have no stations.');
END;

CREATE TRIGGER station_sets_locked_when_finished_insert BEFORE INSERT ON station_sets
WHEN (SELECT status FROM competitions WHERE id = NEW.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change stations.');
END;

CREATE TRIGGER station_sets_locked_when_finished_update BEFORE UPDATE ON station_sets
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change stations.');
END;

CREATE TRIGGER station_sets_locked_when_finished_delete BEFORE DELETE ON station_sets
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change stations.');
END;

CREATE TRIGGER stations_locked_when_finished_insert BEFORE INSERT ON competition_stations
WHEN (SELECT c.status FROM station_sets s JOIN competitions c ON c.id = s.competition_id WHERE s.id = NEW.set_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change stations.');
END;

CREATE TRIGGER stations_locked_when_finished_update BEFORE UPDATE ON competition_stations
WHEN (SELECT c.status FROM station_sets s JOIN competitions c ON c.id = s.competition_id WHERE s.id = OLD.set_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change stations.');
END;

CREATE TRIGGER stations_locked_when_finished_delete BEFORE DELETE ON competition_stations
WHEN (SELECT c.status FROM station_sets s JOIN competitions c ON c.id = s.competition_id WHERE s.id = OLD.set_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change stations.');
END;

-- Scores: as before (0002), plus they must be on the set the athlete's category currently uses.

CREATE TRIGGER scores_on_category_set BEFORE INSERT ON scores
WHEN NEW.set_id IS NOT (SELECT k.station_set_id FROM entries e JOIN categories k ON k.id = e.category_id WHERE e.id = NEW.entry_id)
BEGIN
  SELECT RAISE(ABORT, 'Reps can only be entered on the station set of the athlete''s category.');
END;

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
