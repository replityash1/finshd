# ARCHITECTURE — Syllabus Tracker

## 1. Stack

Vanilla HTML5 / CSS3 / ES6+ JavaScript. No bundler, no framework, no npm build step. Firebase
v10 (Auth + Firestore, compat SDK is fine to keep since it worked before — or migrate to
modular SDK if it doesn't add a build step; compat via `<script>` tag is the safer default
for a no-bundler GitHub Pages site). `marked.js` via CDN for markdown rendering in Study Hub,
output passed through a sanitizer before insertion.

## 2. Directory structure

```
/
├── index.html
├── manifest.json                 # PWA manifest (new)
├── favicon.svg                   # new
├── firestore.rules
├── syllabus/
│   ├── ras_pre_2026.json
│   ├── rpsc_2nd_grade_paper1.json
│   └── rpsc_2nd_grade_paper2_science.json
├── css/
│   ├── base.css                  # tokens, reset, typography
│   ├── nav.css                   # bottom nav (mobile) / rail (desktop)
│   ├── home.css
│   ├── study.css                 # syllabus tree, search, filters
│   ├── progress.css              # analytics
│   ├── components.css            # modals, toasts, buttons, study hub
│   └── print.css                 # revision sheet print stylesheet
├── js/
│   ├── firebase-config.js
│   ├── config.js                 # EXAMS, CROSS_EXAM_ID_MAP, color tokens
│   ├── state.js                  # single mutable state object + accessors
│   ├── storage.js                # localStorage + Firestore dual persistence
│   ├── utils.js                  # escapeHTML, date/staleness helpers, DOM helpers
│   ├── search.js                 # topic search + command palette (new)
│   ├── home.js                   # Home view render + logic (new)
│   ├── study.js                  # syllabus tree render, mark/flag/bookmark, overlap filter
│   ├── progress.js                # analytics render (was analytics.js)
│   ├── studyhub.js               # notes modal
│   ├── nav.js                    # tab switching, keyboard shortcuts, theme toggle
│   ├── export.js                 # JSON export/import, print sheet (new)
│   └── init.js                   # bootstrap: auth listener, data load, initial render
└── docs/                         # this doc set
```

Script load order in `index.html` (dependency order, no module resolution):
`firebase-config.js` → `config.js` → `state.js` → `storage.js` → `utils.js` → `search.js` →
`export.js` → `home.js` → `study.js` → `progress.js` → `studyhub.js` → `nav.js` → `init.js`.

## 3. State shape

Single mutable object in `state.js`, e.g.:

```js
const appState = {
  currentUser: null,          // Firebase user or null (guest)
  activeExamId: 'ras_pre_2026',
  activeView: 'home',         // 'home' | 'study' | 'progress'
  syncStatus: 'idle',         // 'idle' | 'saving' | 'synced' | 'offline'
  rawSyllabus: {},            // { examId: parsedSyllabusJSON } — immutable content
  userState: {},              // see DATA_MODEL.md — mutable per-topic progress
  preferences: {               // persisted, non-syllabus settings
    theme: 'dark',
    language: 'en',
    dailyTargetEnabled: false,
    dailyTargetCount: 5,
    examDates: {}              // { examId: 'YYYY-MM-DD' } optional
  }
};
```

Views read from `appState` and re-render their own DOM subtree; they never read/write
`localStorage`/Firestore directly — only `storage.js` does that, exposing
`saveUserState()`, `loadUserState()`, `debouncedSync()`.

## 4. Persistence

- **Guest**: everything in `localStorage`, one JSON blob per exam or a single namespaced
  blob — keep it small enough to round-trip fast; write on every state-changing action,
  no debounce needed for localStorage.
- **Signed-in**: Firestore document per user (`users/{uid}`), holding `userState` +
  `preferences`. Writes are debounced (e.g. 1.5s after last change) to avoid write-storming
  Firestore on rapid clicking. On sign-in, if local data exists and no cloud document exists,
  migrate local → cloud once, then treat cloud as source of truth.
- **Document size guard**: before writing to Firestore, estimate the serialized size; if it's
  approaching the 1MB document limit, warn the user rather than silently failing. This mainly
  matters if Study Hub attachments are added later — with attachments deferred (per PRD open
  question), this should rarely trigger for text-only notes.
- **Sync status indicator**: `storage.js` updates `appState.syncStatus` and `nav.js` reflects
  it near the profile icon — `idle` (nothing pending) / `saving` / `synced` / `offline`.

## 5. Security requirements (implementation detail — see CLAUDE.md for the policy)

- `escapeHTML(str)` must escape `&`, `<`, `>`, `"`, `'` — write it once in `utils.js`, use it
  everywhere user-influenced text is inserted via `innerHTML`. Prefer `element.textContent =`
  wherever no markup is actually needed (toast messages, display names).
- Markdown from Study Hub notes: render with `marked.parse()`, then run the result through an
  allow-list sanitizer (strip `<script>`, event handler attributes, `javascript:` URLs) before
  inserting into the DOM. If no sanitizer library is added, hand-roll a minimal allow-list
  sanitizer rather than skipping this step.
- Import (JSON restore feature): validate the shape of imported JSON before merging into
  state — reject anything that doesn't match the expected `userState` schema, and never
  `eval`/`Function()` it.
- External links get `rel="noopener noreferrer" target="_blank"`. YouTube iframes get a
  `sandbox="allow-scripts allow-same-origin allow-presentation"` attribute (minimum needed
  set, not a blanket sandbox bypass).
- `firestore.rules` should scope reads/writes to `request.auth.uid == userId` and add
  `request.resource.size() < N` as a ceiling.

## 6. Rendering approach

- Subject cards render collapsed by default; topic rows for a subject are only built and
  inserted into the DOM when that subject is expanded (lazy render), to keep initial paint
  fast on large syllabi (RPSC Paper II Science alone has several hundred leaf topics across
  Biology/Chemistry/Physics/Teaching Methods).
- Search operates over an in-memory flattened index built once per exam load (id, title_en,
  title_hi, parent path) — not a DOM query — so it stays fast regardless of tree depth.
- Staleness ("due for revision," "weak spots") is computed from a `last_touched_at` timestamp
  per topic in `userState` (see DATA_MODEL.md), not stored redundantly elsewhere.

## 7. What changes vs. the old codebase, explicitly

- `escapeHTML()` fixed to escape all five characters, not just quotes.
- `showToast()` uses `textContent`, not `innerHTML`.
- Duplicate `renderBookmarkNotes()` — the two responsibilities (summary stats vs. resource
  browser) become two distinctly-named functions in two distinctly-placed views (Progress §5
  vs. nowhere duplicated).
- Duplicate `.notes-modal` CSS rule removed.
- Overlap stats bug (missing Science exam in `ov-2g-unique`, misleading "efficiency" formula)
  — recompute correctly and drop the >100%-capable formula for a straightforward "topics
  shared / total unique topics across both exams" percentage.
- Context bar removed; its info folds into Home's quiet stats row.
- Base64 file storage in Firestore removed / deferred per PRD §7.
- Favicon + PWA manifest added (both absent in the old app).
