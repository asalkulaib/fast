## Platform and data

Platform inventory of Fast, as the code stands at `docs/js/version.js` = `2026.10.10-001fe1e3`. Unit tests were run during this survey: 111 tests, all pass. The e2e suite has about 191 `test()` declarations; it was not run here. Styling is left out on purpose. Behaviour, rules, wording, storage and tests are what to carry over.

---

### 0. Source map (this area)

| Concern | Files | Tests that pin it |
|---|---|---|
| IndexedDB | `docs/js/db.js` | used by every e2e test through `seed`/`readDb` in `tests/e2e/helpers.js` |
| In-memory store, writes, undo | `docs/js/store.js` | `tests/e2e/undo.spec.js`, `reset.spec.js`, `files.spec.js`, plus most feature specs |
| App shell: routing, render, tick, prompts, flash, zone following, boot, SW registration | `docs/js/app.js`, `docs/index.html` | `undo.spec.js`, `travel.spec.js`, `offline.spec.js`, `today-card.spec.js` |
| DOM helpers: `h`, `s`, `live`, `updateLive`, `fadeIn/Out`, `dimOthers` | `docs/js/ui/dom.js` | indirectly |
| Sheets | `docs/js/ui/sheet.js` | many specs (`sheet(page, name)`) |
| Controls and a11y patterns | `docs/js/ui/components.js` | `sliders.spec.js`, `notes.spec.js` (wheels) |
| Service worker | `docs/sw.js` | `tests/e2e/offline.spec.js` |
| Release stamp | `tools/release.mjs`, `docs/js/version.js` | run by `npm run e2e` |
| Manifest, icons | `docs/manifest.webmanifest`, `docs/icons/*`, `tools/render-icons.mjs` | `design.test.js` (colours) |
| CSP, head meta | `docs/index.html`, `docs/import/index.html` | `helpers.js` (no outside requests), `design.test.js` (no outside URLs) |
| Fonts | `docs/fonts/*`, `docs/css/fonts.css`, `tools/fetch-fonts.mjs` | `offline.spec.js` (fonts load offline) |
| Import page and payload | `docs/js/strip-hash.js`, `docs/js/import-page.js`, `docs/js/weight-import.js` | `weight.spec.js`, `offline.spec.js` |
| File hand-off to iOS | `docs/js/ui/share.js` | `files.spec.js`, `reset.spec.js` |
| Backup format | `docs/js/core/backup.js` | `tests/unit/files.test.js`, `files.spec.js` |
| Time and zones | `docs/js/core/time.js` | `tests/unit/zones.test.js`, `travel.spec.js` |
| Daylight phases | `docs/js/core/daylight.js`, `docs/js/core/zone-places.js` | `tests/unit/daylight.test.js`, `today-card.spec.js`, `screens.spec.js` |
| Scenery | `docs/js/ui/scenery.js`, `docs/js/ui/art.js` | `today-card.spec.js`, `history.spec.js`, `screens.spec.js` |
| Stage icon motion and Reduce Motion | `docs/js/ui/icons.js`, `docs/css/app.css` | `stages.spec.js` ("with Reduce Motion on, the stage icons rest") |
| Local server | `tools/serve.mjs` | `playwright.config.js` webServer |
| Test config | `playwright.config.js`, `package.json` | n/a |

---

### 1. Boot sequence (`app.js` `boot()`)

1. `index.html` paints a static skeleton first. `main#view` has `aria-busy="true"` and holds 6 skeleton blocks. Below it: a static tab bar (`nav#tabbar`, `aria-label="Sections"`, five `button.tab` with `data-tab` today/week/satiety/history/more, labels "Today", "Week", "Satiety", "History", "More") and an empty hidden `#sheet-root`.
2. `strip-hash.js` (a classic script, runs before the module) takes any weight payload out of the address bar (see §19).
3. `store.load()` reads every store. If that fails, the fatal screen shows:
   - label "Fast"
   - title "Storage is not available"
   - body "Fast keeps everything on this device and could not open its storage. Private Browsing blocks it. Open Fast from the Home Screen or in a normal Safari tab."
   - the raw error message, small
   - `aria-busy` is removed.
4. If there is no `installedAt`, it is set to `now()`.
5. `followZone()` runs (see §10).
6. `requestPersistence()` starts asynchronously. When it resolves, `setSettings({ persisted: p })` runs, but only if `p` differs from the stored value. This is "the one redraw just after starting" that the tests wait for (see §17).
7. `store.subscribe(scheduleRender)`: any store change schedules a redraw, coalesced through `queueMicrotask`.
8. `hashchange` → re-parse the route → `render(true)` (fresh: scroll to top, fade in).
9. The tabs become a sliding track (`sliding(..., { line: true, current: true })`). A tap or a drag calls `app.go(tab)`.
10. `visibilitychange`:
    - **hidden** → `store.noteSeen(now())`.
    - **visible** →
      - clear the per-visit fullness prompt marks
      - reset `app.ui.weightDay` to null
      - `store.load()` again (picks up writes made by the import page or another tab)
      - `followZone()`
      - `render(false)`
      - `prompts()`
11. `render(true)`.
12. If `window.__fastPayload` is set: route is forced to `weight`, the URL is replaced with `#weight` (no hashchange), then `importText(payload)`.
13. `prompts(context())`, `setInterval(tick, 1000)`, then `registerServiceWorker()`.

---

### 2. Routing and app shell

- **Routes** (hash based): `#today` (default), `#week`, `#week/<YYYY-MM-DD>`, `#day/<YYYY-MM-DD>`, `#satiety`, `#history`, `#weight`, `#more`, `#help`.
  - An unknown name goes to `today`.
  - `#day/` with an invalid date goes to `week`.
  - `#week/` with an invalid date goes to `week` with no argument.
  - Dates are checked with `isDayKey` (real calendar date, `YYYY-MM-DD`).
- **`#history`** renders the Weight screen when `settings.historyMetric === 'weight'`. Otherwise it renders History.
- **Tab highlighted**: `day`→Week, `help`→More, `weight`→History, else the route's own tab. It carries `aria-current="page"`, and the sliding pill syncs on every render.
- **`app.go(path)`** sets the hash. If the hash is already the target, it re-parses and does `render(true)` anyway.
- **`app` object**: `ui`, `ctx` (fresh context), `go`, `refresh`, `flash`, `tempted`, `importWeight`, `importText`, `backup`, `exportCsv`, `addCalendar`, `restoreFrom`.
- **`app.ui`** is transient, in-memory, never stored:
  - fields: `showPaste`, `showTable`, `showHistoryTable`, `showSatietyTable`, `satietyFocus`, `historyFocus`, `weightDay`
  - `satietyFocus`, `historyFocus` and `weightDay` reset to null whenever the route name changes
  - `weightDay` also resets on return to the app and after a successful import
- **`context()`** is computed fresh on every render and tick. It contains:
  - the data snapshot: `days` (Map), `meals[]`, `outside[]`, `temptations[]`, `weights` (Map date→kg), `settings`
  - `nowTs`, `todayKey`, `startKey`
  - `evaluate`: a cached per-day evaluator
  - `mode` (Today mode), `windowMsFor(key)`, `openRec` (the record when mode is open or forgot), `streak`
- **Scenery bleed**: `#view` gets class `with-dunes` on Today and on Weight with no weigh-ins. That removes the bottom padding so the scenery runs to the bottom edge under the floating tab bar.

---

### 3. IndexedDB schema (`db.js`)

- **Database** `fast`, **version 1**. There are no migrations: `onupgradeneeded` creates any missing store.

| Store | keyPath | autoIncrement | Index |
|---|---|---|---|
| `days` | `day` (`'YYYY-MM-DD'`) | no | none |
| `meals` | `id` | yes | `day` on `day` |
| `outside` | `id` | yes | `day` on `day` |
| `temptations` | `id` | yes | `day` on `day` |
| `weights` | `date` (`'YYYY-MM-DD'`) | no | none |
| `settings` | `key` | no | none |

