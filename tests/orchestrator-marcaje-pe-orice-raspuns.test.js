// Test-santinela pentru invariantul celor doua garduri din js/falling-engine.js:
//
//   ORICE rezultat care iese din `quiz.onAnswer(...)` poarta AMBELE marcaje —
//   semnatura Motor3Butoane (`motor3Butoane`) si semnatura SubquizOrchestrator
//   (`subquizEvent`) — la fiecare apasare, inclusiv la tranzitiile de rutare.
//
// Doua bug-uri reale, gasite abia in joc (21.08.2026), amandoua invizibile
// pentru testele existente pentru ca acelea verifica CE intrebare urmeaza, nu
// marcajele rezultatului:
//
//   1. La avansul de nivel, cele 3 quizuri cu rute reale prindeau semnalul
//      `routeComplete` si inlocuiau rezultatul orchestratorului cu unul
//      construit de mana — fara `subquizEvent`. Gardul §12 arunca, deci
//      `applyAnswerResult` nu mai rula: ecranul ramanea pe intrebarea veche,
//      cu butoanele active, dupa ce starea trecuse deja la nivelul nou.
//      Simptom raportat: "dupa alerta de nivel mai apare o intrebare din
//      subtabla veche".
//   2. La revenirea din sq3 (`pop`), vederea vine din `onResume`, care nu
//      trece prin M3B — deci rezultatul pierdea `motor3Butoane` si arunca
//      primul gard, cu acelasi simptom, fara alerta.
//
// Testul parcurge quizurile REALE, cu raspunsuri corecte, pana dupa o
// schimbare de nivel, si verifica marcajele la fiecare pas. Ambele bug-uri
// pica aici daca revin. Vezi documente de referinta/RAPORT-motor-comun-raspuns.md.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function setupLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

const SCRIPTURI_COMUNE = [
  "js/utils.js",
  "js/placeholder-raspuns.js",
  "js/schimbare-de-nivel.js",
  "js/progress-display.js",
  "js/quiz-registry.js",
  "js/fact-catalog.js",
  "js/fact-window-sequencer.js",
  "js/eff/qf-generator.js",
  "js/subquiz/item-generator.js",
  "js/subquiz/subquiz-definition.js",
  "js/subquiz/subquiz-orchestrator.js",
  "js/motor-3-butoane.js",
];

function incarca(fisierQuiz) {
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage();
  [...SCRIPTURI_COMUNE, fisierQuiz].forEach(loadScript);
  globalThis.GameUtils.shuffle = (items) => [...items];
  globalThis.GameUtils.randomInt = (min) => min;
}

// Cele 3 quizuri cu rute reale (push/pop/exit intre subquizuri) — singurele
// care ajung vreodata la `routeComplete`, deci singurele care puteau pierde
// marcajele la avansul de nivel.
const QUIZURI = [
  {
    nume: "multiplication-1120-v2-modular.js (T*/ 11-20 v2 - Clonat - Modular)",
    fisier: "js/quizzes/multiplication-1120-v2-modular.js",
    creeaza: () => {
      const meta = globalThis.QuizRegistry.get("multiplication-1120-v2-modular");
      return meta.create(meta);
    },
  },
  {
    nume: "multiplication-1120-v3-train-eff-eq-forms.js (T*/ 11-20 - v3 - antrenez EFF, forme de ecuatie)",
    fisier: "js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js",
    creeaza: () =>
      globalThis.Mul1120V3TrainEffEqFormsQuiz.create({
        quizId: "multiplication-1120-v3-train-eff-eq-forms",
        random: () => 0,
      }),
  },
  {
    nume: "multiplication-1120-v4-intensiv-multipli-234.js (T*/ 11-20 - v4 - bag toate in joc, intensiv multipli 2 3 4)",
    fisier: "js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js",
    creeaza: () =>
      globalThis.Mul1120V4IntensivMultipli234Quiz.create({
        random: () => 0,
        fluentaSursa: { scorPtFact: () => 0 },
      }),
  },
];

