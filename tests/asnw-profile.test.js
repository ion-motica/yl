import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadAsnwProfile(storage = {}) {
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
  new Function("window", layoutCode)(globalThis);
  new Function("window", asnwCode)(globalThis);
  return globalThis.AsnwProfile;
}

function mockGameEl() {
  const classes = new Set();
  return {
    classList: {
      toggle(cls, on) {
        if (on) classes.add(cls);
        else classes.delete(cls);
      },
      has(cls) {
        return classes.has(cls);
      },
    },
  };
}

beforeEach(() => {
  delete globalThis.LayoutConfig;
  delete globalThis.AsnwProfile;
});

test("master ON by default — hideDivLabels effective", () => {
  const Asnw = loadAsnwProfile();
  assert.equal(Asnw.isMasterOn(), true);
  assert.equal(Asnw.isEffective("hideDivLabels"), true);
});

test("master OFF — all effects off even if stored true", () => {
  const Asnw = loadAsnwProfile({
    "yl.layout.v1": JSON.stringify({
      asnwProfileOn: false,
      asnwHideDivLabels: true,
    }),
  });
  assert.equal(Asnw.isEffective("hideDivLabels"), false);
  const gameEl = mockGameEl();
  Asnw.applyDomClasses(gameEl);
  assert.ok(!gameEl.classList.has("asnw-hide-div-labels"));
});

test("master OFF — stored flag unchanged", () => {
  const Asnw = loadAsnwProfile({
    "yl.layout.v1": JSON.stringify({
      asnwProfileOn: false,
      asnwHideDivLabels: true,
    }),
  });
  assert.equal(Asnw.readStoredFlag("hideDivLabels"), true);
});

test("setMasterOn(true) resets preset in storage", () => {
  const Asnw = loadAsnwProfile();
  Asnw.setMasterOn(false);
  Asnw.writeStoredFlag("hideDivLabels", false);
  Asnw.setMasterOn(true);
  assert.equal(Asnw.readStoredFlag("hideDivLabels"), true);
  assert.equal(Asnw.isEffective("hideDivLabels"), true);
});

test("partial profile: master ON + stored false → effect off", () => {
  const Asnw = loadAsnwProfile();
  Asnw.writeStoredFlag("hideDivLabels", false);
  assert.equal(Asnw.isEffective("hideDivLabels"), false);
});

test("applyDomClasses follows effective not stored alone", () => {
  const Asnw = loadAsnwProfile();
  const gameEl = mockGameEl();
  Asnw.writeStoredFlag("hideDivLabels", false);
  Asnw.applyDomClasses(gameEl);
  assert.ok(!gameEl.classList.has("asnw-hide-div-labels"));

  Asnw.writeStoredFlag("hideDivLabels", true);
  Asnw.applyDomClasses(gameEl);
  assert.ok(gameEl.classList.has("asnw-hide-div-labels"));
});

test("hideLevelInfo effective when master ON and stored true", () => {
  const Asnw = loadAsnwProfile();
  const gameEl = mockGameEl();
  Asnw.applyDomClasses(gameEl);
  assert.ok(gameEl.classList.has("asnw-hide-level-info"));

  Asnw.writeStoredFlag("hideLevelInfo", false);
  Asnw.applyDomClasses(gameEl);
  assert.ok(!gameEl.classList.has("asnw-hide-level-info"));
});

test("hideHintMessage effective when master ON", () => {
  const Asnw = loadAsnwProfile();
  const gameEl = mockGameEl();
  Asnw.applyDomClasses(gameEl);
  assert.ok(gameEl.classList.has("asnw-hide-hint-message"));

  Asnw.writeStoredFlag("hideHintMessage", false);
  Asnw.applyDomClasses(gameEl);
  assert.ok(!gameEl.classList.has("asnw-hide-hint-message"));
});

test("hideProgressVisual effective when master ON", () => {
  const Asnw = loadAsnwProfile();
  const gameEl = mockGameEl();
  Asnw.applyDomClasses(gameEl);
  assert.ok(gameEl.classList.has("asnw-hide-progress-visual"));

  Asnw.writeStoredFlag("hideProgressVisual", false);
  Asnw.applyDomClasses(gameEl);
  assert.ok(!gameEl.classList.has("asnw-hide-progress-visual"));
});

test("resolveQuizTitle returns Adunari when simplified flag effective", () => {
  const Asnw = loadAsnwProfile();
  assert.equal(
    Asnw.resolveQuizTitle("addition-table-range", "Tabla adunarii - 1..n + 1..n"),
    "Adunari"
  );
});

test("resolveQuizTitle returns full title when flag off", () => {
  const Asnw = loadAsnwProfile();
  Asnw.writeStoredFlag("simplifiedQuizTitle", false);
  assert.equal(
    Asnw.resolveQuizTitle("addition-table-range", "Tabla adunarii - 1..n + 1..n"),
    "Tabla adunarii - 1..n + 1..n"
  );
});

test("emptySuccessionList applies css class when effective", () => {
  const Asnw = loadAsnwProfile();
  const gameEl = mockGameEl();
  Asnw.applyDomClasses(gameEl);
  assert.ok(gameEl.classList.has("asnw-empty-succession-list"));
});

test("liftNoRiseTeleport is effective when master ON", () => {
  const Asnw = loadAsnwProfile();
  assert.equal(Asnw.isEffective("liftNoRiseTeleport"), true);
  Asnw.setMasterOn(false);
  assert.equal(Asnw.isEffective("liftNoRiseTeleport"), false);
});

test("liftFixedQuestionBar is effective when master ON", () => {
  const Asnw = loadAsnwProfile();
  assert.equal(Asnw.isEffective("liftFixedQuestionBar"), true);
  Asnw.setMasterOn(false);
  assert.equal(Asnw.isEffective("liftFixedQuestionBar"), false);
});

test("handOverButtons is effective when master ON", () => {
  const Asnw = loadAsnwProfile();
  assert.equal(Asnw.isEffective("handOverButtons"), true);
  Asnw.setMasterOn(false);
  assert.equal(Asnw.isEffective("handOverButtons"), false);
});

test("simulateTap is effective when master ON", () => {
  const Asnw = loadAsnwProfile();
  assert.equal(Asnw.isEffective("simulateTap"), true);
  Asnw.setMasterOn(false);
  assert.equal(Asnw.isEffective("simulateTap"), false);
});

test("tapRippleOnQuestion is effective when master ON", () => {
  const Asnw = loadAsnwProfile();
  assert.equal(Asnw.isEffective("tapRippleOnQuestion"), true);
  Asnw.setMasterOn(false);
  assert.equal(Asnw.isEffective("tapRippleOnQuestion"), false);
});
