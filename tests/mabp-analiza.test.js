import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  construiesteConfiguratieAnaliza,
  creeazaMotorMABP,
} from "../Vizualizare si interpretare logs/mabp-analiza.js";

const fixtureDir = new URL("../Vizualizare si interpretare logs/", import.meta.url);

function citesteJson(numeFisier) {
  return JSON.parse(readFileSync(new URL(numeFisier, fixtureDir), "utf8"));
}

function copieJson(valoare) {
  return JSON.parse(JSON.stringify(valoare));
}

function construiesteConfiguratie(analizaId, definitieAnaliza = null) {
  const preseturiPentruTest = definitieAnaliza
    ? {
        ...preseturi,
        analysis_presets: {
          ...preseturi.analysis_presets,
          [analizaId]: definitieAnaliza,
        },
      }
    : preseturi;

  return construiesteConfiguratieAnaliza({
    preseturi: preseturiPentruTest,
    analizaId,
  });
}

function valoriPozitive(obiect) {
  return Object.fromEntries(
    Object.entries(obiect).filter(([, valoare]) => Number(valoare) > 0)
  );
}

function creeazaLogTest(index, {
  corect = true,
  durata = 1,
  factId = "mul:test=?",
} = {}) {
  return {
    data_ora_ro: `2026-07-14 12:00:${String(index).padStart(2, "0")}`,
    al_catelea_turn_apasare_pe_buton: 1,
    durata_raspuns_secunde: durata,
    raspuns_corect: corect,
    fact_id: factId,
    fact: factId,
    eq_form: factId,
    extra: {},
  };
}

function creeazaCatalogTabla({
  tableId,
  eticheta,
  operatie = "mul",
  randuri,
  coloane,
}) {
  const simbol = operatie === "add" ? "+" : "*";
  const simbolEticheta = operatie === "add" ? "+" : "×";
  const facts = {};
  const celule = [];

  for (const rand of randuri) {
    for (const coloana of coloane) {
      const factId = `${operatie}:${rand}${simbol}${coloana}=?`;
      facts[factId] = {
        fact_id: factId,
        fact: `${rand}${simbol}${coloana}=${
          operatie === "add" ? rand + coloana : rand * coloana
        }`,
        operatie,
        table_id: tableId,
        cell_id: factId,
      };
      celule.push({
        fact_id: factId,
        rand,
        coloana,
        eticheta: `${rand}${simbolEticheta}${coloana}`,
      });
    }
  }

  return {
    schema_version: 1,
    catalog_id: `${tableId}:test`,
    catalog_scope: "test",
    facts,
    subtables: {},
    effs: {},
    tables: {
      [tableId]: {
        table_id: tableId,
        eticheta,
        operatie,
        randuri,
        coloane,
        celule,
      },
    },
  };
}

const loguri = citesteJson("youlearn_loguri_dummy_v1.json");
const catalog = citesteJson("youlearn_catalog_MABP_dummy_v1.json");
const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
const asteptari = citesteJson("youlearn_rezultate_asteptate_dummy_v1.json");

