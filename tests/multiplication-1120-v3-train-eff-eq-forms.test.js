import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
const QUIZ_ID = "multiplication-1120-v3-train-eff-eq-forms";

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

function setupQuiz({ shuffle = (items) => [...items], random = () => 0 } = {}) {
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
    "js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js",
  ].forEach(loadScript);

  globalThis.GameUtils.shuffle = shuffle;

  const meta = globalThis.QuizRegistry.get(QUIZ_ID);
  return meta.create({ ...meta, random });
}

function wrongIndex(state) {
  return (state.correctIndex + 1) % state.options.length;
}

describe("multiplication-1120-v3 train eff eq forms", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.FactCatalog;
    delete globalThis.QFGenerator;
    delete globalThis.ItemGenerator;
    delete globalThis.SubquizDefinition;
    delete globalThis.SubquizOrchestrator;
    delete globalThis.Mul1120V3TrainEffEqFormsQuiz;
  });

  it("registers as the requested v3 quiz", () => {
    setupQuiz();
    const meta = globalThis.QuizRegistry.get(QUIZ_ID);

    assert.equal(meta.title, "T*/ 11-20 - v3 - train w eff si eq forms");
    assert.equal(meta.order, 2.2);
  });

  it("starts level 1 with factor 11 and b values from 1 to 11", () => {
    const quiz = setupQuiz();
    const state = quiz.beginRound();

    assert.equal(quiz.getSubquizStage(), "base");
    assert.equal(quiz.getLevelLabel(), "Nivel 1 - Subquiz 1 - baza (11x)");
    assert.equal(state.prompt, "?*1=11");
    assert.equal(state.options.length, 3);
    assert.equal(quiz.getInfo11_20().facts.length, 11);
  });

  it("picks facts randomly with a bias toward smaller values instead of fixed ascending order", () => {
    const quiz = setupQuiz({ random: () => 0.99 });
    const state = quiz.beginRound();

    assert.equal(state.prompt, "?*11=121");
  });

  it("advances to level 2 after 12 base answers while SQ2 interruptions return to base", () => {
    const quiz = setupQuiz();
    quiz.setSq2Config?.({ factCount: 1, exitCount: 3, exitMode: "any" });
    let state = quiz.beginRound();

    for (let guard = 0; guard < 40 && quiz.getLevel() === 1; guard += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 900 });
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getSubquizStage(), "base");
    assert.equal(state.nextRound.prompt, "?*1=12");
    assert.equal(quiz.getInfo11_20().answeredText, "0 / 12");
  });

  it("level 10 uses factor 20 and b values from 1 to 20", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(10);
    const state = quiz.beginRound();

    assert.equal(state.prompt, "?*1=20");
    assert.equal(quiz.getInfo11_20().facts.length, 20);
    assert.equal(quiz.getLevelButtonTitle(10), "Nivel 10: 20*1-20");
  });

  it("uses close factor traps when equation forms ask for the missing factor", () => {
    const quiz = setupQuiz({
      shuffle: (items) =>
        items?.[0]?.id?.includes?.("trei_pozitii_pt_cate_un_numar")
          ? items.filter((type) => type.id === "f1_initial:doua_nr_in_STANGA:trei_pozitii_pt_cate_un_numar:2")
          : [...items],
    });
    const state = quiz.beginRound();

    assert.equal(state.prompt, "11*?=11");
    assert.deepEqual(
      state.options.map(Number).sort((a, b) => a - b),
      [0, 1, 2]
    );
  });

  it("limits level-factor answers to at most one in ten generated questions", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();
    const firstTenCorrectAnswers = [];

    for (let i = 0; i < 10; i += 1) {
      firstTenCorrectAnswers.push(Number(state.options[state.correctIndex]));
      state = quiz.onAnswer(state.correctIndex);
    }

    assert.equal(
      firstTenCorrectAnswers.filter((answer) => answer === 11).length,
      1
    );
    assert.equal(state.prompt, "?*11=121");
    assert.equal(Number(state.options[state.correctIndex]), 11);
  });

  it("enters SQ2 manually with the current fact and returns to base after the exit count", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    state = quiz.runArenaAction("sendCurrentFactToSq2");
    assert.equal(quiz.getSubquizStage(), "sq2EffVbs");
    assert.equal(quiz.getLevelLabel(), "Nivel 1 - Subquiz 2 - Intensiv cu eff VBS");
    assert.match(quiz.getInfo11_20().mode, /Subquiz 2/);

    for (let i = 0; i < 3; i += 1) {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 700 });
    }

    assert.equal(quiz.getSubquizStage(), "base");
    assert.match(state.prompt, /\?/);
  });

  it("waits for the current correction before entering SQ2 after two wrong facts accumulate", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 800 });
    const secondWrongPrompt = state.prompt;
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 700 });

    assert.equal(quiz.getSubquizStage(), "base");
    assert.equal(state.prompt, secondWrongPrompt);

    state = quiz.onAnswer(state.correctIndex, { responseMs: 700 });

    assert.equal(quiz.getSubquizStage(), "sq2EffVbs");
    assert.match(quiz.getInfo11_20().intensivText, /11\*1/);
    assert.match(quiz.getInfo11_20().intensivText, /11\*3/);
  });

  it("enters SQ2 after five base answers using the slowest facts", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    [100, 500, 200, 900, 300].forEach((responseMs) => {
      state = quiz.onAnswer(state.correctIndex, { responseMs });
    });

    assert.equal(quiz.getSubquizStage(), "sq2EffVbs");
    assert.match(quiz.getInfo11_20().intensivText, /11\*4/);
    assert.match(quiz.getInfo11_20().intensivText, /11\*2/);
  });

  it("SQ2 counts wrong answers but exits only after the current question is corrected", () => {
    const quiz = setupQuiz();
    quiz.setSq2Config?.({ factCount: 1, exitCount: 3, exitMode: "any" });
    let state = quiz.beginRound();
    state = quiz.runArenaAction("sendCurrentFactToSq2");
    const sq2Prompt = state.prompt;

    for (let i = 0; i < 3; i += 1) {
      state = quiz.onAnswer(wrongIndex(state), { responseMs: 700 });
    }

    assert.equal(quiz.getSubquizStage(), "sq2EffVbs");
    assert.equal(state.prompt, sq2Prompt);

    state = quiz.onAnswer(state.correctIndex, { responseMs: 700 });

    assert.equal(quiz.getSubquizStage(), "base");
  });

  it("SQ2 avoids immediate fact repeats when it has multiple facts", () => {
    const randomValues = [0, 0, 0, 0.99, 0, 0, 0];
    const quiz = setupQuiz({
      random: () => randomValues.shift() ?? 0,
    });
    quiz.setSq2Config?.({ factCount: 2, exitCount: 5, exitMode: "any" });
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 800 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 700 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 700 });

    assert.equal(quiz.getSubquizStage(), "sq2EffVbs");
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      seen.push(state.metadata.factB);
      state = quiz.onAnswer(state.correctIndex, { responseMs: 700 });
    }

    for (let i = 1; i < seen.length; i += 1) {
      assert.notEqual(seen[i], seen[i - 1]);
    }
  });

  it("does not recycle the same SQ2 facts from stale wrong or slow base state", () => {
    const quiz = setupQuiz();
    quiz.setSq2Config?.({ factCount: 2, exitCount: 3, exitMode: "any" });
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 900 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 800 });
    state = quiz.onAnswer(wrongIndex(state), { responseMs: 700 });
    state = quiz.onAnswer(state.correctIndex, { responseMs: 700 });

    assert.equal(quiz.getSubquizStage(), "sq2EffVbs");
    const firstSq2Facts = quiz.getInfo11_20().intensivText;
    assert.match(firstSq2Facts, /11\*1/);
    assert.match(firstSq2Facts, /11\*3/);

    while (quiz.getSubquizStage() === "sq2EffVbs") {
      state = quiz.onAnswer(state.correctIndex, { responseMs: 700 });
    }

    [100, 200, 300, 400, 500].forEach((responseMs) => {
      if (quiz.getSubquizStage() === "base") {
        state = quiz.onAnswer(state.correctIndex, { responseMs });
      }
    });

    assert.equal(quiz.getSubquizStage(), "sq2EffVbs");
    const nextSq2Facts = quiz.getInfo11_20().intensivText;
    assert.doesNotMatch(nextSq2Facts, /11\*1/);
    assert.doesNotMatch(nextSq2Facts, /11\*3/);
  });
});
