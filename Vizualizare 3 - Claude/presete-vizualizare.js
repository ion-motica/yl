// Preseturile — P-ul din MABP. Date, nu logică.
//
// Un preset spune DOAR ce valoare are fiecare control. Nu știe ce înseamnă ele
// și nu apelează nimic: le pune, iar codul care ascultă controalele își face
// treaba lui, exact ca atunci când ai da click tu. De-aia un preset nou nu cere
// cod nou — doar un obiect în array.
//
// `subsectiune` spune în ce subsecție din CP apare butonul (vezi `subsectiuni`
// din definitii-axe.js). Cheile din `controale` sunt numele stabile ale
// controalelor (`data-preset`).
// Valorile: `true`/`false` la bife, `true` = apasă la butoane, număr la slidere.
// Ordinea cheilor contează: `folii_active` deschide controalele foliilor, deci
// vine înaintea lor.
//
// Ce nu recunoaște CP-ul se ignoră în tăcere, ca un preset vechi să nu strice
// pagina după ce se redenumește un control.

(function (global) {
  "use strict";

  const PRESETE = [
    {
      id: "vertical_simplu",
      nume: "Preset 1 - vertical simplu",
      // Presetul configurează opțiunile Grilei; alegerea reprezentării (radio-ul
      // „Grila X × Y stare") e în afara subsecției, deci nu o atinge.
      subsectiune: "grila_optiuni",
      controale: {
        compozitie_fact: true,
        compozitie_eticheta: true,
        compozitie_patratele: true,
        compozitie_numere: false,
        compozitie_umple: true,

        folii_active: true,
        glisare_aleatoare: false,
        reasezare_aleatoare: false,
        grupare_intermediara: false,
        titluri_2_randuri: true,
        titluri_incadrate: true,
        casete_colorate: true,

        aranjament_vertical: true,
        aliniere_verticala_mijloc: true,
        aliniere_orizontala_centru: true,

        folii_dimensiune: 382,
        folii_viteza: 1500,
        folii_auto: 0,
      },
    },
  ];

  global.PreseteVizualizare3 = Object.freeze(PRESETE);
})(typeof globalThis !== "undefined" ? globalThis : this);
