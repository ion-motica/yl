import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readFileSync } from "node:fs";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
const CAMPURI_DETECTATE = [
  "indexeddb_key",
  "data_ora_ro",
  "intrebare",
  "camp_numar_nou",
  "camp_boolean_nou",
  "camp_obiect_nou",
  "camp_null_nou",
];

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.hidden = false;
    this.id = "";
    this.className = "";
    this.textContent = "";
    const clase = new Set();
    this.classList = {
      toggle: (nume, activa) => {
        if (activa) clase.add(nume);
        else clase.delete(nume);
      },
      contains: (nume) => clase.has(nume),
    };
  }

  appendChild(child) {
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

  addEventListener(type, listener) {
    this.listeners[type] ||= [];
    this.listeners[type].push(listener);
  }

  dispatch(type) {
    const event = { stopPropagation() {} };
    (this.listeners[type] || []).forEach((listener) => listener(event));
  }

  click() {
    this.dispatch("click");
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  querySelector(selector) {
    if (selector.startsWith("#") && this.id === selector.slice(1)) return this;
    for (const child of this.children) {
      const found = child?.querySelector?.(selector);
      if (found) return found;
    }
    return null;
  }
}

function findElement(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

function setupIndexedDb(inregistrari) {
  const bazaDate = {
    objectStoreNames: { contains: (nume) => nume === "intrebari" },
    close() {},
    transaction() {
      const tranzactie = {
        objectStore() {
          return {
            openCursor(_interval, directie) {
              assert.equal(directie, "next");
              const cerere = {};
              let index = 0;
              const continua = () => {
                queueMicrotask(() => {
                  if (index >= inregistrari.length) {
                    cerere.result = null;
                  } else {
                    const intrare = inregistrari[index];
                    cerere.result = {
                      primaryKey: intrare.cheie,
                      value: intrare.valoare,
                      continue() {
                        index += 1;
                        continua();
                      },
                    };
                  }
                  cerere.onsuccess?.();
                });
              };
              continua();
              return cerere;
            },
          };
        },
      };
      return tranzactie;
    },
  };

  globalThis.indexedDB = {
    open(nume) {
      assert.equal(nume, "youlearn_jurnal_intrebari");
      const cerere = {};
      queueMicrotask(() => {
        cerere.result = bazaDate;
        cerere.onsuccess?.();
      });
      return cerere;
    },
  };
}

class FakeTabulator {
  static instances = [];

  constructor(element, options) {
    this.element = element;
    this.options = options;
    this.data = options.data;
    this.replaceDataCalls = 0;
    this.redrawCalls = 0;
    this.setColumnsCalls = 0;
    this.configureazaColoane(options.columns);
    FakeTabulator.instances.push(this);
  }

  configureazaColoane(coloane) {
    this.options.columns = coloane;
    this.coloane = new Map(
      coloane.map((definitie) => {
        const element = new FakeElement();
        const componenta = {
          vizibila: true,
          latime: 180,
          hide() {
            this.vizibila = false;
          },
          show() {
            this.vizibila = true;
          },
          isVisible() {
            return this.vizibila;
          },
          getWidth() {
            return this.latime;
          },
          setWidth(latime) {
            this.latime = latime;
          },
          getElement() {
            return element;
          },
        };
        return [definitie.field, componenta];
      })
    );
  }

  setColumns(coloane) {
    this.setColumnsCalls += 1;
    this.configureazaColoane(coloane);
  }

  getColumn(camp) {
    return this.coloane.get(camp);
  }

  replaceData(inregistrari) {
    this.replaceDataCalls += 1;
    this.data = inregistrari;
    return Promise.resolve();
  }

  redraw() {
    this.redrawCalls += 1;
    this.coloane.forEach((coloana) => {
      coloana.latime = 180;
    });
  }

  destroy() {}
}

function incarcaVizualizarea(root) {
  globalThis.window = globalThis;
  globalThis.Tabulator = FakeTabulator;
  globalThis.location = { href: "http://127.0.0.1:8770/index.html" };
  globalThis.open = () => null;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => (id === "vizualizare-logs-root" ? root : root.querySelector(`#${id}`)),
  };
  const code = readFileSync(`${rootDir}/Vizualizare logs/vizualizare-logs.js`, "utf8");
  new Function("window", code)(globalThis);
}

function asteaptaEvenimente() {
  return new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
  FakeTabulator.instances.length = 0;
  delete globalThis.Tabulator;
  delete globalThis.indexedDB;
  delete globalThis.document;
  delete globalThis.location;
  delete globalThis.open;
  delete globalThis.deschideVizualizareLogs;
});

