import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUIZ_ID = "pre-equations-eff-navigation";

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  const runner = new Function("window", `${code}\n`);
  runner(globalThis);
}

function setupQuiz() {
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  [
    "js/utils.js",
    "js/placeholder-raspuns.js",
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/pre-equations-eff-navigation.js",
  ].forEach(loadScript);

  globalThis.GameUtils.shuffle = (items) => [...items];

  const meta = globalThis.QuizRegistry.get(QUIZ_ID);
  return meta.create(meta);
}

function wrongIndex(state) {
  return (state.correctIndex + 1) % state.options.length;
}

function answerCorrect(quiz, state) {
  return quiz.onAnswer(state.correctIndex, { responseMs: 500 });
}

describe("pre-equations EFF navigation quiz", () => {
  beforeEach(() => {
    delete globalThis.window;
    delete globalThis.alert;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.QuizRegistry;
    delete globalThis.PreEquationNavigationQuiz;
    delete globalThis.Motor3Butoane;
  });

  it("starts with the fixed three-step chain for the first additive triangle", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    assert.equal(state.prompt, "2=5-?");
    assert.equal(state.options[state.correctIndex], "3");

    state = answerCorrect(quiz, state);
    assert.equal(state.prompt, "3=?-2");
    assert.equal(state.options[state.correctIndex], "5");

    state = answerCorrect(quiz, state);
    assert.equal(state.prompt, "5=3+?");
    assert.equal(state.options[state.correctIndex], "2");
  });

  it("restarts the same triangle after a flawed cycle when retry is enabled", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    state = quiz.onAnswer(wrongIndex(state), { responseMs: 500 });
    assert.equal(state.prompt, "2=5-?");

    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);

    assert.equal(state.prompt, "2=5-?");
    assert.equal(quiz.getProgressDisplay().green.filled, 0);
  });

  it("picks a linked unused triangle after a perfect cycle", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);

    assert.equal(state.prompt, "2=6-?");
    assert.equal(state.options[state.correctIndex], "4");
    assert.equal(quiz.getProgressDisplay().green.filled, 1);
  });

  it("can disable the nearby next set preference", () => {
    const quiz = setupQuiz();
    quiz.setPreEquationNavigationConfig({ nearNextSet: false });
    let state = quiz.beginRound();

    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);

    assert.equal(state.prompt, "1=2-?");
    assert.equal(state.options[state.correctIndex], "1");
  });

  it("advances after three perfect triangles in a row", () => {
    const quiz = setupQuiz();
    let state = quiz.beginRound();

    for (let i = 0; i < 9; i += 1) {
      state = answerCorrect(quiz, state);
    }

    assert.equal(state.levelAdvanced, true);
    assert.equal(quiz.getLevel(), 2);
    assert.equal(state.nextRound.prompt, "4=9-?");
  });

  it("keeps numeric answers as the default through level 3", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(3);
    const state = quiz.beginRound();

    assert.equal(state.prompt, "6=13-?");
    assert.equal(state.options[state.correctIndex], "7");
    assert.equal(quiz.getPreEquationNavigationConfig().effectiveAnswerMode, "number");
    assert.equal(quiz.getPreEquationNavigationConfig().effectiveUnknownSymbol, "?");
  });

  it("alternates by default from level 4", () => {
    const quiz = setupQuiz();
    quiz.switchLevel(4);
    let state = quiz.beginRound();

    assert.equal(state.prompt, "8=17-?");
    assert.equal(state.options[state.correctIndex], "9");
    assert.equal(quiz.getPreEquationNavigationConfig().effectiveAnswerMode, "alternate");

    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);

    assert.equal(state.prompt, "8=18-x; x=?");
    assert.equal(state.options[state.correctIndex], "18-8");
  });

  it("can alternate one numeric triangle with one formula triangle by config", () => {
    const quiz = setupQuiz();
    quiz.setPreEquationNavigationConfig({ answerMode: "alternate" });
    let state = quiz.beginRound();

    assert.equal(state.options[state.correctIndex], "3");

    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);

    assert.equal(state.prompt, "2=6-x; x=?");
    assert.equal(state.options[state.correctIndex], "6-2");
  });

  it("can use a checked multiplicative sign for the whole triangle", () => {
    const quiz = setupQuiz();
    quiz.setPreEquationNavigationConfig({ operators: ["*"] });
    let state = quiz.beginRound();

    assert.equal(state.prompt, "2=6/?");
    assert.equal(state.options[state.correctIndex], "3");

    state = answerCorrect(quiz, state);
    assert.equal(state.prompt, "3=?/2");
    assert.equal(state.options[state.correctIndex], "6");

    state = answerCorrect(quiz, state);
    assert.equal(state.prompt, "6=3*?");
    assert.equal(state.options[state.correctIndex], "2");
    assert.deepEqual(quiz.getPreEquationNavigationConfig().operators, ["*"]);
  });

  it("collapses inverse signs into the two sign families", () => {
    const quiz = setupQuiz();
    quiz.setPreEquationNavigationConfig({ operators: ["-", "/"] });

    assert.deepEqual(quiz.getPreEquationNavigationConfig().operators, ["+", "*"]);
  });

  it("uses question mark as the default unknown for numeric answers", () => {
    const quiz = setupQuiz();
    const state = quiz.beginRound();

    assert.equal(state.prompt, "2=5-?");
    assert.equal(quiz.getPreEquationNavigationConfig().effectiveUnknownSymbol, "?");
  });

  it("allows overriding the unknown symbol independently", () => {
    const quiz = setupQuiz();
    quiz.setPreEquationNavigationConfig({ unknownSymbol: "x" });
    let state = quiz.beginRound();

    assert.equal(state.prompt, "2=5-x");
    assert.equal(state.options[state.correctIndex], "3");
    assert.equal(quiz.getPreEquationNavigationConfig().effectiveUnknownSymbol, "x");

    quiz.setPreEquationNavigationConfig({ answerMode: "formula", unknownSymbol: "?" });
    state = quiz.beginRound();

    assert.equal(state.prompt, "2=5-?");
    assert.equal(state.options[state.correctIndex], "?=5-2");
    assert.equal(quiz.getPreEquationNavigationConfig().effectiveUnknownSymbol, "?");
  });

  it("always puts x equals in the prompt when formula answers use x", () => {
    const quiz = setupQuiz();
    quiz.setPreEquationNavigationConfig({
      answerMode: "formula",
      unknownSymbol: "x",
    });
    const state = quiz.beginRound();

    assert.equal(state.prompt, "2=5-x; x=?");
    assert.equal(state.options[state.correctIndex], "5-2");
    assert.ok(state.options.every((option) => !option.startsWith("x=")));
  });
});
