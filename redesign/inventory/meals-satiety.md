## Meals and satiety

How meals are logged (started live, finished, added afterwards, eaten outside the window, edited), the 20-minute fullness check and its alarm, the rating scales, how a day's fullness is decided, and the Satiety tab. Everything below is current behaviour, read from the code and pinned by tests. Styling is left out.

### 0. Source map

| Concern | Code | Tests that pin it |
|---|---|---|
| Start a meal, Finished this meal, I'm done eating, 20-min check sheet, Add a meal sheet, Meal edit sheet, meal-type picker | `docs/js/ui/meal.js` | `tests/e2e/meals.spec.js`, `add-meal.spec.js`, `window.spec.js`, `week-more.spec.js` (alarms), `undo.spec.js`, `notes.spec.js`, `adjust.spec.js` |
| Where an added meal goes | `docs/js/core/added-meal.js` (`placeAddedMeal`) | `tests/unit/added-meal.test.js`, `add-meal.spec.js` |
| Meal types | `docs/js/core/meal-types.js` | `tests/unit/meal-types.test.js`, `meals.spec.js` |
| Day fullness rule | `docs/js/core/fullness.js`, card in `docs/js/ui/fullness.js` | `tests/unit/goals.test.js` (lines 150-160), `tests/e2e/day-fullness.spec.js` |
| Satiety numbers | `docs/js/core/satiety.js` (`satietyStats`) | `tests/unit/satiety.test.js`, `satiety.spec.js` |
| Findings | `docs/js/core/insights.js` | `tests/unit/insights.test.js` |
| Satiety tab | `docs/js/ui/satiety.js` | `tests/e2e/satiety.spec.js` |
| Eating outside the window ("I ate something") | `docs/js/ui/outside.js`; edit sheet in `docs/js/ui/day.js` (`showOutsideEditSheet`) | `window.spec.js`, `temptation.spec.js` (slip line), `screens.spec.js` |
| Alarms | `docs/js/ui/alarm.js`; switch in `docs/js/ui/more.js` (`alarmSection`) | `week-more.spec.js`, `add-meal.spec.js` |
| Store writes | `docs/js/store.js` (`startMealAs`, `finishMeal`, `fullnessDueAt`, `addFinishedMeal`, `updateMeal`, `deleteMeal`, `addOutside`, `updateOutside`, `deleteOutside`, `setDayFullness`, `closeWindow`/`finishOpenMeals`, `undoPoint`) | as above |
| Queries | `docs/js/ui/shared.js` (`mealsOfDay`, `mealInProgress`, `dueFullness`, `runningFullness`, `nextWindowLine`) | |
| Auto-open of the due check | `docs/js/app.js` (`prompts`, `tick`, `visibilitychange`) | `window.spec.js` ("the 20-minute fullness timer survives closing the app") |
| Rules used (16:00 cutoff, late night, reopen, forgot) | `docs/js/core/rules.js` | `rules.test.js` and others |

### 1. Data model

**IndexedDB** (db `fast`, version 1, `docs/js/db.js`): store `meals` (keyPath `id`, auto-increment, index `day`), store `outside` (same), store `days` (keyPath `day`), store `settings` (keyPath `key`). All data stays on the device.

**Meal record** (`meals` store):
- `id`: auto number.
- `day`: `'YYYY-MM-DD'`. The day of the window the meal belongs to, which can differ from the calendar day of `startedAt` (a meal after midnight inside last night's window keeps last night's day).
- `name`: string. `''` when unnamed, `'Snack'|'Breakfast'|'Lunch'|'Dinner'`, or any name typed under Other (trimmed, at most 60 characters).
- `startedAt`: ms, floored to the minute.
- `finishedAt`: ms or `null` while the meal is still being eaten.
- `hungerBefore`: 1-10 or `null`.
- `stop`: how the meal ended, `'before_full'` (left wanting, the goal), `'full'` (satisfied), `'stuffed'` (overfull), or `null`.
- `fullnessNow`: 1-10 or `null` (fullness right after).
- `fullness20DueAt`: ms or `null`. When the 20-minute check falls due.
- `fullness20`: 1-10 or `null`.
- `fullness20Skipped`: bool.
- `fullness20At`: ms. When the check was answered: `now` from the check sheet, or `finishedAt + 20 min` for a meal added with its 20-minute reading. Absent otherwise.
- `outside: true`: present only when the meal was eaten outside its window. The key is absent otherwise (a test asserts `outside` is `undefined` for a normal added meal).

**Outside-the-window entry** (`outside` store): `{ id, day, at (ms, floored), trigger: 'hunger'|'boredom'|'social'|'stress'|'tired'|'other'|null, amount: 'little'|'meal'|null, source: 'today'|'temptation' }`.

**Day record fields this area touches**: `firstBite`, `lastBite`, `noEating` (meals open, extend or close windows) and `fullness: 'before_full'|'full'|'stuffed'`, the day's own rating.

**Settings**: `alarms` (bool, default `false`) and `satietyView` (`'insights'|'now'|'meals'`, default `insights` when missing or invalid).

**Session-only state** (`app.ui`, not saved): `showSatietyTable` (default false), `satietyFocus` (null or a stop value; reset whenever the route changes). The in-memory `prompted` set stops the same due check from auto-opening twice in a session. Entries starting with `f` are cleared each time the app becomes visible again.

**Constants**: `FULLNESS_DELAY` = 20 min. A check is only scheduled if `now - (finish + 20 min) <= 15 min`. A due check stays listed for 6 h. Comfortable zone `ZONE = [6, 8]`, target "about 7". Findings need 10 rated meals, 4 meals on each side of a comparison and 3 twenty-minute readings on each side. Added meals last at most 12 h. The workday cutoff `CUTOFF_MIN` is 16:00. The late night (`LATE_NIGHT_END_MIN`) runs 00:00-04:00. `FORGOT_AFTER_MS` is 2 h past the goal. Grace is 15 min.

