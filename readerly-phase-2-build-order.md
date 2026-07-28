# Readerly v2 — Phase 2 Build Order

**Goal:** A working admin panel. You can log in with a password only you know, add a book (title, author, description, category, cover image, PDF file), and publish it — but only once it records why you're legally allowed to distribute it. By the end of Phase 2, your first real books exist in the database.

**Scope discipline:** No public library page, no seller submissions, no subscriptions, no reader. This phase is entirely about the admin side. If Claude Code starts building anything a normal user would see, stop it.

**Prerequisite:** Phase 1 complete and reviewed — auth working, both repos pushed.

---

## Two housekeeping items, bundled into this phase

**1. Fix the stale `CLAUDE.md`.** The top-level `CLAUDE.md` still describes v1 (the single-page static site) as if it's the whole project. It needs to describe what actually exists now: `v1-archive/` (old site, reference only, never run), `readerly-api/` (Next.js API on Vercel), `readerly-frontend/` (static site on Netlify), `schema.sql`, and the phase documents — with a clear note that `readerly-v2-product-definition.md` is the real source of truth to read first, before this file.

**2. Add Phase 8 to the roadmap.** Section 10 of `readerly-v2-product-definition.md` lists the build phases. Append:

> **Phase 8 — Security Audit & Secret Rotation.** Rotate every credential that was ever exposed outside its intended environment during development (JWT_SECRET, ADMIN_SECRET, ADMIN_PASSWORD, database password, Supabase service role key). Re-verify the full security checklist in section 11 against the finished codebase. Confirm no `.env.local` or equivalent ever reached Git history on either repo. This is the last phase before public launch — nothing ships to real users before it's complete.

---

## Part A — Your manual tasks (before Claude Code runs)

**A1. Choose your admin password.** Not the 64-character `ADMIN_SECRET` you generated — a shorter, memorable one that only you will type in, e.g. a four-word passphrase. This becomes `ADMIN_PASSWORD`. Don't reuse a password from anywhere else.

**A2. Set storage bucket file-size limits.** Supabase → Storage → click `book-covers` → bucket settings → set a max file size (5MB is generous for a cover). Repeat for `book-files` with a larger limit (100MB is generous for a book PDF) — but check what your current plan actually allows; free-tier limits can change.

**A3. Source your first real books.** Before this phase is "done" in practice, you'll need 3–5 legitimate public-domain titles ready to upload: the book's text as a PDF, and a cover image. Project Gutenberg is the standard source for public-domain text. Titles like *Think and Grow Rich*, *The Richest Man in Babylon*, *As a Man Thinketh*, and *Meditations* are all genuinely free to distribute. Have the files sitting in a folder on your machine before you start using the admin panel.

---

## Design decisions (already made — do not deviate)

- **Admin auth is fully separate from user auth.** `ADMIN_PASSWORD` is what you type to log in. `ADMIN_SECRET` is what signs the resulting admin token — a different secret from `JWT_SECRET`, so an admin token and a user token can never be mistaken for each other or substituted. Compare the submitted password using a timing-safe comparison, same reasoning as the login timing fix in Phase 1.
- **Admin token expires in 7 days**, shorter than the 30-day user token, since it's the more sensitive credential.
- **The admin token is stored under its own `localStorage` key**, never the same key as the user token, so the two sessions can coexist without colliding.
- **A book is created as a draft first, then published as a deliberate second step.** Creating a book (title + author minimum) inserts a row with `status = 'pending'`. Nothing about "pending" here means "waiting for someone else" — for admin-added books, it just means "draft, not public yet." A dedicated publish action flips it to `'approved'`, and that action is where `rights_basis` gets enforced.
- **A book is "publishable" only when title, author, description, cover_url, file_url, and rights_basis are all non-empty** — and if `rights_basis = 'LICENSED'`, `rights_note` must also be non-empty. Attempting to publish without these returns 400 naming what's missing. This is the actual enforcement of section 2's content-rights policy — not a form hint, a server-side block.
- **Uploads go straight from the browser to Supabase Storage**, not through your API. A PDF could be tens of megabytes, and routing that through a Vercel serverless function risks hitting body-size limits and is slower for no benefit. Your API's only job is to mint a short-lived, single-use signed upload URL — the admin-only, service-role-authenticated step — after which the browser uploads the file directly.
- **Storage paths are server-generated, never taken from the client filename.** Use the book's id plus the file's extension, e.g. `covers/{bookId}.jpg`, `files/{bookId}.pdf`. Re-uploading for the same book overwrites the same path (`upsert: true`) rather than accumulating orphaned files.
- **Bucket and file-extension are validated against an allowlist server-side** before minting an upload URL — never trust a client-supplied bucket name or extension directly.

