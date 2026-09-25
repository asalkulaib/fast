// Weekly review: one screen, weeks run Sunday to Saturday.

import { h, hl } from './dom.js';
import { button } from './components.js';
import { addDays, fmtDayShort, fmtDuration, fmtTime, fmtWeekRange, weekStart, weekdayShort, keyParts } from '../core/time.js';
import { weekReview } from '../core/review.js';
import { header, note } from './shared.js';

const TRIGGER_WORD = { hunger: 'hunger', boredom: 'boredom', social: 'social', stress: 'stress', tired: 'tired', other: 'other' };
const TYPE_WORD = { weights: 'weights', cardio: 'cardio', other: 'other', unspecified: 'type not set' };

const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
const one = (v) => v.toFixed(1);
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;

function stat(label, value, testid) {
  return h('div', { class: 'stat', 'data-stat': testid || null },
    h('span', {}, label),
    h('span', { class: 'stat-value' }, value));
}

function energyLine(label, part) {
  return stat(label, part.n ? `${one(part.avg)} (${days(part.n)})` : 'no data yet');
}

function dayResult(d) {
  if (d.future) return { text: '', ok: false };
  switch (d.result) {
    case 'success': return { text: d.state === 'noEating' ? 'No eating' : 'Success', ok: true };
    case 'miss': return { text: 'Miss', ok: false };
    case 'pending': return { text: d.state === 'open' ? 'Open' : 'Today', ok: false };
    case 'unlogged': return { text: 'Not logged', ok: false };
    default: return { text: '', ok: false };
  }
}

export function renderWeek(ctx, app, weekKey) {
  const start = weekStart(weekKey || ctx.todayKey);
  const thisWeek = weekStart(ctx.todayKey);
  const r = weekReview(ctx, { weekStartKey: start, todayKey: ctx.todayKey, nowTs: ctx.nowTs, startKey: ctx.startKey });
  const isCurrent = start === thisWeek;

  const weightBlock = r.weight.current.avg != null
    ? [
      stat('7-day average', `${one(r.weight.current.avg)} kg`, 'weight-avg'),
      stat('Change from last week', r.weight.change != null ? `${signed(r.weight.change)} kg` : 'needs last week', 'weight-change'),
    ]
    : [h('p', { class: 'quiet small' }, r.weight.current.n
      ? 'Fewer than 3 weigh-ins this week, so no average yet.'
      : 'No weigh-ins imported for this week.')];

  const s = r.satiety;
  const t = r.temptations;
  return h('div', { class: 'week', 'data-week': start },
    header(ctx, app, { title: 'Week', sub: isCurrent ? 'This week' : null }),
    h('section', { class: 'section strong' },
      h('h1', { class: 'display', 'data-testid': 'week-range' }, fmtWeekRange(start)),
      h('div', { class: 'btn-row gap-s' },
        button('‹ Previous', () => app.go(`week/${addDays(start, -7)}`), { kind: 'secondary', name: 'prev-week' }),
        isCurrent ? null : button('Next ›', () => app.go(`week/${addDays(start, 7)}`), { kind: 'secondary', name: 'next-week' }))),
    h('section', { class: 'section' },
      h('div', { class: 'row' },
        h('div', { class: 'main' },
          h('div', { class: 'label' }, 'Successful days'),
          h('div', { class: 'figure gap-s', 'data-testid': 'success-count' }, hl(String(r.successCount)), ' of 7')),
        h('div', { class: 'margin' }, note('Best streak', days(r.streak.best)))),
      h('div', { class: 'gap' },
        stat('Average window', r.avgWindowMs != null ? fmtDuration(r.avgWindowMs) : 'no windows yet', 'avg-window'),
        stat(isCurrent ? 'Streak' : 'Streak at week end', days(r.streak.current), 'streak'))),
    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Workdays'),
      h('div', { class: 'gap-s' },
        stat('Opened at 16:00 or later', r.workday.windows ? `${r.workday.onTime} of ${r.workday.windows}` : 'no workday windows', 'on-time')),
      h('p', { class: 'small gap' }, 'Energy at 4 PM'),
      energyLine('Nothing eaten before 4 PM', r.energy.week.without),
      energyLine('Ate before 4 PM', r.energy.week.with),
      r.energy.all.without.n || r.energy.all.with.n
        ? h('p', { class: 'quiet small gap-s', 'data-testid': 'energy-all' },
          `All time: ${r.energy.all.without.n ? one(r.energy.all.without.avg) : 'no data'} without eating before 4 PM (${days(r.energy.all.without.n)}), `
          + `${r.energy.all.with.n ? one(r.energy.all.with.avg) : 'no data'} with (${days(r.energy.all.with.n)}).`)
        : null),
    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Weight'),
      h('div', { class: 'gap-s' }, weightBlock)),
    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Training'),
      h('div', { class: 'gap-s' },
        stat('Sessions', String(r.training.sessions), 'training'),
        r.training.types.length
          ? h('p', { class: 'quiet small' }, r.training.types.map((x) => `${TYPE_WORD[x.key] || x.key} ${x.count}`).join(', '))
          : null)),
    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Satiety'),
      h('div', { class: 'gap-s' },
        stat('Stopped before full', s.rated ? `${s.beforeFull} of ${s.rated} (${Math.round(s.beforeFullShare * 100)}%)` : 'no meals rated', 'before-full'),
        stat('Rise from right after to 20 min', s.pairs ? `${signed(s.avgRise)} points` : 'no pairs yet', 'rise'),
        s.avgAt20 != null ? stat('Average at 20 min', `${one(s.avgAt20)} (target about 7)`, 'at20') : null)),
    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Temptations'),
      h('div', { class: 'gap-s' },
        stat('Count', String(t.count), 'temptations'),
        stat('Held', t.decided ? `${t.held} of ${t.decided} (${Math.round(t.holdRate * 100)}%)` : 'none yet', 'hold-rate'),
        t.triggers.length ? stat('Top triggers', t.triggers.slice(0, 3).map((x) => `${TRIGGER_WORD[x.key] || x.key} ${x.count}`).join(', '), 'triggers') : null)),
    h('section', { class: 'section' },
      h('div', { class: 'label' }, 'Days'),
      h('ul', { class: 'days gap-s' }, r.days.map((d) => {
        const res = dayResult(d);
        const { d: dd } = keyParts(d.day);
        const span = d.firstBite ? (d.lastBite ? `${fmtTime(d.firstBite)} to ${fmtTime(d.lastBite)}` : `from ${fmtTime(d.firstBite)}`) : '';
        return h('li', {},
          h('button', { type: 'button', class: 'dayrow', 'data-day': d.day, 'aria-label': `${fmtDayShort(d.day)} ${res.text}`, onclick: () => app.go(`day/${d.day}`) },
            h('span', { class: 'd' }, `${weekdayShort(d.day)} ${dd}`),
            h('span', { class: 'w' }, span),
            h('span', { class: `r${res.ok ? ' ok' : ''}` }, res.text)));
      }))),
  );
}
