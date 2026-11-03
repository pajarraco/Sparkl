# Sparkl — Design

> Status: implemented (MVP build). This page is the visual spec and the record of the UI as shipped. Scope lives in [project.md](project.md), system structure in [architecture.md](architecture.md).

## Design Thesis

Clean and airy. The app is a crisp, bright space — white ground, indigo signature, one vivid orange accent — that feels capable and human.
Not: dark-mode-first, neon accents, heavy shadows, playful rounded-everything. Hosts and cleaners are doing real work here; the UI stays out of the way.

## Palette

White ground, deep indigo signature, one vivid orange accent, slate ink. Defined once as NativeWind v4 `@theme` tokens (and mirrored for any `StyleSheet` use):

| Token | Hex | Usage |
| ----- | --- | ----- |
| `paper` | `#FFFFFF` | App ground |
| `paper-2` | `#F8FAFC` | Raised surfaces, grouped-list ground |
| `ink` | `#1E293B` | Body text (12.6:1, AAA) |
| `ink-soft` | `#64748B` | Secondary text (4.9:1, AA) |
| `ink-mute` | `#94A3B8` | Captions, placeholders, inactive tabs |
| `indigo` | `#2205A4` | Signature — primary CTAs, links, active tab, focus (8.6:1, AAA) |
| `indigo-deep` | `#1A0480` | Pressed/hover state |
| `orange` | `#FF6B00` | Graphic marks only — card rails, dots, badges, active accents |
| `orange-deep` | `#C24E00` | Orange *text* on white (≥4.5:1, AA), including ★ glyphs |
| `orange-tint` | `#FFF0E6` | Soft tint for tags and highlight badges |
| `stone` | `#E2E8F0` | Dividers, card borders |
| `success` / `danger` | system green/red | Status only (completed, cancelled, destructive actions) |

**Orange restriction:** `#FF6B00` fails AA on white, so it never sets text. Review stars, ratings and any orange copy use `orange-deep`. Do not introduce a new colour without adding it here first and checking contrast.

## Typography

One family. **Elms Sans** (Google Fonts, variable 100–900, OFL) for display and body. On native, load via the `@expo-google-fonts` package if published, otherwise bundle the TTFs; fallback is the platform system sans.

| Style | Size/leading | Weight | Usage |
| ----- | ------------ | ------ | ----- |
| Title | 32/38, −0.02em | 700 | Screen titles |
| H2 | 24/30, −0.02em | 700 | Section headers |
| H3 | 20/26 | 600 | Card titles, job titles |
| Body | 16/24 | 400/500 | Default text |
| Small | 14/20 | 400/500 | Secondary rows, chat bubbles |
| Caption | 12/16 | 500 | Meta, timestamps |
| Eyebrow | 12, +0.14em, uppercase | 600 | Section markers, card kickers |

- Prices, dates, distances and ratings use tabular numerals, weight 500.
- No other font family anywhere. No mono.

## Spacing, Layout, Rhythm

