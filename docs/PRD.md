# PRD — Syllabus Tracker (from-scratch rebuild)

## 1. Product summary

A syllabus tracker for students preparing for Rajasthan state exams — currently RAS Pre 2026,
RPSC 2nd Grade Paper I, and RPSC 2nd Grade Paper II (Science). Used daily, for months, mostly
solo, often at night, often on a phone with a weak connection. The product's job is to answer
three questions fast: **what do I study right now**, **let me log what I just did**, and
**how am I actually doing**. Everything in this rebuild is organized around those three jobs.

Its real competitor is a paper checklist. It wins only if it's faster than paper for logging
progress and better than paper at surfacing what's stale — not by being flashier.

## 2. Guiding principles

1. Minimize the distance between "I finished something" and "it's logged."
2. Minimize the distance between "I opened the app" and "I know what to do."
3. Calm over gamified. No streak guilt-tripping, no leaderboards, no forced celebration.
4. Fast and offline-tolerant. Works fine on a bad hostel connection.
5. Trustworthy data. A student must never wonder "did that save?"

## 3. Information architecture

Three destinations (bottom nav on mobile, left rail on desktop), not the old four
(Tracker / Overlap / Analytics):

- **Home** — landing screen, answers "what do I study right now"
- **Study** — the syllabus tree, search, marking progress; Overlap is a filter inside this,
  not a separate tab
- **Progress** — trimmed analytics, answers "how am I doing"

A persistent search trigger (search icon on mobile, `Cmd/Ctrl+K` on desktop) is always
reachable regardless of which destination is active.

## 4. Home

This view does not exist in the old app and is the centerpiece of the rebuild.

- **Greeting strip** — short, time-aware, factual (e.g. "Tuesday · 11 topics left this week"),
  not a fake-cheerful assistant voice.
- **Continue card** — last topic touched, which exam, one-tap "mark complete" and "open,"
  no navigation required to close the loop on the last session.
- **Due for revision** — topics flagged for revision, sorted by staleness (days since last
  touched), capped at ~6 visible with a "see all" link into Study filtered to revision items.
  This is the single highest-value new feature: revision flags currently go in and are never
  surfaced again anywhere in the old app.
- **Today's focus** (optional, dismissible, off by default is fine) — a soft target like
  "study 5 topics" or "30 minutes." One tap to turn off permanently.
- **Quiet stats row** — overall completion %, current streak, days-to-exam if the user set a
  date. Max 3 numbers. No charts on this screen.
