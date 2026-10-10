# Fast: guide for Claude

How to work on Fast, and what the owner has decided. README.md covers what the app does, the weight Shortcut and redeploying.

## Working with the owner

- The owner doesn't write code. Do all the technical work yourself (code, tests, deploys) and explain only what they must do, such as steps on the iPhone or a login, one step at a time in plain words. No code walkthroughs.
- Before a big change, say what you will build and ask anything unclear first. When the owner asks whether you understood, confirm before acting.
- Check every visual change in screenshots at 390×844 before it goes live. `tests/e2e/screens.spec.js` shoots every screen into `test-results/screens/` and audits text contrast.
- The repository is public. Never commit personal data or the owner's email address; commits use the GitHub no-reply address set in this repo's git config.

## Where things live

- Live app: https://asalkulaib.github.io/fast/ (GitHub Pages serves `docs/` from `main`).
- Code: https://github.com/asalkulaib/fast, with a working copy in `Desktop\My Apps\Fast` on the owner's PC (synced by OneDrive).
- The owner's data (fasts, meals, weights) lives only in IndexedDB on their iPhone, never in this repo. More, Back up now protects it.
- Plain HTML, CSS and JavaScript modules: no framework, no build step. `docs/js/core/` holds the pure rules, `docs/js/ui/` the screens.

## Every change

1. When behaviour changes, update README.md and the Help screen (`docs/js/ui/help.js`) to match, and keep this file current.
2. `npm test` (unit) and `npm run e2e` (stamps a release, then runs the browser tests in WebKit and Chromium). Commit only when both pass in full: unit ends with `fail 0`, and e2e shows nothing failed or flaky. A filtered run is not enough.
3. Stamp after the last edit (`npm run release`, or the stamp inside `npm run e2e`); without it phones keep the old version.
4. Commit with `git commit -F <message file>`: PowerShell 5.1 splits quotes inside arguments.
5. Push, wait for the Pages build, then check that https://asalkulaib.github.io/fast/js/version.js shows the new release.

## Rules the tests hold you to

- Colours only from the palette in `tests/unit/design.test.js`. Corners only `0` or `var(--r-pill)`, `var(--r-control)`, `var(--r-panel)`, `var(--r-sheet)`. No shadows, gradients, blur or glass.
- Copy in the app and README: short and direct, with no em dashes, emojis, checkmarks or "it's not X, it's Y".
- The Content Security Policy blocks inline `style` attributes and `<style>`: set dynamic values with `element.style.setProperty`.
- Nothing loads from another origin; the fonts are bundled.

## Decisions the owner made (keep them)

