// CONTRACTUL PASULUI URMATOR — `pasUrmator: { dupa, continua }`.
//
// Vezi documente de referinta/RAPORT-motor-comun-raspuns.md.
//
// ============================ DE CE EXISTA ==================================
//
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
// Existau doi campi FRATI, amandoi optionali: `promptHoldMs` (DURATA) si
// `continueStep` (FLUX). Motorul ii cupla cu `&&`, deci campul despre durata
// avea un al doilea rol, nedeclarat: decidea DACA avansul se aplica deloc. Cand
// quizurile Singapore au scapat de `promptHoldMs: 400` (standardizarea
// placeholderului, tot 28.08.2026), avansul nu a mai fost aplicat NICIODATA pe
// acea cale — pierdut complet, tacut, fara eroare.
//
// Primul fix a decuplat cei doi campi. Dar asta repara instanta, nu forma:
// ramaneau doi campi frati a caror relatie era tinuta minte doar de cine scria
// linia. Decizia userului a fost sa se schimbe FORMA, o singura data, peste tot:
// un singur camp ATOMIC, `pasUrmator: { dupa, continua }`, in care durata sta
// INAUNTRUL pasului. Prezenta campului inseamna "aplica pasul"; nu mai exista un
// al doilea camp de activare de sincronizat mental cu primul.
//
// Testele de mai jos trec prin motorul REAL (nu verifica doar obiectul intors de
// quiz) si acopera trei lucruri diferite:
//   1. comportamentul care s-a rupt (avans fara pauza declarata),
//   2. faptul ca `dupa` inca mai controleaza DURATA (nu a devenit decorativ),
//   3. garzile care fac imposibila reintoarcerea la forma veche.
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
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

const RUNDA_NOUA = {
  prompt: "9=?",
  promptHtml: stareCuPlaceholder("9"),
  options: ["8", "9", "10"],
  correctIndex: 0,
  metadata: { questionInstanceId: "urmatoarea" },
};

const RUNDA_VECHE = {
  prompt: "3=?",
  promptHtml: stareCuPlaceholder("3"),
  options: ["1", "2", "3"],
  correctIndex: 1,
  metadata: { questionInstanceId: "veche" },
};

