// Fast: app shell. Routing, rendering, the one-second tick, prompts and the
// actions that hand files to iOS.

import * as store from './store.js';
import { requestPersistence } from './db.js';
import { h, fadeIn, fadeOut, updateLive } from './ui/dom.js';
import { button } from './ui/components.js';
import { now, dayKey, isDayKey, fmtDayLong } from './core/time.js';
import { makeEvaluator, streaks, todayMode, trackingStart } from './core/rules.js';
import { buildIcs, icsTimes } from './core/ics.js';
import { buildCsvFiles } from './core/csv.js';
import { buildBackup, backupFileName, describeBackup, parseBackup } from './core/backup.js';
import { renderToday, signature as todaySignature } from './ui/today.js';
import { renderWeek } from './ui/week.js';
import { renderDay } from './ui/day.js';
import { renderWeight } from './ui/weight.js';
import { renderMore } from './ui/more.js';
import { renderHelp } from './ui/help.js';
import { currentSheet, isSheetOpen, openSheet, sheetHead } from './ui/sheet.js';
import { showFullnessSheet } from './ui/meal.js';
import { knownOutcome, resumeTemptation, startTemptation, unfinishedTemptation } from './ui/temptation.js';
import { dueFullness } from './ui/shared.js';
import { deliverFiles } from './ui/share.js';
import { importWeightText } from './weight-import.js';
import { VERSION } from './version.js';

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const sheetRoot = document.getElementById('sheet-root');

const ROUTES = ['today', 'week', 'day', 'weight', 'more', 'help'];
let route = parseRoute(location.hash);
let lastSignature = '';
let lastStateKey = '';
let flash = null; // { text, until }
let renderQueued = false;
const prompted = new Set();

