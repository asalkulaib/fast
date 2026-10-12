## Today: every mode, the fast card and dial, panels, notices, check-in

Source files: `docs/js/ui/today.js` (screen), `docs/js/ui/stages.js` (dial, stage panel, stages sheet), `docs/js/ui/shared.js` (header, notes, time pills, notices, next-window line, queries), `docs/js/ui/begin-fast.js`, `docs/js/ui/window-times.js`, `docs/js/ui/week.js` (`weekRow`), `docs/js/ui/pause.js`, `docs/js/core/rules.js`, `docs/js/core/stages.js`, `docs/js/core/history.js` (`dailySeries`, used by Fast complete), `docs/js/core/fullness.js` (`dayFullness`), `docs/js/core/time.js` (formats), `docs/js/app.js` (context, redraw, prompts), `docs/js/store.js` (writes).
Tests: `tests/e2e/today-card.spec.js`, `window.spec.js`, `stages.spec.js`, `begin-fast.spec.js`, `pause.spec.js`, `notes.spec.js`, `adjust.spec.js`, `goals.spec.js`, `meals.spec.js`, `satiety.spec.js` (pointer, ring legend, feasting hours), `sliders.spec.js` (check-in tracks), `undo.spec.js`, `travel.spec.js` (zone note), `temptation.spec.js` (late night), `screens.spec.js` (shots 01 to 90); unit `tests/unit/rules.test.js`, `goals.test.js`, `pause.test.js`, `flexible.test.js`, `stages.test.js`.

Test hooks are named below in parentheses (`data-block`, `data-action`, `data-testid`). The e2e suite selects on them, so keep them if the tests are kept.

---

### 1. What Today is made of, and in what order

`renderToday` always draws, top to bottom:
1. **Header** (section 4).
2. **Week row** (section 5).
3. **Notices** (section 6), only when at least one is due.
4. **Fast complete** note (section 7), in mode `open` only.
5. **Main panels.** Their order depends on the mode (table below).
6. **Streak** panel (section 16), always shown, paused days included.
7. **Check-in** panel (section 17), shown in every mode except `paused`.
8. **Scenery** at the foot: the Tuwaiq "Edge of the World" scene (`scenery({ phase: dayPhase(now) })`, `svg.dunes[data-phase]`).

Main panel order per mode (`[data-block]` values; `pointer` = satiety pointer, only while a 20-minute fullness check is running):

| Mode / situation | Order |
|---|---|
| `before` | `before` card, `plan` panel, pointer, `stages` panel (only if a fast is known) |
| `open` | `fast-done` (above), `open`, pointer. No stage panel or dial while the window is open |
| `forgot` | `forgot`, pointer |
| `closed`, fast first (normal) | pointer, `fasting` card (full-size dial and two time pills), `stages` panel (no dial), `closed` card (plain panel, not emphasised) |
| `closed`, meal still being eaten after closing (exception) | `closed` card (emphasised, with Finished this meal), pointer, `stages` panel holding a **compact** dial, its legend and the two time pills |
| `noEating` | `no-eating` card, pointer, `stages` panel with compact dial, legend and time pills (only if a fast is known) |
| `paused` | `paused` card, pointer. No stage panel and no check-in |

Rules behind the order (today.js 47-84):
- `fasting(mode)` is true for `before`, `closed` and `noEating`. Only those modes compute `src = lastEatingSource(ctx)` and show stages.
- `fastFirst = mode === 'closed' && src && !mealInProgress(ctx, rec.day)`. This was the owner's request: after the window closes, the new fast leads Today. While a meal started after closing is still unfinished, "no fast has begun", so the window card stays on top.
- `ringBelow = mode === 'noEating' || (mode === 'closed' && !fastFirst)`. In those cases the stage panel carries the smaller dial and the time pills.
- Pinned by today-card.spec: the order `['fasting','stages','closed']`; with a running check `['satiety-pointer','fasting','stages','closed']`; and `['fasting','stages','closed','streak','checkin']`.

---

### 2. Mode selection: `todayMode({ days, todayKey, nowTs, settings })` (rules.js 321-336)

Checked in this order:
1. **Any open window** (a day with `firstBite` and no `lastBite`, on any day; newest `firstBite` first). If `now - firstBite >= windowMsFor(open.day) + FORGOT_AFTER_MS` (2 h), the mode is **`forgot`**; otherwise **`open`**. The window's record is passed on. This beats a pause: a paused today with last night's window still open shows `open` (pause.test).
2. Today's record is paused: **`paused`**.
3. Today has a window (`firstBite`): **`closed`**, with today's record.
4. Today has `noEating`: **`noEating`**.
5. **Late night**: if `lateNightDay` returns yesterday and `canReopen(yesterday, now, windowMsFor(yesterday))`, the mode is **`closed` with yesterday's record**.
6. Otherwise **`before`**.

Constants (rules.js): `DEFAULT_WINDOW_HOURS 4`, `GRACE_MS 15 min`, `WARN_MS 30 min`, `CUTOFF_MIN 960` (16:00), `FORGOT_AFTER_MS 2 h`, `LATE_NIGHT_END_MIN 240` (04:00).

- `windowPhase(rec, now, windowMs)`, with `elapsed = now - firstBite`:
  - `over` when `elapsed > windowMs + 15 min` (strict);
  - `grace` when `elapsed >= windowMs`;
  - `warn` when `windowMs - elapsed <= 30 min`;
  - `window` otherwise.
  - Examples on 17:30 + 4 h: 20:00 is window, 21:00 warn, 21:30 grace, 21:46 over.
- `canReopen(rec, now, windowMs)`: the window is closed and `now - firstBite < windowMs` (strict). On 17:30 + 4 h it is true at 21:00 and false at 21:31.
- `lateNightDay`:
  - returns null if the local time is 04:00 or later, or if today already has a window;
  - otherwise returns yesterday's key when yesterday has both `firstBite` and `lastBite`.
