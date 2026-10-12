## More and settings: full behaviour inventory

Scope: the More tab and everything it reaches: Goal, What makes a day a success, planned starts, reminder times, Alarms, Pauses, the calendar file, CSV export, backup and restore, the storage note, Help, Reset and Version. It also covers travel and time zones, and the Tempted flow, which can be opened from every screen header. Visual styling is left out on purpose.

### 0. Source and test map

| Topic | Source | Tests that pin it |
|---|---|---|
| More screen | `docs/js/ui/more.js` | `tests/e2e/week-more.spec.js` (time rows, Alarms), `files.spec.js`, `reset.spec.js`, `satiety.spec.js` (feasting hours), `screens.spec.js` (shots 34, 34b, 38, 39, 53, 54, 64, 77) |
| Goal | `docs/js/ui/goal.js`, `docs/js/core/rules.js` (goalOn, windowMsFor, longFastHours, fastHoursFor, goalLabel, insideLongFast, longFastAhead), `store.setGoal` | `tests/unit/goals.test.js`, `tests/e2e/goals.spec.js` |
| Success rule (feasting hours) | `more.js timingSection`, `rules.isFlexible / cutoffApplies / evaluateDay`, `store.setFlexible` | `tests/unit/flexible.test.js`, `tests/e2e/satiety.spec.js` (two "feasting hours" tests) |
| Pauses | `docs/js/ui/pause.js`, `store.pauseDays / unpauseDays`, `rules.pauseRuns / isPaused / pausedBetween`, `today.js pausedBlock`, `day.js pausedSection / pauseSection` | `tests/unit/pause.test.js`, `tests/e2e/pause.spec.js` |
| Calendar | `docs/js/core/ics.js`, `app.js addCalendar`, `more.js calendarStatus` | `tests/unit/files.test.js`, `tests/unit/flexible.test.js`, `tests/e2e/files.spec.js`, `tests/e2e/travel.spec.js` (last test) |
| CSV | `docs/js/core/csv.js`, `app.js exportCsv` | `tests/unit/files.test.js`, `tests/unit/pause.test.js` (last test), `tests/e2e/files.spec.js` |
| Backup and restore | `docs/js/core/backup.js`, `app.js backup / restoreFrom`, `store.restore`, `shared.js backupDue / notices` | `tests/unit/files.test.js`, `tests/e2e/files.spec.js`, `tests/e2e/undo.spec.js` (last test) |
| File hand-off | `docs/js/ui/share.js deliverFiles` | `files.spec.js` ("without file sharing, exports download instead") |
| Alarms | `more.js alarmSection`, `docs/js/ui/alarm.js`, callers in `docs/js/ui/meal.js` | `week-more.spec.js` (Alarms test) |
| Reset | `more.js showResetSheet`, `store.resetHistory` | `tests/e2e/reset.spec.js` |
| Help | `docs/js/ui/help.js` | `screens.spec.js` shot 35 |
| Travel | `docs/js/core/time.js` (zones), `app.js followZone`, `shared.js awayZone / zoneNoteFor / header`, `store.noteSeen / lastActivityAt` | `tests/unit/zones.test.js`, `tests/e2e/travel.spec.js`, `files.test.js` (Dubai CSV row) |
| Tempted | `docs/js/ui/temptation.js`, `app.js tempted / prompts`, `store.addTemptation / updateTemptation / deleteTemptation / addOutside`, `shared.js nextWindowLine`, `core/review.js energySplit` | `tests/e2e/temptation.spec.js`, `screens.spec.js` shots 20 to 28 |
| Copy guard | `tests/unit/design.test.js` | No em dashes, emojis, checkmarks or "it's not X, it's Y" in app copy or the README |

---

### 1. Shared mechanics this area relies on

**Message bar (flash) and Undo** (`app.js showFlash / flashBar / undoLast`)
- One message at a time, floating just above the tab bar (`undo.spec.js` checks the gap is 0 to 16 px).
- It stays 8 s by default. A message with Undo stays at least 10 s. Zone-change messages stay 12 s.
- A new message replaces the old one, and the old Undo is lost with it.
- Tapping Undo runs the stored undo, then shows "Undone." with no Undo button.
- Messages with nothing to reverse have no Undo button (pinned in `undo.spec.js`).
- In this area, Undo exists for: a goal change, a success-rule change, Pause today, saving or changing a pause, ending or removing a pause, Pause this day and Unpause this day.
- These have no Undo: time settings, Alarms, the calendar file, exports, backup, restore and reset.

**Sheets** (`ui/sheet.js`)
- Only one sheet is open at a time; opening a new one closes the current one.
- A bottom sheet has a scrim. Tapping the scrim or pressing Escape closes it.
- The Tempted flow is a full-screen sheet (`full: true`) with a per-second `tick`.
- A sheet's own head has a label and a Close button (`data-action="close-sheet"`).

**File hand-off** (`ui/share.js deliverFiles(files, title)`)
- It must be called directly from the tap.
- If `navigator.share` and `canShare({files})` both work, it opens the iOS share sheet and returns `shared`. If the user dismisses it (AbortError), it returns `cancelled`.
- Any other share error, or no file sharing at all, downloads each file through an `<a download>` link and returns `downloaded`.
- On `cancelled`, nothing is recorded.

**Settings storage** (`store.js`, `db.js`)
- IndexedDB database `fast`, version 1, store `settings` (keyPath `key`, records `{key, value}`).
- Written with `store.setSettings(values)`. Memory is updated first, then the database; if the write fails, memory rolls back.
- Defaults (`DEFAULTS`):
  - `workdayStart '17:30'`, `weekendStart '14:00'`, `holdTime '13:00'`, `trainingTime '16:30'`
  - `installedAt null`, `lastBackupAt null`, `lastImportAt null`
  - `icsSequence 0`, `icsTimes null`, `persisted null`
  - `goalChanges []`, `alarms false`
- Keys not in the defaults but used in this area: `flexChanges`, `zones`, `zoneSeenAt`.
- Other areas own `historyMetric`, `historyRange`, `historyChart`, `weightRange` and `satietyView`. Old `climb` keys may linger and are ignored.

**"From today on" change lists** (goal and success rule)
- Both are stored as ordered lists of `{ from: 'YYYY-MM-DD', ... }`.
- A day uses the latest entry whose `from` is on or before that day; with no entry, it uses the default.
- A change always writes `from = today`:
  1. Entries dated today are dropped. Only entries with `from < today` are kept.
  2. If the new value equals the last kept entry (or the default when none is left), nothing is appended. So changing and changing back on the same day leaves no record.
  3. Otherwise the new entry is appended.
- Undo restores the whole previous list.
- Past days are always judged by the rule they had.

---

### 2. The More screen (`renderMore`, route `#more`, tab "More")

Sections, top to bottom:
1. **Header**: the label "More", the Tempted? button (see section 17) and the away-zone note (see section 16).
2. **Intro**: the title "Settings" and the line "Your goal, when a day counts as a success, and the times Fast reminds you."
3. **Goal** (section 3)
4. **What makes a day a success** (section 4)
5. **Planned window start** (section 5). Absent entirely while feasting hours are in force today.
6. **Reminder times, Sun to Thu** (section 6)
7. **Alarms** (section 7)
8. **Pauses** (section 8)
9. **Calendar reminders** (section 9)
10. **Export** (section 10)
11. **Backup** (section 11)
12. **Storage** (section 12)
13. **Help**: one button, "Weight Shortcut and Home Screen setup", which goes to `#help`.
14. **Reset** (section 14)
15. **Version** (section 15)

The Help screen and the Day screen keep their parent tab lit: help lights More, day lights Week.

