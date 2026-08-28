import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAX_QUESTIONS_PER_SERIES = 3;

const CORE_SCRIPTS = [
  "js/utils.js",
  "js/placeholder-raspuns.js",
  "js/schimbare-de-nivel.js",
  "js/fact-catalog.js",
  "js/fact-stats.js",
  "js/fact-store.js",
  "js/progress-display.js",
  "js/quiz-registry.js",
  "js/subquiz/item-generator.js",
  "js/subquiz/subquiz-definition.js",
  "js/subquiz/subquiz-orchestrator.js",
  "js/motor-3-butoane.js",
  "js/conexe-table-quiz/constants.js",
  "js/conexe-table-quiz/engine.js",
  "js/conexe-table-quiz/adapters/addition.js",
  "js/conexe-table-quiz/adapters/division.js",
  "js/conexe-table-quiz/adapters/subtraction.js",
  "js/conexe-table-quiz/adapters/multiplication.js",
  "js/quizzes/addition-table-conexe-helper.js",
  "js/quizzes/division-table-conexe-helper.js",
  "js/quizzes/subtraction-table-conexe-helper.js",
  "js/quizzes/multiplication-table-conexe-helper.js",
];

let scriptsLoaded = false;
let originalShuffle = null;

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

// Seed implicit pentru testele care cer varietate. Orice numar merge; conteaza
// doar sa fie FIX. Daca un test pica dupa schimbarea lui, nu "ghiceste alt
// seed" — inseamna ca testul depindea de o tragere norocoasa si trebuie
// rescris, exact problema pe care seed-ul o face vizibila.
const SEED_IMPLICIT = 20260828;

// Al treilea regim, intre cele doua extreme de mai sus.
//
//   setupDeterministicRandom() -> `Math.random` intoarce mereu 0: ZERO varietate.
//   Math.random nativ          -> varietate, dar HAZARD: acelasi test pica azi si
//                                 trece maine, fara sa se schimbe nimic in cod.
//   setupSeededRandom(seed)    -> varietate REPRODUCTIBILA: aceeasi secventa la
//                                 fiecare rulare, dar nu o valoare constanta.
//
// Al doilea regim a produs un flake real, masurat (~4% din rulari) la
// `tests/multiplication-table-conexe-helper.test.js` — vezi "test instabil" in
// documente de referinta/RAPORT-motor-comun-raspuns.md.
//
// Generatorul e mulberry32: mic, fara dependinte, cu distributie buna — nu ne
// trebuie calitate criptografica, ne trebuie repetabilitate.
export function setupSeededRandom(seed = SEED_IMPLICIT) {
  let stare = seed >>> 0;
  globalThis.Math.random = () => {
    stare = (stare + 0x6d2b79f5) >>> 0;
    let t = stare;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setupTestEnv(options = {}) {
  const quizId = options.quizId ?? "addition-table-conexe-helper";
  loadCoreScripts();

  // Salvat o singura data, INAINTE ca vreun test sa-l inlocuiasca. `Math.random`
  // nu mai e salvat: nu mai exista cale inapoi la hazard, e mereu semanat.
  if (originalShuffle == null) {
    originalShuffle = globalThis.GameUtils.shuffle;
  }

  globalThis.FactStore.resetAll();

  if (options.deterministic !== false) {
    globalThis.GameUtils.shuffle = (items) => [...items];
    setupDeterministicRandom(options.randomValues ?? [0]);
  } else {
    // `deterministic: false` cere VARIETATE (shuffle real), nu HAZARD. De-aia
    // `Math.random` ramane semanat: secventa e variata, dar identica la fiecare
    // rulare, deci un test ori trece mereu, ori pica mereu.
    globalThis.GameUtils.shuffle = originalShuffle;
    setupSeededRandom(options.seed ?? SEED_IMPLICIT);
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
    if (state.gameComplete || state.levelAdvanced || state.serie_terminata) break;
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

export function seedSubtractionFactRecord(minuend, subtrahend, overrides = {}) {
  const fact = globalThis.FactCatalog.createFact({
    operation: "sub",
    promptForm: globalThis.FactCatalog.PROMPT_FORMS.result,
    values: { a: minuend, b: subtrahend },
  });
  const record = {
    ...(globalThis.FactStore.getFact(fact.factId, fact) ?? {}),
    ...overrides,
  };
  globalThis.FactStore.saveFact(record);
  return fact;
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

export function seedMultiplicationFactRecord(a, b, overrides = {}) {
  const fact = globalThis.FactCatalog.createFact({
    operation: "mul",
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

export function seedLevel2MultiplicationPerformantPool() {
  const facts = [];
  for (let b = 1; b <= 3; b++) {
    facts.push(
      seedMultiplicationFactRecord(2, b, {
        performantaLaConexeFact: "performant",
        deCateOriAavutPerformantLaConexe: 0,
      })
    );
  }

  for (let b = 4; b <= 10; b++) {
    seedMultiplicationFactRecord(2, b, {
      performantaLaConexeFact: "nou",
      deCateOriAavutPerformantLaConexe: 4,
    });
  }

  return facts;
}

export function seedLevel2SubtractionPerformantPool() {
  const facts = [];
  for (let difference = 0; difference <= 2; difference += 1) {
    facts.push(
      seedSubtractionFactRecord(2 + difference, 2, {
        performantaLaConexeFact: "performant",
        deCateOriAavutPerformantLaConexe: 0,
      })
    );
  }

  for (let difference = 3; difference <= 10; difference += 1) {
    seedSubtractionFactRecord(2 + difference, 2, {
      performantaLaConexeFact: "nou",
      deCateOriAavutPerformantLaConexe: 4,
    });
  }

  return facts;
}
