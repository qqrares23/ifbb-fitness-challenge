-- A reusable category library, managed like the exercise library. A competition picks from it;
-- the chosen categories are copied into `categories`, so editing the library later never
-- rewrites the rules of a competition that already used them.

CREATE TABLE category_presets (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
  gender     TEXT NOT NULL CHECK (gender IN ('male', 'female', 'mixed')),
  min_age    INTEGER CHECK (min_age IS NULL OR min_age BETWEEN 0 AND 120),
  max_age    INTEGER CHECK (max_age IS NULL OR max_age BETWEEN 0 AND 120),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age)
);

-- Start the library from the categories already created inside competitions (first one wins
-- when several competitions used the same name).
INSERT OR IGNORE INTO category_presets (name, gender, min_age, max_age)
SELECT name, gender, min_age, max_age FROM categories ORDER BY id;
