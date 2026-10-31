-- Dates are ISO "YYYY-MM-DD" text; `date(x) IS x` rejects anything SQLite can't parse back to itself.

CREATE TABLE athletes (
  id            INTEGER PRIMARY KEY,
  first_name    TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
  last_name     TEXT NOT NULL CHECK (length(trim(last_name)) > 0),
  date_of_birth TEXT NOT NULL CHECK (date(date_of_birth) IS date_of_birth),
  sex           TEXT NOT NULL CHECK (sex IN ('male', 'female')),
  -- ISO 3166-1 alpha-3, e.g. "ROU".
  country       TEXT NOT NULL CHECK (length(country) = 3 AND country = upper(country)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX athletes_by_name ON athletes (last_name, first_name);

CREATE TABLE exercises (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE competitions (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  date        TEXT NOT NULL CHECK (date(date) IS date),
  location    TEXT NOT NULL DEFAULT '',
  -- draft: setup editable · running: setup frozen, reps editable · finished: everything frozen.
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'finished')),
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The station count of a competition is the number of rows here; the exercise is picked
-- while in draft and must be set on every station before the competition can start.
CREATE TABLE competition_stations (
  competition_id INTEGER NOT NULL REFERENCES competitions (id) ON DELETE CASCADE,
  station_number INTEGER NOT NULL CHECK (station_number >= 1),
  exercise_id    INTEGER REFERENCES exercises (id) ON DELETE RESTRICT,
  PRIMARY KEY (competition_id, station_number)
);

CREATE TABLE categories (
  id             INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions (id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
  gender         TEXT NOT NULL CHECK (gender IN ('male', 'female', 'mixed')),
  -- Inclusive bounds on the athlete's age on the competition date; NULL = open.
  min_age        INTEGER CHECK (min_age IS NULL OR min_age BETWEEN 0 AND 120),
  max_age        INTEGER CHECK (max_age IS NULL OR max_age BETWEEN 0 AND 120),
  CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age),
  UNIQUE (competition_id, name)
);

-- One entry per athlete per competition, so the bib number identifies the athlete for the whole event.
CREATE TABLE entries (
  id             INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions (id) ON DELETE CASCADE,
  category_id    INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  athlete_id     INTEGER NOT NULL REFERENCES athletes (id) ON DELETE RESTRICT,
  bib_number     INTEGER NOT NULL CHECK (bib_number >= 1),
  UNIQUE (competition_id, athlete_id),
  UNIQUE (competition_id, bib_number)
);
CREATE INDEX entries_by_category ON entries (category_id);

CREATE TABLE scores (
  entry_id       INTEGER NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  station_number INTEGER NOT NULL CHECK (station_number >= 1),
  reps           INTEGER NOT NULL CHECK (reps BETWEEN 0 AND 9999),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entry_id, station_number)
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id          INTEGER PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE CHECK (length(trim(username)) > 0),
  password_hash TEXT NOT NULL CHECK (length(password_hash) > 0),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'))
)

