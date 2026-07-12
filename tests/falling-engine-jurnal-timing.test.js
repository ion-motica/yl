import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
const RealDate = globalThis.Date;
const realPerformance = globalThis.performance;

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  const runner = new Function("window", `${code}\n`);
  runner(globalThis);
}

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
    this.owner.className = [...this.values].join(" ");
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
    this.owner.className = [...this.values].join(" ");
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    this.owner.className = [...this.values].join(" ");
    return shouldAdd;
  }
}

class FakeStyle {
  setProperty(name, value) {
    this[name] = String(value);
  }

  removeProperty(name) {
    delete this[name];
  }
}

class FakeElement {
  constructor({ width = 300, height = 40, text = "" } = {}) {
    this.rect = { left: 0, top: 0, width, height, right: width, bottom: height };
    this.style = new FakeStyle();
    this.className = "";
    this.classList = new FakeClassList(this);
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = text;
    this.innerHTML = "";
    this.parentElement = null;
    this.clientWidth = width;
  }

  get scrollWidth() {
    return Math.max(20, String(this.textContent || this.innerHTML || "").length * 8);
  }

  getBoundingClientRect() {
    return this.rect;
  }

  appendChild(child) {
    if (child && typeof child === "object") {
      child.parentElement = this;
      this.children.push(child);
    }
    return child;
  }

  append(...items) {
    items.forEach((item) => this.appendChild(item));
  }

  replaceChildren(...items) {
    this.children = [];
    this.append(...items);
  }

  querySelector(selector) {
    return this.queryMap?.get(selector) ?? null;
  }

  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  }

  click() {
    (this.listeners.click || []).forEach((handler) => handler({ target: this }));
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  removeAttribute(name) {
    delete this[name];
  }
}

function optionButton(index, text) {
  const button = new FakeElement({ width: 80, height: 40 });
  const prime = new FakeElement({ width: 50, height: 24, text });
  button.dataset.index = String(index);
  button.queryMap = new Map([[".prime", prime]]);
  return button;
}

function createDom() {
  const fallingInner = new FakeElement({ width: 260, height: 90 });
  const falling = new FakeElement({ width: 300, height: 112 });
  falling.queryMap = new Map([[".falling-inner", fallingInner]]);
  return {
    gameEl: new FakeElement(),
    divArena: new FakeElement({ width: 300, height: 113 }),
    arena: new FakeElement({ width: 300, height: 113 }),
    arenaQuestionSlotEl: new FakeElement({ width: 300, height: 40 }),
    illustrareLiftEl: new FakeElement(),
    falling,
    fallingInner,
    fallingMainEl: new FakeElement({ width: 300, height: 112 }),
    topNumberEl: new FakeElement({ width: 260, height: 32 }),
    divisionHistoryEl: new FakeElement(),
    successionListEl: new FakeElement(),
    messageEl: new FakeElement(),
    playPauseBtn: new FakeElement(),
    flashEl: new FakeElement(),
    rising: new FakeElement({ width: 40, height: 24 }),
    risingNumberEl: new FakeElement(),
    optionBtns: [optionButton(0, "10"), optionButton(1, "11"), optionButton(2, "12")],
    fallingPrimes: [new FakeElement(), new FakeElement(), new FakeElement()],
    liftControlPanelEl: null,
  };
}

