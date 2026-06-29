import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  setupTestEnv,
  seedSubtractionFactRecord,
  seedLevel2SubtractionPerformantPool,
  answerCorrect,
  answerWrong,
  drainPerfectAnswers,
} from "./helpers/load-quiz-environment.js";

const QUIZ_ID = "subtraction-table-conexe-helper";

function promptUsesSubFact(minuend, subtrahend, prompt) {
  const difference = minuend - subtrahend;
  return [
    `?-${subtrahend}=${difference}`,
    `${minuend}-?=${difference}`,
    `${difference}=?-${subtrahend}`,
    `${difference}=${minuend}-?`,
  ].includes(prompt);
}

function differenceFromPrompt(prompt) {
  let match = prompt.match(/^(\d+)-\?=(\d+)$/);
  if (match) return Number(match[2]);
  match = prompt.match(/^\?-(\d+)=(\d+)$/);
  if (match) return Number(match[2]);
  match = prompt.match(/^(\d+)=\?-(\d+)$/);
  if (match) return Number(match[1]);
  match = prompt.match(/^(\d+)=(\d+)-\?$/);
  if (match) return Number(match[1]);
  return null;
}

describe("subtraction-table-conexe-helper quiz", () => {
  beforeEach(() => {
    setupTestEnv({ quizId: QUIZ_ID });
  });

  it("registers quiz metadata", () => {
    const meta = globalThis.QuizRegistry.get(QUIZ_ID);
    assert.equal(meta.id, QUIZ_ID);
    assert.equal(meta.title, "Tabla scaderii - intrebari ajutatoare 5-?=3");
  });

  it("starts at level 1 and rejects level 0", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    assert.equal(quiz.getLevel(), 1);
    assert.equal(quiz.getMinLevel(), 1);
    assert.equal(quiz.getMaxLevel(), 20);

    const message = quiz.switchLevel(0);
    assert.equal(message, "Prea ușor. trecem la nivelul 1");
    assert.equal(quiz.getLevel(), 1);
  });

  it("lists level 2 facts as subtrahend 2 with differences 0..20", () => {
    const facts = globalThis.ConexeTableQuizSubtractionAdapter.listLevelFacts(2);
    assert.equal(facts.length, 21);
    assert.deepEqual(
      facts.map((fact) => fact.values.result).sort((left, right) => left - right),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    );
    assert.ok(facts.every((fact) => fact.values.b === 2));
    assert.ok(facts.every((fact) => fact.values.a === fact.values.b + fact.values.result));
    assert.ok(promptUsesSubFact(2, 2, "2-?=0"));
    assert.ok(promptUsesSubFact(12, 2, "12-?=10"));
  });

  it("uses minus conexe prompts without bond UI", () => {
    seedLevel2SubtractionPerformantPool();
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    quiz.switchLevel(2);
    let state = quiz.beginRound();

    for (let step = 0; step < 3; step += 1) {
      assert.equal(state.questionFormat, null);
      assert.ok(
        /^(\?-\d+=\d+|\d+-\?=\d+|\d+=\?-\d+|\d+=\d+-\?)$/.test(state.prompt),
        state.prompt
      );
      state = answerCorrect(quiz, state);
    }
  });

  it("prioritizes corect_dar_lent over nou when fewer than three performant", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID });
    seedSubtractionFactRecord(12, 2, { performantaLaConexeFact: "corect_dar_lent" });
    for (let difference = 0; difference <= 2; difference += 1) {
      seedSubtractionFactRecord(2 + difference, 2, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);

    const state = quiz.beginRound();
    assert.ok(promptUsesSubFact(12, 2, state.prompt), state.prompt);
  });

  it("can surface differences beyond 3 when fewer than three performant", () => {
    const quiz = setupTestEnv({ quizId: QUIZ_ID, deterministic: false });
    for (let difference = 0; difference <= 10; difference += 1) {
      seedSubtractionFactRecord(2 + difference, 2, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);

    let state = quiz.beginRound();
    const seenDifferences = new Set();

    for (let step = 0; step < 80; step += 1) {
      const difference = differenceFromPrompt(state.prompt);
      if (difference != null) seenDifferences.add(difference);
      state = answerCorrect(quiz, state);
      if (state.gameComplete || state.levelAdvanced) break;
    }

    assert.ok(
      [...seenDifferences].some((value) => value > 3),
      `expected difference>3 in ${[...seenDifferences]}`
    );
  });

  it("builds minuend wrong options within difference window", () => {
    const fact = globalThis.FactCatalog.createFact({
      operation: "sub",
      promptForm: globalThis.FactCatalog.PROMPT_FORMS.result,
      values: { a: 5, b: 2, result: 3 },
    });
    const { options, correctIndex } = globalThis.ConexeTableQuizSubtractionAdapter.buildOptions(
      fact,
      "missing-left",
      (items) => [...items]
    );

    assert.equal(options[correctIndex], "5");
    assert.equal(options.length, 3);
    for (const option of options) {
      const value = Number(option);
      assert.ok(value >= 2 && value <= 8, option);
    }
  });

  it("retries wrong answers before continuing", () => {
    seedLevel2SubtractionPerformantPool();
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
    seedLevel2SubtractionPerformantPool();
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
