# TradTube — UX Audit Report

> Generated 2026-05-10. For code references, file paths are relative to `src/`.

---

## 1. SearchView — `components/SearchView.jsx`

### 1.1 Search UX

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| S-01 | Medium | **No minimum-query hint.** When the user types fewer than 2 characters, search results silently disappear with no explanation. | `SearchView.jsx:41` (`isSearching`) | Show a subtle helper text: `"Type at least 2 characters to search"` while `searchQuery().length === 1`. |
| S-02 | Medium | **Search and type filters are mutually exclusive.** Clicking a type chip clears the search query (`setSearchQuery('')` in the button handler at line 116). The user cannot, for example, search for "butterfly" AND filter to only reels. | `SearchView.jsx:115-116` | Remove the `setSearchQuery('')` call; let text search and type filter combine. The store effects already handle this combinatorially in some paths but `filterType()` is set to null on text search (`appStore.js:120`). This needs unified logic. |
| S-03 | Medium | **Instrument filter hidden during active text search.** The `<Show when={!isSearching()}>` wrapper at line 89 hides the instrument dropdown while the user is typing. This breaks discoverability — a user who starts typing and then wants to filter by instrument must clear their search first. | `SearchView.jsx:89` | Always show the instrument filter; let it combine with text search (the store already has the combined effect at `appStore.js:122-125` but is protected by the component-level visibility gate). |
| S-04 | Low | **No loading indicator during search debounce.** The 300ms debounce (`appStore.js:118`) means results appear after a delay, but there is no spinner or skeleton while waiting. | `SearchView.jsx:132` | Add a `searching` signal that is set to true during the debounce timer, and show a small inline spinner next to the search input. |

### 1.2 Empty / Error States

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| S-05 | **High** | **No empty state when type/instrument filter returns zero results.** If the user clicks "polka" and there are no polkas with videos, the results area simply disappears. The hero section is only shown when `!isActive()` (no search or filter), but a filter IS active, so the hero is hidden yet no results are shown. | `SearchView.jsx:49, 235` | Add a dedicated empty state for filter-only mode: `"No {filterType()} tunes with videos yet"` with a call-to-action to add one. |
| S-06 | Medium | **No error state for failed searches.** If `searchTunes()` throws (e.g., corrupted DB), the error is silently caught in the store effect (`appStore.js:127-130`) and `searchResults` is set to `[]`, which the component interprets as "no results" rather than "search failed." | `SearchView.jsx:238-244`, `appStore.js:126-130` | Expose an `searchError` signal from the store and display an error banner with a retry suggestion. |
| S-07 | Low | **Placeholder examples may show stale data.** `placeholderExamples` is set once when video data loads and never refreshed. | `appStore.js:77-83` | Refresh examples on each SearchView mount or periodically. |

### 1.3 Result Display

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| S-08 | Low | **"clips" badge uses ▶ icon, implies playability.** The green badge "▶ 3 clips" looks like a play button, but clicking the result navigates to a detail page. | `SearchView.jsx:224-226` | Replace ▶ with a different indicator (e.g., ♫ or just the number) or use a more neutral layout. |
| S-09 | Low | **TheSession.org link icon is tiny and low-contrast.** The external link icon is `w-3.5 h-3.5` and `text-[var(--color-muted)]/50`, making it nearly invisible. | `SearchView.jsx:176, 179-182` | Increase to `w-4 h-4` and use full muted color or primary color on hover. |
| S-10 | Low | **No visual indication of tune popularity beyond "tunebooks."** The `popularity_score` column exists in SQLite but is never surfaced. Users can't sort or filter by popularity. | `SearchView.jsx:141-231` | Add a sort control or display a relative popularity indicator (e.g., star rating). |

### 1.4 Accessibility

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| S-11 | Medium | **No `aria-label` or `role="searchbox"` on the main search input.** | `SearchView.jsx:72-78` | Add `role="combobox"`, `aria-label="Search tunes"`, and `aria-expanded`. |
| S-12 | Medium | **Type filter chips lack ARIA state.** `<button>` elements have no `aria-pressed` or `role` to indicate they are toggle filters. | `SearchView.jsx:113-126` | Add `aria-pressed={active()}` to each type chip button. |
| S-13 | Low | **Results list is not semantically a list.** Results use bare `<div>` elements instead of `<ul>`/`<li>`. | `SearchView.jsx:133-234` | Wrap in `<ul>` and use `<li>` with appropriate `role="option"`. |
| S-14 | Low | **Instrument filter `<select>` has no accessible label.** Screen readers can't associate it. | `SearchView.jsx:90-103` | Add `aria-label="Filter by instrument"` or a hidden `<label>`. |