- **Connection handling**. iOS can drop the connection while a Home Screen app is suspended.
  - The connection promise is cached.
  - `onclose` and `onversionchange` close it and clear the cache.
  - Every transaction retries once on a "lost" error, matched by the regex `InvalidStateError|UnknownError|TransactionInactiveError|closing|closed|Connection`.
  - `onblocked` rejects with "The database is busy. Close other Fast tabs and try again."
  - An abort with no other error rejects with "Saving failed."
- **`transact(names, mode, work)`** runs `work(tx)` in one transaction. If `work` throws, the transaction is aborted. It resolves only on `oncomplete`.
- **API**:
  - `readAll()` returns `{ days:[], meals:[], ... }`.
  - `put(store, value)` resolves with the key (the new id for auto stores).
  - `putMany(store, values)`.
  - `remove(store, key)`.
  - `batch([{store, put}|{store, remove}])`: one transaction across stores; resolves with an array of keys.
  - `replaceAll(data)`: clears every store and writes everything, atomically (all or nothing).
  - `requestPersistence()`: see §17.
- **Test access**: tests import `/fast/js/db.js` directly in the page (`readAll`, `replaceAll`). A rebuild that changes module paths must update `helpers.js`.

---

### 4. Record shapes

All times are epoch ms (UTC). Logged times are floored to the minute (`stamp` = `floorToMinute`).

**`days`** (one per calendar day, key `day`). Every field except `day` is optional.
- `day`: `'YYYY-MM-DD'`
- `firstBite`: ms or null. The window is open while `firstBite` is set and `lastBite` is null.
- `lastBite`: ms or null.
- `noEating`: bool. A day logged without eating; it clears both bites.
- `dayOff`: bool. Lifts the workday 16:00 rule.
- `energy4pm`: 1 to 5.
- `trained`: true/false/null.
- `trainingType`: `'weights'|'cardio'|'other'|null`. Cleared when `trained` is false.
- `paused`: `'travel'|'illness'|'ramadan'|'other'` or `true` (no reason).
- `fullness`: `'before_full'|'full'|'stuffed'|null`. The day's own rating.
- `fastFrom`: ms. "Begin fast": when the current fast began, filed on the day of that moment.
- `fastNoteClosed`: ms. Holds the window's `firstBite` when the "fast done" note was dismissed.
- `updatedAt`: ms, set on every write.

**`meals`** (key `id`, auto):
- `day`
- `name`: string, up to 60 characters in the text field; the meal type is derived from the name
- `startedAt`
- `finishedAt`: null while eating
- `hungerBefore`: 1 to 10 or null
- `stop`: `'before_full'|'full'|'stuffed'|null`
- `fullnessNow`: 1 to 10 or null
- `fullness20DueAt`: ms or null
- `fullness20`: 1 to 10 or null
- `fullness20Skipped`: bool
- optional `fullness20At`: ms
- optional `outside: true`: eaten outside a closed window

**`outside`** (key `id`, auto): `{ day, at, trigger: 'hunger'|'boredom'|'social'|'stress'|'tired'|'other'|null, amount: 'little'|'meal'|null, source: 'today'|'temptation' }`.

**`temptations`** (key `id`, auto):
- `day`, `startedAt`
- `trigger`: same values as outside
- `context`: `'open'|'late'|'after'|'before'`
- `lastDay`: key or null
- `step`: `'trigger'|'gain'|'surf'|'end'|'ask'|'social'|'cant'|'slip'|'done'|'held'` (the seed data uses `held`)
- `surfEndsAt`: ms or null
- `urges`: `[{ min, value }]`
- `outcome`: `'held'|'opened_early'|'ate_little'|'ate_outside'|null`
- `endedAt`
- optional `slipDay`

**`weights`** (key `date`): `{ date, kg, importedAt }`. In memory it is only `Map(date → kg)`. The backup exports `{date, kg}` without `importedAt`.

**`settings`**: rows of `{ key, value }`, loaded as `{ ...DEFAULTS, ...rows }`.

---

### 5. Settings keys and defaults

| Key | Default | Meaning and values |
|---|---|---|
| `workdayStart` | `'17:30'` | Planned window start on workdays (Sun to Thu) |
| `weekendStart` | `'14:00'` | Planned start Fri and Sat |
| `holdTime` | `'13:00'` | "Hold the line" calendar alert time |
| `trainingTime` | `'16:30'` | "Training" calendar alert time |
| `installedAt` | null, set at first launch | Start of tracking; reset sets it to now |
| `lastBackupAt` | null | Last backup; drives the 7-day backup notice |
| `lastImportAt` | null | Last weight import; drives the weight notice (7 days, or 2 days after install if never imported) |
| `icsSequence` | 0 | Calendar file SEQUENCE |
| `icsTimes` | null | Fingerprint of the times in the last calendar file |
| `persisted` | null | Result of `navigator.storage.persist()`: true/false/null |
| `goalChanges` | `[]` | `[{ from: 'YYYY-MM-DD', hours, fast? }]` oldest first; eating-window hours and optional long-fast hours (24 to 72) from that day on; default window 4 h |
| `alarms` | false | Hand timers to the "Fast Timer" Shortcut |
| `flexChanges` | (absent) | `[{ from, on }]`: feasting hours (flexible timing) from that day; default off |
| `zones` | (absent, means Kuwait only) | Zone timeline `[{ from: null\|ms, zone: IANA }]`, oldest first |
| `zoneSeenAt` | (absent) | Last moment Fast was seen open (written on hide and after each zone check, without a redraw) |
| `historyMetric` | (absent, means `'fast'`) | `'fast'\|'feast'\|'weight'` |
| `historyChart` | (absent, means `'bars'`) | `'bars'\|'line'` |
| `historyRange` | (absent, means 30) | 7, 30 or 90 |
| `satietyView` | (absent, means `'insights'`) | `'insights'\|'now'\|'meals'` |
| `weightRange` | (absent, means `'3m'`) | `'1m'\|'3m'\|'6m'\|'ytd'\|'all'` |
| `climb` (legacy) | n/a | May linger on the phone; ignored |

---

### 6. `store.js` API and rules

- **State**: `state = { ready, days: Map, meals: Map, outside: Map, temptations: Map, weights: Map(date→kg), settings }`.
- **Write order**: IndexedDB first, then the in-memory maps, then `changed()` notifies subscribers.
  - Exception: `setSettings` writes memory first, so a redraw during the write already shows the new value ("a time wheel rebuilt from the old one would undo a roll"). It rolls memory back on a failed write, notifies, and rethrows.
- **Records are always replaced, never mutated in place.** This is what makes undo snapshots valid.
- **Load and read**:
  - `load()` reads all, builds the maps, merges settings over `DEFAULTS`, calls `setZones(settings.zones)`, and sets `ready`.
  - `data()` returns a plain snapshot for the pure core functions.
  - `subscribe(fn)` returns an unsubscribe function.
- **Settings and zone notes**:
  - `setSettings(values)` also re-applies zones when `zones` is in `values`.
  - `lastActivityAt()` is the latest logged timestamp ≤ now across days (`firstBite`, `lastBite`, `fastFrom`, `updatedAt`), meals (start, finish), outside (`at`) and temptations (start, end).
  - `noteSeen(ts)` writes `zoneSeenAt` without a redraw and swallows errors.

**Days and windows:**
- **`updateDay(key, patch)`** merges into the record, sets `day` and `updatedAt`.
- **`openWindow(ts)`** opens the window on the day of the stamped time. A day that already has a `firstBite` is returned unchanged ("a first bite never overwrites logged times"). Otherwise it sets `{ firstBite, lastBite: null, noEating: false }`.
- **`cancelWindow(key)`** (alias `undoOpen`) sets `firstBite`/`lastBite` to null and deletes all meals of that day in one transaction. Returns `{ undo }`.
- **`adjustWindow(oldKey, firstTs, lastTs)`** returns `{ key, undo }` or `{ error }`.
  - Error strings:
    - "This window no longer exists."
    - "The last bite comes before the first bite."
    - "`<Weekday d Month>` already has a record. Change it from the Week screen." (the new first bite falls on another day that has a `firstBite` or `noEating`)
    - "A meal is logged at HH:MM, before that time. Change or delete it first."
    - "A meal is logged at HH:MM, after that time. Change or delete it first."
  - Effects, all in one transaction:
    - The window moves to the day of the new first bite. If it moved, the old day is emptied (bites null).
    - Every meal of the old day is re-keyed to the new day.
    - The first meal (the one whose `startedAt` equals the old `firstBite`) shifts by the same delta, including `finishedAt` and `fullness20DueAt`.
    - With a last bite: open meals end at `max(last, startedAt)`, and meals that started by the last bite but finished after it are cut to `last`.
