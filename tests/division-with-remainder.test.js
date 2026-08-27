// Migrat la Motor3Butoane (Faza D, lotul 2, documente de referinta/PLAN-motor-
// comun-raspuns.md).
//
// ATENTIE: acest fisier era Categoria 4 din FAZA-A-inventar-contract.md — azi
// (inainte de migrare) un raspuns gresit NU ramane pe aceeasi intrebare: sare
// la o varianta "retry" (forma opusa) sau la o intrebare noua. Migrarea CHIAR
// schimba acest comportament vizibil, intentionat, conform regulii universale
// (gresit ramane pe loc, fara limita de incercari).
//
// A doua schimbare intentionata (Categoria 6): `questionCount` (pragul de 21
// -> avans de nivel) numara azi la FIECARE apasare, inclusiv gresite. Dupa
// migrare numara doar la raspunsuri REZOLVATE (corecte), pragul de 21 ramane
// neschimbat.
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
    "js/quiz-registry.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/division-with-remainder.js",
  ].forEach(loadScript);

  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  }

  const meta = globalThis.QuizRegistry.get("division-with-remainder");
  return meta.create(meta);
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("division-with-remainder (Faza D lot 2 — corectare Categoria 4 si 6)", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.DivisionWithRemainderQuiz;
    delete globalThis.Motor3Butoane;
  });

  it("se inregistreaza cu id-ul si order-ul corecte, fara sufix (migrare completa)", () => {
    setupQuiz();
    const info = globalThis.QuizRegistry.get("division-with-remainder");
    assert.equal(info.id, "division-with-remainder");
    assert.equal(info.title, "Impartiri cu rest 1-10");
    assert.equal(info.order, -4);
  });

  it("CORECTAT: raspuns gresit ramane pe aceeasi intrebare (azi, inainte de migrare, sarea la o varianta retry)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    const rezultat = quiz.onAnswer(idx);

    assert.equal(rezultat.outcome, "wrong-answer");
    assert.equal(rezultat.correct, false);
    assert.equal(rezultat.prompt, round.prompt, "CORECTAT: ramane pe aceeasi intrebare");
    assert.deepEqual(rezultat.options, round.options);
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("CORECTAT: raspuns gresit repetat de 50 de ori, tot ramane pe aceeasi intrebare", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    for (let i = 0; i < 50; i += 1) {
      const rezultat = quiz.onAnswer(idx);
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, round.prompt);
    }
  });

  it("raspuns corect (sub pragul de streak): outcome step-correct, cu semnatura M3B", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onAnswer(round.correctIndex);

    assert.equal(rezultat.outcome, "step-correct");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.bounce, true);
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("nivelul avanseaza dupa 5 raspunsuri corecte consecutive (CONSECUTIVE_NEEDED), inaintea pragului de 21", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    let rezultat = null;

    for (let i = 1; i <= 5; i += 1) {
      rezultat = quiz.onAnswer(round.correctIndex);
      if (i < 5) round = rezultat;
    }

    assert.equal(quiz.getLevel(), 2);
    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.levelAdvanced, true);
    assert.ok(rezultat.message.includes("consecutive"));
  });

  it("CORECTAT: nivelul avanseaza abia la a 21-a rezolvare CORECTA; apasarile gresite interleaved nu numara si nu strica streak-ul", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    let rezultat = null;

    for (let i = 1; i <= 21; i += 1) {
      const wrongResult = quiz.onAnswer(wrongIndex(round));
      assert.equal(wrongResult.outcome, "wrong-answer");
      assert.equal(wrongResult.prompt, round.prompt, "gresitul nu schimba intrebarea");

      rezultat = quiz.onAnswer(round.correctIndex);

      if (i < 21) {
        assert.equal(quiz.getLevel(), 1, `nivelul nu trebuia sa avanseze inca la rezolvarea corecta #${i}`);
        assert.equal(rezultat.outcome, "step-correct");
        round = rezultat;
      }
    }

    assert.equal(quiz.getLevel(), 2, "la a 21-a rezolvare corecta (interleaved cu gresite), nivelul avanseaza");
    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.levelAdvanced, true);
    assert.ok(rezultat.message.includes("21"));
  });

  it("nivelul maxim: gameComplete la streak-ul de 5 corecte pe ultimul nivel", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(9); // MAX_LEVEL
    let round = quiz.beginRound();
    let rezultat = null;
    let terminat = false;

    for (let i = 0; i < 10 && !terminat; i += 1) {
      rezultat = quiz.onAnswer(round.correctIndex);
      if (rezultat.gameComplete) {
        terminat = true;
        break;
      }
      round = rezultat.nextRound ?? rezultat;
    }

    assert.ok(terminat, "jocul trebuia sa se termine la nivelul maxim");
    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(quiz.isCompleted(), true);
  });

  it("onTimeout: outcome round, resetFall, ramane pe aceeasi intrebare (neatins de migrare)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onTimeout();

    assert.equal(rezultat.outcome, "round");
    assert.equal(rezultat.resetFall, true);
    assert.equal(rezultat.prompt, round.prompt);
  });
});
