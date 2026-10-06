-- Category libraries per federation and challenge type: an age group belongs to one federation
-- (IFBB or Romania) and one challenge type (Fitness Challenge or Speed Fit), and its name only
-- needs to be unique within that library.
-- The existing library becomes the IFBB Fitness Challenge one; the others start empty.
--
-- SQLite can't drop the old UNIQUE (name), so the three library tables are rebuilt, keeping ids.
-- Children are copied aside and dropped first, so dropping a parent cascades into nothing.
-- Competitions don't reference the library (they hold copies), so they are unaffected.

CREATE TABLE age_groups_backup AS SELECT * FROM age_groups;
CREATE TABLE age_subgroups_backup AS SELECT * FROM age_subgroups;
CREATE TABLE category_levels_backup AS SELECT * FROM category_levels;

DROP TABLE category_levels;
DROP TABLE age_subgroups;
DROP TABLE age_groups;

CREATE TABLE age_groups (
  id         INTEGER PRIMARY KEY,
  federation TEXT NOT NULL CHECK (federation IN ('ifbb', 'romania')),
  kind       TEXT NOT NULL CHECK (kind IN ('fitness_challenge', 'speed_fit')),
  name       TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (federation, kind, name)
);

CREATE TABLE age_subgroups (
  id           INTEGER PRIMARY KEY,
  age_group_id INTEGER NOT NULL REFERENCES age_groups (id) ON DELETE CASCADE,
  gender       TEXT NOT NULL CHECK (gender IN ('male', 'female', 'mixed')),
  min_age      INTEGER CHECK (min_age IS NULL OR min_age BETWEEN 0 AND 120),
  max_age      INTEGER CHECK (max_age IS NULL OR max_age BETWEEN 0 AND 120),
  CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
);
CREATE INDEX age_subgroups_by_group ON age_subgroups (age_group_id);
-- From 0008: NULL ("no limit") counts as equal to NULL.
CREATE UNIQUE INDEX age_subgroups_unique ON age_subgroups (age_group_id, gender, ifnull(min_age, -1), ifnull(max_age, -1));

CREATE TABLE category_levels (
  id          INTEGER PRIMARY KEY,
  subgroup_id INTEGER NOT NULL REFERENCES age_subgroups (id) ON DELETE CASCADE,
  name        TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  UNIQUE (subgroup_id, name)
);

INSERT INTO age_groups (id, federation, kind, name, created_at)
SELECT id, 'ifbb', 'fitness_challenge', name, created_at FROM age_groups_backup;
INSERT INTO age_subgroups (id, age_group_id, gender, min_age, max_age)
SELECT id, age_group_id, gender, min_age, max_age FROM age_subgroups_backup;
INSERT INTO category_levels (id, subgroup_id, name)
SELECT id, subgroup_id, name FROM category_levels_backup;

DROP TABLE age_groups_backup;
DROP TABLE age_subgroups_backup;
DROP TABLE category_levels_backup;