function parseRoute(hash) {
  const [name, arg] = hash.replace(/^#\/?/, '').split('/');
  if (!ROUTES.includes(name)) return { name: 'today' };
  if (name === 'day' && !isDayKey(arg)) return { name: 'week' };
  if (name === 'week' && arg && !isDayKey(arg)) return { name: 'week' };
  return { name, arg };
}

/** Everything a screen needs, computed fresh. */
function context() {
  const nowTs = now();
  const todayKey = dayKey(nowTs);
  const d = store.data();
  const startKey = trackingStart({ ...d, installedAt: d.settings.installedAt }, todayKey);
  const evaluate = makeEvaluator({ days: d.days, outside: d.outside, nowTs, todayKey, startKey });
  const mode = todayMode({ days: d.days, todayKey, nowTs });
  return {
    ...d,
    nowTs,
    todayKey,
    startKey,
    evaluate,
    mode,
    openRec: mode.mode === 'open' || mode.mode === 'forgot' ? mode.rec : null,
    streak: streaks(evaluate, todayKey, startKey),
  };
}

function signatureOf(ctx) {
  const base = `${route.name}|${route.arg || ''}|${ctx.todayKey}|${!!ctx.openRec}`;
  return route.name === 'today' ? `${base}|${todaySignature(ctx)}` : base;
}

function renderRoute(ctx) {
  switch (route.name) {
    case 'week': return renderWeek(ctx, app, route.arg);
    case 'day': return renderDay(ctx, app, route.arg);
    case 'weight': return renderWeight(ctx, app);
    case 'more': return renderMore(ctx, app);
    case 'help': return renderHelp(ctx, app);
    default: return renderToday(ctx, app);
  }
}

function render(fresh) {
  if (!store.state.ready) return;
  const ctx = context();
  const y = window.scrollY;
  const node = renderRoute(ctx);
  const flashNode = flash && flash.until > ctx.nowTs
    ? h('p', { class: 'flash', role: 'status', 'data-testid': 'flash' }, flash.text)
    : null;
  view.classList.toggle('with-dunes', route.name === 'today' || (route.name === 'weight' && !ctx.weights.size));
  view.replaceChildren(...[flashNode, node].filter(Boolean));
  view.removeAttribute('aria-busy');
  // A soft fade when the screen or the state of the day changes.
  const stateKey = `${route.name}|${route.arg || ''}|${ctx.mode.mode}`;
  if (fresh) {
    window.scrollTo(0, 0);
    fadeIn(node);
  } else {
    window.scrollTo(0, y);
    if (stateKey !== lastStateKey) fadeIn(node);
  }
  lastStateKey = stateKey;
  const tab = route.name === 'day' ? 'week' : route.name === 'help' ? 'more' : route.name;
  for (const b of tabbar.querySelectorAll('.tab')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  lastSignature = signatureOf(ctx);
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => {
    renderQueued = false;
    render(false);
  });
}

function editing() {
  const el = document.activeElement;
  return !!el && view.contains(el) && /^(INPUT|TEXTAREA)$/.test(el.tagName);
}

/** Opens prompts that are due: an unfinished temptation, then fullness checks. */
function prompts(ctx) {
  if (isSheetOpen() || editing()) return;
  const t = unfinishedTemptation(ctx);
  if (t && !prompted.has(`t${t.id}`)) {
    prompted.add(`t${t.id}`);
    // A window opened since the temptation began already tells how it ended.
    const known = knownOutcome(ctx, t);
    if (known) store.updateTemptation(t.id, { outcome: known, step: 'done', endedAt: now() });
    else resumeTemptation(app, t.id);
    return;
  }
  const due = dueFullness(ctx).find((m) => !prompted.has(`f${m.id}`));
  if (due) {
    prompted.add(`f${due.id}`);
    showFullnessSheet(app, due.id);
  }
}

function tick() {
  if (document.hidden || !store.state.ready) return;
  const ctx = context();
  if (flash && flash.until <= ctx.nowTs) {
    const el = view.querySelector('[data-testid="flash"]');
    flash = null;
    if (el) fadeOut(el).then(() => el.remove());
  }
  if (signatureOf(ctx) !== lastSignature && !editing()) render(false);
  else updateLive(view, ctx.nowTs);
  const sheet = currentSheet();
  if (sheet) {
    updateLive(sheetRoot, ctx.nowTs);
    if (sheet.opts.tick) sheet.opts.tick(ctx.nowTs);
  }
  prompts(ctx);
}

// ---------- Actions ----------

function showFlash(text, ms = 8000) {
  flash = { text, until: now() + ms };
  render(false);
}

async function importText(text) {
  const result = await importWeightText(text);
  app.ui.showPaste = !result.ok;
  showFlash(result.ok ? result.message : `${result.message} Run the Fast Weight shortcut, then tap Import weight again.`, 12000);
  if (result.ok && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText('').catch(() => {});
  }
  return result;
}

async function importWeight() {
  // Read the clipboard first, straight from the tap (iOS shows its Paste bubble).
  let text = null;
  try {
    if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText();
  } catch {
    text = null;
  }
  if (route.name !== 'weight') app.go('weight');
  if (text == null) {
    app.ui.showPaste = true;
    showFlash('The clipboard could not be read. Long-press the paste box below and tap Paste.', 12000);
    return;
  }
  await importText(text);
}

async function backup() {
  const nowTs = now();
  const text = JSON.stringify(buildBackup(store.data(), { nowTs, version: VERSION }), null, 1);
  const result = await deliverFiles([{ name: backupFileName(nowTs, dayKey), text, type: 'application/json' }], 'Fast backup');
  if (result === 'cancelled') return;
  await store.setSettings({ lastBackupAt: nowTs });
  showFlash(result === 'shared' ? 'Backup handed to iOS. Keep it in Files or iCloud Drive.' : 'Backup file downloaded.');
}

async function exportCsv() {
  const ctx = context();
  const files = buildCsvFiles(store.data(), { nowTs: ctx.nowTs, todayKey: ctx.todayKey, startKey: ctx.startKey })
    .map((f) => ({ ...f, type: 'text/csv' }));
  const result = await deliverFiles(files, 'Fast CSV export');
  if (result !== 'cancelled') showFlash(result === 'shared' ? 'CSV files handed to iOS.' : 'CSV files downloaded.');
}

async function addCalendar() {
  const ctx = context();
  const s = ctx.settings;
  const fingerprint = icsTimes(s);
  const sequence = s.icsTimes && s.icsTimes !== fingerprint ? (s.icsSequence || 0) + 1 : s.icsSequence || 0;
  const text = buildIcs(s, { nowTs: ctx.nowTs, todayKey: ctx.todayKey, sequence });
  const result = await deliverFiles([{ name: 'fast-reminders.ics', text, type: 'text/calendar' }], 'Fast reminders');
  if (result === 'cancelled') return;
  await store.setSettings({ icsTimes: fingerprint, icsSequence: sequence });
  showFlash(result === 'shared' ? 'Calendar file handed to iOS.' : 'Calendar file downloaded.');
}

async function restoreFrom(file) {
  let backupObj;
  try {
    backupObj = parseBackup(await file.text());
  } catch (err) {
    showFlash(err.message || 'That file could not be read.');
    return;
  }
  const info = describeBackup(backupObj);
  const when = info.exportedAt ? fmtDayLong(dayKey(Date.parse(info.exportedAt))) : 'an unknown date';
  openSheet((api) => h('div', {},
    sheetHead(api, 'Restore'),
    h('p', { class: 'statement' }, 'Replace everything on this iPhone with this backup?'),
    h('p', { class: 'gap' }, `Backup from ${when}: ${info.windows} windows, ${info.meals} meals, ${info.weighIns} weigh-ins and ${info.temptations} temptations.`),
    info.skipped ? h('p', { class: 'small quiet gap-s' }, `${info.skipped} damaged ${info.skipped === 1 ? 'entry' : 'entries'} will be left out.`) : null,
    h('div', { class: 'stack gap-l' },
      button('Replace my data', async () => {
        await store.restore(backupObj);
        await api.close();
        showFlash('Backup restored.');
      }, { block: true, name: 'confirm-restore' }),
      button('Cancel', () => api.close(), { kind: 'secondary', name: 'cancel-restore' }))),
  { name: 'restore', label: 'Restore' });
}

export const app = {
  ui: { showPaste: false, showTable: false },
  ctx: context,
  go(path) {
    const target = `#${path}`;
    if (location.hash === target) {
      route = parseRoute(target);
      render(true);
    } else {
      location.hash = target;
    }
  },
  refresh: () => render(false),
  flash: showFlash,
  async tempted() {
    const id = await startTemptation(app);
    prompted.add(`t${id}`); // "Not sure yet" closes it until the next launch
  },
  importWeight,
  importText,
  backup,
  exportCsv,
  addCalendar,
  restoreFrom,
};

// ---------- Service worker ----------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    // A new version took over. Reload once nothing is open, so no input is lost.
    const tryReload = () => {
      if (reloading) return;
      if (isSheetOpen() || editing()) {
        setTimeout(tryReload, 2000);
        return;
      }
      reloading = true;
      location.reload();
    };
    tryReload();
  });
}

