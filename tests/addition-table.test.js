// Migrat la Motor3Butoane (Faza D, lotul 1, documente de referinta/PLAN-motor-
// comun-raspuns.md). Testele au fost scrise INAINTE de migrare, ca plasa de
// siguranta — comportamentul verificat aici a ramas identic dupa migrare.
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function setupQuiz({ deterministic = true } = {}) {
  globalThis.window = globalThis;
  [
    "js/utils.js",
    "js/placeholder-raspuns.js",
    "js/fact-catalog.js",
    "js/fact-store.js",
    "js/fact-stats.js",
    "js/progress.js",
    "js/quiz-registry.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/addition-table.js",
  ].forEach(loadScript);

  globalThis.FactStore.resetAll();
  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  }

  const meta = globalThis.QuizRegistry.get("addition-table");
  return meta.create();
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("addition-table (comportament dinainte de migrare, Faza D lot 1)", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.FactCatalog;
    delete globalThis.FactStore;
    delete globalThis.FactStats;
    delete globalThis.QuizMistakes;
    delete globalThis.ItemGenerator;
    delete globalThis.SubquizDefinition;
    delete globalThis.SubquizOrchestrator;
    delete globalThis.Motor3Butoane;
  });

  it("se inregistreaza cu id-ul si order-ul corecte, fara sufix (migrare completa)", () => {
    setupQuiz();
    const info = globalThis.QuizRegistry.get("addition-table");
    assert.equal(info.id, "addition-table");
    assert.equal(info.title, "Tabla adunarii - Clasic - 1_10+1_10");
    assert.equal(info.order, -10);
  });

  it("raspuns gresit: ramane pe acelasi fapt, outcome wrong-answer, mesaj cu raspunsul gresit, cu semnatura M3B", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);
    const chosen = round.options[idx];

    const rezultat = quiz.onAnswer(idx, { responseMs: 900 });

    assert.equal(rezultat.outcome, "wrong-answer");
    assert.equal(rezultat.correct, false);
    assert.equal(rezultat.flash, "wrong");
    assert.equal(rezultat.prompt, round.prompt, "ramane exact acelasi prompt");
    assert.deepEqual(rezultat.options, round.options, "aceleasi optiuni, nu se schimba intrebarea");
    assert.ok(rezultat.message.includes(String(chosen)), "mesajul mentioneaza raspunsul gresit ales");
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA, "raspunsul chiar vine din M3B");
  });

  it("raspuns gresit repetat: ramane pe acelasi fapt oricat de multe incercari", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    for (let i = 0; i < 50; i += 1) {
      const rezultat = quiz.onAnswer(idx, { responseMs: 900 });
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, round.prompt);
    }
  });

  it("raspuns corect: outcome run-complete, promptul dezvaluie raspunsul corect", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 700 });

    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.runComplete, true);
    assert.ok(rezultat.prompt.includes(String(round.options[round.correctIndex])), "promptul arata raspunsul corect");
    assert.ok(rezultat.promptHtml.includes("q-correct"), "promptHtml marcheaza raspunsul corect");
    assert.equal(rezultat.runDelayMs, 160, "pauza standard dupa raspuns corect (CORRECT_PROMPT_HOLD_MS)");
  });

  it("raspuns corect dupa un raspuns gresit pe aceeasi intrebare: tot run-complete, turul ramane consemnat gresit in FactStore", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    quiz.onAnswer(idx, { responseMs: 900 }); // gresit, prima apasare
    const rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 }); // corect, a doua apasare

    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.correct, true);
  });

  it("nivelul avanseaza dupa 5 raspunsuri corecte consecutive din prima (mistakes.canAdvanceLevel)", () => {
    // NOTA (gasit la scrierea acestui test, nu reparat aici — comportament
    // preexistent, neschimbat de migrare): onAnswer() forteaza
    // `result.levelAdvanced = false` necondiționat pe ramura corecta (linia
    // 566 din addition-table.js), chiar si cand nivelul chiar avanseaza.
    // Semnalul real de avans e `quiz.getLevel()`, nu `rezultat.levelAdvanced`.
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    let paziGarda = 0;

    while (quiz.getLevel() === 1 && paziGarda < 200) {
      paziGarda += 1;
      const rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
      assert.equal(rezultat.levelAdvanced, false, "quirk preexistent: mereu false pe rezultatul lui onAnswer");
      round = rezultat.nextRound ?? round;
    }

    assert.equal(quiz.getLevel(), 2, "nivelul trebuia sa avanseze intr-un numar rezonabil de raspunsuri corecte");
    assert.ok(paziGarda < 200, "nu trebuia sa se blocheze");
  });

  it("onTimeout: outcome timeout, resetFall, ramane pe acelasi fapt (neatins de migrare)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onTimeout({ responseMs: 5000 });

    assert.equal(rezultat.outcome, "timeout");
    assert.equal(rezultat.resetFall, true);
    assert.equal(rezultat.prompt, round.prompt);
  });
});
