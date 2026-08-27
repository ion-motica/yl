import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function incarca(caleRelativa, numeGlobal) {
  const code = readFileSync(`${rootDir}/${caleRelativa}`, "utf8");
  new Function("globalThis", code)(globalThis);
  return globalThis[numeGlobal];
}

function incarcaTot() {
  const motor = incarca("Vizualizare 3 - Claude/motor-analiza.js", "MotorAnalizaVizualizare3");
  const construiesteCatalog = incarca(
    "Vizualizare 3 - Claude/catalog-tabla-inmultirii.js",
    "construiesteCatalogInmultire"
  );
  const praguri = incarca("Vizualizare 3 - Claude/config-praguri.js", "ConfigPraguriVizualizare3");
  return { motor, catalog: construiesteCatalog({ aMin: 1, aMax: 10, bMin: 1, bMax: 10 }), praguri };
}

afterEach(() => {
  delete globalThis.MotorAnalizaVizualizare3;
  delete globalThis.construiesteCatalogInmultire;
  delete globalThis.ConfigPraguriVizualizare3;
});

const CONFIG_PROTOTIP = {
  domeniu: { tip: "tabla", table_id: "mul:1-10x1-10", agregare_forme: "per_fact" },
  filtrare: { preset: "standard_v1" },
  segmentare: { tip: "tot_istoricul" },
  statistici: ["precizie_prima", "mediana_timp_corect", "n"],
  interpretare: { tip: "stare_curenta" },
  vizualizare: { tip: "grila_10x10" },
};

// Construiește o apăsare brută (o înregistrare din jurnal).
function apasare({ a, b, zi, ora = "10:00:00", corect, apasare: nrApasare = 1, timp }) {
  const produs = a * b;
  return {
    data_ora_ro: `2026-07-${zi} ${ora}`,
    quiz_id: "test",
    subquiz_id: null,
    fact_id: `mul:${a}*${b}=?`,
    fact: `${a}*${b}=${produs}`,
    eq_form: `${a}*${b}=?`,
    intrebare: `${a}*${b}=?`,
    raspuns: corect ? String(produs) : "0",
    raspuns_corect: corect,
    a_cata_apasare_pe_buton: nrApasare,
    durata_raspuns_secunde: timp,
  };
}

// n întrebări corecte din prima, împărțite pe 2 zile.
function corecteDinPrima(a, b, timpi) {
  return timpi.map((timp, i) =>
    apasare({ a, b, zi: i % 2 === 0 ? "10" : "11", corect: true, timp })
  );
}

function celula(model, cellId) {
  return model.celule.find((c) => c.cell_id === cellId);
}

it("materializeaza toate cele 100 de celule, netestat implicit", () => {
  const { motor, catalog, praguri } = incarcaTot();
  const model = motor.ruleazaAnaliza({
    inregistrari: [],
    catalog,
    configuratie: CONFIG_PROTOTIP,
    praguri,
  });
  assert.equal(model.celule.length, 100);
  assert.ok(model.celule.every((c) => c.stare === "netestat" && c.n === 0 && c.traseu === 0));
});

