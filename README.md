# Unipäiväkirja

Unipäiväkirja (PWA) Android-puhelimeen. Kysymykset noudattavat Mielenterveystalo.fi:n Unettomuuden omahoito-ohjelman harjoitusta "Unipäiväkirja". Kirjautuminen tapahtuu Google-tilillä, ja tiedot tallentuvat Firebaseen (Firestore, Suomi). Kumpikin käyttäjä näkee vain omat tietonsa.

Osoite: https://tkoljonen-wq.github.io/unipaivakirja/

## Toiminnot

- **Aamukysely** (Aloita kysely): kysymykset tulevat yksi kerrallaan, ja minkä tahansa voi ohittaa.
  - Pikavalinnat *Otin unilääkkeen* ja *Otin melatoniinin*, joihin voi lisätä nimen, annoksen ja ottamisajan (ei pakollisia).
  - Vuoteeseenmeno, nukahtamisviive, heräämiskerrat, heräämisaika, valveaika, vuoteestanousu, yöunen laatu 1–5 ja vapaat huomiot.
  - Vuoteessaoloaika ja uniaika lasketaan automaattisesti. Niitä voi korjata käsin.
  - Kirjaus tallentuu heräämispäivälle, ja päivää voi vaihtaa.
- **Iltakysely**: päivän vireys 1–5, päivän kulku ja muut huomiot. Yöllä ennen klo 4 tehty kirjaus menee edelliselle päivälle.
- **Kahvi / Tee**: yksi painallus tallentaa kellonajan, ja painalluksen voi perua heti. Jokainen kuppi kirjataan omalla painalluksellaan.
- **Neurosonic**: kysyy päivän ja kellonajan (oletuksena nyt), ohjelman ja keston.
  - Palautuminen 22, 36 tai 41 min
  - Aktivointi 12 tai 24 min
  - Rentoutuminen 10, 20, 25 tai 39 min
  - Tehonokoset 10 min
- **Vakiovastaukset**: vapaan tekstikentän sisällön voi tallentaa painikkeella "Tallenna vakiovastaukseksi", minkä jälkeen se näkyy kentän yllä valittavana. Vakiovastauksia hallitaan Asetuksissa.
- **Historia**: kaikki päivät. Vastauksia, kahveja ja muita kirjauksia voi muokata jälkikäteen ja lisätä menneille päiville.
- **Raportit**: sisältää
  - keskiarvot (uniaika, vuoteessaoloaika, unen tehokkuus, nukahtamisviive, laatu, vireys, kahvit, viimeinen kahvi, lääkeyöt, Neurosonic)
  - kuvaajat
  - vertailut (esim. iltapäiväkahvi tai Neurosonic ja seuraavan yön uni)
  - tulostettavan viikkotaulukon PDF:n mallin mukaan.
- **Vienti**: JSON ja CSV (Excel). Lisäksi "Poista kaikki tietoni".

## Tietosuoja

- Firestore sijaitsee alueella `europe-north1` (Suomi).
- Säännöt ([`firestore.rules`](firestore.rules)) sallivat pääsyn vain tileille tkoljonen@gmail.com ja koljonen.pia@gmail.com, ja kukin pääsee vain polkuun `users/{oma uid}`.
- Sovelluksessa ei ole analytiikkaa eikä kolmansien osapuolten skriptejä (Firebase SDK:ta lukuun ottamatta).
- Terveystietoja ei tallenneta localStorageen. Firestoren offline-välimuisti (IndexedDB) pitää kirjaukset tallessa ilman verkkoa.
- `apiKey` (`firebase-config.js`) on Firebasen julkinen web-avain, ei salaisuus.

## Firebase (projekti `unipaivakirja-koljonen`)

- Luotu 30.10.2026: Google-kirjautuminen, sallittu domain `tkoljonen-wq.github.io` ja Firestore (europe-north1).
- Sääntöjen julkaisu: `firebase deploy --only firestore:rules`
- Uuden käyttäjän lisäys: lisää sähköpostiosoite tiedoston `firestore.rules` listaan (ja julkaise säännöt) sekä tiedoston `firebase-config.js` `allowedEmails`-listaan.

## Paikallinen kehitys

```bash
python -m http.server 8080
```

- http://localhost:8080 käyttää Firebasea.
- http://localhost:8080/?local käyttää paikallista testitilaa ilman kirjautumista. Data tallentuu vain selaimeen.

## Asennus Android-puhelimeen

Avaa osoite Chromessa ja paina sovelluksen **Asenna**-painiketta tai valitse ⋮ → **Asenna sovellus**. Jos Chrome väittää sovelluksen olevan jo asennettu, päivitä sivu kahdesti ja sulje välilehti.

## Tiedostot

- `index.html`, `css/style.css`: käyttöliittymä
- `js/app.js`: näkymät, kyselyt ja pikanapit
- `js/questions.js`: kysymykset, lääkkeet ja Neurosonic-ohjelmat
- `js/report.js`: raportit ja vienti
- `js/store.js`: Firestore (ja paikallinen testitila)
- `js/util.js`: päivämäärät ja laskennat
- `sw.js`: service worker (network first, välimuistin etuliite `unipaivakirja-`)
- `manifest.json`, `icons/`: PWA