**Undo**: every Undo puts back a snapshot of the records involved, in one transaction. The flash bar above the tabs shows for 8 s, or at least 10 s when it offers Undo. After Undo the bar says "Undone.".

**Writes that ignore deleted records**: `updateMeal` and `updateOutside` do nothing if the record no longer exists. A sheet left open after a delete never writes a half-empty record back.

### 2. Meal types (`core/meal-types.js`, `mealTypeSection` in `ui/meal.js`)

- The choices are, in this order: **Snack, Breakfast, Lunch, Dinner, Other** (`MEAL_TYPES` order is pinned by a test). The label is "Meal".
- **Guess from the start time** (`guessMealType(minutes)`): Breakfast from 05:00 to before 11:00, Lunch from 11:00 to before 16:00, Dinner from 16:00 to before 22:00, Snack from 22:00 through 04:59. Boundaries are pinned: 04:59 Snack, 05:00 Breakfast, 10:59 Breakfast, 11:00 Lunch, 15:59 Lunch, 16:00 Dinner, 21:59 Dinner, 22:00 Snack, 00:30 Snack.
- The guess applies only until the person taps a choice. While untapped, it follows every change of start time (wheel or quick time). Once tapped, the choice stays whatever the time. The guess runs in Start a meal and Add a meal, not in the edit sheet.
- **The choice is saved as the meal's `name`.** The guessed type is saved even if never tapped: at 18:00 an untouched sheet saves `name: 'Dinner'`.
- **Other** shows a text field labelled "Name" (placeholder "Dessert", trimmed, at most 60 characters). The field appears only under Other. Below it, up to 3 one-tap shortcuts: names typed under Other before, most used first. Tapping one fills the field.
- **Reading a stored name back** (`typeOfName`): it is trimmed and matched case-insensitively to the four types, so `' dinner '` reads as Dinner. Any other text reads as `'other'` with the text in the field. An empty name reads as no choice. Older free-typed meals therefore open correctly in the edit sheet (pinned in `meals.spec.js`).
- Display fallbacks for an unnamed meal: "A meal" in the Now check list, "a meal" in the Eating line and the overlap error, "Meal" in the meal lists, "This meal" in the Finish sheet heading, "your meal" in the check sheet heading, "Your meal" in the Today pointer, "this meal" in "Finish this meal" on I'm done eating.
- In the CSV export each meal has a type column (Snack/Breakfast/Lunch/Dinner/Other) and a name column.

### 3. Rating scales and "How did you finish?"

- **Hunger before**: a 1-10 single-pick rating, labelled "Hunger before", with ends "1 not hungry" and "10 very hungry".
- **Fullness**: a 1-10 single-pick rating with ends "1 empty" and "10 stuffed". Its label depends on the sheet:
  - "Fullness now": the Finish sheet, the I'm done eating sheet, the edit sheet (right-after value), and the 20-minute check sheet (where it stores `fullness20`).
  - "Fullness right after" and "Fullness at 20 minutes": the Add a meal sheet.
  - "Fullness at 20 minutes": the edit sheet's second rating.
- **How did you finish?** (`STOP_OPTIONS`): three options, "Left wanting" (`before_full`, the goal), "Satisfied" (`full`), "Overfull" (`stuffed`).
  - Lower-case words used in sentences (`STOP_TEXT` / `FULLNESS_WORD`): "left wanting", "satisfied", "overfull".
  - The stored values must stay `before_full`/`full`/`stuffed` so older data and backups still read.
- No sheet requires any rating except the 20-minute check sheet, which needs a number.
- Owner decision: every choice and rating is a sliding track with a pill under the chosen option. You can tap an option or drag the pill. Reduce Motion stops the glide.

### 4. Where meal actions appear

| Place / state | Actions |
|---|---|
| Today, **before** the window (no window today) | **Start a meal** (main). **Add a meal** under it. If there is no last bite on record, Begin fast sits beside Start a meal. If it is 00:00-04:00, today has no window and yesterday's window is closed: **"Eating late? Count it against last night"** (opens the outside sheet for yesterday). |
| Today, **window open** | If a meal is in progress: "Eating: {name}, since HH:MM." with **Finished this meal** and **Start another meal**. Otherwise **Start a meal**. Always **Add a meal**, **I'm done eating** (the main button between meals; outlined while eating) and Change opening time. |
| Today, **forgot** (open window 2 h past its goal) | Only the last-bite question and Close the window. No meal buttons. |
| Today, **window closed** | If a meal started after closing is still being eaten: "Eating outside the window: {name}, since HH:MM." with **Finished this meal**; Add a meal and Start a meal are hidden. Otherwise **Add a meal**, then **Start a meal**. Always **I ate something** and Change times. |
| Today, **paused** | Only **Add a meal** (meals still count for Satiety). |
| Today, **no eating** | Undo only. |
| Today, a 20-minute check timer is running | A "Fullness check" pointer card with a **Satiety** button (section 9). |
| Satiety tab, every view | **Add a meal** at the top. The Now view has **Score my fullness now** and **Finished this meal**. The Meals view: tap a meal to edit it. |
| Day view (Week, tap a day), past and not paused | Meals list (tap to edit), **Add a meal** for that day, an "Outside the window" list (tap to edit) and **Add eating outside the window**. |
| Last bite pill on Today, when the latest eating is a meal | Opens the meal edit sheet with the **Just now** chip. |
| Tempted flow | "Open now" leads to Start a meal. "Ate outside" writes an outside entry with `source: 'temptation'` (owned by the Tempted area). |

Today must **not** show a meal list or the day-fullness card. A test asserts `[data-block="meals"]` and `[data-block="fullness"]` are absent on Today. These live on Satiety and in the Day view.

### 5. Start a meal sheet (`showStartMealSheet`)

**One meal at a time.** If the situation's window day already has a meal in progress, the Finish sheet opens instead, with the lead line "One meal at a time. First, how did this one finish?". After that sheet is saved, Start a meal opens.

