// Catalogul declarativ al unui interval din tabla înmulțirii: a-b × c-d.
// Date, nu logică: fiecare celulă își declară poziția și eticheta.
// Motorul așază rezultatele după `rand`/`coloana`; nu parsează identificatorul.
//
// Grila este POZIȚIONALĂ (necomutativă): 7×3 și 3×7 sunt celule distincte,
// exact ca în vizualizarea aprobată.
//
// Toate domeniile (tabla 1-10, o subtablă, tabla 11-20, interval custom) sunt
// același lucru cu alte argumente: un interval. De aceea există o singură
// funcție, iar domeniile din CP sunt doar preseturi ale ei.

(function (global) {
  "use strict";

  // Pozitia in grila e MEREU 1..N, si cand intervalul nu incepe de la 1:
  // `gridRow`/`gridColumn` numara de la 1, deci un catalog 11-20 care si-ar
  // pune `rand: 11` ar lasa primele 10 randuri goale. Eticheta si `a`/`b`
  // pastreaza valorile reale; doar asezarea se normalizeaza.
  function construiesteCelule({ aMin, aMax, bMin, bMax }) {
    const celule = [];
    for (let a = aMin; a <= aMax; a += 1) {
      for (let b = bMin; b <= bMax; b += 1) {
        celule.push({
          cell_id: `mul:${a}x${b}`,
          a,
          b,
          rand: a - aMin + 1,
          coloana: b - bMin + 1,
          eticheta: `${a} × ${b}`,
          rezultat: a * b,
        });
      }
    }
    return celule;
  }

  function construiesteCatalog({ aMin, aMax, bMin, bMax }) {
    return Object.freeze({
      schema_version: 1,
      catalog_id: `tabla_inmultirii_${aMin}_${aMax}x${bMin}_${bMax}`,
      table_id: `mul:${aMin}-${aMax}x${bMin}-${bMax}`,
      eticheta: `${aMin}-${aMax} × ${bMin}-${bMax}`,
      operatie: "mul",
      randuri: aMax - aMin + 1,
      coloane: bMax - bMin + 1,
      celule: construiesteCelule({ aMin, aMax, bMin, bMax }),
    });
  }

  global.construiesteCatalogInmultire = construiesteCatalog;
})(typeof globalThis !== "undefined" ? globalThis : this);
