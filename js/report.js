// Raportit: tunnusluvut, kuvaajat, vertailut, viikkotaulukko (PDF:n mallin mukaan) ja vienti
import { MEDS } from './questions.js';
import {
  today, addDays, fmtDate, weekdayShort, weekStart, fmtDur, fmtClock, fmtTime, eventDate,
  inBedOf, sleepOf, efficiencyOf, avg, esc, pad,
} from './util.js';

const RANGES = [[7, '7 pv'], [14, '14 pv'], [30, '30 pv'], [90, '90 pv']];

// Aamun kirjaus päivälle D koskee yötä D-1 → D, joten päivän D-1 kahvit ja Neurosonic vaikuttavat siihen
function collect(S, days) {
  const end = today();
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const m = S.days[date]?.morning || {}, e = S.days[date]?.evening || {};
    const evs = S.events.filter(x => eventDate(x) === date);
    const prev = S.events.filter(x => eventDate(x) === addDays(date, -1));
    const coffees = evs.filter(x => x.type === 'kahvi');
    rows.push({
      date, m, e, evs,
      sleep: sleepOf(m), inBed: inBedOf(m), eff: efficiencyOf(m),
      latency: m.latency ?? null, awakenings: m.awakenings ?? null,
      quality: m.quality ?? null, alertness: e.alertness ?? null,
      coffee: coffees.length, tea: evs.filter(x => x.type === 'tee').length,
      neuro: evs.filter(x => x.type === 'neurosonic'),
      lastCoffee: coffees.length ? coffees[coffees.length - 1].at : null,
      prevLateCoffee: prev.some(x => x.type === 'kahvi' && new Date(x.at).getHours() >= 14),
      prevNeuro: prev.some(x => x.type === 'neurosonic') || evs.some(x => x.type === 'neurosonic' && new Date(x.at).getHours() < 6),
      hasMorning: Object.keys(m).length > 0,
    });
  }
  return rows;
}

