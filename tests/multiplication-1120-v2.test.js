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
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/fact-catalog.js",
    "js/eff/qf-generator.js",
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

describe("multiplication-1120-v2 subquiz 1", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.FactCatalog;
    delete globalThis.QFGenerator;
    delete globalThis.Mul1120V2Quiz;
  });

  it("starts directly in subquiz 3 anchor-sum mode by temporary default", () => {
    const quiz = setupQuiz();
    const state = quiz.beginRound();

    assert.equal(quiz.getSubquizStartOption(), "anchorSumValuesOnly");
    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
    assert.match(state.prompt, /^11\*6=\?\+11\*1$/);
    assert.deepEqual(state.options, ["55", "66", "77"]);
    assert.equal(state.correctIndex, 0);
  });

  it("normal mode enters subquiz 3 after 21 anchor answers, even if wrong", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("normal");
    let state = quiz.beginRound();

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    }

    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
    assert.match(state.nextRound.prompt, /^11\*6=\?\+11\*1$/);
  });

  it("subquiz 3 advances level after 12 total answers", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 12; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "anchorSumValues");
  });

  it("subquiz 3 advances level after 7 consecutive correct answers", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 7; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
  });

  it("direct anchors mode runs only anchors and advances level after 21 answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("anchorsOnly");
    let state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "normal");
    assert.match(state.prompt, /\?/);

    for (let i = 0; i < 21; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "normal");
  });

  it("direct intensiv mode uses two test anchors and advances level after 10 answers", () => {
    const quiz = setupQuiz();
    quiz.setSubquizStartOption("intensivOnly");
    let state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "intensiv");
    assert.equal(quiz.getInfo11_20().mode, "Subquiz 2: intensiv");
    assert.match(state.prompt, /\?/);

    for (let i = 0; i < 10; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "intensiv");
  });
});
