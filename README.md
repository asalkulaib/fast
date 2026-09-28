# Fast

A personal eating-window and satiety tracker for iPhone. It is a Progressive Web App: it installs to the Home Screen, works fully offline and keeps every piece of data on the phone. There is no account, no server and no analytics.

Live app: https://asalkulaib.github.io/fast/

## The look

Nafud at midday: sand is the page, umber ink the text, and gold leaf marks the one value that matters on each screen. Clay appears only for misses. Fonts are Cormorant Garamond, EB Garamond and Jost, with square corners and hairline rules.

## Use it on your iPhone

1. Open the link above in Safari.
2. Tap Share. In iOS 26 it sits inside the three-dot button at the bottom right.
3. Scroll down and tap Add to Home Screen.
4. Keep Open as Web App switched on and tap Add.
5. From now on, open Fast from its Home Screen icon. The Home Screen app keeps its own data, separate from Safari.

## The rules Fast follows

- Kuwait time (UTC+3). Workdays are Sunday to Thursday, weekends Friday and Saturday.
- Your goal is an eating window: 16:8, 18:6, 20:4 (the default), 23:1, or any whole number of hours from 1 to 12. The fasting goal is the rest of the 24 hours. Change it in More, Goal, or by tapping Goal on Today. A change applies from that day on; past days keep the goal they had.
- Starting your first meal opens the window: its start is the first bite, and the countdown of your eating window begins. A window belongs to the day of its first bite, even when it runs past midnight.
- A day succeeds when all eating falls within the window goal, with 15 minutes of grace. Beyond that it is a miss, shown as the time over the goal.
- On a workday, a window that opens before 16:00 is a miss. A day marked as a day off follows weekend rules.
- Eating after "I'm done eating" counts as outside the window and makes the day a miss. While you are still inside the window goal, you can reopen the window instead.
- Between midnight and 04:00, late eating can be counted against the night before.
- The streak counts consecutive successful days, shown in Week. A day with nothing logged breaks it, so Fast asks you to fill in any gap.
- A paused day is not tracked for fasting: it is never a miss, and it neither counts towards the streak nor breaks it. Fullness still counts.

## Starting: a meal or Begin fast

Before your window, Today offers two equal buttons.

- Start a meal: your first meal opens the window. The sheet has the eating reminders, the meal's name, hunger before, and its start time, with quick times (30 min, 1 h, 2 h ago) and the wheel. Already eaten? Log it whole with how you finished. On a workday before 16:00, the sheet says the day will count as a miss.
- Begin fast: for a fast already under way, for example on your first day with Fast or after a pause. Pick Now, 1 or 2 hours ago, last night, or any time on the wheel, so none of the fast is lost. Tap Fast began on Today to adjust it later. A fast start never changes the result of the day it falls on, and it cannot be earlier than the last bite on record.

Each meal is tracked on its own: its start, its finish, hunger before, how you finished and the 20-minute check. One meal at a time: Start another meal first asks how the open one finished. I'm done eating closes the window. After closing, a meal within your goal's hours reopens the window; later, it counts as eating outside the window, so the day is a miss, and its satiety is still tracked.

## Changing a time

Every time in Fast is set on a rolling 24-hour wheel, like the iPhone clock. The hours and minutes wrap around, so 23 rolls straight on to 00.

- On Today, tap Last bite (before your window) or First bite and Last bite (after it) to change that time.
- While the window is open, tap Opened to move the opening time, or remove a window opened by mistake.
- Any day can be corrected from Week: tap the day.
- After a change is saved, the message above the tabs offers Undo for 10 seconds. Removing a window, a meal or an entry can be undone the same way.

## Fullness (شبع)

When you finish a meal, Fast asks how you finished: Left wanting (the goal), Satisfied, or Overfull. A day counts as left wanting only when every meal was. When the day's meals were not rated, and on paused days, Today asks once how the day's eating ended. Fullness is logged every day, holidays and pauses included. The 1 to 10 ratings and the 20-minute check stay as before.

## Jebel Uhud

