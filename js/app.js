// Unipäiväkirja – näkymät ja toiminnot
import { createStore, isLocalMode } from './store.js';
import { MORNING, EVENING, MEDS, SCALE_LABELS, NEUROSONIC, EVENT_TYPES, PHRASE_FIELDS } from './questions.js';
import {
  today, addDays, fmtDate, fmtDateLong, fmtTime, fmtDur, fmtClock, nowTime, pad, isoDate,
  eveningDefaultDate, eventDate, calcInBed, calcSleep, inBedOf, sleepOf, weekdayShort, esc,
  latencyOf, awakeOf, sleepCheck,
} from './util.js';
import { renderReports, bindReports, exportJson, exportCsv } from './report.js';

export const VERSION = '1.0.0';

const S = {
  store: null,
  user: null,
  days: {},       // { 'YYYY-MM-DD': { morning, evening } }
  events: [],     // [{ id, type, at, program, minutes }]
  phrases: [],    // [{ id, field, text }]
  view: 'today',
  quiz: null,     // { kind, date, data, step, mode: 'wizard'|'form' }
  dayView: null,  // historian päivänäkymän päivä
  unsub: [],
  sync: '',
};
window.__S = S; // virheenjäljitystä varten

const $ = sel => document.querySelector(sel);
const main = () => $('#main');

// ---------------------------------------------------------------- käynnistys
async function start() {
  bindInstall();
  try {
    S.store = await createStore();
  } catch (e) {
    console.error(e);
    main().innerHTML = `<p class="error pad">Firebasen lataus epäonnistui. Tarkista verkkoyhteys ja yritä uudelleen.</p>`;
    return;
  }
  window.addEventListener('store-error', e => {
    console.error(e.detail);
    toast('Tallennus epäonnistui: ' + (e.detail?.code || e.detail?.message || e.detail));
  });

  S.store.onAuth((user, err) => {
    S.unsub.forEach(u => u && u()); S.unsub = [];
    S.user = user;
    if (!user) { showLogin(err); return; }
    $('#login').hidden = true;
    $('#tabbar').hidden = false;
    S.unsub.push(S.store.watchDays((list, meta) => {
      S.days = Object.fromEntries(list.map(d => [d.id, d]));
      setSync(meta); refresh();
    }, onWatchError));
    S.unsub.push(S.store.watchEvents((list, meta) => {
      S.events = list.sort((a, b) => a.at.localeCompare(b.at));
      setSync(meta); refresh();
    }, onWatchError));
    S.unsub.push(S.store.watchPhrases(list => {
      S.phrases = list.sort((a, b) => a.text.localeCompare(b.text, 'fi'));
      refresh();
    }, onWatchError));
    render();
  });

  $('#loginBtn').addEventListener('click', async () => {
    $('#loginError').textContent = '';
    try { await S.store.signIn(); } catch (e) { $('#loginError').textContent = 'Kirjautuminen epäonnistui: ' + (e.code || e.message); }
  });
  document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  // Puhelimen takaisin-painike: suljetaan kysely (keskeneräiset vastaukset talteen) tai päivänäkymä
  window.addEventListener('popstate', () => {
    if (S.quiz) {
      if (S.quiz.mode === 'wizard' && !S.quiz.closing) persistQuiz(false);
      S.quiz = null;
    } else if (S.dayView) S.dayView = null;
    render();
  });
}

function onWatchError(e) {
  console.error(e);
  toast('Tietojen haku epäonnistui: ' + (e.code || e.message));
}

function setSync(meta) {
  if (!S.store.cloud) S.sync = 'Testitila';
  else if (!navigator.onLine || meta?.fromCache) S.sync = 'Offline';
  else if (meta?.pending) S.sync = 'Tallennetaan…';
  else S.sync = '';
  $('#syncStatus').textContent = S.sync;
}
window.addEventListener('online', () => setSync({}));
window.addEventListener('offline', () => setSync({ fromCache: true }));

function showLogin(err) {
  $('#login').hidden = false;
  $('#tabbar').hidden = true;
  main().innerHTML = '';
  $('#loginError').textContent = err || '';
}

function go(view) {
  S.view = view; S.quiz = null; S.dayView = null;
  render();
  window.scrollTo(0, 0);
}

// Tiedot muuttuivat: piirretään uudelleen, paitsi kesken kyselyn (ettei syöte katoa)
function refresh() {
  if (!S.user) return;
  if (S.quiz) return;
  render();
}

function render() {
  if (!S.user) return;
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === S.view));
  $('#tabbar').hidden = !!S.quiz;
  if (S.quiz) return renderQuiz();
  if (S.dayView) return renderDay(S.dayView);
  ({ today: renderToday, history: renderHistory, reports: renderReportsView, settings: renderSettings })[S.view]();
}

// ---------------------------------------------------------------- apurit
const eventsOn = date => S.events.filter(e => eventDate(e) === date);
const phrasesFor = field => S.phrases.filter(p => p.field === field);
const hasValues = obj => Object.entries(obj || {}).some(([k, v]) =>
  !['completedAt', 'startedAt'].includes(k) && (typeof v === 'object' && v ? hasValues(v) || v.taken : v !== '' && v != null));

function eventLabel(ev) {
  const t = EVENT_TYPES[ev.type] || { label: ev.type, icon: '•' };
  return ev.type === 'neurosonic' && ev.program ? `${t.label}: ${ev.program}${ev.minutes ? ` ${ev.minutes} min` : ''}` : t.label;
}