describe("FallingEngine - precizia timpului pentru jurnal", () => {
  let performanceNow;
  let wallClock;

  beforeEach(() => {
    delete globalThis.FallingEngine;
    globalThis.window = globalThis;
    globalThis.document = {
      createElement: () => new FakeElement(),
      addEventListener: () => {},
    };
    globalThis.getComputedStyle = () => ({ fontSize: "16px" });
    globalThis.AsnwProfile = { isEffective: () => true };
    performanceNow = 100;
    wallClock = RealDate.parse("2026-07-12T09:15:30.000Z");
    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      value: { now: () => performanceNow },
    });
    globalThis.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [wallClock]));
      }

      static now() {
        return wallClock;
      }
    };
  });

  afterEach(() => {
    globalThis.Date = RealDate;
    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      value: realPerformance,
    });
    delete globalThis.AsnwProfile;
  });

  it("timeout-ul nu reseteaza timpul, iar o intrebare noua identica il reseteaza", () => {
    const rafQueue = [];
    globalThis.requestAnimationFrame = (callback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    };
    globalThis.cancelAnimationFrame = () => {};
    loadScript("js/falling-engine.js");

    const round1 = {
      prompt: "?*2=22",
      options: ["10", "11", "12"],
      correctIndex: 1,
      metadata: { questionInstanceId: "q1" },
    };
    const round2 = {
      ...round1,
      metadata: { questionInstanceId: "q2" },
    };
    let currentRound = round1;
    let timeoutCount = 0;
    const attempts = [];
    const quiz = {
      isCompleted: () => false,
      getFallSpeedFactor: () => 1,
      onTimeout() {
        timeoutCount += 1;
        return { ...currentRound, outcome: "round", resetFall: true };
      },
      onAnswer(index) {
        if (index !== 1) return { ...currentRound, outcome: "wrong-answer", correct: false };
        currentRound = round2;
        return { ...round2, outcome: "step-correct", correct: true };
      },
    };
    const dom = createDom();
    const engine = new globalThis.FallingEngine({
      dom,
      getQuiz: () => quiz,
      showBanner: () => {},
      onProgressUpdate: () => {},
      onAttemptLogged: (entry) => attempts.push(entry),
    });

    engine.startRound(round1);
    const firstDisplayedAt = "2026-07-12T09:15:30.000Z";

    performanceNow = 3100;
    wallClock += 3000;
    for (let frame = 1; frame <= 500 && timeoutCount === 0; frame += 1) {
      const callback = rafQueue.shift();
      assert.ok(callback, "expected a queued animation frame");
      callback(frame * 100);
    }
    assert.equal(timeoutCount, 1);
    assert.equal(attempts.length, 0, "timeout-ul nu este raportat ca apasare");

    performanceNow = 3434;
    wallClock = RealDate.parse("2026-07-12T09:15:33.334Z");
    dom.optionBtns[0].click();
    const firstPress = attempts.at(-1);
    assert.equal(firstPress.meta.questionDisplayedAt, firstDisplayedAt);
    assert.equal(firstPress.meta.responseMs, 3334);
    assert.deepEqual(firstPress.dateMecaniceJurnal, {
      moment_afisare_iso: firstDisplayedAt,
      raspuns: "10",
      a_raspuns_corect: false,
      a_cata_apasare_pe_buton: 1,
      durata_raspuns_secunde: 3.3,
      pozitie_buton_apasat_pt_raspuns: 1,
      valori_variante_de_raspuns: ["10", "11", "12"],
      valoare_raspuns_corect: "11",
    });

    performanceNow = 4667;
    wallClock = RealDate.parse("2026-07-12T09:15:34.567Z");
    dom.optionBtns[1].click();
    const correctPress = attempts.at(-1);
    assert.equal(correctPress.meta.questionDisplayedAt, firstDisplayedAt);
    assert.equal(correctPress.meta.responseMs, 4567);
    assert.equal(correctPress.dateMecaniceJurnal.a_cata_apasare_pe_buton, 2);
    assert.equal(correctPress.dateMecaniceJurnal.durata_raspuns_secunde, 4.6);
    assert.equal(correctPress.dateMecaniceJurnal.a_raspuns_corect, true);

    performanceNow = 5901;
    wallClock = RealDate.parse("2026-07-12T09:15:35.801Z");
    dom.optionBtns[0].click();
    const nextQuestionPress = attempts.at(-1);
    assert.equal(nextQuestionPress.meta.questionDisplayedAt, "2026-07-12T09:15:34.567Z");
    assert.equal(nextQuestionPress.meta.responseMs, 1234);
    assert.equal(nextQuestionPress.dateMecaniceJurnal.a_cata_apasare_pe_buton, 1);
    assert.equal(nextQuestionPress.dateMecaniceJurnal.durata_raspuns_secunde, 1.2);
  });
});
