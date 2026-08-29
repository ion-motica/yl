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
    "js/bond-inventory.js",
    "js/quizzes/addition-table-singapore.js",
  ].forEach(loadScript);

  globalThis.FactStore.resetAll();
  if (deterministic) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    globalThis.Math.random = () => 0;
  }

  const meta = globalThis.QuizRegistry.get("addition-table-singapore");
  return meta.create();
}

function wrongIndex(round) {
  return (round.correctIndex + 1) % round.options.length;
}

describe("addition-table-singapore (Faza D lot 2 — migrare pura, fara corectie de comportament)", () => {
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
    const info = globalThis.QuizRegistry.get("addition-table-singapore");
    assert.equal(info.id, "addition-table-singapore");
    assert.equal(info.title, "Tabla adunarii Singapore 6=3+3|3+4");
    assert.equal(info.order, -8);
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

  it("raspuns corect pe un fapt intermediar din tur: step-correct, fara pasUrmator, trece la urmatorul fapt din coada", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();

    const rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });

    assert.equal(rezultat.outcome, "step-correct");
    assert.equal(rezultat.correct, true);
    assert.equal(rezultat.bounce, true);
    assert.equal(rezultat.pasUrmator, undefined, "pas intermediar: niciun pas urmator");
    assert.equal(rezultat.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("tur fara nicio greseala, terminat: avanseaza nivelul, pauza standard (fara `dupa` custom) si pasUrmator run-complete", () => {
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
    assert.equal(rezultat.pasUrmator.dupa, undefined, "fara pauza custom: cade pe DEFAULT_REVEAL_HOLD_MS");
    assert.equal(rezultat.pasUrmator.continua.outcome, "serie-terminata");
    assert.equal(rezultat.pasUrmator.continua.serie_terminata, true);
    assert.equal(rezultat.pasUrmator.continua.levelAdvanced, true);
    assert.ok(rezultat.pasUrmator.continua.nextRound, "pasul urmator poarta runda urmatoare, deja pregatita");
  });

  it("greseala pe primul fapt, apoi corect pe toate: dupa terminarea turului principal intra in faza retry (fara avans de nivel inca)", () => {
    const quiz = setupQuiz();
    let round = quiz.beginRound();

    // gresim primul fapt
    round = quiz.onAnswer(wrongIndex(round), { responseMs: 900 });
    assert.equal(round.outcome, "wrong-answer");

    // apoi raspundem corect la tot ce urmeaza pana intram in retry
    let rezultat = null;
    let paziGarda = 0;
    let vazutRetry = false;
    while (!vazutRetry && paziGarda < 20) {
      paziGarda += 1;
      rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
      // Semnalul de "tur terminat, fara avans" e un pasUrmator a carui
      // vedere purtata (`continua`) NU are `outcome` (run-complete e mereu
      // insotit de outcome, retry nu).
      if (rezultat.pasUrmator && rezultat.pasUrmator.continua.outcome === undefined) {
        vazutRetry = true; // pas de retry, nu de run-complete
        break;
      }
      round = rezultat;
    }

    assert.ok(vazutRetry, "trebuia sa ajunga la un pas de tip retry (fara outcome run-complete)");
    assert.equal(quiz.getLevel(), 3, "nivelul NU avanseaza cat timp turul a avut o greseala");
    assert.equal(rezultat.pasUrmator.continua.serie_terminata, undefined, "pasul de retry nu e run-complete");
    assert.ok(Array.isArray(rezultat.pasUrmator.continua.options), "pasul de retry poarta o runda noua de raspuns");
  });

  it("nivelul maxim: pasUrmator cu gameComplete la finalul unui tur fara greseli", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(10); // MAX_LEVEL
    let round = quiz.beginRound();
    let rezultat = null;
    let paziGarda = 0;
    let terminat = false;

    while (!terminat && paziGarda < 20) {
      paziGarda += 1;
      rezultat = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
      if (rezultat.pasUrmator && rezultat.pasUrmator.continua.gameComplete) {
        terminat = true;
        break;
      }
      round = rezultat;
    }

    assert.ok(terminat, "jocul trebuia sa se termine la nivelul maxim, fara greseli");
    assert.equal(rezultat.pasUrmator.continua.outcome, "serie-terminata");
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

// Bug raportat 29.08.2026: "dupa 2 raspunsuri reseteaza lista si reia cu
// acelasi numar, abia dupa trece la nivelul urmator". Cauza: selectPoolForLevel
// trunchia turul la MIN_POOL_SIZE=2 bv-uri (tipar copiat dintr-un quiz cu
// univers mare de fapte) quiar si la niveluri cu mai multe bv-uri (nivelul 6
// are 5: 1+5,2+4,3+3,4+2,5+1). Testele de mai jos verifica fix-ul (acoperire
// completa inainte de avans) si contractul getInventarBonduri (afisare
// inventar bonds, cerere user 29.08.2026).
describe("addition-table-singapore — acoperire completa bv-uri si getInventarBonduri (29.08.2026)", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.FactCatalog;
    delete globalThis.FactStore;
    delete globalThis.FactStats;
    delete globalThis.Motor3Butoane;
    delete globalThis.InventarBonduri;
  });

  it("nivelul NU avanseaza pana nu s-au acoperit toate cele 5 bv-uri ale nivelului 6 (bug: se oprea la 2, MIN_POOL_SIZE)", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(6);
    let round = quiz.beginRound();

    // Ordine determinista (shuffle=identity): 1+5, 2+4, 3+3, 4+2, 5+1.
    for (let i = 0; i < 4; i += 1) {
      round = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
      assert.equal(quiz.getLevel(), 6, `nivelul nu trebuie sa avanseze dupa doar ${i + 1} bv-uri corecte`);
    }

    const ultimul = quiz.onAnswer(round.correctIndex, { responseMs: 500 });
    assert.equal(quiz.getLevel(), 7, "dupa toate cele 5 bv-uri, fara nicio greseala, nivelul avanseaza");
    assert.equal(ultimul.pasUrmator.continua.levelAdvanced, true);
  });

  it("getInventarBonduri: randuri in ordine crescatoare dupa a, toate goale la inceputul nivelului", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(6);
    quiz.beginRound();

    const inventar = quiz.getInventarBonduri();
    assert.equal(inventar.visible, true);
    assert.equal(inventar.nivel, 6);
    assert.deepEqual(
      inventar.randuri.map((r) => r.label),
      ["1+5", "2+4", "3+3", "4+2", "5+1"]
    );
    assert.ok(
      inventar.randuri.every((r) => r.rezolvat === false && r.a === null && r.b === null),
      "toate randurile pornesc goale (spatiu rezervat, nimic revelat)"
    );
  });

  it("getInventarBonduri: randul se completeaza (rezolvat, a, b, culori) dupa ce bv-ul e rezolvat", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(6);
    const round = quiz.beginRound(); // primul din coada: 1+5

    quiz.onAnswer(round.correctIndex, { responseMs: 500 });

    const inventar = quiz.getInventarBonduri();
    const randUnu = inventar.randuri.find((r) => r.label === "1+5");
    assert.equal(randUnu.rezolvat, true);
    assert.equal(randUnu.a, 1);
    assert.equal(randUnu.b, 5);
    assert.equal(randUnu.culoareA, globalThis.InventarBonduri.culoareNumar(1));
    assert.equal(randUnu.culoareB, globalThis.InventarBonduri.culoareNumar(5));

    const restul = inventar.randuri.filter((r) => r.label !== "1+5");
    assert.ok(restul.every((r) => r.rezolvat === false), "restul bv-urilor raman nerezolvate");
  });

  it("getInventarBonduri: randurile rezolvate raman in faza retry (bvRezolvate nu se reseteaza ca historyLines)", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(6);
    let round = quiz.beginRound(); // 1+5

    round = quiz.onAnswer(round.correctIndex, { responseMs: 500 }); // 1+5 ok -> 2+4
    round = quiz.onAnswer(wrongIndex(round), { responseMs: 900 }); // gresim 2+4
    round = quiz.onAnswer(round.correctIndex, { responseMs: 500 }); // 2+4 ok -> 3+3
    round = quiz.onAnswer(round.correctIndex, { responseMs: 500 }); // 3+3 ok -> 4+2
    round = quiz.onAnswer(round.correctIndex, { responseMs: 500 }); // 4+2 ok -> 5+1
    const ultimulDinMain = quiz.onAnswer(round.correctIndex, { responseMs: 500 }); // 5+1 ok -> intra in retry

    assert.equal(quiz.getLevel(), 6, "nu avanseaza inca — turul principal a avut o greseala (la 2+4)");
    assert.equal(
      ultimulDinMain.pasUrmator.continua.serie_terminata,
      undefined,
      "e un pas de retry, nu run-complete"
    );

    const inventar = quiz.getInventarBonduri();
    assert.deepEqual(
      inventar.randuri.map((r) => r.rezolvat),
      [true, true, true, true, true],
      "toate cele 5 bv-uri raman marcate rezolvate in inventar, chiar in faza retry"
    );
  });

  it("getInventarBonduri: se reseteaza la nivel nou (nu mosteneste bv-urile nivelului anterior)", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(3); // 2 bv-uri: 1+2, 2+1
    let round = quiz.beginRound();

    round = quiz.onAnswer(round.correctIndex, { responseMs: 500 }); // 1+2 ok -> 2+1
    quiz.onAnswer(round.correctIndex, { responseMs: 500 }); // 2+1 ok -> avanseaza la nivelul 4

    assert.equal(quiz.getLevel(), 4);
    const inventar = quiz.getInventarBonduri();
    assert.equal(inventar.nivel, 4);
    assert.ok(
      inventar.randuri.every((r) => r.rezolvat === false),
      "inventarul nivelului nou porneste gol, fara bv-urile nivelului anterior"
    );
  });
});
