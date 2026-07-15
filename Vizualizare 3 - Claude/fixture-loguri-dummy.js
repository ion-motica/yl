// Loguri sintetice pentru demonstrație și teste repetabile.
// NU sunt jurnalul real al elevului. Reproduc tiparul din vizualizarea aprobată:
// câteva celule în stări diferite, restul netestate.
//
// Fiecare intrare = o apăsare, în același format ca jurnalul real.

(function (global) {
  "use strict";

  let secventa = 0;

  function apasare({ a, b, zi, corect, nrApasare = 1, timp }) {
    secventa += 1;
    const produs = a * b;
    const secunde = String(secventa % 60).padStart(2, "0");
    return {
      data_ora_ro: `2026-07-${zi} 10:${String(Math.floor(secventa / 60) % 60).padStart(2, "0")}:${secunde}`,
      quiz_name: "Fixture demonstrativ",
      subquiz_name: null,
      intrebare: `${a}*${b}=?`,
      raspuns: corect ? String(produs) : "0",
      raspuns_corect: corect,
      a_cata_apasare_pe_buton: nrApasare,
      durata_raspuns_secunde: timp,
      fact: `${a}*${b}=${produs}`,
      quiz_id: "fixture",
      subquiz_id: null,
      fact_id: `mul:${a}*${b}=?`,
      eq_form: `${a}*${b}=?`,
      extra: {},
    };
  }

  // n întrebări corecte din prima, distribuite pe `zile` zile.
  function corecte(a, b, timpi, zile = ["10", "11", "12"]) {
    return timpi.map((timp, i) => apasare({ a, b, zi: zile[i % zile.length], corect: true, timp }));
  }

  // o întrebare greșită din prima, apoi corectată
  function gresitaApoicorect(a, b, zi, timpGresit, timpCorect) {
    return [
      apasare({ a, b, zi, corect: false, nrApasare: 1, timp: timpGresit }),
      apasare({ a, b, zi, corect: true, nrApasare: 2, timp: timpCorect }),
    ];
  }

  function construiesteFixture() {
    return [
      // Fluent: 5×5
      ...corecte(5, 5, [1.2, 1.3, 1.4, 1.5, 1.3, 1.4, 1.2, 1.5]),

      // În consolidare: 3×7, 4×8, 7×3, 7×8 (precizie bună, timp 2-3s)
      ...corecte(3, 7, [2.4, 2.5, 2.6, 2.3, 2.5, 2.4]),
      ...corecte(4, 8, [2.6, 2.7, 2.5, 2.8, 2.6, 2.7]),
      ...corecte(7, 3, [2.3, 2.4, 2.5, 2.2, 2.4]),
      ...gresitaApoicorect(7, 3, "12", 3.5, 5.0),
      ...corecte(7, 8, [2.7, 2.8, 2.6, 2.9, 2.7, 2.8]),

      // În lucru: 6×7, 9×9 (precizie ~0.5)
      ...corecte(6, 7, [2.0, 2.1, 2.0]),
      apasare({ a: 6, b: 7, zi: "10", corect: false, timp: 2.5 }),
      apasare({ a: 6, b: 7, zi: "11", corect: false, timp: 2.6 }),
      apasare({ a: 6, b: 7, zi: "12", corect: false, timp: 2.4 }),
      ...corecte(9, 9, [3.0, 3.1, 3.0]),
      apasare({ a: 9, b: 9, zi: "10", corect: false, timp: 3.5 }),
      apasare({ a: 9, b: 9, zi: "11", corect: false, timp: 3.4 }),
      apasare({ a: 9, b: 9, zi: "12", corect: false, timp: 3.6 }),

      // Date insuficiente: 2×3, 8×9 (prea puține)
      ...corecte(2, 3, [1.0, 1.1], ["10"]),
      ...corecte(8, 9, [3.0, 3.1], ["10"]),
    ];
  }

  global.FixtureLoguriDummyVizualizare3 = Object.freeze({
    construiesteFixture,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
