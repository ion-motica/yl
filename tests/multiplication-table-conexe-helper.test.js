import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  setupTestEnv,
  seedMultiplicationFactRecord,
  seedLevel2MultiplicationPerformantPool,
  answerCorrect,
  answerWrong,
  drainPerfectAnswers,
} from "./helpers/load-quiz-environment.js";

const QUIZ_ID = "multiplication-table-conexe-helper";

function promptUsesMulFact(a, b, prompt) {
  const c = a * b;
  return [`?*${b}=${c}`, `${a}*?=${c}`, `${c}=?*${b}`, `${c}=${a}*?`].includes(prompt);
}

function otherFactorFromPrompt(prompt, tableFactor = 2) {
  let match = prompt.match(new RegExp(`^${tableFactor}\\*\\?=(\\d+)$`));
  if (match) return Number(match[1]) / tableFactor;
  match = prompt.match(new RegExp(`^\\?\\*${tableFactor}=(\\d+)$`));
  if (match) return Number(match[1]) / tableFactor;
  match = prompt.match(new RegExp(`^(\\d+)=\\?\\*${tableFactor}$`));
  if (match) return Number(match[1]) / tableFactor;
  match = prompt.match(new RegExp(`^(\\d+)=${tableFactor}\\*\\?$`));
  if (match) return Number(match[1]) / tableFactor;
  return null;
}

describe("multiplication-table-conexe-helper quiz", () => {
  beforeEach(() => {
    setupTestEnv({ quizId: QUIZ_ID });
  });

  it("registers quiz metadata", () => {
    const meta = globalThis.QuizRegistry.get(QUIZ_ID);
    assert.equal(meta.id, QUIZ_ID);
    assert.equal(meta.title, "Tabla inmultirii - intrebari ajutatoare 5*?=15");
  });

  it("starts at level 1 and rejects level 0", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getMinLevel(), 1);

    const message = quiz.switchLevel(0);
    assert.equal(message, "Prea ușor. trecem la nivelul 1");
    assert.equal(quiz.getLevel(), 1);
  });

  it("lists level 10 facts as multiply by 10", () => {
    const facts = globalThis.ConexeTableQuizMultiplicationAdapter.listLevelFacts(10);
    assert.equal(facts.length, 10);
    assert.ok(facts.every((fact) => fact.values.a === 10));
    assert.deepEqual(
      facts.map((fact) => fact.values.b).sort((left, right) => left - right),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );
    assert.ok(promptUsesMulFact(10, 10, "10*?=100"));
  });

  it("uses star conexe prompts without singapore bond UI", () => {
    seedLevel2MultiplicationPerformantPool();
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    quiz.switchLevel(2);
    let state = quiz.beginRound();

    for (let step = 0; step < 3; step += 1) {
      assert.equal(state.questionFormat, null);
      assert.ok(
        /^(\?\*\d+=\d+|\d+\*\?=\d+|\d+=\?\*\d+|\d+=\d+\*\?)$/.test(state.prompt),
        state.prompt
      );
      state = answerCorrect(quiz, state);
    }
  });

  it("prioritizes corect_dar_lent over nou when fewer than three performant", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    seedMultiplicationFactRecord(2, 8, { performantaLaConexeFact: "corect_dar_lent" });
    for (let b = 1; b <= 3; b++) {
      seedMultiplicationFactRecord(2, b, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);

    const state = quiz.beginRound();
    assert.ok(promptUsesMulFact(2, 8, state.prompt), state.prompt);
  });

  it("can surface factors beyond 3 when fewer than three performant", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID, deterministic: false });
    for (let b = 1; b <= 10; b++) {
      seedMultiplicationFactRecord(2, b, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);

    let state = quiz.beginRound();
    const seenB = new Set();

    for (let step = 0; step < 80; step += 1) {
      const b = otherFactorFromPrompt(state.prompt, 2);
      if (b != null) seenB.add(b);
      state = answerCorrect(quiz, state);
      if (state.gameComplete || state.levelAdvanced) break;
    }

    assert.ok([...seenB].some((value) => value > 3), `expected b>3 in ${[...seenB]}`);
  });

  it("retries wrong answers before continuing", () => {
    seedLevel2MultiplicationPerformantPool();
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    quiz.switchLevel(2);
    let state = quiz.beginRound();
    const firstPrompt = state.prompt;

    state = answerWrong(quiz, state);
    assert.equal(state.prompt, firstPrompt);

    state = answerCorrect(quiz, state);
    assert.notEqual(state.prompt, firstPrompt);
  });

  it("alternates from M1 into M2 after three conexe answers", () => {
    seedLevel2MultiplicationPerformantPool();
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    quiz.switchLevel(2);
    let state = quiz.beginRound();

    ({ state } = drainPerfectAnswers(quiz, state, 3));

    const m2Prompts = new Set();
    for (let step = 0; step < 3; step += 1) {
      m2Prompts.add(state.prompt);
      state = answerCorrect(quiz, state);
    }

    assert.equal(m2Prompts.size, 3);
  });
});