- **`moveFirstBite(oldKey, ts)`** keeps the old `lastBite` only if it is ≥ the new first bite. Otherwise `lastBite` becomes null.
- **`closeWindow(key, ts)`** sets `lastBite`, then finishes still-open meals of that day at `max(lastBite, startedAt)`. No 20-minute check is set for those meals.
- **Other day writers**:
  - `reopenWindow(key)` sets `lastBite` to null.
  - `setWindowTimes(key, first, last)` also sets `noEating:false` and finishes open meals when `last` is given.
  - `clearWindow(key)` sets both bites to null.
  - `setNoEating(key, v)`: true sets `noEating:true` and clears both bites; false sets `noEating:false`.

**Pauses:**
- **`daysBetween(fromKey, toKey)`** returns the inclusive list of day keys.
- **`pauseDays(from, to, reason, { replacing })`**:
  - Refuses with "A window is still open on one of those days. Close it first."
  - Sets `paused = reason || true` on every day in range.
  - Days of the pause being replaced that fall outside the new range are unpaused in the same transaction.
  - Returns `{ undo }`.
- **`unpauseDays(keys)`** removes `paused`. A day left holding nothing is deleted.
  - "Holds data" means any of: `firstBite`, `lastBite`, `noEating`, `dayOff`, `energy4pm != null`, `trained != null`, `trainingType`, `paused`, `fullness`, `fastFrom`.
  - Returns `{ undo }`.

**Goal, flexible timing, Begin fast, fullness:**
- **`setGoal(hours, fromKey, fast = null)`**
  - Keeps the `goalChanges` entries dated before `fromKey`.
  - Appends `{from, hours}` (plus `fast` for a long fast), unless that equals the previous goal in force. The baseline is 4 h with no long fast.
  - Returns `{ undo }`, which restores the whole previous array.
- **`setFlexible(on, fromKey)`** follows the same pattern on `flexChanges` (baseline off).
- **`beginFast(ts)`**
  - Sets `fastFrom` on the day of `ts`.
  - Removes stale `fastFrom` on other days: those after the last bite on record, or all of them when there is no last bite. Records left empty are deleted.
  - Returns `{ undo }`.
- **`setDayFullness(key, value)`** sets the day's `fullness`.

**Meals:**
- **`startMealAs(kind, { day, name, startedAt, hungerBefore })`** writes in one transaction and returns `{ meal, undo }` or `{ error }`. The undo restores the day and deletes the meal.
  - `'first'` opens a window at the meal start, on the day of that time. Error if that day already has a window: "`<Weekday d Month>` already has a window. Pick a later time."
  - `'open'` joins the open window.
  - `'reopen'` sets the day's `lastBite` to null.
  - `'outside'` marks the meal `outside: true`.
- **`startMeal(...)`** is a simple save with no window logic (legacy).
- **`addFinishedMeal(place, fields)`**
  - `place` comes from `placeAddedMeal`: `{ day, rec?, outside? }`.
  - Saves the meal and the day's new record together.
  - With no `fullness20` given, `fullness20DueAt = fullnessDueAt(end)`. With one given, `fullness20At = end + 20 min`.
  - Returns `{ meal, undo }`.
- **`FULLNESS_DELAY`** is 20 min. **`fullnessDueAt(finishedAt)`** is `finishedAt + 20 min`, or null if that moment is already more than 15 min past ("a meal logged long after the fact gets no prompt").
- **`finishMeal(id, { finishedAt, stop, fullnessNow })`** stamps the finish and sets `fullness20DueAt`.
- **`updateMeal`, `updateOutside`, `updateTemptation`** do nothing and return null when the record no longer exists. A sheet left open after a delete can never write a half-empty record back.

**Outside, temptations, weights:**
- `deleteMeal`, `addOutside({day, at, trigger, amount, source})` (source defaults to `'today'`), `deleteOutside`, `addTemptation`, `deleteTemptation`.
- `saveWeights(entries)` writes `{date, kg, importedAt}`. A re-imported date replaces its old value. Then it sets `lastImportAt`.

**Reset and restore:**
- **`resetHistory()`**
  - `replaceAll` with every history store empty.
  - Settings are kept, except `installedAt = now`, `lastBackupAt = null`, `lastImportAt = null`.
  - Then reload and notify. Pinned by `reset.spec.js`.
- **`restore(backup)`**
  - `replaceAll` with the file's data, but the device keeps its own `installedAt` and `persisted`.
  - `lastBackupAt` becomes the maximum of our value, the file's recorded `lastBackupAt` and the file's `exportedAt`. "The file is itself a backup."
  - `zoneSeenAt` becomes the maximum of the file's value and `exportedAt`.
  - The zone timeline itself comes from the file.
  - Pinned by `files.spec.js`.

**Helpers:** `mealIdsOf(key)`, `undoPoint(keys)` (see §7).

---

### 7. Undo model

- **`undoPoint({ days?, meals?, outside? })`** snapshots those records as they are now (null when absent). It returns a function that puts them back in one batch: present records are re-put, absent ones deleted. Then it notifies.
  - Temptations, weights and settings are not in snapshots. Goal and flexible undo use closures that restore the previous settings array.
- **Single level**: only the most recent flash's undo is reachable.
  - Tapping Undo clears the flash, runs the undo, then shows "Undone." with no Undo button.
- **Actions that offer Undo**, with their flash text:
  - Window open: "Window open from HH:MM." or "Meal started at HH:MM."
  - Opening moved: "The window now opens at HH:MM."
  - Window removed: "Window removed. Start a meal when you eat."
  - First or last bite saved: "`<First bite|Last bite>` saved: HH:MM."
  - Last bite on an outside entry: "Last bite saved: HH:MM."
  - "Window times saved."
  - Day editor: "Window saved." and "Window cleared."
  - Meals: "Meal saved." (edit or add; when a check is still ahead: "Meal saved. Fullness check at HH:MM.") and "Meal deleted."
  - Outside entries: "Entry saved." and "Entry deleted."
  - Pauses: "Today is paused.", "Paused: <range>.", "Pause removed.", "Pause ended. Today is tracked again.", "Day paused.", "Day unpaused."
  - Begin fast: "Fast began <when>."
  - Goal: "Goal <label> from today."
  - Feasting hours: "Feasting hours from today: open your window any time." / "Planned start from today: workdays open at 16:00 or later."
- **Tests**: `undo.spec.js` covers:
  - a time change reverted, with the DB checked
  - the bar sits 0 to 16 px above the tabs wherever the screen is scrolled
  - a removed window comes back with its meal
  - a day-editor save and a meal delete are reverted
  - a message with nothing to reverse has no Undo

---

### 8. Message bar (flash)

- `showFlash(text, { ms = 8000, undo })` stores `{ text, undo, until }` and re-renders.
  - With undo the bar lasts at least 10 000 ms.
  - Zone messages and weight import messages use 12 000 ms.
- It is rendered as the first child of `#view`: `div.flash` with `role="status"` and `data-flash`, the text in `data-testid="flash"`, and an optional Undo button (`data-action="undo"`).
- It survives route changes until it expires. On the tick after it expires it fades out and is removed.
- It floats just above the tab bar (pinned by the test).

---

### 9. Redraw and tick model

**`render(fresh)`**
- Rebuilds the whole screen: `view.replaceChildren(flash?, screen)`.
- Fresh render: scroll to top and fade in.
- Otherwise: keep `scrollY`, and fade in only when `route|arg|mode` changed (`stateKey`).
- Removes `aria-busy`, syncs the tab and its pill, sets `scenic` when the screen contains `svg[data-phase]`, and stores `lastSignature`.

