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
    "js/fact-catalog.js",
    "js/fact-store.js",
    "js/fact-stats.js",
    "js/quiz-registry.js",
    "js/motor-3-butoane.js",
    "js/quizzes/addition-table-range.js",
  ].forEach(loadScript);

  globalThis.FactStore.resetAll();
  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  }

  const meta = globalThis.QuizRegistry.get("addition-table-range");
  return meta.create();
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("addition-table-range (Faza D lot 1)", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.FactCatalog;
    delete globalThis.FactStore;
    delete globalThis.FactStats;
    delete globalThis.Motor3Butoane;
  });

  it("se inregistreaza cu id-ul si order-ul corecte, fara sufix (migrare completa)", () => {
    setupQuiz();
    const info = globalThis.QuizRegistry.get("addition-table-range");
    assert.equal(info.id, "addition-table-range");
    assert.equal(info.title, "Tabla adunarii - 1..n + 1..n");
    assert.equal(info.order, -9);
  });

  it("raspuns gresit: ramane pe acelasi fapt, outcome wrong-answer, cu semnatura M3B", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);
    const chosen = round.options[idx];

    const rezultat = quiz.onAnswer(idx, { responseMs: 900 });

    assert.equal(rezultat.outcome, "wrong-answer");
    assert.equal(rezultat.correct, false);
    assert.equal(rezultat.flash, "wrong");
    assert.equal(rezultat.prompt, round.prompt);
    assert.deepEqual(rezultat.options, round.options);
    assert.ok(rezultat.message.includes(String(chosen)));
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
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

  it("raspuns corect: outcome run-complete, promptul dezvaluie raspunsul corect, pauza 160ms", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 700 });

    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.runComplete, true);
    assert.ok(rezultat.prompt.includes(String(round.options[round.correctIndex])));
    assert.ok(rezultat.promptHtml.includes("q-correct"));
    assert.equal(rezultat.runDelayMs, 160);
    assert.equal(rezultat.levelAdvanced, false, "quirk preexistent, pastrat: mereu false pe rezultatul lui onAnswer");
  });

  it("nivelul avanseaza cand toate faptele nivelului au fost raspunse corect macar o data", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    let paziGarda = 0;

    while (quiz.getLevel() === 1 && paziGarda < 50) {
      paziGarda += 1;
      const rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
      round = rezultat.nextRound ?? round;
    }

    assert.equal(quiz.getLevel(), 2);
    assert.ok(paziGarda < 50, "nu trebuia sa se blocheze");
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
