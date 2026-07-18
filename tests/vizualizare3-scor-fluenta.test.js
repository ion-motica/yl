import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readFileSync } from "node:fs";

const rootDir = "C:/Users/I/Projects/Youlearn.com";

function incarcaMotor() {
  const code = readFileSync(
    `${rootDir}/Vizualizare 3 - Claude/motor-analiza.js`,
    "utf8"
  );
  new Function("globalThis", code)(globalThis);
  return globalThis.MotorAnalizaVizualizare3;
}

afterEach(() => {
  delete globalThis.MotorAnalizaVizualizare3;
});

// Praguri v1 exacte din config-praguri.js (§13), duplicate aici ca literal
// ca testul să nu depindă de citirea altui fișier.
const PRAGURI = {
  interpretare_v1: {
    filtru: {
      viteza_doar_corect_din_prima: true,
      timp_minim_secunde: 0.5,
      timp_maxim_secunde: 15,
      exclude_timpi_extremi_din_precizie: false,
      plancher_impulsivitate_secunde: 0.35,
    },
    corectitudine: { prag_ghicit: 0.45, prag_plin: 0.9 },
    viteza: { secunde_plin: 2.0, secunde_zero: 7.0 },
    incredere: { n_minim_calcul: 15, n_incredere_mare: 50, zile_distincte_incredere_mare: 2 },
    calup: { marimi: [25, 50, 100, 200], implicita: 100 },
  },
};

// Construiește N „întrebări" deja grupate (forma produsă de
// grupeazaApasarilePeIntrebari), corecte-din-prima, cu durata dată,
// împrăștiate pe `zile` zile distincte (round-robin).
function intrebariFact(fact, n, durataSecunde, zile) {
  const rezultat = [];
  for (let i = 0; i < n; i++) {
    const zi = zile[i % zile.length];
    rezultat.push({
      data_ora_ro: `${zi} 10:00:${String(i % 60).padStart(2, "0")}`,
      fact,
      corect_din_prima: true,
      timp_primul_raspuns_secunde: durataSecunde,
    });
  }
  return rezultat;
}

// ---- rampaCrescatoare / rampaDescrescatoare (prin calculeazaScorFact) -----

it("rampa corectitudine: 0 la prag_ghicit, 1 la prag_plin, liniar la mijloc", () => {
  const motor = incarcaMotor();
  const viteza = { n: 10, precizie_prima: 0.45, mediana_timp: 2.0 }; // viteza plina, doar corectitudinea variaza
  assert.equal(motor.calculeazaScorFact(viteza, PRAGURI.interpretare_v1).coef_corectitudine, 0);

  const laPlin = { n: 10, precizie_prima: 0.9, mediana_timp: 2.0 };
  assert.equal(motor.calculeazaScorFact(laPlin, PRAGURI.interpretare_v1).coef_corectitudine, 1);

  // mijlocul intervalului [0.45, 0.9] e 0.675
  const laMijloc = { n: 10, precizie_prima: 0.675, mediana_timp: 2.0 };
  assert.ok(
    Math.abs(motor.calculeazaScorFact(laMijloc, PRAGURI.interpretare_v1).coef_corectitudine - 0.5) < 1e-9
  );

  // sub prag_ghicit -> tot 0 (clamped, nu negativ)
  const subGhicit = { n: 10, precizie_prima: 0.2, mediana_timp: 2.0 };
  assert.equal(motor.calculeazaScorFact(subGhicit, PRAGURI.interpretare_v1).coef_corectitudine, 0);
});

it("rampa viteza: 1 la secunde_plin, 0 la secunde_zero, liniar la mijloc", () => {
  const motor = incarcaMotor();
  const laPlin = { n: 10, precizie_prima: 0.9, mediana_timp: 2.0 };
  assert.equal(motor.calculeazaScorFact(laPlin, PRAGURI.interpretare_v1).coef_viteza, 1);

  const laZero = { n: 10, precizie_prima: 0.9, mediana_timp: 7.0 };
  assert.equal(motor.calculeazaScorFact(laZero, PRAGURI.interpretare_v1).coef_viteza, 0);

  // mijlocul intervalului [2.0, 7.0] e 4.5
  const laMijloc = { n: 10, precizie_prima: 0.9, mediana_timp: 4.5 };
  assert.equal(motor.calculeazaScorFact(laMijloc, PRAGURI.interpretare_v1).coef_viteza, 0.5);

  // peste secunde_zero -> tot 0 (clamped)
  const pesteZero = { n: 10, precizie_prima: 0.9, mediana_timp: 20 };
  assert.equal(motor.calculeazaScorFact(pesteZero, PRAGURI.interpretare_v1).coef_viteza, 0);
});

it("scorul unui fact e produsul rampelor, exemplul din SPECIFICATIE.md §13", () => {
  const motor = incarcaMotor();
  // 80% corecte, mediana 4.0s -> (0.80-0.45)/(0.90-0.45)=0.7778; (7-4)/(7-2)=0.6
  const statistici = { n: 20, precizie_prima: 0.8, mediana_timp: 4.0 };
  const { scor, coef_corectitudine, coef_viteza } = motor.calculeazaScorFact(
    statistici,
    PRAGURI.interpretare_v1
  );
  assert.ok(Math.abs(coef_corectitudine - 0.7778) < 0.001);
  assert.equal(coef_viteza, 0.6);
  assert.ok(Math.abs(scor - 0.4667) < 0.001, `scor asteptat ~0.4667, primit ${scor}`);
});