### 1.5 Mobile/Responsive

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| S-15 | Low | **No mobile-specific adjustments for the results list.** On very narrow screens (320px), the metadata row (type · meter · composer · books) may wrap awkwardly. | `SearchView.jsx:184-198` | Test at 320px; consider reducing metadata detail on small screens. |

---

## 2. TuneView — `components/TuneView.jsx`

### 2.1 Video Entry List

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| T-01 | Medium | **Report button has no confirmation or feedback.** Clicking ⚑ fires a vote of -1 with `isReport=true`, but there is zero visual feedback — no toast, no color change. The user cannot tell if their report was submitted. | `TuneView.jsx:306-310` | Add a brief toast: `"Report submitted"` or change the button to ⚑✓ after click. Also surface `is_report` in the store so the UI can reflect reported state. |
| T-02 | Low | **Vote score reverts silently on error.** The optimistic update (`updateEntryVote` before `castVote`) is correct, but when the API call fails, the score reverts with no error indication. | `TuneView.jsx:86-90` | Show a brief inline error on the vote that failed: `"Vote failed — try again"`. |
| T-03 | Low | **First entry auto-selected regardless of vote score.** Entries are sorted by vote score in the data layer but there is no visual indicator explaining the sort order. | `TuneView.jsx:196`, `supabase.js:41` | Add a small label: `"Sorted by votes"` next to the "Videos (N)" heading, or show a subtle "Top pick" badge on the first entry. |
| T-04 | Medium | **No scroll-to-active-entry when entry changes via auto-advance.** When a video ends and the next entry is selected, if the entry list is long and the active entry is scrolled out of view, the user does not see which entry is now playing. | `TuneView.jsx:66-72` | After `setActiveEntry`, use `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the newly active entry DOM element. |

### 2.2 Playback UX

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| T-05 | Medium | **No loading/transition indicator when switching entries.** Destroying and recreating the YouTube iframe causes a black flash. | `YoutubePlayer.jsx:55-56` | Reuse the iframe and just change the `videoId` parameter (the IFrame API supports `loadVideoById`). Alternatively, fade out the old player with a CSS transition. |
| T-06 | Medium | **No persistent "now playing" indicator.** If the user scrolls so the active entry is off-screen, there is no floating indicator showing what is playing. | `TuneView.jsx:152-195` | Add a thin sticky bar at the top of the entry list showing the currently playing entry name, or auto-scroll (see T-04). |

### 2.3 Voting Flow

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| T-07 | **High** | **Auth redirect loses context.** Clicking a vote button when logged out triggers `loginWithGoogle()`, which does a full-page redirect to Google OAuth. After returning, the user lands on `/` (the redirectTo is `window.location.origin`) instead of the tune page they were on. | `TuneView.jsx:76`, `supabase.js:270-276` | Set `redirectTo` to `window.location.href` so the user returns to exactly where they were. |
| T-08 | Low | **No haptic or animation feedback on vote.** The score number and arrow color change instantly, but there is no brief scale-up or color pulse animation. | `TuneView.jsx:288-310` | Add a CSS `transition` on color and a brief `scale-110` class that auto-removes via `setTimeout`. |

### 2.4 Sheet Music Toggle

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| T-09 | Medium | **Label text "Sheet" is not clickable.** The toggle is wrapped in a `<label>` but the click handler is on the `<button>` inside. Clicking the "Sheet" text does nothing. | `TuneView.jsx:134-148` | Move the `onClick` handler to the `<label>` element, or remove the wrapper and use a standalone button. |
| T-10 | Low | **Toggle only appears after active entry is set.** This causes a layout shift when the first entry loads. | `TuneView.jsx:133` | Always render the toggle placeholder (possibly disabled) to reserve layout space. |
| T-11 | Medium | **Sheet music split impossible to collapse on mobile.** The drag handle only goes down to 10% width. On a 375px phone at 25% default, the video panel is only ~280px wide and the sheet music is unreadably narrow. | `TuneView.jsx:48` | On screens < 640px, stack the video and sheet music vertically instead of using the horizontal split. |

### 2.5 Responsive Layout

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| T-12 | **High** | **Drag handle too narrow for touch.** The three-dot drag column is ~3px wide. On touch devices, this is nearly impossible to grab. | `TuneView.jsx:170-183` | Add a wider invisible touch target (padding or pseudo-element) around the drag dots. Use `touch-action: none` on the handle. |
| T-13 | Medium | **Vote buttons are small on mobile.** The up/down/report buttons are `p-1` with no touch-friendly size increase. | `TuneView.jsx:296-310` | Add `min-w-[44px] min-h-[44px]` or `p-2` on mobile via responsive classes. |

### 2.6 Accessibility

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| T-14 | Medium | **Vote buttons lack `aria-label`.** The `title` attribute alone is not sufficient for screen readers. | `TuneView.jsx:299, 304, 309` | Add `aria-label="Upvote"`, `aria-label="Downvote"`, `aria-label="Report"`. |
| T-15 | Low | **Entry play icon is not hidden from screen readers.** The ▶ character in the decorative circle is read aloud. | `TuneView.jsx:242` | Add `aria-hidden="true"` to the play icon div. |
| T-16 | Low | **Sheet music toggle `aria-checked` value should be a string.** The ARIA spec expects `"true"` or `"false"` as strings. | `TuneView.jsx:141` | Use `aria-checked={showSheet() ? 'true' : 'false'}`. |

---

## 3. AdminView — `components/AdminView.jsx`

### 3.1 Pending Review Flow

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| A-01 | **High** | **No undo after approve/reject.** Once a video is approved or deleted, it is gone from the list with no undo mechanism. If an admin accidentally clicks the wrong button, the action is permanent. | `PendingTab:132-154` | Replace instant removal with a 3-second "Undo" toast/snackbar. The actual API call completes, but the item stays in the list visually with an undo button that reverses the action (re-inserts the row). |
| A-02 | Medium | **Browser `confirm()` for delete is jarring and inconsistent.** The Spanish text ("¿Eliminar...?") mixes languages — the rest of the app UI is in English. Browser-native `confirm()` also blocks the entire tab. | `AdminView.jsx:145` | Replace with a custom confirmation dialog or inline two-step button ("✕ Reject" → "Confirm ✕"). Use consistent English text. |
| A-03 | Medium | **Approve/reject gives no success feedback.** The video silently disappears from the list. The admin has no visual confirmation that the action succeeded. | `PendingTab:132-154` | Show a brief green banner: `"✓ 'Title' approved"` at the top of the list for 2 seconds. |
| A-04 | Low | **No batch approve/reject.** Each video requires individual action, which is tedious with a large backlog. | `PendingTab:172-268` | Add checkboxes and a "Approve selected" / "Reject selected" toolbar. |
| A-05 | Low | **Preview toggle uses "▶ Preview" label.** The play triangle suggests "play" but the button just expands the preview area. | `AdminView.jsx:210` | Use "▼ Expand" / "▲ Collapse" instead. |

### 3.2 Edit Flow

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| A-06 | Medium | **Exiting edit mode returns admin to the default "Pending" tab.** If the admin was on "Latest approved" when they clicked Edit, after closing the edit form they are back on Pending. | `AdminView.jsx:449-456` | The tab state should be preserved. After edit close, restore the previously active tab. |
| A-07 | Low | **No "Cancel" button in edit mode.** Only "✕ Close" exists in the top-right. If the admin made accidental changes, there's no way to discard them. | `AddVideoForm.jsx:219-225` (shared component) | Add an explicit "Cancel / Discard changes" button with a confirmation if entries were modified. |

### 3.3 Tab Navigation

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| A-08 | Medium | **Tab state not preserved in URL.** Refreshing the page always returns to the "Pending" tab. Sharing a link to "Latest approved" is impossible. | `AdminView.jsx:442` | Use `useSearchParams` or hash-based routing: `/admin#latest`, `/admin#byTune`. |
| A-09 | Medium | **Tabs have no WAI-ARIA tab pattern.** Buttons lack `role="tab"`, `aria-selected`, `tabindex`, and content panels lack `role="tabpanel"` and `aria-labelledby`. | `AdminView.jsx:481-499` | Implement the [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). |
| A-10 | Low | **No transition when switching tabs.** Content abruptly swaps. | `AdminView.jsx:503-520` | Add a brief CSS fade-in animation or use `<Transition>`. |

