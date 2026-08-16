Paste everything below this line as your first message to Claude Code, in the repo root
(after copying CLAUDE.md to the repo root and the other five docs into a `/docs` folder).

---

We're rebuilding this syllabus-tracker web app from scratch — new UI/UX, restructured
features, cleaned-up data model — reusing the existing Firebase project config and this
GitHub repo, but otherwise starting fresh. This is a static site (no bundler, no framework)
that will be hosted on GitHub Pages, used daily by students on both desktop and phone.

Before writing any code, read these in order:
1. `/.agent/rules/conventions.md` — project conventions and hard constraints (read this first, it's also
   auto-loaded every session)
2. `/docs/PRD.md` — full product vision, information architecture, and feature spec
3. `/docs/ARCHITECTURE.md` — technical architecture, file structure, state shape, security
4. `/docs/DATA_MODEL.md` — syllabus content vs. user-progress data split, and the migration
   plan for the existing syllabus JSON files
5. `/docs/DESIGN_SYSTEM.md` — color tokens, typography, spacing, motion rules
6. `/docs/BUILD_PLAN.md` — the phased build order to follow

I've also placed the three raw syllabus JSON files (RAS Pre 2026, RPSC 2nd Grade Paper I,
RPSC 2nd Grade Paper II Science) in the repo — Phase 0 of the build plan covers cleaning
these into the content-only shape described in DATA_MODEL.md.

Before starting Phase 0, answer or ask me about the open questions in PRD.md §12 — don't
guess silently on those, they affect scope. For everything else, follow the docs as source
of truth; if something is genuinely ambiguous and architecture-affecting, ask me rather than
assuming, but for smaller implementation details just make the most reasonable call and note
your assumption.

Work through BUILD_PLAN.md phase by phase. After each phase, tell me what you built, how to
verify it, and stop for my go-ahead before starting the next phase — I want to actually look
at Home and Study before you build Progress on top of them.

Start with Phase 0.
