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