let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button class="toast-btn">${esc(action.label)}</button>` : '');
  if (action) el.querySelector('button').onclick = () => { action.run(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 6000 : 3000);
}

// Oma vahvistusikkuna (selaimen confirm() ei toimi hyvin asennetussa sovelluksessa)
function confirmDlg(text, okLabel = 'Poista', danger = true) {
  return new Promise(resolve => {
    const dlg = $('#dlg');
    dlg.innerHTML = `<form method="dialog" class="dlg-body">
      <p>${esc(text)}</p>
      <div class="row end"><button value="no" class="btn">Peruuta</button><button value="yes" class="btn ${danger ? 'danger' : 'primary'}">${esc(okLabel)}</button></div>
    </form>`;
    dlg.onclose = () => resolve(dlg.returnValue === 'yes');
    dlg.showModal();
  });
}

// ---------------------------------------------------------------- Tänään
function renderToday() {
  const d = today();
  const mDate = d, eDate = eveningDefaultDate();
  const m = S.days[mDate]?.morning, e = S.days[eDate]?.evening;
  const evs = eventsOn(d);
  const count = t => evs.filter(x => x.type === t).length;

  main().innerHTML = `
    <h1 class="page-title">${esc(fmtDateLong(d))}</h1>
    ${quizCard('morning', mDate, m, '🌅', 'Aamukysely', 'Täytä heti herättyäsi tiedot yöstä.')}
    ${quizCard('evening', eDate, e, '🌆', 'Iltakysely', 'Vireys ja päivän kulku.')}
    <section class="quick">
      <button class="quick-btn" data-quick="kahvi"><span class="qi">☕</span><span>Kahvi</span>${count('kahvi') ? `<b class="badge">${count('kahvi')}</b>` : ''}</button>
      <button class="quick-btn" data-quick="tee"><span class="qi">🍵</span><span>Tee</span>${count('tee') ? `<b class="badge">${count('tee')}</b>` : ''}</button>
      <button class="quick-btn" data-quick="neurosonic"><span class="qi">🎧</span><span>Neurosonic</span>${count('neurosonic') ? `<b class="badge">${count('neurosonic')}</b>` : ''}</button>
    </section>
    <section class="card">
      <h2>Tänään kirjatut</h2>
      ${evs.length ? `<ul class="ev-list">${evs.map(evRow).join('')}</ul>` : '<p class="muted">Ei vielä kirjauksia. Paina Kahvi, Tee tai Neurosonic aina kun juot tai käytät.</p>'}
    </section>`;
  bindQuick(main());
  main().querySelectorAll('[data-quiz]').forEach(b => b.addEventListener('click', () => openQuiz(b.dataset.quiz, b.dataset.date, b.dataset.mode)));
}

function quizCard(kind, date, data, icon, title, help) {
  const done = data?.completedAt, partial = !done && hasValues(data);
  let summary = '';
  if (data && kind === 'morning' && (done || partial)) {
    summary = `<div class="mini-stats">
      <span>Uni <b>${fmtDur(sleepOf(data))}</b></span>
      <span>Laatu <b>${data.quality || '–'}</b></span>
      ${MEDS.filter(x => data[x.key]?.taken).map(x => `<span>${x.icon}</span>`).join('')}
    </div>`;
  } else if (data && kind === 'evening' && (done || partial)) {
    summary = `<div class="mini-stats"><span>Vireys <b>${data.alertness || '–'}</b></span></div>`;
  }
  const dateNote = date !== today() ? ` <span class="muted">(${fmtDate(date)})</span>` : '';
  return `<section class="card quiz-card ${done ? 'done' : ''}">
    <div class="qc-head"><span class="qc-icon">${icon}</span><div><h2>${title}${dateNote}</h2>
      <p class="muted small">${done ? '✓ Täytetty' : partial ? 'Kesken' : help}</p></div></div>
    ${summary}
    ${done
      ? `<button class="btn wide" data-quiz="${kind}" data-date="${date}" data-mode="form">✏️ Muokkaa vastauksia</button>`
      : `<button class="btn primary wide big" data-quiz="${kind}" data-date="${date}" data-mode="wizard">${partial ? 'Jatka kyselyä' : 'Aloita kysely'}</button>`}
  </section>`;
}

function evRow(ev) {
  const t = EVENT_TYPES[ev.type] || {};
  return `<li><button class="ev-row" data-ev="${ev.id}"><span class="ev-time">${fmtTime(ev.at)}</span><span class="ev-ico">${t.icon || '•'}</span><span>${esc(eventLabel(ev))}</span><span class="chev">›</span></button></li>`;
}

// Pikanapit ja tapahtumarivit; date = minkä päivän näkymässä ollaan (historiaa varten)
function bindQuick(root, date) {
  root.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
    const type = b.dataset.quick;
    if (type === 'neurosonic') return neurosonicDialog(null, date);
    if (date && date !== today()) return eventDialog({ type, at: defaultAtFor(date) }, true);
    const id = S.store.addEvent({ type, at: new Date().toISOString() });
    navigator.vibrate?.(30);
    toast(`${EVENT_TYPES[type].icon} ${EVENT_TYPES[type].label} kirjattu klo ${fmtTime(new Date().toISOString())}`, { label: 'Peru', run: () => S.store.deleteEvent(id) });
  }));
  root.querySelectorAll('[data-ev]').forEach(b => b.addEventListener('click', () => {
    const ev = S.events.find(x => x.id === b.dataset.ev);
    if (!ev) return;
    ev.type === 'neurosonic' ? neurosonicDialog(ev) : eventDialog(ev, false);
  }));
}

const defaultAtFor = date => date === today() ? new Date().toISOString() : new Date(`${date}T12:00`).toISOString();
const toLocalInput = iso => { const d = new Date(iso); return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// Kahvin / teen ajan muokkaus tai lisäys menneelle päivälle
function eventDialog(ev, isNew) {
  const t = EVENT_TYPES[ev.type];
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" class="dlg-body">
    <h2>${t.icon} ${t.label}</h2>
    <label class="field">Päivä ja kellonaika<input type="datetime-local" name="at" value="${toLocalInput(ev.at)}" required></label>
    <div class="row end">
      ${isNew ? '' : '<button type="button" class="btn danger" data-del>Poista</button>'}
      <span class="grow"></span>
      <button value="cancel" class="btn" formnovalidate>Peruuta</button>
      <button value="ok" class="btn primary">Tallenna</button>
    </div></form>`;
  dlg.querySelector('[data-del]')?.addEventListener('click', () => { S.store.deleteEvent(ev.id); dlg.close(); toast('Poistettu'); });
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    const at = new Date(dlg.querySelector('[name=at]').value).toISOString();
    if (isNew) S.store.addEvent({ type: ev.type, at }); else S.store.updateEvent(ev.id, { at });
    toast('Tallennettu');
  };
  dlg.returnValue = '';
  dlg.showModal();
}

