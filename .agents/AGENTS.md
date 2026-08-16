# CLAUDE.md — Project Conventions

This file is auto-loaded by Claude Code at the start of every session in this repo.
Read `/docs/PRD.md`, `/docs/ARCHITECTURE.md`, `/docs/DATA_MODEL.md`, `/docs/DESIGN_SYSTEM.md`,
and `/docs/BUILD_PLAN.md` before writing code. They are the source of truth — if this file
and one of those disagree, the more detailed doc wins.

## What this project is

A syllabus-tracking web app for students preparing for Rajasthan state exams (RAS Pre,
RPSC 2nd Grade Paper I, RPSC 2nd Grade Paper II Science). Static site, hosted on GitHub
Pages, used daily for months on both desktop and phone. See PRD.md for the full product
vision — this is a from-scratch UI/UX/feature rebuild, not a patch of the old version.

## Hard architectural constraints (do not violate)

- **No bundler, no framework.** Vanilla HTML/CSS/JS (ES6+), loaded via `<script>` tags in
  `index.html`. No React/Vue/webpack/vite. This must run by opening `index.html` on GitHub
  Pages with zero build step.
- **Script load order in `index.html` matters** because there are no ES modules with import
  resolution assumed — keep dependency order explicit and documented in ARCHITECTURE.md.
- **CSS is modular by feature** (`base.css`, `header.css`, `home.css`, `study.css`,
  `progress.css`, `components.css`, etc.) — never collapse into one file.
- **JS is modular by feature**, one concern per file. Keep `state.js` as the single source of
  mutable app state; other modules read/write through it, not through scattered globals.
- **Dual persistence**: `localStorage` for guest/offline, Firestore sync for signed-in users
  (Google auth), debounced writes, local-first read for instant load. Reuse the existing
  Firebase project config — do not create a new Firebase project or change its config values.
- **Syllabus content vs. user state are separate.** The JSON files describe the syllabus tree
  (ids, titles) and must not embed per-user mutable fields like `completed`/`revision`/
  `bookmarked`/`notes`. User progress lives in a separate `userState` object keyed by topic
  `id`, persisted via storage.js. See DATA_MODEL.md for why and for the migration plan from
  the old embedded-field JSON.

## Security rules (non-negotiable)

- Any user-supplied or externally-sourced string (topic titles are fine, they're static
  content — but display names, notes text, resource titles, imported JSON on Import) must
  go through a real `escapeHTML()` that escapes `& < > " '` before ever touching
  `innerHTML`. Prefer `textContent` wherever there's no actual need for HTML.
  Never use `innerHTML` with unescaped or unvalidated input — this includes toast messages,
  user display names, and note content.
- No base64 blobs written directly into Firestore documents. Cap any user upload size and
  warn well below Firestore's 1MB document limit, or skip file storage entirely for v1 (see
  PRD.md open questions).
- External links: `rel="noopener noreferrer"`. YouTube/embedded iframes: `sandbox` attribute.
- Firestore rules must scope by `auth.uid == userId` and include a document size bound.
- No secrets beyond the already-public Firebase client config (expected for client-side
  Firebase). Don't add anything more sensitive to the repo.

## Coding standards

- Prefer small, named functions over long inline handlers. Comment *why*, not *what*.
- No dead code, no duplicate function definitions (the old codebase had `renderX()` defined
  twice in one file — grep for duplicate top-level function names before finishing a file).
- Every interactive element must be keyboard-reachable (real `<button>`s, not `<div onclick>`).
- Ship features per BUILD_PLAN.md phase order. Don't jump ahead to polish before a phase's
  core functionality works end-to-end.
- After each phase, do a self-check pass: open the page, click through the feature, check the
  console for errors, verify localStorage keys look sane.

## Design tokens

Use the palette and type scale defined in DESIGN_SYSTEM.md exactly — do not default to
indigo/emerald/amber or any other generic AI-app palette.

## When something in the docs is ambiguous

State your assumption in a code comment or commit message and proceed with the most
reasonable interpretation rather than blocking on it. Flag genuinely blocking ambiguities
back to the user in your response instead of guessing silently on architecture-level
decisions (e.g. auth flow changes, Firestore schema changes).
