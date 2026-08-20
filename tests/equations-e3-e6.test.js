import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";

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
  loadScript("js/subquiz/item-generator.js");
  loadScript("js/subquiz/subquiz-definition.js");
  loadScript("js/subquiz/subquiz-orchestrator.js");
  loadScript("js/motor-3-butoane.js");
  loadScript("js/quizzes/equations-e3-e6.js");
}

function decodeBase64Url(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

beforeEach(() => {
  delete globalThis.GameUtils;
  delete globalThis.ProgressDisplay;
  delete globalThis.QuizRegistry;
  delete globalThis.EquationTonomatQuiz;
  delete globalThis.Motor3Butoane;
  delete globalThis.ItemGenerator;
  delete globalThis.SubquizDefinition;
  delete globalThis.SubquizOrchestrator;
});

test("registers the new quiz with the exact requested title", () => {
  loadQuiz();

  const meta = globalThis.QuizRegistry.get("equations-e3-e6");

  assert.equal(meta.title, "Ecuatii cu 3 4 5 6 numere");
  assert.equal(typeof meta.create, "function");
});

test("uses plus signs in family labels shown by the control panel", () => {
  loadQuiz();

  const labels = Object.values(globalThis.EquationTonomatQuiz.FAMILY_DEFS).map(
    (def) => def.label
  );

  assert.ok(labels.every((label) => label.includes("+")), labels.join(" | "));
  assert.ok(labels.every((label) => !/\ss\s/.test(label)), labels.join(" | "));
});

test("builds valid same-sign questions for each stage 1 family and operator", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const quizApi = globalThis.EquationTonomatQuiz;
  const familyIds = Object.keys(quizApi.FAMILY_DEFS);

  for (const familyId of familyIds) {
    const slots = [
      ...quizApi.FAMILY_DEFS[familyId].left,
      ...quizApi.FAMILY_DEFS[familyId].right,
    ];

    for (const operator of quizApi.OPS) {
      for (let unknownIndex = 0; unknownIndex < slots.length; unknownIndex += 1) {
        const question = quizApi.buildQuestion(
          { familyId, operators: [operator] },
          { level: 2, operator, unknownIndex }
        );

        assert.equal(question.unknownSlot, slots[unknownIndex]);
        assert.ok(question.prompt.includes("?"), question.prompt);
        assert.ok(quizApi.validateQuestion(question), `${familyId} ${operator} ${question.prompt}`);
        assert.equal(Number(question.options[question.correctIndex]), question.correct);
      }
    }
  }
});

test("cycles the missing number through all numeric slots", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const quiz = globalThis.QuizRegistry.get("equations-e3-e6").create();
  quiz.setTonomatConfig({ familyId: "E4", operators: ["*"] });

  const seen = [];
  let state = quiz.beginRound();
  for (let i = 0; i < 4; i += 1) {
    const logBefore = quiz.getAttemptLog().length;
    state = quiz.onAnswer(state.correctIndex);
    const logEntry = quiz.getAttemptLog()[logBefore];
    seen.push(logEntry.unknownSlot);
    if (state.nextRound) state = state.nextRound;
  }

  assert.deepEqual(seen, ["a", "b", "c", "d"]);
});

test("avoids visible common known numbers on both sides", () => {
  loadQuiz();

  const quizApi = globalThis.EquationTonomatQuiz;
  const familyIds = Object.keys(quizApi.FAMILY_DEFS);

  for (const familyId of familyIds) {
    const slots = [
      ...quizApi.FAMILY_DEFS[familyId].left,
      ...quizApi.FAMILY_DEFS[familyId].right,
    ];

    for (const operator of quizApi.OPS) {
      for (let unknownIndex = 0; unknownIndex < slots.length; unknownIndex += 1) {
        const question = quizApi.buildQuestion(
          { familyId, operators: [operator] },
          { level: 3, operator, unknownIndex }
        );
        if (Math.min(question.leftSlots.length, question.rightSlots.length) > 2) continue;
        const leftKnown = new Set(
          question.leftSlots
            .filter((slot) => slot !== question.unknownSlot)
            .map((slot) => question.values[slot])
        );
        const common = question.rightSlots
          .filter((slot) => slot !== question.unknownSlot)
          .filter((slot) => leftKnown.has(question.values[slot]));

        assert.deepEqual(common, [], question.prompt);
      }
    }
  }
});

test("shows unequal families in both orientations, including two-vs-three", () => {
  loadQuiz();

  const quizApi = globalThis.EquationTonomatQuiz;
  const e4 = [0, 1, 2, 3].map((unknownIndex) =>
    quizApi.buildQuestion(
      { familyId: "E4", operators: ["+"] },
      { operator: "+", unknownIndex }
    )
  );
  const e5Balanced = [0, 1, 2, 3, 4].map((unknownIndex) =>
    quizApi.buildQuestion(
      { familyId: "E5_BAL", operators: ["+"] },
      { operator: "+", unknownIndex }
    )
  );

  assert.deepEqual(
    [...new Set(e4.map((question) => question.leftSlots.length))].sort(),
    [1, 3]
  );
  assert.deepEqual(
    [...new Set(e5Balanced.map((question) => question.leftSlots.length))].sort(),
    [2, 3]
  );
  assert.ok(e5Balanced.some((question) => question.flipped), "expected 2-vs-3 flipped prompt");
});