**Signature (`signatureOf`)**
- Base: `route.name | arg | todayKey | !!openRec`, plus `| dayPhase(now)` only when the screen on view draws scenery. "Only screens that show scenery redraw for a new phase."
- Today appends `today.signature(ctx)`:
  - mode, todayKey
  - whether now ≥ 16:00 (`CUTOFF_MIN`)
  - `!!lateNightDay`
  - while open: the window phase and minutes since the first bite (a redraw every minute)
  - while closed: `canReopen`
  - the count of running fullness checks
  - while fasting (before / closed / noEating): the 5-minute bucket since the last eating ("each stage starts on a 5-minute mark") and whether the fasting goal is reached ("the goal turns gold on the minute it is reached")

**Tick, every 1 s (`setInterval`)**
1. Skip when `document.hidden` or not ready.
2. Run `followZone()` if 5 min have passed since the last check.
3. Expire the flash.
4. If the signature changed and no text input in `#view` is focused, do a full render. Otherwise run `updateLive(view, now)`.
5. If a sheet is open, run `updateLive(sheetRoot, now)` and the sheet's own `opts.tick(now)`. The temptation flow uses this to re-render at its checkpoints.
6. `prompts(ctx)`.

**Live elements (`dom.live(tag, props, fn, render?)`)**
- `fn(nowTs)` returns a string. The element repaints only when the string changes.
- With `render`, the string is a key and `render(key)` draws child nodes, for example a duration figure with small units.
- Used for:
  - the open window's countdown (`role="timer"`)
  - the 30-minute warning minutes, grace minutes and "Over by …"
  - the time fasted on the dial, "Fasting goal N h: … to go.", "Next: …, in about …"
  - the fullness-check countdowns on Today and Satiety
  - the Begin fast summary
  - temptation timers
  - live margin notes
- First paint uses `Date.now()`.

**Prompts (`prompts`)**
- Skipped while a sheet is open or a text input is focused.
- First: an unfinished temptation (no outcome, has a trigger, started less than 3 h ago), once per launch (`t<id>`).
  - If a window opened since it began, the outcome is set silently: `held` or `opened_early`.
  - Otherwise the flow resumes.
- Then: due fullness checks (`fullness20DueAt` passed less than 6 h ago, not rated, not skipped), earliest first, once per visit (`f<id>`, cleared each time the app comes back to the foreground). Opens the fullness sheet.

**Stage arrival**: when a new fasting stage arrives, everything drawn in that render fades in (`markStage`).

**Editing guard**: no full re-render while the user types in an input or textarea in `#view`. The SW reload also waits for this.

---

### 10. Time zone following (platform part)

Time zone rules live in `core/time.js` and belong to the Travel area. The platform hooks:
- `deviceZone()` reads `Intl.DateTimeFormat().resolvedOptions().timeZone`, or null.
- `followZone()` runs at boot, every 5 min in the tick, and on return to the foreground.
  - It calls `switchZone(settings.zones, deviceZone, settings.zoneSeenAt ?? lastActivityAt(), now)`.
  - On a change it saves `zones` and flashes for 12 s: "Times now follow `<City>` time." or, when the new zone keeps Kuwait's clock, "Back on Kuwait time."
  - It then calls `noteSeen(now)`.
- Zones with the same clock as the zone in force (for example Asia/Riyadh at home) change nothing.
- The header shows " · `<City>` time" (`data-testid="zone-note"`) while away.
- Pinned by `tests/unit/zones.test.js` and `tests/e2e/travel.spec.js` (the exact `zones` value, the flash text, the header note).

---

### 11. Service worker (`docs/sw.js`)

- **Constants**:
  - `VERSION` and `ASSETS` are stamped by the release tool.
  - The cache is named `fast-<VERSION>`.
  - `INDEX` is the scope URL (`/fast/`) and `IMPORT_PAGE` is `/fast/import/`.
- **install**: `cache.addAll([INDEX, IMPORT_PAGE, ...ASSETS])`, each as `new Request(url, { cache: 'reload' })` so a release never mixes HTTP-cached old files with new ones. Then `skipWaiting()`.
- **activate**: deletes every other cache whose name starts with `fast-`, then `clients.claim()`.
- **fetch**: only GET requests to the same origin are handled.
  - Navigation to `/fast/import` (no slash): `Response.redirect(IMPORT_PAGE + search, 301)`. The browser keeps the `#payload`, so the page's relative links resolve.
  - Navigation to `/fast/` or `/fast/index.html` is served from the cached INDEX. `/fast/import/` and `/fast/import/index.html` are served from the cached IMPORT_PAGE. If the cache misses, it falls back to the network.
  - Everything else: `caches.match(req, { cacheName, ignoreSearch: true })`, falling back to the network.
  - The strategy is cache-first. There is no background revalidation.
- **Registration**: `navigator.serviceWorker.register('sw.js')` after boot; errors are ignored.
- **Update flow**:
  - The browser re-checks `sw.js` on launch. A changed file installs, skips waiting, activates and claims.
  - The open page gets `controllerchange`. It reloads only if it was already controlled at load, so the very first install does not reload.
  - It waits until no sheet is open and no input is focused, re-trying every 2 s, then calls `location.reload()` exactly once.
  - User-facing: "The phone picks up the new version the next time Fast is opened (close it from the app switcher and open it again)."
- **Not precached**: `sw.js`, `.nojekyll`, `robots.txt`.
- **Tests**:
  - Playwright blocks service workers by default (`serviceWorkers: 'block'`). Only `offline.spec.js` allows them.
  - That spec checks that once the SW controls the page and the server is gone, everything still works (§15).

---

### 12. Release stamp (`tools/release.mjs`, `npm run release`)

- Walks `docs/`, skipping dotfiles except `.nojekyll`, then drops `sw.js`, `.nojekyll` and `robots.txt`. The rest, sorted, are the precache list.
- **Version**: `YYYY.MM.DD-<first 8 hex of SHA-256>`.
  - The date is today's UTC date.
  - The hash covers each file's relative path and bytes, in sorted order, excluding `js/version.js`.
- Writes `docs/js/version.js` (`export const VERSION = '…';`) and rewrites the `const VERSION = …;` and `const ASSETS = [...]` lines in `docs/sw.js`. `js/version.js` itself is in ASSETS.
- Prints "Release `<v>`: N files precached."
- **Where the version shows**: More shows it as a margin note "Version". The deploy check (CLAUDE.md) opens `https://asalkulaib.github.io/fast/js/version.js`.
- **Rules**:
  - Stamp after the last edit, or phones keep the old version.
  - `npm run e2e` stamps before testing.
  - Re-running on another day with the same content still changes the version, because of the date.

---

### 13. Manifest, icons and head meta

- **`manifest.webmanifest`**:
  - `name` and `short_name` "Fast"
  - `description` "Eating window and satiety tracker."
  - `id`, `start_url` and `scope` all `./`
  - `display: standalone`, `orientation: portrait`
  - `background_color` and `theme_color` `#E6D0A8`
  - `lang: en`, `dir: ltr`
  - icons: `icon-192.png` (any), `icon-512.png` (any), `icon-maskable-512.png` (maskable)
- **Main page head**:
  - `viewport width=device-width, initial-scale=1, viewport-fit=cover` (layout uses `env(safe-area-inset-*)`)
  - the CSP (§14)
  - `robots noindex, nofollow`, `referrer no-referrer`, `color-scheme light`, `theme-color`
  - `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style default`, `apple-mobile-web-app-title Fast`
  - `format-detection telephone=no`, description, title "Fast"
  - icons: `icons/icon.svg` (svg) and `icons/icon-32.png`; `apple-touch-icon` → `icons/apple-touch-icon.png` (180)
- **Import page head**: the same CSP and meta subset, with links relative to `../`.
- **`robots.txt`**: `Disallow: /`. **`.nojekyll`** is present for GitHub Pages.
- **Icon source**: `icons/icon.svg`, 512 square, a single stroked line on the night colour.
  - `tools/render-icons.mjs` (`npm run icons`, headless Chromium) renders: apple-touch 180, 192, 512, 32, and maskable 512 with the art scaled to 80% inside the safe zone.