- `windowMsFor(key)`: the goal change in force that day, from `settings.goalChanges` (latest `from <= key`), else 4 h.
- `fastHoursFor(key)`: the long fast's hours if set, else `24 - window hours`.
- `cutoffApplies(key, rec)`: a workday (Sun to Thu, not marked `dayOff`) and not flexible ("Feasting hours", `settings.flexChanges`).
- `plannedStartMin(key, rec)`: `settings.workdayStart` (default `'17:30'`) on a workday, else `weekendStart` (default `'14:00'`). A day off uses the weekend time.
- Day evaluation (`evaluateDay`):
  - success / miss reasons: `early` (workday, not flexible, first bite before 16:00; exactly 16:00 is allowed), `over` (length > goal + 15 min; `overByMs = length - goal`, measured from the goal and not from the end of grace), `outside` (any outside entry, or a meal flagged `outside`);
  - an open window is `pending` until it runs past goal + 15 min, then it is a miss.

---

### 3. When Today redraws (today.js `signature`, app.js `signatureOf`, `tick`)

The app ticks every 1 s.
- If the signature changes and no INPUT/TEXTAREA in the view has focus, the whole screen is redrawn.
- Otherwise only "live" elements are recomputed. These are: the countdown, the time on the dial, the goal and next-stage lines, minutes left, over-by, and the pointer text.

The app-level signature includes the route, `todayKey`, whether a window is open, and `dayPhase(now)` when the screen shows scenery (Today always does). The Today signature adds:
- the mode, `todayKey`, `minutesOfDay(now) >= 960` (the 16:00 flip), and `!!lateNightDay` (the 04:00 flip);
- in `open`: `windowPhase` and the whole minutes since the first bite, so the screen redraws every minute and the band moves;
- in `closed`: `canReopen`;
- the count of running fullness checks;
- in fasting modes, when a fast is known: `floor((now - last) / 5 min)`, so the dial redraws every 5 min (stages start on 5-minute marks), and `now >= last + goalHours h`, so the goal turns gold on the minute it is reached.

A **new stage** fades in: the render in which the stage key changes adds `fade-in` to the dial block and the stage panel. Later redraws within the same stage do not (stages.spec "a new stage arrives").

When the mode changes, the screen also fades in (app.js `stateKey`).

---

### 4. Header (shared.js `header`, `dayTypeText`, `awayZone`)

- **Title:** `fmtDayLong(todayKey)`, for example "Sunday 27 September". It always shows today, even while the card shows last night's window.
- **Subtitle:** "Paused" when today is paused, else "Day off" when it is marked as one, else "Workday" (Sun to Thu) or "Weekend".
- Away from Kuwait's clock the subtitle gains " · Dubai time" (`zone-note`; the zone name is the last part of the IANA name, with underscores turned into spaces).
- **Tempted?** button (`tempted`) shows when no window is open (not `open` or `forgot`) and the mode is not `paused`. It starts the temptation flow (`app.tempted`).

---

### 5. Week row at the top (week.js `weekRow`, testid `today-week`)

- Seven buttons, Sunday to Saturday of the current week (`weekStart` is the Sunday). Each shows the short weekday ("Sun"…"Sat") and a result square.
- Square states, the same marks as the Week schedule:
  - `success`: solid ink;
  - `miss`: clay stripes;
  - `paused`: sand;
  - outline: pending, unlogged, open, or before tracking (`none`);
  - `future`: dashed. A paused day ahead still shows as paused.
- A **gold dot** marks a day left wanting. Day fullness is the worst rating (`dayFullness`), and the dot shows only when that equals `before_full`. It never shows on future days.
- Today has `aria-current="date"` and is drawn **underlined**.
- `aria-label`: "Thu 24 Sep, miss, left wanting". The words are: success, miss, paused, "in progress" (pending), "nothing logged" (unlogged or anything else), "still ahead".
- Tapping a day opens `#day/{key}`.
- **Legend** (`today-week-legend`) names only the marks present in the row, in this order: Success, Miss, Paused, "Open or not logged", "Still ahead", "Left wanting".
- Pinned: today-card.spec (results array, legend `['Success','Miss','Left wanting']`; early in the week `['pending','future',…]` with legend `['Open or not logged','Still ahead']`).

---

### 6. Notices (shared.js `notices`), in this order

1. **Unlogged days** (`data-notice="unlogged"`). `unloggedDays` scans 1 to 14 days back and stops before `startKey`. It counts days whose result is `unlogged` and that have no open window. Paused days and fasted days are never flagged.
   - One day: "Nothing logged for {Weekday D Month}." Several: "{n} recent days have nothing logged."
   - Button **Fill in** (`fill-in`) opens `#day/{most recent gap}`.
2. **Backup due** (`backup`). Shows when any data exists (days, meals or weights) and there has been no backup, or it has been at least 7 days since `lastBackupAt` (falling back to `installedAt`).
   - Text: "Backup due. The last one was {today | yesterday | N days ago}." or "No backup yet."
   - Button **Back up** (`backup-now`) runs `app.backup`.
3. **Weight import due** (`weight`). Shows when `lastImportAt` is at least 7 days old ("Weight import due."), or, with no import ever, at least 2 days after install ("No weight imported yet.").
   - Button **Import weight** (`import-weight-notice`) reads the clipboard and goes to Weight.

---

### 7. Fast complete note (today.js `fastDone`, `data-block="fast-done"`)

