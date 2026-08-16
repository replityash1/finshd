# DESIGN SYSTEM — Syllabus Tracker

## 1. Principles

- Distinctive and professional, not "AI-generated dashboard." Avoid indigo/emerald/amber —
  the most overused default palette on the web.
- Color used sparingly and purposefully: exam-accent colors appear as thin left-borders,
  small icons, and progress rings — never as full card backgrounds. With three exams visible
  at once (RAS Pre, 2nd Grade Paper I, Paper II Science), heavy color-blocking turns into
  visual noise fast.
- Typography carries most of the identity. Large confident numerals for stats, restrained
  body text everywhere else.
- Motion confirms state changes; it is never decorative or blocking.

## 2. Color palette — "Midnight Campus"

| Token | Dark mode | Light mode | Use |
|---|---|---|---|
| `--bg` | `#0a0b10` | `#f8f7f4` (warm ivory) | Page background |
| `--bg-elevated` | `#10121a` | `#ffffff` | Cards, panels |
| `--border` | `#1e2130` | `#e8e6e1` | Dividers, card borders |
| `--text-primary` | `#e4e3ef` | `#1a1a2e` | Body / headings |
| `--text-secondary` | `#9896ab` | `#6b6985` | Captions, metadata |
| `--accent-ras` | `#7c6df0` (soft violet) | `#6c5ce7` | RAS Pre exam accent |
| `--accent-2g-p1` | `#2ed8a3` (seafoam) | `#00b894` | 2nd Grade Paper I accent |
| `--accent-2g-p2` | `#e17055` (terracotta) | `#d35400` | 2nd Grade Paper II Science accent |
| `--success` | `#2ed8a3` | `#00b894` | Completion states |
| `--danger` | `#ff6b6b` | `#e74c3c` | Destructive actions, overdue |
| `--warning` | `#f4b350` (muted amber, used sparingly) | `#e0a030` | Revision-due indicator |

Both themes must define every token above — the old app's light theme only overrode ~12
variables and looked washed out; every component-level color must resolve through a token,
never a hardcoded hex in component CSS.

## 3. Typography

Font: Inter (already used; keep it, but apply it deliberately).

| Role | Weight | Size | Notes |
|---|---|---|---|
| Hero numerals (stats) | 800 | 32–40px | `letter-spacing: -0.02em` |
| Page/section titles | 600 | 13px | Uppercase, `letter-spacing: 0.06em` |
| Card titles | 600 | 15–16px | |
| Body | 400 | 14px | `line-height: 1.65` |
| Caption/metadata | 400 | 12px | `color: var(--text-secondary)` |

## 4. Spacing & layout

- 4px base spacing unit; use multiples (4/8/12/16/24/32).
- Mobile: bottom nav, single-column stacking, min touch target 40×40px.
- Desktop: left rail nav (fixed width ~72–220px depending on collapsed/expanded), content
  max-width around 960–1080px to avoid overly long topic-row lines.
- Cards: `border-radius` in the 12–16px range, subtle 1px border using `--border`, no heavy
  drop shadows — a soft, low-opacity shadow only on elevated/modal surfaces.

## 5. Motion

- State confirmations only: a checkbox settling into "done," a card collapsing/expanding, a
  toast sliding in. Duration 150–250ms, ease-out.
- One reserved "moment": completing an entire subject (100%) gets a brief, tasteful animation
  — not confetti-every-checkbox. This is the only celebratory motion in the app.
- No animation should delay the user getting to content — nothing blocks interaction while
  playing.

## 6. Components (behavioral notes, not full spec — build these in `components.css`)

- **Toast**: bottom-anchored on mobile, corner-anchored on desktop, 5s auto-dismiss, includes
  an Undo action for destructive/state-changing operations, uses `textContent` for the
  message (never `innerHTML`).
- **Subject card**: collapsed by default, compact progress ring, expands on tap/click with a
  smooth height transition; accent color as a 3–4px left border only, not a background fill.
- **Topic row**: single line, leading status icon (not-started / done / revision), trailing
  overflow affordance (swipe on mobile, hover-reveal on desktop) for bookmark/notes actions.
- **Search / command palette**: overlay, `/` or `Cmd/Ctrl+K` to open, `Esc` to close, arrow
  keys to move selection, `Enter` to jump.
- **Empty states**: always include a short explanatory line and one clear CTA button, never a
  bare blank area.