---

### 14. Content Security Policy (both HTML pages, as a meta tag)

`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`

Consequences for a rebuild:
- No inline scripts. That is why `strip-hash.js` is a separate file.
- No `<style>` blocks and no `style="…"` attributes. Dynamic values go through `element.style.setProperty`. Today these are:
  - sliding pill `--x`, `--y`, `--w`, `--h`
  - scale `--n`
  - choice `--cols`
- Nothing loads from another origin, fonts included.
- Downloads use `blob:` object URLs, which `img-src` allows.
- Shortcut handoffs are navigations to `shortcuts://` URLs, not fetches.

---

### 15. Offline behaviour

- Every file is precached, so the app works fully offline after the first controlled load: saving data, every tab, and the import route (with or without the trailing slash).
- **Test** `offline.spec.js`:
  1. Spawns its own server on port `4180 + workerIndex` (+20 for WebKit) and installs the clock at Sat 2026-09-26 14:00.
  2. Loads, waits for the SW to be ready, reloads, and asserts the page is controlled.
  3. Kills the server and confirms it is down. Playwright's offline switch is not used, because it misbehaves in WebKit on Windows.
  4. Reloads and checks:
     - `[data-block="before"]` is visible
     - the font families Cormorant Garamond, EB Garamond and Jost loaded
     - Start a meal → start eating still saves (`[data-block="open"]`)
     - every tab gets `aria-current`
     - `import/#w=…` (3 entries) shows "Imported 3 entries."
     - `import#w=…` (no slash) shows "Imported 1 entry." with an empty hash afterwards

---

### 16. Fonts (bundled)

- Latin subset, woff2, `font-display: swap`, one static file per weight:
  - Cormorant Garamond 600 and 700
  - EB Garamond 400 and 500
  - Jost 500
- Licence in `docs/fonts/OFL.txt`. `@font-face` rules in `docs/css/fonts.css`, generated.
- `tools/fetch-fonts.mjs` (`npm run fonts`) downloads them once from Google Fonts with an old Chrome user agent, which gets static per-weight files instead of variable fonts. File names carry a content hash.
- At runtime the app never touches the network for fonts.
- Body text uses `font-variant-numeric: lining-nums tabular-nums`. Keep the WebKit lining-figure workaround (§24).

---

### 17. Persisted-storage request

- `requestPersistence()`:
  - returns null when `navigator.storage.persist` is missing
  - returns true if `persisted()` is already true
  - otherwise returns the result of `persist()`
  - returns null on any error
- The result is saved to `settings.persisted` only when it differs from the stored value. This write causes the single redraw after start that tests wait for.
- **More, Storage panel**:
  - `persisted === true`: "Kept on this iPhone. The browser has agreed not to clear it when space runs low."
  - otherwise: "iOS may clear this data if the iPhone runs very low on space. Weekly backups keep it safe."
  - Plus, when not standalone: "You are using Fast in the browser. Add it to your Home Screen and use it from there: the Home Screen app keeps its own data."

---

### 18. iOS Home Screen specifics

- **Separate storage**. A Home Screen web app has its own storage, apart from Safari. A Shortcut can only open links in Safari, so weight comes in by clipboard paste.
  - Standalone detection: `matchMedia('(display-mode: standalone)').matches || navigator.standalone === true`, used in More and on the import page.
- **Act inside the tap**. iOS allows clipboard reads and the share sheet only inside the tap that asked.
  - `button()` calls the handler synchronously in the click.
  - While a returned promise is pending, the button ignores further taps and sets `aria-busy="true"`, so there are no double records.
- **Clipboard import (`importWeight`)**:
  1. Read `navigator.clipboard.readText()` first, straight from the tap; iOS shows its Paste bubble.
  2. Go to `weight` if not already there.
  3. If the clipboard cannot be read: set `showPaste = true` and flash for 12 s "The clipboard could not be read. Long-press the paste box below and tap Paste."
  4. Otherwise `importText(text)`:
     - Failure: `showPaste = true` and flash "`<message>` Run the Fast Weight shortcut, then tap Import weight again."
     - Success: flash the counts message, reset `weightDay`, and clear the clipboard (`writeText('')`).
- **Paste box** (`weight.js` `pasteTarget`):
  - A textarea with `inputmode="none"`, autocomplete, autocorrect and spellcheck off.
  - `aria-label` "Paste the weight data here", placeholder "Long-press here, then tap Paste".
  - `beforeinput` refuses everything except `insertFromPaste`, so weight can never be typed.
  - On `paste` it prevents the default, reads `text/plain`, clears and blurs the box, then imports. Nothing pasted is ever rendered.
  - The intro copy: "If the clipboard could not be read, paste here instead. Nothing you paste is shown."
  - Pinned by `weight.spec.js`.
- **Shortcut URLs**:
  - Weight: `shortcuts://run-shortcut?name=Fast%20Weight`, as a link "Run the Fast Weight shortcut".
  - Alarms: `shortcuts://run-shortcut?name=Fast%20Timer&input=text&text=<minutes>`, with minutes ≥ 1 and rounded.
  - The alarm fires only when `settings.alarms` is on. Tests set `window.__fastOpened = []` to record URLs instead of navigating.
- **Share sheet (`deliverFiles(files, title)`)**:
  - Builds `File` objects. If `navigator.share` and `canShare({files})` are both available, calls `share({ files, title })`.
  - Resolves `'shared'`, or `'cancelled'` on AbortError. Any other error or no support falls back to an `<a download>` click with a blob URL, revoked after 30 s, and resolves `'downloaded'`.
  - On cancel nothing changes: no flash, and `lastBackupAt` and the calendar fingerprint stay as they were.
  - File names: `fast-backup-YYYY-MM-DD.json`, five CSV files, `fast-reminders.ics`.
- **Private Browsing** blocks IndexedDB, which leads to the fatal screen (§1).
- **Suspension** can drop the DB connection. Every transaction reopens and retries once (§3).
- **Returning from a Shortcut or another app** triggers `visibilitychange`, which reloads from the DB and re-checks the zone (§1).
- **Help and README** steps to install: Safari → Share (in iOS 26, inside the ••• button at the bottom right) → Add to Home Screen → keep Open as Web App on → Add → from now on open from the icon. "The Home Screen app keeps its own data, separate from Safari."

---

### 19. Weight payload channels (platform side)

- **`strip-hash.js`** runs before render.
  - On `/import/` it takes any non-empty hash.
  - On the main page it takes only hashes matching `^#(w|b)=` (case-insensitive).
  - It stores the payload in `window.__fastPayload` and calls `history.replaceState(null, '', pathname + search)`, so the numbers are never shown in the address bar.
- **Accepted payload forms** (`core/weight.js` `unwrapPayload`): a URL, `#w=…`, `w=date:kg,…`, `b=<base64>`, bare Base64 (what the Shortcut puts on the clipboard), or a bare list. URL-decoding is attempted.
- **Import page** (`/fast/import/`, `import-page.js`):
  1. Loads the store and sets `installedAt` if missing.
  2. Imports and renders:
     - label "Weight import"
     - the result message (`role="status"`, `data-testid="import-result"`)
     - "Fast shows your 7-day average, counting every weigh-in. Each weigh-in is listed in the CSV export."
     - when not standalone: "This page opened in Safari, so it saved to Safari's copy of Fast. The Home Screen app keeps its own data: there, use Import weight on the Weight screen."
     - an "Open Fast" link to `../#weight`
     - the scenery in the current phase, computed once with no tick
  3. With no payload: "This link holds no weight data." If storage fails: "Fast could not open its storage here."
- **Main page with a payload**: it switches to `#weight` and the result appears in the flash.
- **Messages give counts only, never a weight** (`weight-import.js`). Tests scan the page text for any raw value.
  - "No weight data found."
  - "Nothing imported. N entries skipped: check that Health uses kg and the iPhone uses the Gregorian calendar."
  - "Nothing imported: these look like pounds. In the Health app, set the weight unit to kg, then run the Shortcut again."
  - "Imported N entries." or "Nothing new to import.", followed by optional " N already saved." and " N skipped."

