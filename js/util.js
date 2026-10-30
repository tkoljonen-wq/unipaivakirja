// Päivämäärät, ajat ja unipäiväkirjan laskennat

export const pad = n => String(n).padStart(2, '0');

export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDate(new Date());
export const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };

const WEEKDAYS = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const WEEKDAYS_LONG = ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'];
export const weekdayShort = s => WEEKDAYS[parseDate(s).getDay()];
export const fmtDate = s => { const d = parseDate(s); return `${d.getDate()}.${d.getMonth() + 1}.`; };
export const fmtDateLong = s => {
  const d = parseDate(s), wd = WEEKDAYS_LONG[d.getDay()];
  return `${wd[0].toUpperCase()}${wd.slice(1)} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};
export const fmtTime = iso => { const d = new Date(iso); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; };
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// Maanantai, jolta viikko alkaa
export const weekStart = s => { const d = parseDate(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return isoDate(d); };

// Illan kirjaus kuuluu edelliselle päivälle, jos se tehdään yöllä ennen klo 4
export const eveningDefaultDate = () => { const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1); return isoDate(d); };

// Tapahtuman (kahvi, tee, Neurosonic) päivä paikallisessa ajassa
export const eventDate = ev => isoDate(new Date(ev.at));

// "HH:MM" → minuutit vuorokauden alusta
export const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// Kesto minuutteina → "7 h 25 min"
export const fmtDur = min => {
  if (min == null || min === '' || isNaN(min)) return '–';
  min = Math.round(min);
  const h = Math.floor(Math.abs(min) / 60), m = Math.abs(min) % 60, sign = min < 0 ? '−' : '';
  if (!h) return `${sign}${m} min`;
  return m ? `${sign}${h} h ${m} min` : `${sign}${h} h`;
};
export const fmtClock = t => t ? t.replace(':', '.') : '–';

const num = v => (v === '' || v == null || isNaN(v)) ? null : Number(v);

// Vuoteessaoloaika: vuoteeseenmenosta viimeiseen vuoteesta nousuun (yli keskiyön)
export function calcInBed(m) {
  const a = toMin(m.bedTime), b = toMin(m.outOfBed);
  if (a == null || b == null) return null;
  return (b - a + 1440) % 1440;
}
export const inBedOf = m => num(m.inBed) ?? calcInBed(m);

// Uniaika = vuoteessaoloaika − nukahtamisviive − valveaika
export function calcSleep(m) {
  const bed = inBedOf(m);
  if (bed == null) return null;
  return Math.max(0, bed - (num(m.latency) || 0) - (num(m.wakeAwake) || 0));
}
export const sleepOf = m => num(m.sleep) ?? calcSleep(m);

// Unen tehokkuus % = uniaika / vuoteessaoloaika
export const efficiencyOf = m => { const s = sleepOf(m), b = inBedOf(m); return s != null && b ? Math.round(100 * s / b) : null; };

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const avg = arr => { const v = arr.filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
