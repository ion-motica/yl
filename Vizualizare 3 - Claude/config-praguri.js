// Praguri și filtre pentru „Vizualizare 3 - Claude".
// TOATE valorile de aici sunt PROVIZORII și de calibrat pe date reale.
// Se ajustează direct în acest fișier, fără atingerea logicii motorului.
// Versionat: când schimbi praguri pentru un raport oficial, crește `praguri_version`.

(function (global) {
  "use strict";

  const CONFIG_PRAGURI = {
    praguri_version: 1,

    // Filtru standard v1: ce intră în calculul vitezei/preciziei.
    // Datele brute NU se modifică; excluderea e doar în analiză.
    filtru_standard_v1: {
      // Viteza se măsoară doar pe răspunsuri corecte din prima apăsare.
      viteza_doar_corect_din_prima: true,
      // Timpi în afara intervalului [min, max] sunt excluși din calculul vitezei:
      // sub min = apăsare probabil accidentală; peste max = pauză probabilă.
      timp_minim_secunde: 0.5,
      timp_maxim_secunde: 15,
      // Deocamdată precizia folosește toate primele apăsări (timpii nu o filtrează).
      // Comută pe true dacă vrei ca timpii extremi să excludă și din precizie.
      exclude_timpi_extremi_din_precizie: false,
    },

    // Clasificarea stării curente: precizie ȘI viteză împreună.
    // Progresia etichetelor: netestat -> abia_inceput -> nu_il_stie -> in_lucru -> fluent
    stare: {
      // Sub acest volum, sau sub numărul minim de zile distincte, verdictul e
      // „abia început", nu o stare fermă (protecție la eșantion mic).
      n_minim: 5,
      zile_distincte_minim: 2,
      // Ordinea contează: se verifică întâi „fluent", apoi „în lucru".
      fluent: { precizie_minima: 0.9, mediana_maxima_secunde: 2.0 },
      in_lucru: { precizie_minima: 0.8, mediana_maxima_secunde: 4.0 },
      // Orice e testat destul dar sub „în lucru" = „nu îl știe".
    },
  };

  global.ConfigPraguriVizualizare3 = Object.freeze(CONFIG_PRAGURI);
})(typeof globalThis !== "undefined" ? globalThis : this);