- Shown only in mode `open`, above the window card.
- Hidden when `rec.fastNoteClosed === rec.firstBite`, or when the fast is unknown.
- The fast's length is `dailySeries(ctx, rec.day, rec.day)[0].fastMs`: from the latest eating (or Begin fast start) before the first bite, to the first bite. It is null when nothing earlier is on record, or when a paused day lies between.
- Contents:
  - label "Fast complete" and a close cross (`close-fast-done`);
  - the length as a big figure (`fast-length`, "20h 30m"), gold when `fastMs >= fastHoursFor(rec.day) h`;
  - when reached: "Fasting goal of {h} h reached." (`fast-goal`). A shorter fast shows its length only.
- `data-reached` is "true" or "false".
- Close writes `fastNoteClosed = rec.firstBite` on the window's day. If that window is removed and opened again, it gets a fresh note. The note also goes away when the window closes, because the mode changes.

---

### 8. Mode `before` (today.js `beforeBlock`)

The fast is known when `lastSrc = lastEatingSource(ctx)` exists.

**Card** (`data-block="before"`, emphasised):

*No fast known* (first day, after a reset, or after a pause):
- label "Before the window", heading "Fasting", and the plan line (below);
- at the side, a tap note **Goal** with `goalLabelFor(today)` ("20:4", "48 h fast"), `edit-goal`, which opens the Goal sheet;
- hint (`begin-fast-hint`): "Already fasting? Tap Begin fast and set when it began, so none of it is lost.";
- the 16:00 warning (below), if due;
- a pair of buttons (`.start-actions`): **Start a meal** (`start-meal`, primary, big) and **Begin fast** (`begin-fast`, outline, big);
- **Add a meal** (`add-meal`, outline).
- There is no dial and no stage panel.

*Fast known:*
- label (`before-label`): "Fasting day" when a long fast ahead reaches its goal at or after the start of tomorrow; otherwise "Before the window";
- the **full-size dial** (section 9) with the **two time pills**;
- the 16:00 warning, if due;
- **Start a meal** alone. Begin fast is hidden once anything is on record; the Fast began pill edits a fast start instead;
- **Add a meal**.

16:00 warning (`firm-reminder`): "Opening before 16:00 makes today a miss." It shows when `cutoffApplies(today)` and the local time is before 16:00. It sits just above Start a meal and disappears at 16:00 (signature flip).

**Plan line** (`plannedLine`). It sits inside the card when no fast is known, otherwise at the top of the plan panel:
- long fast ahead (`long-fast-line`): "Your {h}-hour fast reaches its goal at {fmtWhen}.";
- else flexible (`flexible-line`): "Your {N}-hour window opens when you choose.";
- else: "Window planned for {HH:MM}."
- `longFastAhead`: a long fast is set for today, the last eating is known, and `now < last + h`. It returns `{ hours, at }`.

