# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

> **Read `readerly-v2-product-definition.md` first — it is the real source of truth.**
> This file only describes how the folder is laid out. Every decision about what
> Readerly is, its data model, endpoints, phases, and security rules lives in the
> product definition. When the two disagree, the product definition wins.

## What this is

Readerly v2 is a two-part web app: a curated Nigerian digital reading subscription
(shipping first) and, later, a physical-book marketplace. It is being built in
phases (see section 10 of the product definition). This folder is the workspace for
that build.

## Folder structure

- **`readerly-api/`** — the backend. A Next.js (App Router, JavaScript) project used
  **only as an API** (no UI). Talks to PostgreSQL on Supabase via `pg`, issues JWTs,
  and (from Phase 2) mints Supabase Storage signed upload URLs. Deployed to Vercel.
  Secrets live in `readerly-api/.env.local`, which is git-ignored and must never be
  committed. See `readerly-api/README.md` and `.env.example`.
- **`readerly-frontend/`** — the frontend. Plain HTML/CSS/JS, no framework, no build
  step. Calls the API over HTTP/JSON. Deployed to Netlify. Key shared scripts:
  `js/config.js` (API base URL), `js/api.js` (fetch wrapper), `js/auth.js` (user
  session + page guards), `js/admin-auth.js` (separate admin session).
- **`schema.sql`** — the complete Supabase/PostgreSQL schema (all tables for every
  phase, plus the seeded categories). Run once, top to bottom, in the Supabase SQL
  editor. Mirrors section 5 of the product definition.
- **`v1-archive/`** — the original Readerly v1 static site (`index.html`, `script.js`,
  `style.css`), kept for reference only. **It is never run or deployed** and is not
  part of the v2 build. Don't edit it or wire it into anything.
- **`readerly-v2-product-definition.md`** — the source of truth (read this first).
- **`readerly-phase-0-build-order.md`** — the detailed Phase 0 setup runbook.

## Running / testing

There is no shared build or test tooling across the two projects.

- **API:** `cd readerly-api && npm run dev` → `http://localhost:3000`. Needs
  `.env.local` (copy from `.env.example`). Health check: `GET /api/health`.
- **Frontend:** serve `readerly-frontend/` with any static server on the origin that
  matches `FRONTEND_URL` in the API's `.env.local` (e.g. `http://localhost:5500`) so
  CORS passes. `js/config.js` auto-targets localhost vs. the deployed Vercel API.

## Conventions that matter

- **The product definition is authoritative.** If something isn't specified there,
  ask rather than improvising.
- **Separate user and admin auth.** User sessions use the `token` localStorage key and
  the `JWT_SECRET`/`/api/auth/*` routes; admin uses the `admin_token` key and the
  `ADMIN_SECRET`/`/api/admin/*` routes. Never mix them.
- **No hardcoded fallback secrets**, all SQL parameterized, never insert user-supplied
  values into the DOM with `innerHTML` (use `textContent`), and never return a book's
  private `file_url` from a public endpoint. Full list: section 11 of the product
  definition.
- **Money is stored in kobo** (integers), never decimals.
