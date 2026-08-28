// Regresie reala, raportata de user (28.08.2026), la ambele quizuri Singapore
// ("Tabla adunarii Singapore 6=?+3" si "6=3+3|3+4"): dupa un raspuns corect care
// termina un tur (avans de nivel), ecranul ramanea blocat pe INTREBAREA VECHE,
// cu butoane ACTIVE, desi starea interna a quizului avansase deja. Orice
// apasare era evaluata impotriva starii NOI -> parea "gresita". Dupa o vreme,
// ecranul se resincroniza brusc, dand impresia ca a "trecut singur" la
// intrebarea urmatoare — INCALCAND regula de aur (nu se trece mai departe fara
// un raspuns corect).
//
// Cauza, gasita la linie exacta in falling-engine.js (applyAnswerResultTail):
//
//   if (result.promptHoldMs != null && result.continueStep !== undefined) { ... }
//
// `promptHoldMs` avea un AL DOILEA rol, ascuns: flag de control care decidea
// DACA `continueStep` (avansul la runda urmatoare) se aplica DELOC. Cand
// quizurile Singapore au scapat de `promptHoldMs: 400` (standardizare
// placeholder, tot 28.08.2026), continueStep-ul nu a mai fost aplicat
// NICIODATA pe acea cale — pierdut complet, tacut, fara eroare.
//
// Fix: un `continueStep` prezent se aplica INTOTDEAUNA; `promptHoldMs` (apoi
// `runDelayMs`, apoi DEFAULT_REVEAL_HOLD_MS) decide DOAR cat dureaza pauza,
// nu daca pasul se aplica. Testul de mai jos verifica exact asta, prin
// motorul REAL (nu doar structura obiectului intors de quiz) — genul de test
// care ar fi prins regresia daca ar fi existat inainte.
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
    this.disabled = false;
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
    if (this.disabled) return;
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

const CLASA = "placeholder-pt-raspuns";

// Runda "veche" (turul curent, pe cale sa se termine) si runda "noua" (dupa
// avansul de nivel) — structura minima, ca la un quiz standard cu promptHtml.
function stareCuPlaceholder(text) {
  return `<span>${text}=<span class="${CLASA}">?</span></span>`;
}

describe("falling-engine: continueStep se aplica INTOTDEAUNA, cu sau fara promptHoldMs", () => {
  let dom;
  let quiz;

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
    loadScript("js/subquiz/item-generator.js");
    loadScript("js/subquiz/subquiz-definition.js");
    loadScript("js/subquiz/subquiz-orchestrator.js");
    loadScript("js/motor-3-butoane.js");
    loadScript("js/falling-engine.js");

    dom = createDom();
    const slot = new FakeElement({ width: 20, height: 20 });
    slot.classList.add(CLASA);
    slot.textContent = "?";
    dom.topNumberEl.queryMap = new Map([[`.${CLASA}`, slot]]);
  });

  it("fara promptHoldMs: continueStep tot avanseaza la runda urmatoare (regresia de azi)", async () => {
    const rundaNoua = {
      prompt: "9=?",
      promptHtml: stareCuPlaceholder("9"),
      options: ["8", "9", "10"],
      correctIndex: 0,
      metadata: { questionInstanceId: "urmatoarea" },
    };
    const rundaVeche = {
      prompt: "3=?",
      promptHtml: stareCuPlaceholder("3"),
      options: ["1", "2", "3"],
      correctIndex: 1,
      metadata: { questionInstanceId: "veche" },
    };

    // Construit prin SubquizOrchestrator, ca orice quiz real (altfel motorul
    // refuza raspunsul, ii lipseste semnatura `subquizEvent`). Tiparul
    // `dupaRaspunsCorect` -> `{action:"continue", view:{...continueStep}}` e
    // exact ce fac `buildTurnCompleteStep`-urile din quizurile Singapore
    // reale, la finalul unui tur.
    let currentItem = rundaVeche;
    const definition = globalThis.SubquizDefinition.define({
      id: "base",
      title: "baza",
      esteCorect: (_item, index) => index === rundaVeche.correctIndex,
      generator: () => currentItem,
      actiuni: {
        dupaRaspunsCorect: () => ({
          action: "continue",
          view: {
            outcome: "step-correct",
            correct: true,
            ...rundaVeche,
            // NICIUN promptHoldMs, NICIUN runDelayMs — exact starea de azi,
            // dupa ce standardizarea Singapore le-a scos.
            continueStep: {
              outcome: "run-complete",
              correct: true,
              runComplete: true,
              nextRound: rundaNoua,
            },
          },
        }),
      },
    });
    const orchestrator = globalThis.SubquizOrchestrator.create({
      definitions: [definition],
      activeSubquizIds: ["base"],
      context: {},
    });
    orchestrator.startFirst();
    orchestrator.getCurrentRuntime().setCurrentItem(rundaVeche);

    quiz = {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({ ...rundaVeche, outcome: "round" }),
      onAnswer: (index, meta) => orchestrator.onAnswer(index, meta),
    };

    const engine = new globalThis.FallingEngine({
      dom,
      getQuiz: () => quiz,
      showBanner: () => {},
      onProgressUpdate: () => {},
      onAttemptLogged: () => {},
    });
    engine.startRound(rundaVeche);
    dom.optionBtns[1].click();

    // Asteapta peste DEFAULT_REVEAL_HOLD_MS (160) + delay-ul de finishRun.
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.equal(
      dom.topNumberEl.innerHTML,
      rundaNoua.promptHtml,
      "dupa raspunsul corect, continueStep trebuia sa afiseze runda urmatoare — " +
        "inainte de fix, ramanea blocat pe runda veche"
    );
  });

  it("regula de aur: fara NICIUN raspuns, ecranul nu se schimba, oricat ai astepta", async () => {
    const rundaVeche = {
      prompt: "3=?",
      promptHtml: stareCuPlaceholder("3"),
      options: ["1", "2", "3"],
      correctIndex: 1,
      metadata: { questionInstanceId: "veche" },
    };
    quiz = {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({ ...rundaVeche, outcome: "round" }),
      onAnswer: () => {
        throw new Error("nu trebuia apelat — testul nu apasa niciun buton");
      },
      beginRound: () => rundaVeche,
    };
    const engine = new globalThis.FallingEngine({
      dom,
      getQuiz: () => quiz,
      showBanner: () => {},
      onProgressUpdate: () => {},
      onAttemptLogged: () => {},
    });
    engine.startRound(rundaVeche);
    const inainte = dom.topNumberEl.innerHTML;

    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.equal(dom.topNumberEl.innerHTML, inainte, "fara apasare, ecranul nu se schimba");
  });
});
