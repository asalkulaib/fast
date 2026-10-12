## Fasting stages: stage model, stages sheet, Read more pages, stage icons, stage chip

### Source files and tests

| What | Where |
|---|---|
| Stage data, notes, sources, `stageIndex`, `fastingState` | `docs/js/core/stages.js` |
| Read more content, `sourceBy`, `citeBy`, `stageSources` | `docs/js/core/stage-more.js` |
| Dial icons, stage chip, stage panel, stages sheet, Read more page, fade on a new stage | `docs/js/ui/stages.js` |
| Icon drawings, `stageIcon`, `stageGlyph` (and `clockGlyph`, used for Just now, not a stage) | `docs/js/ui/icons.js` |
| Where Today places the dial and the panel | `docs/js/ui/today.js` (`renderToday`, `beforeBlock`, `fastCard`, `signature`) |
| What a fast is timed from | `docs/js/core/rules.js` (`lastEatingSource`, `fastHoursFor`) |
| Icon movement and Reduce Motion (CSS keyframes) | `docs/css/app.css`, section "Stage icons, alive" (around lines 1816 to 1981); sheet layout around 2162 to 2420 |
| Unit tests | `tests/unit/stages.test.js` |
| E2E tests | `tests/e2e/stages.spec.js`; `tests/e2e/today-card.spec.js` (chip opens the sheet, three to a view, line follows the cards); `tests/e2e/goals.spec.js` (goal tick, goal line); `tests/e2e/satiety.spec.js` (ring legend wording); `tests/e2e/pause.spec.js` (no ring when paused); `tests/e2e/screens.spec.js` (shots 01c, 01d, 01e, 85 to 89c) |
| Prose | README.md "Fasting stages"; CLAUDE.md (owner decisions). Help (`docs/js/ui/help.js`) says nothing about stages. |

---

### 1. The stage model (pure rules)

#### 1.1 The six stages (`STAGES`, in this order)

All hours count from the moment the current fast began (section 1.3). `from` is inclusive and `to` is exclusive.

| # | key | name (exact) | from h | to h | range (exact, shown on cards) | short hours (stages line, en dash U+2013) | icon |
|---|---|---|---|---|---|---|---|
| 0 | `digesting` | Digesting | 0 | 4 | `0 to about 4 h` | `0–4 h` | a plate beside a fork |
| 1 | `settling` | Blood sugar settles | 4 | 12 | `about 4 to 12 h` | `4–12 h` | a drop with a level line |
| 2 | `switch` | Metabolic switch | 12 | 24 | `from about 12 h` | `12–24 h` | a flame (with an inner flame, its "heart") |
| 3 | `ketones` | Ketones climbing | 24 | 48 | `about 24 to 48 h` | `24–48 h` | a lightning bolt |
| 4 | `brain` | Brain on ketones | 48 | 72 | `about 48 to 72 h` | `48–72 h` | a brain seen from above (two halves, a fold in each, a midline) |
| 5 | `sparing` | Protein sparing | 72 | Infinity | `72 h and beyond` | `72 h+` | a shield with a midline |