### 3.4 Search by Tune Tab

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| A-11 | Medium | **Search dropdown stays visible after selecting a tune.** After clicking a result, `setQuery('')` is called, but there's a brief moment where the dropdown remains open with stale results. | `AdminView.jsx:348` | Clear `setResults([])` before setting query to empty in `handleSelect`. |
| A-12 | Low | **No "Clear selection" button after choosing a tune.** The only way to search for a different tune is to notice the search box is available again. Not obvious. | `AdminView.jsx:402-406` | Add a small "✕ Change tune" button next to the selected tune label. |

---

## 4. AddVideoForm — `components/AddVideoForm.jsx`

### 4.1 Form UX

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| F-01 | Medium | **No guided flow for adding entries.** The form is linear and long. For a 5-tune set, the user must manually search and add each tune, then fill timestamps. There is no Step 1 / Step 2 / Step 3 guidance. | `AddVideoForm.jsx:204-534` | Split the form into logical sections with progress indicators: (1) Video Info, (2) Tunes, (3) Review & Submit. Use collapsible sections or a stepper. |
| F-02 | Medium | **Auto-matched tunes appear asynchronously and may conflict with manual entry.** The 400ms debounce on auto-matching means tunes can appear while the user is already typing in the tune search field. | `AddVideoForm.jsx:69-94` | Disable auto-matching if the user has already manually added any entries beyond the pre-filled initial tune. Show a "Scanning title..." indicator. |
| F-03 | Medium | **TheSession import replaces title and source type without warning.** If the user had already set a custom title or source type, importing a tracklist silently overwrites them. | `AddVideoForm.jsx:127-131` | Show a confirmation dialog: `"Import will overwrite current title and source type. Continue?"` |

