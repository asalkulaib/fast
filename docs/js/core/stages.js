// Fasting stages, timed from the last bite. Pure data and functions.
//
// Hours are typical, not exact: they shift with the size of the last meal
// and with activity. Wording stays within what the sources below support.
//   Stages 1 and 2: Dimitriadis GD et al., Nutrients 2021 (postprandial and
//     postabsorptive glucose metabolism).
//   Stage 3: Anton SD et al., Obesity 2018 (the metabolic switch, usually
//     12 to 36 hours after the last meal).
//   Stage 4: Pan JW et al., J Cereb Blood Flow Metab 2000 (ketones keep
//     rising over days of fasting); Ho KY et al., J Clin Invest 1988
//     (a 24-hour fast raises growth hormone secretion several-fold).
//   Autophagy: Bagherniya M et al., Ageing Res Rev 2018; Bensalem J et al.,
//     J Physiol 2025. Human timing is unknown, so it has no place on the clock.

import { HOUR } from './time.js';

export const SCALE_HOURS = 24;

export const STAGES = [
  {
    key: 'digesting',
    name: 'Digesting',
    from: 0,
    to: 4,
    range: '0 to about 4 h',
    text: 'Your last meal is being absorbed. Blood sugar and insulin rise, then settle, while your body stores the energy.',
  },
  {
    key: 'settling',
    name: 'Blood sugar settles',
    from: 4,
    to: 12,
    range: 'about 4 to 12 h',
    text: 'Insulin is back at its low baseline. Your liver releases stored sugar to keep blood sugar steady, and your body draws more and more on fat.',
  },
  {
    key: 'switch',
    name: 'Metabolic switch',
    from: 12,
    to: 24,
    range: 'from about 12 h',
    text: 'As the liver\'s sugar store runs low, fat becomes the main fuel and ketones start to rise. It can come as late as 36 hours: sooner after training, later after a big meal.',
  },
  {
    key: 'ketones',
    name: 'Ketones climbing',
    from: 24,
    to: Infinity,
    range: '24 h and beyond',
    text: 'Fat supplies most of your energy and ketones keep rising over the following days. By a full day, growth hormone output is several times higher.',
  },
];

export const AUTOPHAGY_NOTE = 'Autophagy is how cells clear out and recycle worn parts. Fasting switches it on in cell and animal studies, and early human studies point the same way, but when it starts in people is not known. So Fast does not place it on the clock.';

export const VARIATION_NOTE = 'The hours are typical, not exact. They shift with the size of your last meal and how active you are.';

export const SOURCES = [
  'Dimitriadis GD et al. Regulation of postabsorptive and postprandial glucose metabolism by insulin-dependent and insulin-independent mechanisms. Nutrients, 2021.',
  'Anton SD et al. Flipping the metabolic switch: understanding and applying the health benefits of fasting. Obesity, 2018.',
  'Pan JW et al. Human brain beta-hydroxybutyrate and lactate increase in fasting-induced ketosis. Journal of Cerebral Blood Flow and Metabolism, 2000.',
  'Ho KY et al. Fasting enhances growth hormone secretion and amplifies the complex rhythms of growth hormone secretion in man. Journal of Clinical Investigation, 1988.',
  'Bagherniya M et al. The effect of fasting or calorie restriction on autophagy induction: a review of the literature. Ageing Research Reviews, 2018.',
  'Bensalem J et al. Intermittent time-restricted eating may increase autophagic flux in humans: an exploratory analysis. Journal of Physiology, 2025.',
];

/** Index of the stage for a time since the last bite. */
export function stageIndex(elapsedMs) {
  const hours = Math.max(0, elapsedMs) / HOUR;
  return STAGES.findIndex((s) => hours >= s.from && hours < s.to);
}

/**
 * Where a fast stands: { elapsedMs, index, stage, next, untilNextMs, position }.
 * position is 0 to 1 along the 24-hour scale (1 past 24 hours).
 */
export function fastingState(lastBiteTs, nowTs) {
  const elapsedMs = Math.max(0, nowTs - lastBiteTs);
  const index = stageIndex(elapsedMs);
  const next = STAGES[index + 1] || null;
  return {
    elapsedMs,
    index,
    stage: STAGES[index],
    next,
    untilNextMs: next ? next.from * HOUR - elapsedMs : null,
    position: Math.min(1, elapsedMs / (SCALE_HOURS * HOUR)),
  };
}