it("citeste cursorul in ordinea cheilor si configureaza toate coloanele read-only", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-root";
  setupIndexedDb([
    {
      cheie: 4,
      valoare: {
        data_ora_ro: "2026-07-12 18:57:40",
        intrebare: "2+2",
        camp_numar_nou: 7,
        camp_boolean_nou: true,
        camp_obiect_nou: { mod: "test" },
        camp_null_nou: null,
      },
    },
    {
      cheie: 9,
      valoare: {
        data_ora_ro: "2026-07-12 18:58:10",
        intrebare: "3+3",
        camp_numar_nou: 8,
        camp_boolean_nou: false,
        camp_obiect_nou: { mod: "normal" },
        camp_null_nou: null,
      },
    },
  ]);
  incarcaVizualizarea(root);
  await asteaptaEvenimente();
  await asteaptaEvenimente();

  assert.equal(FakeTabulator.instances.length, 1);
  const tabel = FakeTabulator.instances[0];
  assert.deepEqual(tabel.data.map((rand) => rand.indexeddb_key), [4, 9]);
  assert.deepEqual(tabel.options.columns.map((coloana) => coloana.field), CAMPURI_DETECTATE);
  assert.equal(tabel.options.movableColumns, true);
  assert.equal(tabel.options.height, "100%");
  assert.equal(tabel.options.columns.every((coloana) => coloana.resizable === true), true);
  assert.equal(tabel.options.columns.some((coloana) => "editor" in coloana), false);
  assert.equal(
    tabel.options.columns.find((coloana) => coloana.field === "camp_numar_nou").sorter,
    "number"
  );
  assert.equal(
    tabel.options.columns.find((coloana) => coloana.field === "camp_boolean_nou").sorter,
    "boolean"
  );
  assert.equal(
    typeof tabel.options.columns.find((coloana) => coloana.field === "camp_obiect_nou").sorter,
    "function"
  );
  assert.equal(
    tabel.options.columns.find((coloana) => coloana.field === "camp_null_nou").sorter,
    "string"
  );
  assert.ok(
    findElement(
      root,
      (element) => element.tagName === "INPUT" && element.dataset.camp === "camp_numar_nou"
    )
  );
});

it("pastreaza toate coloanele minimizate cand alta coloana este comutata", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-root";
  setupIndexedDb([
    { cheie: 1, valoare: { intrebare: "2+2", raspuns: "4", extra: {} } },
  ]);
  incarcaVizualizarea(root);
  await asteaptaEvenimente();
  await asteaptaEvenimente();

  const tabel = FakeTabulator.instances[0];
  const definitieIntrebare = tabel.options.columns.find(
    (definitie) => definitie.field === "intrebare"
  );
  const definitieRaspuns = tabel.options.columns.find(
    (definitie) => definitie.field === "raspuns"
  );
  const antetIntrebare = definitieIntrebare.titleFormatter();
  antetIntrebare.children[1].click();
  assert.equal(tabel.getColumn("intrebare").isVisible(), true);
  assert.equal(tabel.getColumn("intrebare").getWidth(), 36);
  assert.equal(antetIntrebare.classList.contains("is-minimizata"), true);
  assert.equal(antetIntrebare.children[0].classList.contains("is-minimizat"), true);
  assert.equal(antetIntrebare.children[1].textContent, "+");
  assert.equal(
    tabel.getColumn("intrebare").getElement().classList.contains("vizualizare-logs-coloana-minimizata"),
    true
  );
  assert.equal(tabel.redrawCalls, 1);

  const antetRaspuns = definitieRaspuns.titleFormatter();
  antetRaspuns.children[1].click();
  assert.equal(tabel.getColumn("intrebare").getWidth(), 36);
  assert.equal(tabel.getColumn("raspuns").getWidth(), 36);
  assert.equal(tabel.redrawCalls, 2);

  const checkbox = findElement(
    root,
    (element) => element.tagName === "INPUT" && element.dataset.camp === "intrebare"
  );
  assert.equal(checkbox.checked, true);

  const antetIntrebareMinimizat = definitieIntrebare.titleFormatter();
  antetIntrebareMinimizat.children[1].click();
  assert.equal(tabel.getColumn("intrebare").getWidth(), 180);
  assert.equal(tabel.getColumn("raspuns").getWidth(), 36);
  assert.equal(antetIntrebareMinimizat.classList.contains("is-minimizata"), false);
  assert.equal(antetIntrebareMinimizat.children[1].textContent, "-");
  assert.equal(
    tabel.getColumn("intrebare").getElement().classList.contains("vizualizare-logs-coloana-minimizata"),
    false
  );
  assert.equal(tabel.redrawCalls, 3);

  const antetIntrebareRestaurat = definitieIntrebare.titleFormatter();
  antetIntrebareRestaurat.children[1].click();
  assert.equal(tabel.getColumn("intrebare").getWidth(), 36);
  assert.equal(tabel.getColumn("raspuns").getWidth(), 36);
  assert.equal(tabel.redrawCalls, 4);

  await globalThis.deschideVizualizareLogs({ container: root });
  assert.equal(FakeTabulator.instances.length, 1);
  assert.equal(tabel.replaceDataCalls, 1);
});

