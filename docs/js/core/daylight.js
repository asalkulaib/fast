// The light of the day for the scenery: sunrise, noon and sunset worked out
// on the phone (no network), then six phases the art is coloured by. Pure.
//
// The sun's position uses NOAA's short formulas (equation of time and
// declination from the day of the year). At home the place is Kuwait City;
// away, the place the time zone is named for (zone-places.js), so a summer
// evening in London stays light until its own sunset. A zone not in that
// list falls back to Kuwait's latitude and the middle of the zone's
// standard time.

import { HOME_ZONE, dayKey, minutesOfDay, offsetAt, zoneAt } from './time.js';
import { placeOf } from './zone-places.js';

export const DAY_PHASES = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'];

const HOME_LAT = 29.37; // Kuwait City
const HOME_LON = 47.98;
const RAD = Math.PI / 180;

/** Day of the year, 1 to 366, for 'YYYY-MM-DD'. */
function dayOfYear(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

/**
 * Sunrise, solar noon and sunset on a day, in minutes after local midnight,
 * for a place offsetMin minutes ahead of UTC at longitude lon (degrees east)
 * and latitude lat (degrees north). In a polar summer or winter, sunrise and
 * sunset meet at noon or spread to the whole day.
 */
export function sunTimes(key, offsetMin, lon = offsetMin / 4, lat = HOME_LAT) {
  const g = (2 * Math.PI / 365) * (dayOfYear(key) - 1);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosHa = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  const ha = Math.acos(Math.max(-1, Math.min(1, cosHa))) / RAD;
  const noon = 720 - 4 * lon - eot + offsetMin;
  return { sunrise: noon - 4 * ha, noon, sunset: noon + 4 * ha };
}

/**
 * The phase of the day at a moment, where the clock says it is:
 * dawn from half an hour before sunrise, morning, midday two hours either side
 * of noon, a golden afternoon, dusk from 40 minutes before sunset, then night.
 */
export function dayPhase(ts) {
  const zone = zoneAt(ts);
  const offset = offsetAt(zone, ts);
  const key = dayKey(ts);
  let lat = HOME_LAT;
  let lon = HOME_LON;
  if (zone !== HOME_ZONE) {
    const place = placeOf(zone);
    if (place) [lat, lon] = place;
    else {
      // Summer time moves the clock, not the sun: the zone's standard offset gives its middle.
      const year = Number(key.slice(0, 4));
      lon = Math.min(offsetAt(zone, Date.UTC(year, 0, 1)), offsetAt(zone, Date.UTC(year, 6, 1))) / 4;
    }
  }
  const { sunrise, noon, sunset } = sunTimes(key, offset, lon, lat);
  const t = minutesOfDay(ts);
  if (t < sunrise - 30 || t >= sunset + 30) return 'night';
  if (t < sunrise + 40) return 'dawn';
  if (t < noon - 120) return 'morning';
  if (t < noon + 120) return 'midday';
  if (t < sunset - 40) return 'afternoon';
  return 'dusk';
}
