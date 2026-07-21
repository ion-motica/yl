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

// Praguri v1, DAR cu incredere redusa fata de config-praguri.js real: permite
// fixture-uri mici care ating toate cele 3 etichete (insuficiente/mica/mare).
// Pragurile de incredere sunt PARAMETRU al motorului, nu constanta — vezi
// tests/vizualizare3-tabel-fluenta.test.js pentru pragurile reale.
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
    incredere: { n_minim_calcul: 3, n_incredere_mare: 6, zile_distincte_incredere_mare: 2 },
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

// Catalog literal minim — builderul folosește doar celule[].cell_id, celule[].a.
const CATALOG = {
  eticheta: "12-13 × 1-2",
  celule: [
    { cell_id: "mul:12x1", a: 12 },
    { cell_id: "mul:12x2", a: 12 },
    { cell_id: "mul:13x1", a: 13 },
    { cell_id: "mul:13x2", a: 13 },
  ],
};

function apropiat(actual, asteptat) {
  assert.ok(Math.abs(actual - asteptat) < 1e-9, `asteptat ~${asteptat}, primit ${actual}`);
}

// Fixture principal (B=14): bloc 12*1 (8, zile alternate 07-01/07-02),
// bloc 12*2 (4, aceleași zile alternate), bloc 13*1 (2, 07-03).
function construiesteFixturePrincipal() {
  return [
    ...apasariFact("12*1=12", 8, 1.5, ["2026-07-01", "2026-07-02"]),
    ...apasariFact("12*2=24", 4, 1.5, ["2026-07-01", "2026-07-02"]),
    ...apasariFact("13*1=13", 2, 1.5, ["2026-07-03"]),
  ];
}

it("structura candidaților: ordine, poze, celule_total, contor (fixture principal, [2,5])", () => {
  const motor = incarcaMotor();
  const rec = motor.construiesteRecomandareAdancime({
    inregistrari: construiesteFixturePrincipal(),
    catalog: CATALOG,
    adancimi: [2, 5],
    praguri: PRAGURI,
  });

  assert.equal(rec.tip, "recomandare_adancime");
  assert.equal(rec.candidati.length, 2);
  assert.equal(rec.candidati[0].adancime, 2);
  assert.equal(rec.candidati[1].adancime, 5);

  assert.equal(rec.candidati[0].poze, 4);
  assert.equal(rec.candidati[0].celule_total, 8);
  assert.deepEqual(rec.candidati[0].contor, {
    incredere_mare: 0,
    incredere_mica: 2,
    date_insuficiente: 6,
  });

  assert.equal(rec.candidati[1].poze, 2);
  assert.equal(rec.candidati[1].celule_total, 4);
  assert.deepEqual(rec.candidati[1].contor, {
    incredere_mare: 1,
    incredere_mica: 1,
    date_insuficiente: 2,
  });
});

it("procentele și adâncimea recomandată (fixture principal, [2,5])", () => {
  const motor = incarcaMotor();
  const rec = motor.construiesteRecomandareAdancime({
    inregistrari: construiesteFixturePrincipal(),
    catalog: CATALOG,
    adancimi: [2, 5],
    praguri: PRAGURI,
  });

  apropiat(rec.candidati[0].procent_bazate, 0);
  apropiat(rec.candidati[1].procent_bazate, 0.25);
  assert.equal(rec.adancime_recomandata, 5);
});

it("tie-break: la procente egale câștigă adâncimea mai mică", () => {
  const motor = incarcaMotor();
  const fixture = [
    ...apasariFact("12*1=12", 4, 1.5, ["2026-07-01", "2026-07-02"]),
    ...apasariFact("12*2=24", 4, 1.5, ["2026-07-01", "2026-07-02"]),
  ];
  const rec = motor.construiesteRecomandareAdancime({
    inregistrari: fixture,
    catalog: CATALOG,
    adancimi: [5, 10],
    praguri: PRAGURI,
  });

  apropiat(rec.candidati[0].procent_bazate, 0.5);
  apropiat(rec.candidati[1].procent_bazate, 0.5);
  assert.equal(rec.adancime_recomandata, 5);
});

it("consistență cu tabelul: contorul candidatului = etichetele din construiesteModelTabelFluenta", () => {
  const motor = incarcaMotor();
  const inregistrari = construiesteFixturePrincipal();

  const model = motor.construiesteModelTabelFluenta({
    inregistrari,
    catalog: CATALOG,
    adancime: 5,
    praguri: PRAGURI,
  });
  const contorDinTabel = { incredere_mare: 0, incredere_mica: 0, date_insuficiente: 0 };
  let totalDinTabel = 0;
  model.randuri
    .filter((rand) => rand.tip === "subtabla")
    .forEach((rand) =>
      rand.celule.forEach((celula) => {
        contorDinTabel[celula.eticheta] += 1;
        totalDinTabel += 1;
      })
    );

  const rec = motor.construiesteRecomandareAdancime({
    inregistrari,
    catalog: CATALOG,
    adancimi: [5],
    praguri: PRAGURI,
  });

  assert.deepEqual(rec.candidati[0].contor, contorDinTabel);
  assert.equal(rec.candidati[0].celule_total, totalDinTabel);
  assert.equal(rec.candidati[0].poze, model.antete.length);
});

it("niciun candidat bazat -> adancime_recomandata null", () => {
  const motor = incarcaMotor();
  const rec = motor.construiesteRecomandareAdancime({
    inregistrari: construiesteFixturePrincipal(),
    catalog: CATALOG,
    adancimi: [2],
    praguri: PRAGURI,
  });

  assert.equal(rec.candidati.length, 1);
  assert.equal(rec.adancime_recomandata, null);
});

it("validează intrările", () => {
  const motor = incarcaMotor();

  assert.throws(
    () =>
      motor.construiesteRecomandareAdancime({
        inregistrari: construiesteFixturePrincipal(),
        catalog: CATALOG,
        adancimi: [],
        praguri: PRAGURI,
      }),
    { message: "Recomandatorul are nevoie de un array nevid de adâncimi candidate." }
  );

  assert.throws(
    () =>
      motor.construiesteRecomandareAdancime({
        inregistrari: 42,
        catalog: CATALOG,
        adancimi: [5],
        praguri: PRAGURI,
      }),
    { message: "Motorul are nevoie de un array de înregistrări." }
  );

  assert.throws(
    () =>
      motor.construiesteRecomandareAdancime({
        inregistrari: construiesteFixturePrincipal(),
        catalog: CATALOG,
        adancimi: [0],
        praguri: PRAGURI,
      }),
    { message: "Adâncimea fotografiei trebuie să fie un întreg pozitiv." }
  );
});

it("B=0: toți candidații cu poze/celule/procent 0, recomandata null", () => {
  const motor = incarcaMotor();
  const rec = motor.construiesteRecomandareAdancime({
    inregistrari: [],
    catalog: CATALOG,
    adancimi: [2, 5],
    praguri: PRAGURI,
  });

  rec.candidati.forEach((c) => {
    assert.equal(c.poze, 0);
    assert.equal(c.celule_total, 0);
    assert.equal(c.procent_bazate, 0);
  });
  assert.equal(rec.adancime_recomandata, null);
});
