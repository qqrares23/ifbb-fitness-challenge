-- Speed Fit: a second challenge type. Instead of reps per station, each athlete gets one time
-- for completing the whole set of exercises; fastest wins. It has no stations.

ALTER TABLE competitions ADD COLUMN kind TEXT NOT NULL DEFAULT 'fitness_challenge'
  CHECK (kind IN ('fitness_challenge', 'speed_fit'));

CREATE TRIGGER competitions_kind_fixed BEFORE UPDATE OF kind ON competitions
WHEN NEW.kind IS NOT OLD.kind
BEGIN
  SELECT RAISE(ABORT, 'The challenge type of a competition can''t be changed.');
END;

-- Fitness Challenge data never attaches to a Speed Fit competition, and vice versa.

CREATE TRIGGER stations_only_fitness_challenge BEFORE INSERT ON competition_stations
WHEN (SELECT kind FROM competitions WHERE id = NEW.competition_id) <> 'fitness_challenge'
BEGIN
  SELECT RAISE(ABORT, 'Speed Fit competitions have no stations.');
END;

CREATE TRIGGER scores_only_fitness_challenge BEFORE INSERT ON scores
WHEN (SELECT c.kind FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) <> 'fitness_challenge'
BEGIN
  SELECT RAISE(ABORT, 'Speed Fit competitions record times, not reps.');
END;

-- One time per entry, in milliseconds (hundredth-second precision), under 24 h.
CREATE TABLE speed_fit_times (
  entry_id   INTEGER PRIMARY KEY REFERENCES entries (id) ON DELETE CASCADE,
  time_ms    INTEGER NOT NULL CHECK (time_ms > 0 AND time_ms < 86400000),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER times_only_speed_fit BEFORE INSERT ON speed_fit_times
WHEN (SELECT c.kind FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) <> 'speed_fit'
BEGIN
  SELECT RAISE(ABORT, 'Only Speed Fit competitions record times.');
END;

-- Same lifecycle as scores (see 0002): editable only while running, frozen once finished.

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
