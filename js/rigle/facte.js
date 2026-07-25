/**
 * Generator de facte pentru „Cl. 1 - Rigle" — pur, fără DOM, fără `LayoutConfig`,
 * fără să știe de quiz sau motor.
 *
 *   window.RigleFacte.genereazaFact({ sumaMin, sumaMax }) → fact
 *   window.RigleFacte.alegeVariante(suma) → { latimiColoane, indexCorect }
 *
 * Vezi `js/rigle/PLAN-etapa2-variatie-facte.md` §4 pentru algoritm și motivația
 * fiecărui pas (fezabilitatea pozițiilor, de ce nu se alege poziția prin reîncercare).
 */
(function (global) {
  "use strict";

  // Fereastra de distractori creste liniar cu suma: ±3 la suma=3, ±10 la suma=30
  // (mai greu de ghicit din interval pe măsură ce copilul avansează).
  const DELTA_LA_SUMA_MICA = 3;
  const DELTA_LA_SUMA_MARE = 10;
  const SUMA_MICA = 3;
  const SUMA_MARE = 30;
  const NR_VARIANTE = 3; // 3 coloane
  const LATIME_MIN_COLOANA = 1; // o coloană nu poate avea 0 pătrățele
  const LATIME_MAX_COLOANA = Infinity; // limita 1-30 e pe sumă, nu pe lățimea coloanei (plan §3)
  const SUMA_MIN_ABSOLUTA = 2; // a,b >= 1 (decizia 2a)
  const SUMA_MAX_ABSOLUTA = 30;

  function clamp(valoare, min, max) {
    return Math.min(max, Math.max(min, valoare));
  }

  // Interpolare liniară între (SUMA_MICA, DELTA_LA_SUMA_MICA) și (SUMA_MARE, DELTA_LA_SUMA_MARE).
  function deltaVariante(suma) {
    const panta = (DELTA_LA_SUMA_MARE - DELTA_LA_SUMA_MICA) / (SUMA_MARE - SUMA_MICA);
    return Math.round(DELTA_LA_SUMA_MICA + panta * (suma - SUMA_MICA));
  }

  function intregAleator(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // Alege `n` elemente distincte, aleatoare, dintr-un tablou de întregi (fără repunere).
  function subsetAleator(sursa, n) {
    const disponibile = sursa.slice();
    const rezultat = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * disponibile.length);
      rezultat.push(disponibile.splice(idx, 1)[0]);
    }
    return rezultat;
  }

  /**
   * Alege 3 lățimi de coloană pentru `suma`: una e exact `suma`, celelalte două sunt
   * distractori aleatori din `[suma-delta, suma+delta]` (fără `suma` însăși), cu
   * `delta = deltaVariante(suma)` — creşte liniar de la 3 la 10. Poziția coloanei
   * corecte, după sortarea crescătoare, variază aleator între cele fezabile —
   * la sume mici lângă capătul de jos (suma=2), nu toate cele 3 poziții sunt posibile
   * matematic (nu există lățime 0 sau negativă), vezi plan §3.
   */
  function alegeVariante(suma) {
    const delta = deltaVariante(suma);
    const jos = [];
    for (let v = Math.max(LATIME_MIN_COLOANA, suma - delta); v <= suma - 1; v++) {
      jos.push(v);
    }
    const susMax = Math.min(LATIME_MAX_COLOANA, suma + delta);
    const sus = [];
    for (let v = suma + 1; v <= susMax; v++) {
      sus.push(v);
    }

    const pozitiiFezabile = [];
    for (let p = 0; p < NR_VARIANTE; p++) {
      const nJos = p;
      const nSus = NR_VARIANTE - 1 - p;
      if (jos.length >= nJos && sus.length >= nSus) pozitiiFezabile.push(p);
    }

    const p = pozitiiFezabile[Math.floor(Math.random() * pozitiiFezabile.length)];
    const nJos = p;
    const nSus = NR_VARIANTE - 1 - p;

    const distractoriJos = subsetAleator(jos, nJos);
    const distractoriSus = subsetAleator(sus, nSus);

    const latimiColoane = [...distractoriJos, suma, ...distractoriSus].sort((a, b) => a - b);
    const indexCorect = latimiColoane.indexOf(suma);

    return { latimiColoane, indexCorect };
  }

  /**
   * Generează un fact `a+b=suma`, cu `suma` aleatoare în `[sumaMin, sumaMax]` (clamp
   * la `[2, 30]`), plus variantele de coloană pentru `suma`. Vezi plan §4.5.
   */
  function genereazaFact({ sumaMin = SUMA_MIN_ABSOLUTA, sumaMax = SUMA_MAX_ABSOLUTA } = {}) {
    let min = clamp(sumaMin, SUMA_MIN_ABSOLUTA, SUMA_MAX_ABSOLUTA);
    let max = clamp(sumaMax, SUMA_MIN_ABSOLUTA, SUMA_MAX_ABSOLUTA);
    if (min > max) max = min;

    const suma = intregAleator(min, max);
    const a = intregAleator(1, suma - 1);
    const b = suma - a;
    const { latimiColoane, indexCorect } = alegeVariante(suma);

    return {
      a,
      b,
      suma,
      intrebare: `${a}+${b}=?`,
      grupe: [
        { n: a, fundal: "rosu" },
        { n: b, fundal: "albastru" },
      ],
      latimiColoane,
      indexCorect,
    };
  }

  global.RigleFacte = { genereazaFact, alegeVariante };
})(window);
