// In-memory copy of the data plus every change the screens can make.
// Each change is written to IndexedDB first, then applied here and announced.

import * as db from './db.js';
import { now, dayKey, floorToMinute, fmtDayLong, fmtTime, MIN } from './core/time.js';

export const DEFAULTS = {
  workdayStart: '17:30',
  weekendStart: '14:00',
  holdTime: '13:00',
  trainingTime: '16:30',
  installedAt: null,
  lastBackupAt: null,
  lastImportAt: null,
  icsSequence: 0,
  icsTimes: null,
  persisted: null,
};

export const FULLNESS_DELAY = 20 * MIN;

export const state = {
  ready: false,
  days: new Map(),
  meals: new Map(),
  outside: new Map(),
  temptations: new Map(),
  weights: new Map(),
  settings: { ...DEFAULTS },
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  for (const fn of listeners) fn();
}

export async function load() {
  const all = await db.readAll();
  state.days = new Map(all.days.map((r) => [r.day, r]));
  state.meals = new Map(all.meals.map((m) => [m.id, m]));
  state.outside = new Map(all.outside.map((o) => [o.id, o]));
  state.temptations = new Map(all.temptations.map((t) => [t.id, t]));
  state.weights = new Map(all.weights.map((w) => [w.date, w.kg]));
  state.settings = { ...DEFAULTS, ...Object.fromEntries(all.settings.map((s) => [s.key, s.value])) };
  state.ready = true;
}

/** Plain snapshot for the pure functions in core/. */
export function data() {
  return {
    days: state.days,
    meals: [...state.meals.values()],
    outside: [...state.outside.values()],
    temptations: [...state.temptations.values()],
    weights: state.weights,
    settings: state.settings,
  };
}

const stamp = (ts) => floorToMinute(ts == null ? now() : ts);

// ---------- Settings ----------

export async function setSettings(values) {
  await db.putMany('settings', Object.entries(values).map(([key, value]) => ({ key, value })));
  Object.assign(state.settings, values);
  changed();
}

// ---------- Days and windows ----------

export async function updateDay(key, patch) {
  const rec = { ...(state.days.get(key) || { day: key }), ...patch, day: key, updatedAt: now() };
  await db.put('days', rec);
  state.days.set(key, rec);
  changed();
  return rec;
}

/**
 * First bite: opens the window on the day of the bite. A day that already
 * has a window keeps it: a first bite never overwrites logged times.
 */
export function openWindow(ts) {
  const t = stamp(ts);
  const existing = state.days.get(dayKey(t));
  if (existing && existing.firstBite) return Promise.resolve(existing);
  return updateDay(dayKey(t), { firstBite: t, lastBite: null, noEating: false });
}

/**
 * Removes a window opened by mistake, together with the meals logged in it,
 * as if First bite had never been tapped. One transaction.
 */
export async function cancelWindow(key) {
  const old = state.days.get(key);
  if (!old) return;
  const meals = [...state.meals.values()].filter((m) => m.day === key);
  const rec = { ...old, firstBite: null, lastBite: null, updatedAt: now() };
  await db.batch([{ store: 'days', put: rec }, ...meals.map((m) => ({ store: 'meals', remove: m.id }))]);
  state.days.set(key, rec);
  for (const m of meals) state.meals.delete(m.id);
  changed();
}

export const undoOpen = cancelWindow;

/**
 * Changes a window's first bite and last bite (null while it is open), in
 * one transaction. The window follows its first bite to that bite's day, and
 * the first meal (the one that started at the old first bite) moves with it.
 * Meals still open end at a new last bite. Refuses times that would leave
 * another meal outside the window, or that would overwrite another day's
 * record. Resolves with { key } or { error }.
 */
export async function adjustWindow(oldKey, firstTs, lastTs) {
  const old = state.days.get(oldKey);
  if (!old || !old.firstBite) return { error: 'This window no longer exists.' };
  const first = stamp(firstTs);
  const last = lastTs == null ? null : stamp(lastTs);
  if (last != null && last < first) return { error: 'The last bite comes before the first bite.' };
  const newKey = dayKey(first);
  const target = state.days.get(newKey);
  if (newKey !== oldKey && target && (target.firstBite || target.noEating)) {
    return { error: `${fmtDayLong(newKey)} already has a record. Change it from the Week screen.` };
  }
  const delta = first - old.firstBite;
  const shift = (t) => (t == null ? t : t + delta);
  const meals = [...state.meals.values()].filter((m) => m.day === oldKey).map((m) => {
    const moved = m.startedAt === old.firstBite
      ? { ...m, day: newKey, startedAt: first, finishedAt: shift(m.finishedAt), fullness20DueAt: shift(m.fullness20DueAt) }
      : { ...m, day: newKey };
    if (last != null) {
      if (!moved.finishedAt) moved.finishedAt = Math.max(last, moved.startedAt);
      else if (moved.finishedAt > last && moved.startedAt <= last) moved.finishedAt = last;
    }
    return moved;
  });
  const early = meals.find((m) => m.startedAt < first);
  if (early) return { error: `A meal is logged at ${fmtTime(early.startedAt)}, before that time. Change or delete it first.` };
  const late = last == null ? null : meals.find((m) => m.startedAt > last);
  if (late) return { error: `A meal is logged at ${fmtTime(late.startedAt)}, after that time. Change or delete it first.` };

  const at = now();
  const base = newKey === oldKey ? old : target || { day: newKey };
  const rec = { ...base, day: newKey, firstBite: first, lastBite: last, noEating: false, updatedAt: at };
  const ops = [{ store: 'days', put: rec }];
  const emptied = newKey === oldKey ? null : { ...old, firstBite: null, lastBite: null, updatedAt: at };
  if (emptied) ops.push({ store: 'days', put: emptied });
  for (const m of meals) ops.push({ store: 'meals', put: m });
  await db.batch(ops);
  state.days.set(newKey, rec);
  if (emptied) state.days.set(oldKey, emptied);
  for (const m of meals) state.meals.set(m.id, m);
  changed();
  return { key: newKey };
}