Today shows your progress as a climb up Jebel Uhud, in place of the streak. Two climbers take their own paths:

- The fast climber moves up one step for each successful day.
- The fullness climber moves up one step for each day left wanting.

Thirty steps reach the summit. A climber who arrives stays there, and a new one starts from the base, so the summit fills with every completed climb; the tallies read, for example, "Fasts: 2 summits · Fullness: 4 summits". A missed day holds a climber in place; nothing slips back. On paused days the fast climber waits while the fullness climber keeps climbing. In More, Jebel Uhud, either climber can be switched off: it is hidden and does not track, and switched on again it resumes where it stopped. With both off, Today shows the streak again.

## Fasting stages

While you fast, Today shows a 24-hour ring timed from your last bite (or from when you began your fast), with the time fasted and the stage in its centre. A cream tick marks your fasting goal, and the line below says how far it is. An icon marks each stage: a plate while digesting, a drop as blood sugar settles, a flame for the metabolic switch and a bolt for ketones. The current stage's icon is gold. Before your window the ring leads Today; after it, the ring sits below the result. The hours are typical, not exact, and never a target. Past 24 hours the ring stays full.

| Stage | Typical time | Based on |
|---|---|---|
| Digesting | 0 to about 4 h | [Dimitriadis et al., Nutrients 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7825450/) |
| Blood sugar settles | about 4 to 12 h | [Dimitriadis et al., Nutrients 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7825450/) |
| Metabolic switch | from about 12 h, up to 36 h | [Anton et al., Obesity 2018](https://pubmed.ncbi.nlm.nih.gov/29086496/) |
| Ketones climbing | 24 h and beyond | [Pan et al., 2000](https://journals.sagepub.com/doi/10.1097/00004647-200010000-00012); [Ho et al., J Clin Invest 1988](https://pmc.ncbi.nlm.nih.gov/articles/PMC329619/) |

Autophagy is described as uncertain instead of being given an hour: the evidence comes mostly from cell and animal studies ([Bagherniya et al., 2018](https://pubmed.ncbi.nlm.nih.gov/30172870/); [Bensalem et al., 2025](https://pubmed.ncbi.nlm.nih.gov/40345145)).

## History

The History tab charts, day by day, either your fasts or your eating windows, as bars or a line, over 7, 30 or 90 days. A day's fast runs from your last bite before it to that day's first bite. Missed days show in clay. A solid line shows the 7-day trend and a dashed line the average; a legend names each. Paused days are shaded and left out. Tap a day to read its value and trend, then Open this day to edit it. Show as a table lists every value. Fast remembers your choices.

## Pauses

For travel, illness, holidays, leave or Ramadan. On Today, Pause today pauses the day in one tap. In More, Pauses, Add a pause sets a from and an until date (up to 60 days, and it can start ahead, for example for Ramadan) with an optional reason. While a day is paused, Today shows Paused until the last day, with no window to log; only the day's fullness is asked. Paused days are left out of the Week and History counts. End a pause early from Today or from More; unpause a single day from Week by tapping it. A window still open must be closed before its day can be paused.

## Weight Shortcut

Your scale syncs each weigh-in to Apple Health. This Shortcut reads the last 14 days, scrambles them and copies them to the clipboard. It never shows a number, and Fast shows only 7-day and weekly averages.

Build it once in the Shortcuts app:

1. Tap + to start a new shortcut. Tap its name at the top, choose Rename, and call it `Fast Weight`.
2. Add the action Find Health Samples. Set Type to Weight. Tap Add Filter and set Start Date is in the last 14 days. Set Sort by to Start Date and Order to Oldest First. Leave Limit off.
3. Add Repeat with Each. It repeats over the Health Samples.
4. Inside the repeat, add Format Date. For the date, choose Repeat Item, tap it and pick Start Date. Set Date Format to Custom and type `yyyy-MM-dd`.
5. Still inside the repeat, add a Text action with Formatted Date, a colon, then Repeat Item with its Value property (tap Repeat Item and choose Value). It reads `Formatted Date:Repeat Item`.
6. After End Repeat, add Combine Text: combine Repeat Results with Custom and type a comma.
7. Add a Text action: type `w=` and then insert Combined Text.
8. Add Base64 Encode for that Text, with Line Breaks set to None.
9. Add Copy to Clipboard. Tap its arrow and turn on Local Only.
10. Add Show Notification with the text `Weight ready. Open Fast and tap Import weight.` Do not add Show Result or Quick Look: they would display the data.
11. Tap Done and run it once. Allow Health access to Weight when asked.

To import: open Fast, go to Weight, tap Import weight, then tap Paste in the small bubble. Fast saves the entries and reports only how many it imported. Duplicate dates keep the latest value.

Run it every week with a Personal Automation:

1. In Shortcuts, open the Automation tab and tap +.
2. Choose Time of Day. Pick a time you usually have the phone in hand, such as 10:00, set Repeat to Weekly and choose Friday.
3. Choose Run Immediately, then Next, pick Fast Weight and tap Done.
4. When the notification arrives, open Fast and tap Import weight. Health is locked while the iPhone is locked, so if the automation ran then, use Run the Fast Weight shortcut on the Weight screen instead.

Why the clipboard: iOS gives a Home Screen web app its own storage, separate from Safari, and a Shortcut can only open links in Safari. Fast also accepts a link, `https://asalkulaib.github.io/fast/import/#w=2026-09-25:104.6,...`, but opened from a Shortcut it saves into Safari's copy of Fast, not the Home Screen app.

If an import fails:

- No weight data on the clipboard: run the Shortcut again, come back to Fast and tap Import weight.
- Entries skipped: in the Health app, open Weight and set its unit to kg. In Settings, General, Language and Region, set Calendar to Gregorian.

## Calendar reminders

More, Add to Calendar creates four repeating alerts: hold the line at 13:00 and training at 16:30 on workdays, and the window start at your workday and weekend times. In the share sheet choose Calendar, or Save to Files and then open the file and tap Add All. If you change the times, add the new file and delete the old Fast events (open one, Delete Event, Delete All Future Events).

## Backups

Everything lives only on the phone. More, Back up now saves a JSON file; keep it in Files or iCloud Drive. Fast reminds you after 7 days without a backup. More, Restore from a backup brings everything back. Export CSV files gives windows, meals, weight (the only place raw weights appear), check-ins and temptations for Excel.

## Start again

More, Reset all history deletes every window, meal, check-in, pause, temptation and weigh-in from the phone. It asks twice, and the first step offers a backup. Your planned times and reminder times stay. A backup made before the reset can bring everything back with Restore from a backup.

## Redeploy after a change

Needs Git, Node 20 or later and the GitHub CLI, logged in.

```
npm install
npx playwright install webkit chromium
npm test
npm run e2e
npm run release
git add -A
git commit -m "Describe the change"
git push
```

- `npm test` runs the unit tests (rules, streaks, weekly review, weight import, calendar, CSV and backup formats, design and copy guards).
- `npm run e2e` stamps a release and runs the browser tests in WebKit and Chromium at iPhone size, including offline use. Screenshots of every screen land in `test-results/screens`.
- `npm run release` stamps the service worker with the list of files and a new version. Always run it before pushing, or phones keep the old version.
- GitHub Pages publishes the `docs` folder a minute or two after the push. The phone picks up the new version the next time Fast is opened (close it from the app switcher and open it again).
- If `npx playwright install` times out on Windows, download the browser archives listed by `npx playwright install --dry-run webkit chromium` with curl and unzip them into the listed folders.

## Project layout

- `docs/`: the app exactly as served. `index.html`, `import/index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `fonts/` (Cormorant Garamond, EB Garamond and Jost, SIL Open Font License), `icons/`, `js/core/` (pure rules and file formats), `js/ui/` (screens), `js/db.js` (IndexedDB), `js/store.js`.
- `tests/unit/`: Node's built-in test runner.
- `tests/e2e/`: Playwright tests.
- `tools/`: local server (`npm run serve`), font download, icon rendering, release stamp.

The code in this repository is public; your data never leaves your phone.
