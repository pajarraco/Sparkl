# Improvements and Issues

Here are some issues an improvement that I would like to make. follow this list as a individual tasks and check what is possible and how it will work in conjunction with the original idea.

## Issues

- Switching from Host to Cleaner doesn't work at the first time. only when I sign in two times works
- there is now back bottom when you go inside the details of the jobs or inside the chat. also the main navigation is not visible
- Submit the review doesn't work. it get me a "Something went wrong. Try again." message

## Improvements

- In the Cleaners profile we should have only one CTA to save the settings
- Chat or messages tab it is empty, we need to be able to see all the users we already open a chat and to got to the chat window
- for the cleaner in the Open jobs. i want the search option to be as a filter, one line of icons in the to and when user click open a little modal with the field
- now the cleaners decide what job they take. and host have no decision. I will like to make it both ways. hosts can also assign a cleaner for the job, but at the end both need to agree

## New Ideas

- Integrate Map into the app for latitude and longitude selection
- on each job the host need to add the address and property. I want to have the properties as a separate table, so the host add the property in another tab, then on the job the host only select which property and the dates. it can have multiple jobs per properties

## Triage (2026-10-29)

First pass only: what each item is, whether it is possible, and how it fits
the original idea and feature 02. Each item gets its own plan before any
work starts.

### Moved to 02

| Item | Where in 02 |
| ---- | ----------- |
| Map for lat/lng selection | `AddressMapPicker` on Post Job and `ServiceAreaMapPicker` on the cleaner profile (OSM now, Google later via the provider switch). |
| Cleaner profile: one save button | Done with the `ServiceAreaMapPicker` work, since it is the same screen. |

### Issues triage

| Item | Likely cause | Fit |
| ---- | ------------ | --- |
| Submit the review doesn't work ("Something went wrong. Try again.") | Every non-duplicate `reviews.create` failure maps to the generic string (`reviewSubmitErrorMessage` only special-cases `CONFLICT`), so the message hides the cause. Suspects, most likely first: the job is missing from `jobs.myJobs` on that screen (subject resolves to null), the job is not yet `completed` in the caller's cache, the caller is not a job party or the subject is wrong, or a Zod input failure. Needs a diagnosis pass with the real error first. | Bug: blocks the demo script (mutual reviews). Highest priority — planned first as A0. |
| Host → Cleaner switch only works on the second sign-in | Probably the role read from a cached session or tRPC cache after sign-out and sign-in. `auth-session.ts` already has switching logic. Needs a diagnosis pass first. | Bug: breaks the demo when switching accounts on one device. High priority. |
| No back button in job detail / chat; main navigation hidden | Side effect of the Stack-over-Tabs fix (CHANGELOG 2026-10-29 11:35): detail screens are on a Stack with `headerShown: false`, above the tabs. Fix: show a header back button, or nest a Stack inside each tab so the tab bar stays visible. `design.md` already says stacks push over their own tab and each tab keeps its own history, which points to nested stacks. | Bug against `design.md`. High priority. |

### Improvements triage

| Item | What it takes | Fit |
| ---- | ------------- | --- |
| Messages tab lists the user's conversations | The tab is a 14-line placeholder today. Needs a `chat.threads` procedure (jobs the caller is a party to, with the last message and time) plus a list screen. | Already in `design.md` (Messages tab); it was never built. Medium. |
| Board filters as a row of icons that opens a small modal | Frontend-only: icon row (date, distance, price) and a bottom-sheet modal reusing the current filter fields. Needs a `design.md` entry first. | Pure UI; the filter logic stays as it is. Low risk. |
| Two-way assignment: host can offer a job to a cleaner, both must agree | Lifecycle change: the host offers, the cleaner accepts; possibly the host confirms a claim. Needs new states, a migration and updated e2e. Still fits `project.md` ("a human always claims or confirms" — no auto-assignment). | Enables 02's "go with {cleaner} as always?" as a real offer. Changes the demo script. Largest item here. |

### New ideas

