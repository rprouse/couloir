-- src/storage/migrations/1.sql
-- Initial schema. Forward-compatible with Postgres when cloud sync arrives.
-- Avoid SQLite-specific column types; use plain TEXT/REAL/INTEGER.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
);

CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#888888',
  created_at  TEXT NOT NULL
);

CREATE TABLE routes (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL DEFAULT 'local',
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  geojson               TEXT NOT NULL,
  source_hash           TEXT NOT NULL,
  source_filename       TEXT,
  color                 TEXT NOT NULL DEFAULT '#E05C2A',
  ates                  TEXT,
  technical_difficulty  TEXT,
  distance_m            REAL NOT NULL DEFAULT 0,
  elevation_gain_m      REAL NOT NULL DEFAULT 0,
  elevation_loss_m      REAL NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE tracks (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL DEFAULT 'local',
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  geojson           TEXT NOT NULL,
  source_hash       TEXT NOT NULL,
  source_filename   TEXT,
  color             TEXT NOT NULL DEFAULT '#2A7BE0',
  distance_m        REAL NOT NULL DEFAULT 0,
  elevation_gain_m  REAL NOT NULL DEFAULT 0,
  elevation_loss_m  REAL NOT NULL DEFAULT 0,
  duration_s        REAL,
  moving_time_s     REAL,
  recorded_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE waypoints (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL DEFAULT 'local',
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  elevation_m   REAL,
  category      TEXT NOT NULL DEFAULT 'poi',
  color         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE photos (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL DEFAULT 'local',
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  lat                 REAL NOT NULL,
  lng                 REAL NOT NULL,
  elevation_m         REAL,
  camera_lat          REAL,
  camera_lng          REAL,
  camera_elevation_m  REAL,
  bearing             REAL,
  blob_ref            TEXT NOT NULL,
  width               INTEGER NOT NULL,
  height              INTEGER NOT NULL,
  file_size_bytes     INTEGER NOT NULL,
  taken_at            TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE entity_tags (
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  tag_id       TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_type, entity_id, tag_id)
);
CREATE INDEX idx_entity_tags_tag ON entity_tags(tag_id);
