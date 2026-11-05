// Kyselyjen kysymykset (Mielenterveystalo.fi: Unettomuuden omahoito-ohjelma, Harjoitus: Unipäiväkirja)
//
// Tyypit: meds (lääke-pikavalinnat), time (kellonaika), duration (minuutit), count (lukumäärä),
// calc (laskettu kesto, jota voi korjata), scale (1–5), choice (yksi vaihtoehto), text (vapaa teksti + vakiovastaukset)

export const MEDS = [
  { key: 'sleepMed', label: 'Otin unilääkkeen', short: 'Unilääke', icon: '💊' },
  { key: 'melatonin', label: 'Otin melatoniinin', short: 'Melatoniini', icon: '🌙' },
];

export const MORNING = [
  { key: 'meds', type: 'meds', title: 'Lääkkeet', help: 'Valitse, jos otit illalla tai yöllä. Lisätiedot eivät ole pakollisia.' },
  { key: 'company', type: 'choice', title: 'Nukuitko yksin vai Timpan kanssa?', options: [
    { val: 'yksin', label: 'Yksin', icon: '🛏️' },
    { val: 'timppa', label: 'Timpan kanssa', icon: '👫' },
  ] },
  { key: 'bedTime', type: 'time', title: 'Vuoteeseenmenoaika', help: 'Mihin aikaan menin nukkumaan?' },
  { key: 'sleepOnset', type: 'time', title: 'Nukahtamisaika', help: 'Mihin aikaan nukahdin ensimmäisen kerran (arvio riittää)? Nukahtamisviive lasketaan tästä.' },
  { key: 'awakenings', type: 'count', title: 'Heräämiskerrat', help: 'Kuinka monta kertaa heräsin kesken unien?' },
  { key: 'nightAwake', type: 'duration', title: 'Valveaika yöllä', help: 'Kuinka kauan olin yhteensä hereillä yön heräämisten aikana? Laske yhteen kaikki valvejaksot ensimmäisen nukahtamisen ja viimeisen heräämisen välillä. Esim. hereillä 1.15–5.30 = 4 h 15 min.', chips: [0, 15, 30, 45, 60, 90, 120, 180, 240, 300] },
  { key: 'wakeTime', type: 'time', title: 'Heräämisaika', help: 'Mihin aikaan heräsin viimeisen kerran? Aika heräämisestä vuoteesta nousuun lasketaan valveajaksi automaattisesti.' },
  { key: 'outOfBed', type: 'time', title: 'Vuoteestanousuaika', help: 'Mihin aikaan nousin ylös sängystä viimeisen kerran?' },
  { key: 'inBed', type: 'calc', calc: 'inBed', title: 'Vuoteessaoloaika', help: 'Kuinka pitkään olin yhteensä vuoteessa yön aikana? Lasketaan vuoteeseenmeno- ja nousuajasta.' },
  { key: 'sleep', type: 'calc', calc: 'sleep', title: 'Uniaika', help: 'Kuinka pitkään nukuin? Vuoteessaoloaika − nukahtamisviive − yön valveaika − aamun valve.' },
  { key: 'quality', type: 'scale', title: 'Yöunen laatu', help: '1 erittäin huono, 5 erittäin hyvä' },
  { key: 'morningNote', type: 'text', title: 'Huomioita yöstä', help: 'Vapaa kenttä, esim. unet, häiriöt, olo herätessä.' },
];

export const EVENING = [
  { key: 'alertness', type: 'scale', title: 'Päivänaikainen vireys', help: '1 erittäin huono, 5 erittäin hyvä' },
  { key: 'dayNotes', type: 'text', title: 'Päivän kulku', help: 'Miten päivä meni?' },
  { key: 'otherNotes', type: 'text', title: 'Muita huomioita', help: 'Esimerkiksi käytetyt harjoitteet, ympäristö, muut vaikuttavat tekijät.' },
];

export const SCALE_LABELS = { 1: 'Erittäin huono', 2: 'Huono', 3: 'Kohtalainen', 4: 'Hyvä', 5: 'Erittäin hyvä' };

// Neurosonic-ohjelmat ja niiden kestot minuutteina
export const NEUROSONIC = [
  { name: 'Palautuminen', minutes: [22, 36, 41] },
  { name: 'Aktivointi', minutes: [12, 24] },
  { name: 'Rentoutuminen', minutes: [10, 20, 25, 39] },
  { name: 'Tehonokoset', minutes: [10] },
];

export const EVENT_TYPES = {
  kahvi: { label: 'Kahvi', icon: '☕' },
  tee: { label: 'Tee', icon: '🍵' },
  neurosonic: { label: 'Neurosonic', icon: '🎧' },
};

// Vakiovastauskenttien nimet asetussivun listaa varten
export const PHRASE_FIELDS = {
  sleepMedName: 'Unilääkkeen nimi',
  sleepMedDose: 'Unilääkkeen annos',
  melatoninName: 'Melatoniinin nimi',
  melatoninDose: 'Melatoniinin annos',
  morningNote: 'Huomioita yöstä',
  dayNotes: 'Päivän kulku',
  otherNotes: 'Muita huomioita',
};