export function renderReports(S) {
  S.reportRange ??= 14;
  S.reportWeek ??= weekStart(today());
  const rows = collect(S, S.reportRange);
  const withM = rows.filter(r => r.hasMorning);
  const n = withM.length;
  const lastCoffeeMins = rows.filter(r => r.lastCoffee).map(r => { const d = new Date(r.lastCoffee); return d.getHours() * 60 + d.getMinutes(); });
  const lc = avg(lastCoffeeMins);
  const medCount = k => withM.filter(r => r.m[k]?.taken).length;
  const neuroAll = rows.flatMap(r => r.neuro);
  const fmt1 = v => v == null ? '–' : v.toFixed(1).replace('.', ',');

  const tiles = [
    ['Uniaika', fmtDur(avg(rows.map(r => r.sleep))), 'keskimäärin'],
    ['Vuoteessa', fmtDur(avg(rows.map(r => r.inBed))), 'keskimäärin'],
    ['Unen tehokkuus', avg(rows.map(r => r.eff)) == null ? '–' : Math.round(avg(rows.map(r => r.eff))) + ' %', 'uni / vuoteessa'],
    ['Nukahtaminen', fmtDur(avg(rows.map(r => r.latency))), 'keskimäärin'],
    ['Heräämiset', fmt1(avg(rows.map(r => r.awakenings))), 'kertaa / yö'],
    ['Unen laatu', fmt1(avg(rows.map(r => r.quality))), '1–5'],
    ['Vireys', fmt1(avg(rows.map(r => r.alertness))), '1–5'],
    ['Kahvit', fmt1(rows.reduce((a, r) => a + r.coffee, 0) / rows.length), 'kuppia / pv'],
    ['Teet', fmt1(rows.reduce((a, r) => a + r.tea, 0) / rows.length), 'kuppia / pv'],
    ['Viimeinen kahvi', lc == null ? '–' : `${pad(Math.floor(lc / 60))}.${pad(Math.round(lc % 60))}`, 'keskimäärin klo'],
    ...MEDS.map(x => [x.short, `${medCount(x.key)} / ${n}`, 'yötä']),
    ['Neurosonic', `${neuroAll.length}×`, `yht. ${fmtDur(neuroAll.reduce((a, x) => a + (x.minutes || 0), 0))}`],
  ];

  return `
    <h1 class="page-title">Raportit</h1>
    <div class="chips seg">${RANGES.map(([d, l]) => `<button class="chip ${S.reportRange === d ? 'on' : ''}" data-range="${d}">${l}</button>`).join('')}</div>
    <p class="muted small">${fmtDate(rows[0].date)}–${fmtDate(rows[rows.length - 1].date)} · aamukirjauksia ${n} / ${rows.length}</p>
    <section class="tiles">${tiles.map(([l, v, s]) => `<div class="tile"><span class="t-label">${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('')}</section>

    <section class="card"><h2>Uniaika ja vuoteessaoloaika</h2>
      ${sleepChart(rows)}
      <p class="legend"><span class="lg bed"></span>Vuoteessa <span class="lg sleep"></span>Uni</p></section>

    <section class="card"><h2>Unen laatu ja vireys</h2>
      ${lineChart(rows)}
      <p class="legend"><span class="lg q"></span>Unen laatu <span class="lg a"></span>Vireys</p></section>

    <section class="card"><h2>Kahvit, teet ja Neurosonic</h2>
      ${drinkChart(rows)}
      <p class="legend"><span class="lg coffee"></span>Kahvi <span class="lg tea"></span>Tee <span class="lg neuro"></span>Neurosonic</p></section>

    <section class="card"><h2>Vertailu</h2>
      <p class="muted small">Unen laatu ja uniaika öinä, joita edelsi… (vähintään 2 yötä kummassakin ryhmässä)</p>
      ${compareTable(withM)}</section>

    ${weekTable(S)}`;
}

export function bindReports(root, S, rerender, openDay) {
  root.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { S.reportRange = Number(b.dataset.range); rerender(); }));
  root.querySelectorAll('[data-week]').forEach(b => b.addEventListener('click', () => { S.reportWeek = addDays(S.reportWeek, Number(b.dataset.week) * 7); rerender(); }));
  root.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openDay(el.dataset.open)));
  root.querySelector('[data-print]')?.addEventListener('click', () => window.print());
}

// ---------------------------------------------------------------- kuvaajat (SVG)
const W = 340, H = 150, PL = 28, PR = 6, PT = 8, PB = 20;

function frame(rows, maxY, yTicks, yFmt) {
  const cw = (W - PL - PR) / rows.length;
  const y = v => PT + (H - PT - PB) * (1 - v / maxY);
  const grid = yTicks.map(t => `<line x1="${PL}" x2="${W - PR}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${PL - 4}" y="${y(t) + 3}" class="ax" text-anchor="end">${yFmt(t)}</text>`).join('');
  const step = Math.ceil(rows.length / 8);
  const xl = rows.map((r, i) => i % step === 0 || i === rows.length - 1
    ? `<text x="${PL + cw * i + cw / 2}" y="${H - 6}" class="ax" text-anchor="middle">${fmtDate(r.date)}</text>` : '').join('');
  // Napautusalueet: avaa päivän tiedot
  const hits = rows.map((r, i) => `<rect x="${PL + cw * i}" y="${PT}" width="${cw}" height="${H - PT - PB}" class="hit" data-open="${r.date}"><title>${weekdayShort(r.date)} ${fmtDate(r.date)}</title></rect>`).join('');
  return { cw, y, grid, xl, hits };
}

function sleepChart(rows) {
  const max = Math.max(9 * 60, ...rows.map(r => r.inBed || 0), ...rows.map(r => r.sleep || 0));
  const maxY = Math.ceil(max / 120) * 120;
  const ticks = []; for (let t = 0; t <= maxY; t += 120) ticks.push(t);
  const f = frame(rows, maxY, ticks, t => t / 60 + 'h');
  const bw = Math.max(2, f.cw * 0.7);
  const bars = rows.map((r, i) => {
    const x = PL + f.cw * i + (f.cw - bw) / 2;
    return (r.inBed != null ? `<rect x="${x}" y="${f.y(r.inBed)}" width="${bw}" height="${f.y(0) - f.y(r.inBed)}" class="bar bed" rx="2"/>` : '')
      + (r.sleep != null ? `<rect x="${x + bw * 0.15}" y="${f.y(r.sleep)}" width="${bw * 0.7}" height="${f.y(0) - f.y(r.sleep)}" class="bar sleep" rx="2"/>` : '');
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${f.grid}${bars}${f.xl}${f.hits}</svg>`;
}