it("factul netestat (n=0) da scor 0, nu null", () => {
  const motor = incarcaMotor();
  const { scor } = motor.calculeazaScorFact(
    { n: 0, precizie_prima: null, mediana_timp: null },
    PRAGURI.interpretare_v1
  );
  assert.equal(scor, 0);
});

// ---- clasificaIncredereScor -------------------------------------------

it("eticheta de incredere: cele 3 trepte pe n si zile", () => {
  const motor = incarcaMotor();
  const p = PRAGURI.interpretare_v1.incredere;
  assert.equal(motor.clasificaIncredereScor(14, 5, p), "date_insuficiente");
  assert.equal(motor.clasificaIncredereScor(15, 5, p), "incredere_mica");
  assert.equal(motor.clasificaIncredereScor(49, 5, p), "incredere_mica");
  // n suficient dar o singura zi -> plafonat la incredere_mica
  assert.equal(motor.clasificaIncredereScor(80, 1, p), "incredere_mica");
  assert.equal(motor.clasificaIncredereScor(50, 2, p), "incredere_mare");
});

// ---- calculeazaScorFluenta (fereastra x calup) -------------------------

it("scorul ferestrei = media pe TOATE facts din fereastra, netestat=0", () => {
  const motor = incarcaMotor();
  // fact A: 60 raspunsuri corecte (>= n_incredere_mare), 1.5s, pe 3 zile diferite -> fluent (scor 1)
  // fact B: netestat -> scor 0
  const zileA = ["2026-07-12", "2026-07-13", "2026-07-14"];
  const intrebari = intrebariFact("7*8=56", 60, 1.5, zileA);

  const rezultat = motor.calculeazaScorFluenta({
    intrebari,
    celuleFereastra: ["mul:7x8", "mul:7x9"],
    praguri: PRAGURI,
  });

  assert.equal(rezultat.facts_total, 2);
  assert.equal(rezultat.facts_testate, 1);
  assert.equal(rezultat.n_total, 60);
  assert.equal(rezultat.zile_distincte, 3);
  assert.equal(rezultat.eticheta, "incredere_mare");
  // (1.0 + 0) / 2 facts = 0.5
  assert.equal(rezultat.scor, 0.5);
});

it("sub pragul minim de n, eticheta e date_insuficiente si scorul nu se calculeaza (null)", () => {
  const motor = incarcaMotor();
  const intrebari = intrebariFact("7*8=56", 5, 1.5, ["2026-07-12"]);

  const rezultat = motor.calculeazaScorFluenta({
    intrebari,
    celuleFereastra: ["mul:7x8"],
    praguri: PRAGURI,
  });

  assert.equal(rezultat.n_total, 5);
  assert.equal(rezultat.eticheta, "date_insuficiente");
  assert.equal(rezultat.scor, null);
});

it("plancherul de impulsivitate scoate raspunsul si din precizie, nu doar din viteza", () => {
  const motor = incarcaMotor();
  // 4 raspunsuri normale corecte (1.5s) + 1 raspuns "orb" la 0.1s (sub plancherul de 0.35s).
  const intrebari = [
    ...intrebariFact("7*8=56", 4, 1.5, ["2026-07-12"]),
    {
      data_ora_ro: "2026-07-12 10:05:00",
      fact: "7*8=56",
      corect_din_prima: true,
      timp_primul_raspuns_secunde: 0.1,
    },
  ];

  const rezultat = motor.calculeazaScorFluenta({
    intrebari,
    celuleFereastra: ["mul:7x8"],
    praguri: PRAGURI,
  });

  // raspunsul impulsiv nu conteaza -> n_total ramane 4, nu 5.
  assert.equal(rezultat.n_total, 4);
});

it("fara plancher_impulsivitate_secunde in filtru, aplicaFiltre se comporta ca inainte", () => {
  const motor = incarcaMotor();
  const filtruVechi = {
    viteza_doar_corect_din_prima: true,
    timp_minim_secunde: 0.5,
    timp_maxim_secunde: 15,
    exclude_timpi_extremi_din_precizie: false,
  };
  const intrebari = motor.grupeazaApasarilePeIntrebari(
    motor.normalizeaza([
      {
        raspuns_corect: true,
        a_cata_apasare_pe_buton: 1,
        durata_raspuns_secunde: 0.1, // sub 0.5, dar filtrul vechi nu are plancher
      },
    ])
  );
  const { pentruPrecizie, pentruViteza } = motor.aplicaFiltre(
    { curent: intrebari },
    filtruVechi
  );
  // precizia tot include raspunsul (comportament neschimbat); doar viteza il exclude.
  assert.equal(pentruPrecizie.length, 1);
  assert.equal(pentruViteza.length, 0);
});

it("fereastra fara nicio intrebare cunoscuta ramane date_insuficiente, nu arunca eroare", () => {
  const motor = incarcaMotor();
  const rezultat = motor.calculeazaScorFluenta({
    intrebari: [],
    celuleFereastra: ["mul:7x8", "mul:8x8"],
    praguri: PRAGURI,
  });
  assert.equal(rezultat.n_total, 0);
  assert.equal(rezultat.eticheta, "date_insuficiente");
  assert.equal(rezultat.scor, null);
});
