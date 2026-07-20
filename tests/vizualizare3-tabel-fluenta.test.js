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
    calup: { marimi: [25, 50, 100, 200], implicita: 100 },
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

it("structura randurilor, fara nicio intrebare", () => {
  const motor = incarcaMotor();
  const model = motor.construiesteModelTabelFluenta({
    inregistrari: [],
    catalog: CATALOG,
    marimeCalup: 50,
    praguri: PRAGURI,
  });

  assert.equal(model.eticheta_domeniu, "12-13 × 1-2");
  assert.equal(model.marime_calup, 50);
  assert.deepEqual(model.antete, []);
  assert.deepEqual(
    model.randuri.map((r) => r.eticheta),
    ["12 ×", "13 ×", "Toată fereastra"]
  );
  assert.deepEqual(
    model.randuri.map((r) => r.tip),
    ["subtabla", "subtabla", "total"]
  );
  model.randuri.forEach((r) => assert.deepEqual(r.celule, []));
});

it("aliniere la dreapta, antete si scoruri pe date reale", () => {
  const motor = incarcaMotor();
  // 100 pe 12*1=12 @1.5s (zile alternate) urmate de 50 pe 13*2=26 @6.0s.
  const inregistrari = [
    ...apasariFact("12*1=12", 100, 1.5, ["2026-07-01", "2026-07-02"]),
    ...apasariFact("13*2=26", 50, 6.0, ["2026-07-10", "2026-07-11"]),
  ];

  const model = motor.construiesteModelTabelFluenta({
    inregistrari,
    catalog: CATALOG,
    marimeCalup: 50,
    praguri: PRAGURI,
  });

  assert.deepEqual(
    model.antete.map((a) => a.eticheta),
    ["cu 2 calupuri în urmă", "anterioarele 50", "ultimele 50"]
  );

  const [rand12, rand13, randTotal] = model.randuri;
  assert.equal(rand12.eticheta, "12 ×");
  assert.equal(rand13.eticheta, "13 ×");
  assert.equal(randTotal.eticheta, "Toată fereastra");

  // 12 ×: doar 12*1 e testat (fluent, scor 1); 12*2 netestat (0) -> media 0.5.
  assert.equal(rand12.celule[0], null);
  assert.ok(Math.abs(rand12.celule[1].scor - 0.5) < 1e-9);
  assert.ok(Math.abs(rand12.celule[2].scor - 0.5) < 1e-9);
  assert.equal(rand12.celule[1].eticheta, "incredere_mare");
  assert.equal(rand12.celule[2].eticheta, "incredere_mare");

  // 13 ×: un singur calup (exact 50 raspunsuri); 13*2 la 0.2 viteza -> media 0.1.
  assert.equal(rand13.celule[0], null);
  assert.equal(rand13.celule[1], null);
  assert.ok(Math.abs(rand13.celule[2].scor - 0.1) < 1e-9);
  assert.equal(rand13.celule[2].eticheta, "incredere_mare");

  // Toata fereastra: 3 calupuri, cate 1 fact "activ" din 4 -> 0.25 / 0.25 / 0.05.
  assert.ok(Math.abs(randTotal.celule[0].scor - 0.25) < 1e-9);
  assert.ok(Math.abs(randTotal.celule[1].scor - 0.25) < 1e-9);
  assert.ok(Math.abs(randTotal.celule[2].scor - 0.05) < 1e-9);
  randTotal.celule.forEach((c) => assert.equal(c.eticheta, "incredere_mare"));

  // Aliniere la dreapta: ultima coloana e mereu index_din_prezent 0.
  model.randuri.forEach((rand) => {
    const ultima = rand.celule[rand.celule.length - 1];
    if (ultima) assert.equal(ultima.index_din_prezent, 0);
  });
});

it("celula subtire: sub pragul minim, eticheta date_insuficiente si scor null", () => {
  const motor = incarcaMotor();
  const inregistrari = apasariFact("12*1=12", 10, 1.5, ["2026-07-01"]);

  const model = motor.construiesteModelTabelFluenta({
    inregistrari,
    catalog: CATALOG,
    marimeCalup: 50,
    praguri: PRAGURI,
  });

  const rand12 = model.randuri.find((r) => r.eticheta === "12 ×");
  assert.equal(rand12.celule.length, 1);
  assert.equal(rand12.celule[0].eticheta, "date_insuficiente");
  assert.equal(rand12.celule[0].scor, null);
});

it("valideaza intrarile", () => {
  const motor = incarcaMotor();
  assert.throws(() =>
    motor.construiesteModelTabelFluenta({
      inregistrari: "nu-i array",
      catalog: CATALOG,
      marimeCalup: 50,
      praguri: PRAGURI,
    })
  );
  assert.throws(() =>
    motor.construiesteModelTabelFluenta({
      inregistrari: [],
      catalog: CATALOG,
      marimeCalup: 0,
      praguri: PRAGURI,
    })
  );
});
