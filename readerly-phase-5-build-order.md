# Readerly v2 — Phase 5 Build Order

**Goal:** A working reader. A subscribed user opens a book and actually reads it, page by page, with their place remembered. This is the payoff for everything Phase 4 built — `hasActiveAccess()` finally has something real to gate.

**Scope discipline:** No highlights, no notes, no EPUB, no offline reading — out of scope from the very first product definition, still out of scope now. This phase is entirely: can a paying subscriber open a book and read it.

**Prerequisite:** Phase 4 complete, reviewed, pushed. At least one approved book with a real PDF already in `book-files` (you have one — *The Richest Man In Babylon*). At least one way to activate a subscription for testing (the manual flow from Phase 4 works fully today).

**No schema changes this phase.** `reading_progress` already exists from Phase 0, untouched since. Confirm this rather than assuming — if it turns out something's missing, follow the Phase 4 standing workflow: run it yourself via the DB connection, report table state before and after, never a destructive change without asking first.

---

## Design decisions (already made — do not deviate)

- **The original spec's 15-minute signed-URL expiry is being corrected to 60 minutes.** Fifteen is too short for a real reading session — someone genuinely reading for twenty minutes would hit a dead link mid-book. Sixty is long enough for one sitting, short enough that a shared link goes stale within the hour.
- **Access is checked fresh, every single time a read link is requested** — `hasActiveAccess(userId)` is called live inside `GET /api/books/[id]/read`, never cached, never trusted from an earlier check. Same principle Phase 4 established for the subscription boolean itself, applied one level up to the file.
- **The reader's own page count comes from PDF.js's `numPages`, not the catalog's `page_count` field.** The admin-entered number is a display figure that can be off by a page or two depending on formatting; the actual file, parsed live, can never be wrong about itself. Progress math always uses the real file.
- **Progress is saved debounced, ~2 seconds after the last page change**, not on every single page turn — same instinct as the library search bar's debounce in Phase 3, applied to page turns instead of keystrokes.
- **"Finished" means `percent >= 98`, not exactly 100.** Requiring exact completion risks someone being permanently stuck at 99% because of a one-page mismatch somewhere. Ninety-eight tolerates that without meaningfully weakening what "finished" means.
- **Resuming is automatic, with a brief, non-blocking indicator — not a modal someone has to click through.** Open a book with existing progress, it opens straight to that page, with a small toast like "Resumed from page 34" that fades on its own.
- **Dark reading theme is a CSS filter on the canvas (`invert` + `hue-rotate`), not a true re-render.** This is a known, commonly used trick, and an honest limitation to know about: any images inside the PDF will look colour-inverted too. Not a perfect solution, a reasonable one.
- **An expired mid-session link is handled gracefully, not left as a dead reader.** If a page fails to load because the signed URL has lapsed, show a clear "Your reading session expired" state with a button that re-mints a fresh URL and reloads the document back at the last-saved page — never silently broken, never losing their place.
- **Progress percent is computed server-side from two client-supplied integers (`currentPage`, `totalPages`), never trusted as a raw float sent directly.** This isn't payment or access-control data — worst case someone fakes their own reading stats, which harms nobody — so this is a sanity measure, not a security boundary. Clamp `currentPage` between 1 and `totalPages` defensively before storing.
- **`home.html` drops to three cards.** "My Library" is removed entirely rather than kept as a near-duplicate of "Browse Books" — now that the subscription model is flat, unlimited catalog access, there's no different content it would show. Browse Books, My Reading, Account. All three now real links; none say Coming Soon anymore.
- **PDF.js's exact CDN URL, version, and worker-file setup must be confirmed against a current, real source before writing the loader** — this is the same "don't assume an API shape from possibly-stale memory" situation as Phase 2's Supabase signed-upload research and Phase 4's Paystack contract research. Getting the worker path wrong is a well-known PDF.js footgun that fails silently or with a confusing console warning.

---

## The Claude Code prompt

---

Phase 5 of Readerly v2: the reader. Re-read `readerly-v2-product-definition.md` section 8 ("The Reader — how it works") in full before starting — it defines the required behaviour list. Also re-read section 6 for the current page list and section 7 for the current endpoint list, since both need reconciling again at the end.