### 4.2 Validation Feedback

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| F-04 | **High** | **No inline validation on timestamp fields.** Invalid timestamps (e.g., "abc" or "1:99") are silently parsed to `null` via `parseSec`, which becomes `0` in the payload. The user gets no feedback. | `AddVideoForm.jsx:421-438`, `utils.js:19-26` | Add real-time validation that highlights the input border red and shows an inline error (e.g., `"Invalid format — use m:ss or seconds"`). |
| F-05 | Medium | **Submit button disabled reasons are not explained.** The button is disabled when: `!youtubeId()`, `entries.length === 0`, or `!!duplicate()`. The user sees a grayed-out "Save video" but doesn't know why. | `AddVideoForm.jsx:519-525` | Below the submit button, show contextual helper text: e.g., `"Add at least one tune to submit"` when entries are empty. |
| F-06 | Low | **Start timestamp uses `onInput` but end timestamp uses `onBlur`.** This inconsistency means the end timestamp doesn't update until the user clicks away. | `AddVideoForm.jsx:425, 436` | Make both use `onInput` for consistency. Debounce the propagation if needed. |
| F-07 | Low | **No validation that end > start.** A user can enter `start: 2:30, end: 1:00`, and the form will submit with nonsensical data. | `AddVideoForm.jsx:157-163` | Add inline validation: if `parseSec(end) <= parseSec(start)` and both are non-null, show `"End must be after start"`. |

### 4.3 Entry Management

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| F-08 | Medium | **No reorder/drag-and-drop for entries.** If entries are added in the wrong order, the user must remove and re-add them. | `AddVideoForm.jsx:398-493` | Add drag handles (≡ icon) and implement drag-and-drop reordering. |
| F-09 | Medium | **Removing an entry has no undo.** Clicking ✕ instantly removes the entry with no confirmation. If the user has entered timestamps and instruments, that work is lost. | `AddVideoForm.jsx:486-490` | Add a brief undo toast (3 seconds) or a confirmation if the entry has non-empty timestamps/instruments. |
| F-10 | Low | **Instrument dropdown stays open when clicking outside.** The dropdown only closes when clicking the toggle button again or selecting an instrument. | `AddVideoForm.jsx:457-482` | Add a click-outside listener via `createEffect` with a document click handler. |