/** Moves the first bite of a window (the first-bite sheet), keeping a valid last bite. */
export function moveFirstBite(oldKey, ts) {
  const old = state.days.get(oldKey);
  const t = stamp(ts);
  return adjustWindow(oldKey, t, old && old.lastBite && old.lastBite >= t ? old.lastBite : null);
}

/** Meals still open when a window closes end at its last bite (no 20-minute check). */
async function finishOpenMeals(key, lastBite) {
  for (const m of [...state.meals.values()]) {
    if (m.day === key && !m.finishedAt) await updateMeal(m.id, { finishedAt: Math.max(lastBite, m.startedAt) });
  }
}

export async function closeWindow(key, ts) {
  const rec = await updateDay(key, { lastBite: stamp(ts) });
  await finishOpenMeals(key, rec.lastBite);
  return rec;
}

export function reopenWindow(key) {
  return updateDay(key, { lastBite: null });
}

export async function setWindowTimes(key, firstBite, lastBite) {
  const rec = await updateDay(key, { firstBite, lastBite, noEating: false });
  if (lastBite) await finishOpenMeals(key, lastBite);
  return rec;
}

export function clearWindow(key) {
  return updateDay(key, { firstBite: null, lastBite: null });
}

export function setNoEating(key, value) {
  return updateDay(key, value ? { noEating: true, firstBite: null, lastBite: null } : { noEating: false });
}

// ---------- Meals ----------

async function saveRecord(store, map, rec) {
  const id = await db.put(store, rec);
  const saved = { ...rec, id };
  map.set(id, saved);
  changed();
  return saved;
}

export function startMeal({ day, name, startedAt, hungerBefore }) {
  return saveRecord('meals', state.meals, {
    day,
    name: name || '',
    startedAt: stamp(startedAt),
    finishedAt: null,
    hungerBefore: hungerBefore ?? null,
    stop: null,
    fullnessNow: null,
    fullness20DueAt: null,
    fullness20: null,
    fullness20Skipped: false,
  });
}

/**
 * When to ask for fullness 20 minutes after a meal. A meal logged long
 * after the fact gets no prompt (its 20-minute moment is past); its
 * fullness at 20 minutes can still be entered by editing the meal.
 */
export function fullnessDueAt(finishedAt) {
  const due = finishedAt + FULLNESS_DELAY;
  return now() - due > 15 * MIN ? null : due;
}

export function finishMeal(id, { finishedAt, stop, fullnessNow }) {
  const t = stamp(finishedAt);
  return updateMeal(id, { finishedAt: t, stop: stop ?? null, fullnessNow: fullnessNow ?? null, fullness20DueAt: fullnessDueAt(t) });
}

// Updates to a record that no longer exists are ignored, so a sheet left
// open after a delete can never write a half-empty record back.
export async function updateMeal(id, patch) {
  const cur = state.meals.get(id);
  if (!cur) return null;
  const rec = { ...cur, ...patch };
  await db.put('meals', rec);
  state.meals.set(id, rec);
  changed();
  return rec;
}

export async function deleteMeal(id) {
  await db.remove('meals', id);
  state.meals.delete(id);
  changed();
}

// ---------- Eating outside the window ----------

export function addOutside({ day, at, trigger, amount, source }) {
  return saveRecord('outside', state.outside, { day, at: stamp(at), trigger: trigger || null, amount: amount || null, source: source || 'today' });
}

export async function updateOutside(id, patch) {
  const cur = state.outside.get(id);
  if (!cur) return null;
  const rec = { ...cur, ...patch };
  await db.put('outside', rec);
  state.outside.set(id, rec);
  changed();
  return rec;
}

export async function deleteOutside(id) {
  await db.remove('outside', id);
  state.outside.delete(id);
  changed();
}

// ---------- Temptations ----------

export function addTemptation(rec) {
  return saveRecord('temptations', state.temptations, rec);
}

export async function updateTemptation(id, patch) {
  const cur = state.temptations.get(id);
  if (!cur) return null;
  const rec = { ...cur, ...patch };
  await db.put('temptations', rec);
  state.temptations.set(id, rec);
  changed();
  return rec;
}

export async function deleteTemptation(id) {
  await db.remove('temptations', id);
  state.temptations.delete(id);
  changed();
}

// ---------- Weight ----------

/** Saves imported entries (a re-imported date replaces its old value). */
export async function saveWeights(entries) {
  const at = now();
  await db.putMany('weights', [...entries].map(([date, kg]) => ({ date, kg, importedAt: at })));
  for (const [date, kg] of entries) state.weights.set(date, kg);
  await setSettings({ lastImportAt: at });
}

// ---------- Restore ----------

export async function restore(backup) {
  const d = backup.data;
  const keep = { installedAt: state.settings.installedAt, persisted: state.settings.persisted };
  const settings = d.settings.filter((s) => !(s.key in keep));
  await db.replaceAll({ ...d, settings: [...settings, ...Object.entries(keep).map(([key, value]) => ({ key, value }))] });
  await load();
  changed();
}
