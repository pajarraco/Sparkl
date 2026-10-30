# Sparkl — Project

## Vision

A two-sided marketplace connecting vacation-rental hosts with cleaning professionals.
Hosts post cleanings tied to guest turnovers; cleaners browse nearby jobs and claim them.

Built for the Meta Global AI Developer Hackathon.

## Goals

1. **Hackathon demo:** a complete end-to-end flow — host posts a job → cleaner claims it → they coordinate over chat → the job is completed.
2. **Production foundation:** clean service-layer architecture, shared Zod validation, and typed APIs from day one.
3. **English-first, Spanish-ready:** ship in English; keep all strings behind the i18n package so Spanish can be added without refactoring.

## Users and Roles

| Role | Description |
| ---- | ----------- |
| Host | Vacation-rental owner or manager who posts cleaning jobs. |
| Cleaner | Cleaning professional who browses and claims jobs. |
| Admin | Platform operator (future, out of MVP scope). |

## MVP Scope

### In scope

1. **Auth with roles** — sign up / sign in as host or cleaner (Better Auth).
2. **Post a job (host)** — property address, date and time window, size/notes, offered price. The host can post through a chat assistant (price hint, saved answers that improve with use) or the form; the form is always there.
3. **Open job board (cleaner)** — browse and filter open jobs, view details.
4. **Request / offer flow** — a cleaner requests an open job, or a host
   offers it to a suggested cleaner; the job is claimed once the other
   side accepts. Nobody is assigned without both sides agreeing.
5. **Ranked suggestions (both directions)** — hosts see suggested cleaners per job; cleaners see jobs ranked by best match instead of newest-first only.
6. **Job lifecycle** — `open → claimed → in_progress → completed`, plus `cancelled`.
7. **Per-job chat** — host and cleaner coordinate within the job.
8. **Basic profiles** — host and cleaner public info (name, photo, service area).
9. **Mutual reviews** — once a job is completed, host and cleaner rate each other (1–5 stars plus a comment).

### Ranking signals (MVP)

Ranked suggestions combine review scores with behavioral signals:
average rating, distance, availability overlap, completed-job count, claim acceptance rate, and response time.

### Out of scope (post-MVP)

- In-app payments and cleaner payouts (price is shown on the job; settlement happens outside the app).
- Auto-assignment of jobs (suggestions only — a human always claims or confirms).
- Recurring schedules.
- Admin panel.
- Spanish translations (i18n infrastructure only).
- Push notifications (stretch goal if time allows).

## Demo Script (Happy Path)

1. Host signs up, posts a turnover cleaning for Friday, and sees ranked cleaner suggestions.
2. Cleaner signs up, sees the job ranked on the board, and requests it.
3. Host accepts the request from Job Detail, claiming the job.
4. Host and cleaner exchange a few chat messages to confirm details.
5. Cleaner marks the job in progress, then completed.
6. Host sees the completed job in their history, and both sides leave each other a review.

## Non-Goals

- Property management features (bookings, calendars, guest messaging).
- Cleaner payroll, tax or compliance handling.
- Public REST API (architecture must allow adding it later, but it is not built now).
