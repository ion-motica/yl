import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
const QUIZ_ID = "multiplication-1120-v2";

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  const runner = new Function("window", `${code}\n`);
  runner(globalThis);
}

function setupLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

function setupQuiz() {
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage();

  [
    "js/utils.js",
    "js/placeholder-raspuns.js",
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/fact-catalog.js",
    "js/eff/qf-generator.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/multiplication-1120-v2.js",
  ].forEach(loadScript);

  globalThis.GameUtils.shuffle = (items) => [...items];
  globalThis.GameUtils.randomInt = (min) => min;

  const meta = globalThis.QuizRegistry.get(QUIZ_ID);
  return meta.create(meta);
}

function wrongIndex(state) {
  return (state.correctIndex + 1) % state.options.length;
}

describe("multiplication-1120-v2 subquiz stages", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.FactCatalog;
    delete globalThis.QFGenerator;
    delete globalThis.Mul1120V2Quiz;
  });

  it("starts directly in subquiz 6 non-anchor products mode by temporary default", () => {
    const quiz = setupQuiz();
    const state = quiz.beginRound();

    assert.equal(quiz.getSubquizStartOption(), "nonAnchorProducts");
    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
    assert.equal(state.prompt, "6*11=?");
    assert.deepEqual(state.options, ["66", "56", "76"]);
    assert.equal(state.correctIndex, 0);
  });

  // CORECTAT (Faza D, lotul 3, Categoria 3/6 din FAZA-A-inventar-contract.md):
  // inainte de migrare, raspunsurile GRESITE numarau spre pragul de 21 si
  // puteau chiar avansa etapa — titlul original era "even if wrong". Acum
  // gresit ramane pe loc, fara limita, si doar raspunsurile corecte numara.
  it("normal mode enters subquiz 3 after 21 correct anchor answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("normal");
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
    assert.match(state.prompt, /^11\*6=\?\+11\*1$/);
  });

  it("CORECTAT: raspunsul gresit repetat nu avanseaza niciodata testul anchor (Categoria 6)", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("normal");
    const state = quiz.beginRound();
    const idx = wrongIndex(state);

    for (let i = 0; i < 40; i += 1) {
      const rezultat = quiz.onAnswer(idx, { responseMs: 900 });
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, state.prompt);
    }
    assert.equal(quiz.getSubquizStage(), "normal");
  });

  // CORECTAT: pragul de 12 numara azi doar raspunsuri REZOLVATE (corecte).
  // Intercalam cate un raspuns gresit inaintea fiecarui corect — asta
  // reseteaza streak-ul de 7 fara sa-l lase sa creasca, ca sa testam explicit
  // calea „12 total", nu calea mai scurta „7 la rand".
  it("direct subquiz 3 continues into subquiz 4 after 12 correct answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorSumValuesOnly");
    let state = quiz.beginRound();

    for (let i = 0; i < 12; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
      assert.equal(state.outcome, "wrong-answer");
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
      if (i < 11) assert.equal(state.levelAdvanced, undefined, `nu trebuia sa avanseze inca la pasul ${i}`);
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
  });

  it("subquiz 3 advances level after 7 consecutive correct answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorSumValuesOnly");
    let state = quiz.beginRound();

    for (let i = 0; i < 7; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
  });

  // CORECTAT: lantul foloseste raspunsuri corecte pentru fiecare etapa. Pentru
  // subquiz 3 folosim calea „7 la rand" (streak), mai scurta si fara nevoie de
  // intercalare — pragul de 12 e deja verificat separat, mai sus.
  it("normal mode continues from subquiz 3 into subquiz 4", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("normal");
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    for (let i = 0; i < 7; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "rapidAnchorAdditions");
    assert.equal(state.prompt, "165+44=165+40+?");
  });

  it("subquiz 4 repeats a single candidate until the first correct answer", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    let state = quiz.beginRound();

    for (let i = 0; i < 3; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
      assert.equal(state.prompt, "165+44=165+40+?");
    }
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "rapidAnchorAdditions");
  });

  it("subquiz 4 advances level after 12 total answers when multiple candidates remain", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(2);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "60+48=100+?");
    for (let i = 0; i < 12; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 3);
  });

  // CORECTAT: la nivelul 4 sunt 2 candidati (limita = min(12, 2*3) = 6), deci
  // pragul se atinge la a 6-a rezolvare CORECTA — nu la a 6-a apasare, oricare
  // ar fi ea. Fara streak mai mic care sa concureze aici, nu e nevoie de
  // intercalare.
  it("subquiz 4 uses 3 times candidate count as the exit limit, capped at 12", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(4);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "70+42=100+?");
    for (let i = 0; i < 5; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
      assert.equal(state.levelAdvanced, undefined);
    }

    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 5);
  });

  it("subquiz 4 does not repeat the same question immediately when alternatives exist", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(2);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "60+48=100+?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.notEqual(state.prompt, "60+48=100+?");
  });

  it("subquiz 4 keeps the same question after a wrong answer and timeout", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(2);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "60+48=100+?");
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.prompt, "60+48=100+?");

    state = quiz.onTimeout();
    assert.equal(state.prompt, "60+48=100+?");

    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.notEqual(state.prompt, "60+48=100+?");
  });

  it("subquiz 4 rounds the large near-hundred term to the next hundred", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(9);
    const state = quiz.beginRound();

    assert.equal(state.prompt, "95+19=100+?");
    assert.deepEqual(state.options, ["14", "24", "4"]);
  });

  it("subquiz 4 rounds the small term to the nearest ten", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(3);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "65+26=65+30-?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "65+52=65+50+?");
  });

  it("subquiz 4 skips both-ending-in-5 sums unless they cross a hundred", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(5);
    const state = quiz.beginRound();

    assert.equal(state.prompt, "75+45=100+?");
    assert.equal(state.correctIndex, 0);
  });

  it("subquiz 4 announces no candidates and completes when already at level 10", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(10);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "no candidates");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(state.gameComplete, true);
    assert.equal(quiz.isCompleted(), true);
    assert.equal(quiz.getLevel(), 10);
  });

  it("normal mode continues from subquiz 4 into subquiz 5", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("normal");
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    for (let i = 0; i < 7; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "effectiveAnchorAddition");
    assert.equal(state.prompt, "55+11=?");
  });

  // CORECTAT (Categoria 3/6): pragul de 21 exista inca in cod (siguranta
  // pentru cine nu prinde streak-ul de 10), dar acum se atinge doar prin
  // raspunsuri REZOLVATE — vezi testul de mai jos, care inlocuieste fostul
  // "advances... after 21 total answers" (folosea 21 apasari GRESITE ca sa
  // avanseze, exact bug-ul pe care il repara migrarea asta). Sub regula noua,
  // raspunsul gresit repetat nu avanseaza NICIODATA, oricat de multe apasari.
  it("CORECTAT: raspunsul gresit repetat la subquiz 5 nu avanseaza niciodata (Categoria 6)", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    const state = quiz.beginRound();
    const idx = wrongIndex(state);

    for (let i = 0; i < 40; i += 1) {
      const rezultat = quiz.onAnswer(idx, { responseMs: 900 });
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, state.prompt);
    }
    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "effectiveAnchorAddition");
  });

  it("subquiz 5 advances level after 10 consecutive correct answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
  });

  it("subquiz 5 completes the quiz at the end of level 10", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    quiz.switchLevel(10);
    let state = quiz.beginRound();

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.gameComplete, true);
    assert.equal(quiz.isCompleted(), true);
    assert.equal(quiz.getLevel(), 10);
    assert.equal(state.message, "Ai ajuns la final.");
  });

  it("subquiz 5 does not repeat the same question immediately", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "55+11=?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.notEqual(state.prompt, "55+11=?");
  });

  it("subquiz 5 keeps the same question after wrong answer until corrected", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "55+11=?");
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.prompt, "55+11=?");
    assert.equal(state.correctIndex, 0);

    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.notEqual(state.prompt, "55+11=?");
  });

  it("subquiz 5 retries a missed addition after two to five later turns", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "55+11=?");
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.prompt, "55+11=?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "55+22=?");

    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "55+11=?");
  });

  it("subquiz 5 enters intensive mode after two additions have at least two mistakes", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "55+11=?");
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "55+22=?");

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(quiz.getInfo11_20().mode, "Subquiz 5: intensiv");
    assert.match(state.prompt, /\?/);
    assert.notEqual(state.prompt, "55+11=?");
  });

  it("subquiz 5 intensive mode returns to normal subquiz 5 flow after ten questions", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getInfo11_20().mode, "Subquiz 5: adunare efectiva ancore");
    assert.match(state.prompt, /^\d+\+\d+=\?$/);
  });

  it("subquiz 5 picks the next question near the current one", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "55+11=?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "55+22=?");
  });

  it("normal mode continues from subquiz 5 into subquiz 6", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("normal");
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    for (let i = 0; i < 7; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
    assert.equal(state.prompt, "6*11=?");
  });

  it("subquiz 6 advances after all non-anchors are correct consecutively", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 12; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
  });

  // CORECTAT (Categoria 3/6): titlul original spunea explicit "regardless of
  // mistakes" — 21 apasari GRESITE avansau nivelul. Asta era chiar bug-ul de
  // tip Motor3Butoane pe care il repara migrarea. Sub regula noua, gresit
  // ramane pe loc, fara limita — testul de mai jos verifica exact asta.
  it("CORECTAT: raspunsul gresit repetat la subquiz 6 nu avanseaza niciodata (Categoria 6)", () => {
    const quiz = setupQuiz();
    const state = quiz.beginRound();
    const idx = wrongIndex(state);

    for (let i = 0; i < 40; i += 1) {
      const rezultat = quiz.onAnswer(idx, { responseMs: 900 });
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, state.prompt);
    }
    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
  });

  it("subquiz 6 enters intensive mode after two distinct wrong non-anchors are corrected", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    assert.equal(state.prompt, "6*11=?");
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.prompt, "6*11=?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "7*11=?");

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(quiz.getInfo11_20().mode, "Subquiz 6: intensiv");
    assert.match(state.prompt, /\?/);
    assert.notEqual(state.prompt, "8*11=?");
  });

  it("subquiz 6 intensive mode returns to normal subquiz 6 flow after ten questions", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getInfo11_20().mode, "Subquiz 6: inmultiri non-anchors");
    assert.match(state.prompt, /^\d+\*11=\?$/);
  });

  // CORECTAT: doar raspunsuri corecte numara spre pragul de 21.
  it("direct anchors mode runs only anchors and advances level after 21 correct answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorsOnly");
    let state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "normal");
    assert.match(state.prompt, /\?/);

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "normal");
  });

  // CORECTAT (Categoria 3, cea mai directa incalcare gasita in acest fisier):
  // comentariul original din sursa spunea explicit "Greșelile sunt IGNORATE —
  // avansăm indiferent de corect/greșit" — asta incalca regula universala
  // fara nicio exceptie posibila. Acum modul intensiv respecta regula ca
  // oriunde altundeva: doar raspunsuri corecte numara spre pragul de 10.
  it("direct intensiv mode uses two test anchors and advances level after 10 correct answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("intensivOnly");
    let state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "intensiv");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 2: intensiv");
    assert.match(state.prompt, /\?/);

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "intensiv");
  });

  it("CORECTAT: raspunsul gresit repetat in modul intensiv nu avanseaza niciodata (Categoria 3)", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("intensivOnly");
    const state = quiz.beginRound();
    const idx = wrongIndex(state);

    for (let i = 0; i < 40; i += 1) {
      const rezultat = quiz.onAnswer(idx, { responseMs: 900 });
      assert.equal(rezultat.outcome, "wrong-answer");
      assert.equal(rezultat.prompt, state.prompt);
    }
    assert.equal(quiz.getLevel(), 1);
  });
});