---

### 3. Goal

**Where it appears**
- The Goal section on More (`goalSection`). After each change the app redraws.
- The Goal sheet (`showGoalSheet`, sheet name `goal`, title "Goal"), opened from Today. Two triggers:
  - the "Goal" margin note (value such as "20:4") when no last bite is on record;
  - the time pill under the dial labelled "`{N}` h goal" (`data-action="edit-goal"`).
- The sheet's intro: "Choose your eating window, and the fast is the rest of the day. Or, in Custom, choose how long to fast, up to 72 hours."
- After a change, the sheet redraws in place.

**Controls**
1. **Preset track** (`goal`, 5 options): 16:8, 18:6, 20:4, 23:1, Custom.
   - Stored values are the window hours `8, 6, 4, 1`. The labels come from `goalLabel(h) = "${24-h}:${h}"`.
   - Default goal: 20:4 (`DEFAULT_WINDOW_HOURS = 4`).
   - Custom is the selected option when:
     - Custom was tapped this session (module flag `customOpen`, which survives redraws until reload), or
     - a long fast is in force today, or
     - today's window is not a preset.
   - Tapping a preset clears the custom flags and sets that window with no long fast. A preset therefore ends a long fast.
   - Tapping Custom only opens the custom controls; it changes no goal.
2. **Goal-by track** (`goal-by`, shown only in Custom, aria label "Set the goal by"): "Eating window" / "Fasting".
   - Initial value: Fasting if a long fast is in force, else Eating window.
   - Switching only changes which wheel shows; the goal is untouched.
   - Both wheels always show the same goal: after fasting 17 h, the window wheel reads "7 hours".
3. **Wheel** (only in Custom). Each wheel commits when it comes to rest.
   - **Eating window** wheel (`goal-hours`): "1 hour", "2 hours" ... "12 hours" (`GOAL_HOURS_MAX = 12`). Value: today's window. Sets that window, with no long fast.
   - **Fasting** wheel (`goal-fast`): "12 hours" ... "72 hours" (`FAST_HOURS_MIN = 12`, `FAST_HOURS_MAX = 72`). Value: `fastHoursFor(today)`, meaning the long fast or 24 minus the window.
     - Choosing 12 to 23: window = 24 minus fast, with no long fast. Example: 17 gives 17:7.
     - Choosing 24 to 72 (`LONG_FAST_MIN = 24`): keeps today's current window hours and stores the long fast.
   - The wheel in use stays on screen after it lands on a preset (`customOpen = true`, `customBy` set). Pinned: "after a reload, the Fasting wheel stays in use when it leaves a long fast, even on a preset". Going from 48 to 21 gives 21:3; then 20 gives 20:4, and Custom and the Fasting wheel stay selected.
4. **Goal text** (`data-testid="goal-text"`):
   - Daily goal: "Eating window `{w}` hour(s), fasting `{24-w}` hours." For example "Eating window 4 hours, fasting 20 hours." The word is singular at 1: "1 hour".
   - Long fast: "Fasting `{F}` hours each time, with an eating window of `{w}` hours between. A day that begins inside the fast's goal, with nothing eaten, counts as a success."
5. Footnote: "A change applies from today on. Past days keep the goal they had."

**Saving**
- A change identical to today's goal does nothing (no message).
- Otherwise `store.setGoal(windowHours, today, fast|null)` and the message "Goal `{label}` from today." with Undo.
  - Labels: "Goal 16:8 from today.", "Goal 19:5 from today.", "Goal 48 h fast from today."
  - A long-fast label is `"${F} h fast"`.
- Stored in `settings.goalChanges`: `[{ from, hours }]` or `{ from, hours, fast }` (fast only when 24 or more). Uses the change-list logic of section 1.
- Examples:
  - 16:8 chosen on 2026-09-26 stores `[{from:'2026-09-26',hours:8}]`.
  - A long fast after 18:6 stores `[{from:'2026-09-26',hours:6},{from:'2026-09-27',hours:6,fast:48}]`.
  - Undo of a same-day custom change returns `[]`.

**Goal rules used everywhere** (`rules.js`)
- `windowMsFor(day)`: the goal's `hours`, which is the window even on a long fast. Default 4 h.
- `longFastHours(day)`: the `fast` value when 24 or more, else null.
- `fastHoursFor(day)`: the long fast, else 24 minus the window.
- `goalLabelFor(day)`: "18:6" or "48 h fast".
- Grace and the window:
  - A window is a miss when its length is over the goal plus 15 min grace (`GRACE_MS`).
  - `overByMs` = length minus the goal. Grace is not subtracted.
  - The window phases: `warn` in the last 30 min, `grace` from the goal to goal+15, `over` after that.
  - The "forgot to close" prompt comes at goal + 2 h.
  - All of these follow the day's own goal. Example: 7 h passes on 16:8 but misses on 20:4; 8 h 30 min misses 16:8 by 30 min.

**Long fast rules** (owner decision: kept for every fast until changed)
- Eating days keep their window and every window rule: the 16:00 rule when on planned start, length plus grace, and eating outside.
- Breaking a long fast early is never a miss.
- **Fasted day** (`insideLongFast` plus `evaluateDay`). A past tracked day is a success with `state 'fasted'` when all of these hold:
  - a long fast is in force on that day;
  - the day has no window;
  - no window that began before the day is still open;
  - some eating or Begin fast exists before the day's start, and the day starts less than F hours after the latest such moment;
  - no paused day lies between that moment's day and this day. If the moment was a Begin fast, counting starts the day after it, so a fast begun on a paused day still counts.
- A day that only passes those checks still becomes a miss if anything outside the window was logged that day (the outside check comes first). A no-eating day is a success anyway.
- Pinned examples:
  - Last bite Saturday 21:00 with a 48 h goal: Sunday and Monday are fasted; Tuesday is "not logged".
  - Sunday dinner 23:30 to 00:10 with a 24 h goal: Monday and Tuesday are fasted (Tuesday begins 23 h 50 min after 00:10).
- Today is never fasted; it stays pending.
- A day past the goal with nothing logged is "unlogged", so the fill-in prompt asks for it.
- `longFastAhead`: `{hours, at = lastEating + F h}` while now is before `at`, else null. It drives these lines:
  - Today: "Your `{F}`-hour fast reaches its goal at `{fmtWhen}`."
  - The "Fasting day" label when the goal falls after tomorrow's start.
  - The pill "48 h goal, 21:00 tomorrow", which turns "Reached 21:00 yesterday" in gold once reached.
  - `nextWindowLine` and the Tempted lines.
- On the dial (Today area): no goal tick and no "Goal" legend entry when the goal is past 24 h. The goal line reads "Fasting goal 48 h: 35 h to go." Week shows "Fasted"; the CSV result is `fasted`.
- The calendar file cancels the two window alerts while a long fast is in force (`noWindowAlerts`).

---

### 4. What makes a day a success (`timingSection`)

- Label: "What makes a day a success".
- Track `timing`: "Planned start" (`fixed`, the default) / "Feasting hours" (`flexible`).
- The text (`data-testid="timing-text"`) uses `{h}` = today's window hours:
  - Planned start: "Your `{h}`-hour window, and on workdays not before 16:00. A day succeeds when both hold and all eating fits inside it."
  - Feasting hours: "Open your `{h}`-hour window at any hour, any day. A day succeeds when all eating fits inside it."
- Footnote: "A change applies from today on. Past days keep the rule they had."
- Choosing the option already in force does nothing.
- Otherwise `store.setFlexible(on, today)` and a message with Undo:
  - "Feasting hours from today: open your window any time."
  - "Planned start from today: workdays open at 16:00 or later."
