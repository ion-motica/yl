import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
const QUIZ_ID = "multiplication-1120-v3-train-eff-eq-forms-jurnal";
const CAMPURI = [
  "data_ora_ro",
  "quiz_name",
  "subquiz_name",
  "intrebare",
  "raspuns",
  "a_raspuns_corect",
  "a_cata_apasare_pe_buton",
  "durata_raspuns_secunde",
  "fact",
  "quiz_id",
  "subquiz_id",
  "fact_id",
  "eq_form",
  "pozitie_buton_apasat_pt_raspuns",
  "valori_variante_de_raspuns",
  "valoare_raspuns_corect",
  "hints_aratate_pt_raspuns",
  "extra",
];

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  const runner = new Function("window", `${code}\n`);
  runner(globalThis);
}

function setupLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

function loadQuizScripts() {
  [
    "js/utils.js",
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/fact-catalog.js",
    "js/fact-window-sequencer.js",
    "js/eff/qf-generator.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js",
    "js/quizzes/multiplication-1120-v3-train-eff-eq-forms-jurnal.js",
  ].forEach(loadScript);
  globalThis.GameUtils.shuffle = (items) => [...items];
}

function setupQuiz(logEntries) {
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage();
  globalThis.JurnalIntrebari = {
    inregistreazaIntrebare(entry) {
      logEntries.push(entry);
      return Promise.resolve(entry);
    },
  };
  loadQuizScripts();
  const meta = globalThis.QuizRegistry.get(QUIZ_ID);
  return meta.create({ ...meta, random: () => 0 });
}

function setupFakeIndexedDb(records) {
  const storeNames = new Set();
  const database = {
    objectStoreNames: { contains: (name) => storeNames.has(name) },
    createObjectStore(name) {
      storeNames.add(name);
      return {};
    },
    transaction() {
      const transaction = {
        objectStore() {
          return {
            add(value) {
              records.push(value);
              queueMicrotask(() => transaction.oncomplete?.());
            },
          };
        },
      };
      return transaction;
    },
  };

  globalThis.indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.textContent = "";
  }

  appendChild(child) {
    if (child?.isFragment) {
      child.children.forEach((fragmentChild) => this.appendChild(fragmentChild));
      return child;
    }
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  click() {
    this.listeners.click?.();
  }
}

function findElement(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children ?? []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

function setupViewerIndexedDb(records) {
  const storeNames = new Set(["intrebari"]);
  const database = {
    objectStoreNames: { contains: (name) => storeNames.has(name) },
    createObjectStore(name) {
      storeNames.add(name);
      return {};
    },
    transaction() {
      return {
        objectStore() {
          return {
            getAll() {
              const request = {};
              queueMicrotask(() => {
                request.result = [...records];
                request.onsuccess?.();
              });
              return request;
            },
          };
        },
      };
    },
  };
  globalThis.indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onsuccess?.();
      });
      return request;
    },
  };
}

function completeEntry(overrides = {}) {
  return {
    data_ora_ro: "2026-07-12 12:15:30",
    quiz_name: "Quiz jurnal",
    subquiz_name: "Subquiz 1: baza",
    intrebare: "?*2=22",
    raspuns: "11",
    a_raspuns_corect: true,
    a_cata_apasare_pe_buton: 1,
    durata_raspuns_secunde: 1.2,
    fact: "11*2=22",
    quiz_id: QUIZ_ID,
    subquiz_id: "base",
    fact_id: "mul:11*2=?",
    eq_form: "?*2=22",
    pozitie_buton_apasat_pt_raspuns: 2,
    valori_variante_de_raspuns: ["10", "11", "12"],
    valoare_raspuns_corect: "11",
    hints_aratate_pt_raspuns: null,
    extra: {},
    ...overrides,
  };
}

