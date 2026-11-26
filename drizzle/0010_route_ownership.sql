ALTER TABLE routes ADD COLUMN IF NOT EXISTS user_id integer NOT NULL DEFAULT 1;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'Predeterminado';
DO $$ BEGIN
  ALTER TABLE routes ADD CONSTRAINT routes_origin_check
    CHECK (origen IN ('Predeterminado', 'Administración'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE routes SET user_id = 1 WHERE user_id IS NULL;
UPDATE routes SET origen = 'Predeterminado' WHERE origen IS NULL OR origen = '';