- Stored in `settings.flexChanges: [{ from, on }]`, default off, using the change-list logic.
- **Rules**
  - The 16:00 rule (`CUTOFF_MIN = 960`) applies only on a workday under planned start.
    - Workdays are Sunday to Thursday, unless the day record has `dayOff`.
  - A miss reason `early` is a workday window whose first bite is before 16:00 local time.
  - The planned start time (17:30 by default) is not a success rule. It is used for:
    - display ("Window planned for 17:30.");
    - the calendar alerts;
    - the Tempted outcome, held versus opened early.
  - Under feasting hours: no `early` reason, so only length plus grace and eating outside count. Pinned: a workday 09:00 window passes on feasting hours and missed the day before the switch.
- **Effects of feasting hours elsewhere**
  - The Planned window start section is hidden.
  - Today shows "Your `{h}`-hour window opens when you choose." in place of the planned time, with no 16:00 warning and no day-off toggle.
  - The Start a meal sheet shows no miss warning.
  - The calendar file cancels the window alerts, and the More text changes (section 9).
  - CSV `timing` reads "feasting hours" and `planned_start` is blank.
  - In Tempted, opening is never early.

---

### 5. Planned window start (`data-block="planned"`, hidden on feasting hours)

- Two rows: "Workdays" (`workdayStart`, default 17:30) and "Weekends" (`weekendStart`, default 14:00).
- Each row is a button showing the label and its "HH:MM" value. Aria label: "`{label}`, `{value}`. Change". `data-action="edit-{key}"`.
- Tapping opens a sheet (name `time-{key}`, title = the label) holding one 24-hour rolling wheel labelled "`{label}` at", for example "Workdays at".
  - Every roll that comes to rest saves at once with `setSettings({key: 'HH:MM'})`.
  - No Save button, no message, no Undo.
- Footnote: "Workdays run Sunday to Thursday; weekends are Friday and Saturday."
- A day marked as a day off uses the weekend start time (`plannedStartMin`).
- A change here changes the calendar fingerprint, which brings up "Your times changed..." (section 9).

### 6. Reminder times, Sun to Thu (`data-block="reminder-times"`)

- Rows "Hold the line" (`holdTime`, 13:00) and "Training" (`trainingTime`, 16:30). They behave exactly like the rows in section 5 (`edit-holdTime`, `edit-trainingTime`, sheets `time-holdTime` and `time-trainingTime`).
- They are used only in the calendar file and in the calendar section's wording. Nothing in the app fires at these times.
- Pinned: changing Training to 17:15 stores `trainingTime '17:15'`, and the row reads 17:15.

### 7. Alarms (`data-block="alarms"`)

- Text: "Fast cannot ring while it is closed. With Alarms on, it asks your Fast Timer shortcut to start an iPhone timer when you finish a meal, for the 20-minute fullness check. The Shortcuts app opens for a moment each time."
- Track `alarms`: On (`true`) / Off (`false`). Stored as `settings.alarms`, default off.
- Setup text: "Build the shortcut once: in Shortcuts, tap +, name it Fast Timer, add the action Start Timer, tap its duration, choose Shortcut Input, and set it to minutes. Then tap Done."
- **Behaviour** (`alarm.js ringIn(minutes)`):
  - Only when Alarms is on and minutes > 0, Fast navigates to `shortcuts://run-shortcut?name=Fast%20Timer&input=text&text={max(1, round(minutes))}`.
  - Tests capture the address through `window.__fastOpened`.
- Only one kind of timer exists: the 20-minute fullness check (owner decision).
  - **Finished this meal** (Save): minutes = finish time + 20 min minus now. A finish entered in the past gives a shorter timer; one already past gives none.
  - **Add a meal**: only when the saved meal still has `fullness20DueAt`, meaning no 20-minute rating was entered and the due moment is no more than 15 min past. minutes = due minus now, so a due moment already past gives none.
  - Starting a meal never starts a timer, the first meal of the day included. There is no timer for the window closing.
- Pinned (`week-more.spec`):
  - Off by default: nothing is sent.
  - When on, starting meals sends nothing; each Finished this meal sends `...text=20`.
- The in-app 20-minute prompt is separate. While Fast is open, the fullness sheet opens on its own once due, up to 6 h after, whether Alarms is on or off.

---

### 8. Pauses

**Meaning** (owner decision; `rules.js`, `pause.js` header)
- A paused day is not tracked for fasting:
  - `evaluateDay` returns `result 'paused'` whatever is logged. A long window or eating outside on a paused day is not a miss.
  - It neither counts toward nor breaks a streak (`streaks` skips `paused`). An unlogged day still breaks one.
  - It is never flagged as unlogged.
  - It is left out of the Week counts (pinned "2 of 5", "Paused 2 days") and History (shaded, no value).
  - CSV shows `paused (travel)` or `paused`, with `planned_start` blank.
- Fullness still counts: a paused day can be rated, and Add a meal on a paused day counts for Satiety only.
- **After a pause:**
  - Eating during the pause went unrecorded. If any paused day lies between the last eating's day and today, the last bite is unknown: no dial or ring on Today until the next window, and History's fast across the pause is null.
  - A Begin fast on a paused day itself still counts (counting starts the next day).
  - A pause still ahead, or one before the last eating, changes nothing.
- Today's mode is `paused` unless some window is still open; an open window wins.
- Reasons: `travel`, `illness`, `ramadan`, `other` (words Travel, Illness, Ramadan, Other), or `true` for no reason. Ramadan is a pause reason only; no Ramadan rhythm is built.

**Record**: the day record gains `paused: 'travel'|'illness'|'ramadan'|'other'|true` and `updatedAt`. Unpausing deletes the field. A day record left holding nothing else is deleted. "Holding something" means any of: firstBite, lastBite, noEating, dayOff, energy4pm, trained, trainingType, paused, fullness, fastFrom.

**Runs** (`pauseRuns`): paused days are grouped into runs of consecutive days with the same reason, `{from, to, reason}`, oldest first. Adjacent days with different reasons form separate runs.

**Pauses section on More** (`data-block="pauses"`)
- Text: "For travel, illness or Ramadan. Fasting is not tracked on paused days and your streak holds; fullness still counts."
- List of runs still running or ahead (`to >= today`), soonest first. Each row is a button (`data-pause="{from}"`):
  - title: the reason word, or "Paused";
  - meta: the range ("Tue 29 Sep" or "Tue 29 Sep to Thu 1 Oct");
  - side: "Now" when `from <= today`, else "Ahead".
  - Tapping opens the change sheet for that run.
- Past runs are not listed.
- Button "Add a pause" opens the new-pause sheet.

