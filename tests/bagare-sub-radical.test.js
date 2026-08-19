// Migrat la Motor3Butoane (Faza D, lotul 1, documente de referinta/PLAN-motor-
// comun-raspuns.md).
//
// ATENTIE, diferit de restul lotului 1: acest fisier era Categoria 4 din
// FAZA-A-inventar-contract.md — azi (inainte de migrare) un raspuns gresit
// NU ramane pe aceeasi intrebare, sare direct la alta, cu eticheta onesta
// (outcome:"step-correct", correct:false). Migrarea CHIAR schimba acest
// comportament vizibil, intentionat — exact ca la sq5 in v4, mai devreme in
// aceeasi lucrare. Testele de mai jos verifica comportamentul CORECTAT
// (regula universala: gresit ramane pe loc), nu pe cel vechi.
//
// A doua schimbare intentionata: `questionCount` (pragul de 21 -> avans de
// nivel) numara azi la FIECARE apasare, inclusiv gresite — Categoria 6 din
// inventar. Dupa migrare numara doar la raspunsuri REZOLVATE (corecte),
// pastrand pragul de 21 neschimbat (decizie user, discutata explicit).
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
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/motor-3-butoane.js",
    "js/quizzes/bagare-sub-radical.js",
  ].forEach(loadScript);

  if (deterministic) {
    globalThis.Math.random = () => 0;
  }

  const meta = globalThis.QuizRegistry.get("bagare-sub-radical");
  return meta.create(meta);
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("bagare-sub-radical (Faza D lot 1 — corectare Categoria 4)", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.BagareSubRadicalQuiz;
    delete globalThis.Motor3Butoane;
  });

  it("se inregistreaza cu id-ul si order-ul corecte, fara sufix (migrare completa)", () => {
    setupQuiz();
    const info = globalThis.QuizRegistry.get("bagare-sub-radical");
    assert.equal(info.id, "bagare-sub-radical");
    assert.equal(info.title, "Bagare sub radical");
    assert.equal(info.order, -3);
  });

  it("CORECTAT: raspuns gresit ramane pe aceeasi intrebare (azi, inainte de migrare, sarea la alta)", () => {
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

  it("CORECTAT: raspuns gresit repetat de multe ori, tot ramane pe aceeasi intrebare", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    for (let i = 0; i < 50; i += 1) {
      const rezultat = quiz.onAnswer(idx);
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, round.prompt);
    }
  });

  it("raspuns corect (faza 1-3, sub pragul de streak): outcome step-correct, intrebare noua", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onAnswer(round.correctIndex);

    assert.equal(rezultat.outcome, "step-correct");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.bounce, true);
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("2 raspunsuri corecte consecutive avanseaza faza (CONSECUTIVE_NEEDED=2)", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    const fazaInitiala = round.prompt;

    round = quiz.onAnswer(round.correctIndex);
    round = quiz.onAnswer(round.correctIndex);

    // dupa 2 corecte consecutive, faza a avansat -> promptul foloseste alta necunoscuta
    assert.equal(round.outcome, "step-correct");
    assert.notEqual(round.prompt, fazaInitiala, "faza trebuia sa avanseze dupa streak-ul de 2");
  });

  it("CORECTAT: nivelul avanseaza dupa 21 de raspunsuri CORECTE (rezolvate), nu 21 de apasari", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();

    // 20 raspunsuri gresite repetate pe aceeasi intrebare — sub regula noua,
    // NU trebuie sa avanseze contorul de 21 deloc (ramane pe intrebarea 1).
    for (let i = 0; i < 20; i += 1) {
      round = quiz.onAnswer(wrongIndex(round));
    }
    assert.equal(quiz.getLevel(), 1, "20 de apasari gresite pe RAND nu trebuie sa avanseze nivelul");

    // acum raspundem corect de 21 de ori la rand (fara sa numaram streak-ul de
    // faza separat — oricare succesiune de 21 corecte trece de prag)
    let avansat = false;
    for (let i = 0; i < 25 && !avansat; i += 1) {
      round = quiz.onAnswer(round.correctIndex);
      if (round.levelAdvanced) avansat = true;
    }
    assert.ok(avansat, "dupa suficiente raspunsuri corecte, nivelul trebuia sa avanseze");
    assert.equal(quiz.getLevel(), 2);
  });

  it("nivelul maxim: gameComplete la ultimul nivel", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(8); // MAX_LEVEL
    let round = quiz.beginRound();
    let terminat = false;

    for (let i = 0; i < 25 && !terminat; i += 1) {
      round = quiz.onAnswer(round.correctIndex);
      if (round.gameComplete) terminat = true;
    }

    assert.ok(terminat, "jocul trebuia sa se termine la nivelul maxim");
    assert.equal(round.outcome, "run-complete");
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
