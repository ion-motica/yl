import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAX_QUESTIONS_PER_SERIES = 3;

const CORE_SCRIPTS = [
  "js/utils.js",
  "js/fact-catalog.js",
  "js/fact-stats.js",
  "js/fact-store.js",
  "js/progress-display.js",
  "js/quiz-registry.js",
  "js/conexe-table-quiz/constants.js",
  "js/conexe-table-quiz/engine.js",
  "js/conexe-table-quiz/adapters/addition.js",
  "js/conexe-table-quiz/adapters/division.js",
  "js/quizzes/addition-table-conexe-helper.js",
  "js/quizzes/division-table-conexe-helper.js",
];

let scriptsLoaded = false;
let originalShuffle = null;
let originalRandom = null;

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  const runner = new Function("window", `${code}\n`);
  runner(globalThis);
}

export function loadCoreScripts() {
  if (scriptsLoaded) return;
  globalThis.window = globalThis;
  for (const script of CORE_SCRIPTS) {
    loadScript(script);
  }
  scriptsLoaded = true;
}

export function setupDeterministicRandom(values = [0]) {
  let index = 0;
  globalThis.Math.random = () => values[index++ % values.length] ?? 0;
}

export function setupTestEnv(options = {}) {
  const quizId = options.quizId ?? "addition-table-conexe-helper";
  loadCoreScripts();

  if (originalShuffle == null) {
    originalShuffle = globalThis.GameUtils.shuffle;
    originalRandom = globalThis.Math.random;
  }

  globalThis.FactStore.resetAll();

  if (options.deterministic !== false) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    setupDeterministicRandom(options.randomValues ?? [0]);
  } else {
    globalThis.GameUtils.shuffle = originalShuffle;
    globalThis.Math.random = originalRandom;
  }

  const meta = globalThis.QuizRegistry.get(quizId);
  if (!meta) {
    throw new Error(`Quiz ${quizId} is not registered`);
  }

  return meta.create();
}

export function seedFactRecord(a, b, overrides = {}) {
  const fact = globalThis.FactCatalog.createFact({
    operation: "add",
    promptForm: globalThis.FactCatalog.PROMPT_FORMS.result,
    values: { a, b },
  });
  const record = {
    ...(globalThis.FactStore.getFact(fact.factId, fact) ?? {}),
    ...overrides,
  };
  globalThis.FactStore.saveFact(record);
  return fact;
}

export function seedDivisionFactRecord(dividend, divisor, overrides = {}) {
  const fact = globalThis.FactCatalog.createFact({
    operation: "div",
    promptForm: globalThis.FactCatalog.PROMPT_FORMS.result,
    values: { a: dividend, b: divisor },
  });
  const record = {
    ...(globalThis.FactStore.getFact(fact.factId, fact) ?? {}),
    ...overrides,
  };
  globalThis.FactStore.saveFact(record);
  return fact;
}

export function wrongOptionIndex(state) {
  return (state.correctIndex + 1) % state.options.length;
}

export function answerCorrect(quiz, state, responseMs = 800) {
  return quiz.onAnswer(state.correctIndex, { responseMs });
}

export function answerWrong(quiz, state, responseMs = 800) {
  return quiz.onAnswer(wrongOptionIndex(state), { responseMs });
}

export function drainPerfectAnswers(quiz, startState, maxSteps = 200) {
  let state = startState;
  let steps = 0;

  while (steps < maxSteps) {
    if (state.gameComplete || state.levelAdvanced || state.runComplete) break;
    if (state.correctIndex == null) break;
    state = answerCorrect(quiz, state);
    steps += 1;
  }

  return { state, steps };
}

export function completeMacroCycle(quiz, startState, poolSize = 3) {
  let state = startState;
  const seriesSize = Math.min(MAX_QUESTIONS_PER_SERIES, poolSize);

  ({ state } = drainPerfectAnswers(quiz, state, seriesSize));
  ({ state } = drainPerfectAnswers(quiz, state, seriesSize));
  ({ state } = drainPerfectAnswers(quiz, state, seriesSize));
  ({ state } = drainPerfectAnswers(quiz, state, seriesSize));

  return state;
}

export function seedLevel2PerformantPool() {
  const facts = [];
  for (let b = 1; b <= 3; b++) {
    facts.push(
      seedFactRecord(2, b, {
        performantaLaConexeFact: "performant",
        deCateOriAavutPerformantLaConexe: 0,
      })
    );
  }

  for (let b = 4; b <= 10; b++) {
    seedFactRecord(2, b, {
      performantaLaConexeFact: "nou",
      deCateOriAavutPerformantLaConexe: 4,
    });
  }

  return facts;
}

export function seedLevel2DivisionPerformantPool() {
  const facts = [];
  for (let quotient = 1; quotient <= 3; quotient += 1) {
    facts.push(
      seedDivisionFactRecord(2 * quotient, 2, {
        performantaLaConexeFact: "performant",
        deCateOriAavutPerformantLaConexe: 0,
      })
    );
  }

  for (let quotient = 4; quotient <= 10; quotient += 1) {
    seedDivisionFactRecord(2 * quotient, 2, {
      performantaLaConexeFact: "nou",
      deCateOriAavutPerformantLaConexe: 4,
    });
  }

  return facts;
}
