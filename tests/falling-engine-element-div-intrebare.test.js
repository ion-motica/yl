// Testeaza "Mod scriere intrebare noua" (decis de user, 30.08.2026): la o
// intrebare noua care refoloseste forma celei vechi, motorul modifica DOAR
// elementele marcate `data-element-div-intrebare`, fara sa stearga si sa
// rescrie tot promptul (mod 2: "modificare elemente din intrebarea veche,
// fara stergere intrebare veche"). Daca un element declarat nu se gaseste in
// DOM-ul deja randat, cade pe rescrierea completa de azi — neschimbata (mod 1:
// "stergere completa intrebare veche si rescriere intrebare noua de la 0").
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }
  add(...n) {
    n.forEach((x) => this.values.add(x));
    this.owner.className = [...this.values].join(" ");
  }
  remove(...n) {
    n.forEach((x) => this.values.delete(x));
    this.owner.className = [...this.values].join(" ");
  }
  toggle(name, force) {
    const add = force === undefined ? !this.values.has(name) : Boolean(force);
    if (add) this.values.add(name);
    else this.values.delete(name);
    this.owner.className = [...this.values].join(" ");
    return add;
  }
  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor({ width = 300, height = 40 } = {}) {
    this.rect = { left: 0, top: 0, width, height, right: width, bottom: height };
    this.style = { setProperty() {}, removeProperty() {} };
    this.className = "";
    this.classList = new FakeClassList(this);
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.innerHTML = "";
    this.textContent = "";
    this.queryMap = null;
  }
  getBoundingClientRect() {
    return this.rect;
  }
  get scrollWidth() {
    return Math.max(20, String(this.textContent || this.innerHTML || "").length * 8);
  }
  append(...items) {
    this.children.push(...items);
  }
  replaceChildren(...items) {
    this.children = [];
    this.append(...items);
  }
  querySelector(selector) {
    return this.queryMap?.get(selector) ?? null;
  }
  addEventListener(type, handler) {
    (this.listeners[type] = this.listeners[type] || []).push(handler);
  }
  click() {
    (this.listeners.click || []).forEach((h) => h({ target: this }));
  }
  setAttribute(name, value) {
    this[name] = String(value);
  }
  removeAttribute(name) {
    delete this[name];
  }
}

function optionButton(index) {
  const btn = new FakeElement({ width: 80, height: 40 });
  const prime = new FakeElement({ width: 40, height: 20 });
  btn.dataset.index = String(index);
  btn.queryMap = new Map([[".prime", prime]]);
  return btn;
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
    optionBtns: [optionButton(0), optionButton(1), optionButton(2)],
    fallingPrimes: [new FakeElement(), new FakeElement(), new FakeElement()],
    liftControlPanelEl: null,
  };
}

describe("falling-engine: Mod scriere intrebare noua (element_div_intrebare)", () => {
  let dom;
  let engine;
  let ultimaVedere;

  beforeEach(() => {
    delete globalThis.FallingEngine;
    delete globalThis.Motor3Butoane;
    delete globalThis.PlaceholderRaspuns;
    globalThis.window = globalThis;
    globalThis.document = { createElement: () => new FakeElement(), addEventListener: () => {} };
    globalThis.getComputedStyle = () => ({ fontSize: "16px" });
    globalThis.AsnwProfile = { isEffective: () => true };
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};
    globalThis.LayoutConfig = { get: (_k, d) => d, set: () => {} };
    loadScript("js/placeholder-raspuns.js");
    loadScript("js/schimbare-de-nivel.js");
    loadScript("js/subquiz/item-generator.js");
    loadScript("js/subquiz/subquiz-definition.js");
    loadScript("js/subquiz/subquiz-orchestrator.js");
    loadScript("js/motor-3-butoane.js");
    loadScript("js/falling-engine.js");

    dom = createDom();
    ultimaVedere = null;
    const quizMinim = {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({}),
      onAnswer: () => ({}),
    };
    engine = new globalThis.FallingEngine({
      dom,
      getQuiz: () => quizMinim,
      showBanner: () => {},
      onProgressUpdate: () => {},
      onAttemptLogged: () => {},
      onRender: (state) => {
        ultimaVedere = state;
      },
    });
  });

  it("gaseste elementele marcate si le modifica in loc, fara sa atinga restul promptului", () => {
    const elA = new FakeElement();
    const elB = new FakeElement();
    dom.topNumberEl.queryMap = new Map([
      ['[data-element-div-intrebare="bond-a"]', elA],
      ['[data-element-div-intrebare="bond-b"]', elB],
    ]);

    engine.startRound({ promptHtml: '<div class="inventar">initial</div>' });
    const htmlDupaPrimaRandare = dom.topNumberEl.innerHTML;

    engine.startRound({
      promptHtml: '<div class="inventar">alta forma, n-ar trebui folosita</div>',
      elementeDivIntrebare: [
        { id: "bond-a", html: "3+2" },
        { id: "bond-b", html: "5" },
      ],
    });

    assert.equal(elA.innerHTML, "3+2", "elementul 'bond-a' primeste continutul nou");
    assert.equal(elB.innerHTML, "5", "elementul 'bond-b' primeste continutul nou");
    assert.equal(
      dom.topNumberEl.innerHTML,
      htmlDupaPrimaRandare,
      "containerul din jur NU se rescrie — ramane exact ce era dupa prima randare"
    );
    assert.equal(
      ultimaVedere.modScriereIntrebareNoua,
      "modificare elemente din intrebarea veche, fara stergere intrebare veche"
    );
  });

  it("daca un element declarat lipseste din DOM, cade pe rescrierea completa", () => {
    dom.topNumberEl.queryMap = new Map();

    engine.startRound({ promptHtml: '<div class="inventar">initial</div>' });
    engine.startRound({
      promptHtml: '<div class="inventar">intrebare noua completa</div>',
      elementeDivIntrebare: [{ id: "bond-a", html: "3+2" }],
    });

    assert.equal(
      dom.topNumberEl.innerHTML,
      '<div class="inventar">intrebare noua completa</div>',
      "fara elementul gasit, promptul intreg se rescrie ca inainte"
    );
    assert.equal(
      ultimaVedere.modScriereIntrebareNoua,
      "stergere completa intrebare veche si rescriere intrebare noua de la 0"
    );
  });

  it("fara elementeDivIntrebare (quiz nemodificat), randarea ramane rescriere completa", () => {
    dom.topNumberEl.queryMap = new Map();

    engine.startRound({ promptHtml: '<div class="inventar">o singura intrebare</div>' });

    assert.equal(dom.topNumberEl.innerHTML, '<div class="inventar">o singura intrebare</div>');
    assert.equal(
      ultimaVedere.modScriereIntrebareNoua,
      "stergere completa intrebare veche si rescriere intrebare noua de la 0"
    );
  });
});