Build only what is listed below. No highlights, no notes, no EPUB, no offline mode. If something is ambiguous, ask rather than deciding yourself.

**First, confirm `reading_progress` already exists** with the columns from the original schema (`user_id`, `book_id`, `current_page`, `percent`, `last_read_at`, unique on `(user_id, book_id)`). No new schema should be needed this phase — if something genuinely is missing, follow the standing Phase 4 workflow (run it yourself, report table state before/after, never destructive without asking).

**Housekeeping, as every phase now:** at the end, reconcile sections 6 and 7 of `readerly-v2-product-definition.md` against what was actually built, correcting anything stale — including finally removing the "My Library" row from section 6 if it's still listed as a separate page, and adding `my-reading.html` and the reader/progress endpoints properly.

### Part 1 — `readerly-api`

**`app/api/books/[id]/read/route.js`** — `GET`, any logged-in user.
- Load the book. Must exist and be `status = 'approved'` — otherwise 404, same identical-shape rule as the Phase 3 book detail endpoint.
- Call `hasActiveAccess(user.id)` from `lib/subscriptions.js`. If false, return 403 `{ ok: false, error: "An active subscription is required to read this book." }`.
- Use the existing Supabase service client (`lib/storage.js` from Phase 2) to mint a signed **read** URL for the book's `file_url` path in the private `book-files` bucket, expiring in 3600 seconds (60 minutes) — confirm the exact method against the installed `@supabase/supabase-js` version rather than assuming, same as the read-URL work already done for payment proofs in Phase 4.
- Return `{ ok: true, url, expiresIn: 3600 }`. Never return the raw storage path itself alongside the signed URL, no reason to.

**`app/api/progress/route.js`**
- `GET` — any logged-in user. Returns all of that user's `reading_progress` rows, each joined with the book's title, author, and cover for easy rendering — no separate per-book fetch needed on the frontend.
- `POST` — any logged-in user. Body `{ bookId, currentPage, totalPages }`. Validate both are positive integers and `currentPage <= totalPages` (clamp if not, don't reject — this is non-sensitive data). Compute `percent = ROUND((currentPage::numeric / totalPages) * 100, 2)` in the SQL itself. Upsert on `(user_id, book_id)`, updating `last_read_at = NOW()`.

**`app/api/progress/[bookId]/route.js`** — `GET`, any logged-in user. Returns this user's progress for one book, or a clean "no progress yet" shape (don't 404 — no progress is a normal, expected state, not an error).

All routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, parameterized SQL, CORS + `OPTIONS`, no raw errors leaked.

### Part 2 — `readerly-frontend`

