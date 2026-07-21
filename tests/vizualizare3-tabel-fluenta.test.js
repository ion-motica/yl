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

// Praguri v1 exacte din config-praguri.js (§13), duplicate aici ca literal —
// fișierele de test sunt standalone (vezi tests/vizualizare3-scor-fluenta.test.js).
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
  },
};

// Întrebări BRUTE (forma apăsărilor din jurnal) — builderul primește brute,
// nu grupate, și rulează intern normalizeaza + grupeazaApasarilePeIntrebari.
function apasariFact(fact, n, durataSecunde, zile) {
  const rezultat = [];
  for (let i = 0; i < n; i++) {
    const zi = zile[i % zile.length];
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

// Catalog literal minim — builderul folosește doar celule[].cell_id, celule[].a
// și eticheta domeniului.
const CATALOG = {
  eticheta: "12-13 × 1-2",
  celule: [
    { cell_id: "mul:12x1", a: 12 },
    { cell_id: "mul:12x2", a: 12 },
    { cell_id: "mul:13x1", a: 13 },
    { cell_id: "mul:13x2", a: 13 },
  ],
};

// Fixture principal (adancime 5 -> pas = 5×2 = 10):
// bloc A (10): 6 × 12*1=12 @1,5s (zile alternate 07-01/07-02), apoi
//              4 × 12*2=24 @6,0s (aceleași zile alternate; a 10-a cade pe 07-02);
// bloc B (10): 5 × 13*1=13 @1,5s (07-10/07-11), apoi 5 × 12*1=12 @1,5s (07-12).
function construiesteFixturePrincipal() {
  return [
    ...apasariFact("12*1=12", 6, 1.5, ["2026-07-01", "2026-07-02"]),
    ...apasariFact("12*2=24", 4, 6.0, ["2026-07-01", "2026-07-02"]),
    ...apasariFact("13*1=13", 5, 1.5, ["2026-07-10", "2026-07-11"]),
    ...apasariFact("12*1=12", 5, 1.5, ["2026-07-12"]),
  ];
}

it("structura si antetele pozelor (2 momente, ambele complete)", () => {
  const motor = incarcaMotor();
  const model = motor.construiesteModelTabelFluenta({
    inregistrari: construiesteFixturePrincipal(),
    catalog: CATALOG,
    adancime: 5,
    praguri: PRAGURI,
  });

  assert.equal(model.eticheta_domeniu, "12-13 × 1-2");
  assert.equal(model.adancime, 5);
  assert.equal(model.facts_per_subtabla, 2);
  assert.equal(model.numar_raspunsuri_valide, 20);

  assert.deepEqual(
    model.antete.map((a) => a.eticheta),
    ["02.07", "acum"]
  );
  assert.deepEqual(
    model.antete.map((a) => a.este_acum),
    [false, true]
  );

  assert.deepEqual(
    model.randuri.map((r) => r.eticheta),
    ["12 ×", "13 ×", "Toată fereastra"]
  );
  model.randuri.forEach((rand) => assert.equal(rand.celule.length, 2));
});

it("scorurile exacte pe fiecare poza, chiar cand eticheta e date_insuficiente", () => {
  const motor = incarcaMotor();
  const model = motor.construiesteModelTabelFluenta({
    inregistrari: construiesteFixturePrincipal(),
    catalog: CATALOG,
    adancime: 5,
    praguri: PRAGURI,
  });

  const [rand12, rand13, randTotal] = model.randuri;
  const aproape = (valoare, asteptat) => assert.ok(Math.abs(valoare - asteptat) < 1e-9);

  // Poza k=10 ("02.07"): 12×: (1 + 0,2)/2 = 0,6 · n=9 · date_insuficiente (n<15).
  aproape(rand12.celule[0].scor, 0.6);
  assert.equal(rand12.celule[0].n, 9);
  assert.equal(rand12.celule[0].zile_distincte, 2);
  assert.equal(rand12.celule[0].eticheta, "date_insuficiente");

  // 13×: nimic testat inca -> scor 0, n=0, date_insuficiente.
  aproape(rand13.celule[0].scor, 0);
  assert.equal(rand13.celule[0].n, 0);
  assert.equal(rand13.celule[0].eticheta, "date_insuficiente");

  // Toata fereastra k=10: (1 + 0,2 + 0 + 0)/4 = 0,3 · n=9.
  aproape(randTotal.celule[0].scor, 0.3);
  assert.equal(randTotal.celule[0].n, 9);

  // Poza k=20 ("acum"): 12×: 12*1 (ultimele 5, din 07-12) -> 1; 12*2 neschimbat -> 0,2.
  aproape(rand12.celule[1].scor, 0.6);
  assert.equal(rand12.celule[1].n, 9);
  assert.equal(rand12.celule[1].zile_distincte, 3);

  // 13×: 13*1 -> 1; 13*2 netestat -> 0 => media 0,5.
  aproape(rand13.celule[1].scor, 0.5);
  assert.equal(rand13.celule[1].n, 5);

  // Toata fereastra k=20: (1 + 0,2 + 1 + 0)/4 = 0,55 · n=14.
  aproape(randTotal.celule[1].scor, 0.55);
  assert.equal(randTotal.celule[1].n, 14);
});

it("randul Toata fereastra e media subtablelor pe fiecare coloana", () => {
  const motor = incarcaMotor();
  const model = motor.construiesteModelTabelFluenta({
    inregistrari: construiesteFixturePrincipal(),
    catalog: CATALOG,
    adancime: 5,
    praguri: PRAGURI,
  });

  const [rand12, rand13, randTotal] = model.randuri;
  randTotal.celule.forEach((celulaTotal, idx) => {
    const medieSubtable = (rand12.celule[idx].scor + rand13.celule[idx].scor) / 2;
    assert.ok(Math.abs(celulaTotal.scor - medieSubtable) < 1e-9);
  });
});

it("facts_noi: numara doar facts cu raspuns nou fata de poza anterioara", () => {
  const motor = incarcaMotor();
  const model = motor.construiesteModelTabelFluenta({
    inregistrari: construiesteFixturePrincipal(),
    catalog: CATALOG,
    adancime: 5,
    praguri: PRAGURI,
  });

  const [rand12, rand13] = model.randuri;
  // k=10 (prima poza, kAnterior=0): ambele facts din 12× au raspunsuri; niciun 13×.
  assert.equal(rand12.celule[0].facts_noi, 2);
  assert.equal(rand13.celule[0].facts_noi, 0);
  // k=20 (kAnterior=10): doar 12*1 are raspunsuri noi in bloc B pt 12×;
  // doar 13*1 are raspunsuri noi pt 13× (13*2 nu apare niciodata).
  assert.equal(rand12.celule[1].facts_noi, 1);
  assert.equal(rand13.celule[1].facts_noi, 1);
});

it("eticheta incredere_mica: n intre pragul minim si n_incredere_mare", () => {
  const motor = incarcaMotor();
  const inregistrari = [
    ...apasariFact("12*1=12", 10, 1.5, ["2026-07-01", "2026-07-02"]),
    ...apasariFact("12*2=24", 10, 6.0, ["2026-07-01", "2026-07-02"]),
  ];
  const model = motor.construiesteModelTabelFluenta({
    inregistrari,
    catalog: CATALOG,
    adancime: 10,
    praguri: PRAGURI,
  });

  assert.equal(model.antete.length, 1);
  assert.equal(model.antete[0].este_acum, true);

  const rand12 = model.randuri.find((r) => r.eticheta === "12 ×");
  assert.ok(Math.abs(rand12.celule[0].scor - 0.6) < 1e-9);
  assert.equal(rand12.celule[0].n, 20);
  assert.equal(rand12.celule[0].zile_distincte, 2);
  assert.equal(rand12.celule[0].eticheta, "incredere_mica");
});

it("valideaza intrarile", () => {
  const motor = incarcaMotor();
  assert.throws(() =>
    motor.construiesteModelTabelFluenta({
      inregistrari: "nu-i array",
      catalog: CATALOG,
      adancime: 5,
      praguri: PRAGURI,
    })
  );
  assert.throws(() =>
    motor.construiesteModelTabelFluenta({
      inregistrari: [],
      catalog: CATALOG,
      adancime: 0,
      praguri: PRAGURI,
    })
  );
});

it("fara nicio inregistrare valida: antete goale, toate randurile fara celule", () => {
  const motor = incarcaMotor();
  const model = motor.construiesteModelTabelFluenta({
    inregistrari: [],
    catalog: CATALOG,
    adancime: 5,
    praguri: PRAGURI,
  });

  assert.equal(model.numar_raspunsuri_valide, 0);
  assert.deepEqual(model.antete, []);
  assert.deepEqual(
    model.randuri.map((r) => r.eticheta),
    ["12 ×", "13 ×", "Toată fereastra"]
  );
  model.randuri.forEach((r) => assert.deepEqual(r.celule, []));
});
