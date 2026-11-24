CREATE TABLE IF NOT EXISTS sponsors (
  id serial PRIMARY KEY,
  name text NOT NULL,
  business_name text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  CONSTRAINT sponsors_business_name_unique UNIQUE (business_name),
  CONSTRAINT sponsors_text_check CHECK (length(trim(business_name)) > 0 and length(trim(address)) > 0),
  CONSTRAINT sponsors_latitude_check CHECK (latitude between -90 and 90),
  CONSTRAINT sponsors_longitude_check CHECK (longitude between -180 and 180)
);
CREATE INDEX IF NOT EXISTS sponsors_coordinates_idx ON sponsors (latitude, longitude);
