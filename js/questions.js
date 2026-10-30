// Kyselyjen kysymykset (Mielenterveystalo.fi: Unettomuuden omahoito-ohjelma, Harjoitus: Unipäiväkirja)
//
// Tyypit: meds (lääke-pikavalinnat), time (kellonaika), duration (minuutit), count (lukumäärä),
// calc (laskettu kesto, jota voi korjata), scale (1–5), text (vapaa teksti + vakiovastaukset)

export const MEDS = [
  { key: 'sleepMed', label: 'Otin unilääkkeen', short: 'Unilääke', icon: '💊' },
  { key: 'melatonin', label: 'Otin melatoniinin', short: 'Melatoniini', icon: '🌙' },
];

export const MORNING = [
  { key: 'meds', type: 'meds', title: 'Lääkkeet', help: 'Valitse, jos otit illalla tai yöllä. Lisätiedot eivät ole pakollisia.' },
  { key: 'bedTime', type: 'time', title: 'Vuoteeseenmenoaika', help: 'Mihin aikaan menin nukkumaan?' },
  { key: 'latency', type: 'duration', title: 'Nukahtamisviive', help: 'Kuinka kauan minulla kesti nukahtaa?', chips: [5, 10, 15, 20, 30, 45, 60, 90] },
  { key: 'awakenings', type: 'count', title: 'Heräämiskerrat', help: 'Kuinka monta kertaa heräsin kesken unien?' },
  { key: 'wakeTime', type: 'time', title: 'Heräämisaika', help: 'Mihin aikaan heräsin viimeisen kerran?' },
  { key: 'wakeAwake', type: 'duration', title: 'Valveaika', help: 'Kuinka kauan olin hereillä nukahtamisen ja viimeiseen vuoteesta nousun välillä?', chips: [0, 10, 15, 30, 45, 60, 90, 120] },
  { key: 'outOfBed', type: 'time', title: 'Vuoteestanousuaika', help: 'Mihin aikaan nousin ylös sängystä viimeisen kerran?' },
  { key: 'inBed', type: 'calc', calc: 'inBed', title: 'Vuoteessaoloaika', help: 'Kuinka pitkään olin yhteensä vuoteessa yön aikana? Lasketaan vuoteeseenmeno- ja nousuajasta.' },
  { key: 'sleep', type: 'calc', calc: 'sleep', title: 'Uniaika', help: 'Kuinka pitkään nukuin? Vuoteessaoloaika − nukahtamisviive − valveaika.' },
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
