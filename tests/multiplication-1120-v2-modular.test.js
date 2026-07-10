import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
const QUIZ_ID = "multiplication-1120-v2-modular";

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

function setupQuiz({ shuffle = (items) => [...items], randomInt = (min) => min } = {}) {
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage();

  [
    "js/utils.js",
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/fact-catalog.js",
    "js/eff/qf-generator.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/quizzes/multiplication-1120-v2-modular.js",
  ].forEach(loadScript);

  globalThis.GameUtils.shuffle = shuffle;
  globalThis.GameUtils.randomInt = randomInt;

  const meta = globalThis.QuizRegistry.get(QUIZ_ID);
  return meta.create(meta);
}

function wrongIndex(state) {
  return (state.correctIndex + 1) % state.options.length;
}

function answerWrongThenCorrect(quiz, state, responseMs = 900) {
  const retried = quiz.onAnswer(wrongIndex(state), { responseMs });
  return quiz.onAnswer(retried.correctIndex, { responseMs });
}

describe("multiplication-1120-v2 modular clone", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.FactCatalog;
    delete globalThis.QFGenerator;
    delete globalThis.ItemGenerator;
    delete globalThis.SubquizDefinition;
    delete globalThis.SubquizOrchestrator;
    delete globalThis.Mul1120V2ModularQuiz;
  });

  it("registers as a separate visible lab quiz", () => {
    setupQuiz();
    const meta = globalThis.QuizRegistry.get(QUIZ_ID);

    assert.equal(meta.title, "T*/ 11-20 v2 - Clonat - Modular");
    assert.equal(meta.order, 2.1);
  });

  it("starts with modular anchors by default", () => {
    const quiz = setupQuiz();
    const state = quiz.beginRound();

    assert.equal(quiz.getSubquizStartOption(), "normal");
    assert.equal(quiz.getSubquizStage(), "anchors");
    assert.match(quiz.getLevelLabel(), /Subquiz 1/);
    assert.match(state.prompt, /\?/);
    assert.equal(state.options.length, 3);
  });

  it("exposes direct controls for the first modular stages", () => {
    const quiz = setupQuiz();

    assert.deepEqual(
      quiz.getSubquizStartOptions().map((opt) => opt.label),
      [
        "Normal",
        "1 anchors",
        "2 intensiv",
        "3 valori ancore suma",
        "4 adunari rapide cu ancore",
        "5 adunare efectiva ancore",
        "6 inmultiri non-anchors",
        "7 domenii non-anchors EFF",
      ]
    );
  });

  it("reports the direct modular stage before the first round starts", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");

    assert.equal(quiz.getSubquizStage(), "rapidAnchorAdditions");
    assert.equal(quiz.getLevelLabel(), "Nivel 1 - Subquiz 4 - adunari rapide cu ancore");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 4: adunari rapide cu ancore");
  });

  it("reports direct modular subquiz 5 before the first round starts", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");

    assert.equal(quiz.getSubquizStage(), "effectiveAnchorAddition");
    assert.equal(quiz.getLevelLabel(), "Nivel 1 - Subquiz 5 - adunare efectiva ancore");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 5: adunare efectiva ancore");
  });

  it("reports direct modular subquiz 6 before the first round starts", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("nonAnchorProducts");

    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
    assert.equal(quiz.getLevelLabel(), "Nivel 1 - Subquiz 6 - inmultiri non-anchors");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 6: inmultiri non-anchors");
  });

  it("reports direct modular subquiz 7 before the first round starts", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("domainProducts");

    assert.equal(quiz.getSubquizStage(), "domainProducts");
    assert.equal(quiz.getLevelLabel(), "Nivel 1 - Subquiz 7 - domenii non-anchors EFF");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 7: domenii non-anchors EFF");
  });

  it("advances level after 21 anchor answers in the first modular stage", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorsOnly");
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "anchors");
  });

  it("pushes the internal intensive subquiz after two distinct anchor mistakes are corrected", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(quiz.getSubquizStage(), "intensiv");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 2: intensiv");
    assert.match(state.prompt, /\?/);
    assert.equal(state.subquizEvent.action, "push");
  });

  it("returns from internal intensive to the same anchor flow after ten questions", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getSubquizStage(), "anchors");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 1: anchors modular");
    assert.equal(state.subquizEvent.action, "pop");
    assert.match(state.prompt, /\?/);
  });

  it("direct intensive mode advances level after ten questions", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("intensivOnly");
    let state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "intensiv");
    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "intensiv");
  });

  it("normal route continues from anchors into modular subquiz 3", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 3: valori ancore suma");
    assert.equal(state.prompt, "11*6=?+11*1");
    assert.deepEqual(state.options, ["55", "66", "77"]);
  });

  it("direct modular subquiz 3 advances level after 12 counted attempts once the current question is corrected", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorSumValuesOnly");
    let state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
    for (let i = 0; i < 6; i += 1) {
      state = answerWrongThenCorrect(quiz, state);
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
  });

  it("direct modular subquiz 3 advances level after 7 consecutive correct answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorSumValuesOnly");
    let state = quiz.beginRound();

    for (let i = 0; i < 7; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
  });

  it("normal route continues from modular subquiz 3 into modular subquiz 4", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    for (let i = 0; i < 6; i += 1) {
      state = answerWrongThenCorrect(quiz, state);
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "rapidAnchorAdditions");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 4: adunari rapide cu ancore");
    assert.equal(state.prompt, "165+44=165+40+?");
  });

  it("direct modular subquiz 4 repeats a single candidate until the first correct answer", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    let state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "rapidAnchorAdditions");
    assert.equal(state.prompt, "165+44=165+40+?");
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.prompt, "165+44=165+40+?");

    state = quiz.onTimeout();
    assert.equal(state.prompt, "165+44=165+40+?");

    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "rapidAnchorAdditions");
  });

  it("direct modular subquiz 4 advances after the calculated multiple-candidate limit", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(4);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "70+42=100+?");
    for (let i = 0; i < 2; i += 1) {
      state = answerWrongThenCorrect(quiz, state);
      assert.equal(state.levelAdvanced, undefined);
    }

    state = answerWrongThenCorrect(quiz, state);
    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 5);
  });

  it("direct modular subquiz 4 does not repeat immediately when alternatives exist", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(2);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "60+48=100+?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.notEqual(state.prompt, "60+48=100+?");
  });

  it("direct modular subquiz 4 keeps old rounding rules", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("rapidAnchorAdditions");
    quiz.switchLevel(9);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "95+19=100+?");
    assert.deepEqual(state.options, ["14", "24", "4"]);

    quiz.switchLevel(3);
    state = quiz.beginRound();
    assert.equal(state.prompt, "65+26=65+30-?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "65+52=65+50+?");
  });

  it("direct modular subquiz 4 announces no candidates and completes at level 10", () => {
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

  it("normal route continues from modular subquiz 4 into modular subquiz 5", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    for (let i = 0; i < 6; i += 1) {
      state = answerWrongThenCorrect(quiz, state);
    }
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "effectiveAnchorAddition");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 5: adunare efectiva ancore");
    assert.equal(state.prompt, "55+11=?");
  });

  it("direct modular subquiz 5 advances level after 21 counted attempts once the current question is corrected", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    for (let i = 0; i < 9; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
      assert.equal(state.levelAdvanced, undefined);
    }
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.levelAdvanced, undefined);
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.levelAdvanced, undefined);
    for (let i = 0; i < 8; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
      assert.equal(state.levelAdvanced, undefined);
    }
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.levelAdvanced, undefined);
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "effectiveAnchorAddition");
    assert.equal(state.runDelayMs, 0);
  });

  it("direct modular subquiz 5 advances level after 10 consecutive correct answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
  });

  it("direct modular subquiz 5 completes the quiz at the end of level 10", () => {
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

  it("direct modular subquiz 5 does not repeat the same question immediately", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "55+11=?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.notEqual(state.prompt, "55+11=?");
  });

  it("direct modular subquiz 5 keeps the same question after wrong answer until corrected", () => {
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

  it("direct modular subquiz 5 retries a missed addition after two to five later turns", () => {
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

  it("direct modular subquiz 5 enters intensive mode after two additions have at least two mistakes", () => {
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

    assert.equal(quiz.getSubquizStage(), "effectiveAnchorAdditionIntensive");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 5: intensiv");
    assert.equal(state.subquizEvent.action, "push");
    assert.match(state.prompt, /\?/);
    assert.notEqual(state.prompt, "55+11=?");
  });

  it("direct modular subquiz 5 intensive mode returns to normal subquiz 5 flow after ten questions", () => {
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

    assert.equal(quiz.getSubquizStage(), "effectiveAnchorAddition");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 5: adunare efectiva ancore");
    assert.equal(state.subquizEvent.action, "pop");
    assert.match(state.prompt, /^\d+\+\d+=\?$/);
  });

  it("direct modular subquiz 5 picks the next question near the current one", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("effectiveAnchorAddition");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "55+11=?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "55+22=?");
  });

  it("normal route continues from modular subquiz 5 into modular subquiz 6", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    for (let i = 0; i < 6; i += 1) {
      state = answerWrongThenCorrect(quiz, state);
    }
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 6: inmultiri non-anchors");
    assert.equal(state.prompt, "6*11=?");
  });

  it("direct modular subquiz 6 advances after all non-anchors are correct consecutively", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("nonAnchorProducts");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "6*11=?");
    for (let i = 0; i < 12; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
  });

  it("direct modular subquiz 6 advances after 21 main attempts once the current question is corrected", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("nonAnchorProducts");
    let state = quiz.beginRound();

    for (let i = 0; i < 11; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
      assert.equal(state.levelAdvanced, undefined);
    }
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.levelAdvanced, undefined);
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.levelAdvanced, undefined);
    for (let i = 0; i < 7; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
      assert.equal(state.levelAdvanced, undefined);
    }
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.levelAdvanced, undefined);
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
  });

  it("direct modular subquiz 6 enters intensive mode after two distinct wrong non-anchors are corrected", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("nonAnchorProducts");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "6*11=?");
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.prompt, "6*11=?");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(state.prompt, "7*11=?");

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    assert.equal(quiz.getSubquizStage(), "nonAnchorProductsIntensive");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 6: intensiv");
    assert.equal(state.subquizEvent.action, "push");
    assert.match(state.prompt, /\?/);
    assert.notEqual(state.prompt, "8*11=?");
  });

  it("direct modular subquiz 6 intensive mode returns to normal subquiz 6 flow after ten questions", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("nonAnchorProducts");
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 6: inmultiri non-anchors");
    assert.equal(state.subquizEvent.action, "pop");
    assert.match(state.prompt, /^\d+\*11=\?$/);
  });

  it("direct modular subquiz 6 does not count intensive questions toward the 21 main questions", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("nonAnchorProducts");
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getSubquizStage(), "nonAnchorProducts");
    assert.equal(quiz.getLevel(), 1);
    assert.equal(state.levelAdvanced, undefined);

    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.equal(quiz.getLevel(), 1);
    assert.equal(state.levelAdvanced, undefined);
  });

  it("normal route continues from modular subquiz 6 into modular subquiz 7", () => {
    const quiz = setupQuiz();
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
    for (let i = 0; i < 12; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "domainProducts");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 7: domenii non-anchors EFF");
    assert.equal(state.prompt, "11*?=66");
  });

  it("direct modular subquiz 7 runs each domain for 15 equation-form questions", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("domainProducts");
    quiz.switchLevel(7);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "17*?=102");
    assert.equal(state.options[state.correctIndex], "6");
    assert.match(quiz.getInfo11_20().answeredText, /^6-10: 0 \/ 15/);

    for (let i = 0; i < 15; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    assert.equal(state.prompt, "17*?=187");
    assert.match(quiz.getInfo11_20().answeredText, /^11-15: 0 \/ 15/);

    for (let i = 0; i < 15; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    assert.equal(state.prompt, "17*?=272");
    assert.match(quiz.getInfo11_20().answeredText, /^16-20: 0 \/ 15/);

    for (let i = 0; i < 15; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 8);
    assert.equal(quiz.getSubquizStage(), "domainProducts");
  });

  it("direct modular subquiz 7 never asks for the level factor as the answer", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("domainProducts");
    quiz.switchLevel(7);
    let state = quiz.beginRound();

    for (let i = 0; i < 45; i += 1) {
      assert.notEqual(Number(state.options[state.correctIndex]), 17);
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
  });

  it("direct modular subquiz 7 uses close traps when the missing factor is found by division", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("domainProducts");
    quiz.switchLevel(7);
    const state = quiz.beginRound();
    const correct = Number(state.options[state.correctIndex]);

    assert.equal(state.prompt, "17*?=102");
    assert.deepEqual(
      state.options.map(Number).sort((a, b) => a - b),
      [5, 6, 7]
    );
    state.options.forEach((option) => {
      assert.ok(Math.abs(Number(option) - correct) <= 3);
    });
  });

  it("direct modular subquiz 7 uses same-last-digit traps when the missing product is found by multiplication", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("domainProducts");
    quiz.switchLevel(7);
    let state = quiz.beginRound();

    while (state.prompt !== "17*6=?") {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    const correct = Number(state.options[state.correctIndex]);
    assert.deepEqual(
      state.options.map(Number).sort((a, b) => a - b),
      [92, 102, 112]
    );
    state.options.forEach((option) => {
      const value = Number(option);
      assert.equal(value % 10, correct % 10);
      assert.ok(Math.abs(value - correct) <= 30);
    });
  });

  it("direct modular subquiz 7 avoids immediate repeats of the same fact across equation forms", () => {
    const quiz = setupQuiz({
      shuffle: (items) => {
        if (items.every((item) => item?.metadata?.subquiz === "domainProducts")) {
          return [...items].sort((a, b) => a.metadata.factB - b.metadata.factB);
        }
        return [...items];
      },
    });
    quiz.setSubquizStartOption("domainProducts");
    quiz.switchLevel(7);
    let state = quiz.beginRound();
    let previousFact = null;

    for (let i = 0; i < 15; i += 1) {
      const correct = Number(state.options[state.correctIndex]);
      const currentFact = correct > 20 ? correct / 17 : correct;
      assert.notEqual(currentFact, previousFact);
      previousFact = currentFact;
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }
  });

  it("direct modular subquiz 7 keeps the same question after a wrong answer", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("domainProducts");
    let state = quiz.beginRound();

    assert.equal(state.prompt, "11*?=66");
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    assert.equal(state.prompt, "11*?=66");
    state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    assert.notEqual(state.prompt, "11*?=66");
  });
});