describe("motorul MABP", () => {
  it("normalizeaza cele 209 apasari si le grupeaza in 195 de intrebari", () => {
    const motor = creeazaMotorMABP();
    const loguriInitiale = copieJson(loguri);
    const normalizate = motor.normalizeazaInregistrari(loguri);
    const intrebari = motor.grupeazaApasariPeIntrebari(normalizate);

    assert.equal(normalizate.length, 209);
    assert.equal(intrebari.length, 195);

    const treiApasari = intrebari.filter(
      (intrebare) => intrebare.apasari[0].extra.scenario === "three_presses"
    );
    assert.equal(treiApasari.length, asteptari.grouping_checks.three_presses_question_count);
    assert.equal(
      treiApasari[0].numar_apasari,
      asteptari.grouping_checks.three_presses_press_count
    );
    assert.deepEqual(
      treiApasari[0].apasari.map((apasare) => apasare.al_catelea_turn_apasare_pe_buton),
      [1, 2, 3]
    );
    assert.equal(
      treiApasari[0].corect_din_prima,
      asteptari.grouping_checks.three_presses_correct_first_press
    );
    assert.equal(
      treiApasari[0].corectat_in_final,
      asteptari.grouping_checks.three_presses_eventually_correct
    );
    assert.equal(treiApasari[0].apasari.at(-1).raspuns_corect, true);
    assert.deepEqual(loguri, loguriInitiale);
  });

  it("accepta schema actuala, aliasul a_raspuns_corect si normalizeaza optionalele lipsa la null", () => {
    const motor = creeazaMotorMABP();
    const hints = { tabla_inmultirii: true };
    const [normalizata] = motor.normalizeazaInregistrari([
      {
        data_ora_ro: "2026-07-14 18:00:00",
        quiz_name: "Quiz curent",
        subquiz_name: null,
        intrebare: "7*8=?",
        raspuns: "56",
        a_raspuns_corect: true,
        al_catelea_turn_apasare_pe_buton: 1,
        durata_raspuns_secunde: 1.7,
        fact: "7*8=56",
        quiz_id: "quiz-curent",
        subquiz_id: null,
        fact_id: "mul:7*8=?",
        eq_form: "7*8=?",
        pozitie_buton_apasat_pt_raspuns: 2,
        valori_variante_de_raspuns: ["49", "56", "63"],
        valoare_raspuns_corect: "56",
        hints_aratate_pt_raspuns: hints,
        camp_viitor: { versiune: 3 },
        extra: {},
      },
    ]);

    assert.equal(normalizata.raspuns_corect, true);
    assert.equal(normalizata.pozitie_buton_apasat_pt_raspuns, 2);
    assert.deepEqual(normalizata.valori_variante_de_raspuns, ["49", "56", "63"]);
    assert.equal(normalizata.valoare_raspuns_corect, "56");
    assert.deepEqual(normalizata.hints_aratate_pt_raspuns, hints);
    assert.equal(normalizata.session_id, null);
    assert.equal(normalizata.quiz_version, null);
    assert.equal(normalizata.question_index_in_session, null);
    assert.equal(normalizata.button_options, null);
    assert.equal(normalizata.selected_button_index, null);
    assert.equal(normalizata.eff_id, null);
    assert.equal(normalizata.eff_member_id, null);
    assert.equal(normalizata.eq_form_id, null);
    assert.equal(normalizata.unknown_member_role, null);
    assert.deepEqual(normalizata.raw.camp_viitor, { versiune: 3 });
  });

  it("accepta o mapare explicita si o migrare mixta spre schema viitoare", () => {
    const motor = creeazaMotorMABP({
      mapareCampuri: {
        raspuns_corect: ["rezultat.corect"],
        session_id: ["context.sesiune"],
        nivel_energie: ["context.nivel_energie"],
      },
    });
    const [schemaNoua, schemaActuala] = motor.normalizeazaInregistrari([
      {
        al_catelea_turn_apasare_pe_buton: 1,
        durata_raspuns_secunde: 1.1,
        fact_id: "mul:7*8=?",
        eq_form: "7*8=?",
        rezultat: { corect: true },
        context: { sesiune: "schema-v3-s1", nivel_energie: "ridicat" },
        extra: {},
      },
      {
        al_catelea_turn_apasare_pe_buton: 1,
        durata_raspuns_secunde: 1.4,
        fact_id: "mul:7*8=?",
        eq_form: "7*8=?",
        a_raspuns_corect: false,
        extra: { session_id: "schema-v2-s2" },
      },
    ]);

    assert.equal(schemaNoua.raspuns_corect, true);
    assert.equal(schemaNoua.session_id, "schema-v3-s1");
    assert.equal(schemaNoua.nivel_energie, "ridicat");
    assert.equal(schemaActuala.raspuns_corect, false);
    assert.equal(schemaActuala.session_id, "schema-v2-s2");
    assert.equal(schemaActuala.nivel_energie, null);
  });

  it("respinge regulile de filtru necunoscute si aplica marcajele IQR", () => {
    const motor = creeazaMotorMABP();
    assert.throws(
      () =>
        motor.aplicaFiltru([], {
          exclude_din_timp: [
            { tip: "prga_fix", camp: "durata_raspuns_secunde", motiv: "typo" },
          ],
        }),
      /tip necunoscut/i,
    );
    assert.throws(
      () =>
        motor.aplicaFiltru([], {
          exclude_din_timp: [
            {
              tip: "interval",
              camp: "durata_raspuns_secunde",
              min: null,
              max: "",
              motiv: "interval_invalid",
            },
          ],
        }),
      /min si max numerice/i,
    );

    const intrebari = motor.grupeazaApasariPeIntrebari(
      motor.normalizeazaInregistrari(
        [1, 1, 1, 1, 10].map((durata, index) =>
          creeazaLogTest(index, { durata }),
        ),
      ),
    );
    const filtrate = motor.aplicaFiltru(intrebari, {
      marcheaza_fara_excludere: [
        {
          tip: "iqr",
          camp: "durata_raspuns_secunde",
          directie: "superior",
          factor: 1.5,
          motiv: "outlier_marcat",
        },
      ],
    });

    assert.deepEqual(filtrate.observatii.at(-1).marcaje, ["outlier_marcat"]);
    assert.equal(filtrate.sumar.motive.outlier_marcat, 1);
  });

  it("respinge o secventa care incepe cu apasarea 2", () => {
    const motor = creeazaMotorMABP();
    const apasareOrfana = copieJson(loguri[0]);
    apasareOrfana.al_catelea_turn_apasare_pe_buton = 2;

    assert.throws(
      () =>
        motor.grupeazaApasariPeIntrebari(
          motor.normalizeazaInregistrari([apasareOrfana])
        ),
      /apasarea 2.*fara.*apasarea 1/i
    );
  });

  it("reproduce starea curenta a factului 7x8 fara sa modifice datele brute", () => {
    const motor = creeazaMotorMABP();
    const loguriInitiale = copieJson(loguri);
    const configuratie = construiesteConfiguratie("stare_curenta_fact_v1");

    const rezultat = motor.ruleazaAnaliza({ loguri, catalog, configuratie });

    assert.equal(rezultat.tip, "stare_curenta");
    assert.equal(rezultat.grupuri.length, 1);
    assert.equal(rezultat.grupuri[0].id, "mul:7*8=?");
    assert.equal(rezultat.grupuri[0].metrici.n_intrebari, 20);
    assert.equal(rezultat.grupuri[0].metrici.precizie_prima_apasare, 0.95);
    assert.equal(rezultat.grupuri[0].metrici.n_timp, 17);
    assert.equal(
      rezultat.grupuri[0].metrici.mediana_timp_corect_prima_apasare,
      1.8
    );
    assert.deepEqual(valoriPozitive(rezultat.calitate.motive), {
      anticipativ_suspect: 1,
      pauza_probabila: 1,
    });
    assert.deepEqual(loguri, loguriInitiale);
  });

  it("produce privirea generala demonstrativa pentru exact cele sase facts configurate", () => {
    const motor = creeazaMotorMABP();
    const configuratie = construiesteConfiguratie("stare_generala_demo_v1");

    const rezultat = motor.ruleazaAnaliza({ loguri, catalog, configuratie });

    assert.deepEqual(
      rezultat.grupuri.map((grup) => grup.id),
      [
        "mul:7*8=?",
        "mul:6*7=?",
        "mul:5*5=?",
        "mul:9*9=?",
        "mul:4*8=?",
        "mul:2*3=?",
      ],
    );
    assert.deepEqual(
      Object.fromEntries(
        rezultat.grupuri.map((grup) => [
          grup.id,
          { stare: grup.stare, suficienta: grup.suficienta },
        ]),
      ),
      {
        "mul:7*8=?": { stare: "in_consolidare", suficienta: "estimare_utila" },
        "mul:6*7=?": { stare: "in_lucru", suficienta: "estimare_utila" },
        "mul:5*5=?": { stare: "fluent", suficienta: "estimare_utila" },
        "mul:9*9=?": { stare: "in_lucru", suficienta: "estimare_utila" },
        "mul:4*8=?": { stare: "in_consolidare", suficienta: "estimare_utila" },
        "mul:2*3=?": { stare: "in_consolidare", suficienta: "date_insuficiente" },
      },
    );
  });

  it("nu confunda viteza mare cu consolidarea cand precizia este mica", () => {
    const motor = creeazaMotorMABP();
    const loguriRapideDarNesigure = Array.from({ length: 10 }, (_, index) =>
      creeazaLogTest(index, {
        corect: index < 7,
        durata: 1.3,
        factId: "mul:rapid-nesigur=?",
      }),
    );
    const configuratie = construiesteConfiguratie("stare_rapid_nesigur_v1", {
      domeniu: { tip: "fact", fact_id: "mul:rapid-nesigur=?" },
      fereastra: { tip: "toate" },
      filtru_preset: "fara_filtrare_v1",
      metrici: [
        "precizie_prima_apasare",
        "mediana_timp_corect_prima_apasare",
      ],
      rezultat: "stare_curenta",
      vizualizare: "detaliu_fact",
    });

    const rezultat = motor.ruleazaAnaliza({
      loguri: loguriRapideDarNesigure,
      catalog: {},
      configuratie,
    });

    assert.equal(rezultat.grupuri[0].metrici.precizie_prima_apasare, 0.7);
    assert.equal(
      rezultat.grupuri[0].metrici.mediana_timp_corect_prima_apasare,
      1.3,
    );
    assert.equal(rezultat.grupuri[0].stare, "in_lucru");
  });

  it("aplica jumatatile egale numai in fereastra selectata si aliniaza agregatul", () => {
    const motor = creeazaMotorMABP();
    const loguriFereastra = [10, 9, 8, 4, 3, 2].map((durata, index) =>
      creeazaLogTest(index, {
        durata,
        factId: "mul:fereastra=?",
      }),
    );
    const configuratie = construiesteConfiguratie("directie_fereastra_v1", {
      domeniu: { tip: "fact", fact_id: "mul:fereastra=?" },
      fereastra: { tip: "ultimele_raspunsuri", valoare: 4 },
      comparatie: { tip: "jumatati_egale" },
      filtru_preset: "fara_filtrare_v1",
      metrici: ["mediana_timp_corect_prima_apasare"],
      rezultat: "directie",
      vizualizare: "grila_progres",
    });

    const rezultat = motor.ruleazaAnaliza({
      loguri: loguriFereastra,
      catalog: {},
      configuratie,
    });
    const grup = rezultat.grupuri[0];

    assert.equal(grup.comparatie.vechi.n_intrebari, 2);
    assert.equal(grup.comparatie.vechi.mediana_timp_corect_prima_apasare, 6);
    assert.equal(grup.comparatie.nou.n_intrebari, 2);
    assert.equal(grup.comparatie.nou.mediana_timp_corect_prima_apasare, 2.5);
    assert.equal(grup.metrici.n_intrebari, 2);
    assert.equal(rezultat.agregat.metrici.n_intrebari, 2);
    assert.equal(rezultat.calitate.total, 2);
    assert.equal(rezultat.metadata.intrebari_fereastra, 2);
  });

  it("selecteaza prin catalog cele doua forme EFF cu rolul necunoscutei a", () => {
    const motor = creeazaMotorMABP();
    const configuratie = construiesteConfiguratie(
      "explorator_eff_rol_necunoscuta_v1"
    );

    const rezultat = motor.ruleazaAnaliza({ loguri, catalog, configuratie });
    const grupuri = [...rezultat.grupuri].sort((a, b) => a.id.localeCompare(b.id));

    assert.deepEqual(
      grupuri.map((grup) => grup.id),
      ["?*7=21", "21=?*7"].sort((a, b) => a.localeCompare(b))
    );
    assert.deepEqual(
      Object.fromEntries(
        grupuri.map((grup) => [
          grup.id,
          {
            n: grup.metrici.n_intrebari,
            mediana: grup.metrici.mediana_timp_corect_prima_apasare,
          },
        ])
      ),
      {
        "?*7=21": { n: 10, mediana: 2.2 },
        "21=?*7": { n: 10, mediana: 2.3 },
      }
    );
    assert.equal(
      grupuri[0].serie[0].metrica,
      "mediana_timp_corect_prima_apasare",
    );
    assert.equal(grupuri[0].serie[0].unitate, "s");
  });

  it("reproduce clasificarile dummy prin doua jumatati egale", () => {
    const motor = creeazaMotorMABP();
    const configuratie = construiesteConfiguratie("directie_dummy_v1", {
      domeniu: { tip: "toate" },
      fereastra: { tip: "toate" },
      comparatie: { tip: "jumatati_egale" },
      filtru_preset: "fluenta_standard_v1",
      metrici: [
        "precizie_prima_apasare",
        "mediana_timp_corect_prima_apasare",
      ],
      agregare: { unitate: "fact", statistica_timp: "mediana" },
      rezultat: "directie",
      vizualizare: "grila_progres",
    });

    const rezultat = motor.ruleazaAnaliza({ loguri, catalog, configuratie });
    const clasificariFixture = Object.fromEntries(
      Object.keys(asteptari.expected_classifications).map((factId) => [
        factId,
        rezultat.clasificari[factId],
      ])
    );

    assert.deepEqual(clasificariFixture, asteptari.expected_classifications);
  });

  it("permite o axa si o interpretare custom fara schimbarea nucleului", () => {
    let apeluriAxa = 0;
    let apeluriInterpretare = 0;
    const motor = creeazaMotorMABP({
      axe: {
        custom: ({ intrebare, definitie, catalog: catalogPrimit }) => {
          apeluriAxa += 1;
          assert.equal(catalogPrimit, catalog);
          return (
            (intrebare.scenario ?? intrebare.extra?.scenario) === definitie.scenario
          );
        },
      },
      interpretari: {
        custom: ({ metriciCurente, configuratie }) => {
          apeluriInterpretare += 1;
          assert.equal(configuratie.interpretare.tip, "custom");
          return `custom_${metriciCurente.n_intrebari}_intrebare`;
        },
      },
    });
    const configuratie = construiesteConfiguratie("extensie_custom_v1", {
      domeniu: { tip: "custom", scenario: "three_presses" },
      fereastra: { tip: "toate" },
      comparatie: { tip: "jumatati_egale" },
      filtru_preset: "fara_filtrare_v1",
      metrici: ["precizie_prima_apasare"],
      rezultat: "directie",
      interpretare: { tip: "custom" },
      vizualizare: "test",
    });

    const rezultat = motor.ruleazaAnaliza({ loguri, catalog, configuratie });

    assert.ok(apeluriAxa > 0);
    assert.equal(apeluriInterpretare, 1);
    assert.equal(rezultat.grupuri.length, 1);
    assert.equal(rezultat.grupuri[0].id, "mul:8*9=?");
    assert.equal(
      rezultat.grupuri[0].comparatie.directie,
      "custom_1_intrebare"
    );
  });

  it("materializeaza tabla 1–10 pe coordonatele catalogate, inclusiv celulele netestate", () => {
    const tabla = catalog.tables?.["mul:1-10x1-10"];
    assert.ok(tabla, "Catalogul trebuie să declare explicit tabla 1–10 × 1–10.");
    assert.equal(tabla.celule.length, 100);
    assert.equal(
      new Set(tabla.celule.map(({ rand, coloana }) => `${rand}:${coloana}`)).size,
      100,
      "Fiecare coordonată trebuie să apară exact o dată în catalog.",
    );

    const motor = creeazaMotorMABP();
    const configuratie = construiesteConfiguratie(
      "stare_tabla_inmultirii_1_10_v1",
    );

    const rezultat = motor.ruleazaAnaliza({ loguri, catalog, configuratie });
    assert.equal(rezultat.aranjare.tip, "matrice");
    assert.equal(rezultat.aranjare.table_id, "mul:1-10x1-10");
    assert.equal(rezultat.aranjare.eticheta, tabla.eticheta);
    assert.deepEqual(rezultat.aranjare.randuri, tabla.randuri);
    assert.deepEqual(rezultat.aranjare.coloane, tabla.coloane);
    assert.equal(rezultat.grupuri.length, 100);
    assert.equal(rezultat.metadata.numar_celule, 100);
    assert.equal(Object.keys(rezultat.clasificari).length, 100);

    const pozitii = new Set(
      rezultat.grupuri.map(({ pozitie }) => `${pozitie?.rand}:${pozitie?.coloana}`),
    );
    assert.equal(pozitii.size, 100);

    const sapteOriOpt = rezultat.grupuri.find(
      ({ pozitie }) => pozitie?.rand === 7 && pozitie?.coloana === 8,
    );
    assert.equal(sapteOriOpt.id, "mul:7*8=?");
    assert.deepEqual(sapteOriOpt.pozitie, { rand: 7, coloana: 8 });
    assert.ok(sapteOriOpt.metrici.n_intrebari > 0);

    const netestata = rezultat.grupuri.find(
      ({ pozitie }) => pozitie?.rand === 1 && pozitie?.coloana === 1,
    );
    assert.equal(netestata.metrici.n_intrebari, 0);
    assert.equal(netestata.stare, "netestat");
    assert.equal(netestata.suficienta, "netestat");
  });

  it("agrega formele EFF în celula canonică 3×7 fără a dubla poziția", () => {
    const motor = creeazaMotorMABP();
    const configuratie = construiesteConfiguratie("tabla_canonica_eff_v1", {
      domeniu: { tip: "tabla", id: "mul:1-10x1-10" },
      fereastra: { tip: "toate" },
      filtru_preset: "fara_filtrare_v1",
      metrici: ["precizie_prima_apasare"],
      rezultat: "stare_curenta",
      vizualizare: "grila_adaptiva",
    });
    const formeCanoniceTreiOriSapte = new Set([
      "mul:3*7=?",
      "mul:?*7=21",
      "mul:21=?*7",
      "mul:3*?=21",
      "mul:21=3*?",
    ]);
    const intrebari = motor.grupeazaApasariPeIntrebari(
      motor.normalizeazaInregistrari(loguri),
    );
    const numarAsteptat = intrebari.filter((intrebare) =>
      formeCanoniceTreiOriSapte.has(intrebare.fact_id),
    ).length;

    const rezultat = motor.ruleazaAnaliza({ loguri, catalog, configuratie });
    const celuleTreiOriSapte = rezultat.grupuri.filter(
      ({ pozitie }) => pozitie?.rand === 3 && pozitie?.coloana === 7,
    );

    assert.equal(celuleTreiOriSapte.length, 1);
    assert.equal(celuleTreiOriSapte[0].id, "mul:3*7=?");
    assert.equal(celuleTreiOriSapte[0].metrici.n_intrebari, numarAsteptat);
    assert.ok(numarAsteptat > 0);
  });

  it("respinge o mapare cell_id invalidă în loc să omită întrebări în tăcere", () => {
    const catalogInvalid = copieJson(catalog);
    catalogInvalid.facts["mul:7*8=?"].cell_id = "mul:99*99=?";
    const configuratie = construiesteConfiguratie(
      "stare_tabla_inmultirii_1_10_v1",
    );

    assert.throws(
      () => creeazaMotorMABP().ruleazaAnaliza({
        loguri,
        catalog: catalogInvalid,
        configuratie,
      }),
      (eroare) => eroare?.cod === "MAPARE_CELULA_INVALIDA",
    );
  });

  it("foloseste același contract pentru o tablă inline de 20 rânduri × 10 coloane", () => {
    const randuri = Array.from({ length: 20 }, (_, index) => index + 1);
    const coloane = Array.from({ length: 10 }, (_, index) => index + 11);
    const catalogExtins = creeazaCatalogTabla({
      tableId: "mul:11-20x1-20",
      eticheta: "Tabla înmulțirii 11–20 × 1–20",
      randuri,
      coloane,
    });
    const configuratie = construiesteConfiguratie("tabla_11_20_v1", {
      domeniu: { tip: "tabla", id: "mul:11-20x1-20" },
      fereastra: { tip: "toate" },
      filtru_preset: "fara_filtrare_v1",
      metrici: ["precizie_prima_apasare"],
      rezultat: "stare_curenta",
      vizualizare: "grila_adaptiva",
    });

    const rezultat = creeazaMotorMABP().ruleazaAnaliza({
      loguri: [],
      catalog: catalogExtins,
      configuratie,
    });

    assert.equal(rezultat.grupuri.length, 200);
    assert.deepEqual(rezultat.aranjare.randuri, randuri);
    assert.deepEqual(rezultat.aranjare.coloane, coloane);
    assert.deepEqual(
      rezultat.grupuri.find(({ id }) => id === "mul:1*11=?").pozitie,
      { rand: 1, coloana: 11 },
    );
    assert.deepEqual(
      rezultat.grupuri.find(({ id }) => id === "mul:20*20=?").pozitie,
      { rand: 20, coloana: 20 },
    );
    assert.ok(
      rezultat.grupuri.every(
        (grup) =>
          grup.metrici.n_intrebari === 0 &&
          grup.stare === "netestat" &&
          grup.suficienta === "netestat",
      ),
    );
  });
});