---

### 20. Backup, restore and reset data semantics

These belong to More; here is the platform view.
- **Backup JSON** (`core/backup.js`):
  - `{ app: 'fast', schema: 1, version, exportedAt: ISO, data: { days[], meals[], outside[], temptations[], weights[{date,kg}], settings[{key,value}] } }`
  - Written with `JSON.stringify(…, null, 1)`, type `application/json`, file `fast-backup-<todayKey>.json`.
  - After a successful share or download, `lastBackupAt = now`.
  - Flash: "Backup handed to iOS. Keep it in Files or iCloud Drive." / "Backup file downloaded."
- **Parse** (`parseBackup`). Error messages:
  - "This file is not a Fast backup." (bad JSON, wrong `app`, no `data`, or non-numeric `schema`)
  - "This backup comes from a newer version of Fast." (`schema > 1`)
  - "This backup is incomplete." (any store array missing)
  - A file that fails to read gives "That file could not be read."
- **Per-store validity**:
  - days: valid `day`, numeric-or-null bites
  - meals, outside, temptations: numeric `id`, valid `day`, numeric `startedAt`/`at`
  - weights: valid `date`, numeric `kg`
  - settings: string `key`
  - Damaged entries are dropped and counted in `skipped`.
- **Restore sheet** (`name: 'restore'`):
  - "Replace everything on this iPhone with this backup?"
  - "Backup from `<Weekday d Month>|an unknown date`: N windows, N meals, N weigh-ins and N temptations." Windows means days with a `firstBite`.
  - When entries were dropped: "N damaged entry/entries will be left out."
  - "Replace my data" (`confirm-restore`) shows the flash "Backup restored."; "Cancel" (`cancel-restore`).
- **Backup reminder notice on Today**:
  - Shown only when there is data (days, meals or weights) and 7 days have passed since `lastBackupAt`, or since `installedAt` when there is no backup.
  - Copy: "Backup due. The last one was <ago>." or "No backup yet.", with a Back up button.
- Reset and restore semantics: see §6.

---

### 21. Scenery and daylight phases (behaviour)

**Phases** (`core/daylight.js`): `DAY_PHASES = ['dawn','morning','midday','afternoon','dusk','night']`.

`dayPhase(ts)`:
1. Takes the zone in force at `ts` from the zone timeline (not the raw device zone) and its UTC offset at `ts`, so summer time counts.
2. Picks the place:
   - Home zone `Asia/Kuwait`: Kuwait City, lat 29.37, lon 47.98.
   - Any other zone: `placeOf(zone)`, one point per IANA zone (old aliases included) from the tz database's zone.tab, about 450 entries, rounded to 0.1°.
   - A zone not listed: Kuwait's latitude, and longitude = the zone's standard offset (the smaller of its 1 Jan and 1 Jul offsets) / 4.
3. `sunTimes(key, offsetMin, lon, lat)` uses NOAA short formulas (equation of time and declination from the day of the year, zenith 90.833°). It returns sunrise, solar noon and sunset in local minutes. `cosHa` is clamped, so polar days and nights degenerate without errors.
4. With `t` = local minutes of day:
   - night if `t < sunrise − 30` or `t ≥ sunset + 30`
   - else dawn if `t < sunrise + 40`
   - else morning if `t < noon − 120`
   - else midday if `t < noon + 120`
   - else afternoon if `t < sunset − 40`
   - else dusk

**Pinned values**
- Kuwait almanac, within 6 min: 27 Sep sunrise 05:42 / sunset 17:41; 21 Jun 04:48 / 18:50; 21 Dec 06:36 / 16:53.
- Kuwait on 27 Sep: 04:30 night, 05:30 dawn, 07:30 morning, 12:00 midday, 15:30 afternoon, 17:30 dusk, 18:30 and 23:59 night.
- Away:
  - London 27 Sep: 06:00 night, 07:10 dawn, 13:00 midday, 19:00 dusk.
  - London 21 Jun: 20:45 and 21:30 dusk, 22:00 night, 05:00 dawn.
  - Sydney 15 Jan: 06:00 dawn, 19:00 afternoon, 20:00 dusk, 21:00 night.
- e2e (Kuwait, 27 Sep):
  - 05:50 dawn, 08:00 morning, 13:10 midday, 15:30 afternoon, 17:30 dusk, 21:00 night.
  - A screen open at 16:55 shows afternoon and turns dusk 10 min later without any user action. This holds on Today, on a paused Today and on empty Weight.

**Where the scenery appears**
- **Tuwaiq, "Edge of the World"** (`tuwaiqScene` via `art.scenery({ phase })`). It is always the last element:
  - Today, every mode, after the check-in panel
  - Weight with no weigh-ins
  - History's empty chart panel
  - the import page
- **Hisma ground** (`hismaGround`): drawn inside the fasting dial SVG under the sun's arc, wherever the dial appears (the Today hero and the smaller dial in the stage panel). Same phase.

**What changes with phase**
- Geometry is fixed: a seeded PRNG makes it deterministic. Only colours and the lit side of every rock change.
- Light direction: dawn LL (low from the left/east), morning L, midday T (overhead), afternoon R, dusk RR, night N (moonlight from the west).
- Tuwaiq by phase:
  - **Sky**: the page colour by day. Dawn adds a pale glow low on the horizon plus cloud lenses. Dusk has scalloped stepped bands plus a lens. Night has dark bands plus stars: 14 points, 4 of them bigger, the al-Thurayya knot of six, and Suhail as a four-point glint low in the south.
  - **Shadows**: morning and dawn throw the escarpment's shadows west across the plain (length 84 in the morning, 130 at dawn). Acacias cast shadows away from the sun, a pool underneath at midday, and long ones in the afternoon.
  - **Night**: the cliffs go dark with pale moon rims on the caps.
- Content of each scene:
  - **Tuwaiq**: 6 flat-topped prows stepping away to the right, a low outlier butte, braided wadis, acacias, and a camel string of 4 (one a calf).
  - **Hisma**: a frieze of far domes, two fluted jebels, red sand ramps, a near dune, an Umm Sarhej-style mushroom rock, 2 acacias and 3 camels.
- **Content rules** (owner decisions):
  - Real, recognisable places.
  - Acacias and a camel string only: no people, buildings or religious sites.
  - Palette only: no gradients, and no gold or clay in the scenery. Tests assert no `#F0B25C` fill or stroke in the dunes or dial ground.
  - The dial ground must stay clear of the time, the stage chip (longest label), the icons, the arc and the 0 h / 24 h ticks.
  - No rock face may be as pale as the panel under the dial.

**Redraw rule**
- The scenery SVG carries `data-phase=<phase>`. The shell sets `scenic` when the screen holds `svg[data-phase]`, and only then adds the phase to the signature.
- A new phase therefore redraws exactly the screens that show scenery. The import page draws once.

**Layout behaviour**
- Tuwaiq viewBox is `0 0 390 232`, horizon at y = 100, `preserveAspectRatio="xMidYMax slice"`. It spans edge to edge past the gutters.
- On Today and empty Weight its bottom (about 70 units) sits under the floating tab bar. Inside a panel it bleeds to the panel edges.

**Accessibility**
- `role="presentation"`, `aria-hidden="true"`, `focusable="false"`.
- With a `label` it would get `role="img"` and an `aria-label`, but no caller passes one.

---

### 22. Accessibility patterns

- **Document**: `lang="en"`, `dir="ltr"`. `main#view` has `aria-busy="true"` until the first render. Tab bar is `<nav aria-label="Sections">`; the current tab has `aria-current="page"`.
- **Sheets** (`sheet.js`):
  - `role="dialog"`, `aria-modal="true"`, `aria-label` (`opts.label` or "Details"), `data-sheet=<name>`, `tabindex="-1"`.
  - Focus moves into the sheet with `preventScroll`, so VoiceOver reads it without popping the keyboard.
  - Escape closes, unless `dismissible: false`. A scrim tap closes bottom sheets; full-screen flows have no scrim.
  - The root is `inert` while fading out. `html.locked` stops background scroll.
  - Opening a sheet replaces any open one. The standard head has a Close button (`data-action="close-sheet"`).