const asteapta = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("falling-engine: contractul `pasUrmator`", () => {
  let dom;

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
    const slot = new FakeElement({ width: 20, height: 20 });
    slot.classList.add(CLASA);
    slot.textContent = "?";
    dom.topNumberEl.queryMap = new Map([[`.${CLASA}`, slot]]);
  });

  // Construit prin SubquizOrchestrator, ca orice quiz real (altfel motorul
  // refuza raspunsul, ii lipseste semnatura `subquizEvent`). Tiparul
  // `dupaRaspunsCorect` -> `{action:"continue", view:{...}}` e exact ce fac
  // `buildTurnCompleteStep`-urile din quizurile Singapore reale.
  function porneste(vedereLaRaspunsCorect) {
    const definition = globalThis.SubquizDefinition.define({
      id: "base",
      title: "baza",
      esteCorect: (_item, index) => index === RUNDA_VECHE.correctIndex,
      generator: () => RUNDA_VECHE,
      actiuni: {
        dupaRaspunsCorect: () => ({ action: "continue", view: vedereLaRaspunsCorect }),
      },
    });
    const orchestrator = globalThis.SubquizOrchestrator.create({
      definitions: [definition],
      activeSubquizIds: ["base"],
      context: {},
    });
    orchestrator.startFirst();
    orchestrator.getCurrentRuntime().setCurrentItem(RUNDA_VECHE);

    const quiz = {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({ ...RUNDA_VECHE, outcome: "round" }),
      onAnswer: (index, meta) => orchestrator.onAnswer(index, meta),
    };

    const engine = new globalThis.FallingEngine({
      dom,
      getQuiz: () => quiz,
      showBanner: () => {},
      onProgressUpdate: () => {},
      onAttemptLogged: () => {},
    });
    engine.startRound(RUNDA_VECHE);
    return engine;
  }

  function vedereCuPas(pasUrmator) {
    return { outcome: "step-correct", correct: true, ...RUNDA_VECHE, pasUrmator };
  }

  it("fara `dupa`: pasul tot avanseaza la runda urmatoare (regresia de 28.08.2026)", async () => {
    porneste(
      vedereCuPas({
        // NICIUN `dupa`, NICIUN `runDelayMs` — exact starea in care quizurile
        // Singapore au ajuns dupa ce li s-a scos pauza custom de 400ms. Cu
        // contractul vechi, aici avansul se pierdea tacut.
        continua: {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          nextRound: RUNDA_NOUA,
        },
      })
    );
    dom.optionBtns[1].click();

    // Peste DEFAULT_REVEAL_HOLD_MS (160) + delay-ul de finishRun.
    await asteapta(300);

    assert.equal(
      dom.topNumberEl.innerHTML,
      RUNDA_NOUA.promptHtml,
      "dupa raspunsul corect, pasul urmator trebuia sa afiseze runda urmatoare — " +
        "cu contractul vechi ramanea blocat pe runda veche"
    );
  });

  it("`dupa` inca mai controleaza DURATA: o pauza lunga chiar intarzie avansul", async () => {
    // Perechea acestui test e cea de mai sus: impreuna arata ca `dupa` a ramas
    // exclusiv despre durata. Daca cineva l-ar recupla la flux, unul din cele
    // doua ar pica.
    porneste(
      vedereCuPas({
        dupa: 500,
        continua: {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          nextRound: RUNDA_NOUA,
        },
      })
    );
    dom.optionBtns[1].click();

    await asteapta(150);
    assert.notEqual(
      dom.topNumberEl.innerHTML,
      RUNDA_NOUA.promptHtml,
      "la 150ms dintr-o pauza de 500ms, runda noua nu avea voie sa fie deja pe ecran"
    );

    await asteapta(600);
    assert.equal(
      dom.topNumberEl.innerHTML,
      RUNDA_NOUA.promptHtml,
      "dupa trecerea pauzei, runda noua trebuia sa apara"
    );
  });

  it("respinge contractul vechi `continueStep`, in loc sa-l ignore tacit", () => {
    porneste({
      outcome: "step-correct",
      correct: true,
      ...RUNDA_VECHE,
      continueStep: { outcome: "run-complete", runComplete: true, nextRound: RUNDA_NOUA },
    });
    assert.throws(() => dom.optionBtns[1].click(), /pasUrmator/);
  });

  it("respinge contractul vechi `promptHoldMs`, in loc sa-l ignore tacit", () => {
    porneste({ outcome: "step-correct", correct: true, ...RUNDA_VECHE, promptHoldMs: 400 });
    assert.throws(() => dom.optionBtns[1].click(), /pasUrmator/);
  });

  it("respinge un `pasUrmator` fara `continua` — forma vechiului bug in haine noi", () => {
    // `{ dupa: 400 }` fara `continua` ar fi exact vechea "pauza care nu duce
    // nicaieri". Motorul o refuza explicit, nu asteapta degeaba.
    porneste(vedereCuPas({ dupa: 400 }));
    assert.throws(() => dom.optionBtns[1].click(), /continua/);
  });

  it("respinge un `dupa` care nu e durata (numar)", () => {
    porneste(
      vedereCuPas({ dupa: "400ms", continua: { runComplete: true, nextRound: RUNDA_NOUA } })
    );
    assert.throws(() => dom.optionBtns[1].click(), /dupa/);
  });

  it("regula de aur: fara NICIUN raspuns, ecranul nu se schimba, oricat ai astepta", async () => {
    const quiz = {
      isCompleted: () => false,
      placeholderRaspuns: globalThis.PlaceholderRaspuns.creeaza("?"),
      getFallSpeedFactor: () => 1,
      onTimeout: () => ({ ...RUNDA_VECHE, outcome: "round" }),
      onAnswer: () => {
        throw new Error("nu trebuia apelat — testul nu apasa niciun buton");
      },
      beginRound: () => RUNDA_VECHE,
    };
    const engine = new globalThis.FallingEngine({
      dom,
      getQuiz: () => quiz,
      showBanner: () => {},
      onProgressUpdate: () => {},
      onAttemptLogged: () => {},
    });
    engine.startRound(RUNDA_VECHE);
    const inainte = dom.topNumberEl.innerHTML;

    await asteapta(300);

    assert.equal(dom.topNumberEl.innerHTML, inainte, "fara apasare, ecranul nu se schimba");
  });
});

describe("Contractul vechi nu mai exista nicaieri in cod", () => {
  it("niciun fisier din js/ nu mai produce `promptHoldMs:` sau `continueStep:`", () => {
    // Garda mecanica, la fel ca cea de la contractul schimbarii de nivel: o
    // aserție pe COD, nu pe comportament. Un quiz nou copiat dupa un exemplu
    // vechi ar reintroduce tacit forma pe care tocmai am scos-o; asta o prinde
    // la `npm test`, nu la raportul userului.
    //
    // `falling-engine.js` e exclus: acolo cele doua nume apar DOAR in mesajul
    // de eroare care le respinge.
    const gasite = execSync(
      'grep -rn "promptHoldMs:\\|continueStep:" js/ --include=*.js || true',
      { cwd: rootDir, encoding: "utf8" }
    )
      .trim()
      .split("\n")
      .filter((linie) => linie && !linie.startsWith("js/falling-engine.js:"));

    assert.deepEqual(gasite, [], "campuri din contractul vechi, ramase in cod");
  });
});
