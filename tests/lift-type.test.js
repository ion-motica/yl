import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadLiftType(storage = {}) {
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
  const liftTypeCode = readFileSync(join(rootDir, "js/lift-type.js"), "utf8");
  new Function("window", layoutCode)(globalThis);
  new Function("window", liftTypeCode)(globalThis);
  return globalThis.LiftType;
}

beforeEach(() => {
  delete globalThis.LayoutConfig;
  delete globalThis.LiftType;
});

test("default lift type is question-in-lift", () => {
  const LiftType = loadLiftType();
  assert.equal(LiftType.getStoredLiftTypeId(), "question-in-lift");
  assert.equal(LiftType.getEffectiveLiftTypeId(), "question-in-lift");
});

test("implemented bar type is selectable and maps to bar mode", () => {
  const LiftType = loadLiftType();
  LiftType.setStoredLiftTypeId("fixed-question-bar");
  assert.equal(LiftType.getStoredLiftTypeId(), "fixed-question-bar");
  assert.equal(LiftType.getEffectiveLiftTypeId(), "fixed-question-bar");
  assert.equal(LiftType.getEffectiveLiftMode(), "bar");
  assert.equal(LiftType.isImplemented("fixed-question-bar"), true);
});

test("unimplemented type falls back to effective default", () => {
  const LiftType = loadLiftType();
  LiftType.setStoredLiftTypeId("fixed-question-ball");
  assert.equal(LiftType.getStoredLiftTypeId(), "fixed-question-ball");
  assert.equal(LiftType.getEffectiveLiftTypeId(), "question-in-lift");
  assert.equal(LiftType.getEffectiveLiftMode(), "content");
  assert.equal(LiftType.isImplemented("fixed-question-ball"), false);
});

test("three exclusive lift type options defined", () => {
  const LiftType = loadLiftType();
  assert.equal(LiftType.LIFT_TYPES.length, 3);
});