### 4.4 Duplicate Detection

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| F-11 | Medium | **Duplicate warning has no link to the existing video.** If a video is already in the database, the user may want to view it. There is no link. | `AddVideoForm.jsx:263-277` | If the duplicate is approved, link to the tune page. If pending, show clearer guidance. |
| F-12 | Low | **Duplicate detection has a 400ms delay.** During these 400ms, the submit button is briefly enabled before the duplicate warning appears. A fast user could click submit and get a server error. | `AddVideoForm.jsx:69-94` | Disable the submit button immediately when `youtubeId()` changes, and re-enable only after the duplicate check completes. |

### 4.5 Accessibility

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| F-13 | Medium | **Instrument dropdown button lacks `aria-expanded`.** | `AddVideoForm.jsx:444-456` | Add `aria-expanded={openInstrumentDropdown() === i()}` and `aria-haspopup="listbox"`. |
| F-14 | Medium | **YouTube preview iframe has no `title`.** Screen readers announce the iframe with no context. | `AddVideoForm.jsx:282-287` | Add `title="YouTube video preview"` to the iframe. |
| F-15 | Low | **Channel and Title `<label>` elements are not associated with their inputs via `for`/`id`.** | `AddVideoForm.jsx:246, 291-293, 307-310` | Add `id` to inputs and `htmlFor` to labels. |
| F-16 | Low | **Timestamp labels ("start", "end") are spans, not `<label>` elements.** | `AddVideoForm.jsx:420, 431` | Change `<span>` to `<label htmlFor={...}>`. |

---

## 5. YoutubePlayer — `components/YoutubePlayer.jsx`

### 5.1 Playback Controls

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| Y-01 | Medium | **No custom play/pause/seek controls.** The component relies entirely on YouTube's built-in player controls. If the player is small (e.g., in admin preview), controls are hard to use. | `YoutubePlayer.jsx:120-161` | Add thin custom controls: play/pause button, segment progress bar (showing video position within start-end range). Keep YouTube controls as fallback. |
| Y-02 | Medium | **500ms poll for end_sec is imprecise.** The polling interval means up to 500ms of overshoot before pausing. For learning specific phrases, this is enough to miss the note. | `YoutubePlayer.jsx:77-83` | Reduce poll interval to 100ms, or use `requestAnimationFrame` with `getCurrentTime()` for sub-frame precision. |
| Y-03 | Low | **No progress indicator for the tuned segment.** The YouTube progress bar shows the entire video. The user has no way to see how much of the specific tune segment remains. | `YoutubePlayer.jsx:120-158` | Add a custom thin progress bar under the video showing the segment from `startSec` to `endSec` with the current position. |

### 5.2 Speed Controls

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| Y-04 | Medium | **Speed preset buttons are tiny and not touch-friendly.** The `0.25x` / `0.5x` etc. buttons use `text-[9px]` with no padding. On mobile, these are nearly impossible to tap accurately. | `YoutubePlayer.jsx:148-155` | Increase to `text-[11px]` and add `px-1 py-0.5` for a larger touch target. Use `min-w-[32px]` for consistent sizing. |
| Y-05 | Low | **Slider uses inline styles without proper cross-browser styling.** Only `-webkit-slider-thumb` is styled in CSS. Firefox (`-moz-range-thumb`) gets partial styling, and the track (`-moz-range-track`) is not styled at all. | `YoutubePlayer.jsx:138-144`, `index.css:35-54` | Add `-moz-range-track` styling to `index.css` and normalize appearance across browsers. |
| Y-06 | Medium | **0.25x speed produces choppy audio that may not be useful for learning.** YouTube's 0.25x playback uses aggressive time-stretching. | `YoutubePlayer.jsx:12` | Consider changing minimum speed to 0.5x and remove 0.25x from `SPEED_STOPS`. |

### 5.3 Auto-Advance

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| Y-07 | Low | **No "next in..." preview.** When a video is playing and will auto-advance, there is no indication of which entry is next. | `YoutubePlayer.jsx:73-92` | Show the next tune name in a small chip that appears near the end of the segment. |