- **4pt grid.** Screen edge padding 16 (20 on wide/web), section gaps 24, related rows 8–12.
- **Radii:** controls and inputs 6, cards 6–14, bottom sheets 14. Avatars are the only full-round elements.
- **Containment via borders**, not shadows: cards get a 1px `stone` border on `paper`. No drop shadows, no gradients.
- **Single column.** Lists full-width; detail screens cap content at ~640pt on web/tablet. Every screen's outer content caps at 990px and centers above that width (`Screen`); below 990px it's full-width as usual.
- **Desktop CTA rows (≥768px):** a bottom row of multiple primary actions (Job Detail's Open Chat / Leave a Review / Complete / Cancel) switches from a stacked full-width column to a fit-content row aligned right, instead of stretching the full 990px column width. Below 768px, or for a single lone CTA anywhere, buttons stay full-width and stacked.
- Generous vertical rhythm between sections; hairline dividers over background banding.

## Navigation

Role-based bottom tabs. The tab bar changes with the signed-in role:

- **Host (five tabs, 03 E):** My Jobs · Properties · New Job (center, prominent `+`) · Messages · Profile.
- **Cleaner (four tabs):** Board · My Jobs · Messages · Profile.

- Active tab: `indigo` icon + label. Inactive: `ink-mute`. Unread counts badge on Messages.
- Detail screens (job detail, chat thread, review) push inside the tab they were opened from, and the tab bar stays visible, so the user can jump to another tab from a job or a chat. Each tab keeps its own history; tapping the active tab again returns to its root.
- Every detail screen has a Back button above its title. With history it goes back; on a deep link or after a reload it returns to the root of its tab.
- Auth (welcome, sign in, sign up with role pick) sits outside the tabs until signed in.

## Screen Inventory

**Host:** My Jobs (open / active / history) · Properties (list, add/edit with the address map picker, archive instead of delete) · Post Job (assistant chat with a live draft card, a price-hint line and a "usual cleaner pinned" line; "Review" / "Use the form instead" opens the form: a property picker — or "Add your first property" with none saved — window, size/notes, price) · Job Detail (status, ranked cleaner suggestions, chat entry, lifecycle actions) · Chat Thread · Leave Review · Profile.

**Cleaner:** Board (ranked jobs + filters: date, distance, price) · Job Detail (full info, claim CTA) · My Jobs (claimed / active / history) · Chat Thread · Leave Review · Profile (photo, service area, availability editor).

**Shared:** Chat Thread (per job, realtime) · Leave Review (stars + comment, after completion) · Public Profile View · Settings (account, sign out).

## Key Flows

**Post → fill → complete (host):** New Job tab → assistant (or the form directly) → review form → Job Detail shows ranked cleaner suggestions → cleaner claims → coordinate in Chat Thread → mark completed → Leave Review.

**Find → claim → complete (cleaner):** Board (ranked) → Job Detail → Claim → appears in My Jobs → Chat Thread to confirm → mark in progress → mark completed → Leave Review.

Both flows end at the review screen; both parties must be able to reach it from history afterwards.

## Signature Element: the Job Card

The one memorable component, used on the Board, My Jobs, and suggestions:

- Left edge: 4px `orange` rail.
- Top: address in uppercase caption, `ink-soft`.
- Title: H3, `ink`.
- Meta row: date/time · price · distance (or cleaner name · rating for suggestions) — small, tabular numerals.
- Trust row: the other party's ★ rating and completed-job count — host on Board and cleaner My Jobs cards, cleaner on host My Jobs cards and suggestion rows — from a batched `users.ratingsFor` lookup (one query per screen, never one per card), never hardcoded. Omitted when the job's counterpart has no rating data yet. No verified badge until a real verification backend exists.
- Status pill where relevant, tinted background with dark text, never orange-on-white text: open = green tint + dark green text; claimed / in progress = indigo tint + `indigo-deep` text; completed = `paper-2` + `ink-soft`; cancelled = red tint + dark red text.
- `stone` border, radius up to 14, no shadow, no lift on press — a meta line shifts to `indigo` instead.

## Components

- **Buttons:** primary = `indigo` fill, white uppercase label (600, +0.03em), radius 6. Secondary = white fill, 2px `indigo` border + text. Destructive = danger text, no fill. Loading state inside the button, never a bare spinner.
- **Inputs:** white fill, `stone` border, radius 6, label above in eyebrow style. Focus: 2px `indigo` outline. Never strip the focus ring.
- **Tab bar:** as in Navigation; 44pt minimum touch targets throughout. Bar height is 88pt (iOS) / 64pt (Android), taller than the platform default, so the icon + label never overflow the bar — most noticeable on the prominent New Job tab's larger icon.
- **Filter chips (Board):** a row above the list (it wraps to a second line rather than scrolling sideways, so no chip is ever hidden), one chip per filter (date `calendar`, distance `navigation`, price `dollar-sign`, Feather 16). Inactive: white fill, 1px `stone` border, `ink-soft` icon and label. Active: `paper-2` fill, `indigo` border, icon and label, and the label shows the value ("Fri, Jun 6", "≤ 10 km", "≥ $80"). Radius 6, 44pt touch target, Small 500 label. A "Clear all" chip (no icon) appears at the end while any filter is active.
- **Proposal chips (Post assistant):** under the assistant reply that offered a saved answer, one row per proposal: the proposal's label (Small 500, `ink`), then two chips. "Use this" uses the active filter-chip look (`paper-2` fill, `indigo` border and label); "Not this" uses the inactive look (`paper` fill, 1px `stone` border, `ink-soft` label). Radius 6, 44pt touch targets, wrapping rather than scrolling sideways. A tapped row is removed at once, with no confirmation, so the chat stays quiet; a failed vote keeps the chips and shows the assistant error line.
- **Bottom sheet:** a `paper` panel anchored to the bottom over a `ink` scrim at 40% opacity, radius 14 on the top corners only, 1px `stone` top border, no shadow. Holds one field, titled with the filter's short name, and its actions (primary Apply, secondary Clear). Tapping the scrim or Escape closes it without applying. The Board's filter sheet is the one exception: it anchors to the top instead (radius and border flip to the bottom edge), so the open panel doesn't sit over the tab bar.
- **Property row (Properties tab):** one per property, newest first. Name (H3, `ink`), address as an uppercase caption in `ink-soft`, size if set (Small, tabular, `ink-soft`). `stone` border, radius up to 14, no rail, no shadow; on press the name shifts to `indigo` and opens the edit form. An "Add property" primary button sits above the list; with none saved the list shows "Add your first property" instead of an empty-state line.
- **Thread row (Messages tab):** one per conversation, newest first. 40pt initials avatar (as Avatars), the other party's name (Body 500, `ink`), the job address as an uppercase caption in `ink-soft`, a one-line preview of the last message (Small, `ink-soft`, "You: " when the viewer wrote it), and the time or day at the right (Caption, tabular). Stone border, radius up to 14, no rail, no shadow; on press the name shifts to `indigo`.
- **Back button:** Feather `chevron-left` (24) in `ink`, icon only, no fill or border, 44pt touch target, accessibility label "Back". Sits at the top-left, above the screen title; the pressed state shifts the icon to `indigo`.
- **Badges/tags:** `orange-tint` background with `orange-deep` text, or `paper-2` with `ink-soft`.
- **Request badge (host My Jobs card, open jobs only):** a small pill beside the status pill, `orange-tint` fill and `orange-deep` text, showing the pending cleaner-request count ("2 requests" / "1 request"). Hidden when the count is zero. Tapping the card still opens Job Detail, where the Requests section lists them individually.
- **Stars:** ★ glyphs in `orange-deep`, 5-step, tappable in the review form, read-only elsewhere.
- **Match reasons (ranked suggestions + cleaner job detail):** one line under the trust line / match percent, Small 14/20 regular, `ink-soft`, `·`-joined, max 2 reasons (e.g. "Highly rated · Nearby"). Omitted when no signal is strong. No scores, no new colour.
- **Review card (an already-sent review):** the star rating and the written comment, each under its own small-caps eyebrow label ("Rating" / "Comment", same style as the form's own labels) so the two never read as one undifferentiated block of text. Used on the Leave Review screen once a review exists, and in a profile's Reviews section.
- **Avatars:** photo or initials on `paper-2`, full-round, `stone` ring.
- **Mic button (Post assistant composer):** a round 44pt icon button beside the composer input, Feather `mic` (20, `indigo`). Idle: `paper` fill, 1px `stone` border. Recording: `danger`-tint fill, `danger` border, icon swaps to `mic-off`, with a live "Recording… tap to stop" caption (Small, `ink-soft`) next to it — tap again to stop, no separate stop button. Transcribing: same idle look plus a small inline spinner in place of the icon; the button is disabled while transcribing. The transcript lands in the composer text, never auto-sent, so the host can edit it. On Android (no WAV recording path yet) or unsupported web browsers, the button is hidden rather than shown disabled, so the composer looks the same as it does today. Error: the composer's existing error-line style (danger text, `accessibilityLiveRegion="polite"`) shows the mic error string; the input still works.

## States

- **Loading lists:** skeleton rows shaped like job cards, no full-screen spinners.
- **Empty:** one quiet line plus the next action ("No open jobs near you yet." / "Post your first cleaning."). No decorative emoji or illustrations in MVP.
- **Error:** inline message with retry where the failure happened; toasts only for background failures.
- **Offline:** readable cached lists where React Query has data; sending actions queue visibly or fail with a clear message.

## Motion

Restrained. Default platform screen transitions; one subtle moment per surface at most.

- Chat messages slide/fade in over ~180ms. New cards fade in on list load. Press states are instant colour shifts, not animation.
- Respect reduced-motion settings on web; on native keep all motion under 200ms and non-essential.

## Imagery

Real work, warm light. Avatars are user photos; job photos (when added) show the actual space to be cleaned — bright interiors, natural light. No stock-photo tropes, no decorative hero images inside the app. Every bundled asset ships in WebP/AVIF with explicit dimensions. On native, render photos with expo-image (memory-disk cache) and always pass explicit width and height so lists never shift.

## Accessibility

- Touch targets ≥ 44pt. Form fields always labelled. Icon-only buttons get accessibility labels.
- Support Dynamic Type / font scaling; verify key screens at the largest size without clipped CTAs.
- Keep the contrast pairs in the Palette table; check any new pairing before shipping.
- Chat and primary actions must be fully usable with a screen reader and, on web, keyboard-only.

## Dark Mode

Out of scope for MVP. When added: token overrides only, no per-component dark styles.

## What NOT to Do

- No `orange` as text on white — use `orange-deep`.
- No teal, azure or turquoise anywhere.
- No drop shadows on cards; no gradients.
- No radius above 14 (avatars excepted).
- No emoji as decoration.
- No numbered `01/02/03` markers unless the content is genuinely ordered (the job lifecycle is; most lists aren't).
- No new colour, font or radius without adding it to this file first.

## Verification

Before shipping any visual change:

1. Load the changed screens on a 375pt phone and a wide web layout.
2. Check contrast for any new colour pairing.
3. Enable largest text size — confirm no clipped CTAs.
4. On web: tab through — visible focus on every interactive element.