| Item | What it takes | Fit |
| ---- | ------------- | --- |
| Properties as their own table and tab | New `properties` table (host, name, address, lat/lng, size, default checklist), a Properties tab for hosts with the map picker, and `jobs.propertyId`. Address and lat/lng stay on the job as a snapshot for history and ranking. | Strongly linked to 02: the map picker moves to the property form, and "one property, don't ask" becomes a count. Decided: built in 03, after 02 P1 (see Plan). |

## Plan

Status: approved by the owner on 2026-10-29. Tasks are in `context/tasks.md`
§11.

Status as of 2026-10-30 (checked against the code and the e2e suite):

- **A0 Review submit:** done. Reviews are visible: the Leave Review
  screen shows the review already sent (`reviews.mineForJob`), and both
  profiles list the reviews received. The original "Something went
  wrong" error was not reproduced after this landed; the review flow
  passes e2e, and real saved reviews pass the response schema.
- **A1 Role switch:** done. Fixed (see the Fixed entry in
  `CHANGELOG.md`); the role-switch e2e tests pass.
- **A2 Navigation:** host screens are back under `app/host` (`/host/...`),
  with the tab bar on detail screens. Covered by the navigation e2e suite,
  which passes. Reload-then-Back lands on a host tab root, not a fixed tab,
  because browser history is not reliable after a reload.
- **B Messages:** done (2026-10-29 18:05). The Messages tab lists the
  caller's conversations.
- **C Board filters:** done (2026-10-29 19:05). Filters are a chip row with
  a one-field bottom sheet.
- **D Two-way assignment:** done (2026-10-30). `job_requests` table,
  `services/job-requests.ts` and the `jobRequests` router (request,
  offer, accept, decline, withdraw, `listForJob`, `listMine`) replace
  `jobs.claim` as the only client-facing path to `claimed`. Cleaner Job
  Detail shows Request / Requested / Accept-or-Decline-an-offer; host
  Job Detail shows a Requests section (Accept/Decline) plus Offer job on
  each suggestion; cleaner My Jobs shows an Offers section. `jobs.claim`
  itself stays in the API (the race-safe primitive `acceptRequest`
  builds on) but is unreachable from the UI. `happy-path` and `forms`
  e2e updated to request+accept; the offer path has unit coverage
  (mutual interest, caps, authorization, the accept race) but no
  dedicated e2e yet. Demo script, `project.md`, `README.md` and
  `architecture.md` updated in the same step.
- **E Properties:** not started. Depends on 02 P1, which is done.

### Decisions (owner, 2026-10-29)

1. **Two-way assignment:** both sides always confirm. A cleaner's claim
   from the board becomes a request the host accepts. A host can offer a
   job to a cleaner, and the cleaner accepts. Nobody is assigned without
   both sides agreeing.
2. **Properties:** built in 03, after 02 P1 lands. 02 keeps the address on
   each job.
3. **Navigation:** detail screens get a back button and keep the tab bar
   visible, so the user can jump to another tab from a job or a chat.
4. **Role-switch bug:** seen on web. Diagnose there first, then check
   Expo Go.
5. **Review-submit bug:** reported in the owner issues list; it blocks demo-script step 5 (mutual reviews). Planned first as A0; diagnose with the real error before fixing.

### Working alongside 02

The 02 session works in the same repo. To avoid collisions:

- Build 03 in its own git worktree and branch (`feat/03-improvements`).
  A1–C branch from `main`. D and E branch from 02 once the parts they
  depend on have merged.
- `tasks.md`, `CHANGELOG.md` and `README.md` are shared. Edit them only
  in small, separate commits, never while the 02 session is mid-edit.
- Overlap per item:

| Item | Files it touches | Clash with 02 | Start |
| ---- | ---------------- | ------------- | ----- |
| A0 Review submit | Leave Review screens, `leave-review.ts`, `reviews` service/router | None (form + review path untouched by 02) | First |
| A1 Role switch | `providers/auth-*`, profile sign-out, root layout | None | Now |
| A2 Navigation | group and tab layouts, route moves, `Screen` | None (Post does not navigate after posting) | Now |
| B Messages | new chat service and router, `messages.tsx` | None | Now (after A2 for the stack) |
| C Board filters | `board.tsx`, `ranked-board.ts` | None | Now |
| D Two-way assignment | jobs service, new table, both Job Detail screens, suggestions | 02 P2 "go with {cleaner}" pin | After 02 P2 |
| E Properties | jobs schema, Post form, new tab, assistant tools | 02 P1 Post form and assistant | After 02 P1 |