**Situation** (`mealSituation`, worked out from Today's mode):
- `open`: the window is open, or in forgot mode. The meal joins it.
- `reopen`: the window is closed and `now - firstBite < goal` (`canReopen`). The meal reopens the window: `lastBite` is set back to null.
- `outside`: the window is closed and its goal hours are over. The meal is stored with `outside: true` on that window's day, the window is unchanged, and the day becomes a miss (outside meals count as outside events).
- `first`: no window. The meal opens a window at its start, on the calendar day of its start.
- Just after midnight, if last night's closed window can still reopen, Today's mode is "closed" with last night's record, so Start a meal reopens last night's window.

**Contents, in order:**
1. Header "Start a meal".
2. Context line (`meal-context`):
   - first: "Your first meal opens the window."
   - reopen: "This reopens your window from HH:MM."
   - outside: "Your window closed at HH:MM and its hours are over, so this meal counts as eating outside it and the day becomes a miss."
   - open: no line (empty).
3. Eating reminders, three statements: "Protein and vegetables first." "Eat slowly." "Pause halfway."
4. Quick times: **Now**, **30 min ago**, **1 h ago**, **2 h ago**. Each sets the start to `floor(now - n min)` and moves the wheel.
5. "Started at" 24-hour time wheel. It defaults to now.
6. "That time is still ahead." under the wheel when the time cannot be placed.
7. Warning (`meal-warning`), shown only for kind `first` when the 16:00 rule applies to that day (a workday that is not a day off, on fixed timing) and the start is before 16:00: "Before 16:00 on a workday: today will count as a miss." Otherwise hidden.
8. The meal-type picker.
9. Hunger before.
10. Hint line (`meal-hint`) for refusals.
11. **Start eating** (primary).
12. **Already finished? Add a meal** (outlined).

**Wheel time resolution** (`resolveFirstBite(todayKey, minutes)`):
- Today at that clock time if it is no more than 1 minute ahead of now.
- Otherwise, if now is before 04:00 and yesterday at that time was less than 6 h ago, yesterday.
- Otherwise the time is invalid ("That time is still ahead.").

**Save checks**, re-run against the situation at save time:
- No time, or more than 1 min ahead: "That time is still ahead."
- open/reopen with a start before the window's first bite: "Your window opened at HH:MM. A meal in it starts after that."
- outside with a start before the window's last bite: "Your window closed at HH:MM. Pick a later time, or change the window's times."
- Store refusal for kind first when that day already has a window: "{Weekday D Month} already has a window. Pick a later time."

**On save** (one transaction):
- The meal record is written with all ratings null, `fullness20Skipped: false`, plus `outside: true` for kind outside.
- For first, the day record gets `firstBite = start`, `lastBite: null`, `noEating: false`. For reopen, `lastBite: null`.
- The sheet closes. Flash: "Window open from HH:MM." (first) or "Meal started at HH:MM." (others), with Undo. Undo removes the meal and restores the day record, so for first both the meal and the window go (pinned).
- **No timer or alarm starts when a meal starts** (owner decision, pinned).

**Already finished?** opens Add a meal and passes on:
- the meal-type pick and Other text;
- hunger;
- the start time, only if the person moved it and it is more than 1 minute before now. A start left at now would make a zero-length meal, so Add a meal then uses its own default.

### 6. Eating-now block (Today and Satiety, Now view)

- Today: "Eating: {name or 'a meal'}, since HH:MM." or "Eating outside the window: …" for an outside meal, with **Finished this meal**. In an open window it also has **Start another meal**.
- Satiety, Now view: "Eating: {name}, since HH:MM." with **Finished this meal**.
- Owner decision (`fastFirst`): while a meal started after closing is still being eaten, the closed window's card, with Finished this meal, stays at the top of Today. Once it is finished, the new fast leads again.

### 7. Finished this meal sheet (`showFinishMealSheet`)

- Header "Finished this meal". The optional lead line (`finish-lead`) comes next, then the heading: the meal's name or "This meal".
- Then "How did you finish?", "Fullness now" (1-10) and a "Finished at" wheel defaulting to the time the sheet opened. **Save**.
- Finish time = `min(first time at or after startedAt with that clock time, now)`. A time before the start rolls to the next day, and the cap then makes it now.
- Writes `finishedAt`, `stop`, `fullnessNow` (both may be null) and `fullness20DueAt = fullnessDueAt(finishedAt)`: finish + 20 min, or null if that moment is more than 15 min past.
- Flash: "Fullness check at HH:MM." (finish + 20 min, shown even when no check was scheduled). No Undo.
- Alarm: `ringIn((finish + 20 min - now) / 1 min)` (section 10).
- If the meal was deleted meanwhile, the sheet reads "Finished" / "This meal was removed."

### 8. Meals finished by closing the window

- **I'm done eating** sheet (header "I'm done eating"):
  - If a meal is open: "Finish {name or 'this meal'}", "How did you finish?" and "Fullness now".
  - Then a "Last bite at" wheel (default now) and a live summary "Window HH:MM to HH:MM, X h Y min." or "That time is still ahead.". **Close the window** is disabled while the time is ahead.
  - On close the open meal is finished at `max(lastBite, startedAt)` through `finishMeal`, so its 20-minute check is scheduled the normal way. Then the window closes.
  - No flash, no Undo, and **no alarm** (see Gaps).
  - With no window: "No window is open."
- **Any meal still open when a window closes** (`closeWindow`, the forgot close, setting window times) ends at the last bite with **no 20-minute check**.
- The forgot block's wheel suggests the latest of the first bite and each of that day's meals' `finishedAt` (or `startedAt`), if that is later than the first bite. Otherwise it is unset, with the hint "Roll to your last bite.".

### 9. The 20-minute fullness check

**Scheduling**:
- Set by Finished this meal and I'm done eating (`finishMeal`), by Add a meal when the 20-minute reading is left blank, and by the edit sheet when the finish time changes.
- `fullness20DueAt = finish + 20 min`, unless now is more than 15 min past that moment, in which case it is null and no prompt is shown (the reading can still be entered by editing the meal).

**Queries**:
- *Due*: `fullness20DueAt <= now`, less than 6 h ago, `fullness20 == null`, not skipped. Sorted oldest due first.
- *Running*: `fullness20DueAt > now`, unanswered, not skipped.

**Auto-open** (`prompts` in app.js):
- Every second, when no sheet is open and no text input is focused, an unfinished temptation is handled first.
- Otherwise the first due check not yet prompted this session opens the check sheet by itself.
- Each check auto-opens once per session. Returning to the app clears that memory, so an unanswered due check opens again on every return until it is answered, skipped or 6 h past due.
- The check survives reloads and closing the app (pinned: after a reload past the due time the sheet opens).

**Check sheet** (`showFullnessSheet`, name `fullness`):
- Header "Fullness check". The close button is labelled **Later** and only closes the sheet.
- Heading "20 minutes after {name or 'your meal'}".
- Line: "Right after eating: {fullnessNow}. Target about 7." or just "Target about 7.".
- A "Fullness now" rating (1-10), then **Save** and **Skip this one**.
  - Save with nothing picked shows "Pick a number from 1 to 10.". Save writes `fullness20` and `fullness20At = now`, with no flash.
  - Skip writes `fullness20Skipped: true`.
- If the meal was removed: "This meal was removed."

**Satiety, Now view, "Fullness check" section**: every due check, then every running one. Each reads "{name or 'A meal'}, finished HH:MM. " plus live text "Check in X min." (or "X h Y min") or "Time to score it.", with **Score my fullness now**. That button opens the check sheet, even before the check is due. With none: "No check waiting. Finish a meal and its 20-minute check appears here."

**Today pointer** (`satiety-pointer`):
- Shown only while a check is **running** (not once it is due), for the first running check.
- Label "Fullness check", live text "{name or 'Your meal'}: check in X." / "…: time to score it.", and a **Satiety** button that opens the Satiety tab.
- Placement: above the Fasting card when the new fast leads Today; otherwise right after the main card. Today redraws when the number of running checks changes.

### 10. Alarms (`ui/alarm.js`, More, Alarms)

- A web app cannot ring while closed. With Alarms on, Fast opens `shortcuts://run-shortcut?name=Fast%20Timer&input=text&text={N}`, where N = `max(1, round(minutes))`. The person's own Shortcut, "Fast Timer", starts an iPhone Clock timer.
- `ringIn` does nothing when Alarms is off or minutes ≤ 0.
- Tests record the address in `window.__fastOpened` instead of navigating. Pinned values are `text=20` after Finished this meal and `text=15` for an added meal whose check is 15 min ahead.
- **Only one kind of timer** (owner decision):
  - The 20-minute fullness check when a meal is finished, the day's first meal included.
  - Starting a meal never starts a timer.
  - Add a meal starts one only when its check is still ahead.
  - There is no timer for the window closing.
- More, Alarms copy:
  - "Fast cannot ring while it is closed. With Alarms on, it asks your Fast Timer shortcut to start an iPhone timer when you finish a meal, for the 20-minute fullness check. The Shortcuts app opens for a moment each time."
  - An On/Off choice.
  - "Build the shortcut once: in Shortcuts, tap +, name it Fast Timer, add the action Start Timer, tap its duration, choose Shortcut Input, and set it to minutes. Then tap Done."

### 11. Add a meal (`showAddMealSheet`, `placeAddedMeal`)

A meal already eaten, added whole, with no live timer. Entry points: Today in every state except forgot and no-eating, the top of Satiety, Day view meals (with that day), and Already finished? in Start a meal. Owner decision: Start a meal, Finished this meal and the automatic 20-minute check stay exactly as they are.

**Contents, in order:**
1. Header "Add a meal", then "For a meal you already ate. No timer."
2. Day:
   - From a Day view day that is neither today nor yesterday, the date is fixed and shown as text, e.g. "Thursday 24 September" (`add-meal-day`).
   - Otherwise a **Today / Yesterday** choice. Changing it keeps the clock time and redraws.
3. Start: quick times **30 min ago / 1 h ago / 2 h ago** (only when the day is today; a quick time that lands on another calendar day switches the day), then a "Started at" wheel and "That time is still ahead." when it is.
4. "How long it took": **15 min / 30 min / 45 min / 1 h**, then a "Finished at" wheel and a refusal note (`add-meal-finish-note`).
5. The meal-type picker (guess from the start time).
6. Hunger before; How did you finish?; Fullness right after; Fullness at 20 minutes.
7. "Last meal of the day?" **Yes / No**, shown only when the placement is valid and `canClose`.
8. Effect sentence (`add-meal-effect`).
9. Miss lines (`add-meal-miss`, shown as clay statements).
10. Hint (`add-meal-hint`).
11. **Save meal**.

**Default start** (`defaultStart`):
1. The start handed over by Start a meal, if any. It is used as is.
2. Otherwise, for an earlier day: the latest `finishedAt` of that day's meals, else its first bite, else its planned start (the workday or weekend time).
3. Otherwise now minus 1 h, floored.
4. Then, unless the start was handed over, it steps clear of logged meals: while any meal overlaps the half hour from the start (an unfinished meal counts as running to now), the start moves to that meal's end, or to 30 min before an unfinished meal's start.

The default length is 30 min. The day is the given day, or the calendar day of the default start.

**Start time**:
- The day at the wheel's clock time, with one exception for times before 04:00.
- If the day has a first bite later than that time, the same clock time on the **next** calendar day is used, provided it is no more than 1 min ahead of now and it is "that night's" time. That means: inside the closed window (≤ last bite), or now is before 04:00 and it is within the goal from the first bite; for an open window, within the goal.
- Otherwise it is that day's morning. Pinned: 00:10 on a window running 21:00 to 01:00 next day goes into that window; 00:30 on a day whose window starts 13:00 is that morning, so "Yesterday's window becomes 00:30 to 19:00, 18 h 30 min.".

**Finish time** = `min(start + length, max(start, now))`. A meal never ends after now: ten minutes ago with a 1 h length ends now (pinned).

**Finished at wheel**: length = the first time at or after the start with that clock time, minus the start. The note reads:
- "That is before the meal started." when the length exceeds 12 h and the wheel's time is earlier than the start's clock time.
- "A meal lasts at most 12 hours." when it exceeds 12 h otherwise.
- "That time is still ahead." when start + length is more than 1 min past now.
- Nothing otherwise.

A refused finish keeps the last accepted length. Moving the start or tapping a length clears the refusal and resets the finish wheel (pinned). The hour is taken first, then the minute (pinned).

**Last meal of the day?**
- Unanswered, it reads **Yes** only when the day is before today and now is at least goal + 2 h past the window's opening (the earlier of the start and the existing first bite). That is the point at which Today would ask for the last bite. Otherwise it reads **No**.
- Pinned: a past day with no window defaults to Yes. Today, or last night's open window still inside its goal at 00:30, defaults to No.

**Placement** (`placeAddedMeal`, pure):
1. **Overlap**: any meal on any day with `startedAt < finish` and `(finishedAt or max(now, startedAt)) > start`. An unfinished meal runs to now. Back to back is allowed. Result: error `overlap`.
2. **Home day** (`homeDay`):
   - An open window takes the meal if the start is at or after its first bite and less than goal + 2 h after it.
   - Otherwise last night's closed window takes it if the start falls between its first and last bite.
   - Otherwise, if the start is before 04:00, last night's window is less than its goal old, and today has no window (or today's first bite comes after the start), last night takes it.
   - Otherwise the calendar day of the start.
