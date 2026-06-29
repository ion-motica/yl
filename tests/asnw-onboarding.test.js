import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

// Încarcă modulele într-un mediu fără DOM: `sync()` se autoanulează (dom=null),
// deci putem testa pur logica de fade + zile prin LayoutConfig (localStorage mock).
function loadOnboarding(storage = {}) {
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
  const onbCode = readFileSync(join(rootDir, "js/asnw-onboarding.js"), "utf8");
  new Function("window", layoutCode)(globalThis);
  new Function("window", asnwCode)(globalThis);
  new Function("window", onbCode)(globalThis);
  const Onb = globalThis.AsnwOnboarding;
  Onb._reload();
  return Onb;
}

function withConfig(extra) {
  return { "yl.layout.v1": JSON.stringify({ asnwProfileOn: true, ...extra }) };
}

function setDay(Onb, isoDate) {
  Onb._setNowForTest(() => new Date(`${isoDate}T10:00:00`));
}

const correct = { correct: true };
const wrong = { correct: false };

// 3 răspunsuri corecte consecutive = o treaptă de fade.
function fadeSteps(Onb, steps) {
  for (let i = 0; i < steps * 3; i++) Onb.notifyAnswer(correct);
}

beforeEach(() => {
  delete globalThis.LayoutConfig;
  delete globalThis.AsnwProfile;
  delete globalThis.AsnwOnboarding;
});

test("ziua 1 porneste de la maxim (p=0, mod activ, toate pline)", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  assert.equal(Onb.getFade(), 0);
  assert.equal(Onb.getMode(), "active");
  assert.equal(Onb.localStage("flux"), 0);
  assert.equal(Onb.localStage("ripple"), 0);
  assert.equal(Onb.localStage("hand"), 0);
});

test("3 raspunsuri corecte consecutive estompeaza o treapta", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  Onb.notifyAnswer(correct);
  Onb.notifyAnswer(correct);
  assert.equal(Onb.getFade(), 0); // încă nu, doar 2 corecte
  Onb.notifyAnswer(correct);
  assert.equal(Onb.getFade(), 1); // a 3-a → o treaptă
  assert.equal(Onb.localStage("flux"), 1);
  fadeSteps(Onb, 1);
  assert.equal(Onb.getFade(), 2);
});

test("pot disparea toate in aceeasi zi (fara plafon zilnic)", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  fadeSteps(Onb, 9);
  assert.equal(Onb.getFade(), 9);
  assert.equal(Onb.localStage("flux"), 3);
  assert.equal(Onb.localStage("ripple"), 3);
  assert.equal(Onb.localStage("hand"), 3);
  // peste maxim rămâne plafonat la 9
  fadeSteps(Onb, 1);
  assert.equal(Onb.getFade(), 9);
});

test("ordinea de estompare: flux → cerculete → manuta", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  fadeSteps(Onb, 3); // p=3
  assert.equal(Onb.localStage("flux"), 3); // flux dispărut
  assert.equal(Onb.localStage("ripple"), 0); // cerculețe pline
  assert.equal(Onb.localStage("hand"), 0); // mânuța plină
  fadeSteps(Onb, 3); // p=6
  assert.equal(Onb.localStage("ripple"), 3); // cerculețe dispărute
  assert.equal(Onb.localStage("hand"), 0); // mânuța încă plină
});

test("zi noua reseteaza la maxim (full din nou)", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  fadeSteps(Onb, 2);
  assert.equal(Onb.getFade(), 2);
  setDay(Onb, "2026-01-02");
  Onb.notifyNewQuestion();
  assert.equal(Onb.getFade(), 0); // ziua 2 pornește full
  assert.equal(Onb.localStage("flux"), 0);
  assert.equal(Onb.localStage("hand"), 0);
});

test("o greseala reala rupe seria de corecte (fara nicio revenire)", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  Onb.notifyAnswer(correct);
  Onb.notifyAnswer(correct); // 2 din 3
  Onb.notifyAnswer(wrong); // rupe seria
  assert.equal(Onb.getFade(), 0);
  Onb.notifyAnswer(correct);
  Onb.notifyAnswer(correct);
  assert.equal(Onb.getFade(), 0); // doar 2 după resetare
  Onb.notifyAnswer(correct);
  assert.equal(Onb.getFade(), 1); // abia acum 3 consecutive
});