If the Nov 4 deadline is at risk, cut from the bottom: E first, then D.

### A0 — Submit review fails with "Something went wrong. Try again." (first)

The Leave Review screen shows `errors.generic` for every non-duplicate
`reviews.create` failure (`reviewSubmitErrorMessage` in
`providers/leave-review.ts` only special-cases `CONFLICT`, which maps to
`REVIEW_DUPLICATE`), so the message hides the cause. The screen also
shows the same generic string when the job is missing from
`jobs.myJobs`, when the subject resolves to null, or when the job is not
`completed`.

**Diagnose first.** Reproduce on web with the network response open and
record: which state shows (form vs. generic + Retry vs. success), the
role, the job status on both sides, whether the job appears in history,
and the real error code. Suspects, most likely first:

1. The job is not in the caller's `myJobs`/`myClaimed` list on that
   screen, so `subjectId` is null and the screen errors without ever
   calling the API.
2. The job is not `completed` in the caller's cache (the other party
   transitioned it; this session has stale data) → `REVIEW_NOT_ALLOWED`.
3. The caller is not a job party, or the subject is not the other party
   (unclaimed job, wrong id) → `NOT_JOB_PARTY` / `FORBIDDEN`.
4. A Zod input failure (bad `jobId` / `subjectId` shape) → `BAD_REQUEST`.
5. A duplicate review — this one shows "already reviewed", not the
   generic string, which already rules it out when the generic shows.

**Fix** (final shape depends on the diagnosis): repair the guard/data
path the repro fingers (query, segment, subject resolution, or stale
status), and only then decide whether the generic mapping needs a
narrower case. No lifecycle, ranking, or schema changes expected.

**Done when:** host and cleaner can each submit a review from history on
web and on one Expo Go target, and a regression test covers the failing
state found above.

### A1 — Host → Cleaner switch fails on the first sign-in (web)

**Diagnose first** (`diagnosing-bugs`). Start with a failing Playwright
repro: sign in as a host, sign out, sign in as a cleaner, expect the
board. Suspects, most likely first:

1. Sign-out never clears the React Query cache (`profile.tsx` in both
   roles calls only `authClient.signOut()`). Shared keys such as
   `users.getProfile` keep the host's data, and the cleaner screens can
   act on it.
2. The shared `useSession` atom still holds the host session when the
   cleaner group mounts. `waitForSessionEmail` + `hydrateSession` in
   `sign-in.tsx` already works around a version of this. The leftover
   path may be the host group layout's redirect racing the
   `router.replace`.
3. A stale session cookie on web. The cleaner's cookie lands after the
   first redirect, and the second sign-in works because the cookie is
   there by then.

**Fix** (final shape depends on the diagnosis):

- One `signOutAndReset()` used by both profile screens and by the
  expired-session handler. It signs out, clears the query cache
  (`queryClient.clear()`) and resets the session store.
- Clearing the cache is also a **security fix**: the previous account's
  data must not stay in memory on a shared device.
- Add a regression e2e test: host → sign out → cleaner (and the reverse)
  in one browser context.

**Done when:** a role switch works on the first sign-in on web and on one
Expo Go target, and the new e2e test passes.

### A2 — Back button and visible tab bar on detail screens

Today job detail, chat and review are pushed onto the group Stack above
the tabs, with `headerShown: false`. So there is no back button and no
tab bar.

- **Nested stacks inside the tabs**, using Expo Router shared routes:
  `app/host/(tabs)/(my-jobs,messages)/` holds a `_layout.tsx` Stack
  plus `job/[id]`, `chat/[jobId]` and `review/[jobId]`. Same for the
  cleaner with `(board,my-jobs,messages)`. A detail screen opens inside
  the tab it was opened from, and the tab bar stays visible.
- **URLs do not change**, because groups stay out of the URL. A deep link
  to `/job/:id` opens inside the first group (My Jobs, or Board for the
  cleaner).