describe("Orice raspuns poarta ambele marcaje (garduri falling-engine.js)", () => {
  beforeEach(() => {
    [
      "QuizRegistry",
      "GameUtils",
      "ProgressDisplay",
      "FactCatalog",
      "FactWindowSequencer",
      "QFGenerator",
      "ItemGenerator",
      "SubquizDefinition",
      "SubquizOrchestrator",
      "Motor3Butoane",
      "Mul1120V2ModularQuiz",
      "Mul1120V3TrainEffEqFormsQuiz",
      "Mul1120V4IntensivMultipli234Quiz",
    ].forEach((nume) => delete globalThis[nume]);
  });

  QUIZURI.forEach(({ nume, fisier, creeaza }) => {
    it(`${nume}: marcajele rezista pana dupa o schimbare de nivel`, () => {
      incarca(fisier);
      const quiz = creeaza();

      let runda = quiz.beginRound();
      let schimbariDeNivel = 0;
      let tranzitiiDeRutare = 0;
      let pasi = 0;

      // Ne oprim la a DOUA schimbare de nivel: prima dovedeste ca marcajele
      // supravietuiesc lui `routeComplete`, a doua ca si nivelul reconstruit
      // (orchestrator nou) le pastreaza.
      while (schimbariDeNivel < 2 && pasi < 400 && !quiz.isCompleted()) {
        pasi += 1;
        const rezultat = quiz.onAnswer(runda.correctIndex, { responseMs: 500 });

        // Exact ce verifica cele doua garduri din js/falling-engine.js.
        assert.ok(
          globalThis.Motor3Butoane.esteRezultatValid(rezultat),
          `pasul ${pasi}: rezultat fara semnatura Motor3Butoane ` +
            `(subquizEvent.action=${rezultat?.subquizEvent?.action})`
        );
        assert.ok(
          rezultat?.subquizEvent,
          `pasul ${pasi}: rezultat fara subquizEvent (outcome=${rezultat?.outcome})`
        );

        if (rezultat.subquizEvent.subquizChanged || rezultat.subquizEvent.routeComplete) {
          tranzitiiDeRutare += 1;
        }
        if (rezultat.levelAdvanced) schimbariDeNivel += 1;

        runda = rezultat.nextRound ?? rezultat;
      }

      // Fara astea, testul ar putea trece degeaba (bucla oprita devreme).
      assert.equal(schimbariDeNivel, 2, "trebuia sa se schimbe nivelul de doua ori");
      assert.ok(
        tranzitiiDeRutare > 0,
        "trebuia sa treaca si prin tranzitii de rutare (push/pop/exit), nu doar prin pasi obisnuiti"
      );
    });
  });

  // Gaura gasita abia la verificarea in browser, dupa ce prima varianta a
  // fixului parea completa: la "pop", daca `onResume` cere el insusi o rutare
  // (v4 iese din nivel asa, cand sq3 a completat acoperirea), orchestratorul
  // recurseaza cu comanda LUI — care nu vine din M3B, deci e nesemnata.
  // Semnatura trebuie sa vina de la comanda originala, oricat de adanca e
  // recursia. Testul de mai sus, pe quizurile reale, NU prindea asta: cu
  // `random: () => 0` nivelul se termina mereu in subquizul de baza.
  it("semnatura rezista si cand `onResume` cere el insusi o rutare (recursie la pop)", () => {
    incarca("js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js");

    const baza = globalThis.SubquizDefinition.define({
      id: "base",
      title: "baza",
      generator: () => ({ prompt: "1+1=?", options: ["2", "3", "4"], correctIndex: 0 }),
      // La revenirea din "extra", baza declara ca s-a terminat ruta.
      onResume: () => ({ action: "exit", reason: "gataDupaExtra" }),
      actiuni: { dupaRaspunsCorect: () => ({ action: "push", targetId: "extra" }) },
    });
    const extra = globalThis.SubquizDefinition.define({
      id: "extra",
      title: "extra",
      generator: () => ({ prompt: "2+2=?", options: ["4", "5", "6"], correctIndex: 0 }),
      actiuni: { dupaRaspunsCorect: () => ({ action: "pop", reason: "extraGata" }) },
    });

    const orchestrator = globalThis.SubquizOrchestrator.create({
      definitions: [baza, extra],
      activeSubquizIds: ["base"],
      onRouteComplete: () => ({ outcome: "serie-terminata", correct: true, levelAdvanced: true }),
      context: {},
    });
    orchestrator.startFirst();

    const intrat = orchestrator.onAnswer(0, {}); // baza corect -> push in "extra"
    assert.equal(intrat.subquizEvent.action, "push");
    assert.ok(globalThis.Motor3Butoane.esteRezultatValid(intrat), "push: semnatura pierduta");

    // "extra" corect -> pop -> onResume cere "exit" -> ruta se termina.
    const iesit = orchestrator.onAnswer(0, {});
    assert.equal(iesit.subquizEvent.routeComplete, true, "ruta trebuia sa se termine prin recursia din pop");
    assert.ok(
      globalThis.Motor3Butoane.esteRezultatValid(iesit),
      "semnatura M3B trebuie sa supravietuiasca recursiei prin comanda nesemnata a lui onResume"
    );
    assert.equal(iesit.levelAdvanced, true, "rezultatul din onRouteComplete trebuie sa ajunga la apelant");
  });

  it("un raspuns fara subquiz pornit arunca explicit, nu intoarce un rezultat nesemnat", () => {
    incarca("js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js");
    const orchestrator = globalThis.SubquizOrchestrator.create({
      definitions: [
        globalThis.SubquizDefinition.define({ id: "base", title: "baza", generator: () => ({}) }),
      ],
      activeSubquizIds: ["base"],
      context: {},
    });

    // Nimeni n-a chemat startFirst()/start(): raspunsul n-ar avea prin ce sa
    // treaca. Inainte se intorcea tacit o intrebare noua, nesemnata, care
    // crapa mai tarziu in gard — departe de cauza.
    assert.throws(
      () => orchestrator.onAnswer(0, {}),
      /fara niciun subquiz pornit/,
      "trebuie sa spuna direct ce e stricat, in loc sa intoarca un rezultat nesemnat"
    );
  });
});