The stage texts, verbatim (each shows on the Today stage panel, the stage's card, and the top card of its Read more page):

- **Digesting**: "Your last meal is being absorbed. Blood sugar and insulin rise, then settle, while your body stores the energy."
- **Blood sugar settles**: "Insulin is back at its low baseline. Your liver keeps blood sugar steady, partly from its sugar store and partly by making new sugar, and your body draws more and more on fat."
- **Metabolic switch**: "As the liver's sugar store runs low, fat becomes the main fuel and ketones start to rise. It can come as late as 36 hours: sooner after training, later after a big meal."
- **Ketones climbing**: "Your liver's sugar store gives little now: by the second day nearly all your blood sugar is new sugar your body makes. Fat supplies most of your energy and ketones keep rising. Growth hormone output climbs too, to about five times its usual level on the second day."
- **Brain on ketones**: "Ketones are now high enough for your brain to take up and burn in place of some of its sugar. By about the third day they meet about a quarter of its energy needs."
- **Protein sparing**: "The protein your body breaks down, much of it to make sugar, peaks around the third day, then falls steadily. Growth hormone stays high: about three times its usual level on the fifth day. A fast this long is best done with a doctor's guidance, more so if you take medicine or have a health condition."

Evidence behind each stage (code comment in `core/stages.js`): stages 1 and 2 from Dimitriadis 2021; stage 2's sugar figure from Rothman 1991 (64% in the first 22 h); stage 3 from Anton 2018 (switch usually 12 to 36 h); stage 4 from Rothman 1991 (96% new sugar from 36 to 54 h) and Hartman 1992 (growth hormone about 5x on day 2); stage 5 from Pan 2000 and Hasselbalch 1994; stage 6 from Göschke 1975 (protein loss rises to day 3, then falls) and Ho 1988 (growth hormone about 3x on day 5). Hunger in waves (Read more only) comes from Natalucci 2005. Autophagy comes from Bagherniya 2018 and Bensalem 2025: the timing in humans is unknown, so autophagy is never placed on the clock.

#### 1.2 Notes (verbatim)

- `VARIATION_NOTE`: "The hours are typical, not exact. They shift with the size of your last meal and how active you are."
- `AUTOPHAGY_NOTE`: "Autophagy is how cells clear out and recycle worn parts. Fasting switches it on in cell and animal studies, and early human studies point the same way, but when it starts in people is not known. So Fast does not place it on the clock."

#### 1.3 Sources (`SOURCES`): exactly 11, in this order (the order is shown and also used to order each Read more page's sources)

1. Dimitriadis GD et al. Regulation of postabsorptive and postprandial glucose metabolism by insulin-dependent and insulin-independent mechanisms. Nutrients, 2021.
2. Anton SD et al. Flipping the metabolic switch: understanding and applying the health benefits of fasting. Obesity, 2018.
3. Pan JW et al. Human brain beta-hydroxybutyrate and lactate increase in fasting-induced ketosis. Journal of Cerebral Blood Flow and Metabolism, 2000.
4. Ho KY et al. Fasting enhances growth hormone secretion and amplifies the complex rhythms of growth hormone secretion in man. Journal of Clinical Investigation, 1988.
5. Hartman ML et al. Augmented growth hormone secretory burst frequency and amplitude mediate enhanced GH secretion during a two-day fast in normal men. Journal of Clinical Endocrinology and Metabolism, 1992.
6. Rothman DL et al. Quantitation of hepatic glycogenolysis and gluconeogenesis in fasting humans with 13C NMR. Science, 1991.
7. Hasselbalch SG et al. Brain metabolism during short-term starvation in humans. Journal of Cerebral Blood Flow and Metabolism, 1994.
8. Göschke H et al. Nitrogen loss in normal and obese subjects during total fast. Klinische Wochenschrift, 1975.
9. Natalucci G et al. Spontaneous 24-h ghrelin secretion pattern in fasting subjects: maintenance of a meal-related pattern. European Journal of Endocrinology, 2005.
10. Bagherniya M et al. The effect of fasting or calorie restriction on autophagy induction: a review of the literature. Ageing Research Reviews, 2018.
11. Bensalem J et al. Intermittent time-restricted eating may increase autophagic flux in humans: an exploratory analysis. Journal of Physiology, 2025.

Each string must start with the first author's surname followed by a space, and end with `YEAR.`. `sourceBy` and `citeBy` depend on that format.

#### 1.4 Functions and edge cases

- `SCALE_HOURS = 24`: the dial is a 24-hour scale.
- `stageIndex(elapsedMs)`: hours = max(0, elapsed) / 1 h. It returns the first stage with `hours >= from && hours < to`.
  - Pinned boundaries: 0 → 0; 4 h − 1 min → 0; 4 h → 1; 12 h − 1 min → 1; 12 h → 2; 24 h − 1 min → 2; 24 h → 3; 48 h − 1 min → 3; 48 h → 4; 72 h − 1 min → 4; 72 h → 5; 30 days → 5.
  - A negative elapsed time (a start in the future) counts as 0, so the stage is Digesting.
- `fastingState(lastBiteTs, nowTs)` returns `{ elapsedMs, index, stage, next, untilNextMs, position }`:
  - `elapsedMs = max(0, now − start)`.
  - `next` is the following stage, or `null` on Protein sparing.
  - `untilNextMs = next.from h − elapsed`, or `null` on the last stage.
  - `position = min(1, elapsed / 24 h)`: 0 to 1 along the dial, and 1 for any time past 24 h.
  - Pinned: 16 h 10 min gives Metabolic switch, next Ketones climbing, 7 h 50 min to go, position (16 + 10/60) / 24. 30 h gives Ketones climbing, next Brain on ketones, 18 h to go, position 1. 50 h gives Brain on ketones, next Protein sparing. 80 h gives Protein sparing with `next` and `untilNextMs` both null.
- Unit-test invariants:
  - The stages cover the clock with no gaps: the first `from` is 0, each `from` equals the previous `to`, and the last `to` is Infinity.
  - No stage name or text mentions autophagy.
  - No copy says "you are in ketosis".
  - The autophagy note contains "not known".
  - There are exactly 11 sources.
  - The last stage's text contains "doctor's guidance".

#### 1.5 What a fast is timed from (input to every stage view)

`lastEatingSource(ctx)` in `core/rules.js` takes the latest of:
- a day's `lastBite`;
- a day's `firstBite` while it has no `lastBite` (the window is open);
- each meal's `finishedAt`, or its `startedAt` while unfinished;
- each "ate outside the window" entry's `at`;
- a day's `fastFrom` (set with Begin fast).

On a tie, the window's own last bite wins. The result is `null` when a paused day falls between the source's day and today. For a `fastFrom`, the check starts from the day after, so a fast begun on a paused day still counts. With `null`, no dial, no chip and no stage panel are shown.

The fasting goal on the dial and in the panel is `fastHoursFor(todayKey, settings)`: the long-fast hours if a 24 to 72 h fast is set, otherwise 24 minus the eating window in hours.

---

### 2. Stages on Today

The views appear only while fasting, that is in Today modes `before`, `closed` and `noEating`, and only when a start time exists. They are hidden while the window is open, in `forgot`, while paused, and when no eating was ever logged. Pinned: "no bite logged yet: no ring" and no `[data-block="stages"]`; paused days show no ring.

Placement (owned by Today, listed here for context):
- **Before the window:** the full-size dial (`ringHero`) sits inside the "Before the window" card, or the "Fasting day" card during a long fast. The stage panel follows the main block.
- **Window closed, no meal still being eaten (`fastFirst`):** Today shows the fullness-check pointer (if one is running), then a "Fasting" card with the full-size dial, then the stage panel, then the closed window's card. Pinned order: `satiety-pointer, fasting, stages, closed`.
- **Window closed, a meal started after closing still being eaten:** the closed card leads. The stage panel then carries a smaller (compact) dial, its legend and the two times.
- **Day logged without eating (`noEating`):** the stage panel carries the compact dial, legend and times.

#### 2.1 The dial: the parts that belong to the stages

- **Scale:** 0 h on the left horizon, 12 h overhead, 24 h on the right horizon, along a semicircular path. Angle = π × (1 − h/24).
- **Segments:** the path is split at the stage boundaries that fall within 24 h (4 h and 12 h), giving three segments (0–4, 4–12, 12–24) with a small gap (0.12 h in total) at each boundary. Hours already fasted are drawn in the "fasted" tone and hours ahead in the "ahead" tone, each clipped at "now".
- **Hour ticks:** 25 ticks (0 to 24). Every 6 h (0, 6, 12, 18, 24) is longer and stronger.
- **Goal tick:** shown only when goal ≤ 24 h. A 24 h long fast still shows its tick at the far end; a goal over 24 h has none. Test id `goal-tick`, `data-hours` = the goal.
- **Sun ("Now"):** sits at min(elapsed, 24) h, so past a day it rests on the far horizon. Test id `stage-marker`, `data-hours` = elapsed hours to one decimal and not capped (for example `16.2`).
- **Stage icons on the dial: always exactly 4** (pinned count of `[data-stage-icon]` = 4 at 16 h, 26.5 h and 50.5 h):
  - Digesting beside 2 h, Blood sugar settles beside 8 h, Metabolic switch beside 18 h, all just outside the path.
  - One "beyond" icon at the 22.5 h position near the far horizon, above the land. It shows the current stage once the fast is past 24 h (Ketones climbing, Brain on ketones or Protein sparing). Before 24 h it shows the first stage past a day (Ketones climbing).
  - The current stage's icon is "set in a dark circle": a filled disc behind it, with its lines in the light tone. It carries `.now` and is the only icon on the dial that moves (`.live`).
  - The other icons are quiet and still.
  - Each dial icon carries `data-stage-icon="<key>"`.
- **Container:** the `fasting-ring` wrapper carries `data-stage="<current key>"`. The svg is `aria-hidden`.
- **Centre:** a visually hidden "Fasting for", then the time fasted (test id `fasting-for`), updated every tick and rounded to the nearest minute. Large digits with small units: `16h 10m`, `0m`, `26h 30m`. From 48 h on it reads days and hours: `2 days 2h`, or `3 days` when the hours are 0. Under the time sits the **stage chip** (2.2).
- **Ring legend** (test id `ring-legend`), always in this order: "Fasted", "Ahead", "Now" (a sun key), "Goal" (only when the goal tick is on the dial), "Stage" (a filled dark disc, meaning the current stage's circle). Pinned: `['Fasted', 'Ahead', 'Now', 'Goal', 'Stage']`. With a 48 h goal there is no "Goal" entry.
- **Constraint (owner):** the dial's ground scenery must stay clear of the time, the chip with its longest label ("Blood sugar settles"), the icons, the arc and the 0 h and 24 h ticks.

#### 2.2 The stage chip (under the time on the dial)

- It is a button and must look tappable.
  - `data-action="open-stages"`, test id `stage-name`.
  - Accessible name: `Stage: <name>. About the stages`, for example "Stage: Metabolic switch. About the stages".
- **Content:** the current stage's icon, which **always moves**, followed by the stage name. The visible text is exactly the name, for example "Metabolic switch". This icon has no `data-stage-icon` tag, so it is not counted among the dial's 4.
- **Tap:** opens the stages sheet at the current stage (section 3).
- Present wherever the dial is drawn, full or compact.

#### 2.3 The stage panel (`[data-block="stages"]`, `data-stage="<key>"`)

From top to bottom:
1. Only when the panel carries the dial (compact mode): the compact dial, the legend and the fast's two time pills.
2. A label with the stage name, for example "Metabolic switch".
3. The stage text (1.1).
4. The lines (both live; they update on the 1 s tick and change each minute):
   - Goal line (test id `goal-line`):
     - not reached: `Fasting goal <N> h: <duration> to go.`, for example "Fasting goal 20 h: 3 h 50 min to go." or "Fasting goal 48 h: 35 h to go.";
     - reached: `Fasting goal of <N> h reached.`
     - It switches to the reached wording live, the minute the time left reaches 0.
   - Next-stage line on a new line (test id `stage-next`), only when a next stage exists: `Next: <next name in lower case>, in about <duration>.`, for example "Next: ketones climbing, in about 7 h 50 min.", "Next: metabolic switch, in about 5 min.", "Next: brain on ketones, in about 21 h 30 min." There is no line on Protein sparing (pinned count 0).
   - Duration format (`fmtDuration`, rounded to the nearest minute): `X h Y min`, `X h` when the minutes are 0, `Y min` when the hours are 0.
5. Button "About the stages" (secondary style, `data-action="about-stages"`): opens the stages sheet at the current stage.

#### 2.4 A new stage arriving while the app is open

- **Redraws:** Today redraws every 5 minutes while fasting (the signature includes floor(elapsed / 5 min)). Every stage boundary (4, 12, 24, 48, 72 h) falls on a 5-minute mark, so a stage changes within a second of its boundary. Text with live values (time fasted, goal line, next line) updates every second between redraws.
- **Fade:** the app remembers the last stage key drawn (module state). When a redraw shows a different stage, every stage element drawn in that same redraw (the dial block `.ring-hero` and the stage panel) gets a soft fade-in. Later redraws within the same stage do not fade (pinned). The first render after launch never fades. With Reduce Motion, the fade is effectively instant.
- **Pinned scenario:** at 11 h 55 min the stage is Blood sugar settles, with "Next: metabolic switch, in about 5 min.". After 6 minutes it is Metabolic switch, the dial's lit icon is `switch`, and both blocks fade. 5 minutes later the time reads "12h 6m" and nothing fades.

---

### 3. The stages sheet

**Opening.** `showStagesSheet(currentKey)` opens a bottom sheet named `stages` (dialog, accessible label "Fasting stages").
- It is opened from the chip and from "About the stages". Both pass the current stage's key, which gives both the "now" marks and the stage it opens on.
- With no key (unused today) it would open at Digesting with no "now" marks.
- The sheet does **not** update if the stage changes while it is open; it keeps the stage it was opened with.
- It closes with the "Close" button in the header (`data-action="close-sheet"`), a tap on the scrim, or Escape.
- Nothing about the sheet is stored or remembered.

**Contents, top to bottom:**
1. Header: label "Fasting stages", then the "Close" button.
2. Intro: "Typical changes after your last bite, from human studies. Swipe the stages or the cards, or tap a stage. Read more opens the full story of a stage."
3. **The stages line** (group, accessible label "Stages", test id `stage-line`). All six stops sit in a row that scrolls sideways on its own, showing **three to a view with the next one peeking in at the edge**. The row is 167% of the view width, about 3.6 stops visible; pinned: stops per view is greater than 3 and less than 4. A thin connector runs behind the discs from the middle of the first stop to the middle of the sixth.
   - Each stop is a button:
     - a disc holding the stage icon (tagged `data-stage-icon`, so the sheet has exactly 6 tagged icons, pinned), then the name, then the short hours (`0–4 h` …);
     - `data-action="stage-<key>"`;
     - accessible name `<name>, <range>`, plus `, now` on the current stage, for example "Metabolic switch, from about 12 h, now".
   - **Current stage mark:** the stop of the stage the fast is in has class `now` and its disc is ringed (currently in the sun's gold). Pinned: `.stage-stop.now` is `stage-switch` at 16 h 10 min. It never moves.
   - **Stage in view mark:** exactly one stop has `aria-current="true"` (all others `"false"`): the one whose card is in view. It is emphasised (ink text, underlined name) and **its icon moves** (section 5). This mark follows the cards and can differ from the current stage.
4. **The cards** (`ul`, test id `stage-list`, 6 `li`). Each card has `data-stage="<key>"` and contains:
   - a head row with the range (for example "from about 12 h") and, on the current stage only, a "Now" badge (test id `stage-now`; exactly one in the sheet);
   - an h2 with the stage name;
   - the stage text;
   - at the foot, a "Read more" button (outline, `data-action="more-<key>"`, accessible name `Read more about <name>`, 6 in all).
   - The cards scroll sideways one per view with mandatory snapping. Read more sits level at the bottom of every card. Styling note: each card is currently a shade deeper than the last, from pale sand to dark rock; the last three are dark with light words.
5. Variation note (small): VARIATION_NOTE.
6. Section "Autophagy": AUTOPHAGY_NOTE (test id `autophagy-note`).
7. Section "Sources": a numbered list of all 11 SOURCES, in order. Pinned: contains "Flipping the metabolic switch" and "Brain metabolism during short-term starvation in humans".

**Interaction rules** (pinned by `today-card.spec.js` and `stages.spec.js`):
- **Opening position:** `aria-current` goes on the opening stage at once. On the next frame, after layout, the cards jump without animation to that card and the line centres that stop. Pinned: at 16 h 10 min, card index 2 is in view and `switch` is wholly visible in the line while `sparing` is not.
- **Tap a stop:**
  - The cards glide to that card (smooth; instant with Reduce Motion), and the stop becomes `aria-current` and is centred in the line.
  - Tapping the stop already marked centres it again.
  - While the cards glide past other cards on the way, the line does not follow them; it waits for the target card.
  - A safety timer of 800 ms after each tap clears the wait and re-syncs the line to whichever card is actually in view.
  - Pinned: tap Ketones climbing gives card 3; tap Protein sparing gives card 5; the previous stop reads `aria-current="false"`.
- **Swipe the cards:** on scroll (passive, throttled to one update per frame), the card in view is round(scrollLeft / step), clamped to 0..5, where step is the distance between two cards including the gap. Its stop becomes `aria-current` and is centred in the line (smooth). Pinned: scrolling cards back to the first marks Digesting and brings it into the line's view, with Protein sparing out of view.
- **Swipe the line alone:** it only scrolls the line. The card in view and `aria-current` stay as they were (pinned: after scrolling the line to its end, Protein sparing is visible and the card index stays 2).
- **Centring:** line scroll position = stop's offset − (line width − stop width) / 2. It only scrolls when the marked stop changes, except after a tap.
- **Guard:** timers and frames that fire after the sheet closed, or after Read more replaced the view, do nothing.

---

### 4. Read more: one stage's longer page

**Opening.** Tap "Read more" on a card. The same sheet's content is replaced by that stage's page with a fade-in, scrolled to the top. The root has test id `stage-more` and `data-stage="<key>"`. There are no links anywhere in the sheet (pinned: `a` count 0); studies are named only.

**Layout, top to bottom:**
1. Header "Fasting stages" with "Close".
2. Button "Back to the stages" (outline, `data-action="stages-back"`).
3. The stage's card repeated at the top: range, then a "Now" badge (`stage-now`) only if this is the stage the fast is in, then an h2 with the name, then the stage text.
4. Section "What happens": the body paragraphs.
5. Section "What the studies found": a list (test id `stage-findings`). Each finding shows its text, then a small citation line `<Surname> and colleagues, <year>`.
6. Section "Good to know": advice paragraphs. These claim no finding.
7. Section "Sources": a numbered list of only the sources this stage's findings use, each once, in SOURCES order.
8. Button "Back to the stages" again at the end (`data-action="stages-back-end"`).

**Back** (either button) replaces the page with the stages view, opened on **the stage just read**, not the current stage. The "now" marks stay on the current stage. Pinned: after reading Metabolic switch, Back marks `stage-switch`; after reading Protein sparing, Back marks `stage-sparing` with card index 5 in view.

**Citation rules:**
- `sourceBy(surname)` finds the source starting with `"<surname> "`.
- `citeBy(surname)` gives `"<surname> and colleagues, <year>"`, with the year taken from the source's trailing `YYYY.`. If no source matches, it returns the surname alone.
- Pinned: "Rothman and colleagues, 1991" and "Göschke and colleagues, 1975".

Years: Dimitriadis 2021, Anton 2018, Pan 2000, Ho 1988, Hartman 1992, Rothman 1991, Hasselbalch 1994, Göschke 1975, Natalucci 2005. Bagherniya 2018 and Bensalem 2025 appear only in the sheet's full Sources list, for autophagy.

**Unit-test invariants:**
- Every stage has a page.
- Each page has at least 2 body paragraphs, at least 2 findings and at least 1 Good to know item.
- Every finding's author is in SOURCES, and each page has at least 1 source.
- `stageSources('sparing')` is [Ho, Göschke], in that order.
- No page text mentions autophagy or contains `http:`, `https:` or `www.`.
- The Good to know of `ketones`, `brain` and `sparing` mentions a doctor.

**Full content, verbatim:**

**Digesting**
- What happens:
  1. "Your gut breaks the meal down and absorbs it: starch and sugar as glucose, protein as amino acids, fat as fatty acids. As the glucose reaches your blood, your blood sugar rises and your pancreas releases insulin to match."
  2. "Insulin helps your muscles and other tissues take sugar out of your blood. Your liver takes up more than half of the sugar from a meal and stores some of it as glycogen, a store it draws on later. While insulin is up, your liver holds back its own sugar and your fat tissue holds on to its fat."
  3. "Over the next few hours, as the last of the meal is absorbed, your blood sugar and insulin settle back to where they were before you ate."
- What the studies found:
  - "After a meal, the liver takes up more than half of the sugar eaten, which keeps the rise in blood sugar and insulin in check." (Dimitriadis and colleagues, 2021)
  - "Each meal primes the body for the next, so blood sugar is handled better as the day goes on." (Dimitriadis and colleagues, 2021)
- Good to know:
  - "Fast times every stage from the time of your last bite, even one you add later, so this one starts then."
  - "A bigger meal takes longer to absorb, so this stage can run past 4 hours."
- Sources: Dimitriadis.

**Blood sugar settles**
- What happens:
  1. "The meal is absorbed and insulin is back at its low baseline. With it, the hold on your liver and your fat tissue lifts."
  2. "Your liver now keeps your blood sugar steady, with some help from your kidneys. It draws on its store of sugar, called glycogen, and it makes new sugar from other material in your body."
  3. "Your fat tissue releases fatty acids, and your muscles and liver burn more and more of them. That saves the sugar for your brain, which still runs mostly on sugar."
- What the studies found:
  - "Over the first 22 hours of a fast, about two thirds (64%) of the sugar released into the blood was new sugar the body made. The rest came from the liver's glycogen store." (Rothman and colleagues, 1991)
  - "During sleep, surges of growth hormone and cortisol turn the muscles from sugar to fat, which keeps blood sugar in range until you wake." (Dimitriadis and colleagues, 2021)
  - "In a small study of a 24-hour fast, ghrelin, the hormone linked to hunger, still rose at the times people usually ate, then fell again on its own with no food." (Natalucci and colleagues, 2005)
- Good to know:
  - "A night's sleep covers much of this stage."
  - "Hunger can come in waves at your usual meal times. A wave may pass if you wait."
- Sources: Dimitriadis, Rothman, Natalucci.

**Metabolic switch**
- What happens:
  1. "Your liver's store of sugar, glycogen, runs low, and fat becomes your main fuel: your fat tissue releases more fatty acids, and your muscles and other organs burn them."
  2. "Your liver turns some of those fatty acids into ketones, which other organs, your brain among them, can burn in place of sugar. The ketones in your blood start to rise."
  3. "Anton and colleagues call this point the metabolic switch: the body uses more energy than it takes in, the liver's glycogen store is spent, and fat is released for fuel."
- What the studies found (3 findings, pinned):
  - "The switch typically comes 12 to 36 hours after the last meal, depending on how much glycogen the liver holds when the fast starts and how much energy is used during it, exercise included." (Anton and colleagues, 2018)
  - "The review argues that the switch moves the body from storing fat to using it, while burning fat and ketones helps it keep its muscle." (Anton and colleagues, 2018)
  - "From 22 to 36 hours into a fast, new sugar the body made was 82% of the sugar released into the blood." (Rothman and colleagues, 1991)
- Good to know:
  - "Exercise brings the switch sooner. A big meal before the fast pushes it later."
- Sources: Anton, Rothman.

**Ketones climbing**
- What happens:
  1. "Your liver's store of sugar, glycogen, gives little now, so almost all the sugar in your blood is new sugar your body makes, partly from protein it breaks down."
  2. "Fat supplies most of your energy, and the ketones in your blood keep rising."
  3. "Growth hormone, which helps release fat from your fat tissue, climbs well above its usual level."
- What the studies found:
  - "From 36 to 54 hours into a fast, new sugar the body made was 96% of the sugar released into the blood. The liver's glycogen was measured directly, with magnetic resonance scans." (Rothman and colleagues, 1991)
  - "On the second day of a fast, men's growth hormone output was about five times its usual level, released in more than twice as many bursts." (Hartman and colleagues, 1992)
  - "Nitrogen in the urine, a measure of the protein broken down, was highest in the first three days of a fast." (Göschke and colleagues, 1975)
- Good to know:
  - "A fast past a day is a bigger step. If you take medicine, above all for diabetes or blood pressure, or have a health condition, ask a doctor first."
  - "Keep drinking water."
  - "If you feel faint, dizzy, confused or unwell, end the fast and eat."
- Sources: Hartman, Rothman, Göschke.

**Brain on ketones**
- What happens:
  1. "The ketones in your blood are now high enough for your brain to take them up in quantity and burn them in place of some of its sugar."
  2. "As your brain uses less sugar, your body needs to make less of it, and so needs to break down less protein to make it."
- What the studies found:
  - "Ketones measured in the brain itself, with magnetic resonance, were about 12 times their usual level after two days of fasting and about 20 times after three, rising in step with the blood." (Pan and colleagues, 2000)
  - "After three and a half days of fasting, the brain used about a quarter less sugar, took up about 13 times more beta-hydroxybutyrate, the main ketone, and met about a quarter of its energy needs from ketones. Blood flow to the brain did not change." (Hasselbalch and colleagues, 1994)
- Good to know:
  - "If you feel faint, dizzy, confused or unwell, end the fast and eat."
  - "A fast this long is best planned with a doctor, more so if you take medicine or have a health condition."
- Sources: Pan, Hasselbalch.

**Protein sparing**
- What happens:
  1. "All through a fast your body breaks down some protein, much of it from muscle, to make new sugar from its amino acids. That breakdown is highest in the first three days, then falls steadily."
  2. "It falls as your brain takes more of its energy from ketones and needs less sugar, so less protein has to be broken down to make it. That is why this stage is called protein sparing."
  3. "Fat and ketones carry most of the load, and growth hormone stays high."
- What the studies found:
  - "In 24 people of normal weight who fasted for six days, nitrogen loss peaked in the first three days, then fell steadily. Protein supplied about 15% of the energy the men used, and men lost more protein than women of the same weight." (Göschke and colleagues, 1975)
  - "In women with obesity who fasted for up to four weeks, protein supplied about 5% of their energy by the fourth week." (Göschke and colleagues, 1975)
  - "On the fifth day of a fast, men's growth hormone output was about three times its usual level, in more frequent pulses." (Ho and colleagues, 1988)
- Good to know:
  - "A fast this long is best done with a doctor's guidance, more so if you take medicine or have a health condition."
  - "If you feel faint, dizzy, confused or unwell, end the fast and eat."
- Sources: Ho, Göschke.

---

### 5. Stage icons and their movement

**Drawings** (`icons.js`): thin line drawings on a 24×24 grid, stroked in the surrounding text colour. Never emoji. Each drawing is made of numbered parts, `.p0`, `.p1` and so on, which the movement targets:
- `digesting`: p0, p1 and p2 make up the fork (tines, middle tine, handle); p3 is the outer rim of the plate; p4 is its inner ring.
- `settling`: p0 the drop; p1 the level line across it.
- `switch`: p0 the flame; p1 its inner heart.
- `ketones`: p0 the bolt.
- `brain`: p0 the outline; p1 the midline; p2 to p5 the four folds (p2 upper left, p3 upper right, p4 lower left, p5 lower right).
- `sparing`: p0 the shield; p1 its midline.

**Calls:**
- `stageIcon(key, { x, y, size, current, mark, live })`: `current` adds a filled disc behind the drawing (radius 14 on the 24 grid) with light strokes. `mark: false` leaves out the `data-stage-icon` tag. `live` makes it move.
- `stageGlyph(key, { mark, live })`: the same icon as a standalone 24×24 picture.

**Where icons appear and which move** (owner decision: "lively, always on"):

| Place | Icons shown | Which one moves |
|---|---|---|
| Dial | 4 (section 2.1) | Only the current stage's icon (exactly 1 `.live`; pinned `data-stage-icon="switch"` at 16 h) |
| Stage chip | the current stage | Always (pinned: it has `live` and more than 0 running animations) |
| Stages sheet line | 6, one per stop | Only the stop with `aria-current="true"`, the stage **in view**, not necessarily the current stage. Pinned: after tapping Brain on ketones, moving = `[false,false,false,false,true,false]` |
| Stage cards, Read more page, stage panel | no icons | n/a |

Pinned: the dial icons that are not live run no animations.

**Movement**: movement only, in the icon's own ink, with no glow, no gold, no blur and no new colour. Every animation loops forever, is ease-in-out unless marked linear, and moves each part about its own centre unless noted:
- **Digesting:**
  - The fork (p0 to p2, as one piece) taps: up 2 px at 30%, down 0.8 px at 55%, back by 100%; 1.1 s.
  - The plate's inner ring (p4) breathes: scale 1 → 0.72 → 1; 2.2 s.
  - The rim stays still.
- **Blood sugar settles:**
  - The drop sways and squashes from its base: scale(1.06, 0.9) with −4° at 25%, scale(0.96, 1.05) at 50%, scale(1.04, 0.94) with +4° at 75%; 1.6 s.
  - The level line rocks: −12° then +12° with a 1 px lift; 1.6 s.
- **Metabolic switch:**
  - The flame leans and stretches from its base: skewX −5°/+2°/+5° with small scale changes; 0.9 s.
  - The heart flickers from its base: scale(0.82, 1.18) at 40% opacity 0.55, scale(1.08, 0.9) at 70% opacity 0.85; 0.6 s.
- **Ketones climbing:** the bolt strikes twice, then rests (1.4 s, linear):
  - 6%: scale 1.18, opacity 0.35;
  - 12%: back to normal;
  - 18%: scale 1.14, opacity 0.45;
  - 26%: back to normal, then still until 100%.
- **Brain on ketones:**
  - The outline pulses: scale 1.08 at 30%, 0.98 at 60%; 1.2 s.
  - The folds fire in turn: opacity 0.2 and scale 0.7 at mid-cycle, 1.2 s, with delays of p2 0, p3 −0.3 s, p5 −0.6 s, p4 −0.9 s.
  - The midline stays still.
- **Protein sparing:**
  - The shield braces: scale 1.1 at 20%, 0.97 at 40%, 1.03 at 55%; 1.5 s.
  - A dash runs down the midline: the dash pattern travels the full line length, linear, 1.5 s.
- Moving parts may reach slightly past the icon's box; they are not clipped in the chip or the line discs.

**Reduce Motion** (`prefers-reduced-motion: reduce`):
- All icon animations stop and the sparing midline is drawn whole.
- Pinned: zero running animations on the dial and the chip, and on all six line stops even with one marked `aria-current`.
- The chip's icon still carries `live`; only the movement is suppressed.
- Sheet scrolling (cards and line) switches from smooth to instant.
- The new-stage fade is effectively instant.

---

### 6. Stored data

- **Nothing is stored for stages.** There are no settings, no remembered sheet position and no per-stage records.
- Stage views are derived on every render from:
  - the eating and fasting records (days `lastBite`/`firstBite`/`fastFrom`/`paused`, meals `startedAt`/`finishedAt`, outside `at`; see 1.5);
  - the goal settings (`goalChanges` via `fastHoursFor`).
- These records live in IndexedDB on the phone and belong to other areas.
- The "last stage drawn" used for the fade is in-memory only.

### 7. Hooks the tests use (keep them if the e2e tests are reused)

- **Today:**
  - test ids `fasting-ring` (with `data-stage`), `fasting-for`, `stage-name` (the chip), `stage-marker` (`data-hours`), `goal-tick` (`data-hours`), `goal-line`, `stage-next`, `ring-legend`;
  - `[data-block="stages"]` (with `data-stage`);
  - `data-action` `open-stages` and `about-stages`;
  - `.stage-icon`, `.now`, `.live`, `[data-stage-icon]`;
  - `.ring-hero` and `.fade-in`.
- **Sheet:**
  - `[data-sheet="stages"]`;
  - test ids `stage-line`, `stage-list`, `stage-now`, `autophagy-note`, `stage-more` (with `data-stage`), `stage-findings`;
  - `data-action` `stage-<key>`, `more-<key>`, `stages-back`, `stages-back-end`, `close-sheet`;
  - `.stage-stop`, `.stage-stop.now`, `aria-current`;
  - `.stage-card[data-stage]`, `.stage-cards` (with `scrollLeft / clientWidth` = card index).

### 8. Owner decisions to keep (from CLAUDE.md and README)

- Stages run to 72 h and beyond: six stages, each worded within the cited human studies, with **no hour given for autophagy**.
- The dial stays a 24-hour scale. Past a day, one icon by the far horizon shows the stage the fast is in.
- The last stage says a fast that long is best done with a doctor's guidance.
- Read more on each card opens that stage's longer page **in the same sheet**. Every finding names a study in SOURCES and stays within what it reports. **No links out of the app.**
- The icon of the stage the fast is in moves (on the dial and in the chip), and so does the stage in view on the stages line. Movement only, in the icon's own ink: no glow, no gold, no blur. Reduce Motion stops it.
- The hours are typical, not exact, and **never a target**.
- Copy: short and direct, with no em dashes (the short hours use en dashes), no emojis, no checkmarks.
- Every colour-coded visual has a labelled legend (the ring legend names Fasted, Ahead, Now, Goal, Stage).
- Anything tappable must look tappable: the chip, the stops and Read more are pills or outlined.

## Additions from the completeness check

A second reader compared this inventory with the code, README, CLAUDE.md and tests, and found these missing or wrong. They are part of the contract too.

- The goal tick, the Goal legend item and the goal line use today's fasting goal, fastHoursFor(todayKey). A fast that began on a day with another goal is still measured against today's goal. Whether the tick shows (goal of 24 h or less) also follows today's goal.
- The "last stage drawn" memory (`shownStage`) is module-wide and survives navigation and mode changes. The first render that draws a dial or stage panel with a different stage fades in once. Examples: returning to Today after the stage changed while another tab was open, or the first render of a new fast after a window closes, back at Digesting, after the previous fast was drawn at another stage.
- Goal line detail: when the goal is already reached at render time, the reached wording ("Fasting goal of N h reached.") is static text. Otherwise it is a live span that switches to the reached wording on its own. The next-stage countdown is clamped at 0, so it never reads negative between the boundary and the 5-minute redraw.

## Open questions found while cataloguing

- The icons.js header comment says the current stage icon 'sits on a disc of gold leaf', but the CSS fills that disc with ink (`.stage-icon .leaf { fill: var(--ink) }`), and README says 'set in a dark circle'. The behaviour is an ink disc with light strokes; the comment is out of date.
- The current-stage marks in the sheet (the ring around the stop's disc and the 'Now' badge on the card) use the accent gold, justified in code as 'the sun's own gold'. CLAUDE.md says gold is only for achievement and the sun on the dial. The new design should decide whether 'Now' keeps gold.
- The stages sheet does not refresh while open: if a stage boundary passes, the 'now' marks stay on the stage it was opened with. No test covers this, so it is unclear whether it is intended or just not handled.
- showStagesSheet(null) (open with no current stage, at Digesting with no Now marks) is supported by the code but never called; nothing pins how it should behave.
- Which Today modes show the compact dial inside the stage panel versus the full dial (and the time pills, the fullness pointer order) belong to the Today/dial area; I list them only for context and did not catalogue the dial's scenery (hismaGround) or the time pills.