### 5.4 Accessibility

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| Y-08 | Medium | **Speed slider lacks `aria-label` and `aria-valuetext`.** | `YoutubePlayer.jsx:130-136` | Add `aria-label="Playback speed"` and `aria-valuetext={`${speed()}x`}`. |
| Y-09 | Low | **Speed preset buttons lack `aria-label` or `aria-pressed`.** | `YoutubePlayer.jsx:148-155` | Add `aria-label={`Set speed to ${v}x`}` and `aria-pressed={speed() === v}` to each button. |

---

## 6. App — `App.jsx`

### 6.1 Navigation & Layout

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| AP-01 | Medium | **No active route indication in the header.** The Admin button changes text to "← Back" when on the admin page, but there's no visual highlight for the current route context. | `App.jsx:84-93` | Use a more explicit navigation pattern: subtle underline on the active route or a breadcrumb. |
| AP-02 | Low | **No 404 page.** Navigating to `/tune/999999` (invalid ID) or `/nonexistent` renders an empty TuneView or nothing at all. | `index.jsx:9-14`, `TuneView.jsx:93-323` | Add a catch-all route with a friendly 404 page. In `loadTuneById`, if `getTuneById` returns null, show an error state. |
| AP-03 | **High** | **No loading/transition state during OAuth redirect.** Clicking "Login" immediately redirects to Google. On slow connections, the user sees a blank page or freeze for seconds. | `App.jsx:66-71`, `supabase.js:270-276` | Add a brief loading overlay: set a `loggingIn` signal, show a spinner with "Redirecting to Google...", then call `loginWithGoogle()`. |
| AP-04 | Medium | **No error handling for login failure.** If OAuth fails (network error, user cancels), the error is not caught in `loginWithGoogle` (it just throws). | `App.jsx:66`, `supabase.js:270-275` | Wrap login call in try/catch and show an error toast. |

### 6.2 Header Layout

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| AP-05 | Medium | **User email hidden on mobile.** `hidden sm:inline truncate max-w-[160px]` means mobile users can't verify which account they're logged in as. | `App.jsx:94-96` | Show a user avatar (Google profile picture) from `currentUser.user_metadata.avatar_url` or an icon indicating "logged in". |
| AP-06 | Low | **Five interactive elements in the header on mobile.** Theme toggle, Login/+Add video, Admin, Email, Logout — this can wrap or overflow on narrow screens. | `App.jsx:46-104` | Consider a hamburger/overflow menu on small screens (< 480px) or grouping auth controls into a dropdown. |

### 6.3 Theme Toggle

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| AP-07 | Low | **No CSS transition when switching themes.** The color change from dark to light is instantaneous and jarring. | `index.css:17-26` | Add `transition: background-color 0.3s, color 0.3s` on `body` and key elements. |
| AP-08 | Low | **Theme toggle tooltip not visible on touch devices.** The `title` attribute does not appear on touch screens. | `App.jsx:50` | Use `aria-label` as a more universally supported alternative. |

### 6.4 Error Handling

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| AP-09 | Medium | **Error boundary "Reload page" button does `window.location.reload()`.** All state is lost. A gentler approach would be to reset the ErrorBoundary and re-render. | `App.jsx:119` | Navigate to `/` instead of full page reload, or use ErrorBoundary's `reset` mechanism. |

### 6.5 Initial Loading

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| AP-10 | Low | **"Loading tune library..." text never changes.** If the DB load takes > 10 seconds (slow network for the 11MB SQLite file), the user sees no progress update. | `App.jsx:129-133` | Add a secondary message after 5 seconds: `"This may take a moment on first visit..."`. |
| AP-11 | Medium | **No retry mechanism if DB load fails.** If `initDB()` throws, the user can only "Reload page." If the failure is persistent (e.g., CDN issue), they're stuck. | `App.jsx:111-125` | Add a "Try again" button that re-calls `loadDB()`. |

---

