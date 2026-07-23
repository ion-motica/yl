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

// Fixture principal — o coloană = o zi calendaristică, deci zilele TREBUIE
// să fie contigue (tot blocul unei zile, apoi tot blocul zilei următoare);
// zile alternate în interiorul unui bloc (ca la v1) ar produce o coloană
// nouă la fiecare alternare — nu reprezintă nimic ce ar putea produce un
// user real (timpul nu sare înainte-înapoi în jurnal).
// 01.07: 6× 12*1 @1,5s · 02.07: 4× 12*2 @6,0s · 10.07: 5× 13*1 @1,5s ·
// 12.07: 5× 12*1 @1,5s ("acum"). adancime=5. Valori verificate cu motorul
// REAL pe acest fixture exact (scratchpad), nu calculate mental — copiate
// din output.
function construiesteFixturePrincipal() {
  return [
    ...apasariFact("12*1=12", 6, 1.5, ["2026-07-01"]),
    ...apasariFact("12*2=24", 4, 6.0, ["2026-07-02"]),
    ...apasariFact("13*1=13", 5, 1.5, ["2026-07-10"]),
    ...apasariFact("12*1=12", 5, 1.5, ["2026-07-12"]),
  ];
}

it("structura, antetele (4 zile distincte, ultima acum) si exercitiile/zi", () => {
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

  // O coloana per zi distincta din fixture (nu la fiecare `adancime x facts`
  // raspunsuri, ca in v1) — 4 zile lucrate => 4 antete, ultima "acum".
  assert.deepEqual(
    model.antete.map((a) => a.eticheta),
    ["01.07", "02.07", "10.07", "acum"]
  );
  assert.deepEqual(
    model.antete.map((a) => a.este_acum),
    [false, false, false, true]
  );

  // Sesiunile unei zile se cumuleaza intr-o singura coloana; suma pe toate
  // zilele = tot ce-i valid (B).
  assert.deepEqual(model.numar_exercitii_valide_pe_zi, [6, 4, 5, 5]);
  assert.equal(
    model.numar_exercitii_valide_pe_zi.reduce((a, b) => a + b, 0),
    20
  );

  assert.deepEqual(
    model.randuri.map((r) => r.eticheta),
    ["12 ×", "13 ×", "Toată fereastra"]
  );
  model.randuri.forEach((rand) => assert.equal(rand.celule.length, 4));
});

it("scorurile exacte pe fiecare poza (toate date_insuficiente la acest volum mic)", () => {
  const motor = incarcaMotor();
  const model = motor.construiesteModelTabelFluenta({
    inregistrari: construiesteFixturePrincipal(),
    catalog: CATALOG,
    adancime: 5,
    praguri: PRAGURI,
  });

  const [rand12, rand13, randTotal] = model.randuri;
  const aproape = (valoare, asteptat) => assert.ok(Math.abs(valoare - asteptat) < 1e-9);

  // 01.07 (k=6): 12×1 ultimele 5 din 6 @1,5s -> 1; 12×2 netestat -> 0 => 0,5.
  aproape(rand12.celule[0].scor, 0.5);
  assert.equal(rand12.celule[0].n, 5);
  assert.equal(rand12.celule[0].zile_distincte, 1);
  assert.equal(rand12.celule[0].eticheta, "date_insuficiente");

  // 02.07 (k=10): 12×1 neschimbat -> 1; 12×2 (4 @6,0s, sub adancime) -> 0,2 => 0,6.
  aproape(rand12.celule[1].scor, 0.6);
  assert.equal(rand12.celule[1].n, 9);
  assert.equal(rand12.celule[1].zile_distincte, 2);

  // 10.07 (k=15): ziua e a lui 13×, randul 12× ramane neschimbat (0,6).
  aproape(rand12.celule[2].scor, 0.6);
  assert.equal(rand12.celule[2].facts_noi, 0);

  // acum (k=20): cele 5 12×1 noi impinng fereastra (tot @1,5s) -> scorul
  // ramane 0,6, dar zilele contribuite se muta (07-01 iese, 07-12 intra).
  aproape(rand12.celule[3].scor, 0.6);
  assert.equal(rand12.celule[3].n, 9);
  assert.equal(rand12.celule[3].facts_noi, 1);

  // 13×: netestat pana la 10.07; 13×1 -> 1, 13×2 netestat => 0,5.
  aproape(rand13.celule[0].scor, 0);
  aproape(rand13.celule[1].scor, 0);
  aproape(rand13.celule[2].scor, 0.5);
  assert.equal(rand13.celule[2].n, 5);
  aproape(rand13.celule[3].scor, 0.5);
  assert.equal(rand13.celule[3].facts_noi, 0);

  // Toata fereastra = media celor 2 randuri, pe fiecare coloana.
  aproape(randTotal.celule[0].scor, 0.25);
  aproape(randTotal.celule[1].scor, 0.3);
  aproape(randTotal.celule[2].scor, 0.55);
  aproape(randTotal.celule[3].scor, 0.55);
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
  // 01.07: doar 12×1 nou. 02.07: doar 12×2 nou. 10.07: ziua lui 13×, 12× fara noutati.
  // acum: 12×1 revine (nou fata de poza anterioara), 13× fara noutati.
  assert.deepEqual(rand12.celule.map((c) => c.facts_noi), [1, 1, 0, 1]);
  assert.deepEqual(rand13.celule.map((c) => c.facts_noi), [0, 0, 1, 0]);
});

