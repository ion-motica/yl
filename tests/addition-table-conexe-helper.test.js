import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  setupTestEnv,
  seedFactRecord,
  seedLevel2PerformantPool,
  answerCorrect,
  answerWrong,
  drainPerfectAnswers,
  completeMacroCycle,
  wrongOptionIndex,
} from "./helpers/load-quiz-environment.js";

const QUIZ_ID = "addition-table-conexe-helper";

function promptUsesAddFact(a, b, prompt) {
  const c = a + b;
  return [
    `?+${b}=${c}`,
    `${a}+?=${c}`,
    `${c}=?+${b}`,
    `${c}=${a}+?`,
  ].includes(prompt);
}

function secondAddendFromPrompt(prompt, a = 2) {
  let match = prompt.match(/^(\d+)\+\?=(\d+)$/);
  if (match) return Number(match[2]) - Number(match[1]);
  match = prompt.match(/^\?\+(\d+)=(\d+)$/);
  if (match) return Number(match[1]);
  match = prompt.match(/^(\d+)=\?\+(\d+)$/);
  if (match) return Number(match[2]);
  match = prompt.match(/^(\d+)=(\d+)\+\?$/);
  if (match) return Number(match[2]) - Number(match[1]);
  return null;
}

describe("addition-table-conexe-helper quiz", () => {
  beforeEach(() => {
    setupTestEnv();
  });

  it("registers quiz metadata", () => {
    const meta = globalThis.QuizRegistry.get(QUIZ_ID);
    assert.equal(meta.id, QUIZ_ID);
    assert.equal(meta.title, "Tabla adunarii - intrebari ajutatoare 3+?=5");
  });

  it("starts at level 2 and rejects level 1", () => {
    const quiz = setupTestEnv();
    const message = quiz.switchLevel(1);
    assert.equal(message, "Prea ușor. trecem la nivelul 2");
    assert.equal(quiz.getLevel(), 2);
    assert.equal(quiz.getMinLevel(), 2);
    assert.equal(quiz.getMaxLevel(), 20);
  });

  it("hides progress display", () => {
    const quiz = setupTestEnv();
    const display = quiz.getProgressDisplay();
    assert.equal(display.green.hidden, true);
    assert.equal(display.red.mode, "none");
  });

  it("uses at most three conexe prompts per M1 series", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    const prompts = new Set();
    let state = quiz.beginRound();

    for (let step = 0; step < 3; step += 1) {
      prompts.add(state.prompt);
      state = answerCorrect(quiz, state);
    }

    assert.equal(prompts.size, 3);
    assert.ok(
      [...prompts].every((prompt) =>
        /^(\?\+\d+=\d+|\d+\+\?=\d+|\d+=\?\+\d+|\d+=\d+\+\?)$/.test(prompt)
      )
    );
  });

  it("uses singapore-bond format for bond conexe prompts", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();

    for (let i = 0; i < 20; i++) {
      if (state.questionFormat === "singapore-bond") break;
      state = answerCorrect(quiz, state);
    }

    assert.equal(state.questionFormat, "singapore-bond");
    assert.match(state.prompt, /^3=(\?\+1|\d+\+\?)$/);
    assert.equal(state.bondHistory.length, 0);
  });

  it("builds three near-number options containing the correct answer", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    const state = quiz.beginRound();

    assert.equal(state.options.length, 3);
    assert.ok(state.options.includes(String(state.options[state.correctIndex])));
    assert.equal(state.options[state.correctIndex], state.options.filter((value, index) => index === state.correctIndex)[0]);
  });

  it("retries wrong conexe answers before continuing", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();
    const firstPrompt = state.prompt;

    state = answerWrong(quiz, state);
    assert.equal(state.outcome, "wrong-answer");
    assert.equal(state.prompt, firstPrompt);

    state = answerCorrect(quiz, state);
    assert.equal(state.outcome, "step-correct");
    assert.notEqual(state.prompt, firstPrompt);
  });

  it("grades performant after a perfect fast M1 run", () => {
    const [fact] = seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();

    ({ state } = drainPerfectAnswers(quiz, state, 7));

    const record = globalThis.FactStore.getFact(fact.factId, fact);
    assert.equal(record.performantaLaConexeFact, "performant");
    assert.equal(record.deCateOriAavutPerformantLaConexe, 1);
    assert.equal(record.conexeM1GradedDay, new Date().toISOString().slice(0, 10));
  });

  it("grades slab when only two conexe are correct on first attempt", () => {
    const [fact] = seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();

    state = answerWrong(quiz, state);
    state = answerCorrect(quiz, state);
    ({ state } = drainPerfectAnswers(quiz, state, 7));

    const record = globalThis.FactStore.getFact(fact.factId, fact);
    assert.equal(record.performantaLaConexeFact, "slab");
    assert.equal(record.deCateOriAavutPerformantLaConexe, 0);
  });

  it("grades only once per day for the same fact", () => {
    const [fact] = seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();

    ({ state } = drainPerfectAnswers(quiz, state, 7));
    globalThis.FactStore.saveFact({
      ...globalThis.FactStore.getFact(fact.factId, fact),
      performantaLaConexeFact: "praf",
      deCateOriAavutPerformantLaConexe: 0,
    });

    quiz.switchLevel(2);
    state = quiz.beginRound();
    ({ state } = drainPerfectAnswers(quiz, state, 7));

    const record = globalThis.FactStore.getFact(fact.factId, fact);
    assert.equal(record.performantaLaConexeFact, "praf");
    assert.equal(record.deCateOriAavutPerformantLaConexe, 0);
  });

  it("prioritizes corect_dar_lent over nou when fewer than three performant", () => {
    const quiz = setupTestEnv();
    seedFactRecord(2, 8, { performantaLaConexeFact: "corect_dar_lent" });
    for (let b = 1; b <= 3; b++) {
      seedFactRecord(2, b, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);

    const state = quiz.beginRound();

    assert.ok(promptUsesAddFact(2, 8, state.prompt), state.prompt);
  });

  it("prioritizes slab over praf and nou when fewer than three performant", () => {
    const quiz = setupTestEnv();
    seedFactRecord(2, 7, { performantaLaConexeFact: "slab" });
    seedFactRecord(2, 6, { performantaLaConexeFact: "praf" });
    for (let b = 1; b <= 3; b++) {
      seedFactRecord(2, b, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);

    const state = quiz.beginRound();

    assert.ok(promptUsesAddFact(2, 7, state.prompt), state.prompt);
  });

  it("can surface facts beyond b=3 when fewer than three performant", () => {
    const quiz = setupTestEnv({ deterministic: false });
    for (let b = 1; b <= 10; b++) {
      seedFactRecord(2, b, { performantaLaConexeFact: "nou" });
    }
    quiz.switchLevel(2);
    let state = quiz.beginRound();
    const seenB = new Set();

    for (let step = 0; step < 80; step++) {
      const b = secondAddendFromPrompt(state.prompt, 2);
      if (b != null) seenB.add(b);
      state = answerCorrect(quiz, state);
      if (state.gameComplete || state.levelAdvanced) break;
    }

    assert.ok([...seenB].some((b) => b > 3), `expected b>3 in ${[...seenB]}`);
  });

  it("excludes over-trained facts unless every fact is over-trained", () => {
    for (let b = 1; b <= 10; b++) {
      seedFactRecord(2, b, {
        performantaLaConexeFact: "performant",
        deCateOriAavutPerformantLaConexe: 4,
      });
    }

    const quiz = setupTestEnv();
    quiz.beginRound();

    const seenPrompts = new Set();
    let state = quiz.beginRound();

    for (let step = 0; step < 3; step += 1) {
      seenPrompts.add(state.prompt);
      state = answerCorrect(quiz, state);
    }

    assert.equal(seenPrompts.size, 3);
    assert.ok(
      [...seenPrompts].every((prompt) =>
        /^(\?\+\d+=\d+|\d+\+\?=\d+|\d+=\?\+\d+|\d+=\d+\+\?)$/.test(prompt)
      )
    );
  });

  it("resets fall position after a three-question series ends", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();

    for (let step = 0; step < 2; step += 1) {
      state = answerCorrect(quiz, state);
      assert.notEqual(state.resetFall, true);
    }

    state = answerCorrect(quiz, state);
    assert.equal(state.resetFall, true);
  });

  it("alternates from M1 into M2 after three conexe answers", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();

    ({ state } = drainPerfectAnswers(quiz, state, 3));

    const m2Prompts = new Set();
    for (let step = 0; step < 3; step += 1) {
      m2Prompts.add(state.prompt);
      state = answerCorrect(quiz, state);
    }

    assert.equal(m2Prompts.size, 3);
    assert.ok([...m2Prompts].every((prompt) => /^\?\+[123]=[345]$/.test(prompt)));
  });

  it("runs recovery M1 after a mistake in M2", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();

    ({ state } = drainPerfectAnswers(quiz, state, 3));
    const m2FirstPrompt = state.prompt;

    state = answerWrong(quiz, state);
    assert.equal(state.prompt, m2FirstPrompt);

    ({ state } = drainPerfectAnswers(quiz, state, 2));
    ({ state } = drainPerfectAnswers(quiz, state, 3));

    assert.ok(state.prompt);
    assert.notEqual(state.outcome, "wrong-answer");
  });

  it("does not advance level when a macro block contains a mistake", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    let state = quiz.beginRound();

    ({ state } = drainPerfectAnswers(quiz, state, 3));
    ({ state } = drainPerfectAnswers(quiz, state, 3));
    ({ state } = drainPerfectAnswers(quiz, state, 3));

    state = answerWrong(quiz, state);
    state = answerCorrect(quiz, state);
    state = answerCorrect(quiz, state);

    assert.equal(quiz.getLevel(), 2);
    assert.equal(state.levelAdvanced, undefined);
  });

  it("advances level after four perfect macro blocks", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();

    let state = quiz.beginRound();
    state = completeMacroCycle(quiz, state, 3);

    assert.equal(quiz.getLevel(), 3);
    assert.equal(state.levelAdvanced, true);
    assert.match(state.message, /Nivel 3/);
  });

  it("records attempts in FactStore with quiz id", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    const state = quiz.beginRound();

    answerCorrect(quiz, state, 900);

    const fact = globalThis.FactCatalog.createFact({
      operation: "add",
      promptForm: globalThis.FactCatalog.PROMPT_FORMS.result,
      values: { a: 2, b: 1 },
    });
    const record = globalThis.FactStore.getFact(fact.factId, fact);
    assert.equal(record.totals.attempts, 1);
    assert.equal(record.totals.correct, 1);
    assert.equal(record.dailyStats[0].attempts, 1);
  });

  it("marks timeout as wrong and keeps the same prompt", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    const state = quiz.beginRound();

    const timedOut = quiz.onTimeout({ responseMs: null });
    assert.equal(timedOut.outcome, "timeout");
    assert.equal(timedOut.prompt, state.prompt);
    assert.equal(timedOut.resetFall, true);
  });

  it("never offers the wrong option index as a valid alternate path", () => {
    seedLevel2PerformantPool();
    const quiz = setupTestEnv();
    const state = quiz.beginRound();
    const wrongIndex = wrongOptionIndex(state);

    assert.notEqual(wrongIndex, state.correctIndex);
    const wrong = quiz.onAnswer(wrongIndex, { responseMs: 700 });
    assert.equal(wrong.outcome, "wrong-answer");
  });
});