- **Back button:** a new `BackButton` slot in `Screen`. It has a Feather
  `chevron-left`, a 44pt target and an i18n accessibility label. If there
  is history it goes back; on a deep link with no history it falls back to
  the tab's home. Add it to `design.md` (Navigation, Components) first.
- Tapping the active tab again pops to its root. Re-check the web-only
  `tabPress` history listener against the nested stacks.
- Post shows its "posted" state in place and does not navigate, so
  `post.tsx` is untouched (no overlap with 02).
- **Role guard (found while building A2):** `/job/:id`, `/chat/:jobId`,
  `/review/:jobId`, `/my-jobs`, `/messages` and `/profile` exist in both
  role groups, and a reload or deep link resolves to `(cleaner)` first, so
  a host got the cleaner's screens. The group layouts now check the role
  and send a user in the wrong group to the same screen in their own
  (`routeForRole`).
- The group-level Stack routes for job, chat and review are removed.

**Done when:** every detail screen shows the back button and the tab bar
on web and Expo Go. `navigation.spec.ts` covers back, tab switching from
a detail screen and deep links with no history.

### B — Messages tab lists conversations

Chat is per job, and only the host and the claimed cleaner can use it.
So a "conversation" is a job the caller is a party to.

- **Service** `listThreads(userId)` in `services/chat.ts`, with one store
  query. It returns jobs where the caller is the host or the claimed
  cleaner, with status claimed, in progress or completed, and cancelled
  jobs only if they have messages. Each row has:
  - the other party (id, name, photo);
  - the job address and time window;
  - the last message (sender, time, body cut to about 80 characters).

  Rows are sorted by last activity. The WHERE clause is the party
  check, so a user never sees another user's thread.
- **Router** `chat.listThreads`, plus a shared `chatThreadSchema` in
  `packages/shared`.
- **Screen:** both `messages.tsx` files become a FlatList of thread rows
  (avatar, name, address caption, last-message preview, time). Tapping a
  row pushes the chat inside the Messages tab (uses A2). Skeleton rows
  while loading, the existing empty-state string, and a refetch on focus.
- **Not included:** unread counts. They need read tracking (a
  `chat_reads` table), which is listed under Later.

**Done when:** both roles see their threads, newest first, and can open
them. The happy-path e2e test checks the thread appears after the first
message.

### C — Board filters as an icon row with a small modal

- `design.md` first: a **filter chip** component and a **bottom sheet**.
  The design already has a radius of 14 for sheets. No new colours.
- A row of three chips at the top of the Board: date (`calendar`),
  distance (`navigation`) and price (`dollar-sign`). An inactive chip
  shows the icon and label. An active chip shows its value ("Fri 31",
  "≤ 10 km", "≥ $80") in indigo. A "Clear" chip appears when any filter
  is active.
- Tapping a chip opens a bottom sheet built on React Native `Modal`, so
  no new dependency, with that one field and Apply / Clear. The sheet
  reuses `validateBoardFilters` and the existing field testIDs.
- Without a service area, the distance chip still opens; its sheet shows
  the "set your service area" hint instead of the field (a disabled chip
  would not say why).
- The chips wrap to a second line instead of scrolling sideways, so
  "Clear all" is never hidden off-screen on a phone.
- Chip labels and the "apply one filter" merge go in
  `providers/ranked-board.ts`, with unit tests. The filter logic and the
  API are unchanged.

**Done when:** the Board shows one line of chips instead of the three
fields, and `forms.spec.ts` board filters pass through the sheet at both
viewports.

### D — Two-way assignment (both sides confirm)

**Model:** a new `job_requests` table:

| Column | Notes |
| ------ | ----- |
| `id`, `job_id`, `cleaner_id` | FKs, cascade on job delete |
| `initiated_by` | `host` (offer) or `cleaner` (request) |
| `status` | `pending`, `accepted`, `declined`, `withdrawn`, `closed` |
| `created_at`, `responded_at` | Feed the response-time signal later |

There is a unique partial index on `(job_id, cleaner_id)` where the
status is `pending`.

The **job lifecycle does not change**. A job stays `open` while requests
are pending. It moves to `claimed` only when the other side accepts, so
`claimed` now means "both agreed". `JOB_STATUS_TRANSITIONS` stays the
same.

