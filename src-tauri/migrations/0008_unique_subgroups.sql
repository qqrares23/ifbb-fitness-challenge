-- An age group can't have two sub-groups with the same sex and ages: they would produce
-- competition categories with the same name.
--
-- Existing duplicates are merged into the oldest one: their levels move over (a level whose
-- name the oldest already has is dropped with its duplicate sub-group).

UPDATE OR IGNORE category_levels SET subgroup_id = (
  SELECT MIN(k.id)
  FROM age_subgroups s
  JOIN age_subgroups k
    ON k.age_group_id = s.age_group_id AND k.gender = s.gender AND k.min_age IS s.min_age AND k.max_age IS s.max_age
  WHERE s.id = category_levels.subgroup_id
);

DELETE FROM age_subgroups WHERE id <> (
  SELECT MIN(k.id) FROM age_subgroups k
  WHERE k.age_group_id = age_subgroups.age_group_id AND k.gender = age_subgroups.gender
    AND k.min_age IS age_subgroups.min_age AND k.max_age IS age_subgroups.max_age
);

-- NULL ("no limit") must count as equal to NULL here, which a plain UNIQUE doesn't do.
CREATE UNIQUE INDEX age_subgroups_unique ON age_subgroups (age_group_id, gender, ifnull(min_age, -1), ifnull(max_age, -1));
