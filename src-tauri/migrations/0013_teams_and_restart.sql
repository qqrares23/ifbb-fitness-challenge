-- 1) Couples and teams. A library sub-group, and the competition category copied from it, is
--    for individuals, couples (2 athletes) or teams (4 athletes), of any sex rule and ages, with
--    or without levels. A couple or team is one entry (one number, one result); its athletes are
--    in entry_members, and entries.athlete_id is its first member.
-- 2) Categories remember the federation of the library they came from (IFBB exports of Fitness
--    Challenge results leave out the club).
-- 3) Restart: a running or finished competition can go back to draft. That deletes its results
--    and late-entry marks; stations, categories and athletes are kept.

ALTER TABLE age_subgroups ADD COLUMN format TEXT NOT NULL DEFAULT 'individual' CHECK (format IN ('individual', 'couple', 'team'));
DROP INDEX age_subgroups_unique;
CREATE UNIQUE INDEX age_subgroups_unique ON age_subgroups (age_group_id, format, gender, ifnull(min_age, -1), ifnull(max_age, -1));

ALTER TABLE categories ADD COLUMN format TEXT NOT NULL DEFAULT 'individual' CHECK (format IN ('individual', 'couple', 'team'));
ALTER TABLE categories ADD COLUMN federation TEXT CHECK (federation IS NULL OR federation IN ('ifbb', 'romania'));

