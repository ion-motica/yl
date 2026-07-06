import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadStartupQuiz(storage = {}, quizzes = [], locationSearch = "") {
  globalThis.window = globalThis;
  globalThis.location = { search: locationSearch };
  globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
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
  delete globalThis.location;
  delete globalThis.atob;
});

test("resolveStartupQuizId uses quiz from URL when it exists", () => {
  const Startup = loadStartupQuiz(
    {
      "yl.layout.v1": JSON.stringify({ startupQuizId: "addition-table" }),
    },
    [
      { id: "addition-table-range", title: "Range" },
      { id: "addition-table", title: "Clasic" },
      { id: "equations-e3-e6", title: "Ecuatii" },
    ],
    "?quiz=equations-e3-e6"
  );
  assert.equal(Startup.getRequestedQuizId(), "equations-e3-e6");
  assert.equal(Startup.resolveStartupQuizId(), "equations-e3-e6");
});

test("resolveStartupQuizId ignores missing quiz from URL", () => {
  const Startup = loadStartupQuiz(
    {
      "yl.layout.v1": JSON.stringify({ startupQuizId: "addition-table" }),
    },
    [
      { id: "addition-table-range", title: "Range" },
      { id: "addition-table", title: "Clasic" },
    ],
    "?quiz=deleted-quiz"
  );
  assert.equal(Startup.getRequestedQuizId(), "deleted-quiz");
  assert.equal(Startup.resolveStartupQuizId(), "addition-table");
});

test("getRequestedQuizConfig reads JSON config from URL", () => {
  const Startup = loadStartupQuiz(
    {},
    [{ id: "equations-e3-e6", title: "Ecuatii" }],
    `?quiz=equations-e3-e6&cfg=${encodeURIComponent('{"familyId":"E5_BAL","operators":["*"]}')}`
  );

  assert.deepEqual(Startup.getRequestedQuizConfig(), {
    familyId: "E5_BAL",
    operators: ["*"],
  });
});

test("getRequestedQuizConfig tolerates cfg without equals", () => {
  const Startup = loadStartupQuiz(
    {},
    [{ id: "equations-e3-e6", title: "Ecuatii" }],
    `?quiz=equations-e3-e6&cfg%20${encodeURIComponent('{"familyId":"E5_BAL","operators":["*","+"]}')}`
  );

  assert.deepEqual(Startup.getRequestedQuizConfig(), {
    familyId: "E5_BAL",
    operators: ["*", "+"],
  });
});

test("getRequestedQuizConfig reads base64url config from URL", () => {
  const raw = '{"familyId":"E4","questionsPerRun":12}';
  const encoded = Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const Startup = loadStartupQuiz(
    {},
    [{ id: "equations-e3-e6", title: "Ecuatii" }],
    `?quiz=equations-e3-e6&cfg=${encoded}`
  );

  assert.deepEqual(Startup.getRequestedQuizConfig(), {
    familyId: "E4",
    questionsPerRun: 12,
  });
});

test("getRequestedQuizConfig ignores invalid config", () => {
  const Startup = loadStartupQuiz(
    {},
    [{ id: "equations-e3-e6", title: "Ecuatii" }],
    "?quiz=equations-e3-e6&cfg=not-json"
  );

  assert.equal(Startup.getRequestedQuizConfig(), null);
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