// Neurosonic: päivä ja kellonaika (oletuksena nyt) sekä ohjelma ja kesto
function neurosonicDialog(ev, date) {
  const isNew = !ev;
  const st = { at: ev?.at || defaultAtFor(date || today()), program: ev?.program || null, minutes: ev?.minutes || null };
  const dlg = $('#dlg');
  const draw = () => {
    const prog = NEUROSONIC.find(p => p.name === st.program);
    dlg.innerHTML = `<form method="dialog" class="dlg-body">
      <h2>🎧 Neurosonic</h2>
      <label class="field">Päivä ja kellonaika<input type="datetime-local" name="at" value="${toLocalInput(st.at)}" required></label>
      <p class="label">Ohjelma</p>
      <div class="choice-grid">${NEUROSONIC.map(p => `<button type="button" class="choice ${p.name === st.program ? 'on' : ''}" data-prog="${p.name}">${p.name}</button>`).join('')}</div>
      ${prog ? `<p class="label">Kesto</p><div class="chips">${prog.minutes.map(m => `<button type="button" class="chip big ${m === st.minutes ? 'on' : ''}" data-min="${m}">${m} min</button>`).join('')}</div>` : ''}
      <div class="row end">
        ${isNew ? '' : '<button type="button" class="btn danger" data-del>Poista</button>'}
        <span class="grow"></span>
        <button value="cancel" class="btn" formnovalidate>Peruuta</button>
        <button value="ok" class="btn primary" ${st.program && st.minutes ? '' : 'disabled'}>Tallenna</button>
      </div></form>`;
    const atInput = dlg.querySelector('[name=at]');
    atInput.addEventListener('change', () => { if (atInput.value) st.at = new Date(atInput.value).toISOString(); });
    dlg.querySelectorAll('[data-prog]').forEach(b => b.addEventListener('click', () => {
      st.program = b.dataset.prog;
      const p = NEUROSONIC.find(x => x.name === st.program);
      st.minutes = p.minutes.length === 1 ? p.minutes[0] : (p.minutes.includes(st.minutes) ? st.minutes : null);
      draw();
    }));
    dlg.querySelectorAll('[data-min]').forEach(b => b.addEventListener('click', () => { st.minutes = Number(b.dataset.min); draw(); }));
    dlg.querySelector('[data-del]')?.addEventListener('click', () => { S.store.deleteEvent(ev.id); dlg.close(); toast('Poistettu'); });
  };
  draw();
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok' || !st.program || !st.minutes) return;
    const data = { type: 'neurosonic', at: st.at, program: st.program, minutes: st.minutes };
    if (isNew) S.store.addEvent(data); else S.store.updateEvent(ev.id, data);
    toast(`🎧 ${st.program} ${st.minutes} min tallennettu`);
  };
  dlg.returnValue = '';
  dlg.showModal();
}

// ---------------------------------------------------------------- Kysely
function openQuiz(kind, date, mode = 'wizard') {
  const saved = S.days[date]?.[kind];
  const data = structuredClone(saved || {});
  if (!data.startedAt) data.startedAt = new Date().toISOString();
  const qs = kind === 'morning' ? MORNING : EVENING;
  // Jatketaan ensimmäisestä vastaamattomasta kohdasta
  let step = 0;
  if (mode === 'wizard' && saved && hasValues(saved)) {
    const i = qs.findIndex(q => !answered(q, data));
    step = i < 0 ? qs.length : i;
  }
  S.quiz = { kind, date, data, step, mode };
  history.pushState({ quiz: true }, '');
  render();
  window.scrollTo(0, 0);
}

function answered(q, d) {
  if (q.type === 'meds') return MEDS.some(m => d[m.key]?.taken != null);
  if (q.type === 'calc') return d[q.key] !== undefined || (q.calc === 'inBed' ? calcInBed(d) : calcSleep(d)) != null;
  return d[q.key] !== undefined;
}

function closeQuiz() {
  if (history.state?.quiz) { S.quiz.closing = true; history.back(); return; } // popstate piirtää
  S.quiz = null;
  render();
}

function persistQuiz(complete) {
  const { kind, date, data } = S.quiz;
  if (complete) data.completedAt = new Date().toISOString();
  if (complete || hasValues(data)) S.store.saveDayPart(date, kind, data);
}

