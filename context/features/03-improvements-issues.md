# Improvements and Issues

Here are some issues an improvement that I would like to make. follow this list as a individual tasks and check what is possible and how it will work in conjunction with the original idea.

## Issues

- Switching from Host to Cleaner doesn't work at the first time. only when I sign in two times works
- there is now back bottom when you go inside the details of the jobs or inside the chat. also the main navigation is not visible

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
| Properties as their own table and tab | New `properties` table (host, name, address, lat/lng, size, default checklist), a Properties tab for hosts with the map picker, and `jobs.propertyId`. Address and lat/lng stay on the job as a snapshot for history and ranking. | Strongly linked to 02: the map picker moves to the property form, and "one property, don't ask" becomes a count. Owner decision pending: build inside 02 P1, or after 02. |