---

## The Claude Code prompt

---

Phase 2 of Readerly v2: admin authentication, books management, and secure file uploads. Re-read `readerly-v2-product-definition.md` in full, especially section 2 (content rights policy), section 5.3 (books table), section 6 (admin pages), section 7 (admin endpoints), and section 11 (security checklist).

Build only what is listed below. No public library page, no seller flow, no subscriptions, no reader. If something is ambiguous, ask rather than deciding for yourself.

**Two housekeeping edits first:**
1. Rewrite the top-level `CLAUDE.md` to describe the actual current structure: `v1-archive/` (old static site, kept for reference, never run), `readerly-api/`, `readerly-frontend/`, `schema.sql`, and the phase/product documents — with a clear pointer that `readerly-v2-product-definition.md` is the real source of truth to read before this file.
2. Append the Phase 8 entry (given above, word for word) to the phase list in section 10 of `readerly-v2-product-definition.md`.

### Part 1 — `readerly-api`

**Add `ADMIN_PASSWORD` to `.env.example`**, commented, alongside the existing `ADMIN_SECRET`.

**`lib/adminAuth.js`** — mirrors `lib/auth.js` but fully separate:
- `signAdminToken()` — signs `{ admin: true }` with `ADMIN_SECRET`, expires in 7 days. Throw if `ADMIN_SECRET` is missing, no fallback.
- `verifyAdminToken(token)` — verifies against `ADMIN_SECRET`, returns the payload or `null`. Never throws.
- `requireAdmin(request)` — reads the `Authorization` header, verifies via `verifyAdminToken`, returns `true`/`false`. Every admin route calls this first and returns 401 immediately if it's false, before doing anything else.
- Use a timing-safe comparison (Node's `crypto.timingSafeEqual`, buffers of equal length — pad or hash first if needed) when checking the submitted password against `ADMIN_PASSWORD` in the login route.

**`app/api/admin/login/route.js`** — `POST`
- Body: `{ password }`. Compare against `ADMIN_PASSWORD` (timing-safe). Wrong password → 401 `{ ok: false, error: "Invalid password" }`. Correct → 200 `{ ok: true, token }` using `signAdminToken()`.

**`app/api/admin/books/route.js`**
- `GET` — admin-only. Returns all books regardless of status, newest first, including their categories (join through `book_categories`).
- `POST` — admin-only. Body: `{ title, author }` minimum required (400 naming what's missing if absent); everything else optional at creation. Inserts with `status = 'pending'`, `seller_id = NULL`, `format = 'DIGITAL'`. Returns the created book including its `id`.

**`app/api/admin/books/[id]/route.js`**
- `GET` — admin-only. Single book with its categories.
- `PUT` — admin-only. Updates any of: title, author, description, cover_url, file_url, page_count, rights_basis, rights_note, categoryIds (array — replace the book's `book_categories` rows in a transaction). Does not change `status`.
- `DELETE` — admin-only. Deletes the book row (categories cascade via the existing FK).

**`app/api/admin/books/[id]/publish/route.js`** — `POST`, admin-only.
- Load the book. Check title, author, description, cover_url, file_url, rights_basis are all non-empty strings; if `rights_basis === 'LICENSED'`, also require `rights_note` non-empty. On any failure, 400 with `{ ok: false, error: "Cannot publish: missing <specific field(s)>." }` naming exactly what's missing.
- On success, set `status = 'approved'`, return the updated book.

**`app/api/admin/books/[id]/unpublish/route.js`** — `POST`, admin-only. Sets `status = 'pending'`.

**`app/api/admin/upload-url/route.js`** — `POST`, admin-only.
- Body: `{ bucket, bookId, kind }` where `bucket` must be exactly `'book-covers'` or `'book-files'` (reject anything else with 400), and `kind` is `'cover'` or `'pdf'`.
- Validate the pairing (`book-covers` only for `kind: 'cover'`, `book-files` only for `kind: 'pdf'`).
- Build the storage path server-side: `covers/{bookId}.{ext}` or `files/{bookId}.pdf` — pick a sensible fixed extension for covers (e.g. always store as `.jpg` regardless of source, or validate against an allowlist of jpg/jpeg/png/webp extensions if the client sends one).
- Use `@supabase/supabase-js` with the service role key to create a signed upload URL for that path (`upsert: true` so re-uploads replace the same file). Look up the current correct method on the installed `@supabase/supabase-js` version for creating a signed upload URL — don't assume the exact method name from memory; check the library's types or docs in `node_modules`. Tell me which method you used.
- Return whatever the client needs to perform the upload directly against Supabase Storage with a plain `fetch` — no Supabase client library should be required in the browser if the signed-URL approach supports a direct HTTP upload. If it turns out the browser genuinely needs the `@supabase/supabase-js` client to complete the upload (not just mint the URL), tell me before adding it via CDN to the admin pages, since that changes what ships to the frontend.
- After the client confirms the upload succeeded, the admin page calls `PUT /api/admin/books/[id]` with the resulting `cover_url` or `file_url` (the public URL for covers, the storage path for files — `book-files` is private, so store the path, not a public URL, since we'll mint signed *read* URLs later in Phase 5).

All routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, parameterized SQL, CORS headers and `OPTIONS` on every response, no raw errors leaked to the client.

### Part 2 — `readerly-frontend`

**`js/admin-auth.js`** — separate from `js/auth.js`, own storage key (e.g. `admin_token`, never `token`):
- `saveAdminSession(token)`, `getAdminToken()`, `clearAdminSession()`, `adminLogout()` (clears and redirects to `admin.html`).
- `requireAdminAuth()` — if no admin token, redirect to `admin.html`. (Unlike the user gate, there's no `/api/admin/me` to verify against yet — protect the API routes themselves, and treat presence of a token as sufficient to *render* the page; every actual data request will still 401 from the server if the token is invalid, and that response should redirect to `admin.html` too.)

**`admin.html`** — the admin login page. A single password field, nothing else. Posts to `/api/admin/login`, saves the token, redirects to `admin-books.html`. If an admin token already exists, redirect straight to `admin-books.html` instead of showing the form.

**`admin-books.html`** — gated by `requireAdminAuth()`. One page, two parts:
- A list of all books (from `GET /api/admin/books`) showing title, author, a status badge (Draft / Published), and Edit / Publish-or-Unpublish / Delete actions per row.
- A form (used for both "add new" and "edit") with: title, author, description, category checkboxes (fetch from a simple categories list — add a minimal `GET /api/admin/categories` if one doesn't exist, or read from the book payload), a cover image upload control, a PDF upload control, a `rights_basis` select (Public Domain / Licensed / Own Content), a `rights_note` textarea (shown/required only when Licensed is selected), and page count.
- Flow: filling in title + author and clicking "Save draft" calls `POST /api/admin/books`, gets back an id, and only then enables the cover/PDF upload controls (which need that id for the storage path). Uploading a file calls `/api/admin/upload-url` to get the signed URL, uploads directly to Supabase, then `PUT`s the book with the resulting `cover_url`/`file_url`. A "Publish" button appears once a draft has files and rights info; clicking it calls the publish endpoint and shows the server's error inline if it's rejected for missing fields.
- Style with the existing `.card`, `.btn-primary`, `.btn-secondary`, `.alert-error` classes from `css/main.css` — add only what's genuinely new (e.g. a status badge style, a simple table/list layout).

When finished, summarise what you built, list anything you were unsure about, and confirm which upload method you ended up using and why. Do not deploy.

---

## Verification

**Admin auth**
- [ ] Wrong password on `admin.html` shows an error, no token issued
- [ ] Correct password logs in and lands on `admin-books.html`
- [ ] A regular user's JWT (from Phase 1) is rejected by every `/api/admin/*` route — this is the one to actually test, not assume
- [ ] Visiting `admin-books.html` with no admin token redirects to `admin.html`
- [ ] Admin session and a logged-in user session can coexist in the same browser without interfering with each other

**Books & publishing**
- [ ] Saving title + author creates a draft, visible in the list as Draft
- [ ] Clicking Publish before uploading files or setting rights_basis fails with a message naming what's missing
- [ ] Setting `rights_basis = LICENSED` without `rights_note` still blocks publishing
- [ ] Filling everything in and publishing flips the book to Published
- [ ] Unpublish flips it back to Draft
- [ ] Editing and deleting both work

**Uploads — the part that matters most**
- [ ] A cover image uploads successfully and is reachable at its public URL directly in a browser tab
- [ ] A PDF uploads successfully into `book-files`
- [ ] Attempting to open the PDF's storage path as a plain public URL (no signed token) fails — this is the proof the private bucket is actually private
- [ ] Re-uploading a cover or PDF for the same book replaces the file rather than creating a duplicate

**General**
- [ ] No console errors, no CORS errors
- [ ] No raw database or storage errors ever shown to the browser

---

## After it works

Use the admin panel yourself to add the 3–5 public-domain titles you sourced in Part A. This is both real content and the final proof the whole flow works end to end, by hand, as the actual admin.

## Bring back to me

1. `lib/adminAuth.js` and all the admin route files
2. `js/admin-auth.js`
3. Which upload method it ended up using, and why
4. Screenshots or a short description of `admin-books.html` in use