it("clasifica fluent, in_lucru, nu_il_stie si abia_inceput", () => {
  const { motor, catalog, praguri } = incarcaTot();

  const inregistrari = [
    // 5×5: 6 corecte din prima, timpi ~1.4s, 2 zile -> fluent
    ...corecteDinPrima(5, 5, [1.2, 1.3, 1.4, 1.5, 1.4, 1.6]),

    // 7×3: 5 corecte din prima (~2.5s) + 1 greșită din prima apoi corectată
    //      precizie 5/6 ≈ 0.83, mediană ~2.5 -> in_lucru
    ...corecteDinPrima(7, 3, [2.4, 2.5, 2.6, 2.3, 2.5]),
    apasare({ a: 7, b: 3, zi: "11", corect: false, apasare: 1, timp: 3.0 }),
    apasare({ a: 7, b: 3, zi: "11", corect: true, apasare: 2, timp: 4.5 }),

    // 6×7: 3 corecte din prima + 3 greșite din prima -> precizie 0.5 -> nu_il_stie
    ...corecteDinPrima(6, 7, [2.0, 2.1, 2.0]),
    apasare({ a: 6, b: 7, zi: "10", corect: false, timp: 2.5 }),
    apasare({ a: 6, b: 7, zi: "11", corect: false, timp: 2.5 }),
    apasare({ a: 6, b: 7, zi: "11", corect: false, timp: 2.5 }),

    // 2×3: doar 2 întrebări -> abia_inceput (n < 5)
    ...corecteDinPrima(2, 3, [1.0, 1.1]),
  ];

  const model = motor.ruleazaAnaliza({
    inregistrari,
    catalog,
    configuratie: CONFIG_PROTOTIP,
    praguri,
  });

  assert.equal(celula(model, "mul:5x5").stare, "fluent");
  assert.equal(celula(model, "mul:5x5").traseu, 4);
  assert.equal(celula(model, "mul:5x5").n, 6);

  assert.equal(celula(model, "mul:7x3").stare, "in_lucru");
  assert.equal(celula(model, "mul:7x3").traseu, 3);
  assert.equal(celula(model, "mul:7x3").n, 6);

  assert.equal(celula(model, "mul:6x7").stare, "nu_il_stie");
  assert.equal(celula(model, "mul:6x7").traseu, 2);

  assert.equal(celula(model, "mul:2x3").stare, "abia_inceput");
  assert.equal(celula(model, "mul:2x3").traseu, 1);

  // 3×7 rămâne netestat: grila e poziționala, nu se confunda cu 7×3.
  assert.equal(celula(model, "mul:3x7").stare, "netestat");
});

it("exclude timpii extremi din viteza, dar ii pastreaza in precizie", () => {
  const { motor, catalog, praguri } = incarcaTot();
  const inregistrari = [
    ...corecteDinPrima(8, 8, [1.5, 1.5, 1.5, 1.5]),
    apasare({ a: 8, b: 8, zi: "10", corect: true, timp: 0.2 }), // accidentala, <0.5
    apasare({ a: 8, b: 8, zi: "11", corect: true, timp: 30 }), // pauza, >15
  ];
  const model = motor.ruleazaAnaliza({
    inregistrari,
    catalog,
    configuratie: CONFIG_PROTOTIP,
    praguri,
  });
  const c = celula(model, "mul:8x8");
  assert.equal(c.n, 6); // toate 6 intra in precizie
  assert.equal(c.precizie_prima, 1);
  assert.equal(c.mediana_timp, 1.5); // 0.2 si 30 excluse din mediana
});

it("intrebarile necatalogate (ex. 11×2) nu apar in grila 1-10", () => {
  const { motor, catalog, praguri } = incarcaTot();
  const inregistrari = corecteDinPrima(11, 2, [1.0, 1.1, 1.2, 1.3, 1.4, 1.5]);
  const model = motor.ruleazaAnaliza({
    inregistrari,
    catalog,
    configuratie: CONFIG_PROTOTIP,
    praguri,
  });
  assert.ok(model.celule.every((c) => c.stare === "netestat"));
});

it("rezumat lizibil al celulelor testate", () => {
  const { motor, catalog, praguri } = incarcaTot();
  const inregistrari = [
    ...corecteDinPrima(5, 5, [1.2, 1.3, 1.4, 1.5, 1.4, 1.6]),
    ...corecteDinPrima(7, 3, [2.4, 2.5, 2.6, 2.3, 2.5, 2.4]),
    ...corecteDinPrima(2, 3, [1.0, 1.1]),
  ];
  const model = motor.ruleazaAnaliza({
    inregistrari,
    catalog,
    configuratie: CONFIG_PROTOTIP,
    praguri,
  });
  const testate = model.celule.filter((c) => c.stare !== "netestat");
  console.log("\n  Celule testate:");
  testate.forEach((c) => {
    const timp = c.mediana_timp === null ? "-" : `${c.mediana_timp}s`;
    const precizie = c.precizie_prima === null ? "-" : `${Math.round(c.precizie_prima * 100)}%`;
    console.log(
      `    ${c.eticheta.padEnd(9)} ${c.stare.padEnd(18)} n=${c.n} precizie=${precizie} mediana=${timp}`
    );
  });
  assert.ok(testate.length >= 1);
});