- Look: "Nafud at midday", sand page and umber ink. Gold only for achievement (a successful day, a fasting goal reached, a day left wanting, the Uhud fast climber) and the sun on the dial. Selections in ink. A miss is clay stripes and always has words. Every colour-coded visual has a labelled legend.
- Shapes are rounded by the owner's choice: pill buttons, rounded controls, soft panels and sheets. The dial, chart marks and legend keys keep their drawn shapes.
- The stage icons move (the owner asked for lively, always on): the stage the fast is in, on the dial and in the chip under the time, and the stage in view on the stages line. Movement only, in the icon's own ink: no glow, no gold, no blur. CSS keyframes on each icon's parts (`.p0`, `.p1`... in `docs/js/ui/icons.js`); Reduce Motion stops them.
- Every choice, every rating and the bottom tabs are sliding tracks with an ink pill (no liquid glass). The tab bar and the message bar float with nothing behind them.
- After the window closes, the new fast leads Today (owner's request): the fullness check reminder while it runs, then a Fasting card with the full-size dial and its two times, the stage panel, and the closed window's card, unchanged, below them (`fastFirst` in `docs/js/ui/today.js`). While a meal started after closing is still being eaten, the window's card (with Finished this meal) stays on top.
- Big figures: large digits with small units (15h 10m).
- Anything tappable must look tappable (a pill or an outline), never plain text.
- Custom sets the goal by eating window or by fasting (`goal-by`). Fasting 12 to 23 h sets the window to the rest of the day; 24 to 72 h is a long fast the owner chose to keep for every fast (`goalChanges` entry `{ from, hours, fast }`): eating days keep their window and its rules, a past day that begins inside the fast's goal with nothing eaten is a success (state `fasted`, `insideLongFast` in `docs/js/core/rules.js`), breaking it early is not a miss, and the dial shows no goal tick past 24 h.
- Day fullness is the worst meal rating, and the gold dot in the week rows means left wanting only. The owner confirmed this twice: don't propose alternatives or extra marks.
- Just now on Last bite always moves the last bite to this minute, even when that makes the day a miss.
- Alarms start one kind of timer only: the 20-minute fullness check, when a meal is finished, the first meal of the day included. The owner had the timer for the window closing removed: starting a meal starts no timer.
- Add a meal adds a meal already eaten, whole, with no timer: today or yesterday from Today and Satiety, any day from a day in Week. It follows the same window rules as any meal (`placeAddedMeal` in `docs/js/core/added-meal.js`) and says before saving what it does to the day, misses in words. Start a meal, Finished this meal and the automatic 20-minute check stay exactly as they are; the owner asked for that.
- Weights arrive by clipboard paste from an iOS Shortcut (10 steps in Help and README), because iOS keeps a Home Screen app's storage apart from Safari. The Shortcut never shows a number, and import messages give counts only.
- Weight figures are 7-day averages that count every weigh-in, a single one included (`MIN_WEIGH_INS` is 1): the owner chose that so nothing goes stale, over the old rule of hiding a week with fewer than 3. The chart plots the 7-day average on each weigh-in day, the same figure as the big number, over 1 month, 3 months, 6 months, This year or All (remembered), breaks the line across a week with no weigh-in, and has a note under it saying so. Touching or dragging along the chart moves the big box to that day (average, Up to, weigh-ins, change); a Back to latest pill in the box returns, and leaving Weight or changing the time frame resets it.
- If weights stop arriving: Health must let Shortcuts read Weight, and the scale's own app must be allowed to write Weight to Health (some scale apps sync only when opened).
- Fasting stages run to 72 h and beyond: six stages, each worded within the human studies cited in `docs/js/core/stages.js`, with no hour given for autophagy. The dial stays a 24-hour scale; past a day one icon by the far horizon shows the stage the fast is in. The last stage says a fast that long is best done with a doctor's guidance. Read more on each card opens that stage's longer page in the same sheet (`docs/js/core/stage-more.js`): every finding names a study in `SOURCES` and stays within what it reports, with no links out of the app.

## Gotchas

- WebKit ignores `lnum` on a digit alone in its own text node, so Cormorant draws an old-style figure. `figureParts` appends U+200B to a lone first digit; Playwright's `toHaveText` strips U+200B.
- The app redraws once just after starting (it saves the `persisted` setting). `openAt` and `seed` in `tests/e2e/helpers.js` wait for that redraw; anything that reloads the page must wait too.
- WebKit can run `locator.evaluate` on an element a redraw just removed, so `setTime` and the slider drag helper retry.
- OneDrive can lock a file for a moment; screenshot writes retry.
- When cutting CSS, remove exact brace-matched rule blocks, never "from here to the next heading".
- `--rock-500` cannot carry body text: it misses 4.5:1 with both ink and light words. The stage cards skip it (sand-300, sand-400, rock-400, then sand-600, rock-700 and rule with light words).

## This PC

- GitHub CLI: `%LOCALAPPDATA%\Programs\GitHubCLI\bin\gh.exe` (not on PATH), logged in as asalkulaib.
- `npx playwright install` times out here; the browsers were downloaded with curl into `%LOCALAPPDATA%\ms-playwright\`.
- Shell heredocs and long one-liners mangle quotes and escapes: write a script to a file and run it with node.

## Cloud sessions

- Chromium is at `/opt/pw-browsers/chromium`: run e2e through an untracked config that sets `launchOptions.executablePath` to it.
- WebKit needs `cdn.playwright.dev` allowed in the environment's network settings (the owner added it). Its usual address redirects to a blocked Microsoft host, so curl `https://cdn.playwright.dev/builds/webkit/<revision>/webkit-ubuntu-24.04.zip` (the revision is in `node_modules/playwright-core/browsers.json`) into a folder of the scratchpad, unzip it into `webkit-<revision>/`, run with `PLAYWRIGHT_BROWSERS_PATH` set to that folder, and `apt-get install` the libraries the launch error names (libevent-2.1-7t64, libsoup-3.0-0, libavif16, libmanette-0.2-0, libenchant-2-2, libwoff1, libgstreamer-gl1.0-0, libgstreamer-plugins-bad1.0-0 and the like).
- Without WebKit, `screens.spec.js` skips, so shoot screens with an untracked copy that drops the skip, and say plainly which browser did not run.

## Offered, not built

- A Ramadan rhythm: offline dawn and sunset times for Kuwait, suhoor and iftar as meals. Ramadan is only a pause reason today.
- A Satiety chart by meal type.
- A weekly Shortcuts automation for the weight import (set up on the phone).
