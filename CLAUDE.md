# Couloir - Claude Code Context

This file is read automatically by Claude Code at the start of every session.

## What This Project Is

Couloir is a personal backcountry ski route library. A map-centric web application for managing GPX routes, recorded tracks, terrain waypoints, and geolocated recon photographs. Built with React + Vite + TypeScript + MapLibre GL JS + Maptiler + SQLite via OPFS.

## Always Read First

Before writing any code in a new session, read these documents in order:

1. `SPEC.md` - what we are building and why
2. `ARCHITECTURE.md` - tech stack, folder structure, storage interface, conventions
3. `DATA-MODEL.md` - TypeScript types, SQLite schema, constants

## Key Conventions

- All data access goes through the `StorageProvider` interface in `src/storage/interface.ts`. Never call SQLite directly from feature code.
- All entity IDs are UUIDs generated with `crypto.randomUUID()`.
- Tags stored as JSON arrays of IDs in entity rows - not junction tables.
- GeoJSON LineStrings include Z coordinate (elevation) for routes and tracks.
- Photo blobs stored in OPFS at `photos/{id}.jpg`, thumbnails at `photos/{id}_thumb.jpg`.
- Maptiler API key stored in `localStorage` under key `couloir_maptiler_key`.
- Dark theme throughout. CSS custom properties for all colors.
- CSS Modules for component styles.

## Current Phase

Always check the `## Progress` section near the top of `TASKS.md` first — the first unchecked task is the current one. Update it with `- [x]` immediately after each task is completed.

The detailed implementation plan for the phase in flight lives in `docs/superpowers/plans/` (the Progress section links to the active plan). Each plan has bite-sized checkbox steps — tick those as you work through them.

If no plan exists yet for the current phase, write one (`superpowers:writing-plans`) before starting implementation. Plans are written just-in-time, one phase at a time.

## Coding Style

- TypeScript strict mode. No `any` types without a comment explaining why.
- Functional React components only. No class components.
- Zustand for all state. No prop drilling beyond one level.
- Prefer explicit over implicit. Name things clearly.
- No console.log left in committed code. Use a `debug()` utility if needed.
- Error states must be handled. No unhandled promise rejections.

## Never Do

- Do not write SQL directly in component or store files. Storage goes through the interface.
- Do not store sensitive data in localStorage beyond the API key.
- Do not use `any` in TypeScript types for entity data.
- Do not add dependencies without flagging it for review first.
- Do not modify the StorageProvider interface without updating both the OPFS implementation and this document.
