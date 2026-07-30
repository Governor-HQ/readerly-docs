# Readerly v2 — Phase 6.5 Build Order

**Goal:** Make the reader feel like an actual book, not a bare canvas — proper framing, a satisfying page-turn transition, and swipe navigation that's been genuinely proven on a real device, not just written to spec.

**Scope discipline:** Pure frontend polish on `reader.html`, which already works. No new API endpoints, no schema changes, no new dependencies beyond what's already loaded. Nothing here touches Phase 7 at all — that stays a completely separate session.

**Prerequisite:** Phase 6 pushed.

## Design decisions (already made — do not deviate)

* **Book-page framing.** The canvas sits inside a card: a warm, cream-toned background (reuse the existing `--brand-cream` token or a close variant), generous padding so the page doesn't touch the edges, a soft drop shadow suggesting a page lifted slightly off the surface, gently rounded corners. On desktop, constrain the card to a comfortable, book-like max-width rather than stretching edge to edge.
* The page indicator and any book title shown in the reader header switch to the serif heading font (Playfair Display, already used sitewide) instead of the plain body font — reinforces the "printed page" feel with zero new assets.
* **Transition style: simple slide/cross-fade, not a true paper-curl.** On any page change — swipe, button, or arrow key — the outgoing page slides out and fades slightly while the incoming page slides in from the opposite side, using CSS transforms and opacity, consistent with the transition patterns already used elsewhere on the site (the mobile menu slide, the book detail modal's fade-scale). A subtle CSS 3D tilt (`perspective` + a small `rotateY`) during the transition is worth trying for a bit more "turning" dimensionality, since it's still just a CSS transform, not a new rendering pipeline — but if it looks janky or causes a visible hitch when PDF.js re-renders the canvas mid-transition, a clean plain slide/fade is the right fallback. Use judgment, tell me which was used.
* **Single page always, no two-page desktop spread.** Deliberately out of scope for this pass — real added complexity, not clearly needed yet.
* The transition is purely visual and must not disturb anything from Phase 5 — the ~2 second debounced progress save, the resume-on-open toast, the expired-session recovery — all of that keeps working exactly as it already does.
* The existing dark-mode canvas filter (`invert` + `hue-rotate`) is untouched. It continues to apply only to the canvas itself, same as Phase 5. The surrounding frame/chrome can reasonably adopt its own darker tone in dark mode for a more immersive feel, but exactly how is a reasonable aesthetic judgment call — general direction given, not every pixel specified.
* **Swipe gets a correctness pass, not a rebuild from scratch.** It was written in Phase 5 exactly to this spec, but never proven against a real touch gesture — automated testing can fake clicks convincingly, not real fingers. Re-examine the existing touch handlers for two specific, common bugs: (1) a horizontal swipe threshold that's too sensitive or not sensitive enough, and (2) whether a horizontal swipe is being cleanly distinguished from an attempted vertical scroll — a common touch-interaction bug where the wrong gesture gets intercepted. Only prevent the browser's default behavior when a genuine horizontal swipe is detected, never on every touch.
* This phase's final acceptance is not complete until Governor has personally tested swipe on a real phone. State this plainly in the report rather than claiming swipe is "verified" from automated testing alone.

## The Claude Code prompt

---

Phase 6.5 of Readerly v2: reader aesthetics and swipe hardening. This is a small, tightly scoped, purely frontend phase — `reader.html`, `css/main.css`, nothing else. No new API routes, no schema, no new dependencies.

Build only what is listed below. If something is ambiguous, ask rather than deciding yourself.

**Book-page framing.** Wrap the canvas in a card that looks like an actual page: a warm cream background (reuse `--brand-cream` or a close variant already in the token set), generous internal padding, a soft drop shadow, gently rounded corners. Constrain the card's max-width on desktop so it reads as a book page rather than a full-bleed rectangle. The reader's page indicator ("Page X of Y") and any book-title text in the header switch to the Playfair Display serif font already used for headings sitewide.

**Page-turn transition.** On every page change — swipe, on-screen button, or arrow key — animate the outgoing page sliding/fading out and the incoming page sliding/fading in, using CSS transforms and opacity, matching the transition quality already established elsewhere on the site (mobile menu slide, book-detail modal fade-scale). Try adding a subtle `perspective` + small `rotateY` tilt during the transition for a bit more dimensionality; if it causes any visible hitch or looks off against the canvas re-render, fall back to a clean plain slide/fade instead — use your judgment and tell me which you landed on and why. This must not interfere with the existing ~2-second debounced progress save, the resume-on-open toast, or the expired-session recovery flow from Phase 5 — all of that keeps working exactly as it does today.

**Swipe correctness pass.** Re-examine the existing touch handlers in `reader.html`. Confirm the swipe distance threshold is reasonable (not so sensitive that small movements accidentally trigger a page turn, not so strict that a real swipe fails to register). Confirm a horizontal swipe is cleanly distinguished from a vertical scroll attempt, and that the browser's default behavior is only prevented for a genuine horizontal swipe, never for every touch. Swipe left = next page, swipe right = previous page, unchanged from Phase 5.

**Dark mode.** The canvas's existing `invert`/`hue-rotate` filter stays exactly as it is. The surrounding frame and chrome may take on a darker tone in dark mode for a more immersive reading feel — reasonable creative judgment here, no need to check every specific value with me.

When finished, summarise what you built, explain which transition variant you landed on (with the tilt or the plain fallback) and why, and be explicit and honest that swipe has been code-reviewed and logically hardened but genuinely needs a real phone to be the final word — don't claim it's fully verified from automated testing alone.

---

## Verification

**Automated / desktop-testable**

* [ ] The reading card looks properly framed and proportioned at both mobile and desktop widths
* [ ] Page indicator and header title render in the serif font
* [ ] Clicking next/prev triggers a visible, smooth transition, not an instant jump-cut
* [ ] Arrow-key navigation also triggers the transition
* [ ] Progress still saves ~2 seconds after the last page change (confirm in the database, same as Phase 5)
* [ ] Reopening a book still resumes at the correct page with the toast
* [ ] Dark mode toggle still inverts only the canvas, chrome adapts sensibly
* [ ] No console errors, no layout shift or overflow introduced by the new framing

**Requires a real device — cannot be waved through from automated testing**

* [ ] Governor personally swipes left and right on a real phone and confirms it feels natural — not too sensitive, not unresponsive
* [ ] Confirm a normal vertical scroll attempt (if the page is ever taller than viewport) doesn't accidentally trigger a page turn
* [ ] Confirm the transition doesn't feel janky or delayed on a real device, only on a fast desktop browser

## Bring back to me

1. The relevant sections of `reader.html` and `css/main.css` that changed
2. Which transition variant was used (tilted or plain) and why
3. Explicit confirmation that swipe is code-reviewed and hardened, but flagged as pending your real-device test, not claimed as fully proven
