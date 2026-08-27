// Migrat la Motor3Butoane (Faza D, lotul 3, documente de referinta/PLAN-motor-
// comun-raspuns.md). Motor partajat (nu se inregistreaza singur — vezi
// js/quizzes/addition-succesive-helper.js pentru intrarea de meniu reala).
// Fisierul nu avea test dedicat inainte de migrare — testele de mai jos
// consemneaza comportamentul existent (deja conform: gresit ramane pe acelasi
// pas), neschimbat de migrare. Are pas intermediar real (Categoria 7): o serie
// de N pasi in lant, fiecare corect continua seria, ultimul o incheie
// (run-complete, cu urmatoarea serie deja pregatita in nextRound).
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
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/succesive-quiz/engine.js",
    "js/succesive-quiz/adapters/addition.js",
  ].forEach(loadScript);

  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  }

  return globalThis.SuccesiveQuiz.create({
    quizId: "addition-succesive",
    adapter: globalThis.SuccesiveAdditionAdapter,
  });
}

function setupHelperRegistration() {
  globalThis.window = globalThis;
  [
    "js/utils.js",
    "js/fact-catalog.js",
    "js/fact-store.js",
    "js/quiz-registry.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/succesive-quiz/engine.js",
    "js/succesive-quiz/adapters/addition.js",
    "js/quizzes/addition-succesive-helper.js",
  ].forEach(loadScript);
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("succesive-quiz engine (Faza D lot 3, quiz cu pasi intermediari)", () => {
  beforeEach(() => {
    delete globalThis.GameUtils;
    delete globalThis.FactCatalog;
    delete globalThis.FactStore;
    delete globalThis.SuccesiveQuiz;
    delete globalThis.SuccesiveAdditionAdapter;
    delete globalThis.Motor3Butoane;
    delete globalThis.QuizRegistry;
  });

  it("helper-ul se inregistreaza cu id-ul si order-ul corecte, fara sufix (migrare completa)", () => {
    setupHelperRegistration();
    const info = globalThis.QuizRegistry.get("addition-succesive");
    assert.equal(info.id, "addition-succesive");
    assert.equal(info.title, "Adunări succesive");
    assert.equal(info.order, -100);
  });

  it("raspuns gresit: ramane pe acelasi pas, outcome wrong-answer, cu semnatura M3B", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);
    const chosen = round.options[idx];

    const rezultat = quiz.onAnswer(idx);

    assert.equal(rezultat.outcome, "wrong-answer");
    assert.equal(rezultat.correct, false);
    assert.equal(rezultat.flash, "wrong");
    assert.equal(rezultat.prompt, round.prompt, "ramane exact acelasi pas");
    assert.ok(rezultat.message.includes(String(chosen)));
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("raspuns gresit repetat de 50 de ori: tot ramane pe acelasi pas, fara limita", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    for (let i = 0; i < 50; i += 1) {
      const rezultat = quiz.onAnswer(idx);
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, round.prompt);
    }
  });

  it("raspuns corect intermediar (nu ultimul pas din serie): step-correct, trece la pasul urmator", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onAnswer(round.correctIndex);

    assert.equal(rezultat.outcome, "step-correct");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.bounce, true);
    assert.notEqual(rezultat.prompt, round.prompt, "pasul urmator e o intrebare noua");
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("serie completa fara greseli (o singura serie): run-complete cu nextRound, nivelul NU avanseaza inca", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    let rezultat = null;

    for (let i = 0; i < 3; i += 1) {
      rezultat = quiz.onAnswer(round.correctIndex);
      if (i < 2) round = rezultat;
    }

    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.runComplete, true);
    assert.equal(quiz.getLevel(), 1, "o singura serie perfecta nu ajunge (are nevoie de 2 consecutive)");
    assert.ok(rezultat.nextRound, "urmatoarea serie e deja pregatita in nextRound");
  });

  it("2 serii perfecte consecutive: nivelul avanseaza", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    let rezultat = null;

    for (let serie = 0; serie < 2; serie += 1) {
      for (let i = 0; i < 3; i += 1) {
        rezultat = quiz.onAnswer(round.correctIndex);
        round = rezultat.nextRound ?? rezultat;
      }
    }

    assert.equal(quiz.getLevel(), 2);
    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.levelAdvanced, true);
  });

  it("onTimeout: outcome timeout, resetFall, ramane pe acelasi pas (neatins de migrare)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onTimeout();

    assert.equal(rezultat.outcome, "timeout");
    assert.equal(rezultat.resetFall, true);
    assert.equal(rezultat.prompt, round.prompt);
  });
});