test("greselile nu readuc niciodata fade-ul deja consumat", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  fadeSteps(Onb, 3); // p=3
  for (let i = 0; i < 10; i++) Onb.notifyAnswer(wrong);
  assert.equal(Onb.getFade(), 3); // nicio revenire
});

test("dupa 3 zile (fara persist) → off, nimic vizibil", () => {
  const Onb = loadOnboarding();
  for (const d of ["2026-01-01", "2026-01-02", "2026-01-03"]) {
    setDay(Onb, d);
    Onb.notifyNewQuestion();
  }
  assert.equal(Onb.getMode(), "active");
  setDay(Onb, "2026-01-04");
  Onb.notifyNewQuestion();
  assert.equal(Onb.getMode(), "off");
  assert.equal(Onb.localStage("flux"), 3);
  assert.equal(Onb.localStage("hand"), 3);
});

test("persist ON → activ si dupa 3 zile, cu reset zilnic", () => {
  const Onb = loadOnboarding(withConfig({ asnwOnboardingPersist: true }));
  for (const d of ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]) {
    setDay(Onb, d);
    Onb.notifyNewQuestion();
    Onb.notifyAnswer(correct);
    Onb.notifyAnswer(correct);
  }
  // ziua 5 încă activă (persist) și pornește full
  setDay(Onb, "2026-01-05");
  Onb.notifyNewQuestion();
  assert.equal(Onb.getMode(), "active");
  assert.equal(Onb.getFade(), 0);
  assert.equal(Onb.localStage("flux"), 0);
});

test("aceeasi zi deschisa de mai multe ori nu numara zile in plus si nu reseteaza", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  fadeSteps(Onb, 1); // p=1
  Onb.notifyNewQuestion(); // aceeași zi → fără reset
  assert.equal(Onb.getProgress().distinctDays, 1);
  assert.equal(Onb.getFade(), 1);
});

test("master ASNW debifat ⇒ mod off si fara progres", () => {
  const Onb = loadOnboarding(withConfig({ asnwProfileOn: false }));
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  Onb.notifyAnswer(correct);
  assert.equal(Onb.getMode(), "off");
  assert.equal(Onb.getFade(), 0);
  assert.equal(Onb.localStage("flux"), 3);
});

test("resetProgress readuce starea la maxim", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  fadeSteps(Onb, 3);
  assert.equal(Onb.getFade(), 3);
  Onb.resetProgress();
  assert.equal(Onb.getFade(), 0);
  assert.equal(Onb.getProgress().distinctDays, 0);
});

test("timeout-urile (answered:false) nu afecteaza fade-ul / seria de corecte", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  Onb.notifyAnswer(correct);
  Onb.notifyAnswer(correct); // 2 corecte reale
  Onb.notifyAnswer({ correct: true, answered: false }); // timeout → ignorat
  Onb.notifyAnswer({ correct: false, answered: false }); // timeout → ignorat
  assert.equal(Onb.getProgress().streak, 2); // seria neatinsă de timeout-uri
  Onb.notifyAnswer(correct); // a 3-a corectă reală → o treaptă
  assert.equal(Onb.getFade(), 1);
});

test("debugAdvanceDay simuleaza zile noi (reset la full, off dupa 3 zile)", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion(); // zi 1
  fadeSteps(Onb, 2);
  assert.equal(Onb.getFade(), 2);
  Onb.debugAdvanceDay(); // zi 2 → reset full
  assert.equal(Onb.getProgress().distinctDays, 2);
  assert.equal(Onb.getFade(), 0);
  assert.equal(Onb.getMode(), "active");
  Onb.debugAdvanceDay(); // zi 3
  assert.equal(Onb.getMode(), "active");
  Onb.debugAdvanceDay(); // zi 4 → off (fără persist)
  assert.equal(Onb.getMode(), "off");
});

test("progresul persista in LayoutConfig intre reincarcari", () => {
  const Onb = loadOnboarding();
  setDay(Onb, "2026-01-01");
  Onb.notifyNewQuestion();
  fadeSteps(Onb, 2);
  assert.equal(Onb.getFade(), 2);
  Onb._reload();
  assert.equal(Onb.getFade(), 2);
});
