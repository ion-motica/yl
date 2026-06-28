import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadStartupQuiz(storage = {}, quizzes = []) {
  globalThis.window = globalThis;
  globalThis.localStorage = {
    _data: { ...storage },
    getItem(k) {
      return k in this._data ? this._data[k] : null;
    },
    setItem(k, v) {
      this._data[k] = v;
    },
  };
  const layoutCode = readFileSync(join(rootDir, "js/layout-config.js"), "utf8");
  const startupCode = readFileSync(join(rootDir, "js/startup-quiz.js"), "utf8");
  new Function("window", layoutCode)(globalThis);
  globalThis.QuizRegistry = {
    list: () => quizzes,
    get: (id) => quizzes.find((q) => q.id === id) ?? null,
    getDefaultId: () => quizzes[0]?.id ?? null,
  };
  new Function("window", startupCode)(globalThis);
  return globalThis.StartupQuiz;
}

beforeEach(() => {
  delete globalThis.LayoutConfig;
  delete globalThis.StartupQuiz;
  delete globalThis.QuizRegistry;
});

test("resolveStartupQuizId uses stored quiz", () => {
  const Startup = loadStartupQuiz(
    {
      "yl.layout.v1": JSON.stringify({ startupQuizId: "addition-table" }),
    },
    [
      { id: "addition-table-range", title: "Range" },
      { id: "addition-table", title: "Clasic" },
    ]
  );
  assert.equal(Startup.resolveStartupQuizId(), "addition-table");
});

test("resolveStartupQuizId falls back to addition-table-range", () => {
  const Startup = loadStartupQuiz({}, [{ id: "addition-table-range", title: "Range" }]);
  assert.equal(Startup.getStoredQuizId(), "addition-table-range");
  assert.equal(Startup.resolveStartupQuizId(), "addition-table-range");
});

test("setStoredQuizId persists choice", () => {
  const Startup = loadStartupQuiz({}, [{ id: "addition-eff", title: "EFF" }]);
  Startup.setStoredQuizId("addition-eff");
  assert.equal(Startup.getStoredQuizId(), "addition-eff");
});
