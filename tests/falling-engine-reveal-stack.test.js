// Regresie raportata de user (27.08.2026), la "T*/ 11-20 - v4", Subquiz 3:
//
// Dupa raspunsul corect aparea un flash in care se afisa NUMAI intrebarea activa,
// pe un singur rand, cu raspunsul in locul lui "?" — stack-ul intreg disparea.
//
// Cauza: motorul primeste `prompt` = textul pe un rand ("11*9=?") si `promptHtml`
// = stack-ul. Cand nu gaseste in DOM un slot marcat, `revealAnswerInPlace` esueaza
// si se cade pe `buildRevealedState`, care RECONSTRUIESTE promptul din textul pe un
// rand — deci prabuseste stack-ul.
//
// Ce se cere: la revelare, stack-ul ramane intreg, iar raspunsul inlocuieste "?"
// DOAR la randul activ.
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

const CLASA = "placeholder-pt-raspuns";

// Stack cu 3 randuri; DOAR randul curent poarta placeholderul marcat, exact cum
// il construieste renderStackHtml din quiz.
function stackHtml(semnCurent) {
  return (
    '<div class="fg-stack">' +
    '<div class="fg-stack-row">11*3=?</div>' +
    `<div class="fg-stack-row fg-stack-row--curent">11*9=${semnCurent}</div>` +
    '<div class="fg-stack-row">11*15=?</div>' +
    "</div>"
  );
}

// Quizul se construieste prin SubquizOrchestrator, ca orice quiz real — altfel
// motorul refuza raspunsul (ii lipseste semnatura `subquizEvent`).
function creeazaQuizCuStack(promptHtml) {
  const item = {
    // `prompt` ramane textul pe UN RAND: asa il tine si quizul real, pentru loguri.
    prompt: "11*9=?",
    promptHtml,
    options: ["77", "99", "121"],
    correctIndex: 1,
    metadata: { questionInstanceId: "q1" },
  };
  const definition = globalThis.SubquizDefinition.define({
    id: "base",
    title: "baza",
    esteCorect: (_i, index) => index === item.correctIndex,
    generator: () => item,
  });
  const orchestrator = globalThis.SubquizOrchestrator.create({
    definitions: [definition],
    activeSubquizIds: ["base"],
    context: {},
  });
  orchestrator.startFirst();
  orchestrator.getCurrentRuntime().setCurrentItem(item);

  return {
    runda: item,
    quiz: {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({ ...item, outcome: "round" }),
      onAnswer: (index, meta) => orchestrator.onAnswer(index, meta),
    },
  };
}

describe("falling-engine: revelarea intr-un stack pastreaza toate randurile", () => {
  let dom;
  let slot;

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
    // Slotul marcat, asa cum l-ar gasi motorul in DOM-ul deja randat.
    slot = new FakeElement({ width: 20, height: 20 });
    slot.classList.add(CLASA);
    slot.textContent = "?";
    dom.topNumberEl.queryMap = new Map([[`.${CLASA}`, slot]]);
  });

  it("raspunsul apare in slotul randului activ, iar stack-ul NU se prabuseste", () => {
    const { runda, quiz } = creeazaQuizCuStack(stackHtml(`<span class="${CLASA}">?</span>`));

    const engine = new globalThis.FallingEngine({
      dom,
      getQuiz: () => quiz,
      showBanner: () => {},
      onProgressUpdate: () => {},
      onAttemptLogged: () => {},
    });
    engine.startRound(runda);

    const htmlLaAfisare = dom.topNumberEl.innerHTML;
    assert.ok(htmlLaAfisare.includes("fg-stack"), "la afisare trebuie sa fie stack");

    dom.optionBtns[1].click();

    // Revelarea s-a facut IN SLOT, nu prin rescrierea promptului.
    assert.equal(slot.textContent, "99", "raspunsul trebuie scris in slotul randului activ");
    assert.ok(slot.classList.contains("q-correct"), "slotul primeste marcajul de raspuns corect");
    assert.ok(!slot.classList.contains(CLASA), "dupa revelare nu mai e placeholder");

    // Regresia propriu-zisa: promptul NU a fost reconstruit din textul pe un rand.
    assert.equal(
      dom.topNumberEl.innerHTML,
      htmlLaAfisare,
      "stack-ul trebuie sa ramana intreg — promptul nu se reconstruieste din `prompt`"
    );
    assert.ok(
      !dom.topNumberEl.innerHTML.includes('<span class="q-correct">99</span> '),
      "nu trebuie sa apara forma prabusita, pe un singur rand"
    );
  });

  it("fara slot marcat, calea veche chiar prabuseste stack-ul (de-aia e nevoie de marcaj)", () => {
    // Documenteaza cauza: acesta E comportamentul de dinainte de reparatie.
    dom.topNumberEl.queryMap = new Map();
    const { runda, quiz } = creeazaQuizCuStack(stackHtml("?"));
    const engine = new globalThis.FallingEngine({
      dom,
      getQuiz: () => quiz,
      showBanner: () => {},
      onProgressUpdate: () => {},
      onAttemptLogged: () => {},
    });
    engine.startRound(runda);
    dom.optionBtns[1].click();

    assert.ok(
      !dom.topNumberEl.innerHTML.includes("fg-stack"),
      "fara slot marcat, promptul e reconstruit din textul pe un rand si stack-ul dispare"
    );
  });
});