## 7. SheetMusic — `components/SheetMusic.jsx`

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| SM-01 | Low | **White background is jarring against dark theme.** The container uses `bg-white text-gray-800`, creating sharp contrast. Intentional for readability, but the transition is stark. | `SheetMusic.jsx:80` | Add a subtle border/shadow or border-radius animation to soften the visual boundary. |
| SM-02 | Low | **No transposition controls.** The "Setting" dropdown only shows available variants. Users can't transpose the key or adjust notation size. | `SheetMusic.jsx:83-100` | Consider adding abcjs rendering options: transpose dropdown, notation size slider. |

---

## 8. SameTypeTunes — `components/SameTypeTunes.jsx`

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| ST-01 | Low | **Random selection causes layout shift on re-render.** Every time the selected tune changes, the grid randomly picks 5 different tunes, causing the grid to jump. | `SameTypeTunes.jsx:18-30` | Seed the random shuffle with the selected tune ID so navigating to the same tune always shows the same related tunes. |
| ST-02 | Medium | **Thumbnail uses the first video's thumbnail, not the best.** `videoThumbnailsByTune` picks the first video. A tune with 5 videos might have a bad thumbnail from the first one. | `appStore.js:244-248` | Store the thumbnail with the highest-voted entry or allow multiple thumbnails per tune. |

---

## 9. TheSessionImportModal — `components/TheSessionImportModal.jsx`

| ID | Severity | Issue | File:Line | Suggested Fix |
|----|----------|-------|-----------|---------------|
| IM-01 | Medium | **No "Import all tracks" option.** For a recording with 10 tracks, the user must open the modal 10 times and import one track at a time. | `TheSessionImportModal.jsx:100-119` | Add an "Import all tracks" button that imports all tracks at once. |
| IM-02 | Low | **No feedback after import.** After clicking "Import," the modal closes immediately. The user doesn't see what was added until they scroll. | `TheSessionImportModal.jsx:34-36`, `AddVideoForm.jsx:109-135` | Keep the modal open after import with a checkmark on the imported track (✓ Imported), or scroll to and highlight the newly added entries in the form. |
| IM-03 | Low | **Error messages are generic.** "Recording not found" doesn't help the user debug the URL format. | `thesession.js:32` | Show the resolved ID in the error: `"Recording #158 not found on TheSession"`. |

---

## 10. Overall User Journeys

### 10.1 New User Landing

| ID | Severity | Issue | Suggested Fix |
|----|----------|-------|---------------|
| J-01 | **High** | **No onboarding or value proposition for unauthenticated users.** The hero says "Find any tune" but there is no guided first action. A new user sees a search bar but may not know any tune names. | Add a "Browse popular tunes" section with a curated list of well-known tunes that have videos. Use `popularity_score` from SQLite. Also add suggested searches: "Try: The Butterfly, Drowsy Maggie, Cooley's Reel." |
| J-02 | Medium | **Login prompt appears only when trying to vote or add.** A browsing user has no idea they can contribute until they stumble upon the "+ Add video" button or try to vote. | Add a subtle CTA banner on the hero: "Log in to contribute videos and vote on the best performances." |
| J-03 | Medium | **No "empty library" state for new instances.** If Supabase has no approved videos yet (fresh deployment), the entire site shows zero videos everywhere. | Detect if `videoCountsByTune().size === 0` and show a prominent call-to-action: "Be the first to add a video! Log in and contribute." |

### 10.2 Search → Discover → Watch Flow

| ID | Severity | Issue | Suggested Fix |
|----|----------|-------|---------------|
| J-04 | Medium | **No "back to search" state preservation for scroll position.** Search query and results survive navigation (good!), but scroll position is lost. | Persist scroll position, or auto-scroll to the previously clicked result. |
| J-05 | Medium | **No recently viewed or history.** If a user browses 5 tunes, there is no way to go back to a previously viewed tune without searching again. | Add a "Recently viewed" section in SearchView (using sessionStorage). |
| J-06 | Low | **No "related tunes" beyond same type.** SameTypeTunes shows tunes of the same type, but doesn't use the `tune_similarities` table from SQLite (`getSimilarTunes` exists but is never called). | Use `getSimilarTunes` to show genuinely related tunes (similar melodic structure, same composer, etc.). |

### 10.3 Contribute Flow (Adding a Video)

