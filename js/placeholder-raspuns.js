// PLACEHOLDER PENTRU RASPUNS — contractul unic al semnului de intrebare.
//
// Vezi `documente de referinta/CONTINUARE-contract-semn-intrebare.md`.
//
// ============================ CE E UN PLACEHOLDER ===========================
//
// Placeholderul e LOCUL DIN INTREBARE UNDE SE PUNE UNA DIN CELE 3 VALORI DE PE
// BUTOANELE DE RASPUNS. De obicei semnul e "?", dar quizul poate alege altul.
//
// Definitia asta e criteriul care decide, fara ambiguitate, ce e placeholder si
// ce nu. Exemplu: la "T*/ 11-20 - v4", Subquiz 3, pe ecran sunt doua "?":
//
//     14*5=?     <- placeholder: primeste una din valorile 60 / 80 / 70
//     14*15=?    <- NU e placeholder: e o intrebare viitoare
//
// ============================ DE CE UN CONTRACT =============================
//
// Inainte, semnul era hardcodat in mai multe locuri, cu logici care se
// CONTRAZICEAU: motorul il cauta cu `includes("?")` intr-un loc, il inlocuia pe
// primul in altul si le marca pe TOATE in al treilea. In plus, marcajul din
// jurul lui era scris literal, identic, in trei fisiere, iar doua quizuri
// foloseau alte clase (`q-q`) sau niciuna. Semnul de intrebare ajunsese sa arate
// diferit de la un quiz la altul fara ca cineva sa fi decis asta.
//
// De-aia contractul e OBLIGATORIU si EXPLICIT: fiecare quiz declara `placeholderRaspuns`,
// chiar si cand e exact handlerul generic de mai jos. Fara declaratie, motorul de
// randare arunca eroare — asa un quiz nou nu poate sa "uite", iar divergenta nu
// mai poate intra din neatentie.
//
// ============================ CELE DOUA AXE =================================
//
// Se confunda usor, deci: contractul asta acopera DOAR axa A.
//
//   A. MARCAJUL   — unde e locul care primeste una din cele 3 valori?  <- aici
//   B. REVELAREA  — se arata acolo raspunsul, sau ramane semnul?       <- nu
//
// Un quiz poate avea placeholder si sa aleaga sa nu-l reveleze niciodata (vezi
// formatul `fg-stack`). Asta e politica lui, nu absenta placeholderului.
//
// ============================ CUM SE FOLOSESTE ==============================
//
// Majoritatea quizurilor, care dau motorului un `prompt` text simplu:
//
//     placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?")
//
// Un quiz care isi scrie singur `promptHtml` (tabel, randuri multiple) cheama
// `marcaj()` direct, acolo unde vrea placeholderul:
//
//     `<td>${placeholder.marcaj()}</td>`
//
// Un quiz care are nevoie de ALTA STRUCTURA in jurul semnului (nu de alt semn)
// isi construieste handlerul pornind de la cel generic, si-l suprascrie doar pe
// `marcaj`. Semnul ramane argument; structura ramane treaba quizului.
(function (global) {
  "use strict";

  // Clasa unica pusa pe placeholder, in TOATE quizurile. Consumatori care o
  // cauta: `js/falling-engine.js` (revelarea in loc) si `js/asnw-onboarding.js`
  // (pozitia manutei de onboarding).
  const CLASA = "placeholder-pt-raspuns";

  function creeaza(semn) {
    if (typeof semn !== "string" || semn.length === 0) {
      throw new Error(
        "PlaceholderRaspuns.creeaza: `semn` trebuie sa fie un string nevid (ex. \"?\")."
      );
    }

    const marcaj = `<span class="${CLASA}">${semn}</span>`;

    // `split/join`, nu `replace` cu regex: semnul e dat de quiz si poate fi un
    // caracter special de regex ("?" chiar ESTE unul). Asa nu trebuie escapat
    // nimic si un semn nou nu poate rupe tacit cautarea.
    function inlocuiesteTot(text, cuCe) {
      return String(text ?? "").split(semn).join(cuCe);
    }

    return {
      semn,
      clasa: CLASA,

      // Marcajul gata construit, pentru quizurile care isi scriu singure HTML-ul.
      marcaj: () => marcaj,

      // Are intrebarea asta un placeholder?
      are: (text) => String(text ?? "").includes(semn),

      // Text simplu al intrebarii -> HTML cu placeholderul marcat.
      marcheaza: (text) => inlocuiesteTot(text, marcaj),

      // Placeholderul -> valoarea raspunsului. `cuCe` e fie raspunsul curat
      // (pentru `prompt`, textul de log), fie raspunsul deja invelit in HTML
      // (pentru `promptHtml`). O singura functie serveste ambele.
      inlocuieste: (text, cuCe) => inlocuiesteTot(text, cuCe),
    };
  }

  global.PlaceholderRaspuns = { creeaza, CLASA };
})(window);
