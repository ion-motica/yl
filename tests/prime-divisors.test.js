// Migrat la Motor3Butoane (Faza D, lotul 1, documente de referinta/PLAN-motor-
// comun-raspuns.md). Testele au fost scrise INAINTE de migrare, ca plasa de
// siguranta. Quiz cu pasi intermediari reali (Categoria 7 din FAZA-A-inventar-
// contract.md): un lant de impartiri, fiecare pas corect continua lantul
// (step-correct), pana se ajunge la 1 sau sub pragul nivelului (run-complete).
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function setupQuiz({ deterministic = true } = {}) {
  globalThis.window = globalThis;
  [
    "js/utils.js",
    "js/placeholder-raspuns.js",
    "js/quiz-math.js",
    "js/progress.js",
    "js/quiz-registry.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/prime-divisors.js",
  ].forEach(loadScript);

  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  }

  const meta = globalThis.QuizRegistry.get("prime-divisors");
  return meta.create();
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("prime-divisors (Faza D lot 1, quiz cu pasi intermediari)", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.QuizMath;
    delete globalThis.QuizMistakes;
    delete globalThis.ItemGenerator;
    delete globalThis.SubquizDefinition;
    delete globalThis.SubquizOrchestrator;
    delete globalThis.Motor3Butoane;
  });

  it("se inregistreaza cu id-ul si order-ul corecte, fara sufix (migrare completa)", () => {
    setupQuiz();
    const info = globalThis.QuizRegistry.get("prime-divisors");
    assert.equal(info.id, "prime-divisors");
    assert.equal(info.title, "Găsire divizori primi");
    assert.equal(info.order, 0);
  });

  it("raspuns gresit (nu divide numarul): ramane pe acelasi numar, outcome wrong-answer, cu semnatura M3B", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);
    const chosen = round.options[idx];

    const rezultat = quiz.onAnswer(idx);

    assert.equal(rezultat.outcome, "wrong-answer");
    assert.equal(rezultat.correct, false);
    assert.equal(rezultat.flash, "wrong");
    assert.equal(rezultat.prompt, round.prompt, "ramane exact acelasi numar");
    assert.ok(rezultat.message.includes(String(chosen)));
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("raspuns gresit repetat: ramane pe acelasi numar oricat de multe incercari", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    for (let i = 0; i < 50; i += 1) {
      const rezultat = quiz.onAnswer(idx);
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, round.prompt);
    }
  });

  it("raspuns corect intermediar (catul nu e 1): outcome step-correct, numarul nou apare, fara pauza", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const numarInitial = Number(round.prompt);

    const rezultat = quiz.onAnswer(round.correctIndex);

    const impartitorAles = Number(round.options[round.correctIndex]);
    const catAsteptat = Math.floor(numarInitial / impartitorAles);

    if (catAsteptat === 1) {
      assert.equal(rezultat.outcome, "run-complete", "acest numar de start duce direct la 1 — sarim pasul intermediar");
      return;
    }

    assert.equal(rezultat.outcome, "step-correct");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.bounce, true);
    assert.equal(rezultat.prompt, String(catAsteptat), "promptul arata catul, ca numar nou de start");
    assert.ok(rezultat.message.includes(String(catAsteptat)));
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
    assert.deepEqual(rezultat.divisionHistory, [`${numarInitial}:${impartitorAles}=${catAsteptat}`]);
  });

  it("lant complet de impartiri pana la 1: fiecare pas corect duce mai departe, ultimul da run-complete", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    let pasi = 0;

    while (round.outcome !== "run-complete" && pasi < 20) {
      pasi += 1;
      round = quiz.onAnswer(round.correctIndex);
    }

    assert.equal(round.outcome, "run-complete");
    assert.equal(round.correct, true);
    assert.equal(round.runComplete, true);
    assert.ok(pasi < 20, "nu trebuia sa se blocheze");
    assert.equal(round.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("onTimeout: outcome timeout, resetFall, ramane pe acelasi numar (neatins de migrare)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onTimeout();

    assert.equal(rezultat.outcome, "timeout");
    assert.equal(rezultat.resetFall, true);
    assert.equal(rezultat.prompt, round.prompt);
  });
});