function renderQuiz() {
  const z = S.quiz;
  const qs = z.kind === 'morning' ? MORNING : EVENING;
  const title = z.kind === 'morning' ? 'Aamukysely' : 'Iltakysely';
  const dateLine = `<button class="date-btn" data-date-change>📅 ${esc(fmtDateLong(z.date))} ✎</button>`;

  if (z.mode === 'form') {
    main().innerHTML = `
      <div class="quiz-top"><button class="icon-btn" data-close aria-label="Sulje">✕</button><h1>${title}</h1></div>
      ${dateLine}
      ${qs.map(q => `<section class="card q-card" data-q="${q.key}">${fieldHtml(q, z.data)}</section>`).join('')}
      <div class="quiz-actions sticky">
        <button class="btn" data-close>Peruuta</button>
        <button class="btn primary grow" data-save>Tallenna</button>
      </div>
      ${S.days[z.date]?.[z.kind] ? `<button class="btn danger wide subtle" data-delete>Poista tämän päivän ${z.kind === 'morning' ? 'aamukirjaus' : 'iltakirjaus'}</button>` : ''}`;
  } else if (z.step >= qs.length) {
    main().innerHTML = `
      <div class="quiz-top"><button class="icon-btn" data-close aria-label="Sulje">✕</button><h1>${title}</h1></div>
      ${dateLine}
      <section class="card"><h2>Yhteenveto</h2>${summaryHtml(z.kind, z.data, true)}</section>
      <div class="quiz-actions">
        <button class="btn" data-prev>← Takaisin</button>
        <button class="btn primary grow big" data-finish>✓ Tallenna</button>
      </div>`;
  } else {
    const q = qs[z.step];
    const pct = Math.round(100 * z.step / qs.length);
    main().innerHTML = `
      <div class="quiz-top"><button class="icon-btn" data-close aria-label="Sulje">✕</button><h1>${title}</h1><span class="muted">${z.step + 1} / ${qs.length}</span></div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      ${z.step === 0 ? dateLine : ''}
      <section class="card q-card wizard" data-q="${q.key}">${fieldHtml(q, z.data)}</section>
      <div class="quiz-actions">
        <button class="btn" data-prev ${z.step === 0 ? 'disabled' : ''}>← Edellinen</button>
        <button class="btn primary grow big" data-next>${answered(q, z.data) ? 'Seuraava →' : 'Ohita →'}</button>
      </div>`;
  }
  bindQuiz();
}

// Kysymyksen syöttökenttä. Arvot luetaan/kirjoitetaan data-path-polun kautta (esim. "sleepMed.name").
function fieldHtml(q, d) {
  const head = `<h2 class="q-title">${esc(q.title)}</h2>${q.help ? `<p class="q-help">${esc(q.help)}</p>` : ''}`;
  switch (q.type) {
    case 'time':
      return head + `<div class="row"><input type="time" class="time-input" data-path="${q.key}" value="${esc(d[q.key] || '')}">
        <button class="chip" data-now="${q.key}">Nyt</button><button class="chip" data-clear="${q.key}">Tyhjennä</button></div>`;
    case 'duration': {
      const v = d[q.key], has = v !== undefined && v !== null && v !== '';
      return head + hmInputs(q.key, has ? Math.floor(v / 60) : '', has ? v % 60 : '') + `
        <div class="chips">${q.chips.map(c => `<button class="chip ${Number(d[q.key]) === c && d[q.key] !== '' && d[q.key] != null ? 'on' : ''}" data-set="${q.key}" data-val="${c}">${c >= 60 ? fmtDur(c) : c + ' min'}</button>`).join('')}
        <button class="chip" data-clear="${q.key}">Tyhjennä</button></div>`;
    }
    case 'count': {
      const v = d[q.key];
      return head + `<div class="stepper"><button class="step-btn" data-inc="${q.key}" data-by="-1">−</button>
        <span class="step-val">${v ?? '–'}</span><button class="step-btn" data-inc="${q.key}" data-by="1">+</button></div>
        <div class="chips center"><button class="chip" data-clear="${q.key}">Tyhjennä</button></div>`;
    }
    case 'scale':
      return head + `<div class="scale">${[1, 2, 3, 4, 5].map(n => `<button class="scale-btn s${n} ${d[q.key] === n ? 'on' : ''}" data-set="${q.key}" data-val="${n}" data-toggle><b>${n}</b><small>${SCALE_LABELS[n]}</small></button>`).join('')}</div>`;
    case 'calc': {
      const auto = q.calc === 'inBed' ? calcInBed(d) : calcSleep(d);
      const manual = d[q.key];
      const has = manual !== undefined && manual !== null && manual !== '';
      const h = has ? Math.floor(manual / 60) : '', m = has ? manual % 60 : '';
      return head + `<div class="calc-box"><span class="muted small">${has ? 'Korjattu käsin' : 'Laskettu'}</span>
        <b class="calc-val" data-calcval="${q.key}">${fmtDur(has ? manual : auto)}</b>
        ${auto == null && !has ? '<span class="muted small">Täytä ensin vuoteeseenmeno- ja nousuaika.</span>' : ''}</div>
        ${q.calc === 'sleep' ? `<div data-breakdown>${sleepBreakdownHtml(d)}</div>` : ''}
        <p class="label">Korjaa tarvittaessa</p>
        ${hmInputs(q.key, h, m, has ? `<button class="chip" data-clear="${q.key}">Käytä laskettua</button>` : '')}`;
    }
    case 'choice':
      return head + `<div class="toggle-row">${q.options.map(o => `<button class="toggle ${d[q.key] === o.val ? 'on' : ''}" data-choice="${q.key}" data-val="${o.val}">${o.icon} ${esc(o.label)}</button>`).join('')}</div>`;
    case 'text':
      return head + textFieldHtml(q.key, q.key, d[q.key], 4);
    case 'meds':
      return head + MEDS.map(m => {
        const v = d[m.key] || {};
        return `<div class="med ${v.taken ? 'on' : ''}">
          <div class="toggle-row">
            <button class="toggle ${v.taken === true ? 'on' : ''}" data-med="${m.key}" data-val="1">${m.icon} ${esc(m.label)}</button>
            <button class="toggle no ${v.taken === false ? 'on' : ''}" data-med="${m.key}" data-val="0">Ei</button>
          </div>
          ${v.taken ? `<div class="med-details">
            <p class="label">Lääkkeen nimi</p>${textFieldHtml(`${m.key}.name`, `${m.key}Name`, v.name, 1)}
            <p class="label">Annos</p>${textFieldHtml(`${m.key}.dose`, `${m.key}Dose`, v.dose, 1)}
            <p class="label">Ottamisaika</p>
            <div class="row"><input type="time" class="time-input" data-path="${m.key}.time" value="${esc(v.time || '')}"><button class="chip" data-clear="${m.key}.time">Tyhjennä</button></div>
          </div>` : ''}
        </div>`;
      }).join('');
  }
  return head;
}

