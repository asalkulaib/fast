## Week, History and Day screens: behaviour inventory

Sources read: `docs/js/ui/week.js`, `docs/js/ui/history.js`, `docs/js/ui/day.js`, `docs/js/core/review.js`, `docs/js/core/history.js`, `docs/js/core/rules.js`, plus helpers they call (`core/fullness.js`, `core/time.js`, `core/weight.js` weekSummary, `ui/fullness.js`, `ui/pause.js`, `ui/outside.js`, `ui/shared.js`, `ui/components.js` legend/hatch/choice/timeField, `ui/meal.js` sheets, `store.js`, `app.js` routing). Tests: `tests/unit/{rules,review,history,goals,flexible,pause}.test.js`, `tests/e2e/{review,week-more,history,goals,pause,window,notes,undo,day-fullness,add-meal,begin-fast,satiety,sliders,today-card,travel,screens}.spec.js`, seed `tests/e2e/seed-data.js` (WEEK = Sun 20 to Sat 26 Sep 2026).

---

### 0. Shared foundations (all three screens depend on these)

#### 0.1 Records involved (IndexedDB db `fast`, v1; in-memory Maps in `store.state`)
- **days** (key `day` = 'YYYY-MM-DD'): `firstBite` ms|null, `lastBite` ms|null (null with firstBite = window open), `noEating` bool, `dayOff` bool, `energy4pm` 1 to 5|null, `trained` bool|null, `trainingType` 'weights'|'cardio'|'other'|null, `paused` 'travel'|'illness'|'ramadan'|'other'|true (absent when not paused), `fullness` 'before_full'|'full'|'stuffed' (the day's own rating), `fastFrom` ms (Begin fast), `updatedAt`.
- **meals** (autoincrement `id`): `day`, `name`, `startedAt`, `finishedAt`|null, `hungerBefore`, `stop` ('before_full'|'full'|'stuffed'), `fullnessNow`, `fullness20`, `fullness20DueAt`, `outside` (true when the meal began after the window closed and past reopening).
- **outside** (autoincrement `id`): `day` (the window it follows), `at`, `trigger` ('hunger'|'boredom'|'social'|'stress'|'tired'|'other'|null), `amount` ('little'|'meal'|null), `source` ('today').
- **temptations** (autoincrement `id`): `day`, `startedAt`, `endedAt`, `trigger`, `outcome` ('held'|'opened_early'|'ate_little'|'ate_outside'|null), `urges` [{min, value}], `context`, `step`.
- **weights** (key `date`): `kg`.
- **settings** (key/value) used here: `workdayStart` (default '17:30'), `weekendStart` ('14:00'), `goalChanges` [{from, hours, fast?}], `flexChanges` [{from, on}], `installedAt`, `historyMetric` ('fast'|'feast'|'weight'), `historyChart` ('bars'|'line'), `historyRange` (7|30|90), `zones`.

#### 0.2 Calendar rules (`core/time.js`, `core/rules.js`)
- Weeks run **Sunday to Saturday** (`weekStart` = the Sunday). Workweek days are **Sun to Thu**; Fri and Sat are weekend. `isWorkday(key, rec)` = Sun to Thu and not `rec.dayOff`.
- A window belongs to the **day of its first bite**, even past midnight.
- Goal in force on a day = latest `goalChanges` entry with `from <= day` (default 4 h window = 20:4). `windowMsFor`, `longFastHours` (only when `fast >= 24`), `fastHoursFor` = long fast hours, else `24 - window hours`. Past days keep the goal they had.
- Flexible timing ("Feasting hours") in force = latest `flexChanges` entry with `from <= day`. `cutoffApplies(key, rec, settings)` = workday AND not flexible.
- Constants: `GRACE_MS` 15 min; `CUTOFF_MIN` 16:00 (960); `LATE_NIGHT_END_MIN` 04:00; `FORGOT_AFTER_MS` 2 h.
- `plannedStartMin`: workday uses `workdayStart`, otherwise (weekend or day off) `weekendStart`.

#### 0.3 evaluateDay (the result of a day), in this exact order
Inputs: day key, record, outside count, now, today, startKey (tracking start), windowMs, flexible, fasted.
1. **Paused** record: `result 'paused'`, `state 'paused'`, `paused` = reason, no reasons. Whatever is logged is ignored (a window over goal plus outside eating on a paused day is still 'paused').
2. **Has a window** (firstBite set): open if no lastBite; length = (lastBite, or max(now, firstBite) while open) minus firstBite.
   - `early` if workday AND not flexible AND first bite before 16:00 (exactly 16:00 is allowed).
   - `over` if length > windowMs + 15 min (4 h 15 min exactly is a success; 4 h 16 min is a miss). `overByMs` = length − windowMs (not minus grace: 4 h 20 on 4 h reports over by 20 min).
   - `outside` if outside count > 0.
   - result: any reason gives `miss`; otherwise `pending` while open, `success` when closed. state 'open'|'closed'. An open window keeps growing with the clock, so a forgotten open window eventually becomes a miss ('over').
3. **No window, outside count > 0**: `miss`, reasons ['outside'], state 'noEating' if flagged no-eating else 'none'.
4. **noEating**: `success`, state 'noEating'.
5. **fasted** (long fast, see 0.5) and tracked (day < today and day >= startKey): `success`, state 'fasted'.
6. Otherwise state 'none' and result: `pending` if day is today; `unlogged` if a past tracked day; `none` (before tracking started, or a future day).
- Outside count per day (`makeEvaluator`) = outside entries on that day + meals of that day with `outside: true`.
- `makeEvaluator` caches per day, applies the day's own goal and flexible rule. Pinned: `tests/unit/rules.test.js`, `goals.test.js`, `flexible.test.js`, `pause.test.js`.

#### 0.4 Tracking start (`trackingStart`)
Install day (`installedAt`), or the earliest day holding real data if older: a day with firstBite, lastBite, noEating, paused, dayOff, fullness, energy4pm, or trained set; any meal, outside entry or temptation day. A day holding only `fastFrom` is not data. Never later than today. Decides 'unlogged' vs 'none'. (`goals.test.js`)

#### 0.5 Long fast success (`insideLongFast`)
A day is "fasted" when: the goal that day is a long fast (24 to 72 h); the day has no window; no window from before the day's start is still open; the latest eating moment before the day's start (any first/last bite, `fastFrom`, meal start/finish, outside entry) is less than the goal's hours before the day's start; and no paused day lies between that eating's day (or the day after it, when it was a Begin fast) and the day. Eating outside on such a day still makes it a miss (rule 3 runs first). Breaking a long fast early is not a miss. (`goals.test.js`)

#### 0.6 Streaks (`streaks(evaluate, endKey, startKey)`)
- Current: step back from endKey skipping leading `pending` days; then count consecutive `success`; `paused` days are skipped (neither count nor break); anything else (miss, unlogged) stops.
- Best: scan startKey to endKey; success increments the run; `pending` and `paused` are neutral; anything else resets. Best = max(best, current).
- Today pending does not break; last night's still-open window inside its goal (pending) does not break; an unlogged day breaks. (`rules.test.js`, `pause.test.js`)

#### 0.7 Day fullness and "left wanting" (`core/fullness.js`)
`dayFullness(meals, rec)`: ratings = each meal's `stop` plus the day's own `fullness`. None: null. Any 'stuffed' gives 'stuffed'; else any 'full' gives 'full'; else 'before_full' (LEFT_WANTING) unless some meal is unrated and the day has no own rating (then null). Counts on every day, paused included. Owner decision: day fullness is the worst meal rating; the gold dot means left wanting only; do not propose alternatives.

#### 0.8 Refresh behaviour
These screens redraw on any store change, on route change, when the day key changes, or when a window opens/closes; not every minute (an open window's bar on Week does not grow live until something redraws).

---

### 1. Week tab (`renderWeek`, `docs/js/ui/week.js`; maths `weekReview`, `docs/js/core/review.js`)

#### 1.1 Route and frame
- `#week` = current week; `#week/<any day key>` shows the week containing that day (normalised to its Sunday). Invalid arg falls back to `#week`. The Week tab is highlighted for `week` and `day` routes.
- Header: title "Week"; sub "This week" only on the current week. Header carries the shared **Tempted?** button whenever no window is open and today is not paused, and the away-zone note (for example "Dubai time") when abroad.
- Heading: week range, `fmtWeekRange`: "20 to 26 September" or "27 September to 3 October".
- Navigation: "‹ Previous" (always, `#week/<start−7>`, no lower limit) and "Next ›" (only when not the current week).

#### 1.2 The schedule (`data-testid week-strip`), one row per day Sun to Sat
Each row is one tappable control opening `#day/<key>`.
- Row result: `future` when day > today and not paused; otherwise the evaluation result (`success`|`miss`|`paused`|`pending`|`unlogged`|`none`). Exposed as `data-result`.
- **Result square** at row start (shared with Today's week row, `resultCell`): success = solid; miss = clay stripes (a miss never rests on colour alone); paused = sand; future = dashed outline; pending/unlogged/none = plain outline. **Gold dot** overlaid when day fullness is left wanting.
- **Day label**: "Sun 20" (weekday short + date number).
- **24-hour line** from 04:00 that day to 04:00 next day (late eating sits with its evening). Ticks at 06, 12, 18, 00 with a header line labelling "06 12 18 00". Line dashed on future rows.
  - Paused row: a full-width sand band; nothing else drawn (no window, cross or 16:00 line).
  - 16:00 marker (dashed vertical) on non-future, non-paused days where `cutoffApplies` (workday, not a day off, fixed timing). Drawn whether or not a window exists. In WEEK seed: 5 lines (Sun to Thu).
  - Window bar from first bite to last bite; while open, to max(firstBite, min(now, next 04:00)). Positions clamped to the line; minimum width 2 of 240 units. Fill: miss = clay stripes with clay edge; closed non-miss = ink; open non-miss = rock ("Window still open").
  - Clay cross at each outside entry's `at` and each outside-flagged meal's `startedAt`.
- **Times text** under/next to the line: paused = reason word ("Travel", "Illness", "Ramadan", "Other", or nothing when no reason); window = "17:30 to 21:00" (plain clock times, so "23:00 to 01:30" past midnight) or "from 17:30" while open; else nothing.
- **Result word** at row end (`dayResult`): paused "Paused"; future ""; success "No eating" (state noEating) / "Fasted" (state fasted) / "Success" (flagged ok); miss "Miss"; pending "Open" (open window) / "Today"; unlogged "Not logged"; none "".
- **Accessible label**: "Thu 24 Sep, miss, left wanting, 18:00 to 20:00" built from day, result word (success 'success', miss 'miss', paused 'paused', pending 'in progress', unlogged 'nothing logged'; nothing for future/none), "left wanting" if dotted, then the times text.

#### 1.3 Schedule legend (`data-testid strip-legend`)
Always: "Success", "Miss" (striped key), "Paused", "Open or not logged", "Still ahead", "Left wanting". Then only when present in non-paused rows: "Window still open" (an open non-miss bar), "16:00 on workdays" (any cutoff line), "Ate outside the window" (any cross). Pinned order (WEEK seed): Success, Miss, Paused, Open or not logged, Still ahead, Left wanting, 16:00 on workdays, Ate outside the window (`satiety.spec.js`).

#### 1.4 Summary sections (exact copy; `stat` rows are label + value)
- **Successful days**: big figure "N of M": N = success results in the week (includes No eating and Fasted); M = 7 − paused days (future days stay in M, so mid-week reads "2 of 7"). Margin notes: "Best streak" with "N day(s)"; "Paused" with "N day(s)" only when any paused.
- "Average window": mean length of the week's **closed** windows (misses included; open and paused excluded), `fmtDuration` ("3 h 17 min"), or "no windows yet".
- "Streak" (current week) / "Streak at week end" (past weeks): current streak with "N day(s)". Streak and best are computed up to min(week's Saturday, today) from tracking start; {0,0} if that end is before tracking start. So "Best streak" is the best up to that week's end, not within the week.
- **Workdays**: "Opened at 16:00 or later": "onTime of windows" or "no workday windows". windows = non-future days that are workdays on fixed timing with a first bite (open windows count; paused excluded); onTime = not opened early. Flexible days are left out.
- "Energy at 4 PM" subheading, then "Nothing eaten before 4 PM" and "Ate before 4 PM": "4.0 (4 days)" or "no data yet". Then, only if any all-time data, a line: "All time: 4.0 without eating before 4 PM (4 days), 2.0 with (1 day)." ("no data" replaces a missing average). Split rule (`energySplit`): a day counts if it has `energy4pm`, is a workday (day off excluded), not paused, and its eating is known (first bite, no-eating, or it is today). "Ate before 4 PM" = first bite before 16:00. All time = every day record.
- **Weight**: if the week (Sun to Sat calendar week) has any weigh-in: "7-day average" "104.7 kg" (1 decimal) and "Change from last week" signed with a true minus ("−0.8 kg", "+0.3 kg", "0.0 kg") or "needs last week". Else "No weigh-ins imported for this week." (`weekSummary`, MIN_WEIGH_INS = 1.)
- **Training**: "Sessions" = days in the week with `trained === true`, not paused. Under it, types ranked by count then name: "weights 2, cardio 1" ('unspecified' reads "type not set"); hidden when none.
- **Temptations** (on non-paused days of the week): "Count"; "Held": "3 of 4 (75%)" (held = outcome 'held'; decided = any outcome; percent rounded) or "none yet"; "Top triggers" (top 3, count desc then name): "boredom 2, social 1, stress 1", hidden when none.
- `weekReview` also computes satiety figures (meals, rated, beforeFull share, avg rise, avg at 20, leftWantingDays) that the Week screen **does not show** ("Satiety numbers and findings are on the Satiety tab").
- Pinned values: `tests/unit/review.test.js` and `tests/e2e/review.spec.js` (WEEK: 4 of 7, 3 h 17 min, streak 2 days, 4 of 5, 4.0 (4 days), 2.0 (1 day), 104.7 kg, −0.8 kg, 3 sessions, 4 temptations, 3 of 4 (75%)). Paused: `pause.spec.js` (success-count "2 of 5", "Paused2 days", row shows "Illness" and "Paused"). Goals per day: `goals.spec.js` (7 h a miss on 20:4; 5 h 30 a success on 18:6; "Fasted" row on a long fast). Flow from unlogged notice: `window.spec.js` ("No eating" and "17:40 to 21:10 ... Success").

#### 1.5 The week on Today (`weekRow`, also in week.js, rendered at the top of Today)
- Seven buttons Sun to Sat of today's week; weekday label "Sun"; the same result square; today marked as current date (underlined). Tap opens `#day/<key>`.
- Result: 'future' for days after today unless paused. Gold dot only on non-future days left wanting.
- Label: "Thu 24 Sep, miss, left wanting" ('still ahead' for future; unknown results read 'nothing logged').
- Legend lists **only the marks present**, in order: Success, Miss, Paused, Open or not logged (pending/unlogged/none), Still ahead, Left wanting. Pinned: `today-card.spec.js` (["Success","Miss","Left wanting"]; early week ["Open or not logged","Still ahead"]).

---

### 2. History tab: Fast and Feast (`renderHistory`, `docs/js/ui/history.js`; series `docs/js/core/history.js`)

#### 2.1 Route, switch, remembered choices
- `#history`. If `settings.historyMetric === 'weight'` the History route shows Weight instead (the tab remembers Weight); Weight also lives at `#weight`. History tab highlighted for history and weight.
- Header title "History" (with Tempted? and zone note rules).
- Metric switch (also on Weight): "Fast" | "Feast" | "Weight". Saves `historyMetric`, then goes to `#weight` or `#history`.
- Chart switches on one slim line at the top of the card: range "7 days" | "30 days" | "90 days" (label "Days shown"), chart "Bars" | "Line" (label "Chart"). Each saves to settings immediately (`historyRange`, `historyChart`). Defaults: Fast, Bars, 30. Remembered across reloads (`history.spec.js`). Tracks are draggable (`sliders.spec.js`).

#### 2.2 What is plotted (`dailySeries`)
- One entry per day, `{ day, fastMs, feastMs, paused }`.
- **Feast** = that day's closed window, last bite − first bite. Open windows (including today's in progress) have none.
- **Fast** = the fast that ended that day: from the latest eating moment strictly before the day's first bite to that first bite. Eating moments: every first bite, last bite, `fastFrom` (Begin fast), meal start and finish, outside entry. Null when the day has no first bite (no-eating, fasted, unlogged days have none; the next eating day's fast spans them, so values above 24 h occur, e.g. "26 h"); null when there is no earlier eating (first tracked day); null when a paused day lies from the prior eating's day (or the day after it, if it was a Begin fast) up to the day before.
- **Paused** day: neither value; `paused` = reason.
- Range: from = today − (range − 1), clamped to tracking start; to = today. So fewer than 7/30/90 days show when tracking is younger.
- Trend: trailing 7-day average (inclusive) needing at least 3 values in the 7 days, else none; fed by the 6 days before `from`; no trend point on a paused day (the line breaks). (`pause.test.js`)
- Summary: count of days with a value, and their mean.

#### 2.3 Card content (order)
1. Switches (2.1).
2. Lead: label "Average fast" / "Average window", the dates "20 Sep to 26 Sep" (from to today), the average as a big figure ("20h 35m", past two days "2 days 3h") only when count > 0, then a line: count 0 "Nothing yet in the last 30 days."; count equal to range "Over the last 7 days."; otherwise "From 6 of the last 30 days." (uses the chosen range, not the clamped length).
3. Focus line when a legend filter is on: "Showing misses only." with "Show all".
4. Chart.
5. Legend (filterable).
6. Readout of the selected day.
7. "Open this day" (when a day is selected) to `#day/<key>`.
8. Table (when shown), then the toggle "Show as a table" / "Hide the table".

#### 2.4 Chart behaviour (keep the logic; restyle freely)
- Y axis: hour scale from the largest value (minimum 1 h): step = first of [1, 2, 4, 6, 8, 12, 24] with hours/step <= 4; top = ceil(hours/step) × step. Grid line per step; the top label carries " h". (20.7 h gives step 6 top 24; 3.5 h gives 1/4; 44 h gives 12/48.)
- X labels: 7 days or fewer, every day "Su 20"; more, three labels: first, middle (floor((n−1)/2)), last as "20 Sep".
- One slot per day; marks only for days with a value.
- **Role of each mark** (series): miss day = 'miss' (clay stripes, selected or not, even after a long fast that reached its goal); Fast metric value >= that day's fasting goal and not a miss = 'goal' ("Goal reached", gold); others = 'bar'. Goal per day = `fastHoursFor(day) × 1 h` (long fast hours, or 24 − window). Feast never has goal marks. Selected day: drawn in ink with an ink edge, but a selected miss keeps its stripes; it keeps its series for filtering.
- Bars mode: one bar per value (max width 24 units).
- Line mode: a line through values, broken across days with no value (only consecutive days join). Square markers: always for missed and selected days; for other days only when the range shows 30 days or fewer (90 days shows miss and selected markers only).
- Paused days: a shaded band behind the full plot height of that slot.
- 7-day trend: solid line, broken at nulls. Average: dashed horizontal line at the mean.
- 7 days or fewer: each mark carries its value above it ("26h", "3h 30m").
- Accessible label: "Fast hours per day, 30 days, with the 7-day trend and the average. Tap a day to read it."
- **Selecting**: a press anywhere on the chart selects the day whose slot is under the finger (by x), including days with no value or paused days. Left/Right arrow keys step the selection (from the last day if none). The selection is kept across redraws and visits for the app session; if the selected day leaves the range, the latest day with a value is selected (or none).

#### 2.5 Legend (`history-legend`), filterable
Order: "Goal reached" (Fast only, when any goal mark), then the day mark: "Short of the goal" when any goal mark, else "Hours fasted" (Fast) / "Hours in the window" (Feast); "Miss" (always); "Selected day" (when a day is selected; not a filter); "7-day trend" (when any trend point); "Average" (always); "Paused" (when any paused day). Pinned Feast 7 days: ["Hours in the window","Miss","Selected day","7-day trend","Average"].
- Tapping an item with a series shows only that series (others fade; their value labels too); tapping it again, or "Show all", shows everything. Focus words: bar "days that were not a miss", goal "fasts that reached the goal", miss "misses", trend "the 7-day trend", avg "the average", paused "paused days" ("Showing … only."). The chart still selects days while filtered.
- Focus is session-only (`app.ui.historyFocus`) and resets when leaving the History route (switching to Weight resets it; Fast/Feast switching keeps it). (`satiety.spec.js`)

#### 2.6 Readout (`history-readout`), durations with non-breaking spaces
- Paused: "Thu 24 Sep: paused for travel." (" for illness", " for Ramadan"; 'other' or no reason: "paused.").
- Value: "Sat 26 Sep: fast 26 h, goal reached." / "Wed 23 Sep: window 4 h 20 min, a miss." ("a miss" wins over "goal reached"); then " 7-day trend 20 h 35 min." when that day has a trend point.
- No value: "Wed 23 Sep: no fast recorded." / "no window recorded."

#### 2.7 Table view (`history-table`)
Toggle state is session-only (`app.ui.showHistoryTable`, not reset on leaving). Columns "Day", "Fast"/"Feast", "7-day trend". Rows newest first, only days with a value or paused. Day "Wed 23 Sep" plus ", miss" when the day is a miss; value `fmtDuration` or "Paused"; trend blank on paused or missing.

#### 2.8 Empty state
When no day in range has a value: switches, lead (no figure, "Nothing yet in the last N days."), then Fast "Fasts appear here from the day after your first logged window." / Feast "Your eating windows appear here once you close one.", then the Tuwaiq scenery (lit for the current day phase). No chart, legend, readout or table.

Pinned: `tests/e2e/history.spec.js` (WEEK: 6 fast bars; "20h 35m"; "From 6 of the last 30 days."; "20 Sep to 26 Sep"; readouts; feast "3h 17m"; 7-day x labels; 3 misses; paused "3h 30m", "From 6 of the last 7 days."; the Friday fast after a paused Thursday is unknown), `tests/unit/history.test.js`, `goals.test.js` (Begin fast feeds History).

---

### 3. Day screen (`renderDay`, `docs/js/ui/day.js`): view and correct any day

#### 3.1 Route and frame
- `#day/YYYY-MM-DD` (invalid date goes to `#week`). Reached from Week rows, Today's week row, History "Open this day", and Today's notice "Nothing logged for …" / "N recent days have nothing logged." with "Fill in" (most recent unlogged day in the last 14).
- Header: title "Day"; sub = day type: "Paused" > "Day off" > "Workday"/"Weekend". Zone note: when the day's first bite (or 12:00 that day) happened on a clock different from the zone in force now: "Times in Kuwait time" (shown as "Workday · Times in Kuwait time"); otherwise the usual away-zone note. Times on the day read in the zone they happened in (`travel.spec.js`).
- Top card: long date "Thursday 24 September"; result line; "‹ Back to the week" (to that day's week).
- Result line copy: success "Success." / "Success: no eating." / "Success: a day of your long fast."; miss "Miss: " + reasons joined ", " + "." with early "opened before 16:00", over "over 4 h 15 min" (goal + grace of that day), outside "ate outside the window" (e.g. "Miss: opened before 16:00."); pending "Window open." (open) / "In progress."; unlogged "Nothing logged yet."; paused "Paused: not tracked."; none "Before tracking started." (a future day also evaluates to none and shows this).

#### 3.2 Which sections show (past = day <= today; tracked = past and not paused)
| Section | Shown when |
|---|---|
| Paused | day is paused (any date) |
| Window | tracked |
| "This day has not started yet." | future and not paused |
| Pause | not paused and the day's window is not open (future days too) |
| Day off | Sun to Thu and not paused (future days too) |
| Fullness | past and (paused, or a first bite, or any meal) |
| Meals, Outside the window, Check-in | tracked |
| Temptations | tracked and at least one temptation |
A paused day hides its window, meals, outside entries, check-in and temptations (kept in storage, not counted) but still shows Fullness.

#### 3.3 Paused section
"Paused" label; "Travel. This day is not tracked. Unpause it to log it." (reason word omitted with no reason). "Unpause this day": removes `paused` (a record left holding nothing is deleted), flash "Day unpaused." with Undo.

#### 3.4 Window section (per-day draft kept in memory across redraws until the saved firstBite/lastBite/noEating change; no cancel once editing)
- **No window, not editing**:
  - If `noEating`: "No eating this day." + "Undo" (clears the flag; no flash).
  - Else: "No window logged." + "Log this day's window" (switches to editing) + "No eating this day" (sets noEating true and clears both times; no flash/undo). Gives result Success: no eating.
- **Editing** (a first bite exists, or after Log):
  - Two 24-hour rolling wheels side by side: "First bite" (unset falls back to the planned start for that day type; the fallback is not a value until rolled) and "Last bite" (optional, with Clear; unset falls back to first (or planned) + 180 min and is hinted "Open").
  - First bite is always on this day; last bite resolves to the first matching clock time at or after the first bite, so it may cross midnight.
  - Live summary: "18:00 to 20:00, 2 h." / "23:00 to 01:30 next day, 2 h 30 min." / "With no last bite, the window stays open."
  - "Save window" checks, in order: no first bite: hint "Roll the first bite to its time."; first or last after now: "That time is still ahead.".
    - Existing window: `adjustWindow`: the first meal (started at the old first bite) moves with it, finish and fullness-check time shifted equally; meals still open end at the new last bite; a meal finishing after the new last bite but starting before it ends at the last bite; refused (hint) with "A meal is logged at HH:MM, before that time. Change or delete it first." / "… after that time. …"; also "This window no longer exists.". Clears noEating. Flash "Window saved." with Undo.
    - New window: sets firstBite, lastBite, noEating false; with a last bite, open meals of the day end at max(last bite, their start). No meal-range check. Undo covers the day and its meals. Flash "Window saved." with Undo.
    - Saving without a last bite leaves the window open (Today then treats it as open or forgotten).
  - "Clear this window" (only when a window is saved) asks inline "Clear this window?" with "Clear" / "Keep". Clear removes both times and keeps the meals; flash "Window cleared." with Undo.
- Pinned: `notes.spec.js` (clear last bite then roll back), `undo.spec.js` (Undo restores times and the moved meal), `window.spec.js`, `travel.spec.js`.

#### 3.5 Pause section
"Pause" label; "Travel, illness or Ramadan: fasting is not tracked on a paused day, and your streak holds. Fullness still counts." "Pause this day" pauses just this day with no reason (`paused: true`); flash "Day paused." with Undo, or the error flash "A window is still open on one of those days. Close it first." (`pause.spec.js`: the unlogged notice count drops, the Window section disappears, unpause leaves no record).

#### 3.6 Day off section (Sun to Thu only)
"Day off" label; "A workday: the 16:00 rule applies." or "Weekend rules apply to this day."; "Mark as a day off" / "Make it a workday again" toggles `dayOff` (no flash/undo). Day off means weekend planned start, no 16:00 rule, no energy question, left out of the energy split and workday counts.

#### 3.7 Fullness card ("Fullness شبع")
If every meal of the day has a rating (at least one meal): read-only "Left wanting at every meal." / "Satisfied at one meal or more." / "Overfull at one meal or more." Otherwise the question "How did the day's eating end?" with one choice "Left wanting" | "Satisfied" | "Overfull", saving `day.fullness` (`day-fullness.spec.js`).

#### 3.8 Meals section
"Meals" list sorted by start: title = name or "Meal"; meta = comma list of "outside the window", "hunger N", how it ended ("left wanting"/"satisfied"/"overfull"), "fullness N", "at 20 min N"; side "17:30 to 18:00" or start time only. Empty: "No meals logged." Tap a meal opens the Meal sheet: meal type, "Started" and "Finished" wheels (Finished optional, hint "Still eating"), hunger before, how it ended, fullness right after, "Fullness at 20 minutes"; "Save" (a changed time lands nearest the old moment, within 12 h; the fullness-check time is recalculated when the finish changed), flash "Meal saved." with Undo; "Delete meal" asks "Delete this meal?" Delete/Keep, flash "Meal deleted." with Undo. "Add a meal" opens Add a meal fixed to this day (today or yesterday keep the today/yesterday choice), placed by the same window rules (`add-meal.spec.js`; owned by the Add a meal area).

#### 3.9 Outside the window section
List sorted by time: "{trigger, lowercase, or 'no trigger'}{', a little' | ', more than a little' | ''}", side time as seen from the day ("22:00", "01:30 next day"). Outside-flagged meals appear under Meals, not here. Empty: "Nothing outside the window." 
- "Add eating outside the window" opens the Outside sheet: "What set it off?" (Hunger, Boredom, Social, Stress, Tired, Other; required: "Pick what set it off."), "How much" (A little / More than a little; optional), "At" wheel (starts at the current clock time). Time: for today or last night's late-night day, the latest such clock time at or before now; for a past day, before 04:00 means the night after that day, otherwise that day. After saving, the sheet shows the next-window line with "Done". Makes the day a miss.
- Tap an entry opens the edit sheet "Outside the window": "What set it off", "How much", "At"; "Save" (unchanged time keeps its moment; changed time lands nearest the old moment), flash "Entry saved." with Undo; "Delete entry" asks "Delete this entry?" Delete/Keep, flash "Entry deleted." with Undo.

#### 3.10 Check-in section
"Energy at 4 PM" 1 to 5 scale ("1 drained" … "5 sharp"), workdays only, saves `energy4pm`. "Trained" Yes/No saves `trained` (No clears `trainingType`). When Yes: "Type" Weights / Cardio / Other saves `trainingType`. No flash/undo; a rating cannot be cleared once set.

#### 3.11 Temptations section (no free-text notes exist)
List: "{trigger value or 'no trigger'}: {outcome lowercase or 'no outcome'}" (e.g. "boredom: ate a little outside the window"), side start time. Tap opens the "Temptation" sheet: "21:50, boredom"; outcome sentence ("Held", "Opened the window early", "Ate a little outside the window", "Ate outside the window") or "No outcome recorded."; "Urge ratings: 6, 4." when any; "Delete entry" asks "Delete this entry?" Delete/Keep. Delete has **no flash and no Undo**.

#### 3.12 Messages and Undo (app shell)
Flash bar above the tabs; with Undo it stays at least 10 s (others 8 s); Undo restores the remembered records and says "Undone."

## Additions from the completeness check

A second reader compared this inventory with the code, README, CLAUDE.md and tests, and found these missing or wrong. They are part of the contract too.

- CORRECTION, Day screen meal sheet: it is the shared Meal edit sheet (`edit-meal`). Its right-after rating is labelled "Fullness now", not "fullness right after"; the second rating is "Fullness at 20 minutes". The Finished wheel has a Clear button (`clear-edit-finish`) that returns the meal to still eating (finishedAt null). The sheet has no checks: a future time, an overlap or a start before the window are all accepted, and the meal's day, outside flag and window are never recalculated.
- Day screen check-in: on any workday record (Sun to Thu, not dayOff) the Energy at 4 PM scale shows at any hour, today included, with no "rate it here from 16:00" wait as on Today. It is also shown on feasting hours. The training question is labelled "Trained"; Today says "Trained today".
- Day screen Day off section: it shows for every Sun to Thu day that is not paused, past or future, even on feasting hours (Today hides its toggle on feasting hours). Toggling it re-evaluates the day at once: dayOff lifts the 16:00 rule, so an early-opening miss can turn into a success and back.
- CORRECTION, History thresholds count the days actually plotted (the range clamped to tracking start), not the chosen range. Value labels above the marks and daily "Su 20" x-labels appear whenever 7 or fewer days are plotted, for example a 30-day range with only 5 tracked days. In Line mode, square markers for ordinary days appear whenever 30 or fewer days are plotted. The aria-label also gives the plotted count.
- History selection (module-level `selected`) is replaced only when the day leaves the plotted range, by the latest day with a value. It therefore survives Fast/Feast switches and range changes even when the selected day has no value in the new metric; the readout then says "... no window recorded." or "... no fast recorded.". Open this day appears for any selected day, paused or empty ones included.
- Tab behaviour:
- The Week tab always goes to #week (the current week), even from a past week or from a Day screen.
- A week other than the current one shows no "This week" subtitle and shows "Next ›".
- The History tab always goes to #history, which shows Weight when historyMetric is 'weight'.
- Week Temptations "Count" counts every temptation record dated on a non-paused day of the week. That includes undecided ones and a trigger-less record left when the app was closed on the first step. "Held" counts only decided records, and "Top triggers" skips null triggers.
- Day editor Save window refuses a first or last bite strictly after now ("That time is still ahead."), with no 1-minute tolerance, unlike the Today sheets. The editor's first bite always falls on the day itself (at(key, minutes)), so a window starting after midnight cannot be entered there; the last bite rolls onto the next day when its clock time is earlier than the first bite's.

## Open questions found while cataloguing

- The task mentions 'notes' on the Day screen, but there is no free-text notes field anywhere in the day record or the UI. Temptations are the only per-day entries that read like notes, and they can only be viewed and deleted on the Day screen, not edited.
- Quirk: a future day evaluates to 'none', so the Day screen's result line reads 'Before tracking started.' just above 'This day has not started yet.'. It is unclear whether the new app should keep this.
- Quirk: the Day off text reads 'A workday: the 16:00 rule applies.' even when flexible timing (Feasting hours) is on and the rule does not apply.
- Quirk: once 'Log this day's window' is tapped there is no cancel. The draft stays in editing mode, and 'No eating this day' stays hidden until the saved record changes.
- Quirk: the first-bite wheel shows the planned start as a fallback that is not a value. To save exactly the planned time you must roll away and back, because settling on the same value does not commit it.
- Inconsistent undo: deleting a temptation gives no flash and no Undo, and neither do the no-eating, day-off and check-in changes, while window, pause, meal and outside changes all have Undo. I could not tell whether this is intended.
- weekReview computes satiety figures (meals, rated, beforeFull share, avg rise, avg at 20 min, leftWantingDays) that no screen uses. Keep them only if the new design wants them.
- History's summary line ('From N of the last 30 days.') uses the chosen range, even when tracking started more recently and fewer days are shown.
- History keeps the selected day (module-level) and the table toggle (app.ui.showHistoryTable) for the whole app session, while the legend focus resets when you leave the route. I could not tell whether this asymmetry is deliberate.
- Week and History redraw only on data, route, day or window-open changes, so an open window's bar on Week does not grow minute by minute. I did not check whether that matters.
- I did not inventory in full the Add a meal sheet (placeAddedMeal rules), the Meal edit sheet's meal-type section, the scale widgets or the Weight view of History. They are only summarised here because they belong to other areas.
