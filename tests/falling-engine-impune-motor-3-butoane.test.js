// Test-santinela pentru Faza C din documente de referinta/PLAN-motor-comun-raspuns.md:
// falling-engine.js trebuie sa refuze, cu eroare explicita, orice raspuns de
// quiz care nu poarta semnatura Motor3Butoane — vechea cale ("quizul isi scrie
// singur logica de corect/gresit") trebuie sa chiar crape, nu doar sa fie
// descurajata printr-o regula scrisa undeva.
//
// Extins pentru Faza E, sectiunea 12 (al doilea gard): raspunsul trebuie sa
// poarte SI semnatura SubquizOrchestrator (campul "subquizEvent") — M3B
// folosit DIRECT, fara orchestrator, nu mai e suficient.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  add(...names) {
    names.forEach((name) => this.values.add(name));
  }
  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }
  toggle() {}
}

class FakeElement {
  constructor({ width = 300, height = 40, text = "" } = {}) {
    this.rect = { left: 0, top: 0, width, height, right: width, bottom: height };
    this.style = { setProperty() {}, removeProperty() {} };
    this.className = "";
    this.classList = new FakeClassList(this);
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.textContent = text;
    this.innerHTML = "";
    this.parentElement = null;
  }
  get scrollWidth() {
    return 40;
  }
  getBoundingClientRect() {
    return this.rect;
  }
  appendChild(child) {
    if (child) child.parentElement = this;
    this.children.push(child);
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
  setAttribute() {}
  removeAttribute() {}
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

function creeazaMotor(quiz) {
  const dom = createDom();
  const engine = new globalThis.FallingEngine({
    dom,
    getQuiz: () => quiz,
    showBanner: () => {},
    onProgressUpdate: () => {},
    onAttemptLogged: () => {},
  });
  return { engine, dom };
}

const roundDeBaza = {
  prompt: "2+3=?",
  options: ["4", "5", "6"],
  correctIndex: 1,
  metadata: { questionInstanceId: "q1" },
};

describe("Impunerea Motor3Butoane in falling-engine.js (Faza C)", () => {
  beforeEach(() => {
    delete globalThis.FallingEngine;
    delete globalThis.Motor3Butoane;
    globalThis.window = globalThis;
    globalThis.document = {
      createElement: () => new FakeElement(),
      addEventListener: () => {},
    };
    globalThis.getComputedStyle = () => ({ fontSize: "16px" });
    globalThis.AsnwProfile = { isEffective: () => true }; // mod raspuns direct, fara animatia de ridicare
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};
    loadScript("js/subquiz/item-generator.js");
    loadScript("js/subquiz/subquiz-definition.js");
    loadScript("js/subquiz/subquiz-orchestrator.js");
    loadScript("js/motor-3-butoane.js");
    loadScript("js/placeholder-raspuns.js");
    loadScript("js/schimbare-de-nivel.js");
    loadScript("js/falling-engine.js");
  });

  it("un quiz care isi scrie singur outcome-ul (vechea cale) chiar crapa la apasare", () => {
    const quiz = {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({ ...roundDeBaza, outcome: "round", resetFall: true }),
      // Exact vechiul tipar interzis: quizul decide singur outcome-ul, fara
      // sa treaca prin Motor3Butoane.
      onAnswer: (index) =>
        index === roundDeBaza.correctIndex
          ? { ...roundDeBaza, outcome: "step-correct", correct: true }
          : { ...roundDeBaza, outcome: "wrong-answer", correct: false },
    };
    const { engine, dom } = creeazaMotor(quiz);
    engine.startRound(roundDeBaza);

    assert.throws(
      () => dom.optionBtns[0].click(),
      /Motor 3 butoane/,
      "raspunsul fara semnatura M3B trebuie sa arunce, nu sa fie acceptat tacit"
    );
  });

  it("un quiz care raspunde prin Motor3Butoane DIRECT, fara SubquizOrchestrator, acum arunca (Faza E, sectiunea 12)", () => {
    let curent = roundDeBaza;
    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (item, index) => index === item.correctIndex,
      intrebareUrmatoare: () => {
        curent = { ...roundDeBaza, metadata: { questionInstanceId: "q2" } };
        return curent;
      },
    });
    const quiz = {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({ ...curent, outcome: "round", resetFall: true }),
      // M3B direct, fara sa treaca prin SubquizOrchestrator — exact calea pe
      // care o foloseau toate quiz-urile inainte de invelirea din §12.
      onAnswer: (index) =>
        m3b.laApasareButon({
          item: curent,
          index,
          construiesteVedere: (extra) => ({ ...curent, ...extra }),
        }).view,
    };
    const { engine, dom } = creeazaMotor(quiz);
    engine.startRound(roundDeBaza);

    assert.throws(
      () => dom.optionBtns[0].click(),
      /SubquizOrchestrator/,
      "raspunsul cu semnatura M3B dar fara subquizEvent trebuie sa arunce, nu sa fie acceptat tacit"
    );
  });

  it("un quiz construit prin SubquizOrchestrator (o singura bucata baza) functioneaza normal", () => {
    let currentItem = { prompt: "2+3=?", options: ["4", "5", "6"], correctIndex: 1 };
    const definition = globalThis.SubquizDefinition.define({
      id: "base",
      title: "baza",
      esteCorect: (_item, index) => index === currentItem.correctIndex,
      generator: () => ({}),
      actiuni: {
        dupaRaspunsCorect: () => {
          currentItem = { prompt: "2+3=?", options: ["4", "5", "6"], correctIndex: 1 };
          return {};
        },
      },
    });
    const orchestrator = globalThis.SubquizOrchestrator.create({
      definitions: [definition],
      activeSubquizIds: ["base"],
      context: {},
    });
    orchestrator.startFirst();
    orchestrator.getCurrentRuntime().setCurrentItem(currentItem);

    const quiz = {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({ ...roundDeBaza, outcome: "round", resetFall: true }),
      onAnswer: (index, meta) => orchestrator.onAnswer(index, meta),
    };
    const { engine, dom } = creeazaMotor(quiz);
    engine.startRound(roundDeBaza);

    assert.doesNotThrow(
      () => dom.optionBtns[1].click(),
      "raspunsul cu semnatura M3B SI subquizEvent nu trebuie sa arunce"
    );
  });
});