// Kesto tunteina ja minuutteina (arvo tallennetaan minuutteina)
function hmInputs(key, h, m, extra = '') {
  return `<div class="row"><input type="number" inputmode="numeric" min="0" max="24" class="num-input sm" data-hm="${key}" data-part="h" value="${h}" placeholder="h"><span class="unit">h</span>
    <input type="number" inputmode="numeric" min="0" max="59" class="num-input sm" data-hm="${key}" data-part="m" value="${m}" placeholder="min"><span class="unit">min</span>
    ${extra}</div>`;
}

// Uniajan laskun erittely ja varoitukset
function sleepBreakdownHtml(d) {
  const c = sleepCheck(d);
  if (c.bed == null) return '';
  const line = (label, v, op = '−') => `<tr><th>${op} ${esc(label)}</th><td>${v == null ? '<span class="muted">–</span>' : fmtDur(v)}</td></tr>`;
  const rows = [
    `<tr><th>Vuoteessaoloaika</th><td>${fmtDur(c.bed)}</td></tr>`,
    line('Nukahtamisviive', c.lat),
    ...(c.legacyAwake != null
      ? [line('Valveaika', c.legacyAwake)]
      : [line('Valve yöllä', c.night), line('Valve aamulla (herääminen → nousu)', c.morn)]),
    `<tr class="total"><th>= Uniaika</th><td>${fmtDur(c.sleep)}</td></tr>`,
  ];
  return `<table class="breakdown">${rows.join('')}</table>
    ${c.warn.map(w => `<p class="warn">⚠️ ${esc(w)}</p>`).join('')}`;
}

// Vapaa tekstikenttä + vakiovastaukset (fraasit) + "Tallenna vakiovastaukseksi"
function textFieldHtml(path, field, value, rows) {
  const ph = phrasesFor(field);
  return `<div class="text-field">
    ${ph.length ? `<div class="chips phrases">${ph.map(p => `<button class="chip phrase" data-phrase="${path}" data-text="${esc(p.text)}">${esc(p.text)}</button>`).join('')}</div>` : ''}
    ${rows > 1
      ? `<textarea rows="${rows}" data-path="${path}" placeholder="Kirjoita tai valitse vakiovastaus">${esc(value || '')}</textarea>`
      : `<input type="text" data-path="${path}" value="${esc(value || '')}" placeholder="Kirjoita tai valitse vakiovastaus">`}
    <button class="link-btn" data-savephrase="${path}" data-field="${field}">＋ Tallenna vakiovastaukseksi</button>
  </div>`;
}

const getPath = (d, path) => path.split('.').reduce((o, k) => o?.[k], d);
function setPath(d, path, v) {
  const keys = path.split('.'), last = keys.pop();
  const o = keys.reduce((o, k) => (o[k] ??= {}), d);
  if (v === undefined) delete o[last]; else o[last] = v;
}

