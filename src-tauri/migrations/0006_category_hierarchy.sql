-- The category library becomes a hierarchy:
--   age group (typed freely: Junior, Senior, Masters…)
--     → sub-group: sex + age limits (e.g. Junior Men 14–23, Junior Women 16–23)
--       → level (Bronze, Silver, Gold…)
-- A competition category is one level of one sub-group. It is still copied into `categories`
-- (see 0004), now also keeping its age group and level so exports can name it properly.

CREATE TABLE age_groups (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

CREATE TABLE category_levels (
  id          INTEGER PRIMARY KEY,
  subgroup_id INTEGER NOT NULL REFERENCES age_subgroups (id) ON DELETE CASCADE,
  name        TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
  UNIQUE (subgroup_id, name)
);

-- Each old flat preset becomes an age group with one sub-group; its levels are added afterwards.
INSERT INTO age_groups (id, name) SELECT id, name FROM category_presets;
INSERT INTO age_subgroups (age_group_id, gender, min_age, max_age)
SELECT id, gender, min_age, max_age FROM category_presets ORDER BY id;
DROP TABLE category_presets;

-- Empty for categories created before the hierarchy; those keep using their name.
ALTER TABLE categories ADD COLUMN age_group TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN level TEXT NOT NULL DEFAULT '';
