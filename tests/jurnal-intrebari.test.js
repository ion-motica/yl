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
  "raspuns_corect",
  "a_cata_apasare_pe_buton",
  "durata_raspuns_secunde",
  "fact",
  "quiz_id",
  "subquiz_id",
  "fact_id",
  "eq_form",
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
    raspuns_corect: true,
    a_cata_apasare_pe_buton: 1,
    durata_raspuns_secunde: 1.2,
    fact: "11*2=22",
    quiz_id: QUIZ_ID,
    subquiz_id: "base",
    fact_id: "mul:11*2=?",
    eq_form: "?*2=22",
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
      raspuns_corect: true,
      a_cata_apasare_pe_buton: 2,
      durata_raspuns_secunde: 1.24,
      fact: "11*2=22",
      quiz_id: QUIZ_ID,
      subquiz_id: "base",
      fact_id: "mul:11*2=?",
      eq_form: "?*2=22",
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

  it("raporteaza fiecare apasare, ignora timeout-ul si pastreaza timpul cumulat", () => {
    const entries = [];
    const quiz = setupQuiz(entries);
    let state = quiz.beginRound();
    const originalQuestionId = state.metadata.questionInstanceId;
    const wrongIndex = (state.correctIndex + 1) % state.options.length;
    const wrongAnswer = state.options[wrongIndex];
    const correctAnswer = state.options[state.correctIndex];
    const questionDisplayedAt = "2026-07-12T09:15:30.456Z";

    state = quiz.onAnswer(wrongIndex, { responseMs: 1234, questionDisplayedAt });
    assert.equal(state.metadata.questionInstanceId, originalQuestionId);
    assert.equal(entries.length, 1);

    state = quiz.onTimeout({ responseMs: 3000, questionDisplayedAt, timedOut: true });
    assert.equal(state.metadata.questionInstanceId, originalQuestionId);
    assert.equal(entries.length, 1);

    state = quiz.onAnswer(state.correctIndex, { responseMs: 4567, questionDisplayedAt });
    assert.equal(entries.length, 2);

    assert.deepEqual(Object.keys(entries[0]), CAMPURI);
    assert.equal(entries[0].data_ora_ro, "2026-07-12 12:15:30");
    assert.equal(entries[0].quiz_name, "T*/ 11-20 - v3 - train w eff si eq forms - jurnal");
    assert.equal(entries[0].subquiz_name, "Subquiz 1: baza");
    assert.equal(entries[0].intrebare, "?*2=22");
    assert.equal(entries[0].raspuns, String(wrongAnswer));
    assert.equal(entries[0].raspuns_corect, false);
    assert.equal(entries[0].a_cata_apasare_pe_buton, 1);
    assert.equal(entries[0].durata_raspuns_secunde, 1.2);
    assert.equal(entries[0].fact, "11*2=22");
    assert.equal(entries[0].quiz_id, QUIZ_ID);
    assert.equal(entries[0].subquiz_id, "base");
    assert.equal(entries[0].fact_id, "mul:11*2=?");
    assert.equal(entries[0].eq_form, "?*2=22");
    assert.deepEqual(entries[0].extra, {});

    assert.equal(entries[1].data_ora_ro, entries[0].data_ora_ro);
    assert.equal(entries[1].raspuns, String(correctAnswer));
    assert.equal(entries[1].raspuns_corect, true);
    assert.equal(entries[1].a_cata_apasare_pe_buton, 2);
    assert.equal(entries[1].durata_raspuns_secunde, 4.6);
    assert.notEqual(entries[1].extra, entries[0].extra);
  });

  it("nu activeaza jurnalul in quizul original", () => {
    const entries = [];
    setupQuiz(entries);
    const originalMeta = globalThis.QuizRegistry.get(
      "multiplication-1120-v3-train-eff-eq-forms"
    );
    const originalQuiz = originalMeta.create({ ...originalMeta, random: () => 0 });
    const state = originalQuiz.beginRound();

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

  it("raporteaza explicit numele si id-ul subquizurilor intensive", () => {
    const entries = [];
    const quiz = setupQuiz(entries);
    quiz.setSq2Config({ intensiveMode: "sbs", sbsAnswerFactor: true, sbsAnswerProduct: false });
    quiz.beginRound();
    const state = quiz.runArenaAction("sendCurrentFactToSq2");
    const questionDisplayedAt = "2026-07-12T09:15:30.456Z";

    quiz.onAnswer(state.correctIndex, { responseMs: 800, questionDisplayedAt });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].subquiz_id, "sq2EffSbs");
    assert.equal(entries[0].subquiz_name, "Subquiz 2: Intensiv SBS");
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

    records.push(completeEntry({ raspuns: "10", raspuns_corect: false }));
    liveListener();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(body.children.length, 2);
    assert.equal(status.textContent, "2 inregistrari");
  });
});
