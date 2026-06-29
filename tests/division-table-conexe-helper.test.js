import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  setupTestEnv,
  seedDivisionFactRecord,
  seedLevel2DivisionPerformantPool,
  answerCorrect,
  answerWrong,
  drainPerfectAnswers,
} from "./helpers/load-quiz-environment.js";

const QUIZ_ID = "division-table-conexe-helper";

function promptUsesDivFact(dividend, divisor, prompt) {
  const quotient = dividend / divisor;
  return [
    `?:${divisor}=${quotient}`,
    `${dividend}:?=${quotient}`,
    `${quotient}=?:${divisor}`,
    `${quotient}=${dividend}:?`,
  ].includes(prompt);
}

function quotientFromPrompt(prompt) {
  let match = prompt.match(/^(\d+):\?=(\d+)$/);
  if (match) return Number(match[2]);
  match = prompt.match(/^\?:(\d+)=(\d+)$/);
  if (match) return Number(match[2]);
  match = prompt.match(/^(\d+)=\?:(\d+)$/);
  if (match) return Number(match[1]);
  match = prompt.match(/^(\d+)=(\d+):\?$/);
  if (match) return Number(match[1]);
  return null;
}

describe("division-table-conexe-helper quiz", () => {
  beforeEach(() => {
    setupTestEnv({ quizId: QUIZ_ID });
  });

  it("registers quiz metadata", () => {
    const meta = globalThis.QuizRegistry.get(QUIZ_ID);
    assert.equal(meta.id, QUIZ_ID);
    assert.equal(meta.title, "Tabla impartirii - intrebari ajutatoare 15:?=3");
  });

  it("starts at level 2 and rejects level 1", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    const message = quiz.switchLevel(1);
    assert.equal(message, "Prea ușor. trecem la nivelul 2");
    assert.equal(quiz.getLevel(), 2);
  });

  it("uses colon conexe prompts without bond UI", () => {
    seedLevel2DivisionPerformantPool();
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    let state = quiz.beginRound();

    for (let step = 0; step < 3; step += 1) {
      assert.equal(state.questionFormat, null);
      assert.ok(
        /^(\?:\d+=\d+|\d+:\?=\d+|\d+=\?:\d+|\d+=\d+:\?)$/.test(state.prompt),
        state.prompt
      );
      state = answerCorrect(quiz, state);
    }
  });

  it("lists level 2 facts as divisor 2 with quotients 1..20", () => {
    const facts = globalThis.ConexeTableQuizDivisionAdapter.listLevelFacts(2);
    assert.equal(facts.length, 20);
    assert.deepEqual(
      facts.map((fact) => fact.values.result).sort((left, right) => left - right),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    );
    assert.ok(facts.every((fact) => fact.values.b === 2));
    assert.ok(facts.every((fact) => fact.values.a === fact.values.b * fact.values.result));
  });

  it("prioritizes corect_dar_lent over nou when fewer than three performant", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    seedDivisionFactRecord(16, 2, { performantaLaConexeFact: "corect_dar_lent" });
    for (let quotient = 1; quotient <= 3; quotient += 1) {
      seedDivisionFactRecord(2 * quotient, 2, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);

    const state = quiz.beginRound();
    assert.ok(promptUsesDivFact(16, 2, state.prompt), state.prompt);
  });

  it("can surface quotients beyond 3 when fewer than three performant", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID, deterministic: false });
    for (let quotient = 1; quotient <= 10; quotient += 1) {
      seedDivisionFactRecord(2 * quotient, 2, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);

    let state = quiz.beginRound();
    const seenQuotients = new Set();

    for (let step = 0; step < 80; step += 1) {
      const quotient = quotientFromPrompt(state.prompt);
      if (quotient != null) seenQuotients.add(quotient);
      state = answerCorrect(quiz, state);
      if (state.gameComplete || state.levelAdvanced) break;
    }

    assert.ok([...seenQuotients].some((q) => q > 3), `expected quotient>3 in ${[...seenQuotients]}`);
  });

  it("builds dividend wrong options within quotient window", () => {
    const fact = globalThis.FactCatalog.createFact({
      operation: "div",
      promptForm: globalThis.FactCatalog.PROMPT_FORMS.result,
      values: { a: 15, b: 5, result: 3 },
    });
    const { options, correctIndex } = globalThis.ConexeTableQuizDivisionAdapter.buildOptions(
      fact,
      "missing-left",
      (items) => [...items]
    );

    assert.equal(options[correctIndex], "15");
    assert.equal(options.length, 3);
    for (const option of options) {
      const value = Number(option);
      assert.ok(value >= 12 && value <= 18, option);
    }
  });

  it("retries wrong answers before continuing", () => {
    seedLevel2DivisionPerformantPool();
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    let state = quiz.beginRound();
    const firstPrompt = state.prompt;

    state = answerWrong(quiz, state);
    assert.equal(state.prompt, firstPrompt);

    state = answerCorrect(quiz, state);
    assert.notEqual(state.prompt, firstPrompt);
  });

  it("records attempts in FactStore for division facts", () => {
    seedLevel2DivisionPerformantPool();
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    const state = quiz.beginRound();

    answerCorrect(quiz, state, 900);

    const fact = globalThis.FactCatalog.createFact({
      operation: "div",
      promptForm: globalThis.FactCatalog.PROMPT_FORMS.result,
      values: { a: 2, b: 2, result: 1 },
    });
    const record = globalThis.FactStore.getFact(fact.factId, fact);
    assert.equal(record.totals.attempts, 1);
    assert.equal(record.totals.correct, 1);
  });

  it("alternates from M1 into M2 after three conexe answers", () => {
    seedLevel2DivisionPerformantPool();
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    let state = quiz.beginRound();

    ({ state } = drainPerfectAnswers(quiz, state, 3));

    const m2Prompts = new Set();
    for (let step = 0; step < 3; step += 1) {
      m2Prompts.add(state.prompt);
      state = answerCorrect(quiz, state);
    }

    assert.equal(m2Prompts.size, 3);
    assert.ok([...m2Prompts].every((prompt) => /^(\?:2=|2:\?=|2=|:2)/.test(prompt) || /:2/.test(prompt)));
  });
});
