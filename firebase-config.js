// Firebase-projektin asetukset (Firebase-konsoli: Project settings → General → Your apps → unipaivakirja-web).
// apiKey ei ole salaisuus – tietoturva hoidetaan Firestoren säännöillä, ks. firestore.rules.

export const firebaseConfig = {
  apiKey: "AIzaSyCWtuYIF59MGJId56PPEP_hZRwQRh6U1Qg",
  authDomain: "unipaivakirja-koljonen.firebaseapp.com",
  projectId: "unipaivakirja-koljonen",
  storageBucket: "unipaivakirja-koljonen.firebasestorage.app",
  messagingSenderId: "848053030001",
  appId: "1:848053030001:web:09789f1a4dcc0b8ce71fd0"
};

// Sovellusta saavat käyttää vain nämä Google-tilit. Sama lista on firestore.rules-tiedostossa,
// joka on varsinainen suojaus – lisää uusi tili molempiin.
export const allowedEmails = ['tkoljonen@gmail.com', 'koljonen.pia@gmail.com'];
