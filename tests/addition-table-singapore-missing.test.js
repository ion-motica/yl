// Migrat la Motor3Butoane (Faza D, lotul 2, documente de referinta/PLAN-motor-
// comun-raspuns.md). Fisierul nu avea test dedicat inainte de migrare (vezi
// FAZA-A-inventar-contract.md) — testele de mai jos consemneaza comportamentul
// existent (deja conform: gresit ramane pe aceeasi intrebare), neschimbat de
// migrare. Singura schimbare e arhitecturala: logica de corect/gresit trece
// prin Motor3Butoane in loc sa fie scrisa de mana in onAnswer().
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
    "js/schimbare-de-nivel.js",
    "js/fact-catalog.js",
    "js/fact-store.js",
    "js/fact-stats.js",
    "js/quiz-registry.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/addition-table-singapore-missing.js",
  ].forEach(loadScript);

  globalThis.FactStore.resetAll();
  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  }

  const meta = globalThis.QuizRegistry.get("addition-table-singapore-missing");
  return meta.create();
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("addition-table-singapore-missing (Faza D lot 2 — migrare pura, fara corectie de comportament)", () => {
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
    const info = globalThis.QuizRegistry.get("addition-table-singapore-missing");
    assert.equal(info.id, "addition-table-singapore-missing");
    assert.equal(info.title, "Tabla adunarii Singapore 6=?+3");
    assert.equal(info.order, -7);
  });

  it("raspuns gresit: ramane pe aceeasi intrebare, outcome wrong-answer, cu semnatura M3B", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    const rezultat = quiz.onAnswer(idx, { responseMs: 900 });

    assert.equal(rezultat.outcome, "wrong-answer");
    assert.equal(rezultat.correct, false);
    assert.equal(rezultat.flash, "wrong");
    assert.equal(rezultat.prompt, round.prompt);
    assert.deepEqual(rezultat.options, round.options, "aceeasi intrebare, nu se schimba");
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("raspuns gresit repetat de 50 de ori: tot ramane pe aceeasi intrebare, fara limita", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    const idx = wrongIndex(round);

    for (let i = 0; i < 50; i += 1) {
      const rezultat = quiz.onAnswer(idx, { responseMs: 900 });
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, round.prompt);
    }
  });

  it("raspuns corect pe un fapt intermediar din tur: step-correct, fara promptHoldMs, trece la urmatorul fapt din coada", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });

    assert.equal(rezultat.outcome, "step-correct");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.bounce, true);
    assert.equal(rezultat.promptHoldMs, undefined, "pas intermediar: fara pauza, fara continueStep");
    assert.equal(rezultat.continueStep, undefined);
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("tur fara nicio greseala, terminat: avanseaza nivelul, pauza standard (fara promptHoldMs custom) si continueStep run-complete", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();
    assert.equal(quiz.getLevel(), 3);

    let rezultat = null;
    let paziGarda = 0;
    while (quiz.getLevel() === 3 && paziGarda < 20) {
      paziGarda += 1;
      rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
      round = rezultat;
    }

    assert.ok(paziGarda < 20, "nu trebuia sa se blocheze");
    assert.equal(quiz.getLevel(), 4, "nivelul avanseaza dupa un tur fara greseli");
    assert.equal(rezultat.outcome, "step-correct");
    // Pauza custom de 400ms a fost scoasa (cerere user, 28.08.2026) — cade pe
    // DEFAULT_REVEAL_HOLD_MS din motor, ca la orice alt quiz standard.
    assert.equal(rezultat.promptHoldMs, undefined);
    assert.equal(rezultat.continueStep.outcome, "run-complete");
    assert.equal(rezultat.continueStep.runComplete, true);
    assert.equal(rezultat.continueStep.levelAdvanced, true);
    assert.ok(rezultat.continueStep.nextRound, "continueStep poarta runda urmatoare, deja pregatita");
  });

  it("greseala pe primul fapt, apoi corect pe toate: dupa terminarea turului principal intra in faza retry (fara avans de nivel inca)", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();

    round = quiz.onAnswer(wrongIndex(round), { responseMs: 900 });
    assert.equal(round.outcome, "wrong-answer");

    let rezultat = null;
    let paziGarda = 0;
    let vazutRetry = false;
    while (!vazutRetry && paziGarda < 20) {
      paziGarda += 1;
      rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
      // Semnalul de "tur terminat, fara avans" nu mai e promptHoldMs (scos) —
      // e prezenta unui continueStep FARA `outcome` (run-complete e mereu
      // insotit de outcome, retry nu).
      if (rezultat.continueStep && rezultat.continueStep.outcome === undefined) {
        vazutRetry = true;
        break;
      }
      round = rezultat;
    }

    assert.ok(vazutRetry, "trebuia sa ajunga la un continueStep de tip retry (fara outcome run-complete)");
    assert.equal(quiz.getLevel(), 3, "nivelul NU avanseaza cat timp turul a avut o greseala");
    assert.equal(rezultat.continueStep.runComplete, undefined, "continueStep de retry nu e run-complete");
    assert.ok(Array.isArray(rezultat.continueStep.options), "continueStep de retry poarta o runda noua de raspuns");
  });

  it("nivelul maxim: continueStep cu gameComplete la finalul unui tur fara greseli", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(10); // MAX_LEVEL
    let round = quiz.beginRound();
    let rezultat = null;
    let paziGarda = 0;
    let terminat = false;

    while (!terminat && paziGarda < 20) {
      paziGarda += 1;
      rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
      if (rezultat.continueStep && rezultat.continueStep.gameComplete) {
        terminat = true;
        break;
      }
      round = rezultat;
    }

    assert.ok(terminat, "jocul trebuia sa se termine la nivelul maxim, fara greseli");
    assert.equal(rezultat.continueStep.outcome, "run-complete");
    assert.equal(quiz.isCompleted(), true);
  });

  it("promptHtml standard: placeholder marcat prin contractul comun, istoric crescator (28.08.2026)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const CLASA = globalThis.PlaceholderRaspuns.CLASA;
    assert.ok(round.promptHtml.includes(CLASA), "prima intrebare are placeholderul marcat");
    assert.ok(round.promptHtml.includes("singapore-prompt"), "structura standard e pastrata");
    assert.ok(
      !round.promptHtml.includes("singapore-history"),
      "primul fapt din tur nu are inca istoric"
    );

    const dupa = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
    assert.ok(dupa.promptHtml.includes(CLASA), "urmatoarea intrebare are din nou placeholderul");
    assert.ok(
      dupa.promptHtml.includes("singapore-history-line"),
      "faptul rezolvat anterior apare acum in istoric"
    );
  });

  it("raspuns gresit: promptHtml ramane identic cu cel afisat, cu placeholder (nu doar prompt text)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onAnswer(wrongIndex(round), { responseMs: 900 });

    assert.equal(rezultat.promptHtml, round.promptHtml, "raspunsul gresit nu schimba promptHtml-ul");
  });

  it("onTimeout: outcome timeout, resetFall, ramane pe aceeasi intrebare (neatins de migrare)", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onTimeout({ responseMs: 5000 });

    assert.equal(rezultat.outcome, "timeout");
    assert.equal(rezultat.resetFall, true);
    assert.equal(rezultat.prompt, round.prompt);
  });
});
