// Catalogul declarativ al tablei înmulțirii 1-10 × 1-10.
// Date, nu logică: fiecare celulă își declară poziția și eticheta.
// Motorul așază rezultatele după `rand`/`coloana`; nu parsează identificatorul.
//
// Grila este POZIȚIONALĂ (necomutativă): 7×3 și 3×7 sunt celule distincte,
// exact ca în vizualizarea aprobată.

(function (global) {
  "use strict";

  const A_MIN = 1;
  const A_MAX = 10;
  const B_MIN = 1;
  const B_MAX = 10;

  function construiesteCelule() {
    const celule = [];
    for (let a = A_MIN; a <= A_MAX; a += 1) {
      for (let b = B_MIN; b <= B_MAX; b += 1) {
        celule.push({
          cell_id: `mul:${a}x${b}`,
          a,
          b,
          rand: a,
          coloana: b,
          eticheta: `${a} × ${b}`,
          rezultat: a * b,
        });
      }
    }
    return celule;
  }

  const CATALOG_TABLA_INMULTIRII = {
    schema_version: 1,
    catalog_id: "tabla_inmultirii_1_10",
    table_id: "mul:1-10x1-10",
    operatie: "mul",
    randuri: A_MAX - A_MIN + 1,
    coloane: B_MAX - B_MIN + 1,
    celule: construiesteCelule(),
  };

  global.CatalogTablaInmultirii = Object.freeze(CATALOG_TABLA_INMULTIRII);
})(typeof globalThis !== "undefined" ? globalThis : this);