it("reconstruieste automat coloanele cand schema curenta se schimba", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-root";
  const inregistrari = [{ cheie: 1, valoare: { intrebare: "2+2" } }];
  setupIndexedDb(inregistrari);
  incarcaVizualizarea(root);
  await asteaptaEvenimente();
  await asteaptaEvenimente();

  const tabel = FakeTabulator.instances[0];
  assert.deepEqual(
    tabel.options.columns.map((coloana) => coloana.field),
    ["indexeddb_key", "intrebare"]
  );

  inregistrari[0].valoare.camp_nou = 42;
  await globalThis.deschideVizualizareLogs({ container: root });

  assert.equal(tabel.setColumnsCalls, 1);
  assert.deepEqual(
    tabel.options.columns.map((coloana) => coloana.field),
    ["indexeddb_key", "intrebare", "camp_nou"]
  );
  assert.equal(tabel.options.columns.find((coloana) => coloana.field === "camp_nou").sorter, "number");
});

it("deschide pagina Tabulator separata cand API-ul este apelat din aplicatie", () => {
  const deschideri = [];
  globalThis.window = globalThis;
  globalThis.location = { href: "http://127.0.0.1:8770/index.html?quiz=test" };
  globalThis.open = (url, target) => {
    deschideri.push({ url, target });
  };
  globalThis.document = {
    getElementById: () => null,
  };
  const code = readFileSync(`${rootDir}/Vizualizare logs/vizualizare-logs.js`, "utf8");
  new Function("window", code)(globalThis);

  globalThis.deschideVizualizareLogs();

  assert.deepEqual(deschideri, [
    {
      url: "http://127.0.0.1:8770/Vizualizare%20logs/vizualizare-logs.html",
      target: "youlearn-vizualizare-logs-tabulator",
    },
  ]);
});

it("afiseaza mesaj clar si nu creeaza tabel cand baza nu exista", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-root";
  globalThis.indexedDB = {
    open() {
      const cerere = {};
      queueMicrotask(() => {
        cerere.transaction = { abort() {} };
        cerere.onupgradeneeded?.();
        cerere.error = { name: "AbortError" };
        cerere.onerror?.();
      });
      return cerere;
    },
  };
  incarcaVizualizarea(root);
  await asteaptaEvenimente();

  assert.equal(FakeTabulator.instances.length, 0);
  assert.equal(
    root.querySelector("#vizualizare-logs-mesaj").textContent,
    "Nu exista inca jurnalul de intrebari."
  );
});

it("afiseaza jurnal gol fara sa inventeze coloane", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-root";
  setupIndexedDb([]);
  incarcaVizualizarea(root);
  await asteaptaEvenimente();

  assert.equal(FakeTabulator.instances.length, 0);
  assert.equal(root.querySelector("#vizualizare-logs-mesaj").textContent, "Jurnalul este gol.");
});