**Pause sheet** (`showPauseSheet`, sheet name `pause`; title "Pause", or "Change the pause" when editing)
- Intro: "Paused days are not tracked for fasting: no windows, no misses, and your streak holds. Fullness still counts."
- **From** date wheel (`pause-from`):
  - range from the earlier of today minus 30 days and the run's own start, up to today + 365;
  - items read "Today", "Tomorrow", "Yesterday" or "Tue 29 Sep";
  - defaults to today (or the run's start, or a passed `from`).
  - A new From redraws both wheels.
- **Until** date wheel (`pause-to`): range from From to From + 59 days (`MAX_PAUSE_DAYS = 60`). Until is clamped into that range. Changing it updates only the summary.
- **Summary** (`pause-summary`), parts joined by spaces:
  - "`{N}` day(s): `{range}`."
  - if Until ≥ today: "Tracking resumes on `{Until+1 as Fri 2 Oct}`."
  - if some days in range already have a window (excluding the run being edited): "`{N}` day(s) with a window logged: kept, but not counted."
  - Pinned: "3 days: Tue 29 Sep to Thu 1 Oct. Tracking resumes on Fri 2 Oct."
- **Why (optional)** track (`pause-reason`, 2 columns): Travel, Illness, Ramadan, Other.
  - Starts unselected for a new pause, or with the run's reason.
  - Once picked it cannot be cleared; it is a radio track.
  - Nothing picked is stored as `true`.
- **Save button**: "Pause these days" for a new pause, "Save" when editing.
  - Calls `store.pauseDays(from, to, reason, { replacing: the run's days })` in one transaction. Days of the old run outside the new range are unpaused; days inside take the new reason.
  - Refused if any day in range has an open window. The sheet stays open with the hint (`pause-hint`): "A window is still open on one of those days. Close it first."
  - On success the sheet closes, with the message "Paused: `{range}`." and Undo.
- **Second button** (edit only):
  - "Remove this pause" when the run starts after today; message "Pause removed.".
  - "End the pause" otherwise; message "Pause ended. Today is tracked again.".
  - `endPause` unpauses from max(run start, today) to the run's end, so past paused days stay paused. Undo is offered.

**Other entry points** (they share the same rules)
- **Today, Pause today** (plan panel before the window): pauses today with reason `true`, message "Today is paused." with Undo. An open window produces the error message instead.
- **Today, paused block**, title "Paused":
  - Heading: "Paused today", or "Paused until Thu 1 Oct" (a no-break space keeps "1 Oct" together).
  - Body: prefix "For travel. ", "For illness. " or "For Ramadan. " (none for Other or no reason), then "Fasting is not tracked and your streak holds; fullness still counts. Tracking resumes on Monday 28 September." The date is in long form.
  - Buttons: End the pause, Change (opens the sheet for the run), Add a meal.
  - On a paused Today there is no Start a meal, no dial, no check-in and no Tempted?.
- **Day screen** (`#day/{key}`):
  - On a day not paused and with no window open: section "Pause" with "Travel, illness or Ramadan: fasting is not tracked on a paused day, and your streak holds. Fullness still counts." and the button "Pause this day" (message "Day paused." with Undo).
  - On a paused day: section "Paused" with "`{Word}. `This day is not tracked. Unpause it to log it." and the button "Unpause this day" (message "Day unpaused." with Undo).
  - The result line reads "Paused: not tracked.".

---

### 9. Calendar reminders (.ics)

**Section text** on More
- Feasting hours: "Two repeating alerts for your iPhone Calendar: hold the line at `{holdTime}` and training at `{trainingTime}` on workdays. With feasting hours there is no planned opening, so the file removes the window alerts."
- Otherwise: "Four repeating alerts for your iPhone Calendar: hold the line at `{holdTime}` and training at `{trainingTime}` on workdays, and your window at `{workdayStart}` on workdays and `{weekendStart}` at weekends."
- The wording checks only feasting hours. The file checks feasting hours or a long fast (see gaps).

**Status line** (`ics-status`), from `settings.icsTimes`:
1. Never added: "Not added yet."
2. A fingerprint not starting with `local|` (a file from before alerts followed the phone, made before 1 Oct 2026): "Your calendar alerts ring by Kuwait time, even when you travel. Add the new file so they follow your phone's clock, then delete the old Fast events: open one, tap Delete Event, then Delete All Future Events."
3. A fingerprint that differs from the current one: "Your times changed since the last file. Add the new file, then delete the old Fast events: open one, tap Delete Event, then Delete All Future Events."
4. Otherwise: "Added with your current times."
- Fingerprint (`icsTimes`): `local|{holdTime}|{trainingTime}|{workdayStart}|{weekendStart}`, with `|flexible` appended while `noWindowAlerts`. So switching feasting hours or a long fast on or off also asks for a new file.

**Add to Calendar** button (`add-calendar`), then `app.addCalendar`:
- `flexible = noWindowAlerts(today)`, meaning feasting hours or a long fast.
- `sequence` = `icsSequence + 1` if a previous fingerprint exists and differs, else the stored `icsSequence` (0 at first).
- Hands over `fast-reminders.ics` (`text/calendar`, share title "Fast reminders").
- If cancelled, nothing is stored. Otherwise it stores `icsTimes` and `icsSequence`, with the message "Calendar file handed to iOS." or "Calendar file downloaded.".
- Hint below: "In the share sheet choose Calendar. If it is not listed, choose Save to Files, then open the file in Files and tap Add All."

**File format** (`ics.js buildIcs`, RFC 5545)
- Calendar header:
  - `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//Fast//Reminders//EN`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:Fast`.
- Four VEVENTs. Each has:
  - `UID:{uid}@fast.reminders`
  - `DTSTAMP` (UTC now)
  - `SEQUENCE:{n}`
  - `DTSTART:YYYYMMDDTHHMM00`, a floating local time with no TZID, so alerts follow the phone's clock. It falls on the first matching weekday on or after today.
  - `DURATION:PT10M`
  - `RRULE:FREQ=WEEKLY;BYDAY=...`
  - `SUMMARY`, `DESCRIPTION`, `TRANSP:TRANSPARENT`
  - then either `STATUS:CANCELLED` (no alarm), or a VALARM (`ACTION:DISPLAY`, `DESCRIPTION:{summary}`, `TRIGGER:-PT0M`).
- Encoding: lines folded at 75 octets (continuation lines start with one space), CRLF endings, and `\ ; , newline` escaped.

| UID | Days | Time | Summary | Description (planned start) | Description (no window alerts) |
|---|---|---|---|---|---|
| hold-the-line | SU,MO,TU,WE,TH | holdTime | Hold the line | "Your window opens at {workdayStart}. Water, black coffee, espresso or plain tea until then." | "Water, black coffee, espresso or plain tea until your window." |
| training | SU..TH | trainingTime | Training | "Train before your window opens at {workdayStart}. Log your 4 PM energy in Fast." | "Train before your window. Log your 4 PM energy in Fast." |
| window-workday | SU..TH | workdayStart | Window opens | "Protein and vegetables first. Eat slowly. Pause halfway." | same text, `STATUS:CANCELLED` |
| window-weekend | FR,SA | weekendStart | Window opens | same | same text, `STATUS:CANCELLED` |

- Pinned: on Friday 25 Sep the workday events start Sunday 27 Sep and the weekend event starts that day; 4 VALARMs, or 2 plus 2 cancelled on feasting hours.

---

### 10. Export (CSV)

- Text: "CSV files for Excel: every day with its window and the fast before it, meals, weight, check-ins and temptations. The weight file holds your raw entries."
- Button "Export CSV files" (`export-csv`): five files, each `text/csv`, share title "Fast CSV export".
- Message "CSV files handed to iOS." or "CSV files downloaded."; nothing on cancel.
- **Format rules** (`csv.js`):
  - UTF-8 with BOM; CRLF line ends, including after the last row.
  - ISO dates `YYYY-MM-DD`; 24-hour `HH:MM` times read on the clock where they happened.
  - Empty cell for null.
  - A cell is quoted if it holds `"` , `,` CR or LF, with `"` doubled.
  - A string starting with `= + - @ tab CR` gets a leading `'`. Numbers are untouched, so -0.5 stays -0.5.
- **fast-windows.csv**
  - Rows: every day from tracking start to today, plus any earlier day with a window, no-eating, a pause or an outside entry. Sorted by date.
  - Columns:
    - `date`, `weekday` (Sunday...), `day_type` (`day off` / `workday` / `weekend`)
    - `timing` (`planned start` / `feasting hours`)
    - `time_zone`: the zone name at the first bite, or at noon of the day ("Kuwait", "Dubai")
    - `planned_start`: blank on feasting hours, on paused days, or with no workdayStart setting
    - `first_bite`, `last_bite`, `last_bite_date` (the day key of the last bite)
    - `length_min`: only when both bites exist
    - `window_goal_min`
    - `result`: `open` | `no eating` | `fasted` | `success` | `miss` | `nothing yet` (today, pending) | `not logged` | blank (before tracking) | `paused (reason)` | `paused`
    - `reasons`: `opened before 16:00`, `over {goal+15 min as "4 h 15 min"}`, `ate outside the window`, joined with "; "
    - `over_by_min`: length minus the goal
    - `opened_before_16`: yes/no, only with a first bite
    - `outside_eating`: count of outside entries plus outside meals
    - `fast_from`: `YYYY-MM-DD HH:MM`, the fast ending at that day's first bite, as History counts it
    - `fast_min`
    - `fast_goal_min`: fastHoursFor × 60, for example 1200, or 2880 on a 48 h fast
    - `fast_goal_reached`: yes/no
    - `fullness`: left wanting / satisfied / overfull, from the worst meal rating or the day's own rating
- **fast-meals.csv**: meals and outside entries together, sorted by time. Columns: `date, kind, type, name, start, finish, minutes, hunger_before, stopped, fullness_after, fullness_20min, rise_20min, check_20min_skipped, trigger, amount`.
  - Meal rows:
    - kind is `meal`, or `meal outside the window` for a meal started after its window closed;
    - type is Snack/Breakfast/Lunch/Dinner, `Other` for any other name, blank with no name;
    - rise = fullness_20 minus fullness_after;
    - skipped = `yes` or blank.
  - Outside rows: kind `outside the window`, the time in `start`, trigger, amount (`a little` / `more than a little`).
- **fast-weight.csv**: `date,kg`, raw entries sorted by date.
- **fast-checkins.csv**: `date, weekday, day_type, energy_4pm, trained (yes/no), training_type` (only when trained). Rows are only days with an energy rating, a training answer or a day off.
- **fast-temptations.csv**: `date, time, when, trigger, outcome, urge_0min, urge_3min, urge_6min, urge_9min, minutes`. Sorted by start. `minutes` = endedAt minus startedAt, rounded.
  - `when` values: `before the window`, `after the window`, `late at night, after last night's window`, `while the window was open`.
  - `outcome` values: `held`, `opened window early`, `ate a little outside the window`, `ate outside the window`; blank if none.

---

### 11. Backup and restore

**Backup section**
- Status line (`backup-status`): "Last backup `{ago}`." or "No backup yet."
  - `ago` uses whole 24 h periods since the backup: "today" (under 1 day), "yesterday", "`{n}` days ago".
- Text: "Everything lives only on this iPhone. Back up once a week and keep the file in Files or iCloud Drive."
- **Back up now** (`backup`), then `app.backup`:
  - file `fast-backup-{YYYY-MM-DD}.json` (today's local date), `application/json`, share title "Fast backup", JSON with 1-space indent;
  - cancel does nothing;
  - otherwise sets `lastBackupAt = now`, with the message "Backup handed to iOS. Keep it in Files or iCloud Drive." or "Backup file downloaded.".
- **Restore from a backup** (`restore`): opens a hidden file picker (`accept=".json,application/json"`, `data-testid="restore-input"`). It is reset after each pick so the same file can be picked again.

**File format** (`backup.js`, `SCHEMA = 1`)
```
{ app: 'fast', schema: 1, version: '<VERSION>', exportedAt: '<ISO>',
  data: { days: [dayRecords], meals: [...], outside: [...], temptations: [...],
          weights: [{date, kg}], settings: [{key, value}] } }
```
All six stores are included, with every setting.

**Restore validation** (`parseBackup`); each error becomes a message with no Undo:
- Not JSON, `app !== 'fast'`, no `data`, or a schema that is not a number: "This file is not a Fast backup."
- `schema > 1`: "This backup comes from a newer version of Fast."
- Any of the six stores missing or not an array: "This backup is incomplete."
- Damaged entries are left out and counted in `skipped`, instead of blocking the restore. An entry is valid when:
  - days: a real day key, and firstBite/lastBite are numbers or absent;
  - meals, outside and temptations: a numeric `id`, a valid `day`, and a numeric `startedAt` or `at`;
  - weights: a valid `date` and a numeric `kg`;
  - settings: a string `key`.

**Confirm sheet** (name `restore`, title "Restore")
- "Replace everything on this iPhone with this backup?"
- "Backup from `{Saturday 26 September}` (or 'an unknown date'): `{w}` windows, `{m}` meals, `{n}` weigh-ins and `{t}` temptations." Windows means day records with a first bite.
- If skipped: "`{n}` damaged entry/entries will be left out."
- "Replace my data" restores, closes, and shows "Backup restored.". "Cancel" closes.

**What restore writes** (`store.restore`)
- All stores are replaced in one transaction.
- Settings come from the file except:
  - `installedAt` and `persisted`, which keep this device's values;
  - `lastBackupAt` = the latest of this device's value, the file's value and the file's `exportedAt`, so a restored file counts as a backup and no nudge follows (pinned: "Last backup today.");
  - `zoneSeenAt` = the later of the file's value and `exportedAt`.
- Pinned: backup, wipe and restore gives identical data apart from settings.

**Backup nudge on Today** (`backupDue`, `notices`)
- Shown when any day, meal or weight exists and `now − (lastBackupAt || installedAt) >= 7 days`.
- Notice text: "Backup due. The last one was `{ago}`." or "No backup yet.", with the button "Back up", which runs the same backup.

---

### 12. Storage

- Note on More:
  - when `settings.persisted === true`: "Kept on this iPhone. The browser has agreed not to clear it when space runs low.";
  - otherwise: "iOS may clear this data if the iPhone runs very low on space. Weekly backups keep it safe."
- When not running as a Home Screen app (`display-mode: standalone` false and `navigator.standalone !== true`), an extra line: "You are using Fast in the browser. Add it to your Home Screen and use it from there: the Home Screen app keeps its own data."
- `persisted` is set at boot by `requestPersistence()`:
  - true if already persisted;
  - else the result of `navigator.storage.persist()`;
  - null if unsupported or on error.
  - It is saved only when it changes. This causes the one redraw just after start that the tests wait for.
- Storage failure at boot shows a full screen instead of the app: "Storage is not available", then "Fast keeps everything on this device and could not open its storage. Private Browsing blocks it. Open Fast from the Home Screen or in a normal Safari tab.", then the error text.
- Database facts (`db.js`):
  - Stores: `days` (key `day`), `meals`, `outside` and `temptations` (auto-increment `id` with a `day` index), `weights` (key `date`, `{date, kg, importedAt}`), `settings` (key `key`).
  - Each operation reopens the connection once if iOS dropped it.
  - A blocked open fails with "The database is busy. Close other Fast tabs and try again."

### 13. Help screen (route `#help`, header "Help", lights the More tab)

- Title "Weight Shortcut". Intro: "Your scale syncs each weigh-in to Apple Health. This Shortcut reads the last 14 days, scrambles them and copies them to the clipboard. It never shows a number. Fast then shows your 7-day average." Button "‹ Back" goes to More.
- **Build it once** (10 numbered steps; owner decision: the same 10 steps in the README):
  1. "Open the Shortcuts app and tap + to start a new shortcut. Tap its name at the top, choose Rename, and call it Fast Weight."
  2. "Add the action Find Health Samples. Tap Add Filter and set Type is Weight; tap Add Filter again and set Start Date is in the last 14 days. Set Unit to kg, Sort by to Start Date and Order to Oldest First. Leave Limit off."
  3. "Add Repeat with Each. It repeats over the Health Samples, down to End Repeat."
  4. "Add Format Date and drag it inside the repeat, between Repeat with each item and End Repeat. For the date, choose Repeat Item, tap it and pick Start Date. Tap the arrow, set Date Format to Custom and type yyyy-MM-dd."
  5. "Add a Text action and drag it inside the repeat too, just under Format Date. Insert Formatted Date, type a colon, then insert Repeat Item and tap it to choose Value. Repeat Item is in the row of bubbles above the keyboard (swipe the row, or tap Select Variable); it is offered only inside the repeat."
  6. "After End Repeat, add Combine Text. Combine Repeat Results with Custom and type a comma."
  7. "Add Base64 Encode right after Combine Text, so it takes the Combined Text. Tap the arrow and set Line Breaks to None."
  8. "Add Copy to Clipboard. Tap its arrow and turn on Local Only."
  9. "Add Show Notification with the text Weight ready. Open Fast and tap Import weight. Do not add Show Result, Quick Look or Show: they would display the data."
  10. "Tap Done, then run it once. Allow Health access to Weight when asked."
  - "Fast Weight", "yyyy-MM-dd" and the notification text are set as code-like figures.
- **Import**: "Open Fast, go to History, choose Weight and tap Import weight, then tap Paste in the small bubble. Fast saves the entries and says only how many it imported."
- **Run it every week**, 5 steps:
  1. "In Shortcuts, open the Automation tab and tap +."
  2. "Choose Time of Day. Pick a time you usually have the phone in hand, such as 10:00, set Repeat to Weekly and choose Friday."
  3. "Choose Run Immediately, then Next."
  4. "Pick Fast Weight and tap Done."
  5. "When the notification arrives, open Fast and tap Import weight. Health is locked while the iPhone is locked, so if the automation ran then, use Run the Fast Weight shortcut under History, Weight instead."
- **Add Fast to your Home Screen**, 5 steps:
  1. "Open the Fast link in Safari."
  2. "Tap Share. In iOS 26 it sits inside the ••• button at the bottom right."
  3. "Scroll down and tap Add to Home Screen."
  4. "Keep Open as Web App switched on and tap Add."
  5. "From now on open Fast from its icon. The Home Screen app keeps its own data, separate from Safari."
- **If an import fails**:
  - "No weight data on the clipboard: run the Shortcut again, come back to Fast and tap Import weight."
  - "Entries skipped: in the Health app, open Weight and set its unit to kg. In Settings, General, Language and Region, set Calendar to Gregorian."
  - "The Paste bubble does not appear: tap Import weight again, or use the paste box that appears on the Weight screen."
- The Fast Timer (Alarms) shortcut is explained in More's Alarms section, not on Help.
- CLAUDE.md rule: when behaviour changes, update the README and Help together.

### 14. Reset

- Section text: "Delete all history and start again. Your planned times and reminders stay." Button "Reset all history" (`reset`).
- **Sheet step 1** (name `reset`, title "Reset"):
  - "Delete all history?"
  - "This removes every window, meal, check-in, pause, temptation and weigh-in from this iPhone. Your planned times and reminders stay."
  - "A backup first lets you bring everything back later."
  - "Back up first" (`reset-backup`) runs the normal backup; the sheet stays.
  - "Continue" (`reset-continue`) goes to step 2.
  - "Keep my data" (`reset-keep`) closes.
- **Step 2**:
  - "This cannot be undone." (`reset-final`)
  - "`{n}` window(s), `{n}` meal(s), `{n}` weigh-in(s) and `{n}` temptation(s) will be deleted for good.", correctly pluralised. Pinned: "7 windows, 4 meals, 6 weigh-ins and 4 temptations...".
  - "Delete all history" (`reset-confirm`) runs `store.resetHistory()`, closes, goes to Today and shows "All history deleted." with no Undo.
  - "Keep my data" closes.
- **resetHistory**:
  - empties days (so pauses, check-ins and day-offs go), meals, outside, temptations and weights;
  - keeps every setting (planned times, reminder times, goal list, success-rule list, zones, alarms, ics state, chart choices), except: `installedAt = now`, so tracking restarts now and the emptied past is not flagged as unlogged, and `lastBackupAt` and `lastImportAt` become null;
  - after it, Today shows no notices.

### 15. Version

- A margin note at the foot of More: "Version" with `VERSION` from `docs/js/version.js`.
- `tools/release.mjs` stamps it as `YYYY.MM.DD` (UTC date of the release) followed by the first 8 hex digits of a SHA-256 over all `docs/` files, for example `2026.10.10-001fe1e3`. The same value goes into `sw.js` with the precache list.
- Nothing on the note can be tapped.
- Update behaviour (`app.js registerServiceWorker`): when a new service worker takes over, the page reloads once nothing is open. If a sheet is open or a text field has focus, it retries every 2 s.

---

### 16. Travel and time zones

**Model** (`core/time.js`)
- Every stored time is epoch ms.
- Clock times and day keys are read in the zone in force at that moment, from the timeline `settings.zones = [{from:null, zone}, {from:ms, zone}, ...]`, oldest first, with the first `from` null.
- An empty or invalid timeline means Kuwait (`HOME_ZONE = 'Asia/Kuwait'`) throughout.
- Each day keeps the times it happened in: a Dubai dinner reads 19:00 in Dubai and still 19:00 back home.
- Days change at local midnight, so a travel day can run 23 or 25 hours. `dayStart` on a change day is the old zone's midnight, or the moment of the change when the new zone had already passed midnight.
- Workdays are always Sunday to Thursday by local date.
- Durations are always exact. Daylight saving is handled: a London 23:00 to 03:00 window across the change is 5 h.
- **Same clock**: two zones with equal offsets now and at +91, +182 and +273 days. So Riyadh equals Kuwait and counts as home.

**Following the phone** (`app.js followZone`)
- Runs at boot, every time the app becomes visible, and at least every 5 minutes on the 1-second tick.
- Reads `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `switchZone(timeline, deviceZone, zoneSeenAt ?? lastActivityAt(), now)` returns null (no change) when:
  - the zone is invalid, or
  - it has the same clock as the zone in force.
- Otherwise it appends `{from, zone}`:
  - `from` = `seenAt + 1` (just after Fast was last seen open, or after the last thing logged), never later than now and never before the last change + 1 ms.
  - If the timeline is Kuwait alone and nothing is known (`seenAt` null), the new zone replaces the whole timeline, so everything reads in the new zone.
  - Flying west late at night, the date never goes back: if the new zone's date at `from` is earlier, `from` moves to the new zone's own midnight of the old date.
- The message after a change (12 s): "Times now follow `{City}` time." (for example "Times now follow Dubai time."), or "Back on Kuwait time." when the new zone has Kuwait's clock.
- `zoneSeenAt` (setting) is written by `noteSeen(now)`, without a redraw:
  - after every followZone;
  - when the app is hidden.
- `lastActivityAt` = the latest of: day firstBite/lastBite/fastFrom/updatedAt, meal start/finish, outside `at`, temptation start/end.

**Zone notes**
- Header (every screen, `awayZone`): when the zone now has a different clock from Kuwait, it shows "`{City}` time". After a sub-title such as Today's date it reads " · Dubai time" (`data-testid="zone-note"`). Nothing is shown at home.
- `zoneName`: the last segment of the zone name, with "_" turned into a space ("America/New_York" becomes "New York").
- Day screen: when the day's first bite (or its noon) happened on a clock different from the zone now, the header shows "Times in `{City}` time" in place of the away note. Pinned: "Times in Kuwait time" seen from Dubai, "Times in Dubai time" back home.
- CSV `time_zone` per day.
- Calendar alerts are floating local times, so they ring by the phone's clock. Files from before 1 Oct 2026 were pinned to Kuwait time; More asks for them to be re-added (section 9).
- Scenery light uses offline sun times for Kuwait, or for the travel zone's place (`core/zone-places.js`). That belongs to the Scenery area.

---

### 17. The Tempted flow

**Entry**
- The "Tempted?" button in the header of every screen (Today, Week, Day, Satiety, History, Weight, More, Help). It is shown only when no window is open (`openRec` null, covering the open and forgot modes) and Today is not paused.
- `app.tempted()` creates a temptation record and opens the full-screen flow (sheet name `temptation`, label "Tempted"). It marks the record as prompted for this session, so it will not auto-resume until the next launch.
- **Record fields**:
  - `id`, `day` (today), `startedAt` (now, raw ms), `trigger` (null)
  - `context`: the situation kind at the start
  - `lastDay`, `step: 'trigger'`, `surfEndsAt` (null), `urges: []`
  - `outcome` (null), `endedAt` (null), and later `slipDay`.

**Situation** (read live on every draw, so a resumed flow acts on the current day)
- `open`: a window is open, including forgot mode. `lastDay` = the window's day.
- `late`: between 00:00 and 04:00, with no window today and yesterday's window closed. `lastDay` = yesterday.
- `after`: today has a closed window. `lastDay` = today.
- `before`: everything else. `lastDay` = null.
- "Waiting" means `before` or `late`.

**Close button** (top right of every step, `data-action="close-flow"`)
- If an outcome is recorded: close.
- If no trigger was picked yet: delete the record and close. Nothing is kept (pinned).
- On the `ask` step the button reads "Not sure yet" and closes, leaving the record unfinished.
- From any other step: go to the `ask` step.

**Steps**
1. **trigger**
   - "Hold the line." / "What's pulling at you?"
   - Track `trigger`, 3 columns: Hunger, Boredom, Social, Stress, Tired, Other (values `hunger, boredom, social, stress, tired, other`).
   - Picking one saves the trigger and goes to `gain`.
2. **gain**: label "What waiting gives you", then a lead statement:
   - before, with a long fast ahead: "Your `{F}`-hour fast reaches its goal at `{fmtWhen}`. That is `{h m}` away." (live)
   - before, on feasting hours: "Your window opens when you choose. Every hour you wait adds to the fast."
   - before, now before the planned start: "Your window opens at `{17:30}`. That is `{4 h 20 min}` away." (live)
   - before, past the planned start: "Your planned time has come. Open the window when you sit down to eat."
   - open: "Your window is open until `{firstBite + goal}`. Eat inside it."
   - after or late: `nextWindowLine(lastDay)`.

   Then the gains list (`data-testid="gains"`), in order:
   - **a. Energy line**, only when waiting, today is a workday (Sun to Thu, no day off) and it is before 16:00. It uses `energySplit` over all days: workdays with an energy rating, not paused, whose eating is known, split by whether there was eating before 4 PM.
     - With at least 2 days on each side: "Energy at 4 PM. On your own record: `{x.x}` on days with nothing before 4 PM, `{y.y}` on days with food."
     - Otherwise: "Energy at 4 PM. Rate it today at 16:00 and your own record builds."
   - **b. Streak line**: the first that applies.
     - after, and lastDay a success: "Today stays a success. Your streak: `{n}` day(s)."
     - late, and a success: "Last night stays a success. Your streak: `{n}` day(s)."
     - late, and a miss: "Last night was a miss. Today can start a new streak."
     - lastDay a miss: "Today is already a miss. Tomorrow can start a new streak." When lastDay is not today: "That day is already a miss. Today can start a new streak."
     - today already a success (for example a no-eating day): "Today counts as a success so far. Your streak: `{n}` day(s), today included."
     - streak > 0: "Your streak: `{n}` day(s), `{n+1}` if today holds."
     - else: "Today can start a new streak."
     - The streak is the current streak; pending and paused days are neutral.
   - **c. Wait line**, only when waiting:
     - long fast ahead: "Your `{F}`-hour fast reaches its goal at `{when}`. Each hour you wait adds to it."
     - feasting hours: "A `{h}`-hour window, whenever you choose. Each hour you wait adds to the fast."
     - else: "A window that fits today: `{planned}` to `{planned + goal}`." For example "17:30 to 21:30".

   Buttons:
   - "Ride it out for 10 minutes" (primary, `ride-it-out`) sets `surfEndsAt = now + 10 min` and goes to `surf`;
   - "I'm with people" (`with-people`) goes to `social`;
   - "I can't avoid eating" (`cant-avoid`) goes to `cant`.
3. **surf** (urge timer, `SURF_MS = 10 min`)
   - Label "Urge surfing" with footnote 1.
   - A live countdown `M:SS`, rounded up (`urge-timer`, starting at "10:00"), and a margin note "Ends `{HH:MM}`".
   - A rotating statement, changing every 2 minutes:
     - 0 to 2 min: "Drink a glass of water, or make an espresso."
     - 2 to 4 min: "Walk. Two minutes is enough."
     - 4 to 6 min: "Breathe out slowly, longer than you breathe in."
     - 6 to 8 min: "Notice where the urge sits. Let it stay there."
     - 8 min on: "It rises, peaks and falls. You are near the end."
   - Urge ratings at checkpoints 0, 3, 6 and 9 minutes, on a 1 to 10 scale (`urge`; ends "1 faint", "10 strong").
     - Label "Rate the urge now" at 0, else "Rate the urge again, minute `{3|6|9}`".
     - Only the latest due, unrated checkpoint is offered; missed earlier ones are skipped for good.
     - Each rating appends `{min, value}` to `urges`.
   - Between checkpoints: "Urge so far: 7, 5." (blank before the first rating).
   - "Stop the timer" (`stop-timer`) goes to `end`.
   - Gloss: "1 Urge surfing: noticing a craving rise, peak and pass without acting on it. Most fade within minutes."
   - The timer survives closing the app, because `surfEndsAt` is stored. When now ≥ `surfEndsAt`, the step shows as `end`.
   - The sheet tick redraws as soon as the due checkpoint changes or the timer ends.
4. **end**
   - "How is it now?"
   - "It passed. I held." (`held`): outcome `held`, step `held`.
   - "I'm with people" goes to `social`; "I can't avoid eating" goes to `cant`.
5. **social**: label "Practical exits", then three blocks:
   - "Hold a drink." / "Water, sparkling water, black coffee, espresso or plain tea. A full glass answers most offers."
   - "Step away." / "Take a call, a short walk, some air. A few minutes changes the room."
   - "Decline politely." with four phrases: "Not for me right now, thank you." · "It looks lovely. Coffee is perfect for me." · "I'm fine for now, thank you." · "I'll keep you company with a drink."

   Buttons: "I held" (outcome held) and "I can't avoid eating".
6. **cant**: label "If you can't avoid it". Blocks by situation:
   - **open**: "Your window is open until `{time}`. Eat inside it."
   - **before or late**: "Open the window now" / "This starts your `{h}`-hour clock. Everything you eat fits by `{now + goal}`."
     - On a workday under planned start, before 16:00, it adds: "Today is a workday and it is before 16:00, so today will count as a miss."
     - Button "Start the `{h}`-hour clock" (`open-now`).
   - **after or late**: "Eat very little" / "A small portion. Protein only. Then close it again."
     - When late, it adds: "This counts against last night."
     - "Log a small portion" (`eat-little`) and "I ate more than that" (`ate-more`).
   - So `before` shows only Open the window now, `after` only Eat very little, and `late` both.
   - "Back" returns to `gain`.
7. **ask** ("How did it end?")
   - "I held" (outcome held), always.
   - "I opened the window" (`opened`, runs openNow) unless the situation is after.
   - "I ate a little" (`ate-little`) and "I ate outside the window" (`ate-outside`), only when after or late.
8. **slip**: the statement `nextWindowLine(slipDay)` (`slip-line`) and "Done".
9. **held** (also the default): "Held." with a line:
   - before: "Your window opens at `{planned}`.", or on feasting hours "Your window opens when you choose."
   - open: "Your window is open until `{time}`."
   - otherwise: `nextWindowLine(lastDay)`.

   Then "Done".
- If the record is deleted while the flow is open: "This was removed." and Close.

**openNow** (from "Start the N-hour clock" and "I opened the window")
- If the live situation is open or after (a window is open or logged today): records the outcome from `knownOutcome` (or `opened_early`), step `done`, and closes. Nothing else changes.
- Otherwise:
  - records outcome `opened_early` if now is before today's planned start (never on feasting hours), else `held`;
  - closes, then opens the Start a meal sheet. The meal is what actually opens the window, and the outcome is already stored even if the meal is not started.
  - Pinned: at 13:10 on a workday it stores `opened_early`; the meal's start becomes the first bite.

**ateOutside** (slips)
- Adds an outside entry: `{day: live lastDay or today, at: now floored to the minute, trigger, amount: 'little'|'meal', source: 'temptation'}`.
- Records outcome `ate_little` or `ate_outside`, step `slip`, `slipDay`, `endedAt`.
- The day becomes a miss (reason `outside`).
- A slip just after midnight counts against last night's day. Pinned: at 00:01 it lands on the previous day, and the slip line reads "Today's window opens at 17:30."

**Auto-resume** (`app.js prompts`, every tick when no sheet is open and no text field has focus)
- It picks the newest unfinished temptation: no outcome, a trigger set, started under 3 h ago.
- If it was not yet prompted this session:
  - If a window's first bite is at or after `startedAt − 1 min`, the outcome is already known (`knownOutcome`): `held` if that first bite is at or after its day's planned start, else `opened_early`. It is saved silently with step `done`; no flow opens. Pinned: "a resumed temptation never overwrites a window logged since".
  - Otherwise the flow reopens at its stored step.
- The prompted set lives in memory. Coming back to the foreground clears only fullness keys, so a "Not sure yet" temptation resumes on the next full launch, within the 3 h. After 3 h it stays without an outcome.

**Stored values**
- Steps: `trigger, gain, surf, end, social, cant, ask, slip, held, done`.
- Outcomes: `held`, `opened_early`, `ate_little`, `ate_outside`.

**Elsewhere** (other areas, for reference)
- The Day screen lists the day's temptations as "`{trigger}`: `{outcome lowercase}`" with the time.
- A detail sheet shows "`{HH:MM}`, `{trigger}`", the outcome text (Held / Opened the window early / Ate a little outside the window / Ate outside the window / "No outcome recorded."), "Urge ratings: 7, 5." and Delete entry (confirm "Delete this entry?" Delete/Keep, no Undo).
- The Week review shows the count, "Held `{held}` of `{decided}` (`{%}`)" and the top 3 triggers.
- Reset deletes temptations; CSV exports them.

---

### 18. Records quick reference (this area)

- **settings keys**:
  - `workdayStart`, `weekendStart`, `holdTime`, `trainingTime` ("HH:MM")
  - `goalChanges` `[{from, hours, fast?}]`
  - `flexChanges` `[{from, on}]`
  - `alarms` (bool)
  - `icsTimes` (fingerprint string or null), `icsSequence` (int)
  - `lastBackupAt`, `lastImportAt`, `installedAt` (ms or null)
  - `persisted` (true/false/null)
  - `zones` `[{from, zone}]`, `zoneSeenAt` (ms)
- **day record fields touched here**:
  - `paused` (reason or true), `updatedAt`
  - `dayOff` (affects the planned start and the 16:00 rule)
  - `firstBite` and `lastBite` (pause refusal, the "kept, but not counted" summary, the reset count)
  - `fastFrom` (long-fast and pause edge cases)
- **temptation record**: see section 17.
- **outside record from a slip**: `{id, day, at, trigger, amount, source: 'temptation'}`.

---

### Gaps and inconsistencies noticed (for the rebuild to decide on or keep)

- On a long fast under planned start, More's calendar text still says "Four repeating alerts...", but the file sent cancels the two window alerts (`noWindowAlerts` covers long fasts; the wording checks `isFlexible` only).
- `knownOutcome` (used when a temptation is resolved from a logged window) compares the first bite to the planned start even on feasting hours. `openNow` treats feasting hours as never early.
- The restore confirmation does not pluralise ("1 windows, 1 meals..."). Reset step 2 does.

## Additions from the completeness check

A second reader compared this inventory with the code, README, CLAUDE.md and tests, and found these missing or wrong. They are part of the contract too.

- Restore errors are plain flashes (8 s, no Undo). Besides the parseBackup messages, a file that fails to read shows the error's own message, or "That file could not be read." when it has none. The file picker is reset after each pick, so the same file can be picked again.
- Goal quirk: while the Custom controls are open, tapping the preset that is already today's goal clears the custom flags but changes nothing. set() returns early with no store write and no redraw, so the goal-by track and the wheel stay on screen under the preset until the next redraw.
- CSV fast-windows column details:
- `result` reads "open" for any open window, even one already past goal + grace (a miss by evaluation).
- `opened_before_16` is yes or no for every day with a first bite, whatever the workday, day off or feasting-hours status.
- `outside_eating` is always a number (0 when none).
- `window_goal_min` is the day's eating-window goal, even on a long fast.
- `fullness` is blank while the day's fullness is undecided (null).
- Planned start times have no limits: a workday start before 16:00 can be set. Under Planned start, opening at that time is still a miss, because the 16:00 rule is separate from the planned time. The time rows store whatever HH:MM is rolled, at once, on every settle.
- A temptation started with Tempted? and abandoned on the trigger step by leaving the app (rather than tapping Close) stays stored with trigger null and no outcome. Auto-resume needs a trigger, so it is never resumed, and it is never deleted. It still counts in the Week temptation count, lists on the Day screen as "no trigger: no outcome", and is exported in fast-temptations.csv.

## Open questions found while cataloguing

- On a long fast under planned start, More's calendar text says 'Four repeating alerts', but the file cancels the window alerts (more.js uses isFlexible; addCalendar and the fingerprint use noWindowAlerts). Decide which wording the rebuild should use.
- Tempted knownOutcome (auto-resume) judges opened_early against the planned start even on feasting hours, while openNow says feasting hours are never early. This looks like an unintended mismatch.
- The restore confirmation does not pluralise (it can read '1 windows'); Reset's counts do pluralise.
- The Tempted 'open' situation (window open) cannot be started from the header, because Tempted? is hidden while a window is open. It is reached only by resuming a flow begun earlier, but the flow still has copy for it.
- A temptation left on 'Not sure yet' resumes only on a full relaunch within 3 h. After that it keeps a blank outcome forever, and nothing in the app asks again.
- The surf step offers only the latest due urge checkpoint. Checkpoints missed while the app was closed are skipped for good; this is current behaviour, not stated as an owner decision.
- Once a pause reason is picked in the sheet it cannot be cleared back to no reason, because the reason track is a radio choice.
- Holding the line and Training times affect only the calendar file and its wording; nothing in the app itself fires at those times. I found no other use of these settings.