it("garda casutaEDeAfisat: adevarat doar la incredere_mare (n agregat >=50 si >=2 zile)", () => {
  const motor = incarcaMotor();
  // 2 zile disjuncte, cate un fact pe fiecare, adancime 30: prima poza vede
  // un singur fact (n=30, o singura zi) -> incredere_mica; a doua vede
  // ambele facts (n=60, 2 zile) -> incredere_mare.
  const inregistrari = [
    ...apasariFact("12*1=12", 30, 1.5, ["2026-08-01"]),
    ...apasariFact("12*2=24", 30, 1.5, ["2026-08-05"]),
  ];
  const model = motor.construiesteModelTabelFluenta({
    inregistrari,
    catalog: CATALOG,
    adancime: 30,
    praguri: PRAGURI,
  });

  assert.deepEqual(
    model.antete.map((a) => a.eticheta),
    ["01.08", "acum"]
  );
  assert.deepEqual(model.numar_exercitii_valide_pe_zi, [30, 30]);

  const rand12 = model.randuri.find((r) => r.eticheta === "12 ×");
  assert.equal(rand12.celule[0].eticheta, "incredere_mica");
  assert.equal(motor.casutaEDeAfisat(rand12.celule[0]), false);
  assert.equal(rand12.celule[1].eticheta, "incredere_mare");
  assert.equal(motor.casutaEDeAfisat(rand12.celule[1]), true);

  // Randul 13× n-are nicio data in acest fixture -> mereu ascuns.
  const rand13 = model.randuri.find((r) => r.eticheta === "13 ×");
  rand13.celule.forEach((celula) => assert.equal(motor.casutaEDeAfisat(celula), false));
});

it("data corupta pe ultimul raspuns: garda [C3] forteaza ultima poza la acum", () => {
  const motor = incarcaMotor();
  // ziDin() intoarce null pt. o data nevalida; fara garda explicita, granita
  // de zi n-ar declansa niciodata pe acest ultim raspuns (null === null).
  const inregistrari = [
    ...apasariFact("12*1=12", 5, 1.5, ["2026-07-01"]),
    {
      data_ora_ro: "nu-e-o-data",
      fact: "12*1=12",
      a_raspuns_corect: true,
      a_cata_apasare_pe_buton: 1,
      durata_raspuns_secunde: 1.5,
    },
  ];
  const model = motor.construiesteModelTabelFluenta({
    inregistrari,
    catalog: CATALOG,
    adancime: 5,
    praguri: PRAGURI,
  });

  assert.deepEqual(
    model.antete.map((a) => a.eticheta),
    ["01.07", "acum"]
  );
  assert.deepEqual(
    model.antete.map((a) => a.este_acum),
    [false, true]
  );
  assert.deepEqual(model.numar_exercitii_valide_pe_zi, [5, 1]);
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
  assert.deepEqual(model.numar_exercitii_valide_pe_zi, []);
  assert.deepEqual(
    model.randuri.map((r) => r.eticheta),
    ["12 ×", "13 ×", "Toată fereastra"]
  );
  model.randuri.forEach((r) => assert.deepEqual(r.celule, []));
});