- **Live announcements**: the flash has `role="status"`. The open-window countdown has `role="timer"`. The weight summary box has `aria-live="polite"`. The import result has `role="status"`.
- **Choices, ratings, tabs** (`sliding`, `choice`, `scale`):
  - `role="radiogroup"`, named by `aria-labelledby` (visible label) or `aria-label`.
  - Each option is `role="radio"` with `aria-checked`. Scale buttons have `aria-label` = their number. The pill is `aria-hidden`.
  - Tap, or drag the pill along a single line:
    - The drag starts after 8 px of horizontal movement and captures the pointer.
    - `pointercancel` (the page scrolled instead) reverts to the committed choice.
    - A tap always counts, even on the current choice. A drag counts only if it lands on another option.
  - A redrawn selector glides from where the pill was, within 600 ms, at the same width.
- **Wheels** (time, date, option):
  - Each column has `role="spinbutton"` and `aria-label` ("Hours", "Minutes", "Date", "Choice" or a label), plus `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`. It has `tabindex="0"`.
  - Arrow Up/Down step by one. Hours and minutes loop like the iPhone clock (23 rolls on to 00).
  - Tapping an item picks it. The wheel group has `role="group"`. Items and decorations are `aria-hidden`.
  - A value is committed when scrolling rests (140 ms debounce or `scrollend`), or at once on a key or tap. Programmatic positioning never counts as a choice.
  - An unset wheel shows a fallback and the hint "Roll to set.". An optional Clear button resets it to null.
- **Buttons**:
  - Text, outline and pill kinds. `aria-busy` while saving. A pressed state lingers 180 ms on touch.
  - Owner rule: anything tappable must look tappable (a pill or an outline), never plain text.
- **Accessible names**:
  - Close X: `aria-label` "Close".
  - Tap notes and setting rows: "`<Title>`, `<value>`. Change".
  - Stage chip: "Stage: `<name>`. About the stages".
  - Stage stops: "`<name>`, `<range>`[, now]" with `aria-current` true/false.
- **Charts**: SVG `role="img"` with a descriptive `aria-label`, for example "7-day weight average on N days from … to …. Latest X kg on …." The weight chart has `tabindex="0"`.
  - Pickable legend items are buttons with `aria-pressed`.
  - A dimmed view says "Showing … only." with a "Show all" button.
- **Decorative SVG** (dial, icons, legend keys, scenery, glyphs): `aria-hidden="true"`, `focusable="false"`. The dial has an `sr-only` "Fasting for" before the live time.
- **Figures**: large digits and small units in the same text node run (for example "15h 10m"), so the read text equals the visible text.
- **Colour is never alone**:
  - A miss is clay stripes (an SVG hatch pattern) and always has words.
  - Every colour-coded visual has a labelled legend.
  - The dial legend: Fasted, Ahead, Now (sun), Goal (only when the goal tick is on the dial), Stage.
- **Focus**: outline only on `:focus-visible`.
- **Contrast**: 4.5:1 for text, 3:1 at 24 px and above, or bold ≥ 18.66 px. Audited on every screenshot (§23).
- **Reduce Motion** (`prefers-reduced-motion: reduce`):
  - All CSS animations and transitions drop to 1 ms. The pill moves without the glide.
  - Stage icon animations are set to `none`.
  - `fadeOut` resolves immediately. A wheel tap scrolls with `behavior: 'auto'`.
  - Tests:
    - `stages.spec.js`: zero named animations on the dial, the chip and the sheet's stage stops.
    - `today-card.spec.js` and `screens.spec.js` emulate reduced motion for stable shots.
- **Stage icon motion** (when motion is allowed):
  - Only the stage the fast is in moves (`.live`): on the dial, in the chip under the time, and the stage in view in the stages sheet.
  - CSS keyframes run per part (`.p0`, `.p1`, …). Movement only, in the icon's own ink: no glow, no gold, no blur.
  - Each icon's motion:
    - Digesting: the fork taps; the plate's ring breathes.
    - Settling: the drop sways; the level line rocks.
    - Switch: the flame flickers; its heart flickers.
    - Ketones: the bolt strikes twice, then rests.
    - Brain: it pulses; the folds fire in turn.
    - Sparing: the shield braces; a line runs down it.
- **Text input**: `maxlength` 60, `autocapitalize` sentences, autocomplete off.

---

### 23. Test setup

**Scripts** (`package.json`, `"type": "module"`, devDependency `@playwright/test ^1.63.0`):
- `npm test` → `node --test "tests/unit/*.test.js"`. It must end with `fail 0`; at the time of this survey: 111 tests, all passing.
- `npm run e2e` → `node tools/release.mjs && playwright test`. It must show nothing failed or flaky. A filtered run is not enough.
- `npm run serve` (`tools/serve.mjs [port]`, default 4173), `npm run release`, `npm run fonts`, `npm run icons`.

**Local server** (`tools/serve.mjs`) mirrors GitHub Pages:
- `docs/` is served under `/fast/`. `/` and `/fast` get a 301 to `/fast/`.
- A directory without a trailing slash gets a 301 to the slash form (the browser keeps the hash), then serves its `index.html`.
- Anything outside `/fast/` is a 404. Path traversal is blocked.
- `Cache-Control: no-cache`, with content types for html, js, css, json, webmanifest, svg, png, woff2, txt and ics.

**Playwright config** (`playwright.config.js`):
- `testDir: tests/e2e`, `timeout` 60 s, `expect` 7 s, `fullyParallel`, 3 workers, `list` reporter, `outputDir: test-results/artifacts`.
- `baseURL: http://localhost:4173/fast/`.
- Viewport 390×844, `deviceScaleFactor` 2, `isMobile`, `hasTouch`.
- `timezoneId: Asia/Kuwait`, `locale: en-GB`, `serviceWorkers: 'block'`.
- Projects: `webkit` and `chromium`. `webServer`: `node tools/serve.mjs 4173`, `reuseExistingServer`.

**Helpers** (`tests/e2e/helpers.js`):
- **Extended `test` fixture**: fails any test that requests a URL outside the app origin (except `blob:` and `data:`), or that throws an uncaught page error.
- **Time**: `T('YYYY-MM-DDTHH:MM')` gives a Kuwait-time Date; `ms()` gives epoch ms; `MIN`.
- **`openAt(page, when, route)`**:
  1. `page.clock.install({ time })`
  2. `goto('./' + route)`
  3. wait until `#view` loses `aria-busy`
  4. `settle`: poll the DB until a `persisted` setting exists, then `setTimeout 0` to let the follow-up redraw land
- **`seed(page, data)`**: `db.replaceAll` with empty defaults plus `data`, then reload, wait, settle.
- **`readDb(page)`**: returns `db.readAll()`.
- **`advance(page, minutes)`**: `clock.fastForward(minutes)` plus 1000 ms, so the 1-second tick runs.
- **Locators**:
  - `act` / `tap(name)`: `[data-action=name]:visible`, first match
  - `pick(scale, value)`: `button[data-scale][data-value]`
  - `choose(name, value)`: `button[data-choice][data-value]`
  - `sheet(name)`: `[data-sheet=name]`
  - `settings(obj)` turns an object into rows
- **Wheels**: `setTime(name, 'HH:MM')`, `setDate(name, key)` and `setPick(name, value)` act like a finger: `pointerdown`, then set `scrollTop`, then `scroll` and `scrollend`. Each retries for up to 5 s, because a save can redraw the column away.
- **Shares**: `captureShares(page)` replaces `navigator.share` and `canShare`; shared files land in `window.__shared` as `{ name, type, text, head }`, where `head` is the first 3 bytes for BOM checks. `sharedFiles(page)` reads them.
- **Seed data**: `tests/e2e/seed-data.js` `WEEK`, a fixed week of Sun 20 to Sat 26 Sep 2026. It has the same numbers as `tests/unit/review.test.js`.