**PDF.js setup** — confirm the current recommended CDN URL, version, and matching worker-file path for PDF.js before writing `reader.html`. Load it via `<script>` tag from a CDN (cdnjs is already used elsewhere in this project's font loading pattern), and correctly set `pdfjsLib.GlobalWorkerOptions.workerSrc` to the matching worker build — tell me exactly what version and URLs were used and where confirmed.

**`reader.html?id=`** — locked, `requireAuth()`. On load:
- Fetch `GET /api/books/{id}/read`. If 403 (no active subscription), show a clear inline message with a link to `subscribe.html` rather than a broken reader. If the book itself 404s, same honest not-found pattern as `book.html`.
- Fetch `GET /api/books/{id}` for title/author to show in a header bar, and `GET /api/progress/{id}` to know the resume page.
- Load the PDF via PDF.js using the signed URL, render one page at a time to a `<canvas>`, resuming at the saved page automatically with a brief fading "Resumed from page X" toast if progress existed.
- Navigation: on-screen previous/next buttons, arrow-key support on desktop, left/right swipe on mobile (swipe left = next page, swipe right = previous — standard convention).
- A progress bar and "Page X of Y" using PDF.js's own `numPages` as Y, always.
- Save progress via `POST /api/progress` debounced ~2 seconds after the last page change.
- Zoom controls (+/- buttons adjusting the render scale, re-rendering the current page at the new scale).
- A light/dark theme toggle applying a CSS filter (`invert(1) hue-rotate(180deg)` or similar) to the canvas in dark mode — implement as a toggled class, no re-render needed.
- If a page fails to load mid-session (the signed URL has likely expired), show a clear "Your reading session expired" state with a button that calls the read endpoint again for a fresh URL and reloads the document at the last-saved page — never a silent failure or blank canvas.
- Fully responsive, mobile is the primary target — the canvas should size to fit the viewport width on small screens.

**`my-reading.html`** — locked, `requireAuth()`, newly built (closing the section-6 gap, same as `account.html` in Phase 4). Fetches `GET /api/progress`. Two sections: "Continue Reading" (percent `< 98`, sorted by `last_read_at` descending) and "Finished" (percent `>= 98`). Each item shows cover, title, author, a progress bar or percentage, and links to `reader.html?id=`. A clear empty state pointing to `library.html` if nothing has been started yet.

**`book.html`** — edit the existing Phase 3 placeholder. Replace the static "🔒 Subscribe to read — launching soon" block with real logic: fetch `GET /api/subscription`, and if `active` is true show a genuine "Read" button linking to `reader.html?id={id}`; if not, show a "Subscribe to Read" button linking to `subscribe.html`. Keep it a simple binary check — the nuanced pending/rejected states already have a home on `account.html`, no need to duplicate that detail here.

**`home.html`** — remove the "My Library" card entirely. The "Browse Books" card stays as it is (already links to `library.html`). Turn "My Reading" from Coming Soon into a real link to `my-reading.html`. "Account" stays as it is from Phase 4. Result: three cards, all real, nothing left saying Coming Soon.

**CSS** — add to `css/main.css`: reader layout (header bar, canvas container, nav controls, progress bar, zoom controls, theme toggle, the resume toast, the expired-session state), and a simple progress-list style for `my-reading.html`. Use existing tokens; the dark reading theme can introduce one new pair of reading-specific variables if genuinely needed for the toggle's non-canvas chrome (the header/controls), but the canvas inversion itself is a filter, not a token.

When finished, summarise what you built, confirm the PDF.js version/CDN/worker details and where they were verified, and list anything you were unsure about. Do not deploy.

---

## Verification

Unlike Phase 4, nothing here depends on an external service you don't have yet — this phase should be fully verifiable today.

**API**
- [ ] `GET /api/books/[id]/read` with no active subscription → 403
- [ ] Same call with an active subscription (activate one via the Phase 4 manual flow) → 200 with a signed URL
- [ ] That signed URL, opened directly, actually loads the real PDF
- [ ] `POST /api/progress` computes percent correctly server-side; sending a nonsense `currentPage` larger than `totalPages` gets clamped, not rejected
- [ ] `GET /api/progress/[bookId]` with no existing progress returns a clean empty shape, not an error
- [ ] `GET /api/progress` returns book details joined in, not just raw IDs

**Reader**
- [ ] Opening a book with an active subscription renders real pages
- [ ] Opening a book without an active subscription shows the honest gate, not a broken reader
- [ ] Previous/next buttons, arrow keys, and swipe all navigate correctly
- [ ] Progress saves (check the database directly) roughly 2 seconds after the last page change, not on every single flip
- [ ] Closing and reopening the book resumes at the saved page with the toast shown
- [ ] Crossing back and forth over the 98% threshold correctly moves a book between "Continue Reading" and "Finished" on `my-reading.html`
- [ ] Zoom controls work
- [ ] Dark theme toggle visibly changes the canvas
- [ ] Deliberately feeding the reader a bad/expired URL (e.g. mint one with a very short test expiry) triggers the expired-session recovery state, not a blank canvas or console error
- [ ] Mobile layout — canvas fits viewport width, swipe navigation works, controls are reachable

**Dashboard & pages**
- [ ] `home.html` shows exactly three cards, none saying Coming Soon
- [ ] `book.html` shows a real "Read" button when subscribed, a real "Subscribe" button when not
- [ ] `my-reading.html` empty state links correctly to `library.html`
- [ ] No console errors, no CORS errors anywhere in this phase's pages

---

## Bring back to me

1. `app/api/books/[id]/read/route.js`, `app/api/progress/route.js`, `app/api/progress/[bookId]/route.js`
2. `reader.html`
3. The exact PDF.js version, CDN URLs, and worker configuration used, and where confirmed
4. Anything it was unsure about
