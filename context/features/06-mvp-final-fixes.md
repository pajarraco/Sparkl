# MVP final fixes
Plan (2026-11-03): leave the repo submittable by Nov 4, 9:00 PM ET. Smallest viable path — one lint blocker, review + commit the uncommitted pile, re-verify, device pass, submission checklist. No behavior changes, no stretch.

## Goal

Green gates, demo gate re-confirmed after P4, tidy committed tree, submission artifacts owned.

## Success Criteria

- `pnpm verify` exits 0 (currently red on `.vscode/settings.json` CRLF).
- Full `e2e` green on a fresh boot (done 2026-11-03: 71 passed, 1 flaky-passed; re-run only if code changes after).
- Expo Go pass on the two P4-touched screens (host suggestions, cleaner job detail).
- Working tree committed; `git status` clean except intentionally untracked files.
- Submission checklist owned: public repo, 3-minute video, live product, members listed.

## Approach

Fix the single lint blocker, review and commit the uncommitted pile (mostly the 01–05 archive move plus doc sync), re-verify, device pass, submission checklist.

Key decisions:

- Lint fix: convert `.vscode/settings.json` to LF (Biome owns formatting; the file is 3 lines). Rejected: narrowing Biome scope — hides real formatting coverage.
-- Commit split, owner-committed by Ernesto (the agent does not commit): unit 1 = archive move (the `D` + `??` pairs, which git records as renames), unit 2 = doc sync + e2e comment repoints. Two units so history shows the move separately from content edits.
 `.gitattributes` (`* text=auto eol=lf`) is deliberately deferred until after submission: it would renormalize line endings tree-wide the day before the deadline.
- No code changes besides the lint fix. E2E stands as green unless code changes.

## Steps

1. Fix `.vscode/settings.json` line endings to LF. Validate with `pnpm exec biome check .vscode/settings.json`.
2. Run `pnpm verify` (test + lint + typecheck). If anything beyond the known blocker is red, stop and triage as a new finding.
3. Review the uncommitted diff (`git status`, `git diff`): archive `D` + `??` pairs, doc edits, e2e comment repoints. Confirm this file (now holding the plan) stays as the 06 record.
4. Ernesto commits himself in the two units above (agent does not commit). Verify with `git status` and `git log --stat` that both sides of the move landed.
5. Device pass on Expo Go (needs a phone): host Job Detail suggestions show the reasons line; cleaner Job Detail shows it under the match percent; no clipped CTAs at the largest text size (per `context/design.md` verification).
6. Submission checklist, owner-side (per `context/hackathon.md`): repo is public; 3-minute demo video recorded on the happy path; live product URL reachable; team members listed in the portal. Submit by Nov 4, 9:00 PM ET.

## Validation Plan

- `pnpm exec biome check .vscode/settings.json` → clean, no fixes applied.
- `pnpm verify` → exit 0, with unit counts (shared / api / frontend), lint, and typecheck all observed green.
- `e2e` re-run skipped (no code changes; last green 2026-11-03 stands). Re-run only if step 2 surfaces a code change.
- Manual: Expo Go screenshots of the two P4 screens, plus the largest-text-size check.
- Portal: submission confirmation (screenshot or confirmation ID).

## Risks / Open Questions

- CRLF can recur without `.gitattributes`; accepted until after submission.
- Who records the demo video and who clicks submit (owner).
- Commit must capture both sides of the archive move or the specs drop out of history (they exist in the tree, so risk is low; `git log --stat` confirms).
- No rollback needed (no production deploy); before committing, worst case is `git reset`.
on it.

## updates from Ernesto

- ON the cleaner page, the filter are showing on the top but they still comming fron the bottom. we need to move to it to the top so the just slide down from the top.
- I want ot show the review counts the job details page also as they are on the list, sample this page http://localhost:8081/host/job/1968bf1c-2cdd-44a1-bd71-465fcba80650
- on the actually review http://localhost:8081/host/review/1968bf1c-2cdd-44a1-bd71-465fcba80650. I want to have a light yellow frame around the comments, and include the star icons.
- I try to use two window to preview the host and the cleaner. but after navigating a few pages, i ended with the host on both windows. I using incognito window. how the session is managed? by IP, session cookie, or what? I want to be able to use two windows to preview the host and the cleaner at the same time.
- on the job details we have two cta open chat and leave review. I want to change the leave review to 'see review' when the job has already review on it.