-- Athletes can belong to a club (optional, free text; the app suggests clubs already used).
ALTER TABLE athletes ADD COLUMN club TEXT NOT NULL DEFAULT '';

-- Exercises can have a photo, so a judge can see how it is performed. Stored as an image
-- data URL (resized by the app before saving), so it travels with database exports.
ALTER TABLE exercises ADD COLUMN photo TEXT;
