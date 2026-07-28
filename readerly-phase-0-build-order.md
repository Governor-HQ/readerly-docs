# Readerly v2 — Phase 0 Build Order

**Goal:** Get the skeleton of both projects live and talking to each other, with the database created. No features. By the end of Phase 0, the frontend on Netlify can call the API on Vercel, and the API can reach the Supabase database.

**Do not let Claude Code build anything from Phase 1 in this session.** If it starts writing auth or book endpoints, stop it.

---

## Part A — Your manual tasks (do these first)

Claude Code cannot create accounts or click dashboards. These are yours.

### A1. Create the Supabase project
1. Go to supabase.com → New Project
2. Name it `readerly`, choose the region closest to Nigeria (eu-west-1 worked for Alibaba)
3. Save the database password somewhere safe
4. Wait for it to finish provisioning

### A2. Get the connection string
1. Project Settings → Database → Connection string → **URI**
2. Choose **Session pooler**, port **5432**
   *(Not the transaction pooler on 6543 — it's IPv6-only and breaks on Vercel. This cost you time on Alibaba.)*
3. Replace `[YOUR-PASSWORD]` with your actual password
4. Keep this string — it becomes `DATABASE_URL`

### A3. Create the storage buckets
Storage → New bucket, create two:
- `book-covers` — **public**
- `book-files` — **private** (this is where PDFs live; never make it public)

### A4. Get your Supabase keys
Project Settings → API. Copy:
- Project URL → `SUPABASE_URL`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never put this in frontend code)

### A5. Create two GitHub repos
- `readerly-api`
- `readerly-frontend`

### A6. Generate secrets
Run this twice, keep both outputs:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
First one → `JWT_SECRET`. Second → `ADMIN_SECRET`.

---

## Part B — The Claude Code prompt

Create an empty folder called `readerly`, open Claude Code inside it, attach `readerly-v2-product-definition.md`, then paste this:

---

I'm building Readerly v2. The attached product definition document is the source of truth — read it fully before writing any code.

We are doing **Phase 0 only**: project skeletons and connectivity. Do not build authentication, books, subscriptions, or any feature logic. If something isn't specified in this instruction, ask me rather than improvising.

Create two sibling projects inside this folder:

**Project 1: `readerly-api`**

A Next.js project used **only** as an API — no UI pages. Use JavaScript, not TypeScript. App Router.

- Initialise with `create-next-app`, JavaScript, App Router, no Tailwind, no src directory
- Delete the default homepage content and any styling boilerplate — this project renders nothing
- Install: `pg`, `bcryptjs`, `jsonwebtoken`, `@supabase/supabase-js`
- Create `lib/db.js` — a single shared `pg` Pool. Read `DATABASE_URL` from env. Supabase requires SSL, so use `ssl: { rejectUnauthorized: false }`. Export a `query(text, params)` helper that always uses parameterized queries. Reuse the pool across invocations (store on `globalThis` in development so hot reload doesn't open a new pool every time).
- Create `lib/cors.js` — a helper that sets CORS headers, allowing only the origin in `FRONTEND_URL`, plus handling OPTIONS preflight.
- Create `app/api/health/route.js` — a GET endpoint that runs `SELECT NOW()` against the database and returns `{ ok: true, time: <result>, service: "readerly-api" }`. If the query fails, return HTTP 500 with `{ ok: false, error: "database unreachable" }` — never leak the raw error message to the client, but do `console.error` it.
- Create `.env.example` listing every variable from section 3 of the product definition, with empty values and a short comment on each.
- Add `.env.local` to `.gitignore`.
- Create `README.md` explaining what the project is, how to run it locally, and what each env variable does.

**Project 2: `readerly-frontend`**

Plain HTML, CSS, and JavaScript. No framework, no build step.

Structure:
```
readerly-frontend/
├── index.html
├── css/
│   └── main.css
├── js/
│   ├── config.js
│   └── api.js
└── netlify.toml
```

- `css/main.css` — CSS custom properties for every design token in section 4 of the product definition (colours, fonts), a light reset, and base typography. Headings use Playfair Display, body uses Inter, both loaded from Google Fonts in the HTML head.
- `js/config.js` — exports an `API_BASE` constant. It should detect whether the page is running on localhost and use `http://localhost:3000` if so, otherwise the production Vercel URL. Leave the production URL as a clearly-marked placeholder for me to fill in.
- `js/api.js` — a small `fetch` wrapper: a function `apiGet(path)` and `apiPost(path, body)` that prefix `API_BASE`, set JSON headers, attach a JWT from `localStorage` as a Bearer token when one exists, parse the JSON response, and throw a readable Error on non-OK responses. Nothing auth-specific beyond attaching the token.
- `index.html` — a temporary connectivity test page, not the real landing page. It should show the Readerly wordmark, a button labelled "Test API connection", and an empty result area. Clicking the button calls `/api/health` through `apiGet` and displays either the success response or the error, styled with the design tokens.
- `netlify.toml` — publish directory set to the project root.

**Also create, at the top level of `readerly`:**

- `schema.sql` — every `CREATE TABLE` statement from section 5 of the product definition, in dependency order, plus the indexes, plus `INSERT` statements seeding the ten categories listed in section 5.2 with correct slugs. Include all tables, including the ones marked P2. Make it safe to run once, top to bottom, in the Supabase SQL editor.

When you're done, give me a short summary of what you created and the exact commands to run each project locally. Do not deploy anything — I'll handle deployment.

---

## Part C — Deploy and verify

After Claude Code finishes:

### C1. Run the schema
1. Supabase → SQL Editor → New query
2. Paste the whole of `schema.sql`, run it
3. Table Editor → confirm all nine tables exist and `categories` has ten rows

### C2. Test the API locally
```bash
cd readerly-api
cp .env.example .env.local
# fill in DATABASE_URL, JWT_SECRET, ADMIN_SECRET, SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY, and set FRONTEND_URL=http://localhost:5500
npm run dev
```
Open `http://localhost:3000/api/health` — you should see `ok: true` and a timestamp. If not, the database connection is wrong. Check you used the **session pooler on 5432**.

### C3. Deploy the API
1. Push `readerly-api` to its GitHub repo
2. Vercel → Import project → select the repo
3. Add every environment variable from `.env.example` in Vercel's settings
4. Deploy, then visit `https://<your-project>.vercel.app/api/health`

### C4. Deploy the frontend
1. Put the production Vercel URL into `js/config.js`
2. Set `FRONTEND_URL` in Vercel to your Netlify URL, redeploy the API
3. Push `readerly-frontend` to GitHub, connect it to Netlify
4. Open the live site and click "Test API connection"

---

## Phase 0 is complete when

- [ ] All nine tables exist in Supabase, categories seeded
- [ ] Both storage buckets created, `book-files` is private
- [ ] `/api/health` returns `ok: true` locally
- [ ] `/api/health` returns `ok: true` on Vercel
- [ ] The Netlify page's test button successfully calls the Vercel API with no CORS error
- [ ] No secrets are committed to either repo

---

## Bring back to me

When Phase 0 is done, send me:
1. Both live URLs
2. `lib/db.js`, `lib/cors.js`, and `app/api/health/route.js`
3. Any errors you hit and how they were resolved

I'll review the code against the spec before we start Phase 1 (auth and the login gate).