function bindQuiz() {
  const z = S.quiz, root = main();
  const qs = z.kind === 'morning' ? MORNING : EVENING;
  const redraw = () => { const y = window.scrollY; renderQuiz(); window.scrollTo(0, y); };
  // Wizardissa piirretään vain nykyinen kysymys uudelleen (nappien tila), lomakkeessa koko sivu
  const updateNextLabel = () => {
    const btn = root.querySelector('[data-next]');
    if (btn) btn.textContent = answered(qs[z.step], z.data) ? 'Seuraava →' : 'Ohita →';
  };
  const updateCalcs = () => {
    root.querySelectorAll('[data-calcval]').forEach(el => {
      const k = el.dataset.calcval, man = z.data[k];
      el.textContent = fmtDur(man != null && man !== '' ? man : (k === 'inBed' ? calcInBed(z.data) : calcSleep(z.data)));
    });
    root.querySelectorAll('[data-breakdown]').forEach(el => { el.innerHTML = sleepBreakdownHtml(z.data); });
  };
  const syncChips = k => {
    root.querySelectorAll(`[data-set="${k}"]`).forEach(c => c.classList.toggle('on', z.data[k] != null && c.dataset.val === String(z.data[k])));
  };

  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
    if (z.mode === 'wizard') persistQuiz(false);
    closeQuiz();
  }));
  root.querySelector('[data-prev]')?.addEventListener('click', () => { persistQuiz(false); z.step = Math.max(0, z.step - 1); renderQuiz(); window.scrollTo(0, 0); });
  root.querySelector('[data-next]')?.addEventListener('click', () => { persistQuiz(false); z.step++; renderQuiz(); window.scrollTo(0, 0); });
  root.querySelector('[data-finish]')?.addEventListener('click', () => { persistQuiz(true); toast('Tallennettu ✓'); closeQuiz(); });
  root.querySelector('[data-save]')?.addEventListener('click', () => { persistQuiz(true); toast('Tallennettu ✓'); closeQuiz(); });
  root.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!await confirmDlg(`Poistetaanko ${fmtDate(z.date)} ${z.kind === 'morning' ? 'aamukirjaus' : 'iltakirjaus'}?`)) return;
    S.store.deleteDayPart(z.date, z.kind);
    toast('Poistettu'); closeQuiz();
  });
  root.querySelector('[data-date-change]')?.addEventListener('click', () => changeQuizDate());

  root.querySelectorAll('[data-path]').forEach(el => el.addEventListener('input', () => {
    const path = el.dataset.path;
    let v = el.value;
    if (el.type === 'number') v = v === '' ? undefined : Math.max(0, Number(v));
    else if (v === '') v = undefined;
    setPath(z.data, path, v);
    const hint = root.querySelector(`[data-durhint="${path}"]`);
    if (hint) hint.textContent = v >= 60 ? fmtDur(v) : '';
    root.querySelectorAll(`[data-set="${path}"]`).forEach(c => c.classList.toggle('on', c.dataset.val === String(v)));
    updateCalcs(); updateNextLabel();
  }));
  root.querySelectorAll('[data-hm]').forEach(el => el.addEventListener('input', () => {
    const k = el.dataset.hm;
    const h = root.querySelector(`[data-hm="${k}"][data-part="h"]`).value, m = root.querySelector(`[data-hm="${k}"][data-part="m"]`).value;
    z.data[k] = (h === '' && m === '') ? undefined : (Number(h) || 0) * 60 + (Number(m) || 0);
    if (z.data[k] === undefined) delete z.data[k];
    syncChips(k); updateCalcs(); updateNextLabel();
  }));
  root.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.set, v = Number(b.dataset.val);
    setPath(z.data, k, b.hasAttribute('data-toggle') && getPath(z.data, k) === v ? undefined : v);
    redraw();
  }));
  root.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.choice, v = b.dataset.val;
    setPath(z.data, k, z.data[k] === v ? undefined : v);
    redraw();
  }));
  root.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.inc;
    z.data[k] = Math.max(0, (z.data[k] ?? 0) + (z.data[k] == null && Number(b.dataset.by) < 0 ? 0 : Number(b.dataset.by)));
    redraw();
  }));
  root.querySelectorAll('[data-now]').forEach(b => b.addEventListener('click', () => { setPath(z.data, b.dataset.now, nowTime()); redraw(); }));
  root.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => { setPath(z.data, b.dataset.clear, undefined); redraw(); }));
  root.querySelectorAll('[data-med]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.med, v = b.dataset.val === '1';
    z.data[k] = { ...(z.data[k] || {}) };
    z.data[k].taken = z.data[k].taken === v ? undefined : v;
    if (z.data[k].taken === undefined) delete z.data[k].taken;
    redraw();
  }));
  root.querySelectorAll('[data-phrase]').forEach(b => b.addEventListener('click', () => {
    const path = b.dataset.phrase, text = b.dataset.text;
    const el = root.querySelector(`[data-path="${path}"]`);
    const cur = (el?.value || '').trim();
    // Monirivisessä kentässä fraasi lisätään perään, yksirivisessä se korvaa arvon
    const v = el?.tagName === 'TEXTAREA' && cur && !cur.includes(text) ? `${cur}${/[.!?]$/.test(cur) ? ' ' : '. '}${text}` : text;
    setPath(z.data, path, v);
    if (el) { el.value = v; }
    updateNextLabel();
  }));
  root.querySelectorAll('[data-savephrase]').forEach(b => b.addEventListener('click', () => {
    const el = root.querySelector(`[data-path="${b.dataset.savephrase}"]`);
    const text = (el?.value || '').trim();
    if (!text) { toast('Kirjoita ensin teksti, jonka haluat tallentaa'); return; }
    if (phrasesFor(b.dataset.field).some(p => p.text === text)) { toast('Vakiovastaus on jo tallennettu'); return; }
    S.store.addPhrase(b.dataset.field, text);
    toast('Tallennettu vakiovastaukseksi');
    setTimeout(redraw, 150);
  }));
}