**Plan panel** (`data-block="plan"`):
- the plan line, if a fast is known;
- "Until then: water, sparkling water, black coffee, espresso, plain tea.";
- **Late night**, when `lateNightDay` returns yesterday (00:00 to 03:59, today has no window, yesterday's window is closed): button "Eating late? Count it against last night" (`late-night`). It opens the Outside sheet for yesterday's key. A live entry gets the most recent matching clock time;
- **Day off**, only on Sun to Thu and not on Feasting hours (feasting hours have no 16:00 rule to lift):
  - off: button "Mark today as a day off" (`day-off`) writes `dayOff: true`;
  - on: "Day off: weekend rules today." and **Undo** (`day-off-undo`), which writes `dayOff: false`;
  - effect: no 16:00 rule, the weekend planned time, header "Day off", and no energy check-in;
- **Pause today** (`pause-today`): `store.pauseDays(today, today, true)` (no reason).
  - Flash "Today is paused." with Undo.
  - Error shown as a flash: "A window is still open on one of those days. Close it first."
  - Pause today exists only in mode `before`.

**Begin fast sheet** (begin-fast.js, sheet `begin-fast`). It opens from the Begin fast button, or from the **Fast began** pill.
- Title "Begin fast". Intro: "Already fasting? Set when your fast began, so none of it is lost."
- Quick times (`fast-now`, `fast-1`, `fast-2`, `fast-last`): "Now", "1 h ago", "2 h ago", "Last night {HH:MM}".
  - Last night = yesterday's planned start plus yesterday's window goal. For a Saturday: 14:00 + 4 h = 18:00.
  - Only times at or before now, and at or after `floor = lastBiteTs` (latest eating, ignoring fast starts), are offered.
- Wheel "Fast began at" (`fast-start`). It starts at `src.ts`, or now. A rolled clock time resolves to the most recent such moment at or before now (`latestAtOrBefore`).
- Live summary (`fast-summary`): "Fasting since {fmtWhen}: {fmtElapsed} so far." (`fmtElapsed`: "11 h 30 min", or past 2 days "3 days 4 h").
- A start before the floor:
  - hint (`fast-hint`): "Your last bite on record is {fmtWhen}. The fast begins after it.";
  - Save is disabled;
  - "Change that last bite" (`change-last-bite`) appears. It closes the sheet and opens the last-bite editor for `lastEatingSource(ctx, { fastStarts: false })`.
- Save (`save-fast`) runs `store.beginFast(ts)`, then flashes "Fast began {fmtWhen}." with Undo.
- Store behaviour:
  - the start is stamped to the minute and written as `fastFrom` on the record of the day the start falls on;
  - any other day's `fastFrom` later than the last bite (all of them when no bite exists) is removed; a record left empty is deleted;
  - a fast start never changes the result of its day;
  - a day holding only `fastFrom` does not start tracking (`trackingStart`).

---

### 9. The dial, legend, time pills, goal and stage lines, stage panel (stages.js)

**Dial geometry and behaviour** (`dialSvg`, `fastingRing`; `data-testid="fasting-ring"`, `data-stage`):
- A half-circle "sun path" over the land. 0 h is on the left horizon, 12 h overhead, 24 h on the right horizon (`point(h) = angle π(1 − h/24)`). The scale is 24 h only (`SCALE_HOURS`).
- The path is split by stage inside 24 h: digesting 0 to 4, settling 4 to 12, switch 12 to 24. There is a small gap (0.12 h) at each boundary.
  - Hours already fasted are filled in dark rock; the rest is sand (track "ahead").
- An engraved tick for every hour, 0 to 24 (25 ticks), longer every 6 h.
- **Goal tick** (`goal-tick`, `data-hours`): an ink bar across the path at `fastHoursFor(today)`, drawn only when the goal is 24 h or less. A long fast past 24 h has no tick.
- **Sun** (`stage-marker`, `data-hours` = elapsed hours to one decimal, which can exceed 24): a gold disc at `min(elapsed, 24 h)`. Past a day it rests on the far horizon.
- **Ground:** the Hisma near Tabuk (`hismaGround(s, dayPhase(now))`), drawn in the colours of the current day phase. Owner rule: the ground must stay clear of the time, the chip (longest label), the icons, the arc, and the 0 h and 24 h ticks. No gold in the ground.
- **Stage icons** (4, `data-stage-icon`), just outside the path:
  - digesting at 2 h, settling at 8 h, switch at 18 h;
  - one "beyond" icon at 22.5 h by the far horizon. It shows the stage the fast is in when past 24 h (ketones, brain or sparing), otherwise the first stage past a day (ketones).
  - The current stage's icon is set on a disc (`now`) and **moves** (`live`).
  - Icons: plate and fork, drop with a level line, flame, bolt, brain, shield.
  - Movement: the fork taps and the plate ring breathes; the drop sways and squashes; the flame leans and its heart flickers; the bolt strikes twice; the brain pulses with its folds firing in turn; the shield braces while a line runs down it.
  - Movement only, in the icon's own ink: no glow, no gold, no blur. Reduce Motion stops all of it (stages.spec).
- **Centre:**
  - screen-reader text "Fasting for";
  - the live time fasted (`fasting-for`). Minutes are rounded, shown as large digits with small units: "16h 10m", "45m", "0m"; at 48 h or more "2 days 2h" (days plus floored whole hours);
  - **stage chip** (`stage-name`, `data-action="open-stages"`): the stage's moving glyph and its name. `aria-label` "Stage: {name}. About the stages". It opens the stages sheet at the current stage.
- **Legend** (`ring-legend`): "Fasted", "Ahead", "Now" (sun key), "Goal" (only when the tick is on the dial), "Stage" (ink disc). Pinned in satiety.spec.
- **Full size** (`ringHero`): in the `before` card and the `fasting` card. **Compact** (`.compact`): inside the stage panel, for `noEating` and the closed-with-meal-in-progress case.

**Two time pills under the dial** (today.js `fastTimes`, testid `fast-times`; shared.js `timePill`):
- **Pill 1:**
  - if the source is a Begin fast start: label "Fast began", value `fmtWhen(ts)` (`edit-fast-start`). It opens the Begin fast sheet;
  - otherwise: label "Last bite", value `fmtWhen(ts)`, for example "21:00 yesterday" (`edit-last-bite`). It opens the editor matching the source kind:
    - `window`: the Last bite sheet for that day;
    - `outside`: the outside-entry time sheet;
    - `meal`: the meal edit sheet with Just now under Finished;
    - `open`: the opening sheet.
- **Pill 2:** label "{h} h goal", where h is today's `fastHoursFor`. Value `fmtWhen(src.ts + h)`, for example "17:00", "17:30 tomorrow", "08:00 Tue 29 Sep".
  - Once `now >= goalAt`: "Reached {fmtWhen}" with the `reached` (gold) state. It turns gold on that very minute (today-card.spec).
  - Tap (`edit-goal`) opens the Goal sheet.
- `aria-label` = "{label}, {value}. Change", for example "48 h goal, 21:00 tomorrow. Change".

**Fast source** (`lastEatingSource`, rules.js 383-396). The latest moment among:
- each day's `lastBite` (kind `window`);
- the `firstBite` of a still-open window (`open`);
- each meal's `finishedAt || startedAt` (`meal`, with id);
- each outside entry's `at` (`outside`, with id);
- each day's `fastFrom` (`fast`), unless `fastStarts: false`.

On a tie the earlier kind in that list wins: the window's own last bite beats the rest. The result is **null** if any paused day lies between the source's day and today, inclusive. For a `fast` source the check starts the day after its day, so a fast begun on a paused day still counts. Null means no dial and Begin fast is offered again (pause.spec, begin-fast.spec).

**Goal and next-stage lines** (`ringLines`, in the stage panel):
- `goal-line`: "Fasting goal {h} h: {fmtDuration(left)} to go." This is live and becomes "Fasting goal of {h} h reached." once reached. For a long fast: "Fasting goal 48 h: 35 h to go."
- `stage-next` (absent at the last stage): "Next: {next name lowercased}, in about {fmtDuration(until next)}.", for example "Next: ketones climbing, in about 7 h 50 min."

**Stage panel** (`data-block="stages"`, `data-stage`):
- optional compact dial, legend and pills;
- label: the stage name;
- the stage text;
- the goal and next-stage lines;
- **About the stages** (`about-stages`), which opens the sheet at the current stage.

**Stages** (core/stages.js; boundaries pinned in stages.test). Each stage is from inclusive, to exclusive:

| Key | Name | Hours | Range text |
|---|---|---|---|
| digesting | Digesting | 0 to 4 | "0 to about 4 h" |
| settling | Blood sugar settles | 4 to 12 | "about 4 to 12 h" |
| switch | Metabolic switch | 12 to 24 | "from about 12 h" |
| ketones | Ketones climbing | 24 to 48 | "about 24 to 48 h" |
| brain | Brain on ketones | 48 to 72 | "about 48 to 72 h" |
| sparing | Protein sparing | 72 and on | "72 h and beyond" |

- The texts are verbatim in `STAGES[].text`.
- The last stage ends with "A fast this long is best done with a doctor's guidance, more so if you take medicine or have a health condition."
- No hour is given for autophagy.

**Stages sheet** (`showStagesSheet`, sheet `stages`, title "Fasting stages"):
- Intro: "Typical changes after your last bite, from human studies. Swipe the stages or the cards, or tap a stage. Read more opens the full story of a stage."
- **Line:** six stops showing glyph, name and short hours "0–4 h", "4–12 h", "12–24 h", "24–48 h", "48–72 h", "72 h+". About three fit per view. The current stop is ringed (`.now`), and its aria-label ends in ", now".
- **Cards:** range label; a "Now" badge (`stage-now`) on the current card; name; text; **Read more** (`more-{key}`).
- **Movement:**
  - tapping a stop scrolls its card into view and centres the stop;
  - swiping the cards moves the mark (`aria-current`) along the line;
  - the line can be swiped on its own without moving the cards;
  - while cards glide to a tapped stage, the line waits 800 ms before following;
  - the sheet opens on the requested stage;
  - the stop in view animates its icon (Reduce Motion stops it).
- Then: the variation note, an "Autophagy" section (`autophagy-note`), and "Sources" (11 entries).
- **Read more** turns the sheet to that stage's page (`stage-more`):
  - "Back to the stages" at the top and the bottom (`stages-back`, `stages-back-end`);
  - a hero card;
  - sections "What happens", "What the studies found" (each finding cited as "Anton and colleagues, 2018"), "Good to know", "Sources";
  - no links.
  - Back returns to the cards at that stage.

---

### 10. Mode `open` (today.js `openBlock`, `data-block="open"`, `data-phase`)

- Label "Window open".
- Side notes: tap note **Opened** `fmtWhen(firstBite)` (`edit-opened`), which opens the opening sheet; and a plain note **Closes** `{HH:MM}` (first bite + goal).
- **Countdown** (`countdown`, role timer): live "H:MM" of `closesAt - now`, rounded up to the minute. It reads 0:00 only at the deadline and stays there. Caption: "left of {N hour|hours}".
- **Window band** (`window-band`, `data-used` minutes, `data-over`):
  - the scale is goal + 15 min grace;
  - segments: time used (first bite to now) in dark rock, time left in sand, and the 15-minute grace as a dashed box;
  - a tick every whole hour from 0 to the goal;
  - labels: the first-bite time at the left end and the closing time at the start of grace;
  - past goal + grace the whole band turns to clay stripes;
  - legend: "Time used", "Time left", "15 min grace", plus "Over" (miss key) only when over.
- Phase lines:
  - `warn` (`warn-30`): "{N min} left. The window closes at {HH:MM}." (minutes are live, rounded up);
  - `grace` (`grace`): "Your {N hours} are up. {N min} of grace left.";
  - `over` (`over`, clay): live "Over by {fmtDuration(now − closesAt)}". Measured from the goal: 4 h 20 on a 4 h goal reads "Over by 20 min".
- Opened before 16:00 on a workday (`e.openedEarly`): "Opened before 16:00, so today counts as a miss."
- **Meal in progress** (`data-block="eating"`):
  - "Eating: {name or 'a meal'}, since {HH:MM}.", or "Eating outside the window: …" for an outside meal;
  - **Finished this meal** (`finish-meal`, primary) opens the finish sheet;
  - **Start another meal** (`another-meal`). That sheet first asks how the open meal finished, with the lead "One meal at a time. First, how did this one finish?"
- **No meal in progress:** **Start a meal** (`start-meal`, outline).
- **Add a meal** (outline).
- **I'm done eating** (`done-eating`): primary when no meal is being eaten, outline while one is.
- **Change opening time** (`change-opening`).
- A window that crossed midnight stays on screen, for example "Opened 23:00 yesterday", with the countdown running on.

---

### 11. Mode `forgot` (today.js `forgotBlock`, `data-block="forgot"`)

Shown when an open window is at least goal + 2 h old (on a 4 h goal, 6 h after the first bite).
- Label "Window still open". Statement: "Your window from {fmtWhen(firstBite)} is still open." Then "When was your last bite?"
- Wheel (`forgot-last-bite`):
  - it starts at the latest logged meal time that day (finish or start), when that is after the first bite;
  - otherwise it is unset: it shows first bite + goal quietly, with the hint "Roll to your last bite."
- **Close the window** (`forgot-close`):
  - unset: hint "Roll the wheel to the time of your last bite.";
  - the time resolves to the first matching moment at or after the first bite (`timeOnOrAfter`);
  - a time in the future gives "That time is still ahead.";
  - otherwise `store.closeWindow(day, last)` runs. It also ends any open meal at that last bite, without a 20-minute check. No flash.
- The typed value survives redraws (module draft keyed by `day|firstBite`).
- Nothing else is in this card: no Add a meal, no Start a meal, no Fast complete note, no stages. The header has no Tempted?.

---

### 12. Mode `closed` (today.js `closedBlock`, `fastCard`)

**Fasting card** (`data-block="fasting"`, only when fast-first): label "Fasting", the full-size dial, and the two time pills.

**Window card** (`data-block="closed"`, `data-result`). It is emphasised only when it leads.
- Label "Window closed".
- The window length as a big figure (`window-length`, for example "4h", "3h 30m"), gold on success and clay otherwise.
- Tap notes: **First bite** `{HH:MM}` (`edit-first-bite`) and **Last bite** `fmtWhen(lastBite)` (`edit-last-bite`), each opening its single-time sheet.
- Result (`result`):
  - success: "Success. All eating inside the window.";
  - otherwise one clay line per reason: "Over by {fmtDuration(overByMs)}.", "Opened at {HH:MM}, before 16:00.", "Ate outside the window."
- A meal started after closing and still unfinished: the eating block with Finished this meal (no Start another).
- **Reopen** while `canReopen`: "Still inside your window." and **Reopen window** (`reopen`), which sets `lastBite: null`. No flash.
- When no meal is being eaten: **Add a meal** and **Start a meal**.
  - Start a meal reopens the window while inside the goal. After that, it counts as eating outside and the day becomes a miss.
- **I ate something** (`ate-something`) opens the Outside sheet for that day.
- **Change times** (`change-times`) opens the Window times sheet.
- Next line (`next-window`, `nextWindowLine(ctx, rec.day)`):
  - a long fast ahead: "Your {h}-hour fast reaches its goal at {fmtWhen}.";
  - the next day on Feasting hours: "Tomorrow: a {N}-hour window, opened whenever you choose." ("Today:" when the next day is today, after midnight);
  - else "Tomorrow's window opens at {HH:MM}." or, in the late-night case, "Today's window opens at {HH:MM}." The time is the next day's planned start, honouring that day's day-off mark.
- **Late night:** between 00:00 and 03:59, last night's closed window stays on Today while it can still be reopened. After that the new day shows `before`, with the "Eating late?" button until 04:00 (window.spec).

---

### 13. Mode `noEating` (`data-block="no-eating"`)

- Label "No eating today". Statement "Logged as a day without eating."
- **Undo** (`undo-no-eating`) writes `noEating: false`.
- "No eating" for today is set from the Day screen, not from Today.
- When a fast is known, the stage panel below carries the compact dial and time pills. There are no meal buttons.

---

### 14. Mode `paused` (today.js `pausedBlock`, `data-block="paused"`)

- The pause run is the run of consecutive paused days with the same reason that contains today (`currentPause`).
- Label "Paused".
- Heading (`paused-until`): "Paused today" when the run ends today, else "Paused until {Thu 1 Oct}". There is a non-breaking space before the month.
- Text: "{For travel. | For illness. | For Ramadan. | (nothing for other or no reason)}Fasting is not tracked and your streak holds; fullness still counts. Tracking resumes on {Weekday D Month of the day after the run}."
- **End the pause** (`end-pause`):
  - unpauses from today (or from the run's start, if it is still ahead) to the run's end; earlier days stay paused;
  - flash "Pause ended. Today is tracked again." (or "Pause removed.") with Undo;
  - a day left empty is deleted.
- **Change** (`change-pause`) opens the Pause sheet for this run: date wheels, up to 60 days, optional reason Travel, Illness, Ramadan or Other.
- **Add a meal**: meals still count for Satiety.
- Absent: the check-in, Tempted?, the dial and stages.

---

### 15. Satiety pointer (`data-block="satiety-pointer"`)

- Shown while any meal's 20-minute check is running: `fullness20DueAt` is later than now, `fullness20` is null and the check was not skipped. It uses the first such meal.
- Label "Fullness check". Live text: "{name or 'Your meal'}: check in {fmtDuration}." or "…: time to score it."
- Button **Satiety** (`open-satiety`) goes to the Satiety tab.
- Placement: above the fast when fast-first, otherwise after the main card.
- Separately, the app auto-opens the fullness sheet once it is due, within 6 h of the due time, once per session per meal.

---

### 16. Streak (`data-block="streak"`)

- Label "Streak". Big figure (`streak`): "{n} day" or "{n} days". Side note **Best** "{n} day(s)".
- Rules (`streaks`):
  - skip trailing `pending` days (today, or last night's window still inside its goal);
  - count back over successes; `paused` days are neutral; anything else breaks the run;
  - best is the longest run, with pending and paused neutral, and is at least the current streak;
  - a no-eating day and a long-fast "fasted" day are successes; unlogged days break the streak.
- This panel replaces the removed Jebel Uhud climber (owner decision; today-card.spec checks there is no `climb` or `uhud`).

---

### 17. Check-in (`data-block="checkin"`; stored on today's day record)

- Label "Check-in".
- **Energy at 4 PM**, on workdays only (Sun to Thu, not a day off):
  - from 16:00: a 1 to 5 rating track, ends "1 drained" and "5 sharp" (scale `energy`), which writes `energy4pm`;
  - before 16:00: "Energy at 4 PM: rate it here from 16:00."
- **Trained today:** Yes or No (choice `trained`), which writes `trained` true or false. No also clears `trainingType`; Yes keeps the existing type.
- When trained: **Type**, Weights, Cardio or Other (choice `training-type`), which writes `trainingType` ('weights', 'cardio', 'other').
- No selection is shown until a choice is made. Tapping or dragging along the track saves (sliders.spec).

---

### 18. The 16:00 workday rule on Today

- It applies on Sun to Thu, unless the day is marked as a day off or Feasting hours are on. Exactly 16:00 is allowed.
- `before`: "Opening before 16:00 makes today a miss." until 16:00.
- `open`: "Opened before 16:00, so today counts as a miss."
- `closed`: "Opened at {HH:MM}, before 16:00."
- The Start a meal sheet warns "Before 16:00 on a workday: today will count as a miss." for a first meal.

---

### 19. Sheets reached from Today (behaviour and copy)

**Opening sheet** (`opening`, title "Window opened"):
- Intro: "Set the time of your first bite. The countdown, your eating window and the 16:00 rule follow it."
- Wheel "First bite at" (`opened-at`). The time resolves on the window's own day; just after midnight, a late clock time within 6 h means last night. A time still ahead gives "That time is still ahead."
- Save (`save-opening`) runs `adjustWindow`, then flashes "The window now opens at {HH:MM}." with Undo. The first meal moves with the first bite.
- **Opened by mistake?**
  - "Remove this window" (`remove-window`) asks "Remove the window opened at {HH:MM}? Its meal goes too." (or "Its {n} meals go too.");
  - **Remove window** (`confirm-remove-window`) or **Keep it** (`keep-window`);
  - removing flashes "Window removed. Start a meal when you eat." with Undo; the meals go too.
- Errors (`times-hint`):
  - "This window no longer exists."
  - "{Day} already has a record. Change it from the Week screen."
  - "A meal is logged at {HH:MM}, before that time. Change or delete it first." (or "…after that time…")

**First bite / Last bite sheet** (`first-bite-time`, `last-bite-time`):
- Wheel "{First|Last} bite at" (`edit-first-bite`, `edit-last-bite`).
- On Last bite, a **Just now** chip (`last-bite-now`) sets this exact minute. Per the owner, it always moves the last bite to now, even if that makes the day a miss.
- Live summary (`bite-summary`): "Window {HH:MM} to {HH:MM | HH:MM next day | HH:MM Thu 1 Oct}, {N h N min}.", or "That time is still ahead." (more than 1 min in the future).
- Save flashes "{First bite|Last bite} saved: {HH:MM}." with Undo.
- If the window has changed meanwhile: "This window has changed."

**Outside-entry time sheet** (`outside-bite-time`, title "Last bite"):
- "Your last bite was logged outside the window." Just now chip.
- An unchanged time keeps the exact moment; a changed one moves to the nearest such moment.
- Flash "Last bite saved: {HH:MM}." with Undo.

**Window times sheet** (`window-times`):
- Wheels First bite and Last bite (`times-first`, `times-last`). Summary "{HH:MM} to {HH:MM}, {N h N min}."
- Errors: "That first bite is still ahead." and "That last bite is still ahead."
- Flash "Window times saved." with Undo.
- If the window is gone: "This window was removed."

**I'm done eating** (`done-eating`):
- When a meal is open: "Finish {name}" with "How did you finish?" and "Fullness now".
- Wheel "Last bite at". Summary "Window {HH:MM} to {HH:MM}, {duration}." or "That time is still ahead."
- **Close the window** (`close-window`) is disabled for a future time. No flash.

**Outside sheet** (`outside`, title "Outside the window"):
- "What set it off?" with Hunger, Boredom, Social, Stress, Tired or Other (required; otherwise "Pick what set it off.").
- "How much": "A little" or "More than a little". A wheel "At".
- Save shows one line: the next-window sentence (`slip-line`) and **Done**.

**Start a meal**, **Add a meal**, **Finished this meal**, the **Goal** sheet and the **Pause** sheet belong to their own areas. Today only opens them.

---

### 20. Data Today writes (IndexedDB stores: `days` keyed by `day`, `meals` and `outside` by auto `id`, `settings` by `key`)

- `days` record fields touched here: `day`, `firstBite`, `lastBite`, `noEating`, `dayOff`, `energy4pm` (1 to 5), `trained` (bool), `trainingType`, `paused` ('travel', 'illness', 'ramadan', 'other' or true), `fastFrom` (Begin fast), `fastNoteClosed` (the `firstBite` of the window whose Fast complete note was closed), `updatedAt`.
- Times are epoch ms stamped to the minute.
- `meals.finishedAt` is set when closing ends open meals.
- `outside`: `{ day, at, trigger, amount, source: 'today' }`.
- `settings` read here: `workdayStart`, `weekendStart`, `goalChanges [{from, hours, fast?}]`, `flexChanges [{from, on}]`, `installedAt`, `lastBackupAt`, `lastImportAt`, `zones`.
- Undo: every time change, removal, pause and Begin fast returns an undo. The flash shows **Undo** for at least 10 s (`undo`). Plain messages last 8 s.

---

### 21. Implementation notes worth keeping

- `figureParts` appends U+200B to a lone first digit, so WebKit draws a lining figure. Playwright's `toHaveText` strips it.
- All times read in the zone in force at that moment (travel). `fmtWhen` gives "HH:MM", "HH:MM yesterday", "HH:MM tomorrow" or "HH:MM Thu 24 Sep".
- `fmtDuration` gives "3 h 52 min", "52 min", "4 h". `fmtCountdown` rounds up.

## Additions from the completeness check

A second reader compared this inventory with the code, README, CLAUDE.md and tests, and found these missing or wrong. They are part of the contract too.

- CORRECTION, Backup due notice (shared.js `backupDue`): it shows only when data exists (any day record, meal or weight) and `now - (lastBackupAt || installedAt) >= 7 days`. A missing installedAt also makes it due. installedAt is set at first launch, so before any backup the "No backup yet." notice appears only once 7 days have passed since install, not straight away. With a backup on record it is due only after 7 days, so in practice the text always reads "Backup due. The last one was N days ago." with N of 7 or more.
- CORRECTION, Begin fast sheet: the save button's label is "Begin fast" (`save-fast`), not "Save". It is disabled while the chosen start is before the floor, and its handler refuses such a start too. The quick-time labels are exactly "Now", "1 h ago", "2 h ago" and "Last night HH:MM" (actions `fast-now`, `fast-1`, `fast-2`, `fast-last`). Tapping one moves the wheel and refreshes the hint, the Change that last bite button and the live summary. The Last night time is yesterday's planned start (workdayStart or weekendStart, honouring yesterday's dayOff) plus yesterday's window goal. It is computed this way even on feasting hours.
- First bite sheet (from the closed card's First bite note): saving calls `adjustWindow(day, newFirst, existing lastBite)`. A first bite rolled past the last bite is refused with "The last bite comes before the first bite." Meanwhile the live summary reads like "Window 22:00 to 21:00, 0 min." because the duration is clamped at 0. The sheet can also show the adjustWindow refusals: "{Weekday D Month} already has a record. Change it from the Week screen." (when the time resolves to the previous day just after midnight and that day has a window or no-eating), "A meal is logged at HH:MM, before that time. Change or delete it first.", the "...after that time..." variant, and "This window no longer exists.". Errors show in `bite-hint`. The buttons are `save-first-bite` and `save-last-bite`.
- Every window-time sheet (Opening, First bite, Last bite, Window times) goes through `store.adjustWindow`, which also changes meals in the same transaction:
- The meal that started exactly at the old first bite moves with it: start, finish and fullness20DueAt all shift by the same delta.
- When there is a last bite, any still-open meal ends at max(last bite, its start), and any meal that started by the last bite but finished after it is cut to the last bite.
- If the first bite lands on another calendar day, the window and all its meals move to that day and the old day's bites are cleared.
- One Undo restores both days and every meal touched.
- Window times sheet:
- It can also show the adjustWindow refusals (a meal before or after the new times, another day's record, "This window was removed." when the window is gone).
- While the Last bite wheel is unset, the summary is empty and Save says "That first bite is still ahead.".
- The summary (`times-summary`) reads "{HH:MM} to {HH:MM | HH:MM next day | HH:MM Thu 1 Oct}, {N h N min}.", the bite sheet's line without "Window ".
- Opening sheet: if the window no longer exists when the sheet draws, it shows only "No window is open." Its wheel starts at the current first bite's clock time. On Save, a time still ahead (resolveFirstBite returns null) gives "That time is still ahead." in `times-hint`.
- Last bite sheet for an entry logged outside the window (`outside-bite-time`):
- A time more than 1 minute ahead is refused with "That time is still ahead." (`bite-hint`).
- Just now keeps the exact minute until the wheel is rolled.
- The entry's `day` never changes.
- Undo restores the entry (undoPoint on outside).
- Energy at 4 PM on Today depends only on isWorkday (Sun to Thu, not dayOff) and the 16:00 clock, so it is still asked on feasting hours. The check-in panel always reads and writes today's record (todayKey). That includes the 00:00 to 04:00 late-night mode, where the main card shows last night's closed window.
- These Today actions have no flash and no Undo:
- Reopen window
- Close the window (in I'm done eating and in the forgot card)
- Mark today as a day off, and its Undo
- Undo of No eating
- the check-in ratings and choices
- closing the Fast complete note
- saving an eating-outside entry (the sheet turns into the slip line instead)

Undo is offered for: time edits, Remove this window, starting a meal, Begin fast, pauses, goal changes, and meal or entry edits and deletes.
- CORRECTION, auto-open of the 20-minute check: it opens once per visit, not once per session. The fullness keys (`f<id>`) in the `prompted` set are cleared every time the app returns to the foreground. A due, unanswered check therefore opens again on each return until it is answered, skipped or more than 6 h past due.
- The dial's goal tick, the "{h} h goal" pill, the Goal legend entry and the goal and next-stage lines all use TODAY's fasting goal, fastHoursFor(todayKey), even when the fast began on a day that had a different goal. The Fast complete note instead uses the goal of the window's own day, fastHoursFor(rec.day).
- More than one open window can exist, for example a past day saved in the Day editor without a last bite. Today shows only the newest one by first bite. An older open window stays open silently and:
- keeps growing toward an over-goal miss;
- blocks pausing its days;
- blocks Add a meal at or after its first bite ("Your window from ... is still open. Close it on Today first.");
- is never offered on Today; it is closed from its Day screen.
- In the late-night closed mode (last night's window on screen, 00:00 to 04:00 while it can still reopen):
- The closed card's First bite note shows a plain HH:MM, while Last bite uses fmtWhen ("23:30 yesterday", or "00:40" when the bite fell after midnight).
- The header title, subtitle, week row, streak and check-in stay those of today.
- Start a meal reopens last night's window.

## Open questions found while cataloguing

- Closed with a meal still being eaten after closing: the stage panel's compact dial is timed from that meal's start (lastEatingSource takes finishedAt || startedAt), although the README says no fast has begun. This is pinned only in that the dial must be visible (today-card.spec). It may be unintended; confirm with the owner before copying it.
- Late night after a paused yesterday that has a closed window: todayMode still returns 'closed' with yesterday's record. evaluateDay then gives 'paused', so the card shows a clay length and an empty result line, with no fast first. No test covers this.
- screens.spec names a shot '66-today-fullness-card', but today.js has no fullness card (fullness lives on Satiety). The name looks stale; I could not confirm what the shot was meant to show.
- The goal line wording differs between states: 'Fasting goal 20 h: 3 h 50 min to go.' versus 'Fasting goal of 20 h reached.' Both strings are pinned by tests, so keep them as they are.
- Mode 'forgot' offers only Close the window: no Add a meal, Start a meal or Change opening time. Mode 'noEating' offers only Undo. Pause today exists only in 'before'. These come from the code; I found no documented owner decision behind them.
- The Fast complete note uses the goal of the window's own day, while the dial and time pills use today's goal. The two differ only after midnight on a window that crossed it, or when the goal changed that day.
- Exact visual styling of the dial (compact size, the 'today underlined' mark) was skipped as asked. Behavioural geometry (hour positions, icon hours 2, 8, 18 and 22.5) is listed.
- I did not inventory the Start a meal, Add a meal, Finish, Goal and Pause sheets in depth, nor the stage-more texts and the scenery drawing (tuwaiqScene, hismaGround). They are other areas; only how Today enters them is listed.
