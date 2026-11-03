# issues and redesign

- after posting a job, redirect the user to my jobs page instead of the post a new job details page.
- change the "post" tab to "New Job"
- In my jobs, when I click on offer job. it take a while to change it. add a loading icon instead. do this to all the CTAs to avoid dabble clicking
- Increase the size of tablist on mobile, the space around the icons is too small and the icons are cut off.
- on the cleaner view. the filter popup is showing form the bottom, make it show from he top instead.
- Show the review star count on the jobs card.
- Make the Review details page more cl;ear of what is the review and what is the message.
- in general, for desktop make the the screen max with 990px and center. the ctas on desktop, make it fit-content and align to the right. see screenshot D:\personal\Sparkl\context\archive\Screenshot 2026-11-02 152005.png

## Plan

One task at a time, in this order, each as its own small commit. Confirm with Ernesto before moving to the next.

1. **Post-job redirect** — `apps/frontend/components/PostJobForm.tsx`: after a successful submit, `router.replace` to `/host/my-jobs` instead of staying on/returning to the post details screen.
2. **Rename "Post" tab to "New Job"** — `apps/frontend/providers/tabs.ts` uses `tabs.post` from i18n strings; update the string in `apps/frontend/providers/i18n.ts` (or wherever `tabs.post` is defined) to "New Job". No route/key changes needed.
3. **Loading state on CTAs** — `SparklButton` (`apps/frontend/components/SparklButton.tsx`) already supports a `loading` prop (shows `ActivityIndicator`, disables press). Audit call sites that trigger async actions — starting with "Offer job" in `apps/frontend/app/host/(tabs)/(my-jobs)/my-jobs.tsx` / job detail screen, and other primary CTAs (accept/decline, submit review, send message) — and wire a local `isPending` state into each `loading` prop so double-taps are blocked and the user gets feedback.
4. **Mobile tab bar icon spacing** — `apps/frontend/components/TabBarIcon.tsx` and the tab bar styling in the `(tabs)/_layout.tsx` files: increase tab bar height / icon touch area on narrow widths so icons aren't clipped. Check `THEME_SPACING` tokens in `providers/theme.ts` for an existing size to reuse before introducing a new one.
5. **Filter sheet direction (cleaner board)** — `apps/frontend/components/BottomSheet.tsx` currently anchors to the bottom (`justifyContent: "flex-end"`, slide-up). The board filter in `apps/frontend/app/(cleaner)/(tabs)/(board)/board.tsx` needs to open from the top instead. Options: (a) add a `position: "top" | "bottom"` prop to `BottomSheet` so other consumers keep current behavior, or (b) build a dedicated top-sheet variant for the filter only. Prefer (a) for reuse.
6. **Review star count on job card** — `JobCard` (`apps/frontend/components/JobCard.tsx`) already renders a `trustLine` with a star glyph when passed. Find where `JobCard` is rendered for completed/reviewed jobs (my-jobs lists) and confirm `trustLine` is populated with the review star count/rating; wire it through from the job data if missing.
7. **Clarify review details page** — `apps/frontend/app/(cleaner)/(tabs)/(board,my-jobs,messages)/review/[jobId].tsx` and the host equivalent `apps/frontend/app/host/(tabs)/(my-jobs,messages)/review/[jobId].tsx`: restructure so the review (rating/comment) and any message are visually separated — section labels, distinct spacing/container per `design.md` conventions.
8. **Desktop layout: max-width 990px, centered, CTAs fit-content aligned right** — `apps/frontend/components/Screen.tsx` is the shared shell for all screens (`container` style). Add a web/desktop breakpoint: `maxWidth: 990`, `alignSelf: "center"`, full width below that. Then audit CTA rows (e.g. job details screen per screenshot) so button containers use `alignSelf: "flex-end"` / `width: "fit-content"` equivalent on desktop instead of stretching full width. Likely touches `DetailScreen.tsx` too since it composes `Screen`.

Sequencing notes: items 1–3 are isolated and low-risk; do those first. Items 4–5 touch shared chrome components (tab bar, bottom sheet) — verify no regressions on other bottom-sheet consumers. Items 6–8 touch shared layout/data (`Screen`, `JobCard`, review pages) so review each against both host and cleaner variants before calling it done.