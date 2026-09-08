// Test de contract (cerere user, 09.09.2026): "Testeaza doar subquizul" e un
// selector generic care CONSUMA variantele user-facing dintr-o sursa
// canonica (lista de SubquizDefinition inregistrata in createOrchestrator(),
// filtrata dupa userSelectable:true), nu o lista administrativa separata.
//
// Verifica RUNTIME, pe obiectele reale (nu grep static de nume):
//   1. lista expusa de getSubquizStartOptions() corespunde variantelor
//      user-facing chiar declarate (userSelectable:true) pe definitii;
//   2. fiecare optiune poate fi selectata (setSubquizStartOption intoarce true);
//   3. selectarea ei produce EFECTIV rularea acelei variante — inclusiv
//      dupa ce varianta isi termina singura un ciclu intern (pop -> re-push
//      automat, nu doar prima runda);
//   4. "----" (== "base") revine la progresia normala;
//   5. share-link (simulat prin campul CP real + localStorage) restaureaza
//      atat selectia vizuala, cat si comportamentul.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function setupLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

function resetGlobals() {
  delete globalThis.GameUtils;
  delete globalThis.ProgressDisplay;
  delete globalThis.QuizRegistry;
  delete globalThis.FactCatalog;
  delete globalThis.FactWindowSequencer;
  delete globalThis.ItemGenerator;
  delete globalThis.SubquizDefinition;
  delete globalThis.SubquizOrchestrator;
  delete globalThis.SubquizForcedSelection;
  delete globalThis.Motor3Butoane;
  delete globalThis.Mul1120V3TrainEffEqFormsQuiz;
  delete globalThis.Mul1120V4IntensivMultipli234Quiz;
  delete globalThis.MotorOptiuniControlPanel;
}

// Toate factele "fluente" — necesar ca sq5 (v4) sa aiba ceva de jucat cand e
// fortat, exact ca in tests/subquiz-convergenta-la-base.test.js.
const FLUENTA_TOATE = { scorPtFact: () => 0, starePtFact: () => "fluent" };

function setupQuizV3Jurnal(localStorageSeed = {}) {
  resetGlobals();
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage(localStorageSeed);
  [
    "js/utils.js",
    "js/placeholder-raspuns.js",
    "js/schimbare-de-nivel.js",
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/motor-optiuni-control-panel.js",
    "js/fact-catalog.js",
    "js/fact-window-sequencer.js",
    "js/eff/qf-generator.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/subquiz/subquiz-forced-selection.js",
    "js/motor-3-butoane.js",
    "js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js",
    "js/quizzes/multiplication-1120-v3-train-eff-eq-forms-jurnal.js",
  ].forEach(loadScript);
  globalThis.GameUtils.shuffle = (items) => [...items];
  const meta = globalThis.QuizRegistry.get("multiplication-1120-v3-train-eff-eq-forms-jurnal");
  return meta.create({ ...meta, random: () => 0 });
}

// Implicit: nimic fluent (la fel ca setup-ul din
// subquiz-convergenta-la-base.test.js) — asa "progresia normala" e lipsita
// de ambiguitate (intra direct in "base", fara ca "levelStart" al lui sq5
// sa preia primul pas). FLUENTA_TOATE se paseaza explicit doar unde sq5
// chiar trebuie sa aiba facte de jucat.
function setupQuizV4Intensiv(localStorageSeed = {}, fluentaSursa = { scorPtFact: () => 0 }) {
  resetGlobals();
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage(localStorageSeed);
  [
    "js/utils.js",
    "js/placeholder-raspuns.js",
    "js/schimbare-de-nivel.js",
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/motor-optiuni-control-panel.js",
    "js/fact-catalog.js",
    "js/fact-window-sequencer.js",
    "js/eff/qf-generator.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/subquiz/subquiz-forced-selection.js",
    "js/motor-3-butoane.js",
    "js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js",
  ].forEach(loadScript);
  globalThis.GameUtils.shuffle = (items) => [...items];
  return globalThis.Mul1120V4IntensivMultipli234Quiz.create({ random: () => 0, fluentaSursa });
}

function answerCorrect(quiz, round) {
  return quiz.onAnswer(round.correctIndex, { responseMs: 500 });
}

// Citeste campul CP real prin contractul canonic — exact traseul folosit de
// share-link (nu API separat).
function campSubquizStart(quiz) {
  const sectiune = quiz.controlPanel.sectiuni.find((s) => s.id === "subquizStart");
  assert.ok(sectiune, `sectiunea CP "subquizStart" trebuie sa existe`);
  return sectiune.creeazaCampuri({}).find((c) => c.cheie === "subquizStart");
}

