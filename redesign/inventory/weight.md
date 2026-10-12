## Weight: import by clipboard, the 7-day average, the chart, the Week block, Help

Scope: every weight feature in Fast. Visual styling is left out. Every rule below comes from the code. "Pinned" means a test asserts it.

---

### 0. Source map

| Concern | File |
|---|---|
| Pure rules: payload unwrapping, parsing, limits, averages, series, runs, time frames, week summary | `docs/js/core/weight.js` |
| Import orchestration and the count-only messages | `docs/js/weight-import.js` |
| Weight screen (big box, chart section, table toggle, import section, paste box) | `docs/js/ui/weight.js` |
| Chart SVG, interaction, legend, table | `docs/js/ui/chart.js` |
| `/import/` page | `docs/import/index.html`, `docs/js/import-page.js` |
| Takes the payload out of the address bar before render | `docs/js/strip-hash.js` (loaded by `docs/index.html` and `docs/import/index.html`) |
| App shell: `importWeight`, `importText`, the link import at boot, routes, resets of the chosen day | `docs/js/app.js` (lines ~85-125, 238-265, 323, 405-431) |
| Storage | `docs/js/store.js` (`saveWeights`, `DEFAULTS.lastImportAt`, `resetHistory`, `restore`), `docs/js/db.js` (store `weights`, keyPath `date`) |
| Today notice "Weight import due" | `docs/js/ui/shared.js` (`weightImportDue`, `notices`) |
| Week tab weight block | `docs/js/ui/week.js`, `docs/js/core/review.js` (`weekReview` → `weekSummary`) |
| History metric switch (Weight is History's third view) | `docs/js/ui/history.js` (`metricSwitch`) |
| Help screen | `docs/js/ui/help.js` |
| Offline / redirect of `/import` | `docs/sw.js` |
| CSV and backup | `docs/js/core/csv.js`, `docs/js/core/backup.js` |
| Tests | `tests/unit/weight.test.js`, `tests/e2e/weight.spec.js`, `tests/e2e/satiety.spec.js` (legend, Weight in History), `tests/e2e/review.spec.js` + `tests/unit/review.test.js` (Week block), `tests/e2e/offline.spec.js` (import offline), `tests/e2e/files.spec.js` + `tests/unit/files.test.js` (CSV, backup), `tests/e2e/reset.spec.js`, `tests/e2e/screens.spec.js` (shots 32, 32b-e, 33, 36, 37), `tests/e2e/today-card.spec.js` (empty Weight takes the new light) |

---

### 1. Data model and storage

- IndexedDB database `fast` v1, object store **`weights`**, keyPath **`date`**. Record: `{ date: 'YYYY-MM-DD', kg: number (rounded to 2 decimals), importedAt: ms timestamp }`. A date holds one value. Re-importing a date overwrites it (`putMany`).
- In memory: `store.state.weights = Map(date -> kg)`. `importedAt` is written but never read by the UI.
- Settings (store `settings`, `{key, value}` rows):
  - `lastImportAt` (ms or null). Set to now on every successful import, even "Nothing new to import." Default null.
  - `weightRange`: `'1m' | '3m' | '6m' | 'ytd' | 'all'`. A missing or invalid value means `'3m'`.
  - `historyMetric`: `'fast' | 'feast' | 'weight'`. History's view, remembered.
  - `installedAt` is used by the import-due rule. The import page sets it when it is missing.
- In-memory UI state only (`app.ui`, lost on reload):
  - `showPaste`: whether the paste box shows.
  - `showTable`: weight table shown.
  - `weightDay`: the day chosen on the chart, or null for the latest.
- Weights cannot be typed in, edited or deleted one by one. The code comment says: "there is no way to type a weight in". They are removed only by Reset all history, or replaced by a restore.
- Reset all history (More) deletes every weigh-in and sets `lastImportAt: null`. Its final sheet counts them: "`N weigh-ins` ... will be deleted for good."
- Backup JSON: `data.weights: [{date, kg}]` (no `importedAt`). On restore a row is valid only if `isDayKey(date)` holds and `kg` is a finite number. Damaged rows are dropped and counted. The restore sheet says "`N` weigh-ins". `lastImportAt` and `weightRange` come back from the backup.
- CSV export: `fast-weight.csv` with header `date,kg`, one row per stored weigh-in, oldest first, raw kg as stored (e.g. `2026-09-20,104.6`). It has a UTF-8 BOM and CRLF line ends. More says: "The weight file holds your raw entries."

---

### 2. Payload format and parsing (`core/weight.js`)

**What the Shortcut produces (current version):** Base64 of a comma-joined list `yyyy-MM-dd:<Value>`, for example `2026-09-19:104.6,2026-09-20:104.3`. Base64 Encode uses Line Breaks None. The older Shortcut put `w=` before the list, so it sends Base64 of `w=2026-...`. Both are accepted.

**Accepted input shapes** (`unwrapPayload`). Each resolves to the bare list, and `tests/unit/weight.test.js` pins every one:
`w=LIST`, `#w=LIST`, a full URL `https://.../import#w=LIST`, URL-encoded `.../import/#w=<encodeURIComponent(LIST)>`, `base64("w=LIST")`, `b=<base64>`, `#b=<base64>`, a bare `LIST`, and base64 with surrounding whitespace or a newline.

Algorithm, up to 4 passes:
1. Trim.
2. If the text contains `#`, keep only what follows it.
3. `decodeURIComponent`, ignoring errors.
4. Normalise digits (step 3 below), then trim.
5. Starts with `w=` (any case): return the rest.
6. Starts with `b=` (any case): base64-decode the rest and loop again.
7. Contains `\d{4}-\d{2}-\d{2}\s*[:=]` anywhere: return the text.
8. Otherwise try to base64-decode the whole text and loop again.

When nothing resolves, the result is null.

- **Base64 decoding:** whitespace is removed. URL-safe `-` and `_` map to `+` and `/`. The text must match `^[A-Za-z0-9+/]+={0,2}$`. The bytes must be strict UTF-8 (`TextDecoder fatal`). Any failure gives null.
- **Digit normalisation:** Arabic-Indic `٠-٩` and Persian `۰-۹` become ASCII digits. `٫` becomes `.`, `٬` is removed and `،` becomes `,`.

**Parsing** (`parseEntries(list, todayKey)`):
- Every match of `(\d{4}-\d{2}-\d{2})\s*[:=]` starts an entry. Its value runs up to the next match, with trailing whitespace, commas, `;` and `|` stripped. Commas, semicolons and newlines therefore all work as separators, and `=` works in place of `:`.
- Pounds: if the segment contains `lb` or `lbs` (any case, word end), the value is multiplied by `0.45359237`.
- Number cleaning:
  - Every character except digits, `.` and `,` is removed, so `kg` and spaces go.
  - A comma with no dot is a decimal comma (`104,6` reads 104.6).
  - Any other commas are removed as thousands separators.
- Every value is rounded to 2 decimals (`104.59999999999` becomes `104.6`).
- **Skipped (counted)** when:
  - the date is not a real calendar date (`2026-02-30`);
  - the date is after today (`date > todayKey`; today is in the current, possibly travel, time zone);
  - the kg value is not within **30 to 180 inclusive** (`MIN_KG = 30`, `MAX_KG = 180`, which also catches most readings taken in pounds);
  - the value is empty.
- **A date repeated within one import:** the last value wins and moves to the last position. The Shortcut sorts oldest first, so the day's latest weigh-in wins.
- Returns `{ entries: Map(date -> kg), skipped, found }`. `found` is never shown.
- `parseImport(input, todayKey)` returns null when the input does not unwrap to text that contains a dated entry. Examples of null (pinned): `''`, `'hello there'`, `'https://example.com'`, base64 of plain text, `'#w='`, `'w=nothing'`.

**Pounds guard** (`looksLikePounds(existing, entries)`):
- It applies only when something is already stored.
- It takes the median of the new values and divides it by the median of the 30 most recent stored values. A ratio strictly between **1.9 and 2.5** blocks the whole import.

**Diff** (`diffEntries`): for each incoming date, `added` if new, `updated` if the stored kg differs, `unchanged` if equal.

---

### 3. Import flows

#### 3a. "Import weight" button (main path)
Where it appears:
- Weight screen import section: primary, full width, `data-action="import-weight"`.
- Today notice: secondary, `import-weight-notice`.

On tap (`app.importWeight`):
1. It reads the clipboard **inside the tap** (`navigator.clipboard.readText()`), so iOS shows its small "Paste" bubble. It does not ask first.
2. If the route is not `weight`, it goes to `#weight`. From `#history` this changes the route, which resets the chosen chart day.
3. If the clipboard API is missing or `readText` throws: it sets `showPaste = true` and shows the message bar for 12 s with "The clipboard could not be read. Long-press the paste box below and tap Paste." Then it stops.
4. Otherwise it calls `importText(text)`. An empty clipboard gives "No weight data found..."

`importText(text)` runs the import (3e), then:
- `showPaste = !ok`: the paste box appears after any failure and disappears after a success.
- On success, `weightDay = null`, so the big box shows the latest figure.
- Message bar for **12 s**. On success, the message alone. On failure, the message plus " Run the Fast Weight shortcut, then tap Import weight again."
- On success it **clears the clipboard** (`writeText('')`, errors ignored).

The button ignores repeat taps while the import is saving (shared `button` busy guard).

#### 3b. Paste box (fallback)
- Shown under Import weight only while `app.ui.showPaste` is true.
- Copy above it: "If the clipboard could not be read, paste here instead. Nothing you paste is shown."
- Element: a one-row textarea.
  - `inputmode="none"`, so no keyboard appears.
  - autocomplete, autocorrect and spellcheck are off.
  - aria-label "Paste the weight data here".
  - placeholder "Long-press here, then tap Paste".
  - `data-testid="paste-target"`.
- **Typing is refused:** `beforeinput` cancels any input type except `insertFromPaste`. Pinned: typing leaves the value empty and saves nothing.
- On `paste`: the default is cancelled and `text/plain` is read. The box is cleared and blurred, then `importText` runs. **The pasted text is never rendered**; in the current build its text is also transparent.
- Fallback `input` handler: anything that does land in the box is cleared at once and imported.

#### 3c. Link import on the main address
- `strip-hash.js` runs synchronously before the page renders. It acts when the hash is longer than 1 character and either the path ends in `/import` or `/import/` (any hash), or the hash starts with `#w=` or `#b=` (any case).
- It stores `hash.slice(1)` in `window.__fastPayload` and runs `history.replaceState` without the hash. The numbers never stay in the address bar or the history.
- App boot, after the first render: if a payload is waiting, it is cleared and the route is set to `weight`. The URL is replaced with `#weight` and `importText(payload)` runs, so the message bar shows the result. Pinned: `./#b=<base64>` gives the flash "Imported 14 entries." with the URL hash `#weight` and no raw value on screen.

#### 3d. `/import/` page
- Static HTML with the same CSP, `noindex, nofollow` and `referrer no-referrer`. While loading it shows the label "Weight import" and skeleton lines (`aria-busy`).
- `/fast/import` without the slash redirects to `/fast/import/` and keeps the hash. GitHub Pages does this, and `sw.js` does the same offline with a 301. Pinned online and offline.
- The page and its scripts are precached, so it works offline. Pinned: "Imported 3 entries." offline, and "Imported 1 entry." through the no-slash URL offline.
- Run order:
  1. Load the store; set `installedAt` if it is missing.
  2. If there is a payload, run `importWeightText(payload)` and show its message. Without a payload it says "This link holds no weight data."
  3. If storage fails: "Fast could not open its storage here."
- Page content after load:
  - Label "Weight import".
  - The message as a statement, `role="status"`, `data-testid="import-result"`. It has **no** "Run the Fast Weight shortcut..." suffix.
  - "Fast shows your 7-day average, counting every weigh-in. Each weigh-in is listed in the CSV export."
  - Only when **not** running as the Home Screen app (`display-mode: standalone` false and `navigator.standalone` not true): "This page opened in Safari, so it saved to Safari's copy of Fast. The Home Screen app keeps its own data: there, use Import weight on the Weight screen."
  - Button-link "Open Fast", which goes to `../#weight`.
  - The Tuwaiq scenery in the light of the current day phase.
- Why it exists, and its limit, from the README: "Why the clipboard: iOS gives a Home Screen web app its own storage, separate from Safari, and a Shortcut can only open links in Safari. Fast also accepts a link, `https://asalkulaib.github.io/fast/import/#w=2026-09-25:104.6,...`, but opened from a Shortcut it saves into Safari's copy of Fast, not the Home Screen app."

#### 3e. `importWeightText(text)` and every message (counts only, never a weight)
Each message is listed with its condition and its `{ok}` value. `entries(n)` reads "1 entry" or "N entries".
1. `parseImport` returns null: **"No weight data found."** (`ok: false`)
2. Parsed with nothing valid but some skipped: **"Nothing imported. N entries skipped: check that Health uses kg and the iPhone uses the Gregorian calendar."** (`ok: false`) Skipped 0 with nothing valid falls back to "No weight data found."
3. The pounds guard trips: **"Nothing imported: these look like pounds. In the Health app, set the weight unit to kg, then run the Shortcut again."** (`ok: false`)
4. Otherwise it **saves all parsed entries**, unchanged ones included, with a fresh `importedAt`, then sets `lastImportAt = now`. The message is built from parts joined by spaces:
   - `imported = added + updated`. If above 0, "Imported N entries." (or "1 entry"); if 0, **"Nothing new to import."**
   - If any unchanged: "N already saved."
   - If any skipped: "N skipped."
   - Pinned examples: "Imported 14 entries.", "Imported 3 entries.", "Imported 1 entry. 7 already saved."

Rule (pinned by `expectNoRawValues`): after any import, the page text contains none of the imported raw values and no comma-decimal form (`/\d{2,3},\d/`).

#### 3f. Import-due notice on Today (`weightImportDue`)
- **Due** when `lastImportAt` is set and `now − lastImportAt ≥ 7 days`, or when there has never been an import, `installedAt` is set and `now − installedAt ≥ 2 days`.
- Notice text: "Weight import due." (after an earlier import) or "No weight imported yet." (never), with the button **"Import weight"** (runs 3a).
- It sits among Today's notices, after the unlogged-days and backup notices. No test pins it.

---

### 4. The 7-day average rule

- `MIN_WEIGH_INS = 1` (pinned). Every weigh-in counts, a single one included: one gives itself, two their mean, none gives no figure (`avg: null, n: 0`). The owner chose this so nothing goes stale, over the old rule of hiding weeks with fewer than 3.
- `averageBetween(weights, from, to)`: the plain mean of the stored kg on dates in the inclusive range. `n` counts weigh-in days, at most 7 for 7 days.
- **Big box, rolling** (`summaryOn(weights, end)`):
  - `current` covers the 7 days `end−6 .. end`.
  - `previous` covers `end−13 .. end−7`.
  - `change = current.avg − previous.avg`, null if either is missing.
  - `rollingSummary` anchors on the **latest weigh-in date**, not today, so the figure stays steady between weekly imports. Pinned: 14 daily values give n = 7 and 7, and the expected change.
- **Chart series** (`rollingSeries`): for **each date with a weigh-in**, oldest first, the 7-day average up to and including that date: `{date, avg, n}`. Its last point always equals the big box's latest figure (pinned).
- **Week tab** (`weekSummary(weights, weekStart)`): this is the **calendar week, Sunday to Saturday**, not rolling. `current` is the mean of that week and `previous` the mean of the week before, each counting a single weigh-in. `change = current − previous`. Pause days do not affect weight.
- Display rounding: every kg figure uses `toFixed(1)`. A signed change uses `+` above 0, U+2212 `−` below 0 and nothing at exactly 0. The sign comes from the **unrounded** value, so −0.04 shows as "−0.0 kg".

---

### 5. Weight screen

#### 5a. Navigation
- Weight is the **third view of History**. The History page top shows a 3-way switch `Fast | Feast | Weight` (`data-choice="history-metric"`).
- Choosing Weight saves `historyMetric: 'weight'` and goes to `#weight`. Choosing Fast or Feast saves the metric and goes to `#history`.
- The History tab opens `#history`, which shows Weight when `historyMetric === 'weight'` (pinned: "The History tab remembers Weight").
- `#weight` is also a direct route. The History tab is marked current on it.
- Header: the shared screen header, title "History". It also carries the shared "Tempted?" button when no window is open and the day is not paused. The metric switch sits under it.

#### 5b. Empty state (no weigh-ins at all)
- Header and switch.
- Headline **"No weigh-ins yet"**, then "Your scale sends each weigh-in to Apple Health. A Shortcut brings them here, and Fast shows your 7-day average."
- The import section (5h), then the Tuwaiq scenery for the current day phase. It redraws when the phase changes (pinned in `today-card.spec.js`).
- No box, chart or table.

#### 5c. Big box (`data-block="weight-summary"`, `aria-live="polite"`)
It shows the summary for `chosen || latest`.
- Label "7-day average".
- Figure: `<avg 1 dp>` with a small unit " kg", e.g. "104.4 kg" (`data-testid="weight-average"`). If `current.avg` is null: "No weigh-in in these 7 days." This cannot happen today, because the box always ends on a weigh-in day.
- Margin notes (`data-testid="weight-notes"`):
  - **"Up to"** followed by the end day as `D Mon` ("7 Oct", "15 Aug").
  - **"Weigh-ins"** followed by "`n` of 7".
- Change line (`data-testid="weight-change"`): "Change from the 7 days before: −1.1 kg." when both weeks have data. Otherwise "No weigh-in in the 7 days before." Both take one line, so the box keeps its height.
- **"Back to latest"** pill (`data-action="weight-latest"`):
  - Always laid out. While the latest is shown it is hidden but keeps its space, and it is disabled.
  - Visible and active only while a chosen day is shown.
  - Tap: `weightDay = null`, then redraw.
- Pinned figures:
  - The import example gives "104.4 kg" with "Change from the 7 days before: −1.1 kg."
  - One weigh-in of 104.1 gives "104.1 kg"; adding 103.9 gives "104.0 kg".
  - A chosen lone 15 Aug weigh-in gives "103.0 kg", "15 Aug", "1 of 7".
  - A chosen 3 Oct gives "99.1 kg" and "−0.9 kg".

#### 5d. Chart section (`data-block="chart"`)
1. Label "Over time".
2. **Time frame switch**, aria-label "Time shown", `data-choice="weight-range"`. Options: "1 month" (1m), "3 months" (3m), "6 months" (6m), "This year" (ytd), "All" (all).
   - Default 3 months. The choice is saved to `settings.weightRange` and survives a reload (pinned).
   - Changing it resets the chosen day to latest (pinned).
3. **Range start** (`rangeStart(range, todayKey)`). Every frame ends today.
   - 1m/3m/6m: the same day of the month, N months back, clamped to the month's length (`1m` from 31 Mar gives 28 Feb). The count crosses year ends (`3m` from 15 Jan 2026 gives 15 Oct 2025).
   - ytd: 1 Jan of this year.
   - all: null, which becomes the first series date (or today when there is none).
   - Shown points are the series points with `date ≥ from`. Pinned counts with data from Mar, Aug and Oct and today 8 Oct: 3m gives 7 points, 1m gives 3, ytd gives 10.
4. The chart, or **"No 7-day average in this time yet."** when the frame holds no point (`data-testid="weight-chart-empty"`). In that case there is no SVG and no table toggle.
5. **Note**, always shown, even when the frame is empty (`data-testid="weight-chart-note"`): "Each point is your 7-day average on a day you weighed in, the same figure as at the top: the average of every weigh-in in the 7 days up to it, even a single one. A week with no weigh-in breaks the line."
6. Table toggle (5g), only when points exist.

Inside the chart block, after the SVG:
- **Legend** (`data-testid="weight-legend"`, pinned labels in order): **"7-day average"** (line key) and **"Latest"** (solid mark key). It is static, not tappable.
- **Hint** (`.chart-readout`, pinned): "Touch the chart to see a day above." It never changes.

#### 5e. What the chart draws (`weightChart(points, {from, to, selected, onSelect})`)
- One series, the shown 7-day averages, placed **by date**:
  - x is proportional to days since `from` over `daysBetween(from, to)`.
  - If the span is 0 (from = to), the point is centred.
  - Pinned: in 3 months ending 8 Oct, 7 Oct sits beyond 97% along, and 26 Aug sits between 50% and 56%.
- Current geometry, which the e2e tests use for click positions: viewBox 340×190, padding top 18, right 46, bottom 30, left 38, so the plot width is 256.
- **Y scale:**
  - Bounds come from the shown averages. If max − min < 1 kg, the range widens to 1 kg around the middle.
  - The step is the first of [0.2, 0.5, 1, 2, 5, 10] with range/step ≤ 4 (else 10). min floors and max ceils to the step.
  - A horizontal gridline sits at each step, labelled with 1 decimal if the step is under 1, else whole kg.
- **X labels:**
  - The first day, the middle day (only if the span is over 1 day) and today (only if the span is over 0).
  - Format "25 Sep", or "Sep 2026" when the span is over 330 days.
  - A single label is centred when the span is 0.
- **Line breaks (`chartRuns`):**
  - Consecutive points **more than 7 days apart** start a new run. Exactly 7 days apart stay joined; 8 break (pinned).
  - Each run of 2 or more points is one stroke. A run of 1 draws no line.
  - Pinned: the Aug, gap and Oct data draw two strokes (2 `M` commands) through 7 points.
- **Marks:**
  - If every gap between neighbouring points is **at least 10 chart units** (`MARK_ROOM`), every point gets a small square mark.
  - Otherwise only **lone points** (runs of 1) and the latest keep marks; the line carries the rest.
  - The **latest point** always has a larger, emphasised mark (class `latest`, one only, pinned).
  - Pinned: dense 3m data gives exactly 1 mark. Daily data with a lone 15 Aug gives 2 marks (lone + latest).
- **Latest value label:** the latest average with 1 decimal, beside the latest mark (`.chart-end`, e.g. "104.4"; pinned).
- **Crosshair:** a vertical line, hidden until a day is chosen or touched.
- **Accessibility:** `role="img"`, focusable. aria-label: "7-day weight average on N days from Fri 25 Sep to Thu 8 Oct. Latest 104.4 kg on Wed 7 Oct." ("day" when N = 1.)

#### 5f. Interaction: touch or drag moves the big box
- **pointerdown** on the chart snaps to the point nearest in x, places the crosshair and calls `onSelect(date)`.
- **pointermove** follows while a mouse button is held, or always for touch. A mouse picks a day only while pressed.
- The chart allows a sideways drag while the page still scrolls vertically (`touch-action: pan-y`).
- **pointercancel** (the browser turned the touch into a scroll) restores the day that was active before the touch. Pinned in Chromium: an upward swipe starting on the chart leaves the box on the latest.
- **Keyboard:** focus shows the active point. ArrowLeft and ArrowRight step one point, clamped to the ends.
- `onSelect(date)` replaces the big box **in place**, without redrawing the screen:
  - The latest date stores `weightDay = null` and hides the pill.
  - Another date stores it and shows "Back to latest".
  - It skips the work when nothing changed.
- Pinned: a drag from 20% to 70% ends on 1 Oct; a click near the start shows "7 of 7" in Sep.
- **The chosen day resets to latest when:**
  - "Back to latest" is tapped;
  - the time frame changes;
  - the route changes (leaving Weight and coming back; pinned);
  - Fast returns to the foreground (`visibilitychange`, e.g. back from the Shortcut);
  - an import succeeds;
  - on any redraw where the chosen day is no longer among the shown points, or is the latest.
- On redraw, a chosen day keeps its crosshair (`selected`).

#### 5g. Table
- Toggle button "Show as a table" / "Hide the table" (`toggle-table`). The state is in memory.
- Table (`data-testid="weight-table"`), columns **Day | 7-day average | Weigh-ins**, newest first, only the points in the current frame.
- Row format: "Sun 27 Sep" | "104.0 kg" | "2". Pinned: rows `['Sun 27 Sep104.0 kg2', 'Sat 26 Sep104.1 kg1']` and the ytd first row `'Wed 7 Oct99.0 kg3'`.

#### 5h. Import section (`data-block="import"`), on both the empty and the full screen
- Label "Import".
- Status: "Last import today." / "Last import yesterday." / "Last import N days ago." or "Nothing imported yet." (`ago()` counts whole 24-hour periods since `lastImportAt`, not calendar days.)
- **"Import weight"** (primary, full width): see 3a.
- Paste box block, conditional: see 3b.
- Row:
  - Link **"Run the Fast Weight shortcut"**, with href `shortcuts://run-shortcut?name=Fast%20Weight` (`SHORTCUT_NAME = 'Fast Weight'`, `data-action="run-shortcut"`). Coming back to Fast does **not** import by itself: the user taps Import weight.
  - **"How to set up the Shortcut"**, which opens Help.

---

### 6. Week tab weight block (`renderWeek`)
- A section labelled "Weight" for the week on view (Sunday to Saturday; Previous and Next move the week).
- If the week has at least 1 weigh-in:
  - Stat **"7-day average"**, e.g. "104.7 kg" (`data-stat="weight-avg"`).
  - Stat **"Change from last week"**, e.g. "−0.8 kg", or **"needs last week"** when the previous week has none (`data-stat="weight-change"`).
- Otherwise: "No weigh-ins imported for this week."
- Pinned: weights 14/16/18 Sep (mean 105.5) and 21/23/25 Sep (mean 104.7) give "104.7 kg" and "−0.8 kg". A week with one weigh-in shows that value, and its change counts a previous week of one weigh-in (unit test).
- The label "7-day average" here means the calendar-week mean. It differs from the rolling figure on the Weight screen.

---

### 7. Help screen (`docs/js/ui/help.js`, route `#help`)
Reached from Weight ("How to set up the Shortcut") and from More ("Weight Shortcut and Home Screen setup"). "‹ Back" always goes to More. The More tab is marked current.

1. Header "Help". Headline **"Weight Shortcut"**: "Your scale syncs each weigh-in to Apple Health. This Shortcut reads the last 14 days, scrambles them and copies them to the clipboard. It never shows a number. Fast then shows your 7-day average." Then the "‹ Back" button.
2. **"Build it once"** (10 numbered steps, verbatim):
   1. Open the Shortcuts app and tap + to start a new shortcut. Tap its name at the top, choose Rename, and call it `Fast Weight`.
   2. Add the action Find Health Samples. Tap Add Filter and set Type is Weight; tap Add Filter again and set Start Date is in the last 14 days. Set Unit to kg, Sort by to Start Date and Order to Oldest First. Leave Limit off.
   3. Add Repeat with Each. It repeats over the Health Samples, down to End Repeat.
   4. Add Format Date and drag it inside the repeat, between Repeat with each item and End Repeat. For the date, choose Repeat Item, tap it and pick Start Date. Tap the arrow, set Date Format to Custom and type `yyyy-MM-dd`.
   5. Add a Text action and drag it inside the repeat too, just under Format Date. Insert Formatted Date, type a colon, then insert Repeat Item and tap it to choose Value. Repeat Item is in the row of bubbles above the keyboard (swipe the row, or tap Select Variable); it is offered only inside the repeat.
   6. After End Repeat, add Combine Text. Combine Repeat Results with Custom and type a comma.
   7. Add Base64 Encode right after Combine Text, so it takes the Combined Text. Tap the arrow and set Line Breaks to None.
   8. Add Copy to Clipboard. Tap its arrow and turn on Local Only.
   9. Add Show Notification with the text `Weight ready. Open Fast and tap Import weight.` Do not add Show Result, Quick Look or Show: they would display the data.
   10. Tap Done, then run it once. Allow Health access to Weight when asked.
3. **"Import"**: "Open Fast, go to History, choose Weight and tap Import weight, then tap Paste in the small bubble. Fast saves the entries and says only how many it imported."
4. **"Run it every week"** (5 steps):
   1. In Shortcuts, open the Automation tab and tap +.
   2. Choose Time of Day. Pick a time you usually have the phone in hand, such as 10:00, set Repeat to Weekly and choose Friday.
   3. Choose Run Immediately, then Next.
   4. Pick Fast Weight and tap Done.
   5. When the notification arrives, open Fast and tap Import weight. Health is locked while the iPhone is locked, so if the automation ran then, use Run the Fast Weight shortcut under History, Weight instead.
5. **"Add Fast to your Home Screen"** (5 steps):
   1. Open the Fast link in Safari.
   2. Tap Share. In iOS 26 it sits inside the ••• button at the bottom right.
   3. Scroll down and tap Add to Home Screen.
   4. Keep Open as Web App switched on and tap Add.
   5. From now on open Fast from its icon. The Home Screen app keeps its own data, separate from Safari.
6. **"If an import fails"** (bullets):
   - No weight data on the clipboard: run the Shortcut again, come back to Fast and tap Import weight.
   - Entries skipped: in the Health app, open Weight and set its unit to kg. In Settings, General, Language and Region, set Calendar to Gregorian.
   - The Paste bubble does not appear: tap Import weight again, or use the paste box that appears on the Weight screen.

**README-only extras** (README "Weight Shortcut"):
- "The finished shortcut, top to bottom: Find Health Samples; Repeat with each item in Health Samples, holding Format Date and Text; End Repeat; Combine Text; Base64 Encode; Copy to Clipboard; Show Notification. Fast also accepts the older version with a `w=` Text step before Base64 Encode."
- "Duplicate dates keep the latest value."
- The "Why the clipboard" paragraph (3d).

**Owner troubleshooting, in CLAUDE.md only:** "If weights stop arriving: Health must let Shortcuts read Weight, and the scale's own app must be allowed to write Weight to Health (some scale apps sync only when opened)."

---

### 8. Owner decisions to keep (from CLAUDE.md and README)
- Weights arrive **only by clipboard paste** from the iOS Shortcut (10 steps in Help and README), because iOS keeps a Home Screen app's storage apart from Safari. The link import stays as a secondary route.
- **The Shortcut never shows a number** (Base64 "scrambles", Local Only clipboard, no Show Result). **Import messages give counts only.** The paste box never shows what was pasted. Fast clears the clipboard after a successful import.
- No manual weight entry.
- 7-day averages count **every** weigh-in (`MIN_WEIGH_INS = 1`).
- The chart plots the 7-day average on each weigh-in day, the same figure as the big number. Time frames are 1 month, 3 months, 6 months, This year and All, remembered.
- The line breaks across a week with no weigh-in, with the note under the chart saying so.
- Touching or dragging moves the big box (average, Up to, weigh-ins, change). A Back to latest pill in the box returns. Leaving Weight or changing the frame resets.
- Every colour-coded visual has a labelled legend (weight: "7-day average", "Latest").
- Anything tappable must look tappable. "Run the Fast Weight shortcut" is a link styled as a button.
- Big figures: large digits with a small unit ("104.4 kg").
- Copy: short and direct, no em dashes or emojis.

---

### 9. Tests that pin this area (key assertions)
- `tests/unit/weight.test.js`:
  - payload shapes; null cases; last duplicate wins (`found`, `skipped`, size);
  - comma decimals, whole numbers, "kg", Arabic digits, rounding to 2 dp;
  - skips (Feb 30, future, 12, 231.5); lb conversion (231.5 lb gives 105.01, 230.8lbs gives 104.69);
  - the pounds ratio guard; the diff counts; `MIN_WEIGH_INS === 1`;
  - rolling summary anchored on the latest; weekSummary Sunday to Saturday with single weigh-ins;
  - `chartRuns` breaks at more than 7 days; the `rollingSeries` values; `rangeStart` edge cases; `WEIGHT_RANGES` order.
- `tests/e2e/weight.spec.js`:
  - import link: hash cleared, 14 entries, duplicate resolved to 104.7, averages 104.4 and −1.1, 1 latest mark, chart end 104.4, re-import message;
  - no-slash redirect; Base64 on the main address leading to `#weight`;
  - clipboard import with the paste box absent after success;
  - clipboard without data: the flash text, typing refused, a paste imported, nothing shown;
  - one or two weigh-ins and the table rows; bad entries skipped;
  - chart points, runs and marks per frame, frame remembered across reload, empty-frame text with the note kept;
  - lone mark kept; arrow keys choose a day; touch and click choose, Back to latest, frame change and route change reset;
  - Chromium touch drag, and a scroll that is cancelled.
- `tests/e2e/satiety.spec.js`: weight legend labels; Weight as History's third view, URL `#weight`, History tab current and remembered.
- `tests/e2e/review.spec.js`, `tests/unit/review.test.js`: Week block 104.7 kg and −0.8 kg.
- `tests/e2e/offline.spec.js`: `/import/` and `/import` work offline.
- `tests/e2e/files.spec.js`, `tests/unit/files.test.js`: `fast-weight.csv` rows, backup weights, a damaged weight row dropped.
- `tests/e2e/reset.spec.js`: weights cleared and `lastImportAt: null`.
- `tests/e2e/screens.spec.js`: shots 32, 32b, 32c, 32d, 32e, 33, 36 (empty), 37 (import page).
- `tests/e2e/today-card.spec.js`: the empty Weight scenery changes phase.

## Additions from the completeness check

A second reader compared this inventory with the code, README, CLAUDE.md and tests, and found these missing or wrong. They are part of the contract too.

- Import weight on the Weight view reached through #history (historyMetric 'weight') still calls app.go('weight'), because the route name is 'history' rather than 'weight'. The address changes to #weight, and since the route name changes the chosen chart day and other session focus reset before the import result shows.

## Open questions found while cataloguing

- Non-Gregorian calendars are not reliably skipped. A Hijri date such as 1448-04-10 is a real calendar date in the past, so the parser imports it as a weigh-in in year 1448; I checked this with a scratch script. Only calendars whose year is ahead of 2026 (Buddhist 2569) give the 'skipped' message. The Help and README text ('set Calendar to Gregorian') suggests otherwise. A stray old date would also stretch the 'All' chart axis.
- The 'If weights stop arriving' troubleshooting (Health must let Shortcuts read Weight; the scale app must write Weight to Health) is only in CLAUDE.md. Neither Help nor README shows it, so the new app needs to decide whether to put it on screen.
- README and Help differ slightly. README's 'If an import fails' lacks the third bullet ('The Paste bubble does not appear...'). README has 4 automation steps where Help has 5. Some step wording differs. Only the README mentions the older w= Shortcut, 'Duplicate dates keep the latest value' and the 'Why the clipboard' paragraph.
- No test pins the Today 'Weight import due.' / 'No weight imported yet.' notice (7 days after the last import, 2 days after install when there has been none).
- The big-box text 'No weigh-in in these 7 days.' cannot appear today, because the box always ends on a weigh-in day.
- A change under 0.05 kg shows as '−0.0 kg' or '+0.0 kg', because the sign comes from the unrounded value. Probably unintended.
- The Week tab labels its figure '7-day average', but it is the calendar-week mean (Sunday to Saturday), not the rolling 7-day figure on the Weight screen. The same label covers two different numbers.
- The pounds guard only fires for lighter users. For the owner (around 104 kg), a reading in pounds is above 180 and is skipped, so the 'skipped' message appears rather than the 'look like pounds' message.
- lastImportAt updates even when an import adds nothing ('Nothing new to import.'), which clears the import-due notice. Unclear whether this is intended.
- The chart's marker spacing (10 units) and padding are in SVG units, and the e2e tests compute click positions from the current geometry (340 by 190, left 38, right 46). A redesigned chart must keep the behaviour, and those tests will need new positions.
- The chart's touch hint never changes ('Touch the chart to see a day above.'). The value readout is shown only in the big box.
