-- An athlete may enter several categories (e.g. several levels) of the same competition.
--   before: UNIQUE (competition_id, athlete_id) and UNIQUE (competition_id, bib_number)
--   now:    UNIQUE (category_id, athlete_id); one bib per athlete for the whole competition,
--           shared by all their entries, and never used by another athlete (triggers below).
--
-- SQLite can't drop a UNIQUE constraint, so `entries` is rebuilt. Its results tables reference it,
-- and dropping a parent table cascades into them, so they are copied aside and rebuilt first.
-- Triggers are recreated after the data is copied back, so the lifecycle rules don't block the copy.

CREATE TABLE entries_backup AS SELECT * FROM entries;
CREATE TABLE scores_backup AS SELECT * FROM scores;
CREATE TABLE speed_fit_times_backup AS SELECT * FROM speed_fit_times;

DROP TABLE scores;
DROP TABLE speed_fit_times;
DROP TABLE entries;

CREATE TABLE entries (
  id             INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions (id) ON DELETE CASCADE,
  category_id    INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  athlete_id     INTEGER NOT NULL REFERENCES athletes (id) ON DELETE RESTRICT,
  bib_number     INTEGER NOT NULL CHECK (bib_number >= 1),
  late_entry     INTEGER NOT NULL DEFAULT 0 CHECK (late_entry IN (0, 1)),
  UNIQUE (category_id, athlete_id)
);
CREATE INDEX entries_by_category ON entries (category_id);
CREATE INDEX entries_by_competition_bib ON entries (competition_id, bib_number);
CREATE INDEX entries_by_competition_athlete ON entries (competition_id, athlete_id);

CREATE TABLE scores (
  entry_id       INTEGER NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  station_number INTEGER NOT NULL CHECK (station_number >= 1),
  reps           INTEGER NOT NULL CHECK (reps BETWEEN 0 AND 9999),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entry_id, station_number)
);

CREATE TABLE speed_fit_times (
  entry_id   INTEGER PRIMARY KEY REFERENCES entries (id) ON DELETE CASCADE,
  time_ms    INTEGER NOT NULL CHECK (time_ms > 0 AND time_ms < 86400000),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO entries (id, competition_id, category_id, athlete_id, bib_number, late_entry)
SELECT id, competition_id, category_id, athlete_id, bib_number, late_entry FROM entries_backup;
INSERT INTO scores (entry_id, station_number, reps, updated_at)
SELECT entry_id, station_number, reps, updated_at FROM scores_backup;
INSERT INTO speed_fit_times (entry_id, time_ms, updated_at)
SELECT entry_id, time_ms, updated_at FROM speed_fit_times_backup;

DROP TABLE entries_backup;
DROP TABLE scores_backup;
DROP TABLE speed_fit_times_backup;

-- Bib numbers: one athlete per bib. (An athlete keeping one bib across their entries is also
-- checked on insert; a bib change updates all of the athlete's entries in one statement.)

CREATE TRIGGER entries_bib_taken_insert BEFORE INSERT ON entries
WHEN EXISTS (SELECT 1 FROM entries WHERE competition_id = NEW.competition_id AND bib_number = NEW.bib_number AND athlete_id <> NEW.athlete_id)
BEGIN
  SELECT RAISE(ABORT, 'That bib number belongs to another athlete in this competition.');
END;

CREATE TRIGGER entries_bib_taken_update BEFORE UPDATE OF bib_number ON entries
WHEN EXISTS (SELECT 1 FROM entries WHERE competition_id = NEW.competition_id AND bib_number = NEW.bib_number AND athlete_id <> NEW.athlete_id)
BEGIN
  SELECT RAISE(ABORT, 'That bib number belongs to another athlete in this competition.');
END;

CREATE TRIGGER entries_one_bib_per_athlete BEFORE INSERT ON entries
WHEN EXISTS (SELECT 1 FROM entries WHERE competition_id = NEW.competition_id AND athlete_id = NEW.athlete_id AND bib_number <> NEW.bib_number)
BEGIN
  SELECT RAISE(ABORT, 'This athlete already has a different bib number in this competition.');
END;

-- Recreated unchanged from 0002 and 0005.

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

CREATE TRIGGER entries_identity_fixed BEFORE UPDATE OF athlete_id, competition_id ON entries
WHEN NEW.athlete_id IS NOT OLD.athlete_id OR NEW.competition_id IS NOT OLD.competition_id
BEGIN
  SELECT RAISE(ABORT, 'An entry can''t be moved to another athlete or competition.');
END;

CREATE TRIGGER entries_category_fixed_once_scored BEFORE UPDATE OF category_id ON entries
WHEN NEW.category_id IS NOT OLD.category_id
  AND (EXISTS (SELECT 1 FROM scores WHERE entry_id = OLD.id) OR EXISTS (SELECT 1 FROM speed_fit_times WHERE entry_id = OLD.id))
BEGIN
  SELECT RAISE(ABORT, 'This athlete already has results, so their category can''t change.');
END;

-- Recreated unchanged from 0002 and 0003.

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

CREATE TRIGGER scores_only_fitness_challenge BEFORE INSERT ON scores
WHEN (SELECT c.kind FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) <> 'fitness_challenge'
BEGIN
  SELECT RAISE(ABORT, 'Speed Fit competitions record times, not reps.');
END;

CREATE TRIGGER times_only_speed_fit BEFORE INSERT ON speed_fit_times
WHEN (SELECT c.kind FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) <> 'speed_fit'
BEGIN
  SELECT RAISE(ABORT, 'Only Speed Fit competitions record times.');
END;

CREATE TRIGGER times_only_while_running_insert BEFORE INSERT ON speed_fit_times
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) <> 'running'
BEGIN
  SELECT RAISE(ABORT, 'Times can only be entered while the competition is running.');
END;

CREATE TRIGGER times_only_while_running_update BEFORE UPDATE ON speed_fit_times
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) <> 'running'
BEGIN
  SELECT RAISE(ABORT, 'Times can only be entered while the competition is running.');
END;

CREATE TRIGGER times_locked_when_finished_delete BEFORE DELETE ON speed_fit_times
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = OLD.entry_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'Results are locked once the competition is finished.');
END;
