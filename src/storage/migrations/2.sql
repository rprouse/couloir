-- Migration 2: a photo has one position — where it was taken.
-- Rows that carried an EXIF camera position adopt it; rows without one keep
-- their user-placed lat/lng. elevation_m follows the position it describes.
UPDATE photos
   SET lat         = camera_lat,
       lng         = camera_lng,
       elevation_m = camera_elevation_m
 WHERE camera_lat IS NOT NULL
   AND camera_lng IS NOT NULL;

ALTER TABLE photos DROP COLUMN camera_lat;
ALTER TABLE photos DROP COLUMN camera_lng;
ALTER TABLE photos DROP COLUMN camera_elevation_m;
