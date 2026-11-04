-- Speed Fit moves from the competition to the category: one competition can hold Fitness
-- Challenge categories (reps per station) and Speed Fit categories (one time) side by side.
-- Existing categories take their competition's type, so old Speed Fit competitions become
-- competitions whose categories are all Speed Fit. competitions.kind stays, unused: dropping it
-- would mean dropping the triggers of 0003 that name it, for no gain.

ALTER TABLE categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'fitness_challenge'
  CHECK (kind IN ('fitness_challenge', 'speed_fit'));

-- The finished-competition lock is lifted meanwhile (as in 0013).
DROP TRIGGER categories_locked_when_finished_update;
UPDATE categories SET kind = (SELECT kind FROM competitions WHERE id = categories.competition_id);
-- Library categories are named from their parts on read, now with "Speed Fit · " in front (unless
-- the name already says it, see withKind in src/lib/labels.ts). Stored names follow, so a Fitness
-- Challenge category of the same name can join the competition.
UPDATE categories SET name = 'Speed Fit · ' || name
WHERE kind = 'speed_fit' AND age_group IS NOT NULL
  AND replace(replace(replace(replace(lower(name), ' ', ''), '-', ''), '·', ''), '_', '') NOT LIKE '%speedfit%';
CREATE TRIGGER categories_locked_when_finished_update BEFORE UPDATE ON categories
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change categories.');
END;

CREATE TRIGGER categories_kind_fixed BEFORE UPDATE OF kind ON categories
WHEN NEW.kind IS NOT OLD.kind
BEGIN
  SELECT RAISE(ABORT, 'A category can''t change between Fitness Challenge and Speed Fit.');
END;

-- Reps only for Fitness Challenge categories, times only for Speed Fit ones.
-- (Lost since 0010 rebuilt scores; restored here.)
DROP TRIGGER IF EXISTS scores_only_fitness_challenge;
CREATE TRIGGER scores_only_fitness_challenge BEFORE INSERT ON scores
WHEN (SELECT k.kind FROM entries e JOIN categories k ON k.id = e.category_id WHERE e.id = NEW.entry_id) <> 'fitness_challenge'
BEGIN
  SELECT RAISE(ABORT, 'Speed Fit categories record times, not reps.');
END;

DROP TRIGGER IF EXISTS times_only_speed_fit;
CREATE TRIGGER times_only_speed_fit BEFORE INSERT ON speed_fit_times
WHEN (SELECT k.kind FROM entries e JOIN categories k ON k.id = e.category_id WHERE e.id = NEW.entry_id) <> 'speed_fit'
BEGIN
  SELECT RAISE(ABORT, 'Only Speed Fit categories record times.');
END;

-- Any competition can have stations now (an old Speed Fit one gains them when it adds a
-- Fitness Challenge category). Every new competition starts with "Set A".
DROP TRIGGER IF EXISTS stations_only_fitness_challenge;
DROP TRIGGER station_sets_only_fitness_challenge;
DROP TRIGGER competitions_first_station_set;
CREATE TRIGGER competitions_first_station_set AFTER INSERT ON competitions
BEGIN
  INSERT INTO station_sets (competition_id, name) VALUES (NEW.id, 'Set A');
END;

-- Old Speed Fit competitions get theirs too, ready for a Fitness Challenge category (a finished
-- one is locked; "Add station set" covers it once reopened).
INSERT INTO station_sets (competition_id, name)
SELECT id, 'Set A' FROM competitions c WHERE status <> 'finished' AND NOT EXISTS (SELECT 1 FROM station_sets WHERE competition_id = c.id);

-- Only Fitness Challenge categories are scored on a station set.
DROP TRIGGER categories_first_station_set;
CREATE TRIGGER categories_first_station_set AFTER INSERT ON categories
WHEN NEW.kind = 'fitness_challenge' AND (SELECT MIN(id) FROM station_sets WHERE competition_id = NEW.competition_id) IS NOT NULL
BEGIN
  INSERT INTO category_station_sets (category_id, set_id)
  VALUES (NEW.id, (SELECT MIN(id) FROM station_sets WHERE competition_id = NEW.competition_id));
END;

CREATE TRIGGER category_station_sets_only_fitness_challenge BEFORE INSERT ON category_station_sets
WHEN (SELECT kind FROM categories WHERE id = NEW.category_id) <> 'fitness_challenge'
BEGIN
  SELECT RAISE(ABORT, 'Speed Fit categories have no stations.');
END;

-- An entry stays in its challenge: reps and a time don't convert.
CREATE TRIGGER entries_category_same_kind BEFORE UPDATE OF category_id ON entries
WHEN (SELECT kind FROM categories WHERE id = NEW.category_id) IS NOT (SELECT kind FROM categories WHERE id = OLD.category_id)
BEGIN
  SELECT RAISE(ABORT, 'An entry can only move to a category of the same challenge (Fitness Challenge or Speed Fit).');
END;
