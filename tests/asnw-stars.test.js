import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadAsnwStars(storage = {}) {
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
  const asnwCode = readFileSync(join(rootDir, "js/asnw-profile.js"), "utf8");
  const starsCode = readFileSync(join(rootDir, "js/asnw-stars.js"), "utf8");
  new Function("window", layoutCode)(globalThis);
  new Function("window", asnwCode)(globalThis);
  new Function("window", starsCode)(globalThis);
  return globalThis.AsnwStars;
}

beforeEach(() => {
  delete globalThis.LayoutConfig;
  delete globalThis.AsnwProfile;
  delete globalThis.AsnwStars;
});

test("three consecutive correct answers trigger sub-goal and reset", () => {
  const Stars = loadAsnwStars();
  assert.equal(Stars.onAnswer({ correct: true }), false);
  assert.equal(Stars.getLitCount(), 1);
  assert.equal(Stars.onAnswer({ correct: true }), false);
  assert.equal(Stars.getLitCount(), 2);
  assert.equal(Stars.onAnswer({ correct: true }), true);
  assert.equal(Stars.getLitCount(), 0);
});

test("wrong answer extinguishes last lit star", () => {
  const Stars = loadAsnwStars();
  Stars.onAnswer({ correct: true });
  Stars.onAnswer({ correct: true });
  assert.equal(Stars.getLitCount(), 2);
  Stars.onAnswer({ correct: false });
  assert.equal(Stars.getLitCount(), 1);
});

test("inactive when ASNW stars flag off", () => {
  const Stars = loadAsnwStars({
    "yl.layout.v1": JSON.stringify({
      asnwProfileOn: false,
      asnwStarsProgress: true,
    }),
  });
  assert.equal(Stars.isActive(), false);
  assert.equal(Stars.onAnswer({ correct: true }), false);
});
