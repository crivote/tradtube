1.  ~~[done] Voting doesn't seem work~~
2.  ~~[done] The placeholder on the main screen could should two random examples from the tunes with videos.~~
3.  improve flagging to show different issues (times badly set, wrong session tune, non working video, bad credits...)
4.  ~~[done] show links to thesession.org in the title of tune in tuneview on new tab. Also on video title if it's an album with thesession reference.~~
5.  ~~[done] the copy of time from the end of a tune to the next should be done on blur of the input, not earlier.~~
6.  ~~[done] Instruments should be an array of tags instead of a single option~~
7.  ~~[done] add a filter in main screen by instrument~~
8.  ~~[done] in main screen each of the pills of types of tunes should contain the number of tunes of that type with videos.~~
9.  ~~[done] max width should be bigger for big screens~~
10. ~~[done] more max height to score component on big screens~~
11. ~~[done] there are tunes in DB with the same name (toss the feather i.e.). Add disambiguation (composer, tune id link, tooltip)~~
12. ~~[done] if possible, visualize a control to slowdown the speed of the video.~~
13. kofi widget at footer

```
<script src='https://storage.ko-fi.com/cdn/scripts/overlay-widget.js'></script>
<script>
  kofiWidgetOverlay.draw('crivote', {
    'type': 'floating-chat',
    'floating-chat.donateButton.text': 'Support me',
    'floating-chat.donateButton.background-color': '#00b9fe',
    'floating-chat.donateButton.text-color': '#fff'
  });
</script>
```

14. Add favourites system for videos for logged users.

15. ~~[done] Project revision and refactor plan (2026-05-10)~~
16. [~] UX improvements — see [UX_audit.md](UX_audit.md) for full report (34 done, 28 remaining)
    - [x] X-01: Toast/notification system (global signals, auto-dismiss, undo actions)
    - [x] T-07: OAuth redirect preserves current URL (not just origin)
    - [x] AP-03: Login loading state + error handling
    - [x] F-04: Inline timestamp validation (format errors, end > start check)
    - [x] S-05: Empty state for type/instrument filters with zero results
    - [x] A-01: Undo after approve/reject via toast action buttons
    - [x] J-01: Suggested search chips on hero (6 well-known tune names)
    - [x] J-10: Pending review count badge on Admin button in header
    - [x] T-12: Wider drag handle touch target + touch-action:none
    - [x] A-02: Removed Spanish browser confirm() (undo toast handles recovery)
    - [x] T-01: Report button shows toast confirmation
    - [x] Y-06: Removed 0.25x from SPEED_STOPS (too choppy); min speed now 0.5x
    - [x] Y-02: Poll interval reduced 500→150ms for precise timestamp pausing
    - [x] Y-04: Speed preset buttons touch-friendly (11px, padding, min-w-32px)
    - [x] T-04: Auto-advance scrolls to active entry (smooth, nearest)
    - [x] T-09: Sheet music label clickable (onClick moved to <label>)
    - [x] T-11: Sheet music stacks vertically on mobile (<lg breakpoint)
    - [x] T-14: Vote buttons have aria-label (replaced title)
    - [x] S-11: Search input has aria-label + role="searchbox"
    - [x] S-12: Type filter chips have aria-pressed
    - [x] F-13: Instrument dropdown has aria-expanded + aria-haspopup
    - [x] F-14: YouTube preview iframe has title attribute
    - [x] AP-05: User avatar shown on mobile header (from Google profile)
    - [x] F-05: Submit button shows disabled reason (no URL, no entries, duplicate)
    - [x] F-09: Entry removal has undo toast (4s window)
    - [x] X-04: Theme transition animation (background, color, border 0.3s ease)
    - [x] Y-05: Firefox range slider track styling (moz-range-track)
    - [x] T-13: Vote buttons larger on mobile (p-1.5)
    - [x] S-02+S-03: Unified search + type + instrument filters (no mutual exclusion)
    - [x] F-10: Click-outside instrument dropdown (document click listener)
    - [x] F-02: Auto-match guarded when user has manually added entries
    - [x] F-11: Duplicate warning links to existing tune page (when approved)
    - [x] AP-02: Tune not found 404 state in TuneView
    - [x] S-08: Clips badge shows ♫ instead of ▶
    - [x] S-09: TheSession link icon larger (w-4 h-4) + full opacity
    - [x] SM-01: Sheet music soft ring/shadow to soften dark-mode contrast

## Refactors — High Priority (2026-05-10)
- [x] Extract duplicate utility functions into `src/lib/utils.js` (formatTime, extractYoutubeId, parseSec, formatSec, cleanTitleForDisplay, findMatchingTunes, STOP_WORDS)
- [x] Fix tests to import from source instead of copy-pasting utility functions
- [x] Remove dead code: `getAllVideos()` in `src/lib/supabase.js:121-136` (references undefined variables, never called)
- [x] Fix `findMatchingTunes` in `titleUtils.test.js` — references undefined `db` and `searchTunes`

## Refactors — Medium Priority
- [x] Optimize `getCountsByType()` in `src/lib/db.js` — replace N queries with single query
- [x] Increase SEARCH_LIMIT from 10 to 25 (pagination can be added later if needed)
- [x] Encapsulate mutable `export let db` in `src/lib/db.js` with a `getDB()` getter function
- [x] Debounce text search effect in `appStore.js` (300ms) and `youtubeId` effect in `AddVideoForm.jsx` (400ms)
- [x] Fix duplicate `getPendingCount()` fetch in `AdminView.jsx`

## Refactors — Low Priority
- [x] Unify color system: added `--color-error` (red) and `--color-warning` (amber) CSS variables, replaced all hardcoded red/amber
- [x] Extract inline `<style>` from `YoutubePlayer.jsx` into `src/index.css`
- [x] Add global `<ErrorBoundary>` in `App.jsx` + try/catch blocks in all store effects
- [x] Fix `<title>` in `index.html` + add meta description