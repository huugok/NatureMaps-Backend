ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_theme_check;
ALTER TABLE routes ADD CONSTRAINT routes_theme_check
  CHECK (theme IN ('botanica', 'cultural', 'mixta', 'sponsor'));