// Ruleaza `pasi` raspunsuri corecte si verifica, la FIECARE runda (inclusiv
// dupa ce varianta isi termina singura un ciclu intern si e re-impinsa
// automat), ca subquizul ramane exact `id` — nu doar la prima runda.
function verificaRamaneExclusiv(quiz, id, pasi) {
  let round = quiz.beginRound();
  assert.equal(round.metadata.subquiz, id, `prima runda dupa selectarea "${id}" trebuia sa fie chiar ${id}`);
  for (let i = 0; i < pasi; i += 1) {
    round = answerCorrect(quiz, round);
    round = round.nextRound ?? round;
    assert.equal(
      round.metadata.subquiz,
      id,
      `dupa ${i + 1} raspunsuri corecte, "${id}" fiind fortat, subquizul nu trebuia sa se schimbe (a devenit "${round.metadata.subquiz}")`
    );
  }
}

describe("Testeaza doar subquizul: sursa canonica + selectare exclusiva", () => {
  describe("v3-jurnal (multiplication-1120-v3-train-eff-eq-forms-jurnal)", () => {
    it("1) lista expusa corespunde variantelor user-facing declarate", () => {
      const quiz = setupQuizV3Jurnal();
      const optiuni = quiz.getSubquizStartOptions();
      assert.deepEqual(
        optiuni.map((o) => o.id),
        ["base", "sq2EffVbs", "sq2EffSbs"]
      );
      optiuni.forEach((o) => assert.equal(typeof o.label, "string"));
    });

    it("2+3) fiecare optiune poate fi selectata si produce rularea ei exclusiva", () => {
      const quiz = setupQuizV3Jurnal();
      for (const id of ["sq2EffVbs", "sq2EffSbs"]) {
        assert.equal(quiz.setSubquizStartOption(id), true, `setSubquizStartOption("${id}") trebuia sa reuseasca`);
        verificaRamaneExclusiv(quiz, id, 40);
      }
    });

    it("4) '----' (== base) revine la progresia normala", () => {
      const quiz = setupQuizV3Jurnal();
      quiz.setSubquizStartOption("sq2EffVbs");
      let round = quiz.beginRound();
      assert.equal(round.metadata.subquiz, "sq2EffVbs");

      assert.equal(quiz.setSubquizStartOption("base"), true);
      round = quiz.beginRound();
      assert.equal(round.metadata.subquiz, "base", "dupa '----', prima runda trebuia sa fie din nou din base");
    });

    it("5) share-link restaureaza SELECTIA si COMPORTAMENTUL, nu doar vizual", () => {
      const quiz1 = setupQuizV3Jurnal();
      const camp1 = campSubquizStart(quiz1);
      camp1.set("sq2EffSbs");
      assert.equal(camp1.get(), "sq2EffSbs", "campul CP trebuia sa retina noua selectie");

      // "share-link": alt quiz, pornit cu ACEEASI valoare in localStorage
      // (exact ce face round-trip-ul real prin ?cfg=).
      const quiz2 = setupQuizV3Jurnal({ "yl:mul1120v3:subquizStart": "sq2EffSbs" });
      const camp2 = campSubquizStart(quiz2);
      assert.equal(camp2.get(), "sq2EffSbs", "campul CP din sesiunea noua trebuia sa arate aceeasi selectie");

      verificaRamaneExclusiv(quiz2, "sq2EffSbs", 20);
    });
  });

  describe("v4-intensiv (multiplication-1120-v4-intensiv-multipli-234)", () => {
    it("1) lista expusa corespunde variantelor user-facing declarate", () => {
      const quiz = setupQuizV4Intensiv();
      const optiuni = quiz.getSubquizStartOptions();
      assert.deepEqual(
        optiuni.map((o) => o.id),
        ["base", "sq3FactorGroup", "sq2EffVbs", "sq2EffSbs", "sq5FluentParty"]
      );
      optiuni.forEach((o) => assert.equal(typeof o.label, "string"));
    });

    it("2+3) fiecare optiune poate fi selectata si produce rularea ei exclusiva — inclusiv SQ2 VBS/SBS, desi azi nu intra in progresia pedagogica normala", () => {
      const quiz = setupQuizV4Intensiv({}, FLUENTA_TOATE);
      for (const id of ["sq3FactorGroup", "sq2EffVbs", "sq2EffSbs"]) {
        assert.equal(quiz.setSubquizStartOption(id), true, `setSubquizStartOption("${id}") trebuia sa reuseasca`);
        verificaRamaneExclusiv(quiz, id, 40);
      }
      // sq5 are nevoie de mai multi pasi (turns per fact x cate facte fluente
      // exista) ca sa apuce sa se termine singur macar o data.
      assert.equal(quiz.setSubquizStartOption("sq5FluentParty"), true);
      verificaRamaneExclusiv(quiz, "sq5FluentParty", 90);
    });

    // Principiu (cerere user, 09.09.2026): forced selection alege DOAR CE
    // subquiz ruleaza, niciodata CUM isi alege el continutul. sq5 ("Fluent
    // party") e definit explicit sa opereze pe facte DEJA fluente — filtrarea
    // e insasi identitatea lui, nu un detaliu de implementare (vezi
    // comentariul din sursa, langa "Subquiz 5 (Fluent party)"). Doua cazuri:

    it("sq5 fortat CU fluenta: foloseste DOAR factele fluente, nu tot domeniul nivelului", () => {
      // Doar b in {2,3,4} sunt fluente — daca fortarea ar ignora regula
      // interna (cum se intampla inainte de fix), am vedea si alte factB.
      const fluentaPartiala = {
        scorPtFact: () => 0,
        starePtFact: (a, b) => ([2, 3, 4].includes(b) ? "fluent" : "netestat"),
      };
      const quiz = setupQuizV4Intensiv({}, fluentaPartiala);
      assert.equal(quiz.setSubquizStartOption("sq5FluentParty"), true);
      let round = quiz.beginRound();
      assert.equal(round.metadata.subquiz, "sq5FluentParty");
      for (let i = 0; i < 25; i += 1) {
        assert.ok(
          [2, 3, 4].includes(round.metadata.factB),
          `factB=${round.metadata.factB} nu trebuia sa apara — sq5 fortat trebuia sa respecte filtrul de fluenta, nu tot domeniul`
        );
        round = answerCorrect(quiz, round);
        round = round.nextRound ?? round;
      }
    });

    // Regresie (gasita la verificarea live, nu in acest test node): sq5,
    // fortat, NU mai primeste "toate cele 20 de facts" ca fallback (asta ERA
    // bug-ul — schimba regula interna a lui sq5 doar ca sa aiba ce rula).
    //
    // A DOUA corectie (09.09.2026): nici runda "explicativa" (options goale,
    // prin orchestrator) — prima varianta, respinsa de user: nu e o
    // intrebare, deci n-are ce cauta in fluxul de raspuns. Comportamentul
    // final: sq5 nu porneste deloc (getForcedId cade pe null, exact ca la
    // "----"), base ruleaza normal ca subquiz REAL (nu un substitut fals),
    // iar developerul e informat STRICT prin alert() — niciodata prin vreo
    // rundă/pseudo-intrebare.
    it("sq5 fortat FARA nicio fluenta: nu porneste, base ruleaza normal, developerul e alertat o singura data (nu o runda)", () => {
      const quiz = setupQuizV4Intensiv();
      let alerte = 0;
      let ultimulMesaj = null;
      globalThis.alert = (msg) => {
        alerte += 1;
        ultimulMesaj = msg;
      };

      assert.equal(quiz.setSubquizStartOption("sq5FluentParty"), true);
      let round = quiz.beginRound();

      assert.equal(
        round.metadata.subquiz,
        "base",
        "fara fluenta, sq5 nu trebuia sa porneasca — base trebuia sa ruleze normal, ca subquiz real"
      );
      assert.equal(
        round.metadata.sq5FaraFacteEligibile,
        undefined,
        "nu mai trebuie sa existe nicio pseudo-runda cu acest marcaj"
      );
      assert.ok(
        Array.isArray(round.options) && round.options.every((o) => o !== ""),
        "runda din base trebuia sa aiba optiuni REALE, nu goale — nu e o pseudo-intrebare"
      );
      assert.equal(alerte, 1, "developerul trebuia alertat exact o data la selectare");
      assert.match(ultimulMesaj, /Vizualizare 3/, "mesajul trebuia sa indice mecanismul existent din Vizualizare 3");

      // Raspunsuri corecte in base (posibil cu reveniri naturale prin
      // push/pop spre alte subquiz-uri, ex. sq3) NU mai trebuie sa
      // declanseze alerta — developerul a fost deja informat o data, nu se
      // repeta la fiecare revenire naturala in base.
      for (let i = 0; i < 30; i += 1) {
        round = answerCorrect(quiz, round);
        round = round.nextRound ?? round;
      }
      assert.equal(alerte, 1, "alerta nu trebuia sa se repete in timp ce base ruleaza normal");
    });

    it("4) '----' (== base) revine la progresia normala", () => {
      const quiz = setupQuizV4Intensiv();
      quiz.setSubquizStartOption("sq3FactorGroup");
      let round = quiz.beginRound();
      assert.equal(round.metadata.subquiz, "sq3FactorGroup");

      assert.equal(quiz.setSubquizStartOption("base"), true);
      round = quiz.beginRound();
      assert.equal(round.metadata.subquiz, "base", "dupa '----', prima runda trebuia sa fie din nou din base");
    });

    it("5) share-link restaureaza SELECTIA si COMPORTAMENTUL, nu doar vizual", () => {
      const quiz1 = setupQuizV4Intensiv({}, FLUENTA_TOATE);
      const camp1 = campSubquizStart(quiz1);
      camp1.set("sq5FluentParty");
      assert.equal(camp1.get(), "sq5FluentParty");

      const quiz2 = setupQuizV4Intensiv({ "yl:mul1120v4:subquizStart": "sq5FluentParty" }, FLUENTA_TOATE);
      const camp2 = campSubquizStart(quiz2);
      assert.equal(camp2.get(), "sq5FluentParty", "campul CP din sesiunea noua trebuia sa arate aceeasi selectie");

      verificaRamaneExclusiv(quiz2, "sq5FluentParty", 60);
    });
  });
});
