# BUILD PLAN — phased implementation order

Work through phases in order. Don't start a phase's polish before its core functionality
works end-to-end. After each phase, do a self-check (open in browser, click through, check
console) before moving on. Commit at the end of each phase with a message naming the phase.

## Phase 0 — Setup & data cleanup
- Confirm Firebase config carries over unchanged (same project — reuse, don't recreate).
- Set up the directory structure from ARCHITECTURE.md §2.
- Clean the three syllabus JSON files per DATA_MODEL.md §3 (strip embedded user-state
  fields, keep content-only fields). Write the small script that regenerates
  `syllabus_data.js` from the cleaned JSON files.
- Resolve PRD.md §12 open questions with the user before proceeding if not already answered.
- Set up `base.css` with the full design token set from DESIGN_SYSTEM.md.

## Phase 1 — Data & state layer
- `config.js`: `EXAMS`, `CROSS_EXAM_ID_MAP` (with the overlap-stats fix from DATA_MODEL §5).
- `state.js`: the `appState` shape from ARCHITECTURE §3.
- `utils.js`: fixed `escapeHTML()`, staleness/date helpers, small DOM helpers.
- `storage.js`: localStorage read/write, debounced Firestore sync, sync status updates,
  document-size guard, one-time old-shape migration guard (DATA_MODEL §3.4).
- No UI yet — verify via console that state loads, mutates, and persists correctly for both
  a guest session and a signed-in session.

## Phase 2 — App shell & navigation
- `index.html` skeleton: nav (bottom on mobile / rail on desktop), view containers for
  Home/Study/Progress, auth overlay, theme toggle.
- `nav.js`: view switching, theme toggle (both themes fully tokenized per DESIGN_SYSTEM §2),
  keyboard shortcut scaffolding (`/`, `Cmd/Ctrl+K`, `Esc`).
- Favicon + `manifest.json` (PWA basics) added here, not deferred to the end.

## Phase 3 — Study view (syllabus tree)
- Render subjects collapsed-by-default with progress rings; lazy-render topic rows on expand.
- Mark complete / toggle revision / toggle bookmark, each writing through `state.js` →
  `storage.js`, each with an Undo toast.
- Search: build the flattened index on exam load, wire the search input + command palette to
  jump-and-expand.
- Overlap filter chip using `CROSS_EXAM_ID_MAP`.
- Bulk "mark all above this point" action on subject headers.
- This is the highest-traffic view — get it right before moving on.

## Phase 4 — Home view
- Continue card, Due-for-revision strip (staleness-sorted), optional Today's-focus target,
  quiet stats row, empty state for new accounts.
- Depends on Phase 3's mark/flag logic being solid, since Home reads the same `userState`.

## Phase 5 — Progress view
- The five sections from PRD §6: Pace, Streak+heatmap, Per-exam breakdown, Weak spots,
  Notes & bookmarks library.
- Verify no two sections are restating the same number in different chart types.

## Phase 6 — Study Hub (notes modal)
- Markdown notes via `marked.js` + sanitization pass before insertion (ARCHITECTURE §5).
- Links + YouTube embeds (sandboxed iframe, `noopener noreferrer` links).
- File/image attachments: only if PRD open question #3 was answered "include," with a hard
  size cap and pre-write size warning.

## Phase 7 — Cross-cutting features & polish
- Export/Import JSON (`export.js`), with import-shape validation before merge.
- Print stylesheet for the revision sheet.
- Exam countdown + Pace integration if exam dates were provided.
- Local reminders (Notification API) if PRD open question #4 was answered "include."
- Full security pass against CLAUDE.md's security checklist.
- Full responsive pass at 360px, 768px, 1024px+ widths.
- Performance pass: verify initial paint doesn't block on rendering the full expanded tree,
  check bundle/asset sizes are reasonable for a 3G-ish connection.
- Accessibility pass: keyboard-only walkthrough of every primary action.

## Explicit non-goals for this build (see PRD §9)
Do not add badges/points/leaderboards, social/sharing features, AI study-plan generation or
a chatbot, or forced streak-guilt mechanics, even if they'd be quick to add — they're
deliberately out of scope.