- **Empty state** — a brand-new account gets a clear CTA ("pick your exam, let's set up your
  first session"), never a blank tracker.

## 5. Study (syllabus view)

- **Search-first.** Real search input at the top. Typing a term jumps to and expands the
  matching topic in the tree, across subjects. This is the single biggest speed fix versus
  the old app, which has no search.
- **Command palette** (`Cmd/Ctrl+K` desktop, search icon mobile) — jump to any subject/topic,
  switch exam, or trigger actions (export data, toggle theme) from one input.
- **Subject cards collapsed by default**, with a compact progress ring; tap/click to expand.
  The old app appears to render everything open, which is heavy for large syllabi like the
  RAS Pre or Science papers (both several hundred leaf topics).
- **Topic rows are single compact lines** with icon-based status. Tap cycles
  not-started → done. Swipe (mobile) or hover-reveal (desktop) exposes revision/bookmark/notes
  actions, instead of a permanent row of buttons per topic.
- **Overlap becomes a filter chip** ("Shared with [other exam]") inside Study rather than a
  separate tab — same data, different lens on one continuous task.
- **Bulk actions** — long-press/right-click a subject header → "mark all topics above this
  point complete," for students migrating progress from a paper tracker.
- **Undo toast** on every state-changing action (mark complete, delete note, clear flag) —
  5-second window, one-tap undo.
- **Keyboard shortcuts (desktop)** — `/` focus search, `j`/`k` move through the topic list,
  `space` toggle complete on the focused topic.

## 6. Progress (trimmed analytics)

Cut from the old app's ten sections down to five, each answering a distinct question — no
two visualizations should restate the same underlying number:

1. **Pace** — completion % vs. days-to-exam (if set), phrased as "at this rate you'll finish
   by [date]," not a bare percentage.
2. **Streak + activity heatmap** (merged into one section).
3. **Per-exam breakdown** — simple horizontal bars across the active exams.
4. **Weak spots** — subjects with the most stale/never-touched topics; feeds Home's revision
   strip.
5. **Notes & bookmarks library** — the resource-browsing view (the old app's duplicated
   "explorer grid" `renderBookmarkNotes`) belongs here as a browsing feature, not mixed into
   stat cards.

Explicitly cut from the old ten sections: "Completion Comparison" (redundant with per-exam
breakdown), "Revision Distribution" and "Topic Velocity" as standalone sections (folded into
Pace/heatmap), and the duplicate simple-stats version of bookmark notes (superseded by #5).

## 7. Study Hub (per-topic notes)

Keep the existing concept — attach markdown notes, links, YouTube embeds, and (later) files
to a topic — but:
- Notes render through `marked.js` output that is sanitized before insertion (no raw
  `innerHTML` of unsanitized markdown output).
- File/image attachments are **out of scope for v1** unless the user explicitly asks for
  them, because base64-in-Firestore is a real failure mode (see ARCHITECTURE.md). If kept,
  cap size hard and warn well under the Firestore 1MB document limit.

## 8. Cross-cutting features

- **Data export/import (JSON)** — prominent, in a small settings area, not buried. Critical
  because guest/localStorage-only users have no other backup.
- **True PWA** — installable, works offline for already-loaded data, add a proper favicon and
  manifest (the old app has neither).
- **Sync status indicator** — small, honest "synced / saving… / offline, will sync" near the
  profile icon.
- **Print/export a revision sheet** — one-click printable page of pending + flagged topics,
  for offline last-week cramming.
- **Local reminders** (opt-in, Notification API) — e.g. "you haven't touched Polity in 9
  days." No backend required.
- **Exam countdown** — if the user sets an exam date, surfaced on Home and used in Pace.

## 9. Explicitly not building

- No badges, points, or leaderboards.
- No social/sharing features.
- No AI study-plan generation or chatbot.
- No forced daily-streak guilt mechanics — streak is shown, never punished.

## 10. Design direction (see DESIGN_SYSTEM.md for exact tokens)

Distinctive, professional palette — not the generic indigo/emerald/amber combination.
Exam-accent colors used sparingly (thin borders, small icons), not as full card backgrounds.
Motion reserved for state confirmation, plus one genuine celebration moment at 100% subject
completion. Typography carries identity: confident numerals for stats, restrained body text
elsewhere.

## 11. Non-functional requirements

- **Performance**: fast first paint on a mid-range phone over 3G-ish connections; avoid
  render-blocking the full syllabus tree on load (render collapsed, lazy-expand).
- **Security**: see CLAUDE.md security rules — these are mandatory, not optional polish.
- **Accessibility**: real focusable buttons, visible focus states, sufficient contrast in
  both themes, keyboard operability for all primary actions.
- **Responsiveness**: fully usable at 360px width and up; bottom nav on mobile, rail on
  desktop; touch targets ≥ 40px on mobile.
- **Hosting**: must work unmodified as a GitHub Pages static site — no server code.

## 12. Open questions for the user (resolve before or during Phase 0)

1. Exam dates — do you want to hardcode known exam dates now, or leave the countdown field
   empty/user-settable?
2. `syllabus_data.js` (461KB fallback bundle in the old app) — regenerate from the JSON files
   as part of the build, or keep hand-maintained? Recommendation: generate it with a small
   script so it never drifts from the JSON source of truth.
3. File/image attachments in Study Hub — include in v1 with strict size caps, or defer
   entirely to a later phase? Recommendation: defer.
4. Do you want local push-style reminders in v1, or is that a fast-follow?

These should be resolved as literal questions back to the user, not silently assumed, since
they affect Phase 0 scope.
