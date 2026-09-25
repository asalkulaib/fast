# Fast

A personal eating-window and satiety tracker for iPhone. It is a Progressive Web App: it installs to the Home Screen, works fully offline and keeps every piece of data on the phone. There is no account, no server and no analytics.

Live app: https://asalkulaib.github.io/fast/

## Use it on your iPhone

1. Open the link above in Safari.
2. Tap Share. In iOS 26 it sits inside the â€¢â€¢â€¢ button at the bottom right.
3. Scroll down and tap Add to Home Screen.
4. Keep Open as Web App switched on and tap Add.
5. From now on, open Fast from its Home Screen icon. The Home Screen app keeps its own data, separate from Safari.

## The rules Fast follows

- Kuwait time (UTC+3). Workdays are Sunday to Thursday, weekends Friday and Saturday.
- The first bite opens the window and starts a 4-hour countdown. A window belongs to the day of its first bite, even when it runs past midnight.
- A day succeeds when all eating falls within 4 hours of the first bite, with 15 minutes of grace. Beyond 4 h 15 min it is a miss, shown as the time over 4 hours.
- On a workday, a window that opens before 16:00 is a miss. A day marked as a day off follows weekend rules.
- Eating after "I'm done eating" counts as outside the window and makes the day a miss. While you are still inside the 4 hours, you can reopen the window instead.
- Between midnight and 04:00, late eating can be counted against the night before.
- The streak counts consecutive successful days. A day with nothing logged breaks it, so Fast asks you to fill in any gap.

## Fasting stages

While you fast, Today shows a 24-hour stage bar timed from your last bite. The hours are typical, not exact, and never a target. Past 24 hours the bar stays full.

| Stage | Typical time | Based on |
|---|---|---|
| Digesting | 0 to about 4 h | [Dimitriadis et al., Nutrients 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7825450/) |
| Blood sugar settles | about 4 to 12 h | [Dimitriadis et al., Nutrients 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7825450/) |
| Metabolic switch | from about 12 h, up to 36 h | [Anton et al., Obesity 2018](https://pubmed.ncbi.nlm.nih.gov/29086496/) |
| Ketones climbing | 24 h and beyond | [Pan et al., 2000](https://journals.sagepub.com/doi/10.1097/00004647-200010000-00012); [Ho et al., J Clin Invest 1988](https://pmc.ncbi.nlm.nih.gov/articles/PMC329619/) |

Autophagy is described as uncertain instead of being given an hour: the evidence comes mostly from cell and animal studies ([Bagherniya et al., 2018](https://pubmed.ncbi.nlm.nih.gov/30172870/); [Bensalem et al., 2025](https://pubmed.ncbi.nlm.nih.gov/40345145)).

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
