-- Migration 4: ATES terrain ratings imported from Avalanche Canada KMZ files
-- (src/utils/atesKml.ts), one row per area. geojson is a FeatureCollection
-- (see AtesArea in src/types/index.ts). Areas are not tagged.
CREATE TABLE ates_areas (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  geojson         TEXT NOT NULL,
  imported_at     TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