test("uses checked signs as the pool for mixed-sign questions", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items].reverse();

  const quizApi = globalThis.EquationTonomatQuiz;
  const twoSigns = quizApi.buildQuestion(
    { familyId: "E4_BAL", operators: ["+", "-"] },
    { level: 2, unknownIndex: 0 }
  );
  const fourSigns = quizApi.buildQuestion(
    { familyId: "E5", operators: ["+", "-", "*", "/"] },
    { level: 2, unknownIndex: 0 }
  );

  assert.deepEqual([...twoSigns.operators].sort(), ["+", "-"]);
  assert.equal(fourSigns.operators.length, 3);
  assert.ok(fourSigns.operators.every((op) => ["+", "-", "*", "/"].includes(op)));
  assert.ok(quizApi.validateQuestion(twoSigns), twoSigns.prompt);
  assert.ok(quizApi.validateQuestion(fourSigns), fourSigns.prompt);
});

test("records the minimum attempt metadata", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const quiz = globalThis.QuizRegistry.get("equations-e3-e6").create();
  quiz.setTonomatConfig({ familyId: "E5_BAL", operators: ["/"] });
  const state = quiz.beginRound();
  const wrongIndex = state.options.findIndex((_, index) => index !== state.correctIndex);

  quiz.onAnswer(wrongIndex, { responseMs: 321, at: "2026-07-06T00:00:00.000Z" });
  const [entry] = quiz.getAttemptLog();

  assert.equal(entry.family, "E5_BAL");
  assert.deepEqual(entry.operators, ["/", "/", "/"]);
  assert.equal(typeof entry.unknownSlot, "string");
  assert.equal(Number.isInteger(entry.correctAnswer), true);
  assert.equal(entry.userAnswer, Number(state.options[wrongIndex]));
  assert.equal(entry.correct, false);
  assert.equal(entry.responseMs, 321);
});

test("exports and applies shared config best-effort", () => {
  loadQuiz();

  const quiz = globalThis.QuizRegistry.get("equations-e3-e6").create();
  assert.equal(
    quiz.applySharedConfig({
      v: 1,
      familyId: "E5_BAL",
      operators: ["*", "nope", "/"],
      signMode: "future-mode",
      showSummaryInArena: false,
      questionsPerRun: 999,
      removedSetting: "ignored",
    }),
    true
  );

  assert.deepEqual(quiz.getSharedConfig(), {
    v: 1,
    familyId: "E5_BAL",
    operators: ["*", "/"],
    signMode: "same",
    showSummaryInArena: false,
    questionsPerRun: 50,
  });
});

test("builds a shareable URL with quiz id and current config", () => {
  loadQuiz();

  const quiz = globalThis.QuizRegistry.get("equations-e3-e6").create();
  quiz.setTonomatConfig({
    familyId: "E5_BAL",
    operators: ["*", "/"],
    showSummaryInArena: false,
    questionsPerRun: 12,
  });

  const link = quiz.getSharedLink("https://example.github.io/yl/index.html?old=1#section");
  const url = new URL(link);
  const encodedConfig = url.searchParams.get("cfg");

  assert.equal(url.href.startsWith("https://example.github.io/yl/index.html?"), true);
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.get("quiz"), "equations-e3-e6");
  assert.ok(encodedConfig);
  assert.deepEqual(JSON.parse(decodeBase64Url(encodedConfig)), quiz.getSharedConfig());
});

test("shared config falls back to defaults when values no longer apply", () => {
  loadQuiz();

  const quiz = globalThis.QuizRegistry.get("equations-e3-e6").create();
  quiz.applySharedConfig({
    familyId: "deleted-family",
    operators: ["deleted-op"],
    questionsPerRun: "not a number",
  });

  assert.deepEqual(quiz.getSharedConfig(), {
    v: 1,
    familyId: "E3",
    operators: ["+"],
    signMode: "same",
    showSummaryInArena: true,
    questionsPerRun: 20,
  });
});

// Regresie pt. bug-ul #2 din "Bug-uri gasite, NEreparate" (documente de
// referinta/RAPORT-motor-comun-raspuns.md): un `next` TRUNCHIAT (forma exacta
// a lui roundView() — fara campul `.correct`) nu mai trebuie sa corupa
// grading-ul viitor. Nu se declanseaza in aplicatia reala azi (falling-engine.js
// nu retrimite niciodata `nextRound` in `beginRound`), dar `beginRound` insusi
// trebuie sa ramana sigur daca vreodata un apelant nou ar face-o.
test("beginRound cu un obiect trunchiat (fara .correct) nu corupe grading-ul — cade pe o intrebare noua", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const quiz = globalThis.QuizRegistry.get("equations-e3-e6").create();
  const state = quiz.beginRound();
  assert.equal(typeof state.correctIndex, "number");

  const truncated = {
    prompt: state.prompt,
    promptHtml: state.promptHtml,
    options: state.options,
    correctIndex: state.correctIndex,
    hintMessage: state.hintMessage,
  };
  assert.equal(truncated.correct, undefined, "roundView() nu are campul .correct — premisa testului");

  const afterTruncated = quiz.beginRound(truncated);
  const answered = quiz.onAnswer(afterTruncated.correctIndex);

  assert.notEqual(
    answered.outcome,
    "wrong-answer",
    "raspunsul pe indexul corect al intrebarii NOI (dupa cadere pe pickNewQuestion) trebuie acceptat ca fiind corect"
  );
});

test("beginRound cu un obiect complet (cu .correct numeric) functioneaza normal, neschimbat", () => {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];

  const quiz = globalThis.QuizRegistry.get("equations-e3-e6").create();
  quiz.beginRound();
  const next = quiz.pickNextRound();
  assert.equal(typeof next.correct, "number", "pickNextRound produce un obiect complet, cu .correct");

  const state = quiz.beginRound(next);
  assert.equal(state.prompt, next.prompt, "beginRound(next) valid foloseste exact obiectul primit, neschimbat");

  const answered = quiz.onAnswer(state.correctIndex);
  assert.notEqual(answered.outcome, "wrong-answer");
});