**Test hooks the app exposes.** These form a contract: keep them, or rewrite the suite.
- `data-action` (buttons), `data-testid`, `data-block` (panels), `data-sheet`, `data-notice`
- `data-time` / `data-date` / `data-pick` with `data-part` and `.wheel-item[data-value|data-key]`
- `data-choice` / `data-scale` with `data-value`
- `data-mode`, `data-phase`, `data-stage`, `data-result`, `data-meal`, `data-day`, `data-series`
- `.tab[data-tab]` with `aria-current`
- `window.__fastOpened` (records shortcut URLs), `window.__fastPayload`
- importable `/fast/js/db.js`

**`screens.spec.js`** (design review and contrast audit):
- Runs in WebKit only (skips otherwise). Shots go to `test-results/screens/<name>.png`.
- Each shot waits 450 ms for fades. Writes retry up to 5 times, 300 ms apart (OneDrive locks).
- **Contrast audit** of every visible text node:
  - Needs 4.5:1, or 3:1 at ≥ 24 px or bold ≥ 700 at ≥ 18.66 px.
  - Background: the nearest ancestor with alpha > 0.5, stopping at `.sheet`; the page colour by default. A chosen option, scale button or current tab counts as on the ink pill (rgb 30,20,12).
  - Skips hidden elements, disabled buttons, opacity 0 and zero-size boxes. SVG text uses `fill`.
- About 100 named shots (01 to 90), covering:
  - Today in every mode
  - all sheets
  - add-meal, temptation
  - week, day, weight, more, help, history
  - pauses, undo bar, start screen, goals, long fast, streak, satiety, legends
  - stages, third day
  - travel (Dubai)
  - scenery in six phases (`90-<phase>-today` and `90-<phase>-foot`)

**`design.test.js`** (unit guards over `docs/**/*.{css,js,html,webmanifest,svg}`):
- Palette tokens exact, and no other hex colours. rgba is allowed only for (42,28,16,a) and (224,174,91,a).
- `border-radius` only `0` or `var(--r-*)`; `--r-pill: 999px`.
- No `box-shadow`, `text-shadow`, `drop-shadow`, `gradient(`, `backdrop-filter` or `filter: blur`. No Inter, Geist or Space Grotesk.
- **Copy rules** (docs files and README): no em dash, no emoji (`\p{Extended_Pictographic}`), no ✓✔✅, no "it's not X, it's Y".
- No `http(s)://` URL except the SVG namespace.
- Token contrast maths. The class `clay` is only allowed together with statement, display or figure classes.
- A redesign must rewrite the palette and token parts of this test, but keep the copy, origin and no-shadow/gradient rules if the owner keeps them.

**Unit test files**: `added-meal`, `daylight`, `design`, `files` (ics, csv, backup round trip and messages), `flexible`, `goals`, `history`, `insights`, `meal-types`, `pause`, `review`, `rules`, `satiety`, `stages`, `weight`, `zones`. They import from `docs/js/core/*` directly; core must stay DOM-free.

**Cloud-session browser setup** (CLAUDE.md):
- **Chromium**: `/opt/pw-browsers/chromium`. Use an untracked config that sets `launchOptions.executablePath`.
  - Present here: `playwright.local.config.js`, excluded through `.git/info/exclude`. It extends the base config with WebKit from `PLAYWRIGHT_BROWSERS_PATH` and Chromium from `/opt/pw-browsers/chromium`.
- **WebKit**:
  1. Needs `cdn.playwright.dev` allowed in the environment's network settings.
  2. curl `https://cdn.playwright.dev/builds/webkit/<revision>/webkit-ubuntu-24.04.zip`. The revision comes from `node_modules/playwright-core/browsers.json`; it is 2359 now.
  3. Unzip into `<scratchpad>/webkit-<revision>/` and run with `PLAYWRIGHT_BROWSERS_PATH` set to that folder.
  4. `apt-get install` the libraries the launch error names: libevent-2.1-7t64, libsoup-3.0-0, libavif16, libmanette-0.2-0, libenchant-2-2, libwoff1, libgstreamer-gl1.0-0, libgstreamer-plugins-bad1.0-0, and the like.
- **Without WebKit**, `screens.spec.js` skips. Shoot screens with an untracked copy that drops the skip, and say plainly which browser did not run.
- **On the owner's PC**:
  - `npx playwright install` times out; the browsers were curled into `%LOCALAPPDATA%\ms-playwright\`.
  - `gh` is at `%LOCALAPPDATA%\Programs\GitHubCLI\bin\gh.exe`.
  - Write scripts to files and run them with node (shell quoting is mangled).

**Ship sequence** (CLAUDE.md):
1. Update README and Help when behaviour changes.
2. Run `npm test` and `npm run e2e`; both must pass in full.
3. Stamp after the last edit.
4. `git commit -F <message file>` (PowerShell 5.1 splits quoted arguments). Commit with the no-reply address; never commit personal data or the owner's email.
5. Push, wait for the Pages build, and check that `https://asalkulaib.github.io/fast/js/version.js` shows the new release.

---

### 24. Gotchas to keep

- **WebKit lining figures**: WebKit ignores `lnum` on a digit alone in its own text node, so Cormorant draws an old-style figure. `figureParts` appends U+200B to a lone first digit. Playwright's `toHaveText` strips U+200B.
- **Redraw after start**: the app redraws once just after starting, when it saves `persisted`. Anything that reloads the page must wait for that (`openAt` and `seed` do).
- **Stale elements in WebKit**: WebKit can run `locator.evaluate` on an element a redraw just removed, so the wheel helpers retry.
- **Editing a CSS file**: when cutting CSS, remove exact brace-matched blocks.
- **`--rock-500`** cannot carry body text (it misses 4.5:1 with both ink and light words).
- **`navigator.storage.persist()` returning null** (API missing) with the default already null means no `persisted` write and no settle signal. The e2e `settle` helper would hang in such a browser.

## Additions from the completeness check

A second reader compared this inventory with the code, README, CLAUDE.md and tests, and found these missing or wrong. They are part of the contract too.

- Tapping a tab always navigates through app.go. Tapping the tab already shown re-parses the same hash and renders fresh: scroll to top and a fade-in. The Week tab goes to #week (the current week), History to #history and More to #more. Session focus (satietyFocus, historyFocus, weightDay) resets only when the route name changes.
- Sheet API semantics (sheet.js):
- Opening a sheet closes any open one instantly, with no fade (closeNow).
- api.close() fades out with the sheet root inert, then unlocks scroll.
- api.rerender() redraws in place, keeping the sheet's scroll.
- api.replace(build) swaps the content with a fade-in and scrolls to the top.
- A sheet stays open across route changes. The screen behind keeps ticking and can fully re-render, because the editing guard checks only inputs inside #view, not inputs in a sheet.
- Owner process rules (CLAUDE.md), part of the contract:
- The owner does not write code: do all the technical work and explain only steps on the phone, one at a time, in plain words.
- Before a big change, say what will be built and ask anything unclear. When the owner asks whether you understood, confirm before acting.
- Check every visual change in screenshots at 390×844 (screens.spec.js into test-results/screens, with the contrast audit) before it goes live.
- Update README.md and the Help screen whenever behaviour changes, and keep CLAUDE.md current.

## Open questions found while cataloguing

- The e2e suite was not run in this survey; behaviour is read from source and test assertions. Unit tests were run: 111 pass.
- Scenery geometry (every coordinate and the per-phase colour tables in scenery.js) is not transcribed. It is deterministic and should be reused from docs/js/ui/scenery.js as is, or re-drawn under the same rules.
- dayPhase in polar day or night (cosHa clamped) is untested. In polar night, the hour around solar noon reads as 'dawn'.
- There are no IndexedDB migrations (DB 'fast' v1). A rebuild that changes the DB name, store names or record shapes must migrate the owner's existing on-phone data, or restore it from a backup file. The owner's data exists only on the iPhone.
- If navigator.storage.persist is missing (requestPersistence returns null while the stored default is also null), no 'persisted' write happens. The e2e settle helper relies on that write.
- CSV and ICS file contents, calendar fingerprint/sequence rules, Weight averaging and the Help/More screen copy are referenced only where they touch the platform; they belong to other areas.
- Exact counts of e2e tests (about 191) and screenshots (about 100) are approximate, taken from grep counts.
