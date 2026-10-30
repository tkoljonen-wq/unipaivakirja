// Tietovarasto: Firebase (Firestore + Google-kirjautuminen). Paikallinen testitila vain
// kehityskoneella (localhost + ?local), jolloin data on vain tämän selaimen localStoragessa.
//
// Rakenne (Firestore). Jokaisella käyttäjällä on omat tietonsa, joita muut eivät näe:
//   users/{uid}/days/{YYYY-MM-DD}  { morning: {...}, evening: {...}, updatedAt }
//   users/{uid}/events/{id}        { type: kahvi|tee|neurosonic, at: ISO-aika, program?, minutes? }
//   users/{uid}/phrases/{id}       { field, text, createdAt }

import { firebaseConfig, allowedEmails } from '../firebase-config.js';

const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
export const isLocalMode = isLocalHost && new URLSearchParams(location.search).has('local');

export async function createStore() {
  return isLocalMode ? createLocalStore() : createFirebaseStore();
}

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------- Firebase
async function createFirebaseStore() {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  let db;
  try {
    // Offline-välimuisti: kirjaukset toimivat ilman verkkoa ja synkronoituvat myöhemmin
    db = F.initializeFirestore(app, {
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.warn('Offline-välimuisti ei käytössä', e);
    db = F.getFirestore(app);
  }
  A.getRedirectResult(auth).catch(e => console.warn(e));

  let user = null;
  const col = name => F.collection(db, 'users', user.uid, name);
  const ref = (name, id) => F.doc(db, 'users', user.uid, name, id);
  // Kirjoituksia ei odoteta (offline-tilassa lupaus ratkeaa vasta synkronoinnissa)
  const fire = p => { p.catch(e => window.dispatchEvent(new CustomEvent('store-error', { detail: e }))); };
  const watch = (name, cb, onError) => F.onSnapshot(col(name), { includeMetadataChanges: true }, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })), { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites });
  }, e => onError?.(e));

  return {
    cloud: true,
    onAuth(cb) {
      A.onAuthStateChanged(auth, u => {
        if (u && !allowedEmails.includes((u.email || '').toLowerCase())) {
          A.signOut(auth);
          cb(null, `Tilillä ${u.email} ei ole käyttöoikeutta.`);
          return;
        }
        user = u;
        cb(u ? { name: u.displayName, email: u.email } : null);
      });
    },
    async signIn() {
      const provider = new A.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await A.signInWithPopup(auth, provider);
      } catch (e) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) {
          await A.signInWithRedirect(auth, provider);
        } else if (e.code !== 'auth/popup-closed-by-user') throw e;
      }
    },
    signOut: () => A.signOut(auth),

    watchDays: (cb, err) => watch('days', cb, err),
    watchEvents: (cb, err) => watch('events', cb, err),
    watchPhrases: (cb, err) => watch('phrases', cb, err),

    // part = 'morning' | 'evening'; data korvaa osan kokonaan
    saveDayPart(date, part, data) {
      fire(F.setDoc(ref('days', date), { [part]: data, updatedAt: nowIso() }, { merge: true }));
    },
    deleteDayPart(date, part) {
      fire(F.updateDoc(ref('days', date), { [part]: F.deleteField(), updatedAt: nowIso() }));
    },
    addEvent(ev) {
      const r = F.doc(col('events'));
      fire(F.setDoc(r, { ...ev, createdAt: nowIso() }));
      return r.id;
    },
    updateEvent(id, ev) { fire(F.setDoc(ref('events', id), ev, { merge: true })); },
    deleteEvent(id) { fire(F.deleteDoc(ref('events', id))); },
    addPhrase(field, text) { fire(F.addDoc(col('phrases'), { field, text, createdAt: nowIso() })); },
    deletePhrase(id) { fire(F.deleteDoc(ref('phrases', id))); },

    // Poistaa kaikki tämän käyttäjän tiedot pilvestä
    async deleteAll() {
      for (const name of ['days', 'events', 'phrases']) {
        const snap = await F.getDocs(col(name));
        let batch = F.writeBatch(db), n = 0;
        for (const d of snap.docs) {
          batch.delete(d.ref);
          if (++n % 400 === 0) { await batch.commit(); batch = F.writeBatch(db); }
        }
        await batch.commit();
      }
    },
  };
}

// ---------------------------------------------------------------- Paikallinen testitila
function createLocalStore() {
  const KEY = 'unipaivakirja-local-test';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const data = Object.assign({ days: {}, events: {}, phrases: {} }, load());
  const listeners = { days: [], events: [], phrases: [] };
  const list = name => Object.entries(data[name]).map(([id, v]) => ({ id, ...v }));
  const emit = name => { localStorage.setItem(KEY, JSON.stringify(data)); listeners[name].forEach(cb => cb(list(name), {})); };
  const watch = name => cb => { listeners[name].push(cb); cb(list(name), {}); return () => {}; };
  const newId = () => Math.random().toString(36).slice(2, 12);

  return {
    cloud: false,
    onAuth(cb) { cb({ name: 'Testikäyttäjä', email: 'paikallinen testitila' }); },
    async signIn() {},
    async signOut() {},
    watchDays: watch('days'),
    watchEvents: watch('events'),
    watchPhrases: watch('phrases'),
    saveDayPart(date, part, d) { data.days[date] = { ...data.days[date], [part]: d, updatedAt: nowIso() }; emit('days'); },
    deleteDayPart(date, part) { if (data.days[date]) { delete data.days[date][part]; emit('days'); } },
    addEvent(ev) { const id = newId(); data.events[id] = { ...ev, createdAt: nowIso() }; emit('events'); return id; },
    updateEvent(id, ev) { data.events[id] = { ...data.events[id], ...ev }; emit('events'); },
    deleteEvent(id) { delete data.events[id]; emit('events'); },
    addPhrase(field, text) { data.phrases[newId()] = { field, text, createdAt: nowIso() }; emit('phrases'); },
    deletePhrase(id) { delete data.phrases[id]; emit('phrases'); },
    async deleteAll() { for (const k of ['days', 'events', 'phrases']) { data[k] = {}; emit(k); } },
  };
}
