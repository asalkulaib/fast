// Help: the weight Shortcut, the weekly automation, the Home Screen.

import { h } from './dom.js';
import { button } from './components.js';
import { header } from './shared.js';
import { SHORTCUT_NAME } from './weight.js';

const code = (text) => h('span', { class: 'num' }, text);

export function renderHelp(ctx, app) {
  return h('div', { class: 'help' },
    header(ctx, app, { title: 'Help' }),
    h('section', { class: 'section strong' },
      h('h1', { class: 'display' }, 'Weight Shortcut'),
      h('p', { class: 'gap' }, 'Your scale syncs each weigh-in to Apple Health. This Shortcut reads the last 14 days, scrambles them and copies them to the clipboard. It never shows a number. Fast then shows only averages.'),
      button('‹ Back', () => app.go('more'), { kind: 'secondary', name: 'back' })),

    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Build it once'),
      h('ol', { class: 'steps gap-s' },
        h('li', {}, h('span', {}, 'Open the Shortcuts app and tap + to start a new shortcut. Tap its name at the top, choose Rename, and call it ', code(SHORTCUT_NAME), '.')),
        h('li', {}, h('span', {}, 'Add the action Find Health Samples. Set Type to Weight. Tap Add Filter and set Start Date is in the last 14 days. Set Sort by to Start Date and Order to Oldest First. Leave Limit off.')),
        h('li', {}, h('span', {}, 'Add Repeat with Each. It repeats over the Health Samples.')),
        h('li', {}, h('span', {}, 'Inside the repeat, add Format Date. For the date, choose Repeat Item, tap it and pick Start Date. Set Date Format to Custom and type ', code('yyyy-MM-dd'), '.')),
        h('li', {}, h('span', {}, 'Still inside the repeat, add a Text action. Put in Formatted Date, then a colon, then Repeat Item with its Value property (tap Repeat Item and choose Value). It reads ', code('Formatted Date:Repeat Item'), '.')),
        h('li', {}, h('span', {}, 'After End Repeat, add Combine Text. Combine Repeat Results with Custom and type a comma.')),
        h('li', {}, h('span', {}, 'Add a Text action: type ', code('w='), ' and then insert Combined Text.')),
        h('li', {}, h('span', {}, 'Add Base64 Encode for that Text, with Line Breaks set to None.')),
        h('li', {}, h('span', {}, 'Add Copy to Clipboard. Tap its arrow and turn on Local Only.')),
        h('li', {}, h('span', {}, 'Add Show Notification with the text ', code('Weight ready. Open Fast and tap Import weight.'), ' Do not add Show Result or Quick Look: they would display the data.')),
        h('li', {}, h('span', {}, 'Tap Done, then run it once. Allow Health access to Weight when asked.')))),

    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Import'),
      h('p', { class: 'gap-s' }, 'Open Fast, go to Weight and tap Import weight, then tap Paste in the small bubble. Fast saves the entries and says only how many it imported.')),

    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Run it every week'),
      h('ol', { class: 'steps gap-s' },
        h('li', {}, h('span', {}, 'In Shortcuts, open the Automation tab and tap +.')),
        h('li', {}, h('span', {}, 'Choose Time of Day. Pick a time you usually have the phone in hand, such as 10:00, set Repeat to Weekly and choose Friday.')),
        h('li', {}, h('span', {}, 'Choose Run Immediately, then Next.')),
        h('li', {}, h('span', {}, `Pick ${SHORTCUT_NAME} and tap Done.`)),
        h('li', {}, h('span', {}, 'When the notification arrives, open Fast and tap Import weight. Health is locked while the iPhone is locked, so if the automation ran then, use Run the Fast Weight shortcut on the Weight screen instead.')))),

    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Add Fast to your Home Screen'),
      h('ol', { class: 'steps gap-s' },
        h('li', {}, h('span', {}, 'Open the Fast link in Safari.')),
        h('li', {}, h('span', {}, 'Tap Share. In iOS 26 it sits inside the ••• button at the bottom right.')),
        h('li', {}, h('span', {}, 'Scroll down and tap Add to Home Screen.')),
        h('li', {}, h('span', {}, 'Keep Open as Web App switched on and tap Add.')),
        h('li', {}, h('span', {}, 'From now on open Fast from its icon. The Home Screen app keeps its own data, separate from Safari.')))),

    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'If an import fails'),
      h('ul', { class: 'plain gap-s small' },
        h('li', {}, 'No weight data on the clipboard: run the Shortcut again, come back to Fast and tap Import weight.'),
        h('li', {}, 'Entries skipped: in the Health app, open Weight and set its unit to kg. In Settings, General, Language and Region, set Calendar to Gregorian.'),
        h('li', {}, 'The Paste bubble does not appear: tap Import weight again, or use the paste box that appears on the Weight screen.'))),
  );
}
