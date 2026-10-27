# Deploying Couloir

Couloir runs as one Docker container. It serves the web app and its API on a single port and keeps everything it stores under one directory:

```
/data
├── couloir.db            SQLite database (WAL mode; -wal/-shm files beside it are normal)
├── photos/{id}.jpg       full-size photos
├── photos/{id}_thumb.jpg thumbnails
└── backups/              daily database snapshots, couloir-YYYYMMDD.db
```

> **There is no login.** Anyone who can reach the port can read and change everything. Keep it on your home network or your tailnet, and **never port-forward it to the internet.**

## Image

Every push to `main` runs the tests and publishes `ghcr.io/rprouse/couloir:latest` and `:sha-<short commit>` (`.github/workflows/docker.yml`).

GitHub makes a new container package **private**. Either:

- make it public: GitHub → your profile → Packages → `couloir` → Package settings → Change visibility, or
- log Unraid in to GHCR: create a personal access token (classic) with `read:packages`, then run `docker login ghcr.io -u rprouse` on the Unraid terminal and paste the token as the password.

To build locally instead: `docker build -t couloir:local .`

## Install on Unraid

1. Copy `deploy/unraid/couloir.xml` to `/boot/config/plugins/dockerMan/templates-user/my-couloir.xml` on the flash drive.
2. Docker tab → **Add Container** → Template: **couloir**.
3. Check the settings:
   - **Web UI port** `8080`
   - **Data** `/mnt/user/appdata/couloir`
   - **Maptiler API key** (optional). Browsers that haven't entered their own key use this one, so a new computer goes straight to the map.
   - **Backups to keep** `14`
4. **Apply.** The template runs the container as `99:100` (nobody:users), the usual owner of appdata, so the files it creates are manageable from shares.

Open `http://<unraid-ip>:8080`.

### Without the template

```sh
docker run -d --name couloir --restart unless-stopped \
  --user 99:100 \
  -p 8080:8080 \
  -v /mnt/user/appdata/couloir:/data \
  -e MAPTILER_KEY=your-key \
  ghcr.io/rprouse/couloir:latest
```

### Settings

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port inside the container |
| `DATA_DIR` | `/data` | Where the database, photos and backups live |
| `MAPTILER_KEY` | unset | Maptiler key for browsers that have none of their own |
| `BACKUP_KEEP` | `14` | Daily snapshots kept in `backups/` (at least 1) |

## Moving your existing data across

Before the server existed, Couloir kept everything in each browser's own storage. To bring that library over:

1. On the computer and browser that hold the data, run the last browser-storage build:
   ```sh
   git fetch --tags
   git switch --detach last-opfs
   npm ci
   npm run dev
   ```
2. Open **the same address you always used**, normally `http://localhost:5173`. Browser storage is tied to the exact address, so a different port shows an empty library.
3. Settings → Backup → **Export backup…**. Keep the ZIP somewhere safe.
4. Open the server (`http://<unraid-ip>:8080`), then Settings → Backup → **Restore from backup…** and choose that ZIP.
5. Spot-check: route, track, waypoint and photo counts in the Layers panel, a few photos at full size, and tags.

Restore merges by `updated_at`, so running it twice is harmless.

## Backups

- **Daily database snapshots.** At startup and every 24 hours the server writes a consistent copy of the database to `backups/couloir-YYYYMMDD.db` (UTC date) and keeps the newest `BACKUP_KEEP`. Settings → **Download the database only** grabs a fresh one on demand.
- **Photos are not in those snapshots.** They're immutable files in `photos/`. **Back up the whole data folder**, for example with the *Appdata Backup* plugin, which stops the container while it copies.
- **Off-box copy.** Settings → Backup → **Export backup…** makes a ZIP of everything, photos included. Keep one somewhere other than the server now and then.

To restore: stop the container, replace `couloir.db` with a snapshot (deleting any `couloir.db-wal` and `couloir.db-shm` beside it), make sure `photos/` is intact, then start it. Alternatively, start with an empty data folder and use **Restore from backup…** with a ZIP export.

## Reaching it from other computers

Plain `http://<unraid-ip>:8080` works from any browser on the LAN. Browsers treat that address as insecure, so Couloir can't be *installed* as an app there. Everything else works.

For HTTPS, and for access away from home, pick one:

- **Tailscale (recommended).** Install the Tailscale plugin on Unraid, then on the Unraid terminal run:
  ```sh
  tailscale serve --bg http://localhost:8080
  ```
  Couloir is then at `https://<unraid-machine-name>.<your-tailnet>.ts.net` with a real certificate, from any device on your tailnet: laptop, phone, at the trailhead. Being on the tailnet is the access control. `tailscale serve status` shows the setup, and `tailscale serve reset` removes it.
- **A reverse proxy you already run** (SWAG, Nginx Proxy Manager) with a LAN or DNS-challenge certificate. Proxy to `http://<unraid-ip>:8080`. Uploads can be several MB per photo, and a ZIP restore can be hundreds of MB, so raise the proxy's body-size limit (for nginx, `client_max_body_size 0;`). Don't expose it to the internet without putting authentication in front.

## Updating

Pull the new image (Unraid: **Check for updates**, then **Apply update**). Database migrations run automatically at startup. A database newer than the image, after a downgrade, makes the server refuse to start rather than risk it. Restore a snapshot from before the upgrade if you need to go back.

If a browser shows an old version after an update, reload it. The app checks for a new version on each load.

## Troubleshooting

- **Logs:** Docker tab → couloir → Logs. Startup prints the data directory, whether a Maptiler key is set, and each backup. Errors are prefixed `[couloir]`.
- **"Couloir failed to start" in the browser:** the page loaded but the API didn't answer. Check that the container is running and healthy.
- **Permission errors on startup** (`EACCES ... mkdir '/data/photos'`): the data folder must be writable by the container user. With the template that's `99:100`: `chown -R nobody:users /mnt/user/appdata/couloir`. Mount a host path, as above. A *new named Docker volume* takes the image's ownership (the `node` user), so `--user 99:100` can't write to it.
- **Health:** `curl http://<unraid-ip>:8080/api/health` returns `{"ok":true,"schemaVersion":N}`. Docker also polls it, so the container shows as *healthy* or *unhealthy*.