**Flows:**

- **Cleaner requests:** "Request job" replaces "Claim" on the Board card
  and on Job Detail. The host sees a Requests section on Job Detail,
  above suggestions, with Accept / Decline.
- **Host offers:** an "Offer job" button on each suggestion row. The
  cleaner sees "Offered to you" on the Board card, an Offers section in
  My Jobs, and Accept / Decline on Job Detail.
- **Accept** runs in one transaction:
  - re-check that the job is `open` and the request is `pending`;
  - set the job to `claimed` with `claimedByCleanerId`;
  - mark the request `accepted`;
  - close every other pending request on the job.

  This reuses the `claimIfOpen` race guard, and gets a concurrency test.
- **Mutual interest:** a cleaner who requests a job they already have an
  offer for simply accepts that offer.
- **Withdraw** works for your own pending request or offer. Cancelling a
  job closes all of its pending requests.
- **Caps** (anti-spam): at most 3 pending offers per job and at most 10
  pending requests per cleaner. Every limit has a shared error code.
- **Authorization:**
  - only the job's host can offer, or accept or decline a cleaner's
    request;
  - only the offered cleaner can accept or decline an offer;
  - only a cleaner can request.
- **Service and router:** `services/job-requests.ts` holds all the logic.
  The `jobRequests` router has `request`, `offer`, `accept`, `decline`,
  `withdraw`, `listForJob` (host) and `listMine` (cleaner). It replaces
  `jobs.claim`. Inputs are shared Zod schemas.
- **No push notifications** (out of MVP). A host's My Jobs card shows a
  "2 requests" badge, and lists refetch on focus.
- **Link to 02:** "Go with {cleaner} as always?" creates a real host
  offer instead of pinning a suggestion.
- **Ranking:** the current acceptance-rate signal stays as it is. A
  signal for responses to offers can come later, behind the weights flag.

**Scope changes, in the same step:**

- `project.md`: MVP #4 "Claim flow" becomes "Request / offer flow".
- The demo script gains a step: the cleaner requests the job, then the
  host accepts it.
- `README.md` MVP Scope mirrors the change.
- `architecture.md` describes the data flow.
- The demo seed and e2e (`happy-path`, `forms`, fixtures) are updated.

**Done when:** a job can reach `claimed` through a request and through an
offer, and only after the other side accepts. The race test, the
authorization tests and the updated happy path pass.

### E — Properties as their own table and tab

- **`properties` table:**
  - `id`, `host_id`, `name`, `address`, `latitude`, `longitude`;
  - `size_sqm`, `default_notes` (the checklist);
  - `archived_at`, `created_at`, `updated_at`.
- **`jobs.property_id`**: a nullable FK, so existing jobs keep working.
  When a job is created, the service copies the address, lat/lng and size
  onto the job. History and ranking keep reading the job, so matching
  does not change.
- **Host tabs:** My Jobs, Properties, Post (centre), Messages, Profile.
  Five tabs, with Post still in the middle. Update `design.md`
  Navigation first.
- **Properties screens:** a list, and an add/edit form with 02's
  `AddressMapPicker`. Archive is used instead of delete once jobs
  reference a property.
- **Post Job:** a property picker, the dates and the price. The notes
  start from the property's checklist. With no properties yet, the form
  shows "Add your first property". `createJob` takes `propertyId`, and
  the service checks that the property belongs to the caller.
- **Link to 02:** the assistant gets a `list_properties` tool, and
  `singleProperty` becomes "the host has exactly one property". This
  works with whatever 02 has shipped by then.
- **Tests:** a new `properties.spec.ts` e2e suite. The Post Job e2e and
  the seed move to properties.

**Done when:** a host adds a property once and posts several jobs for it
by picking it.

### Close-out (each item)

- Run `pnpm verify` (coverage ≥ 80%) and `e2e`. Quote the output before
  ticking a box.
- `CHANGELOG.md` entry, and docs updated (`design.md`, `project.md`,
  `architecture.md` and `README.md`, as each item needs).

### Later (not in this plan)

- Unread badges on Messages (needs read tracking).
- Chat before a request is accepted.
- Date picker in the Board date filter.
- A ranking signal for responses to offers.
