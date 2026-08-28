// Loguri sintetice pentru demonstrație și teste repetabile.
// NU sunt jurnalul real al elevului, dar au exact forma lui (aceleași câmpuri).
//
// Generează 8 săptămâni de exersare pe tabla 1-20 × 1-20, cu o progresie
// DETERMINISTĂ: niciun `Math.random()`, deci același fixture la fiecare rulare.
// Totul derivă din perechea (a, b) prin regulile de mai jos.
//
// Povestea din spate, într-o singură frază: elevul învață tabla în ordinea
// dificultății, iar fiecare fact se așază încet — timpul scade, precizia urcă —
// dar cu cât e mai greu, cu atât e introdus mai târziu, are mai puține întâlniri
// și se oprește mai departe de fluență.
//
// Toate reglajele sunt în `DIFICULTATE_OPERAND` și `MODEL`. A schimba tiparul
// grilei = a schimba cifre acolo, fără cod nou.

(function (global) {
  "use strict";

  const REGLAJE = {
    interval: { aMin: 1, aMax: 20, bMin: 1, bMax: 20 },
    saptamani: 8,
    zile_de_exersare_pe_saptamana: 5,
    data_start: "2026-05-25", // o zi de luni
    // Câte întâlniri primește un fact pe fiecare zi rămasă de la introducerea
    // lui. De aici iese și volumul total (~7500 de apăsări).
    intalniri_pe_zi_de_exersare: 0.65,
    // Ora la care începe exersarea și distanța dintre două întrebări.
    ora_start: 10,
    secunde_intre_intrebari: 20,
  };

  // Cât de greu e un operand, de la 0 (banal) la 1 (greu). Tabelul e sursa
  // tiparului din grilă: ×1 și ×10 sunt gratis, ×17 doare. Aici jonglezi.
  const DIFICULTATE_OPERAND = {
    1: 0.0, 2: 0.08, 3: 0.22, 4: 0.3, 5: 0.12,
    6: 0.45, 7: 0.6, 8: 0.55, 9: 0.38, 10: 0.0,
    11: 0.18, 12: 0.42, 13: 0.7, 14: 0.66, 15: 0.35,
    16: 0.72, 17: 0.85, 18: 0.74, 19: 0.62, 20: 0.05,
  };

  // Grila e POZIȚIONALĂ: 7×3 și 3×7 sunt celule diferite și nu se învață la fel,
  // fiindcă se exersează pe tabla primului operand. De-aia primul cântărește mai
  // mult — altfel grila ar ieși perfect simetrică pe diagonală, ceea ce la un
  // elev real nu se întâmplă.
  const PONDERE_PRIM_OPERAND = 0.6;

  // Un pătrat (7×7, 13×13) se ține minte mai ușor decât un produs mixt la fel de mare.
  const USURARE_PATRAT = 0.15;

  // Capetele modelului: valoarea pentru un fact banal și cea pentru unul greu.
  // Între ele se interpolează liniar după dificultate.
  // ATENȚIE la reglat: pragurile din `config-praguri.js` se aplică pe MEDIA
  // întregului istoric, nu pe ultima zi. Un fact care azi răspunde în 1,5s dar
  // a început de la 5s are mediana pe 8 săptămâni undeva la mijloc. Deci ca să
  // iasă o stare bună nu e destul ca asimptota să treacă pragul — trebuie ca
  // media drumului să-l treacă. De-aia capetele de mai jos par „prea generoase".
  const MODEL = {
    // Secunde la prima întâlnire și secundele spre care tinde.
    timp_initial: { usor: 2.4, greu: 6.5 },
    // PRAGUL DE FLUENȚĂ E 2,0s: tot ce tinde peste el nu devine fluent niciodată,
    // oricât ar exersa. De aici „nu ajung toți acolo".
    timp_final: { usor: 0.85, greu: 3.2 },
    // Precizia la prima întâlnire și cea spre care tinde (pragul de fluență e 0,90).
    precizie_initiala: { usor: 0.93, greu: 0.52 },
    precizie_finala: { usor: 1.0, greu: 0.86 },
    // După câte întâlniri se apropie de asimptotă. De aici „nu progresează
    // toți în același ritm".
    ritm: { usor: 3.5, greu: 9 },
    // A câta zi de exersare îl întâlnește prima oară. Cu cât mai târziu, cu atât
    // mai puține întâlniri îi rămân — o singură regulă produce și tiparul de
    // introducere, și volumul. Cele mai grele rămân sub 5 întâlniri, deci ies
    // „abia început": în 8 săptămâni pur și simplu nu s-a ajuns la ele.
    zi_introducere: { usor: 0, greu: 38 },
    // Introducerea NU merge liniar cu dificultatea: elevul lucrează devreme pe
    // aproape toată tabla, iar doar coada grea rămâne pe final. `1` = liniar
    // (introducere târzie și pentru facts mijlocii, care rămân apoi fără date);
    // mai mare = tot mai mulți introduși devreme. Ăsta e reglajul care decide
    // cât din tablă apucă să progreseze.
    curba_introducere: 2,
  };

  // Cât durează o greșeală și corectarea ei, față de timpul normal al factului.
  const FACTOR_TIMP_GRESIT = 1.4;
  const FACTOR_TIMP_CORECTARE = 1.8;

  const zileTotale = REGLAJE.saptamani * REGLAJE.zile_de_exersare_pe_saptamana;

  // ---- regulile deterministe -------------------------------------------

  function dificultateBruta(a, b) {
    const medie =
      DIFICULTATE_OPERAND[a] * PONDERE_PRIM_OPERAND +
      DIFICULTATE_OPERAND[b] * (1 - PONDERE_PRIM_OPERAND);
    const usurare = a === b ? USURARE_PATRAT : 0;
    return Math.max(0, medie - usurare);
  }

  // Dificultățile brute nu ating capetele 0 și 1 de la sine (cel mai greu fact
  // din tabla 1-20 iese pe la 0,8), deci capetele din `MODEL` n-ar fi atinse
  // niciodată. Le întindem pe tot intervalul: 0 = cel mai ușor fact din tablă,
  // 1 = cel mai greu. Așa „ușor"/„greu" din `MODEL` înseamnă exact ce spun,
  // orice cifre ai pune în `DIFICULTATE_OPERAND`.
  function calculeazaDificultati({ aMin, aMax, bMin, bMax }) {
    const brute = new Map();
    for (let a = aMin; a <= aMax; a += 1) {
      for (let b = bMin; b <= bMax; b += 1) {
        brute.set(`${a}x${b}`, dificultateBruta(a, b));
      }
    }
    const valori = [...brute.values()];
    const minim = Math.min(...valori);
    const intindere = Math.max(...valori) - minim;
    const normalizate = new Map();
    brute.forEach((bruta, cheie) => {
      normalizate.set(cheie, intindere === 0 ? 0 : (bruta - minim) / intindere);
    });
    return normalizate;
  }

  function dupaDificultate(capete, d) {
    return capete.usor + (capete.greu - capete.usor) * d;
  }

  // Curba de învățare: pornește de la `initial` și tinde spre `final`, tot mai
  // încet, cu cât întâlnirea `k` e mai târzie. `ritm` spune cât de repede.
  function spreAsimptota(initial, final, k, ritm) {
    return final + (initial - final) * Math.exp(-k / ritm);
  }

  function timpLaIntalnire(d, k) {
    return spreAsimptota(
      dupaDificultate(MODEL.timp_initial, d),
      dupaDificultate(MODEL.timp_final, d),
      k,
      dupaDificultate(MODEL.ritm, d)
    );
  }

  function precizieLaIntalnire(d, k) {
    return spreAsimptota(
      dupaDificultate(MODEL.precizie_initiala, d),
      dupaDificultate(MODEL.precizie_finala, d),
      k,
      dupaDificultate(MODEL.ritm, d)
    );
  }

  // ---- planul de exersare ----------------------------------------------

  // Un fact introdus în ziua Z primește întâlniri doar din zilele rămase, iar
  // ele se împrăștie uniform peste ele. De-aia facts grei au și mai puține
  // întâlniri, și mai puține zile distincte.
  function planificaIntalniri(a, b, d) {
    const ziIntroducere = Math.round(
      dupaDificultate(MODEL.zi_introducere, Math.pow(d, MODEL.curba_introducere))
    );
    const zileRamase = zileTotale - ziIntroducere;
    const cate = Math.max(1, Math.round(zileRamase * REGLAJE.intalniri_pe_zi_de_exersare));
    return Array.from({ length: cate }, (_, k) => ({
      a,
      b,
      k,
      dificultate: d,
      zi: ziIntroducere + Math.floor((k * zileRamase) / cate),
    }));
  }

  // ---- corect sau greșit, fără Math.random -----------------------------

  // Acumulăm precizia și dăm un răspuns corect de fiecare dată când acumulatorul
  // trece de 1 (același principiu ca la trasarea unei linii pe o grilă de
  // pixeli). Iese exact proporția cerută, cu greșelile împrăștiate uniform, și
  // același rezultat la fiecare rulare.
  function creeazaJudecator() {
    let acumulat = 0;
    return function esteCorect(precizie) {
      acumulat += precizie;
      if (acumulat >= 1) {
        acumulat -= 1;
        return true;
      }
      return false;
    };
  }

  // ---- calendarul -------------------------------------------------------

  function doua(numar) {
    return String(numar).padStart(2, "0");
  }

  // Ziua `index` de exersare, sărind weekendurile: 5 zile lucrate, apoi 2 libere.
  function dataZilei(index) {
    const start = new Date(`${REGLAJE.data_start}T00:00:00Z`);
    const saptamana = Math.floor(index / REGLAJE.zile_de_exersare_pe_saptamana);
    const ziDinSaptamana = index % REGLAJE.zile_de_exersare_pe_saptamana;
    const zi = new Date(start.getTime() + (saptamana * 7 + ziDinSaptamana) * 86400000);
    return `${zi.getUTCFullYear()}-${doua(zi.getUTCMonth() + 1)}-${doua(zi.getUTCDate())}`;
  }

  function ceasul(alCataIntrebareInZi) {
    const total =
      REGLAJE.ora_start * 3600 + alCataIntrebareInZi * REGLAJE.secunde_intre_intrebari;
    return `${doua(Math.floor(total / 3600))}:${doua(Math.floor(total / 60) % 60)}:${doua(total % 60)}`;
  }

  // ---- o apăsare, în formatul jurnalului real ---------------------------

  function apasare({ a, b, dataOra, corect, nrApasare, timp }) {
    const produs = a * b;
    const gresit = String(produs + (produs % 10 === 0 ? 2 : 1));
    return {
      data_ora_ro: dataOra,
      quiz_name: "Fixture demonstrativ 1-20",
      subquiz_name: null,
      intrebare: `${a}*${b}=?`,
      raspuns: corect ? String(produs) : gresit,
      a_raspuns_corect: corect,
      al_catelea_turn_apasare_pe_buton: nrApasare,
      durata_raspuns_secunde: Math.round(timp * 10) / 10,
      fact: `${a}*${b}=${produs}`,
      quiz_id: "fixture-1-20",
      subquiz_id: null,
      fact_id: `mul:${a}*${b}=?`,
      eq_form: `${a}*${b}=?`,
      pozitie_buton_apasat_pt_raspuns: null,
      valori_variante_de_raspuns: null,
      valoare_raspuns_corect: String(produs),
      hints_aratate_pt_raspuns: null,
      extra: {},
    };
  }

  // ---- fluxul ------------------------------------------------------------

  function construiesteFixture() {
    const { aMin, aMax, bMin, bMax } = REGLAJE.interval;

    // 1. Cât de greu e fiecare fact, raportat la restul tablei.
    const dificultati = calculeazaDificultati(REGLAJE.interval);

    // 2. Planifică: fiecare fact își cere întâlnirile lui.
    const intalniri = [];
    const judecatori = new Map();
    for (let a = aMin; a <= aMax; a += 1) {
      for (let b = bMin; b <= bMax; b += 1) {
        judecatori.set(`${a}x${b}`, creeazaJudecator());
        intalniri.push(...planificaIntalniri(a, b, dificultati.get(`${a}x${b}`)));
      }
    }

    // 3. Așază-le în ordine cronologică. Jurnalul real e citit în ordinea
    //    salvării, deci fixture-ul trebuie să vină la fel.
    intalniri.sort((x, y) => x.zi - y.zi || x.a - y.a || x.b - y.b);

    // 4. Emite apăsările. O greșeală = o apăsare greșită, apoi corectarea.
    const apasari = [];
    let ziCurenta = -1;
    let alCataInZi = 0;
    intalniri.forEach(({ a, b, k, dificultate: d, zi }) => {
      if (zi !== ziCurenta) {
        ziCurenta = zi;
        alCataInZi = 0;
      }
      const dataOra = `${dataZilei(zi)} ${ceasul(alCataInZi)}`;
      alCataInZi += 1;

      const timp = timpLaIntalnire(d, k);
      const corect = judecatori.get(`${a}x${b}`)(precizieLaIntalnire(d, k));
      if (corect) {
        apasari.push(apasare({ a, b, dataOra, corect: true, nrApasare: 1, timp }));
      } else {
        apasari.push(
          apasare({ a, b, dataOra, corect: false, nrApasare: 1, timp: timp * FACTOR_TIMP_GRESIT })
        );
        apasari.push(
          apasare({ a, b, dataOra, corect: true, nrApasare: 2, timp: timp * FACTOR_TIMP_CORECTARE })
        );
      }
    });

    return apasari;
  }

  global.FixtureLoguriDummyVizualizare3 = Object.freeze({
    construiesteFixture,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