function lineChart(rows) {
  const f = frame(rows, 5, [1, 2, 3, 4, 5], t => t);
  const pts = key => rows.map((r, i) => r[key] != null ? [PL + f.cw * i + f.cw / 2, f.y(r[key])] : null);
  const path = ps => {
    let d = '', pen = false;
    for (const p of ps) { if (!p) { pen = false; continue; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); pen = true; }
    return d;
  };
  const dots = (ps, cls) => ps.filter(Boolean).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" class="${cls}"/>`).join('');
  const q = pts('quality'), a = pts('alertness');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${f.grid}
    <path d="${path(q)}" class="line q"/><path d="${path(a)}" class="line a"/>${dots(q, 'dot q')}${dots(a, 'dot a')}${f.xl}${f.hits}</svg>`;
}

function drinkChart(rows) {
  const maxY = Math.max(4, ...rows.map(r => r.coffee + r.tea));
  const ticks = []; for (let t = 0; t <= maxY; t += maxY > 8 ? 2 : 1) ticks.push(t);
  const f = frame(rows, maxY, ticks, t => t);
  const bw = Math.max(2, f.cw * 0.6);
  const bars = rows.map((r, i) => {
    const x = PL + f.cw * i + (f.cw - bw) / 2;
    let s = '';
    if (r.coffee) s += `<rect x="${x}" y="${f.y(r.coffee)}" width="${bw}" height="${f.y(0) - f.y(r.coffee)}" class="bar coffee" rx="2"/>`;
    if (r.tea) s += `<rect x="${x}" y="${f.y(r.coffee + r.tea)}" width="${bw}" height="${f.y(r.coffee) - f.y(r.coffee + r.tea)}" class="bar tea" rx="2"/>`;
    if (r.neuro.length) s += `<circle cx="${x + bw / 2}" cy="${PT + 4}" r="3.5" class="dot neuro"/>`;
    return s;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${f.grid}${bars}${f.xl}${f.hits}</svg>`;
}

// ---------------------------------------------------------------- vertailu
function compareTable(rows) {
  const groups = [
    ['Kahvi klo 14 jälkeen (edellisenä päivänä)', r => r.prevLateCoffee],
    ['Neurosonic illalla / yöllä', r => r.prevNeuro],
    ...MEDS.map(x => [x.label, r => !!r.m[x.key]?.taken]),
    ['Nukuin Timpan kanssa', r => r.m.company === 'timppa', r => r.m.company === 'yksin'],
  ];
  const fmt1 = v => v == null ? '–' : v.toFixed(1).replace('.', ',');
  // Kolmas funktio rajaa Ei-ryhmän (muuten kaikki, joille ehto ei päde)
  const body = groups.map(([label, fn, noFn = r => !fn(r)]) => {
    const yes = rows.filter(fn), no = rows.filter(noFn);
    if (yes.length < 2 || no.length < 2) return `<tr><th>${esc(label)}</th><td colspan="2" class="muted">liian vähän tietoa (${yes.length} / ${no.length})</td></tr>`;
    const cell = g => `${fmt1(avg(g.map(r => r.quality)))} · ${fmtDur(avg(g.map(r => r.sleep)))}<br><small class="muted">${g.length} yötä</small>`;
    return `<tr><th>${esc(label)}</th><td>${cell(yes)}</td><td>${cell(no)}</td></tr>`;
  }).join('');
  return `<table class="compare"><thead><tr><th></th><th>Kyllä</th><th>Ei</th></tr></thead><tbody>${body}</tbody></table>
    <p class="muted small">Laatu (1–5) · uniaika. Vertailu kertoo vain samanaikaisuudesta, ei syy-yhteydestä.</p>`;
}