describe("JurnalIntrebari", () => {
  beforeEach(() => {
    globalThis.window = globalThis;
    delete globalThis.JurnalIntrebari;
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.FactCatalog;
    delete globalThis.FactWindowSequencer;
    delete globalThis.QFGenerator;
    delete globalThis.ItemGenerator;
    delete globalThis.SubquizDefinition;
    delete globalThis.SubquizOrchestrator;
    delete globalThis.Mul1120V3TrainEffEqFormsQuiz;
    delete globalThis.document;
    delete globalThis.open;
    delete globalThis.location;
    delete globalThis.deschideVizualizareLogs;
    delete globalThis.deschideVizualizareLogsTranspuse;
    delete globalThis.BroadcastChannel;
    delete globalThis.scrollTo;
  });

  it("expune o singura metoda si salveaza numai contractul aprobat", async () => {
    const records = [];
    setupFakeIndexedDb(records);
    globalThis.BroadcastChannel = class {
      postMessage() {}
      close() {}
    };
    loadScript("js/jurnal-intrebari.js");

    const extra = {};
    const saved = await globalThis.JurnalIntrebari.inregistreazaIntrebare({
      data_ora_ro: "2026-07-12 12:15:30",
      quiz_name: "Quiz jurnal",
      subquiz_name: "Subquiz 1: baza",
      intrebare: "?*2=22",
      raspuns: "11",
      a_raspuns_corect: true,
      a_cata_apasare_pe_buton: 2,
      durata_raspuns_secunde: 1.24,
      fact: "11*2=22",
      quiz_id: QUIZ_ID,
      subquiz_id: "base",
      fact_id: "mul:11*2=?",
      eq_form: "?*2=22",
      pozitie_buton_apasat_pt_raspuns: 2,
      valori_variante_de_raspuns: ["10", "11", "12"],
      valoare_raspuns_corect: "11",
      hints_aratate_pt_raspuns: null,
      extra,
      camp_neaprobat: "ignorat",
    });

    assert.deepEqual(Object.keys(globalThis.JurnalIntrebari), ["inregistreazaIntrebare"]);
    assert.equal(records.length, 1);
    assert.equal(saved, records[0]);
    assert.deepEqual(Object.keys(saved), CAMPURI);
    assert.equal(saved.durata_raspuns_secunde, 1.2);
    assert.notEqual(saved.extra, extra);
    assert.equal("camp_neaprobat" in saved, false);
  });

  it("quizul furnizeaza contextul semantic fara sa apeleze direct jurnalul", () => {
    const entries = [];
    const quiz = setupQuiz(entries);
    const state = quiz.beginRound();
    const context = quiz.getContextJurnal(state);

    assert.deepEqual(context, {
      quiz_name: "T*/ 11-20 - v3 - train w eff si eq forms - jurnal",
      subquiz_name: "Subquiz 1: baza",
      intrebare: "?*2=22",
      fact: "11*2=22",
      quiz_id: QUIZ_ID,
      subquiz_id: "base",
      fact_id: "mul:11*2=?",
      eq_form: "?*2=22",
      hints_aratate_pt_raspuns: null,
      extra: {},
    });

    quiz.onAnswer(state.correctIndex, {
      responseMs: 800,
      questionDisplayedAt: "2026-07-12T09:15:30.456Z",
    });
    assert.equal(entries.length, 0);
  });

  it("nu activeaza jurnalul cand jurnalIntrebariActiv nu e setat", () => {
    const entries = [];
    setupQuiz(entries);
    const originalQuiz = globalThis.Mul1120V3TrainEffEqFormsQuiz.create({ random: () => 0 });
    const state = originalQuiz.beginRound();

    assert.equal(originalQuiz.getContextJurnal(state), null);

    originalQuiz.onAnswer(state.correctIndex, {
      responseMs: 800,
      questionDisplayedAt: "2026-07-12T09:15:30.456Z",
    });

    assert.equal(entries.length, 0);
  });

  it("adauga in CP butonul Afisare log si deschide vizualizarea intr-un tab nou", () => {
    const entries = [];
    const quiz = setupQuiz(entries);
    const mount = new FakeElement();
    let opened = null;
    globalThis.document = {
      createElement: (tagName) => new FakeElement(tagName),
      createTextNode: (text) => ({ textContent: text, children: [] }),
    };
    globalThis.location = { href: "http://127.0.0.1:5173/index.html?quiz=test" };
    globalThis.open = (url, target) => {
      opened = { url, target };
    };

    quiz.appendSq2ControlPanel(mount);
    const button = findElement(
      mount,
      (element) => element.tagName === "BUTTON" && element.textContent === "Afisare log"
    );
    assert.ok(button);
    button.click();
    assert.deepEqual(opened, {
      url: "http://127.0.0.1:5173/jurnal-intrebari.html",
      target: "_blank",
    });
  });

  it("adauga separat butonul Tabulator si apeleaza API-ul public al vizualizarii", () => {
    const entries = [];
    const quiz = setupQuiz(entries);
    const mount = new FakeElement();
    let apeluri = 0;
    globalThis.document = {
      createElement: (tagName) => new FakeElement(tagName),
      createTextNode: (text) => ({ textContent: text, children: [] }),
    };
    globalThis.deschideVizualizareLogs = () => {
      apeluri += 1;
    };

    quiz.appendSq2ControlPanel(mount);
    const button = findElement(
      mount,
      (element) =>
        element.tagName === "BUTTON" && element.textContent === "View logs in Tabulator"
    );

    assert.ok(button);
    button.click();
    assert.equal(apeluri, 1);
  });

  it("adauga butonul Tabulator Transposed si apeleaza API-ul lui public", () => {
    const entries = [];
    const quiz = setupQuiz(entries);
    const mount = new FakeElement();
    let apeluri = 0;
    globalThis.document = {
      createElement: (tagName) => new FakeElement(tagName),
      createTextNode: (text) => ({ textContent: text, children: [] }),
    };
    globalThis.deschideVizualizareLogsTranspuse = () => {
      apeluri += 1;
    };

    quiz.appendSq2ControlPanel(mount);
    const button = findElement(
      mount,
      (element) =>
        element.tagName === "BUTTON" &&
        element.textContent === "View logs in Tabulator - Transposed"
    );

    assert.ok(button);
    button.click();
    assert.equal(apeluri, 1);
  });

  it("raporteaza explicit numele si id-ul subquizurilor intensive", () => {
    const entries = [];
    const quiz = setupQuiz(entries);
    quiz.setSq2Config({ intensiveMode: "sbs", sbsAnswerFactor: true, sbsAnswerProduct: false });
    quiz.beginRound();
    const state = quiz.runArenaAction("sendCurrentFactToSq2");
    const questionDisplayedAt = "2026-07-12T09:15:30.456Z";

    const context = quiz.getContextJurnal(state);

    assert.equal(context.subquiz_id, "sq2EffSbs");
    assert.equal(context.subquiz_name, "Subquiz 2: Intensiv SBS");
    quiz.onAnswer(state.correctIndex, { responseMs: 800, questionDisplayedAt });
    assert.equal(entries.length, 0);
  });

  it("tabelul afiseaza toate coloanele si se actualizeaza la mesajul live", async () => {
    const records = [completeEntry()];
    const head = new FakeElement("thead");
    const body = new FakeElement("tbody");
    const status = new FakeElement("span");
    const scrollContainer = new FakeElement("main");
    scrollContainer.scrollHeight = 100;
    scrollContainer.scrollTo = () => {};
    let liveListener = null;
    setupViewerIndexedDb(records);
    globalThis.document = {
      body: { scrollHeight: 100 },
      querySelector(selector) {
        return {
          "#jurnal-head": head,
          "#jurnal-body": body,
          "#jurnal-status": status,
          "#jurnal-scroll": scrollContainer,
        }[selector];
      },
      createElement: (tagName) => new FakeElement(tagName),
      createDocumentFragment() {
        const fragment = new FakeElement("fragment");
        fragment.isFragment = true;
        return fragment;
      },
    };
    globalThis.scrollTo = () => {};
    globalThis.BroadcastChannel = class {
      addEventListener(type, listener) {
        if (type === "message") liveListener = listener;
      }
    };

    loadScript("js/jurnal-intrebari-viewer.js");
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(head.children[0].children.map((cell) => cell.textContent), CAMPURI);
    assert.equal(body.children.length, 1);
    assert.equal(status.textContent, "1 inregistrari");

    records.push(completeEntry({ raspuns: "10", a_raspuns_corect: false }));
    liveListener();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(body.children.length, 2);
    assert.equal(status.textContent, "2 inregistrari");
  });
});
