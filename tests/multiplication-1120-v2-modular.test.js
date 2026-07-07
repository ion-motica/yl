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

function setupQuiz() {
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

  globalThis.GameUtils.shuffle = (items) => [...items];
  globalThis.GameUtils.randomInt = (min) => min;

  const meta = globalThis.QuizRegistry.get(QUIZ_ID);
  return meta.create(meta);
}

function wrongIndex(state) {
  return (state.correctIndex + 1) % state.options.length;
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
      ["Normal", "1 anchors", "2 intensiv", "3 valori ancore suma"]
    );
  });

  it("advances level after 21 anchor answers in the first modular stage", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorsOnly");
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
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
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "intensiv");
  });

  it("normal route continues from anchors into modular subquiz 3", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 3: valori ancore suma");
    assert.equal(state.prompt, "11*6=?+11*1");
    assert.deepEqual(state.options, ["55", "66", "77"]);
  });

  it("direct modular subquiz 3 advances level after 12 total answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorSumValuesOnly");
    let state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
    for (let i = 0; i < 12; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
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
});
