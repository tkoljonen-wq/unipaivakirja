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

// Kahden kellonajan erotus minuutteina (yli keskiyön)
const diffMin = (from, to) => { const a = toMin(from), b = toMin(to); return a == null || b == null ? null : (b - a + 1440) % 1440; };

// Nukahtamisviive: uusissa kirjauksissa nukahtamisaika − vuoteeseenmeno, vanhoissa suoraan minuutteina
export const latencyOf = m => m.sleepOnset ? diffMin(m.bedTime, m.sleepOnset) : num(m.latency);

// Aamun valve: viimeisestä heräämisestä vuoteesta nousuun (yli 12 h tulkitaan syöttövirheeksi)
export const morningAwakeOf = m => { const v = diffMin(m.wakeTime, m.outOfBed); return v != null && v <= 720 ? v : null; };

// Yön valve (heräämisten aikana). Vanhoissa kirjauksissa wakeAwake sisälsi myös aamun valveen.
const isNew = m => m.nightAwake !== undefined || m.sleepOnset !== undefined;
export const nightAwakeOf = m => num(m.nightAwake);

// Valveaika yhteensä nukahtamisen jälkeen = yön valve + aamun valve
export const awakeOf = m => isNew(m) ? (num(m.nightAwake) || 0) + (morningAwakeOf(m) || 0) : num(m.wakeAwake);

// Uniaika = vuoteessaoloaika − nukahtamisviive − yön valve − aamun valve
export function calcSleep(m) {
  const bed = inBedOf(m);
  if (bed == null) return null;
  return Math.max(0, bed - (latencyOf(m) || 0) - (awakeOf(m) || 0));
}

// Laskun erittely ja varoitukset epäuskottavista luvuista
export function sleepCheck(m) {
  const bed = inBedOf(m), lat = latencyOf(m), night = isNew(m) ? num(m.nightAwake) : null, morn = isNew(m) ? morningAwakeOf(m) : null;
  const warn = [];
  if (m.sleepOnset && lat != null && bed != null && lat > bed) warn.push('Nukahtamisaika on vuoteestanousun jälkeen tai ennen vuoteeseenmenoa – tarkista ajat.');
  else if (lat != null && lat > 360) warn.push(`Nukahtamisviive on ${fmtDur(lat)} – onko nukahtamisaika oikein?`);
  const wk = diffMin(m.wakeTime, m.outOfBed);
  if (wk != null && wk > 720) warn.push('Heräämisaika on vuoteestanousun jälkeen – tarkista ajat.');
  const aw = num(m.awakenings);
  if (aw >= 2 && night != null && night < aw * 5) warn.push(`Heräsit ${aw} kertaa, mutta yön valveaikaa on vain ${fmtDur(night)}. Laske mukaan kaikki hereillä olo heräämisten aikana.`);
  if (aw === 0 && night > 0) warn.push('Valveaikaa on kirjattu, vaikka heräämiskertoja on 0.');
  if (bed != null && (lat || 0) + (awakeOf(m) || 0) > bed) warn.push('Valveajat ovat yhteensä pidemmät kuin vuoteessaoloaika – tarkista luvut.');
  return { bed, lat, night, morn, legacyAwake: isNew(m) ? null : num(m.wakeAwake), sleep: calcSleep(m), warn };
}
export const sleepOf = m => num(m.sleep) ?? calcSleep(m);

// Unen tehokkuus % = uniaika / vuoteessaoloaika
export const efficiencyOf = m => { const s = sleepOf(m), b = inBedOf(m); return s != null && b ? Math.round(100 * s / b) : null; };

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const avg = arr => { const v = arr.filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
