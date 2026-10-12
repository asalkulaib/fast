# Fast, redesigned: handoff for the new app

This file hands a new chat everything it needs to build a second app: the same features and rules as Fast (this repository), with a completely new, world-class design. The current app stays exactly as it is and keeps running at https://asalkulaib.github.io/fast/.

Read this whole file first, then README.md and CLAUDE.md in this repository, then the code. The feature inventory below is the contract: every feature, rule and message in it must exist in the new app, behaving the same, unless the owner says otherwise.

## What the owner decided for the new app

The owner answered these questions on 12 October 2026, at the end of the long chat in which Fast was built.

| Question | Answer |
|---|---|
| Where it lives | A new GitHub repository of its own, with its own GitHub Pages address and its own Home Screen icon. The current app and its repository (asalkulaib/fast) stay untouched. |
| Name | Not chosen yet. Propose a few names along with the first design directions, and let the owner choose. The repository and Home Screen name follow the choice. |
| The owner's data | The new app starts empty. No migration is needed now. Keeping a compatible backup format (see the inventory) costs little and lets the owner move data later if they ask. |
| Platform | An iPhone Home Screen web app, like Fast: free, offline, updates by push, no App Store. |
| Inspiration | All four families: Apple Fitness and its Activity rings (bold colour, big rings and numbers, playful celebrations); Whoop and Oura (premium, calm, data-rich scores, gauges and trends with breathing room); Zero and Gentler Streak (friendly illustration, soft colour, gentle motivation, fasting first); Nike Training Club and Strava (editorial and energetic: huge type, strong colour blocks, bold graphics). |
| What to keep of Fast's look | Nothing: a clean slate. Every feature and rule stays; every colour, font, shape, illustration and layout is new. Fast's design rules (the sand and umber palette, gold only for achievements, rounded pills, the Saudi scenery, the sun dial, the moving stage icons) do not bind the new app. Any of them may come back only if the new design earns it and the owner agrees. |
| Light or dark | Light only. |

## How to work with the owner

These carry over from CLAUDE.md, because they are about the person, not the design.

- The owner does not write code. Do all technical work yourself: code, tests, deploys. Explain only what they must do (steps on the iPhone, a login, a GitHub setting), one step at a time in plain words. No code walkthroughs.
- Before a big change, say what you will build and ask anything unclear first; the owner likes clarifying questions with clear options and a recommendation. When the owner asks whether you understood, confirm before acting.
- Show visual work before it goes live: screenshots at 390 x 844 (iPhone), or a published artifact for design directions. Go live only when the owner says so.
- The repositories are public. Never commit personal data or the owner's email address. Commits use the GitHub no-reply address in the repository's git config.
- Use they/them for the owner.
- Copy in the app: short and direct. Fast's copy rules (no em dashes, emojis, checkmarks or "it's not X, it's Y") are about voice, not look, and the owner liked them; keep them unless the owner says otherwise.

## The first steps for the new chat

1. Read this file, README.md and CLAUDE.md, and skim the code (docs/js/core holds the pure rules, docs/js/ui the screens).
2. Research the four inspiration families on the web (screens, motion, typography, colour, how each shows progress, streaks, rings, scores and celebrations), and what makes each world-class.
3. Propose three distinct design directions for the new app, light theme, each shown as real screens at phone size (Today with a fast running, the window open, a closed day, Week, History, Satiety, Weight, More), with a short rationale, and propose three to five names. Ask the owner to choose a direction and a name, with your recommendation. Ask any other clarifying questions then.
4. When the owner has chosen: create the repository (GitHub tools: create it under asalkulaib, public, so GitHub Pages is free), set up the same kind of project (see Technical notes), and ask the owner to turn on GitHub Pages for it, one step at a time (repository Settings, Pages, Deploy from a branch, main, /docs), unless you can do it yourself.
5. Build in stages the owner can see: the design system and Today first, then the rest of the screens, keeping the inventory as a checklist. Port the pure rules from docs/js/core and their unit tests rather than rewriting them, so behaviour stays identical; rewrite the UI.
6. Before each go-live: unit tests and browser tests pass in full, screenshots checked, a review for bugs, and the owner's yes.

## Technical notes

- Fast is plain HTML, CSS and JavaScript modules with no framework and no build step, served from docs/ on main by GitHub Pages, with a service worker that precaches every file so it works offline, and a release stamp (tools/release.mjs) so phones pick up new versions. The new app may choose its own stack, but it must stay a static site on GitHub Pages that works offline as a Home Screen app, with nothing loaded from other sites at run time. Keeping the same no-build module approach makes porting docs/js/core and its tests straightforward; a different stack is fine if the design needs it and the owner understands the trade-off.
- Data lives only on the iPhone, in IndexedDB. iOS keeps a Home Screen app's storage apart from Safari, which is why weights arrive by clipboard paste from an iOS Shortcut. The new app is a separate app at a separate address: it has its own storage, and its own weight import (the Shortcut can stay the same; Help explains the steps).
- Tests: unit tests with node --test; browser tests with Playwright in WebKit (Safari's engine) and Chromium at 390 x 844. In cloud sessions, follow the "Cloud sessions" part of CLAUDE.md to get Chromium (/opt/pw-browsers/chromium) and WebKit (download from cdn.playwright.dev into the scratchpad, apt-get the libraries it names).
- The owner's iPhone is the final check: after a deploy, tell them how to reopen the app to get the new version.

## The current app, for reference

- Live: https://asalkulaib.github.io/fast/
- Code: https://github.com/asalkulaib/fast (this repository). Do not change it while building the new app, except to keep this handoff current if the owner asks.
- The full list of the owner's decisions about how Fast behaves is in CLAUDE.md ("Decisions the owner made"). The behavioural ones apply to the new app too; the visual ones do not.

## The feature inventory (the contract)

Every feature, rule, threshold and message of Fast, catalogued from the code by area. Each file names the source files and tests that pin the behaviour, so the new chat can read the original whenever a detail is unclear, and port the pure rules in docs/js/core with their unit tests. Styling is left out on purpose: the new app restyles everything.

- [Today and the fast](redesign/inventory/today-fasting.md)
- [Meals and satiety](redesign/inventory/meals-satiety.md)
- [Fasting stages](redesign/inventory/stages.md)
- [Week, History and the Day screen](redesign/inventory/week-history-day.md)
- [Weight](redesign/inventory/weight.md)
- [More, goals, pauses, calendar, backup, travel and Tempted](redesign/inventory/settings-goals.md)
- [Platform, data, offline, tests](redesign/inventory/platform.md)