3. **Another day's window still open** with its first bite at or before the start: error `open`. An earlier day can still take its own meal while a later window is open (pinned).
4. **Kind**:
   - `paused`: the day is paused. Satiety only; the window is unchanged.
   - `first`: no window. The window opens at the start, and if Last = yes `lastBite = finish`. `noEating` is cleared and `wasNoEating` reported. The rest of the record (e.g. `dayOff`) stays. `canClose` is true.
   - `earlier`: the start is before the first bite. The first bite becomes the start, and a closed window's last bite becomes `max(lastBite, finish)`.
   - `inside` (open window): `canClose` only if every meal of that day is finished. With Last = yes, `lastBite` = the latest of this finish and every other meal's finish. Otherwise the window is unchanged.
   - `inside` (closed window, start ≤ last bite): a finish after the last bite moves the last bite to the finish. Otherwise unchanged.
   - `extend`: the start is after the last bite but less than the goal after the first bite. `lastBite = finish`.
   - `outside`: later than that. The meal gets `outside: true` and the window is unchanged. It is a miss.

**Effect sentences** (window name = "Your window" for today, "Yesterday's window", or "The window on Thu 24 Sep"; span = "HH:MM to {HH:MM | HH:MM next day | HH:MM Fri 25 Sep}, {X h Y min}"):
- paused: "This day is paused, so the meal counts for Satiety only."
- first, Last = yes: "{Name}: {span}." Last = no: "This meal opens {name, lower-case first letter} at HH:MM." A no-eating day adds " It replaces the day without eating."
- earlier: "{Name} becomes {span}." when closed, else "{Name} now opens at HH:MM."
- extend: "{Name} becomes {span}."
- outside: "{Name} closed at {last bite} and its hours were over, so this meal counts as eating outside it."
- inside: "{Name} becomes {span}." if it changes a closed window, else "This meal goes in {name, lower-case}." (e.g. "This meal goes in your window.", "This meal goes in yesterday's window.")
- Overlap error: "That overlaps {name or 'a meal'} from {HH:MM [yesterday | Fri 25 Sep]} to HH:MM. Change the time, or edit that meal." For an unfinished meal: "… since HH:MM …".
- Open error: "Your window from {time} is still open. Close it on Today first."

