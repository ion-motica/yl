// Migrat la Motor3Butoane (Faza D, lotul 3, documente de referinta/PLAN-motor-
// comun-raspuns.md). Motor partajat (nu se inregistreaza singur — vezi cele 4
// fisiere helper: addition/subtraction/multiplication/division-eff-helper.js).
// Fisierul nu avea test dedicat inainte de migrare — testele de mai jos
// consemneaza comportamentul existent (deja conform: gresit ramane pe acelasi
// pas), neschimbat de migrare. Are pas intermediar real (Categoria 7): o serie
// A de pana la 5 fapte cu acelasi tip QF, fiecare corect continua seria.
//
// Sters ca parte a migrarii (cod mort dupa mutare): fosta `onStepWrong` nu mai
// avea niciun apelant (nici `onTimeout`, spre deosebire de sora ei din
// conexe-table-quiz/engine.js) — efectele ei secundare traiesc acum in
// `dupaApasare`.
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

const CORE_SCRIPTS = [
  "js/utils.js",
  "js/placeholder-raspuns.js",
  "js/schimbare-de-nivel.js",
  "js/fact-catalog.js",
  "js/eff/qf-generator.js",
  "js/eff/eff-profile-store.js",
  "js/eff/eff-mistake-registry.js",
  "js/progress-display.js",
  "js/quiz-registry.js",
  "js/subquiz/item-generator.js",
  "js/subquiz/subquiz-definition.js",
  "js/subquiz/subquiz-orchestrator.js",
  "js/motor-3-butoane.js",
  "js/eff-quiz/engine.js",
  "js/eff-quiz/adapters/addition.js",
  "js/eff-quiz/adapters/subtraction.js",
  "js/eff-quiz/adapters/multiplication.js",
  "js/eff-quiz/adapters/division.js",
  "js/quizzes/addition-eff-helper.js",
  "js/quizzes/subtraction-eff-helper.js",
  "js/quizzes/multiplication-eff-helper.js",
  "js/quizzes/division-eff-helper.js",
];

function setupQuiz({ deterministic = true } = {}) {
  globalThis.window = globalThis;
  CORE_SCRIPTS.forEach(loadScript);

  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  }

  const meta = globalThis.QuizRegistry.get("addition-eff");
  return meta.create();
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("eff-quiz engine (Faza D lot 3, quiz cu pasi intermediari)", () => {
  beforeEach(() => {
    delete globalThis.GameUtils;
    delete globalThis.FactCatalog;
    delete globalThis.QFGenerator;
    delete globalThis.EFFProfileStore;
    delete globalThis.EFFMistakeRegistry;
    delete globalThis.EFFQuiz;
    delete globalThis.EFFQuizAdditionAdapter;
    delete globalThis.EFFQuizSubtractionAdapter;
    delete globalThis.EFFQuizMultiplicationAdapter;
    delete globalThis.EFFQuizDivisionAdapter;
    delete globalThis.Motor3Butoane;
    delete globalThis.QuizRegistry;
  });

  it("toate cele 4 helper-e se inregistreaza cu titlul corect, fara sufix (migrare completa)", () => {
    setupQuiz();
    const expectations = {
      "addition-eff": "T+ EFF — Adunare extended fact family",
      "subtraction-eff": "T− EFF — Scădere extended fact family",
      "multiplication-eff": "T× EFF — Înmulțire extended fact family",
      "division-eff": "T÷ EFF — Împărțire extended fact family",
    };
    for (const [id, title] of Object.entries(expectations)) {
      const info = globalThis.QuizRegistry.get(id);
      assert.equal(info.id, id);
      assert.equal(info.title, title);
    }
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

  it("serie A perfecta (5 raspunsuri corecte, fara nicio greseala): nivelul avanseaza imediat", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    let rezultat = null;

    for (let i = 0; i < 5; i += 1) {
      rezultat = quiz.onAnswer(round.correctIndex);
      round = rezultat.nextRound ?? rezultat;
    }

    assert.equal(quiz.getLevel(), 2);
    assert.equal(rezultat.outcome, "run-complete");
    assert.equal(rezultat.levelAdvanced, true);
  });

  it("o greseala pe drum intarzie avansul de nivel (fata de seria perfecta)", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();

    const wrongResult = quiz.onAnswer(wrongIndex(round));
    assert.equal(wrongResult.outcome, "wrong-answer");
    round = quiz.onAnswer(round.correctIndex);
    assert.equal(quiz.getLevel(), 1, "o greseala impiedica avansul rapid de la seria perfecta");

    let rezultat = round;
    let pasi = 0;
    while (quiz.getLevel() === 1 && pasi < 30) {
      pasi += 1;
      rezultat = quiz.onAnswer(rezultat.correctIndex);
      if (rezultat.nextRound) rezultat = rezultat.nextRound;
    }

    assert.ok(pasi > 4, "cu o greseala, avansul ar trebui sa ceara mai mult decat seria perfecta de 5");
    assert.ok(pasi < 30, "nu trebuia sa se blocheze");
    assert.equal(quiz.getLevel(), 2);
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