// ---------- Boot ----------

function fatal(err) {
  view.removeAttribute('aria-busy');
  view.replaceChildren(h('div', {},
    h('div', { class: 'label' }, 'Fast'),
    h('h1', { class: 'display gap-s' }, 'Storage is not available'),
    h('p', { class: 'gap' }, 'Fast keeps everything on this device and could not open its storage. Private Browsing blocks it. Open Fast from the Home Screen or in a normal Safari tab.'),
    h('p', { class: 'quiet small gap' }, String(err && err.message ? err.message : err))));
}

async function boot() {
  try {
    await store.load();
  } catch (err) {
    fatal(err);
    return;
  }
  if (!store.state.settings.installedAt) await store.setSettings({ installedAt: now() });
  requestPersistence().then((p) => {
    if (p !== store.state.settings.persisted) store.setSettings({ persisted: p });
  });

  store.subscribe(scheduleRender);
  window.addEventListener('hashchange', () => {
    route = parseRoute(location.hash);
    render(true);
  });
  tabbar.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) app.go(b.dataset.tab);
  });
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    for (const key of [...prompted]) if (key.startsWith('f')) prompted.delete(key);
    try {
      await store.load();
    } catch {
      /* keep what is in memory */
    }
    render(false);
    prompts(context());
  });

  render(true);

  if (window.__fastPayload) {
    const payload = window.__fastPayload;
    window.__fastPayload = null;
    route = { name: 'weight' };
    history.replaceState(null, '', `${location.pathname}#weight`);
    await importText(payload);
  }

  prompts(context());
  setInterval(tick, 1000);
  registerServiceWorker();
}

boot();
