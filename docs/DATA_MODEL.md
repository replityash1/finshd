# DATA MODEL — Syllabus content vs. user progress

## 1. Why this changes from the old app

The current syllabus JSON files (attached to the project) embed per-user mutable fields
directly on every topic node: `"completed": false, "revision": false, "bookmarked": false,
"notes": ""`. That conflates **static syllabus content** (which subjects/topics exist, in
Hindi and English) with **per-user progress state** (what this particular student has done).

Problems with the old approach:
- Every syllabus JSON ships with fake default state baked in, bloating file size for no
  reason (this is very likely why `syllabus_data.js` ballooned to 461KB).
- There's no natural place to store a `last_touched_at` timestamp for staleness sorting
  (needed for the new "due for revision" and "weak spots" features) without further bloating
  the content file.
- It's harder to reason about sync: if content and state are mixed, a Firestore document has
  to either duplicate the whole tree per user (expensive) or the app has to diff against the
  static file at runtime anyway (which is what a clean split does explicitly).

## 2. Recommended split

**Syllabus content files** (`/syllabus/*.json`) — static, shipped with the app, same for
every user, no per-user fields:

```json
{
  "exam": "RAS Pre 2026",
  "examId": "ras_pre_2026",
  "subjects": [
    {
      "id": "rajasthan_history_culture",
      "title_hi": "...",
      "title_en": "...",
      "topics": [
        {
          "id": "prehistoric_sites_rajasthan",
          "title_hi": "...",
          "title_en": "...",
          "children": []
        }
      ]
    }
  ]
}
```

(The RPSC 2nd Grade Paper II Science file's extra `level` / `level_label_en` / `level_label_hi`
fields — marking whether a topic is Sr. Secondary standard, Graduation standard, or Teaching
Methods/pedagogy — are genuinely useful for filtering and should be kept as content fields.)

**User state** (`userState` in `state.js`, persisted via `storage.js`), keyed by topic id,
flat rather than nested — flat lookup is faster for staleness sorting/search than walking
the tree:

```js
userState = {
  topics: {
    "prehistoric_sites_rajasthan": {
      completed: false,
      revision: false,
      bookmarked: false,
      notes: "",
      last_touched_at: null,      // ISO timestamp, set whenever completed/revision toggles
      completed_at: null          // ISO timestamp, set when marked complete (for streak/pace)
    }
  },
  activity: {
    // date string -> count, drives the heatmap/streak
    "2026-08-16": 4
  }
}
```

A topic with no entry in `userState.topics` is implicitly "not started" — don't pre-populate
every topic id into `userState` on load; only write an entry when the user actually
interacts with that topic. This keeps guest localStorage payloads small.

## 3. Migration plan for the existing JSON files

1. Strip `completed`, `revision`, `bookmarked`, `notes`, and the top-level `progress` field
   from every node in all three syllabus JSON files — these become pure content files.
2. Keep `id`, `title_hi`, `title_en`, `children` (and `level`/`level_label_*` where present)
   on every node.
3. Regenerate `syllabus_data.js` (the fallback bundle) from the cleaned JSON via a small
   script, so it can never drift out of sync with the source files — don't hand-maintain it.
4. If any existing users have progress stored in the old embedded-field shape (unlikely at
   this stage since this is a from-scratch rebuild on the same Firebase project, but worth a
   guard), write a one-time migration in `storage.js` that reads old-shape state (if present)
   and converts it into the new flat `userState.topics` shape on first load, then discards the
   old shape.

## 4. Derived data (computed at runtime, not stored)

- **Staleness** (for "due for revision," sorted): `now - last_touched_at` for any topic where
  `revision === true`.
- **Weak spots** (for Progress): group topics by subject, count topics with no `userState`
  entry or with `last_touched_at` older than N days, per subject.
- **Pace**: `completed count / total topic count` vs. `days elapsed since first activity` and
  optional `days remaining until examDate`, to project a finish date.
- **Search index**: flattened `{id, title_en, title_hi, subjectId, path}` array built once per
  exam on load from the content JSON (not from `userState`).

## 5. Cross-exam overlap data

Keep `CROSS_EXAM_ID_MAP` in `config.js` as in the old app (maps topic ids that are shared in
substance across exams, e.g. Rajasthan GK topics appearing in both RAS Pre and 2nd Grade Paper
I). Fix the old overlap-stats bug: the "unique to 2nd Grade" count must include topics from
**both** 2nd Grade papers (Paper I general + Paper II Science), not just one; and replace the
old `(totalOverlap * 2 / combined) * 100` "efficiency" formula (which can mathematically
exceed 100%) with a straightforward `sharedTopics / totalUniqueTopicsAcrossBothExams * 100`.
