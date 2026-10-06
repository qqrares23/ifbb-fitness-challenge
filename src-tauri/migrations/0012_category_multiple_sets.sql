-- A category can be scored on several station sets (Set A, Set B…): each set is ranked on its
-- own, plus an overall ranking that adds up the sets. The sets a category uses move from
-- categories.station_set_id to this link table. (That column stays, unused: SQLite can't drop
-- a column that has a foreign key, and rebuilding categories would mean rebuilding its children.)

CREATE TABLE category_station_sets (
  category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  set_id      INTEGER NOT NULL REFERENCES station_sets (id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, set_id)
);
CREATE INDEX category_station_sets_by_set ON category_station_sets (set_id);

INSERT INTO category_station_sets (category_id, set_id)
SELECT id, station_set_id FROM categories WHERE station_set_id IS NOT NULL;

DROP TRIGGER categories_station_set_same_competition_insert;
DROP TRIGGER categories_station_set_same_competition_update;
-- (Not cleared: an UPDATE would trip the finished-competition lock on categories, and nothing
-- reads the column any more.)

-- A new Fitness Challenge category starts on the competition's first set (if it has one).
CREATE TRIGGER categories_first_station_set AFTER INSERT ON categories
WHEN (SELECT MIN(id) FROM station_sets WHERE competition_id = NEW.competition_id) IS NOT NULL
BEGIN
  INSERT INTO category_station_sets (category_id, set_id)
  VALUES (NEW.id, (SELECT MIN(id) FROM station_sets WHERE competition_id = NEW.competition_id));
END;

CREATE TRIGGER category_station_sets_same_competition BEFORE INSERT ON category_station_sets
WHEN (SELECT competition_id FROM station_sets WHERE id = NEW.set_id) IS NOT (SELECT competition_id FROM categories WHERE id = NEW.category_id)
BEGIN
  SELECT RAISE(ABORT, 'That station set belongs to a different competition.');
END;

-- Same lifecycle as the rest of the setup (0010): editable until the competition is finished.
-- During a cascade delete of a competition its row is already gone, so the lookups return NULL.
CREATE TRIGGER category_station_sets_locked_when_finished_insert BEFORE INSERT ON category_station_sets
WHEN (SELECT c.status FROM categories k JOIN competitions c ON c.id = k.competition_id WHERE k.id = NEW.category_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change categories.');
END;

CREATE TRIGGER category_station_sets_locked_when_finished_delete BEFORE DELETE ON category_station_sets
WHEN (SELECT c.status FROM categories k JOIN competitions c ON c.id = k.competition_id WHERE k.id = OLD.category_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change categories.');
END;

-- Reps go on any set the athlete's category uses. Reps on a set the category stops using are
-- kept (they come back if the set is added again).
DROP TRIGGER scores_on_category_set;
CREATE TRIGGER scores_on_category_set BEFORE INSERT ON scores
WHEN NOT EXISTS (
  SELECT 1 FROM entries e JOIN category_station_sets cs ON cs.category_id = e.category_id
  WHERE e.id = NEW.entry_id AND cs.set_id = NEW.set_id
)
BEGIN
  SELECT RAISE(ABORT, 'Reps can only be entered on a station set of the athlete''s category.');
END;