-- Existing categories: the federation whose library (of the competition's challenge type) has an
-- age group of that name, when only one does. The finished-competition lock is lifted meanwhile.
DROP TRIGGER categories_locked_when_finished_update;
UPDATE categories SET federation = (
  SELECT CASE WHEN COUNT(DISTINCT g.federation) = 1 THEN MIN(g.federation) END
  FROM age_groups g JOIN competitions c ON c.id = categories.competition_id
  WHERE g.kind = c.kind AND g.name = categories.age_group
);
CREATE TRIGGER categories_locked_when_finished_update BEFORE UPDATE ON categories
WHEN (SELECT status FROM competitions WHERE id = OLD.competition_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change categories.');
END;

CREATE TRIGGER categories_format_fixed BEFORE UPDATE OF format ON categories
WHEN NEW.format IS NOT OLD.format
BEGIN
  SELECT RAISE(ABORT, 'A category can''t change between individuals, couples and teams.');
END;

CREATE TABLE entry_members (
  entry_id   INTEGER NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES athletes (id) ON DELETE RESTRICT,
  position   INTEGER NOT NULL CHECK (position >= 1),
  PRIMARY KEY (entry_id, athlete_id),
  UNIQUE (entry_id, position)
);
CREATE INDEX entry_members_by_athlete ON entry_members (athlete_id);

CREATE TRIGGER entry_members_only_couples_and_teams BEFORE INSERT ON entry_members
WHEN (SELECT k.format FROM entries e JOIN categories k ON k.id = e.category_id WHERE e.id = NEW.entry_id) IS NOT 'couple'
  AND (SELECT k.format FROM entries e JOIN categories k ON k.id = e.category_id WHERE e.id = NEW.entry_id) IS NOT 'team'
BEGIN
  SELECT RAISE(ABORT, 'Only couples and teams have members.');
END;

CREATE TRIGGER entry_members_size BEFORE INSERT ON entry_members
WHEN (SELECT COUNT(*) FROM entry_members WHERE entry_id = NEW.entry_id)
  >= (SELECT CASE k.format WHEN 'couple' THEN 2 ELSE 4 END FROM entries e JOIN categories k ON k.id = e.category_id WHERE e.id = NEW.entry_id)
BEGIN
  SELECT RAISE(ABORT, 'A couple has 2 athletes and a team 4.');
END;

CREATE TRIGGER entry_members_once_per_category BEFORE INSERT ON entry_members
WHEN EXISTS (
  SELECT 1 FROM entry_members m JOIN entries e ON e.id = m.entry_id
  WHERE m.athlete_id = NEW.athlete_id AND m.entry_id <> NEW.entry_id
    AND e.category_id = (SELECT category_id FROM entries WHERE id = NEW.entry_id)
)
BEGIN
  SELECT RAISE(ABORT, 'An athlete can be in only one couple or team per category.');
END;

-- Same lifecycle as entries (0005): changeable until the competition is finished.
CREATE TRIGGER entry_members_locked_when_finished_insert BEFORE INSERT ON entry_members
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = NEW.entry_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change athletes.');
END;

CREATE TRIGGER entry_members_locked_when_finished_update BEFORE UPDATE ON entry_members
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = OLD.entry_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change athletes.');
END;

CREATE TRIGGER entry_members_locked_when_finished_delete BEFORE DELETE ON entry_members
WHEN (SELECT c.status FROM entries e JOIN competitions c ON c.id = e.competition_id WHERE e.id = OLD.entry_id) = 'finished'
BEGIN
  SELECT RAISE(ABORT, 'The competition is finished. Reopen it to change athletes.');
END;

-- A couple or team only moves to another category of the same kind, where none of its athletes is
-- in another couple or team already.
CREATE TRIGGER entries_category_same_format BEFORE UPDATE OF category_id ON entries
WHEN (SELECT format FROM categories WHERE id = NEW.category_id) IS NOT (SELECT format FROM categories WHERE id = OLD.category_id)
BEGIN
  SELECT RAISE(ABORT, 'An entry can only move to a category of the same kind (individual, couple or team).');
END;

CREATE TRIGGER entries_members_once_per_category_update BEFORE UPDATE OF category_id ON entries
WHEN EXISTS (
  SELECT 1 FROM entry_members m
  JOIN entry_members o ON o.athlete_id = m.athlete_id AND o.entry_id <> m.entry_id
  JOIN entries oe ON oe.id = o.entry_id
  WHERE m.entry_id = OLD.id AND oe.category_id = NEW.category_id
)
BEGIN
  SELECT RAISE(ABORT, 'An athlete can be in only one couple or team per category.');
END;

-- Numbers (replacing 0007): an athlete keeps one number across their individual entries; a
-- couple or team has its own number. No number is used by two athletes, or by a team and anyone else.
DROP TRIGGER entries_bib_taken_insert;
DROP TRIGGER entries_bib_taken_update;
DROP TRIGGER entries_one_bib_per_athlete;

CREATE TRIGGER entries_bib_taken_insert BEFORE INSERT ON entries
WHEN EXISTS (
  SELECT 1 FROM entries x JOIN categories k ON k.id = x.category_id
  WHERE x.competition_id = NEW.competition_id AND x.bib_number = NEW.bib_number
    AND (x.athlete_id <> NEW.athlete_id OR k.format <> 'individual' OR (SELECT format FROM categories WHERE id = NEW.category_id) <> 'individual')
)
BEGIN
  SELECT RAISE(ABORT, 'That number belongs to another athlete or team in this competition.');
END;

CREATE TRIGGER entries_bib_taken_update BEFORE UPDATE OF bib_number ON entries
WHEN EXISTS (
  SELECT 1 FROM entries x JOIN categories k ON k.id = x.category_id
  WHERE x.competition_id = NEW.competition_id AND x.bib_number = NEW.bib_number AND x.id <> NEW.id
    AND (x.athlete_id <> NEW.athlete_id OR k.format <> 'individual' OR (SELECT format FROM categories WHERE id = NEW.category_id) <> 'individual')
)
BEGIN
  SELECT RAISE(ABORT, 'That number belongs to another athlete or team in this competition.');
END;

CREATE TRIGGER entries_one_bib_per_athlete BEFORE INSERT ON entries
WHEN (SELECT format FROM categories WHERE id = NEW.category_id) = 'individual'
  AND EXISTS (
    SELECT 1 FROM entries x JOIN categories k ON k.id = x.category_id
    WHERE x.competition_id = NEW.competition_id AND x.athlete_id = NEW.athlete_id AND k.format = 'individual' AND x.bib_number <> NEW.bib_number
  )
BEGIN
  SELECT RAISE(ABORT, 'This athlete already has a different number in this competition.');
END;

-- Restart (replacing the status flow of 0002).
DROP TRIGGER competitions_status_flow;
CREATE TRIGGER competitions_status_flow BEFORE UPDATE OF status ON competitions
WHEN OLD.status <> NEW.status
  AND (OLD.status, NEW.status) NOT IN (VALUES ('draft', 'running'), ('running', 'finished'), ('finished', 'running'), ('running', 'draft'), ('finished', 'draft'))
BEGIN
  SELECT RAISE(ABORT, 'That competition status change is not allowed.');
END;

-- Runs after the status is already draft, so the results locks (finished only) don't apply.
CREATE TRIGGER competitions_restart AFTER UPDATE OF status ON competitions
WHEN NEW.status = 'draft' AND OLD.status <> 'draft'
BEGIN
  DELETE FROM scores WHERE entry_id IN (SELECT id FROM entries WHERE competition_id = NEW.id);
  DELETE FROM speed_fit_times WHERE entry_id IN (SELECT id FROM entries WHERE competition_id = NEW.id);
  UPDATE entries SET late_entry = 0 WHERE competition_id = NEW.id AND late_entry = 1;
END;