| ID | Severity | Issue | Suggested Fix |
|----|----------|-------|---------------|
| J-07 | Medium | **No indication of what happens after submission.** The success message says "Video saved — pending approval" but doesn't explain what "pending approval" means or how long it takes. | Add a brief explanation: "An admin will review your submission. Approved videos appear publicly, usually within 24 hours." |
| J-08 | Medium | **No submission history or status tracking.** After submitting, the user can't see their pending submissions or check status. | Add a "My submissions" section visible to authenticated users, listing their submitted videos with status (pending/approved/rejected). |
| J-09 | Low | **"Add another" button resets ALL form state.** If the user clicks "Add another" by accident while reviewing their previous submission, all data is lost. | Keep the previous submission data accessible, or add a confirmation before reset. |

### 10.4 Admin Moderation Flow

| ID | Severity | Issue | Suggested Fix |
|----|----------|-------|---------------|
| J-10 | **High** | **No notification system for pending reviews.** Admins must manually visit `/admin` to check for pending videos. There's no badge, email, or push notification. | Show a pending count badge in the header's Admin button when user has admin role. Add optional email notifications via Supabase Edge Functions. |
| J-11 | Medium | **No audit log or activity history.** If an admin approves/rejects a video, there is no record of who did it and when. `tune_videos` has `added_by` but no `reviewed_by` or `reviewed_at`. | Add `reviewed_by` and `reviewed_at` columns to `tune_videos` and display them in the admin UI. |
| J-12 | Medium | **No bulk operations.** Admins must process each video one at a time. For a backlog of 50+ pending videos, this is extremely slow. | Add checkboxes and bulk Approve/Reject buttons. |

### 10.5 Cross-Cutting Concerns

| ID | Severity | Issue | Suggested Fix |
|----|----------|-------|---------------|
| X-01 | **High** | **No toast/notification system.** The entire app has zero toast notifications. Actions succeed or fail silently, with the only feedback being inline state changes. | Implement a simple toast system using a global signal. Use it for: vote success/failure, video submission, approve/reject, login/logout, report submission. |
| X-02 | Medium | **No keyboard shortcuts.** Power users (especially admins reviewing videos) have no way to navigate efficiently. | Add keyboard shortcuts: `Space` to play/pause in TuneView, `j`/`k` to navigate entries, `a`/`r` to approve/reject in AdminView. |
| X-03 | Medium | **Mixed language (English UI, Spanish admin prompts).** The `confirm()` dialogs in AdminView use Spanish: "¿Eliminar...?", "No se puede deshacer." while the rest of the UI is in English. | Standardize on English for all UI strings, or implement proper i18n. |
| X-04 | Low | **No dark/light mode transition animation.** The theme toggle is functional but visually abrupt. | Add `transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease` on root element. |
| X-05 | Low | **No offline/PWA support.** The SQLite DB is already cached (11MB), but Supabase API calls fail silently. | Add a "No internet connection" banner when fetch calls fail. |

---

## Summary of Critical Issues

| Priority | ID | Component | Issue |
|----------|-----|-----------|-------|
| **Critical** | T-07 | TuneView | OAuth redirect loses user context (returns to `/` instead of current page) |
| **High** | A-01 | AdminView | No undo after approve/reject |
| **High** | F-04 | AddVideoForm | No inline validation on timestamp inputs |
| **High** | J-01 | SearchView | No onboarding for new users; cold-start dead end |
| **High** | X-01 | Global | No toast/notification system anywhere |
| **High** | AP-03 | App | No loading state during OAuth redirect |
| **High** | S-05 | SearchView | No empty state when filters return zero results |
| **High** | J-10 | AdminView | No notification for pending reviews |
| **High** | T-12 | TuneView | Drag handle too narrow for touch devices |
| **Medium** | J-08 | Contribute | No submission history/status tracking for users |
| **Medium** | F-08 | AddVideoForm | No drag-and-drop reorder for entries |
| **Medium** | A-09 | AdminView | Tabs missing WAI-ARIA tab pattern |
| **Medium** | S-02 | SearchView | Search and type filters are mutually exclusive |
| **Medium** | T-04 | TuneView | No scroll-to-active on auto-advance |
| **Medium** | Y-06 | YoutubePlayer | 0.25x speed is too choppy to be useful |
