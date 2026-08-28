// SCHIMBAREA DE NIVEL — contractul unic, comun tuturor quizurilor.
//
// Vezi `documente de referinta/RAPORT-motor-comun-raspuns.md`.
//
// ============================ DE CE EXISTA ==================================
//
// Inainte de 28.08.2026, avansul de nivel era reimplementat separat in 17
// fisiere de quiz: fiecare isi scria propriul text de banner, propriul
// `runDelayMs`, propriul moment de `level++`. Motorul doar citea campurile
// primite (`levelAdvanced`, `banner`, pasul urmator), fara nicio forma comuna
// impusa — spre deosebire de `Motor3Butoane`, care verifica o semnatura.
//
// De-acolo veneau bug-uri repetate, cu acelasi simptom (ecran inghetat pe
// intrebarea veche, raspunsuri corecte marcate gresit, avans "fantoma") si
// cauze tehnice mereu altele. Vezi "Bug-uri de tranzitie de rutare"
// (21.08.2026) si regresia din 28.08.2026 in acelasi raport.
//
// ============================ CE FACE STANDARDUL ============================
//
// Decis de user (28.08.2026):
//
//   1. La nivel nou: se afiseaza "Felicitări! Nivelul următor!", care DISPARE
//      singur dupa ~3,5 secunde.
//   2. Mesajul NU intrerupe fluxul: intrebarea din nivelul nou apare IMEDIAT
//      (pauza 0), iar copilul poate raspunde la ea cat timp mesajul e inca pe
//      ecran. Inainte era o pauza de 1400ms cu butoanele moarte.
//   3. La ultimul nivel: "Felicitări, ai parcurs ultimul nivel!" ramane pe
//      ecran PERMANENT — dispare doar la schimbarea quizului sau la o
//      schimbare manuala de nivel din meniu.
//
// ============================ CUM SE FOLOSESTE ==============================
//
// Fiecare quiz care avanseaza niveluri declara, in obiectul returnat de
// `create()`:
//
//     laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
//
// Fara declaratie, motorul opreste avansul de nivel cu o eroare explicita —
// acelasi tipar ca la `placeholderRaspuns` (js/placeholder-raspuns.js).
//
// Daca un quiz vrea altceva, trece argumente peste valorile implicite:
//
//     laSchimbareDeNivel: global.SchimbareDeNivel.standard({
//       textNivelNou: "Bravo! Mergem mai departe!",
//       durataMesajMs: 5000,
//     }),
//
// Valorile implicite stau in constantele de mai jos, intr-un singur loc, usor
// de schimbat pentru toata aplicatia deodata.
(function (global) {
  "use strict";

  // ——— Valorile implicite. Se schimba AICI, o singura data, pentru tot. ———
  const TEXT_NIVEL_NOU = "Felicitări! Nivelul următor!";
  const TEXT_ULTIMUL_NIVEL = "Felicitări, ai parcurs ultimul nivel!";
  // Cat sta mesajul de nivel nou pe ecran inainte sa dispara singur.
  const DURATA_MESAJ_MS = 3500;
  // Cat asteapta motorul inainte sa afiseze intrebarea din nivelul nou.
  // 0 = fluxul nu se intrerupe deloc (cerinta userului). Inainte era 1400.
  const PAUZA_INAINTE_DE_RUNDA_URMATOARE_MS = 0;

  function standard(optiuni = {}) {
    return {
      textNivelNou: optiuni.textNivelNou ?? TEXT_NIVEL_NOU,
      textUltimulNivel: optiuni.textUltimulNivel ?? TEXT_ULTIMUL_NIVEL,
      durataMesajMs: optiuni.durataMesajMs ?? DURATA_MESAJ_MS,
      pauzaInainteDeRundaUrmatoareMs:
        optiuni.pauzaInainteDeRundaUrmatoareMs ?? PAUZA_INAINTE_DE_RUNDA_URMATOARE_MS,
    };
  }

  global.SchimbareDeNivel = {
    standard,
    TEXT_NIVEL_NOU,
    TEXT_ULTIMUL_NIVEL,
    DURATA_MESAJ_MS,
    PAUZA_INAINTE_DE_RUNDA_URMATOARE_MS,
  };
})(window);