// ---------------------------------------------------------------- viikkotaulukko
function weekTable(S) {
  const start = S.reportWeek;
  const dates = [...Array(7)].map((_, i) => addDays(start, i));
  const M = d => S.days[d]?.morning || {}, E = d => S.days[d]?.evening || {};
  const evs = d => S.events.filter(x => eventDate(x) === d);
  const cnt = (d, t) => evs(d).filter(x => x.type === t).length || '';
  const rows = [
    ['Nukuin', d => ({ yksin: 'Yksin', timppa: 'Timppa' })[M(d).company] || ''],
    ['Vuoteeseenmenoaika', d => fmtClockOr(M(d).bedTime)],
    ['Nukahtamisviive', d => durOr(M(d).latency)],
    ['Heräämiskerrat', d => M(d).awakenings ?? ''],
    ['Heräämisaika', d => fmtClockOr(M(d).wakeTime)],
    ['Valveaika', d => durOr(M(d).wakeAwake)],
    ['Vuoteestanousuaika', d => fmtClockOr(M(d).outOfBed)],
    ['Vuoteessaoloaika', d => durOr(inBedOf(M(d)))],
    ['Uniaika', d => durOr(sleepOf(M(d)))],
    ['Yöunen laatu 1–5', d => M(d).quality ?? ''],
    ['Päivän vireys 1–5', d => E(d).alertness ?? ''],
    ...MEDS.map(x => [x.short, d => M(d)[x.key]?.taken ? '✓' : (M(d)[x.key]?.taken === false ? '–' : '')]),
    ['Kahvit', d => cnt(d, 'kahvi')],
    ['Teet', d => cnt(d, 'tee')],
    ['Neurosonic', d => evs(d).filter(x => x.type === 'neurosonic').map(x => `${x.program?.slice(0, 4) || ''} ${x.minutes || ''}`).join(', ')],
  ];
  const notes = dates.flatMap(d => {
    const parts = [M(d).morningNote, E(d).dayNotes, E(d).otherNotes].filter(Boolean);
    return parts.length ? [`<li><b>${weekdayShort(d)} ${fmtDate(d)}:</b> ${parts.map(esc).join(' · ')}</li>`] : [];
  });
  return `<section class="card week print-area">
    <div class="card-head"><h2>Viikkotaulukko</h2><button class="btn small no-print" data-print>🖨 Tulosta</button></div>
    <div class="row nav-days no-print"><button class="btn small" data-week="-1">‹</button>
      <span class="grow center">${fmtDate(start)}–${fmtDate(addDays(start, 6))}${start.slice(0, 4)}</span>
      <button class="btn small" data-week="1" ${addDays(start, 7) > today() ? 'disabled' : ''}>›</button></div>
    <h3 class="print-only">Oma unipäiväkirjani ${fmtDate(start)}–${fmtDate(addDays(start, 6))}${start.slice(0, 4)}</h3>
    <div class="table-scroll"><table class="weektable">
      <thead><tr><th></th>${dates.map(d => `<th data-open="${d}">${weekdayShort(d).replace(/^./, c => c.toUpperCase())}<br><small>${fmtDate(d)}</small></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([l, fn]) => `<tr><th>${esc(l)}</th>${dates.map(d => `<td>${esc(fn(d))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    ${notes.length ? `<p class="label">Muita huomioita viikolta</p><ul class="notes">${notes.join('')}</ul>` : ''}
  </section>`;
}
const fmtClockOr = t => t ? fmtClock(t) : '';
const durOr = v => v == null || v === '' ? '' : fmtDur(v).replace(' min', 'min');

// ---------------------------------------------------------------- vienti
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function exportJson(S) {
  const data = {
    app: 'Unipäiväkirja', exportedAt: new Date().toISOString(), user: S.user.email,
    days: S.days, events: S.events, phrases: S.phrases,
  };
  download(`unipaivakirja-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function exportCsv(S) {
  const dates = [...new Set([...Object.keys(S.days), ...S.events.map(eventDate)])].sort();
  const head = ['Päivä', 'Viikonpäivä', 'Unilääke', 'Unilääke nimi', 'Unilääke annos', 'Unilääke klo', 'Melatoniini', 'Melatoniini nimi', 'Melatoniini annos', 'Melatoniini klo',
    'Nukuin', 'Vuoteeseenmeno', 'Nukahtamisviive min', 'Heräämiskerrat', 'Heräämisaika', 'Valveaika min', 'Vuoteestanousu', 'Vuoteessaoloaika min', 'Uniaika min', 'Unen laatu', 'Huomioita yöstä',
    'Vireys', 'Päivän kulku', 'Muita huomioita', 'Kahvit', 'Kahvien ajat', 'Teet', 'Teiden ajat', 'Neurosonic'];
  const q = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = dates.map(d => {
    const m = S.days[d]?.morning || {}, e = S.days[d]?.evening || {};
    const evs = S.events.filter(x => eventDate(x) === d);
    const of = t => evs.filter(x => x.type === t);
    const med = k => [m[k]?.taken == null ? '' : m[k].taken ? 'kyllä' : 'ei', m[k]?.name, m[k]?.dose, m[k]?.time];
    return [d, weekdayShort(d), ...med('sleepMed'), ...med('melatonin'),
      ({ yksin: 'yksin', timppa: 'Timpan kanssa' })[m.company], m.bedTime, m.latency, m.awakenings, m.wakeTime, m.wakeAwake, m.outOfBed, inBedOf(m), sleepOf(m), m.quality, m.morningNote,
      e.alertness, e.dayNotes, e.otherNotes,
      of('kahvi').length, of('kahvi').map(x => fmtTime(x.at)).join(' '), of('tee').length, of('tee').map(x => fmtTime(x.at)).join(' '),
      of('neurosonic').map(x => `${fmtTime(x.at)} ${x.program} ${x.minutes} min`).join(', '),
    ].map(q).join(';');
  });
  // BOM, jotta Excel tunnistaa ääkköset
  download(`unipaivakirja-${today()}.csv`, '﻿' + [head.join(';'), ...lines].join('\r\n'), 'text/csv;charset=utf-8');
}