function changeQuizDate() {
  const z = S.quiz;
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" class="dlg-body">
    <h2>Kirjauksen päivä</h2>
    <p class="muted small">${z.kind === 'morning' ? 'Aamukysely kirjataan heräämispäivälle.' : 'Iltakysely kirjataan sille päivälle, jota se koskee.'}</p>
    <label class="field">Päivä<input type="date" name="d" value="${z.date}" max="${today()}" required></label>
    <div class="row end"><button value="cancel" class="btn" formnovalidate>Peruuta</button><button value="ok" class="btn primary">Vaihda</button></div>
  </form>`;
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    const d = dlg.querySelector('[name=d]').value;
    if (!d || d === z.date) return;
    const existing = S.days[d]?.[z.kind];
    if (existing && hasValues(existing)) {
      // Kohdepäivällä on jo kirjaus: avataan se muokattavaksi
      S.quiz = { ...z, date: d, data: structuredClone(existing), mode: 'form' };
      toast(`${fmtDate(d)} on jo kirjaus – avattiin muokattavaksi`);
    } else {
      z.date = d;
    }
    renderQuiz();
  };
  dlg.returnValue = '';
  dlg.showModal();
}

// Yhteenveto vastauksista (kyselyn lopussa ja historian päivänäkymässä)
const choiceLabel = (key, v) => MORNING.find(q => q.key === key)?.options.find(o => o.val === v)?.label;

function summaryHtml(kind, d, inQuiz) {
  if (!d || !hasValues(d)) return '<p class="muted">Ei vastauksia.</p>';
  const rows = [];
  const add = (label, val) => rows.push(`<tr><th>${esc(label)}</th><td>${val}</td></tr>`);
  const show = v => v === undefined || v === null || v === '' ? '<span class="muted">–</span>' : esc(v);
  if (kind === 'morning') {
    for (const m of MEDS) {
      const v = d[m.key];
      if (v?.taken == null) { add(m.short, show()); continue; }
      const det = [v.name, v.dose, v.time && 'klo ' + fmtClock(v.time)].filter(Boolean).map(esc).join(', ');
      add(m.short, v.taken ? `${m.icon} Kyllä${det ? ` – ${det}` : ''}` : 'Ei');
    }
    add('Nukuin', show(choiceLabel('company', d.company)));
    add('Vuoteeseenmeno', show(d.bedTime && fmtClock(d.bedTime)));
    if (d.sleepOnset) add('Nukahtamisaika', show(fmtClock(d.sleepOnset)));
    add('Nukahtamisviive', show(latencyOf(d) != null ? fmtDur(latencyOf(d)) : ''));
    add('Heräämiskerrat', show(d.awakenings));
    if (d.nightAwake != null) add('Valve yöllä', show(fmtDur(d.nightAwake)));
    add('Heräämisaika', show(d.wakeTime && fmtClock(d.wakeTime)));
    add('Valveaika yht.', show(awakeOf(d) != null ? fmtDur(awakeOf(d)) : ''));
    add('Vuoteestanousu', show(d.outOfBed && fmtClock(d.outOfBed)));
    add('Vuoteessaoloaika', show(inBedOf(d) != null ? fmtDur(inBedOf(d)) : ''));
    add('Uniaika', show(sleepOf(d) != null ? fmtDur(sleepOf(d)) : ''));
    add('Yöunen laatu', d.quality ? `${d.quality} – ${SCALE_LABELS[d.quality]}` : show());
    if (d.morningNote || inQuiz) add('Huomioita', show(d.morningNote));
  } else {
    add('Vireys', d.alertness ? `${d.alertness} – ${SCALE_LABELS[d.alertness]}` : show());
    add('Päivän kulku', show(d.dayNotes));
    add('Muita huomioita', show(d.otherNotes));
  }
  return `<table class="summary">${rows.join('')}</table>`;
}

// ---------------------------------------------------------------- Historia
function renderHistory() {
  const dates = new Set([...Object.keys(S.days).filter(k => hasValues(S.days[k].morning) || hasValues(S.days[k].evening)), ...S.events.map(eventDate)]);
  const list = [...dates].sort().reverse();
  main().innerHTML = `
    <h1 class="page-title">Historia</h1>
    <div class="row"><label class="field grow">Avaa päivä<input type="date" id="histDate" max="${today()}" value="${today()}"></label>
      <button class="btn" id="histOpen">Avaa</button></div>
    ${list.length ? `<ul class="day-list">${list.map(dayRow).join('')}</ul>` : '<p class="muted pad">Ei vielä kirjauksia.</p>'}`;
  main().querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => openDay(b.dataset.day)));
  $('#histOpen').addEventListener('click', () => { const v = $('#histDate').value; if (v) openDay(v); });
}

function dayRow(date) {
  const m = S.days[date]?.morning || {}, e = S.days[date]?.evening || {};
  const evs = eventsOn(date);
  const c = t => evs.filter(x => x.type === t).length;
  const bits = [
    sleepOf(m) != null && `😴 ${fmtDur(sleepOf(m))}`,
    m.quality && `laatu ${m.quality}`,
    e.alertness && `vireys ${e.alertness}`,
    MEDS.filter(x => m[x.key]?.taken).map(x => x.icon).join(''),
    c('kahvi') && `☕${c('kahvi')}`,
    c('tee') && `🍵${c('tee')}`,
    c('neurosonic') && `🎧${c('neurosonic')}`,
  ].filter(Boolean);
  return `<li><button class="day-row" data-day="${date}">
    <span class="dr-date"><b>${weekdayShort(date)}</b> ${fmtDate(date)}</span>
    <span class="dr-bits">${bits.map(esc).join(' · ') || '<span class="muted">–</span>'}</span>
    <span class="chev">›</span></button></li>`;
}

function openDay(date) {
  S.dayView = date;
  history.pushState({ day: date }, '');
  render(); window.scrollTo(0, 0);
}

function renderDay(date) {
  const day = S.days[date] || {};
  const evs = eventsOn(date);
  main().innerHTML = `
    <div class="quiz-top"><button class="icon-btn" data-back aria-label="Takaisin">←</button><h1>${esc(fmtDateLong(date))}</h1></div>
    <div class="row nav-days"><button class="btn" data-goday="${addDays(date, -1)}">‹ Edellinen</button>
      ${date < today() ? `<button class="btn" data-goday="${addDays(date, 1)}">Seuraava ›</button>` : ''}</div>
    <section class="card"><div class="card-head"><h2>🌅 Aamu</h2>
      <button class="btn small" data-quiz="morning" data-mode="${day.morning ? 'form' : 'wizard'}">${day.morning ? '✏️ Muokkaa' : 'Täytä'}</button></div>
      ${summaryHtml('morning', day.morning)}</section>
    <section class="card"><div class="card-head"><h2>🌆 Ilta</h2>
      <button class="btn small" data-quiz="evening" data-mode="${day.evening ? 'form' : 'wizard'}">${day.evening ? '✏️ Muokkaa' : 'Täytä'}</button></div>
      ${summaryHtml('evening', day.evening)}</section>
    <section class="card"><h2>Kahvit, teet ja Neurosonic</h2>
      ${evs.length ? `<ul class="ev-list">${evs.map(evRow).join('')}</ul>` : '<p class="muted">Ei kirjauksia.</p>'}
      <div class="quick small">
        <button class="quick-btn" data-quick="kahvi"><span class="qi">☕</span><span>＋ Kahvi</span></button>
        <button class="quick-btn" data-quick="tee"><span class="qi">🍵</span><span>＋ Tee</span></button>
        <button class="quick-btn" data-quick="neurosonic"><span class="qi">🎧</span><span>＋ Neurosonic</span></button>
      </div></section>`;
  main().querySelector('[data-back]').addEventListener('click', () => history.back());
  main().querySelectorAll('[data-goday]').forEach(b => b.addEventListener('click', () => { S.dayView = b.dataset.goday; history.replaceState({ day: S.dayView }, ''); render(); }));
  main().querySelectorAll('[data-quiz]').forEach(b => b.addEventListener('click', () => openQuiz(b.dataset.quiz, date, b.dataset.mode)));
  bindQuick(main(), date);
}

// ---------------------------------------------------------------- Raportit
function renderReportsView() {
  main().innerHTML = renderReports(S);
  bindReports(main(), S, () => renderReportsView(), openDay);
}

// ---------------------------------------------------------------- Asetukset
function renderSettings() {
  const groups = Object.entries(PHRASE_FIELDS).map(([field, label]) => {
    const ph = phrasesFor(field);
    return ph.length ? `<div class="ph-group"><p class="label">${esc(label)}</p>
      <ul class="ph-list">${ph.map(p => `<li><span>${esc(p.text)}</span><button class="icon-btn small" data-delphrase="${p.id}" aria-label="Poista">🗑</button></li>`).join('')}</ul></div>` : '';
  }).join('');
  main().innerHTML = `
    <h1 class="page-title">Asetukset</h1>
    <section class="card">
      <h2>Tili</h2>
      <p>${esc(S.user.name || '')}<br><span class="muted small">${esc(S.user.email || '')}</span></p>
      ${isLocalMode ? '<p class="warn small">Paikallinen testitila: tiedot vain tässä selaimessa.</p>' : ''}
      <button class="btn" id="installBtn" hidden>📲 Asenna sovellus</button>
      <button class="btn" id="logoutBtn">Kirjaudu ulos</button>
    </section>
    <section class="card">
      <h2>Vakiovastaukset</h2>
      ${groups || '<p class="muted">Ei tallennettuja vakiovastauksia. Tallenna niitä kyselyn tekstikentistä painamalla "Tallenna vakiovastaukseksi".</p>'}
    </section>
    <section class="card">
      <h2>Omat tiedot</h2>
      <p class="muted small">Tiedot tallentuvat Firebaseen Suomessa sijaitsevalle palvelimelle (europe-north1). Vain sinä näet omat kirjauksesi.</p>
      <div class="row wrap">
        <button class="btn" id="expJson">⬇ Vie JSON</button>
        <button class="btn" id="expCsv">⬇ Vie CSV</button>
      </div>
      <button class="btn danger subtle wide" id="deleteAll">Poista kaikki tietoni</button>
    </section>
    <p class="muted small center">Unipäiväkirja ${VERSION} · Kysymykset: Mielenterveystalo.fi, Unettomuuden omahoito-ohjelma</p>`;
  main().querySelectorAll('[data-delphrase]').forEach(b => b.addEventListener('click', async () => {
    const p = S.phrases.find(x => x.id === b.dataset.delphrase);
    if (p && await confirmDlg(`Poistetaanko vakiovastaus "${p.text}"?`)) S.store.deletePhrase(p.id);
  }));
  $('#logoutBtn').addEventListener('click', () => S.store.signOut());
  $('#expJson').addEventListener('click', () => exportJson(S));
  $('#expCsv').addEventListener('click', () => exportCsv(S));
  $('#deleteAll').addEventListener('click', async () => {
    if (!await confirmDlg('Poistetaanko KAIKKI unipäiväkirjasi tiedot pysyvästi? Vie tiedot ensin talteen, jos haluat säilyttää ne.', 'Poista kaikki')) return;
    if (!await confirmDlg('Oletko varma? Tätä ei voi perua.', 'Kyllä, poista')) return;
    try { await S.store.deleteAll(); toast('Kaikki tiedot poistettu'); } catch (e) { toast('Poisto epäonnistui: ' + (e.code || e.message)); }
  });
  updateInstallButtons();
}

// ---------------------------------------------------------------- asennus
function bindInstall() {
  document.addEventListener('installprompt-ready', updateInstallButtons);
  document.addEventListener('click', async e => {
    if (!e.target.closest('#installBtn, #loginInstall')) return;
    const p = window.__installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice.catch(() => {});
    window.__installPrompt = null;
    updateInstallButtons();
  });
  updateInstallButtons();
}
function updateInstallButtons() {
  const show = !!window.__installPrompt;
  document.querySelectorAll('#installBtn, #loginInstall').forEach(b => b.hidden = !show);
}

start();
