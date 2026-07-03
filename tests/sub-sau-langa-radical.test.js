import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function loadQuiz() {
  globalThis.window = globalThis;
  loadScript("js/utils.js");
  loadScript("js/progress-display.js");
  loadScript("js/quiz-registry.js");
  loadScript("js/quizzes/sub-sau-langa-radical.js");
}

function answerCorrect(quiz, state) {
  return quiz.onAnswer(state.correctIndex);
}

beforeEach(() => {
  delete globalThis.GameUtils;
  delete globalThis.ProgressDisplay;
  delete globalThis.QuizRegistry;
  delete globalThis.SubSauLangaRadicalQuiz;
  globalThis.Math.random = () => 0;
});

test("registers as a separate radical v1 quiz", () => {
  loadQuiz();

  const meta = globalThis.QuizRegistry.get("sub-sau-langa-radical");

  assert.equal(meta.title, "Sub sau lângă radical v1");
  assert.equal(typeof meta.create, "function");
});

test("uses numeric answers and advances after five consecutive correct answers", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const meta = globalThis.QuizRegistry.get("sub-sau-langa-radical");
  const quiz = meta.create(meta);
  let state = quiz.beginRound();

  assert.equal(quiz.getLevel(), 1);
  assert.deepEqual(
    state.options.map((option) => Number.isInteger(Number(option))),
    [true, true, true]
  );

  for (let i = 0; i < 4; i += 1) {
    state = answerCorrect(quiz, state);
    assert.equal(quiz.getLevel(), 1);
  }

  state = answerCorrect(quiz, state);
  assert.equal(state.levelAdvanced, true);
  assert.equal(quiz.getLevel(), 2);
  state = state.nextRound;

  for (let i = 0; i < 5; i += 1) {
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
  }

  assert.equal(quiz.getLevel(), 3);

  for (let i = 0; i < 5; i += 1) {
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
  }

  assert.equal(quiz.isCompleted(), true);
});

test("wrong answer resets the consecutive streak", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const meta = globalThis.QuizRegistry.get("sub-sau-langa-radical");
  const quiz = meta.create(meta);
  let state = quiz.beginRound();

  state = answerCorrect(quiz, state);
  state = quiz.onAnswer((state.correctIndex + 1) % state.options.length);
  assert.equal(state.correct, false);

  for (let i = 0; i < 4; i += 1) {
    state = answerCorrect(quiz, state);
  }

  assert.equal(quiz.getLevel(), 1);
});

test("never uses equal k and n values", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  for (let level = 1; level <= 3; level += 1) {
    for (let i = 0; i < 60; i += 1) {
      const question = globalThis.SubSauLangaRadicalQuiz.buildQuestion(level, null);

      assert.notEqual(question.k, question.n);
    }
  }
});

test("orders radical factors like the left side by default", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const question = globalThis.SubSauLangaRadicalQuiz.buildQuestion(1, null);
  const kSquaredIndex = question.promptHtml.indexOf("2<sup>2</sup>");
  const nPlaceholderIndex = question.promptHtml.indexOf('<span class="q-mark">?</span>', kSquaredIndex);

  assert.equal(question.form, "L1-IN-1");
  assert.ok(kSquaredIndex >= 0);
  assert.ok(nPlaceholderIndex > kSquaredIndex);
});
