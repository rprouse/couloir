-- Migration 3: a waypoint can override its category's icon with a
-- Material Symbol name (see src/icons/waypointIcons.ts). NULL = category default.
ALTER TABLE waypoints ADD COLUMN icon TEXT;