**Miss lines**: only reasons the day did not already have, from evaluating the day before and after the meal:
- early: "Opening before 16:00 on a workday makes the day a miss."
- over: "That is longer than your {N}-hour goal, so the day becomes a miss."
- outside: "Eating outside the window makes the day a miss."

**Save**:
- Refuses with the hint "That time is still ahead." (start more than 1 min ahead), the finish refusal, or the placement error.
- Otherwise one transaction writes the day record (if it changes) and the meal:
  - `fullness20DueAt = fullnessDueAt(end)` when Fullness at 20 minutes is blank, else null;
  - `fullness20At = end + 20 min` when the 20-minute reading is given;
  - `outside: true` for kind outside.
- The sheet closes.
- If a check is scheduled, `ringIn(due - now)`; nothing rings if it is already past.
- Flash: "Meal saved. Fullness check at HH:MM." when the check is still ahead, else "Meal saved.", with Undo (meal removed, day record restored; pinned).

### 12. I ate something (eating outside the window)

**Sheet** (`showOutsideSheet`, name `outside`):
- Opened from: **I ate something** on a closed window (that window's day); **Eating late? Count it against last night** (yesterday); **Add eating outside the window** in the Day view (that day).
- Contents:
  - Header "Outside the window".
  - "What set it off?" with six choices: Hunger, Boredom, Social, Stress, Tired, Other.
  - "How much": "A little" (`little`) or "More than a little" (`meal`), optional.
  - An "At" wheel defaulting to now.
  - **Save**.
- A trigger is required: "Pick what set it off.".
- Time (`outsideTime`):
  - For today, or last night during the late night: the most recent moment at or before now with that clock time (it can fall on yesterday).
  - For a past day: that day, except that times before 04:00 fall on the next calendar day (the night after it).
- Writes the outside entry with `source: 'today'`. No flash, no Undo.
- The sheet is then replaced by the slip line: header "Outside the window", one statement (`slip-line`) from `nextWindowLine`, and **Done**. The statement is one of:
  - "Tomorrow's window opens at 17:30." / "Today's window opens at 17:30."
  - on flexible timing: "Tomorrow: a 4-hour window, opened whenever you choose."
  - on a long fast: "Your 48-hour fast reaches its goal at …"
- Copy principle: recorded without judgment, with only one line pointing to the next window.

**Effect**: each entry is an outside event for its day, so the day is a miss ("Ate outside the window."). Meals with `outside: true` count the same way.

**Day view list**:
- Each entry reads "{trigger lower-case or 'no trigger'}{', a little' | ', more than a little'}", with the time on the right ("HH:MM", "HH:MM next day" or "HH:MM Fri 25 Sep"). Empty: "Nothing outside the window."
- Tapping an entry opens the edit sheet: "What set it off" (not required here), "How much", "At".
  - Save keeps the exact moment when the time is unchanged; otherwise it takes the nearest moment with that clock time within ±1 day. Flash "Entry saved." with Undo.
  - **Delete entry** asks "Delete this entry?" with Delete / Keep. Flash "Entry deleted." with Undo.
- Editing an entry's time from Last bite on Today is in `window-times.js` (outside the scope of this area).

### 13. Meal edit sheet (`showMealEditSheet`, name `edit-meal`)

- Opened from Satiety Meals, the Day view meals list, or Last bite on Today when the latest eating is a meal (adds **Just now**).
- Header "Meal". Then the meal-type picker (no guess), and side by side a "Started" wheel and a "Finished" wheel.
  - The Finished wheel can be unset: it then shows the start time quietly with the hint "Still eating", and a **Clear** button sets it back to unset.
  - With Just now, a chip "Just now" (clock glyph) sits under the Finished wheel and sets the finish to this minute.
- Then Hunger before, How did you finish?, Fullness now, Fullness at 20 minutes, **Save** and **Delete meal**.
- **Save rules**:
  - Start: an unchanged clock time keeps the exact moment; a changed one takes the nearest moment within ±1 day of the old start.
  - Finish: Just now uses the exact minute; an unchanged clock time keeps the old moment; a changed one takes the first moment at or after the new start; unset means null (back to still eating).
  - `fullness20DueAt`: unchanged if the finish is unchanged, otherwise `fullnessDueAt(new finish)` (or null).
  - All other fields are saved as edited.
  - Flash "Meal saved." with Undo.
- **Delete meal** asks "Delete this meal?" with **Delete** / **Keep**. Flash "Meal deleted." with Undo (pinned).
- Owner decision: Just now on Last bite always moves the last bite to this minute, even when that makes the day a miss.
- The edit sheet does not change the meal's `day`, its `outside` flag or the window, and does not start an alarm.

### 14. Day fullness

**Rule** (`dayFullness(meals, rec)`, owner-confirmed twice; propose no alternatives):
- Take every meal's `stop` plus the day's own `rec.fullness`.
- No ratings at all: null.
- Any overfull: overfull. Else any satisfied: satisfied.
- Else left wanting, but only if every meal is rated or the day has its own rating. If a meal is unrated and the day has no rating of its own: null.
- Pinned cases: [lw, lw] gives lw; [lw, full] gives full; [stuffed, full] gives stuffed; [lw, unrated] gives null; [lw, unrated] with day lw gives lw; no meals with day full gives full; nothing gives null.

**Card** (`fullnessCard`, label "Fullness شبع"):
- If the day has at least one meal and every meal is rated, a statement (`day-fullness`):
  - "Left wanting at every meal."
  - "Satisfied at one meal or more."
  - "Overfull at one meal or more."
- Otherwise a question with the three-way choice (Left wanting / Satisfied / Overfull), saved at once to `rec.fullness`. The question is "How did you finish eating today?" in Satiety, Now, and "How did the day's eating end?" in the Day view.
- Shown:
  - always in Satiety, Now, for the open/forgot/closed window's day, else today;
  - in the Day view for past days that are paused, have a window, or have meals.
- Fullness counts on every day, paused days included (pinned: a paused today can be rated).

**Uses**:
- The gold dot on the week row and in the Week schedule means **left wanting only** (`dayFullness === 'before_full'`), with legend item "Left wanting" and aria text "…, left wanting".
- The week review counts left-wanting days.
- The windows CSV writes the day's fullness word.

### 15. Satiety tab (`ui/satiety.js`)

The tabs are Today, Week, Satiety, History, More (pinned).

**Top section**:
- Screen header "Satiety" (with "Tempted?" when no window is open and the day is not paused, and the away-zone note when travelling).
- Heading "Satiety".
- Summary line: "{n} rated meal(s); {d} with the 20-minute check." or, with no rated meals, "How your meals end, and what 20 minutes changes."
- View choice **Insights / Now / Meals**. It opens on the last used view, saved in `settings.satietyView`; the default is Insights (pinned).
- A focus line when filtered (not in Now): "Charts and meals show {left wanting|satisfied|overfull} only." with **Show all**.
- **Add a meal** (outlined).

**Visual encoding of a way of finishing** (must stay distinguishable without colour):
- Left wanting = triangle, Satisfied = square, Overfull = diamond, each with its own colour.
- An unrated meal is a hollow circle.

**Insights view**:
- With no rated meal: "Your insights start with your first rated meal. Finish a meal and rate how it ended, then answer the fullness check 20 minutes later."
- Otherwise, in this order:

1. **Four tiles.**

| Tile | Value | Note |
|---|---|---|
| Satiety drift | the signed mean of (20-min reading minus right-after reading) over completed meals, e.g. "+1.3 pts" (one decimal, "+" or U+2212 "−", no sign for 0); "not yet" if none | none: "Needs a meal with both fullness readings."; drift ≥ 1.5: "Fullness keeps climbing after you stop. Stopping earlier would still land you satisfied."; else "How much fullness rises in the 20 minutes after a meal." |
| Landed in zone | "{completed meals with a 20-min reading of 6 to 8} of {completed}" | "Meals that ended between 6 and 8 out of 10." |
| Meals complete | "{completed} of {all meals}" | "Every meal has both readings." or "{n} still missing the 20-minute check." |
| Stopped past full | round(overfull / rated × 100)% | "Share of rated meals that ended overfull." or, with none, "You have not ended a meal overfull." |

   "Completed" means `fullnessNow` and `fullness20` are both set, whether or not the meal is rated. Pinned with the seed data: "+1.3 pts", "2 of 3", "3 of 4", "25%".

2. **Where you land.**
   - Lead: the mean 20-min reading over the plotted meals, "X.X of 10".
   - Copy: "Average fullness 20 minutes after a meal, over the meals below. Each point is one meal; the shaded band is your comfortable zone, and the shape and colour show how the meal ended."
   - Chart: the last 30 completed meals, oldest to latest, evenly spaced (a single point is centred).
     - y axis 1-10 with grid at 1, 4, 7 and 10; a band from 5.5 to 8.5 (the zone, 6 to 8); a faint line joining meal to meal.
     - Each point is the meal's mark; an unrated meal is a hollow circle.
     - Captions "{n} meals ago" and "latest". aria-label "Fullness 20 minutes after each of your last {n} meals, on a scale of 1 to 10."
   - Legend: "Left wanting", "Satisfied", "Overfull" (tappable), "Comfortable zone, 6 to 8", "Meal to meal" (pinned).
   - Empty: "Answer one fullness check and your first point appears here."
3. **The 20-minute lag.**
   - Lead: the drift, "+X.X pts".
   - Copy: "The average rise in fullness over the 20 minutes after a meal. Below, by how you stopped: fullness right after and 20 minutes later. The steeper the line, the more your body was still catching up; the figure on the right is the rise."
   - Chart: one line per way of finishing that has completed rated meals, from the mean right-after reading (column "right after") to the mean 20-min reading (column "after 20 min").
     - Marks at both ends. Left label: mark + "X.X". Right label: mark + "Y.Y +Z.Z" (the rise).
     - Labels are pushed at least 14 units apart so they never overlap. Grid at 2, 4, 6, 8 and 10.
     - Caption "average fullness, 1 to 10, by how you stopped". aria-label "Average fullness right after eating and 20 minutes on. {Word}: X right after, Y after 20 minutes. …".
   - Legend: "{Word} ({number of meals})" per line (pinned: "Left wanting (1)", …).
   - Empty (no completed meal): "Answer one fullness check and the lines appear here."
4. **How often you stop where.**
   - Lead: "{left-wanting count} of {rated}".
   - Copy: "Meals you left wanting, the goal, out of every rated meal. Below, how often you stop each way."
   - Chart: three horizontal bars (mark + word + bar), length ∝ count / max count, text "{count} ({share}%)" (pinned "2 (50%)"). The whole row is the tap target.
5. **Arriving hungry.**
   - Lead: the mean hunger before, over rated meals that have a hunger value, "X.X of 10" (hidden if none).
   - Copy: "Average hunger before a meal, 1 to 10. Below, by how the meal ended."
   - Chart: three bars on a 0-10 scale, text "{mean} ({n})", or "not enough yet" when a way has no hunger values.
6. **From your meals** (findings, at most three, each only when both sides have enough meals).
   - The exact sentences are pinned:
     - Hunger (rated meals with hunger ≤ 6 against ≥ 7, at least 4 each): "Left wanting at {a} of {b} meals started at hunger 6 or less, and {c} of {d} started at 7 or more."
     - First meal of the day (the earliest meal of each day among all meals) against later ones, at least 4 rated each: "Left wanting at {a} of {b} first meals of a day, and {c} of {d} later ones."
     - Twenty minutes on (rated meals with a 20-min reading, left wanting against the rest, at least 3 each): "Twenty minutes on, fullness averaged {x.x} after meals left wanting, and {y.y} after the rest."
   - Below 10 rated meals, or when no finding qualifies: "Rate how ten meals finished and your own patterns show here."
7. **Show as a table / Hide the table**.
   - The table lists completed meals only, newest first, filtered by focus. Columns: Meal ("Fri 25 Sep, left wanting" or "…, not rated"), Hunger (blank if none), Right after, 20 min, Drift (signed).

**Now view**:
- The Fullness check section (section 9).
- The meal in progress with Finished this meal (section 6).
- The day fullness card (section 14).

**Meals view**:
- The last 30 days (today and the 29 before), newest first, grouped by day under a "Fri 25 Sep" label.
- Each meal is a button that opens the edit sheet:
  - title "HH:MM {name or 'Meal'}";
  - meta: mark + "Left wanting"/"Satisfied"/"Overfull", or "Not rated", plus ", outside the window" when relevant (pinned "Satisfied, outside the window");
  - side "{hunger} → {right after} → {20 min}", with "–" for a missing value, then the signed drift when complete (pinned "7 → 5 → 7 +2.0").
- Legend: the three ways plus "Not rated yet" (pinned).
- Footer: "Each meal reads hunger before → fullness right after → fullness 20 minutes on; the last figure is the drift."
- Empty: "No meals in the last 30 days. Start a meal from Today, or add one you already ate, and it collects here, newest first."
- Empty while filtered: the legend plus "No {word} meals in the last 30 days."

**Focus (show one way of finishing)**:
- Tapping a legend item (an `aria-pressed` toggle), or a mark, line or bar row in any chart, shows only that way of finishing across every chart, the table and the Meals list at once. Everything else is dimmed in the charts and filtered out of the lists.
- Tapping the same item again, or Show all, clears it. Leaving the tab clears it (pinned).
- Data covers all meals, including paused days and outside meals (fullness counts every day).

### 16. Owner decisions to keep (from CLAUDE.md)

- Day fullness is the worst meal rating. The gold dot means left wanting only. No extra marks or alternatives.
- Alarms start only the 20-minute check timer, when a meal is finished. There is no timer for the window closing, and starting a meal starts none.
- Add a meal adds a meal already eaten, whole, with no timer: today or yesterday from Today and Satiety, any day from a day in Week. It follows the same window rules (`placeAddedMeal`) and says before saving what it does to the day, with misses in words. Start a meal, Finished this meal and the automatic check stay exactly as they are.
- Just now on Last bite always moves the last bite to this minute, even into a miss.
- While a meal started after closing is still being eaten, the window's card with Finished this meal stays on top of Today.
- Every colour-coded visual has a labelled legend. A miss always has words. The Satiety marks also differ by shape.
- Copy is short and direct, with no em dashes, emojis or checkmarks.

### 17. Quirks a rebuild should decide on deliberately (current behaviour)

- Closing with I'm done eating while a meal is open finishes it with a 20-minute check scheduled, but shows no "Fullness check at" flash and starts **no alarm**.
- Meal edit has no checks: a future start or finish, an overlap with another meal, or a start before the window are all accepted. The day, the `outside` flag and the window are not recalculated, and `fullness20Skipped` is not reset when the finish changes.
- The Finished this meal wheel silently caps at now, so a time rolled before the meal's start becomes now.
- The landing chart draws unrated completed meals as hollow circles, but its legend has no "Not rated yet" item (only the Meals legend has one).
- A day's own fullness rating, set while its meals were unrated, still counts once every meal is rated, and the card then hides the choice. The day rating cannot be cleared from the UI.
- Adding a meal to a past day with Last meal = No leaves that past day's window open, so Today switches to "Window still open".
- A due check older than 6 h disappears from Now without being marked skipped, and counts as "still missing the 20-minute check".

## Additions from the completeness check

A second reader compared this inventory with the code, README, CLAUDE.md and tests, and found these missing or wrong. They are part of the contract too.

- The Meal edit sheet never sets fullness20At. A 20-minute reading entered or changed there has no answer time; only the check sheet sets it (to now), and Add a meal sets it to finish + 20 min. The edit sheet also never clears fullness20At or fullness20Skipped. A changed finish recomputes fullness20DueAt through fullnessDueAt, even when a reading is already stored.
- Satiety focus survives switching between Insights, Now and Meals; it resets only when the route leaves Satiety. On Now the "Charts and meals show ... only." line and Show all are hidden, but the focus still applies when you come back to Insights or Meals.
- Only the three ways of finishing are tappable filters. The Meals legend's "Not rated yet" (hollow circle) is a plain label. The landing chart's "Comfortable zone, 6 to 8" and "Meal to meal" items are plain labels too. Tapping the faint meal-to-meal line or the zone band does nothing. The lag legend lists only the ways of finishing that have completed rated meals.
- The eating block in Satiety's Now view always reads "Eating: {name or 'a meal'}, since HH:MM.", even for a meal flagged outside: there is no "Eating outside the window" wording there, unlike Today. It offers only Finished this meal (no Start another meal). It shows the meal in progress on the open, forgot or closed window's day, including last night's in the late-night mode, otherwise today's.
- Start a meal decides the kind (open, reopen, outside or first) from the current time through Today's mode, not from the start time rolled on the wheel. At 21:35 on a 17:30 + 4 h window, a meal rolled back to 21:20 still counts as outside, a miss. In reopen, a start between the first and last bite is accepted, and the window's lastBite is cleared.
- Window-time edits change meals too, through adjustWindow. The edits are the Opening sheet, the First bite and Last bite sheets, the Window times sheet and the Day editor on an existing window.
- The first meal (started at the old first bite) moves with the first bite.
- With a last bite, open meals end at max(last bite, start), and meals that finished after the new last bite are cut back to it.
- None of these schedule a 20-minute check or ring an alarm.
- A meal left outside the new times blocks the change: "A meal is logged at HH:MM, before that time. Change or delete it first." (or "...after that time...").
- Finished this meal: the Finished at wheel's default is the minute the sheet opened, and it does not move while the sheet stays open. Saving with no stop and no rating is allowed; both are stored as null. Opened from Start another meal, the sheet calls Start a meal once saved, as next().
- Offered but not built (CLAUDE.md): there is no Satiety chart by meal type. Meal types are never charted or summarised. They live only as the meal's name and in the CSV `type` column.

## Open questions found while cataloguing

- The I'm done eating sheet finishes an open meal and schedules its 20-minute check but never calls ringIn and shows no 'Fullness check at' flash, unlike Finished this meal. I could not tell whether this is intended (CLAUDE.md says the timer starts 'when a meal is finished').
- weekReview (docs/js/core/review.js) computes satiety numbers (rated, beforeFullShare, avgRise, avgAt20, leftWantingDays) that unit tests pin but no screen shows. It is unclear whether a rebuild should show them.
- showOutsideSheet accepts a preset `trigger` option, but no caller passes it (the Tempted flow writes outside entries directly with source 'temptation'), so it looks like dead code.
- The landing chart plots unrated completed meals as hollow circles, but its legend does not name them. This conflicts with the 'every colour-coded visual has a labelled legend' decision.
- Meal edit does not check for future times, overlaps or window consistency, and does not update `outside`, `day` or the window. I found no owner decision saying whether that is intended.
- Whether a day-level fullness rating set earlier should still count once all meals are rated (current code: yes, and the UI then hides the choice). Neither the code nor the docs say.
- I read the sliding-track mechanics of choice and scale (drag and glide behaviour in components.js `sliding`) only at the surface. The exact drag gesture rules are not catalogued here.
- Week schedule, CSV export, backup and the Tempted flow are only mentioned where they touch meals or fullness. Their full inventories belong to other areas.
