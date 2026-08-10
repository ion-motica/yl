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

// Praguri exacte din config-praguri.js, duplicate ca literal — fișierele de test
// sunt standalone (vezi tests/vizualizare3-tabel-fluenta.test.js).
// Rândurile de stări au nevoie de `filtru_standard_v1` + `stare` (aceleași ca
// grila 10×10); `interpretare_v1` e cerut de restul builderului de tabel.
const PRAGURI = {
  filtru_standard_v1: {
    viteza_doar_corect_din_prima: true,
    timp_minim_secunde: 0.5,
    timp_maxim_secunde: 15,
    exclude_timpi_extremi_din_precizie: false,
  },
  stare: {
    n_minim: 5,
    zile_distincte_minim: 2,
    fluent: { precizie_minima: 0.9, mediana_maxima_secunde: 2.0 },
    in_lucru: { precizie_minima: 0.8, mediana_maxima_secunde: 4.0 },
  },
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
  },
};

// Apăsări BRUTE, toate în ACEEAȘI zi — o coloană = o zi calendaristică, deci
// fixture-ul se construiește în blocuri contigue de zi, nu alternat.
function apasariIntrOZi(fact, n, durataSecunde, zi) {
  const rezultat = [];
  for (let i = 0; i < n; i++) {
    rezultat.push({
      data_ora_ro: `${zi} 10:00:${String(i % 60).padStart(2, "0")}`,
      fact,
      a_raspuns_corect: true,
      a_cata_apasare_pe_buton: 1,
      durata_raspuns_secunde: durataSecunde,
    });
  }
  return rezultat;
}

const CATALOG = {
  eticheta: "12-13 × 1-2",
  celule: [
    { cell_id: "mul:12x1", a: 12 },
    { cell_id: "mul:12x2", a: 12 },
    { cell_id: "mul:13x1", a: 13 },
    { cell_id: "mul:13x2", a: 13 },
  ],
};

// Fixture cu adancime=6, gândit ca fiecare coloană să prindă câte un caz:
// 01.07  3× 12*1 @1,5s  -> 12*1 are n=3 (<5) => abia_inceput
// 02.07  3× 12*1 @1,5s  -> n=6, 2 zile, mediana 1,5s => URCĂ la fluent
// 03.07  3× 12*1 @6,0s  -> fereastra = 3×1,5s + 3×6,0s, mediana 3,75s => CADE la in_lucru
// 04.07  5× 13*1 @6,0s  -> 13*1 n=5 dar 1 zi => abia_inceput (urcare din netestat)
// 05.07  5× 13*1 @6,0s  -> fereastra 6 răsp., 2 zile, mediana 6,0s => URCĂ la nu_il_stie
function construiesteFixture() {
  return [
    ...apasariIntrOZi("12*1=12", 3, 1.5, "2026-07-01"),
    ...apasariIntrOZi("12*1=12", 3, 1.5, "2026-07-02"),
    ...apasariIntrOZi("12*1=12", 3, 6.0, "2026-07-03"),
    ...apasariIntrOZi("13*1=13", 5, 6.0, "2026-07-04"),
    ...apasariIntrOZi("13*1=13", 5, 6.0, "2026-07-05"),
  ];
}

function model(inregistrari, adancime = 6) {
  return incarcaMotor().construiesteModelTabelFluenta({
    inregistrari,
    catalog: CATALOG,
    adancime,
    praguri: PRAGURI,
  });
}

it("fără date: stari_pe_momente e gol", () => {
  assert.deepEqual(model([]).stari_pe_momente, []);
});

it("o coloană per zi, aliniată cu antetele", () => {
  const m = model(construiesteFixture());
  assert.equal(m.stari_pe_momente.length, 5);
  assert.equal(m.stari_pe_momente.length, m.antete.length);
});

it("suma pe fiecare coloană = numărul de facts din catalog", () => {
  const m = model(construiesteFixture());
  m.stari_pe_momente.forEach((coloana, idx) => {
    const total = Object.values(coloana.contor).reduce((a, b) => a + b, 0);
    assert.equal(total, CATALOG.celule.length, `coloana ${idx}`);
  });
});

it("prima coloană nu are nicio sosire (n-are cu ce compara)", () => {
  const m = model(construiesteFixture());
  assert.deepEqual(m.stari_pe_momente[0].sosiri_prin_urcare, {
    abia_inceput: 0,
    nu_il_stie: 0,
    in_lucru: 0,
    fluent: 0,
  });
});

it("contoarele urmăresc progresia fixture-ului", () => {
  const stari = model(construiesteFixture()).stari_pe_momente.map((c) => c.contor);
  assert.deepEqual(stari[0], { netestat: 3, abia_inceput: 1, nu_il_stie: 0, in_lucru: 0, fluent: 0 });
  assert.deepEqual(stari[1], { netestat: 3, abia_inceput: 0, nu_il_stie: 0, in_lucru: 0, fluent: 1 });
  assert.deepEqual(stari[2], { netestat: 3, abia_inceput: 0, nu_il_stie: 0, in_lucru: 1, fluent: 0 });
  assert.deepEqual(stari[3], { netestat: 2, abia_inceput: 1, nu_il_stie: 0, in_lucru: 1, fluent: 0 });
  assert.deepEqual(stari[4], { netestat: 2, abia_inceput: 0, nu_il_stie: 1, in_lucru: 1, fluent: 0 });
});

it("urcarea produce sosire în categoria de sosire", () => {
  const sosiri = model(construiesteFixture()).stari_pe_momente.map((c) => c.sosiri_prin_urcare);
  // 02.07: 12*1 urcă abia_inceput -> fluent
  assert.equal(sosiri[1].fluent, 1);
  // 04.07: 13*1 urcă netestat -> abia_inceput
  assert.equal(sosiri[3].abia_inceput, 1);
  // 05.07: 13*1 urcă abia_inceput -> nu_il_stie
  assert.equal(sosiri[4].nu_il_stie, 1);
});

it("coborârea NU produce sosire în categoria în care aterizează", () => {
  const sosiri = model(construiesteFixture()).stari_pe_momente.map((c) => c.sosiri_prin_urcare);
  // 03.07: 12*1 cade fluent -> in_lucru. Numărul din in_lucru crește de la 0 la 1,
  // dar factul a coborât, deci nu se numără ca sosire prin urcare.
  assert.equal(sosiri[2].in_lucru, 0);
  assert.equal(sosiri[2].nu_il_stie, 0);
  assert.equal(sosiri[2].abia_inceput, 0);
  assert.equal(sosiri[2].fluent, 0);
});

it("`netestat` nu apare între sosiri — nimic nu poate urca în treapta 0", () => {
  const m = model(construiesteFixture());
  m.stari_pe_momente.forEach((coloana) => {
    assert.equal("netestat" in coloana.sosiri_prin_urcare, false);
  });
});
