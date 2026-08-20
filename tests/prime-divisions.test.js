// Migrat la Motor3Butoane (Faza D, lotul 2, documente de referinta/PLAN-motor-
// comun-raspuns.md). Fisierul nu avea test dedicat inainte de migrare (vezi
// FAZA-A-inventar-contract.md) — testele de mai jos consemneaza comportamentul
// existent (deja conform: gresit ramane pe acelasi numar), neschimbat de
// migrare. Quiz cu pasi intermediari reali (Categoria 7): un lant de impartiri
// succesive cu divizori primi, fiecare pas corect continua lantul, DAR spre
// deosebire de prime-divisors.js (fratele deja migrat in lotul 1), fiecare pas
// intermediar aici avea deja o pauza (`promptHoldMs`+`continueStep`, 160ms) care
// arata rezultatul impartirii inainte de urmatoarea intrebare — pastrata neatinsa.
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
// Salvat inainte ca vreun test sa poata suprascrie Math.random — altfel un
// test `deterministic:false` care ruleaza DUPA unul `deterministic:true` in
// acelasi proces mosteneste stub-ul `() => 0`, nu intamplare reala (Math.random
// nu se reseteaza singur intre teste din acelasi fisier).
const nativeRandom = Math.random;

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function setupQuiz({ deterministic = true } = {}) {
  globalThis.window = globalThis;
  [
    "js/utils.js",
    "js/quiz-math.js",
    "js/progress.js",
    "js/quiz-registry.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/prime-divisions.js",
  ].forEach(loadScript);

  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  } else {
    globalThis.Math.random = nativeRandom;
  }

  const meta = globalThis.QuizRegistry.get("prime-divisions");
  return meta.create();
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

// `round.options` sunt STRING-uri de afisare (formatOptionsForView) — trebuie
// convertite la Number inainte de orice verificare numerica (ex. isPrime),
// altfel `isPrime("2")` da fals negativ (verifica `n === 2`, strict).
function correctQuotientOf(round) {
  return Number(round.options[round.correctIndex]);
}

// La nivelul 1 (pragul de nivel e 0), un lant se opreste imediat daca catul
// e 1 sau prim (shouldSkipFinalPrimeStep). Cautam un start al carui prim cat
// NU opreste lantul, ca sa testam efectiv pasul intermediar cu pauza proprie
// — sub determinism complet, primul cat e mereu prim (colapseaza la cel mai
// mic compus posibil), de-aia testele astea doua folosesc `deterministic: false`.
function findNonTerminalRound(quiz, guard = 200) {
  let round = quiz.beginRound();
  for (let tries = 0; tries < guard; tries += 1) {
    const quotient = correctQuotientOf(round);
    if (quotient !== 1 && !globalThis.QuizMath.isPrime(quotient)) {
      return round;
    }
    round = quiz.beginRound();
  }
  throw new Error(`nu s-a gasit un lant cu pas intermediar in ${guard} incercari`);
}

describe("prime-divisions (Faza D lot 2, quiz cu pasi intermediari + pauza proprie)", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.QuizMath;
    delete globalThis.QuizMistakes;
    delete globalThis.Motor3Butoane;
  });

  it("se inregistreaza cu id-ul si order-ul corecte, fara sufix (migrare completa)", () => {
    setupQuiz();
    const info = globalThis.QuizRegistry.get("prime-divisions");
    assert.equal(info.id, "prime-divisions");
    assert.equal(info.title, "Împărțiri la numere prime");
    assert.equal(info.order, 1);
  });

  it("raspuns gresit: ramane pe aceeasi intrebare, outcome wrong-answer, cu semnatura M3B", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);
    const chosen = round.options[idx];

    const rezultat = quiz.onAnswer(idx);

    assert.equal(rezultat.outcome, "wrong-answer");
    assert.equal(rezultat.correct, false);
    assert.equal(rezultat.flash, "wrong");
    assert.equal(rezultat.prompt, round.prompt, "ramane exact aceeasi intrebare");
    assert.ok(rezultat.message.includes(String(chosen)));
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("raspuns gresit repetat de 50 de ori: tot ramane pe aceeasi intrebare, fara limita", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    for (let i = 0; i < 50; i += 1) {
      const rezultat = quiz.onAnswer(idx);
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, round.prompt);
    }
  });

  it("raspuns corect intermediar (catul nu opreste lantul): step-correct CU promptHoldMs si continueStep", () => {
    const quiz = setupQuiz({ deterministic: false });
    const round = findNonTerminalRound(quiz);
    const correctQuotient = correctQuotientOf(round);

    const rezultat = quiz.onAnswer(round.correctIndex);

    assert.equal(rezultat.outcome, "step-correct");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.bounce, true);
    assert.equal(rezultat.promptHoldMs, 160, "CORRECT_PROMPT_HOLD_MS, neschimbat de migrare");
    assert.ok(rezultat.continueStep, "pas intermediar: continueStep pregatit cu intrebarea urmatoare");
    assert.ok(rezultat.message.includes(String(correctQuotient)));
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
    assert.ok(Array.isArray(rezultat.continueStep.options), "continueStep poarta o intrebare noua, gata de raspuns");
  });

  it("lant complet de impartiri: fiecare pas intermediar trece prin continueStep, pana la run-complete", () => {
    const quiz = setupQuiz({ deterministic: false });
    let round = findNonTerminalRound(quiz);
    let rezultat = null;
    let pasi = 0;
    let pasiIntermediari = 0;

    while (pasi < 20) {
      pasi += 1;
      rezultat = quiz.onAnswer(round.correctIndex);
      if (rezultat.outcome === "run-complete") break;
      assert.equal(rezultat.outcome, "step-correct");
      assert.ok(rezultat.continueStep, "fiecare pas intermediar are continueStep");
      pasiIntermediari += 1;
      round = rezultat.continueStep;
    }

    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.runComplete, true);
    assert.ok(pasi < 20, "nu trebuia sa se blocheze");
    assert.ok(pasiIntermediari > 0, "testul trebuia sa treaca prin cel putin un pas intermediar real");
  });

  it("onTimeout: outcome timeout, resetFall, ramane pe aceeasi intrebare (neatins de migrare)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onTimeout();

    assert.equal(rezultat.outcome, "timeout");
    assert.equal(rezultat.resetFall, true);
    assert.equal(rezultat.prompt, round.prompt);
  });
});
