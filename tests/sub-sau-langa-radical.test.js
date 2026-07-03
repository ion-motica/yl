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

function wrongOptionIndex(state, used = []) {
  return state.options.findIndex((option, index) => index !== state.correctIndex && !used.includes(index));
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

test("uses numeric answers and advances through advanced levels after twelve correct answers", () => {
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

  for (let i = 0; i < 11; i += 1) {
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
    assert.equal(quiz.isCompleted(), false);
  }

  state = answerCorrect(quiz, state);
  assert.equal(state.levelAdvanced, true);
  assert.equal(quiz.getLevel(), 4);
  state = state.nextRound;

  for (let i = 0; i < 11; i += 1) {
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
    assert.equal(quiz.isCompleted(), false);
  }

  state = answerCorrect(quiz, state);
  assert.equal(state.levelAdvanced, true);
  assert.equal(quiz.getLevel(), 5);
  state = state.nextRound;

  for (let i = 0; i < 11; i += 1) {
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
    assert.equal(quiz.isCompleted(), false);
  }

  state = answerCorrect(quiz, state);

  assert.equal(quiz.isCompleted(), true);
  assert.equal(state.prompt, "Felicitari! Ai terminat quizul!");
  assert.equal(state.hintMessage, "Felicitari! Ai terminat quizul!");
});

test("level 3 advances after 21 completed questions even with a broken streak", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const meta = globalThis.QuizRegistry.get("sub-sau-langa-radical");
  const quiz = meta.create(meta);
  let state = quiz.beginRound();

  for (let i = 0; i < 10; i += 1) {
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
  }

  assert.equal(quiz.getLevel(), 3);

  for (let i = 0; i < 20; i += 1) {
    state = quiz.onAnswer(wrongOptionIndex(state));
    assert.equal(quiz.isCompleted(), false);
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
    assert.equal(quiz.getLevel(), 3);
  }

  state = quiz.onAnswer(wrongOptionIndex(state));
  state = answerCorrect(quiz, state);

  assert.equal(state.levelAdvanced, true);
  assert.equal(quiz.getLevel(), 4);
  assert.equal(quiz.isCompleted(), false);
});

test("level 4 advances after 21 completed questions even with a broken streak", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const meta = globalThis.QuizRegistry.get("sub-sau-langa-radical");
  const quiz = meta.create(meta);
  let state = quiz.beginRound();

  for (let i = 0; i < 10; i += 1) {
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
  }

  for (let i = 0; i < 12; i += 1) {
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
  }

  assert.equal(quiz.getLevel(), 4);

  for (let i = 0; i < 20; i += 1) {
    state = quiz.onAnswer(wrongOptionIndex(state));
    assert.equal(quiz.isCompleted(), false);
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
    assert.equal(quiz.isCompleted(), false);
  }

  state = quiz.onAnswer(wrongOptionIndex(state));
  state = answerCorrect(quiz, state);

  assert.equal(state.levelAdvanced, true);
  assert.equal(quiz.getLevel(), 5);
  assert.equal(quiz.isCompleted(), false);
});

test("level 5 completes after 21 completed questions even with a broken streak", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const meta = globalThis.QuizRegistry.get("sub-sau-langa-radical");
  const quiz = meta.create(meta);
  let state = quiz.beginRound();

  for (let level = 1; level < 5; level += 1) {
    const needed = level < 3 ? 5 : 12;
    for (let i = 0; i < needed; i += 1) {
      state = answerCorrect(quiz, state);
      if (state.nextRound) state = state.nextRound;
    }
  }

  assert.equal(quiz.getLevel(), 5);

  for (let i = 0; i < 20; i += 1) {
    state = quiz.onAnswer(wrongOptionIndex(state));
    assert.equal(quiz.isCompleted(), false);
    state = answerCorrect(quiz, state);
    if (state.nextRound) state = state.nextRound;
    assert.equal(quiz.isCompleted(), false);
  }

  state = quiz.onAnswer(wrongOptionIndex(state));
  state = answerCorrect(quiz, state);

  assert.equal(state.gameComplete, true);
  assert.equal(quiz.isCompleted(), true);
  assert.equal(state.prompt, "Felicitari! Ai terminat quizul!");
});

test("wrong answers keep the same question and reset the consecutive streak", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const meta = globalThis.QuizRegistry.get("sub-sau-langa-radical");
  const quiz = meta.create(meta);
  let state = quiz.beginRound();

  state = answerCorrect(quiz, state);
  const beforeWrong = state;
  state = quiz.onAnswer(wrongOptionIndex(state));

  assert.equal(state.outcome, "wrong-answer");
  assert.equal(state.correct, false);
  assert.equal(state.resetFall, undefined);
  assert.equal(state.prompt, beforeWrong.prompt);
  assert.deepEqual(state.options, beforeWrong.options);

  state = quiz.onAnswer(wrongOptionIndex(state, [wrongOptionIndex(state)]));
  assert.equal(state.outcome, "wrong-answer");
  assert.equal(state.prompt, beforeWrong.prompt);
  assert.deepEqual(state.options, beforeWrong.options);

  for (let i = 0; i < 4; i += 1) {
    state = answerCorrect(quiz, state);
  }

  assert.equal(quiz.getLevel(), 1);
});

test("timeout keeps the same question without resetting the fall", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const meta = globalThis.QuizRegistry.get("sub-sau-langa-radical");
  const quiz = meta.create(meta);
  const state = quiz.beginRound();
  const timedOut = quiz.onTimeout();

  assert.equal(timedOut.outcome, "timeout");
  assert.equal(timedOut.correct, false);
  assert.equal(timedOut.resetFall, undefined);
  assert.equal(timedOut.prompt, state.prompt);
  assert.deepEqual(timedOut.options, state.options);
});

test("never uses equal k and n values", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  for (let level = 1; level <= 5; level += 1) {
    for (let i = 0; i < 60; i += 1) {
      const question = globalThis.SubSauLangaRadicalQuiz.buildQuestion(level, null);

      assert.notEqual(question.k, question.n);
    }
  }
});

test("level 4 uses k and n values from two through five", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  globalThis.GameUtils.randomInt = (min, max) => max;
  let question = globalThis.SubSauLangaRadicalQuiz.buildQuestion(4, null);
  assert.equal(question.k, 5);
  assert.equal(question.n, 4);

  let call = 0;
  globalThis.GameUtils.randomInt = (min, max) => {
    call += 1;
    return call === 2 ? max : min;
  };
  question = globalThis.SubSauLangaRadicalQuiz.buildQuestion(4, null);
  assert.equal(question.k, 2);
  assert.equal(question.n, 5);
});

test("level 5 uses k and n values from four through six", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  globalThis.GameUtils.randomInt = (min, max) => max;
  let question = globalThis.SubSauLangaRadicalQuiz.buildQuestion(5, null);
  assert.equal(question.k, 6);
  assert.equal(question.n, 5);

  let call = 0;
  globalThis.GameUtils.randomInt = (min, max) => {
    call += 1;
    return call === 2 ? max : min;
  };
  question = globalThis.SubSauLangaRadicalQuiz.buildQuestion(5, null);
  assert.equal(question.k, 4);
  assert.equal(question.n, 6);
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
