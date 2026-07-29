# Readerly v2 — Phase 3 Build Order

**Goal:** Any logged-in user can browse every published book — search, filter by category, open a book's detail page. The "Browse Books" card on `home.html` finally goes somewhere real.

**Scope discipline:** No subscriptions, no reader, no payments, no seller flow. A book's detail page will clearly show that reading isn't available yet — that's Phase 4/5's job, not this one's. If Claude Code starts building a working "Read" button or anything payment-related, stop it.

**Prerequisite:** Phase 2 complete, reviewed, pushed. At least one real book published through the admin panel.

---

## Design decisions (already made — do not deviate)

- **`GET /api/books` and `GET /api/books/[id]` require a valid logged-in user token** — any role, not admin specifically. Not fully public. This matches the spec's intent in section 6: locked pages mean locked data behind them too, not just a locked webpage with an open API underneath it. Use `getUserFromRequest` from `lib/auth.js`, already built in Phase 1 — no new auth primitive needed. No token, or an invalid one → 401.
- **`file_url` is never returned by any non-admin endpoint** — not in the list, not in the single-book detail. Even though it's a storage path rather than a working link, the rule stays absolute: only a future endpoint built specifically to mint a short-lived signed read URL (Phase 5) should ever touch it.
- **Both endpoints only ever see `status = 'approved'` rows.** The query itself excludes drafts — there's no filtering-after-the-fact that could be bypassed.
- **Requesting a draft or nonexistent book by id returns an identical 404 either way** — "Book not found," nothing more. Same principle as the login-enumeration fix from Phase 1: never let a response reveal that something exists in a state the requester isn't allowed to see.
- **Search and category filtering happen server-side**, via query parameters on `GET /api/books`, not by fetching everything and filtering in the browser. The catalog is a real, growing database table now, not a fixed array — filter it where it lives.
- **`v1-archive/style.css` is useful inspiration for the catalog UI** — Governor already solved this exact layout well in v1. Look at it for structure and spacing ideas, but write fresh CSS into the current `css/main.css` using the design tokens already established in Phases 1–2, rather than copying old rules wholesale.

---

## The Claude Code prompt

---

Phase 3 of Readerly v2: the public book catalog. Re-read `readerly-v2-product-definition.md` section 6 (pages) and section 7 (API endpoints) before starting. `v1-archive/style.css` and `v1-archive/index.html` are useful visual/structural reference for the catalog UI — Governor's original design for this exact page — but write new CSS into the current `css/main.css`, don't copy the old file wholesale.

Build only what is listed below. No subscriptions, no reader, no payments, no seller flow. If something is ambiguous, ask rather than deciding yourself.

### Part 1 — `readerly-api`

**`app/api/books/route.js`** — `GET`
- Requires a valid user token via `getUserFromRequest` (from `lib/auth.js`). No valid user → 401 `{ ok: false, error: "Not authenticated" }`.
- Query params: `category` (a category slug) and `q` (a search term, matched against title and author, case-insensitive).
- Always filters `WHERE status = 'approved'`, regardless of any other parameter.
- Returns each book with its categories joined in, but **never** `file_url` and never `rejection_reason`.
- Newest-first ordering.

**`app/api/books/[id]/route.js`** — `GET`
- Same auth requirement as above.
- Returns the single book with its categories, only if `status = 'approved'`. If the book doesn't exist, or exists but isn't approved, return an identical 404 `{ ok: false, error: "Book not found." }` in both cases — no way to distinguish "doesn't exist" from "exists but hidden."
- Never returns `file_url`.

**`app/api/categories/route.js`** — `GET`
- Same auth requirement (any valid user, not admin). Returns all categories, same shape as the existing admin categories endpoint, just without the admin gate.

All routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, parameterized SQL, CORS headers and `OPTIONS` on every response, no raw errors leaked.

### Part 2 — `readerly-frontend`

**`library.html`** — locked, gated by `requireAuth()`. A search bar and a row of category pills (fetched from `/api/categories`), and a responsive grid of book cards below. Each interaction — typing in search (debounced, e.g. 300ms), clicking a category pill — triggers a fresh call to `GET /api/books` with the right query parameters, not client-side filtering of an already-fetched list. Each card shows the cover image (with a graceful fallback if the image fails to load — don't leave a broken image icon), title, author, and one or two category tags, and links to `book.html?id={id}`. An empty state for "no books match" distinct from "no books published yet at all."

**`book.html?id=`** — locked, gated by `requireAuth()`. Reads the `id` from the URL's query string. Fetches `GET /api/books/{id}`. If the fetch 404s, show a clear in-page "Book not found" message with a link back to `library.html` — don't silently redirect without explanation. On success, show the cover, title, author, full description, categories, and page count. Below that, an honest, clearly non-functional section: something like "🔒 Subscribe to read this book — ₦2,000/month. Subscriptions are launching soon." Styled distinctly (e.g. using a variant of the existing `.card` style with muted styling) so it reads as an informational state, not a broken button.

**`home.html`** — one small edit. The "Browse Books" card's "Coming Soon" badge becomes a real link to `library.html`. Leave the other three cards (My Library, My Reading, Account) exactly as they are — still Coming Soon, those are later phases.

**CSS** — add to `css/main.css`: a responsive book grid (2 columns on mobile, more on wider screens — matching v1's breakpoint approach), book card styling, category pill styling, a search input matching the existing `.input` style, and the "subscribe to read" informational card. Use only the existing design tokens, no new colours.

When finished, summarise what you built and list anything you were unsure about. Do not deploy.

---

## Verification

**API**
- [ ] `GET /api/books` with no token → 401
- [ ] `GET /api/books` with a valid token → only approved books, never a draft
- [ ] `?q=` search matches title and author, case-insensitive
- [ ] `?category=` filters correctly
- [ ] No response from either endpoint ever contains `file_url`
- [ ] Requesting a known draft book's id on `/api/books/[id]` → 404, identical in shape to a made-up id like `99999`

**Frontend**
- [ ] `library.html` redirects to login when logged out
- [ ] The published book from Phase 2 appears with its correct cover, title, and categories
- [ ] Typing in search re-queries the API and narrows results
- [ ] Clicking a category pill filters correctly
- [ ] Clicking a book opens its detail page
- [ ] `book.html?id=` with a nonexistent id shows the not-found state, not a crash or blank page
- [ ] The detail page never shows a working "Read" button — only the honest coming-soon message
- [ ] "Browse Books" on `home.html` now links to a working page
- [ ] Mobile layout is usable, no CORS errors, no console errors

---

## Bring back to me

1. `app/api/books/route.js`, `app/api/books/[id]/route.js`, `app/api/categories/route.js`
2. `library.html` and `book.html`
3. Anything it was unsure about
