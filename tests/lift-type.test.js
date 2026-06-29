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
  delete globalThis.AsnwProfile;
});

test("default lift type is question-in-lift", () => {
  const LiftType = loadLiftType();
  assert.equal(LiftType.getStoredLiftTypeId(), "question-in-lift");
  assert.equal(LiftType.getEffectiveLiftTypeId(), "question-in-lift");
});

test("ASNW liftFixedQuestionBar overrides effective lift type to bar", () => {
  loadLiftType();
  const asnwCode = readFileSync(join(rootDir, "js/asnw-profile.js"), "utf8");
  new Function("window", asnwCode)(globalThis);
  assert.equal(globalThis.LiftType.getEffectiveLiftTypeId(), "fixed-question-bar");
  assert.equal(globalThis.LiftType.getEffectiveLiftMode(), "bar");
  globalThis.AsnwProfile.setMasterOn(false);
  assert.equal(globalThis.LiftType.getEffectiveLiftTypeId(), "question-in-lift");
});

test("implemented bar type is selectable and maps to bar mode", () => {
  const LiftType = loadLiftType();
  LiftType.setStoredLiftTypeId("fixed-question-bar");
  assert.equal(LiftType.getStoredLiftTypeId(), "fixed-question-bar");
  assert.equal(LiftType.getEffectiveLiftTypeId(), "fixed-question-bar");
  assert.equal(LiftType.getEffectiveLiftMode(), "bar");
  assert.equal(LiftType.isImplemented("fixed-question-bar"), true);
});

test("implemented ball type is selectable and maps to ball mode", () => {
  const LiftType = loadLiftType();
  LiftType.setStoredLiftTypeId("fixed-question-ball");
  assert.equal(LiftType.getStoredLiftTypeId(), "fixed-question-ball");
  assert.equal(LiftType.getEffectiveLiftTypeId(), "fixed-question-ball");
  assert.equal(LiftType.getEffectiveLiftMode(), "ball");
  assert.equal(LiftType.isImplemented("fixed-question-ball"), true);
});

test("unimplemented stored type falls back to effective default", () => {
  const LiftType = loadLiftType();
  LiftType.setStoredLiftTypeId("does-not-exist");
  assert.equal(LiftType.getEffectiveLiftTypeId(), "question-in-lift");
  assert.equal(LiftType.getEffectiveLiftMode(), "content");
});

test("three exclusive lift type options defined", () => {
  const LiftType = loadLiftType();
  assert.equal(LiftType.LIFT_TYPES.length, 3);
});
