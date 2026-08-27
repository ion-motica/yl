import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAMPURI_DETECTATE = [
  "indexeddb_key",
  "data_ora_ro",
  "intrebare",
  "camp_nou",
  "extra",
];

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = {};
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
    this.columns = options.columns;
    this.replaceDataCalls = 0;
    this.setColumnsCalls = 0;
    FakeTabulator.instances.push(this);
  }

  setColumns(coloane) {
    this.setColumnsCalls += 1;
    this.columns = coloane;
  }

  replaceData(randuri) {
    this.replaceDataCalls += 1;
    this.data = randuri;
    return Promise.resolve();
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
    getElementById: (id) =>
      id === "vizualizare-logs-transpusa-root" ? root : root.querySelector(`#${id}`),
  };
  const code = readFileSync(
    `${rootDir}/Vizualizare logs/vizualizare-logs-transpusa.js`,
    "utf8"
  );
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
  delete globalThis.deschideVizualizareLogsTranspuse;
});

it("transpune campurile in randuri si pastreaza logurile in ordinea IndexedDB", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-transpusa-root";
  setupIndexedDb([
    {
      cheie: 4,
      valoare: {
        data_ora_ro: "2026-07-12 18:57:40",
        intrebare: "2+2",
        camp_nou: "prima valoare",
        extra: {},
      },
    },
    {
      cheie: 9,
      valoare: {
        data_ora_ro: "2026-07-12 18:58:10",
        intrebare: "3+3",
        camp_nou: "a doua valoare",
        extra: { mod: "test" },
      },
    },
  ]);
  incarcaVizualizarea(root);
  await asteaptaEvenimente();
  await asteaptaEvenimente();

  assert.equal(FakeTabulator.instances.length, 1);
  const tabel = FakeTabulator.instances[0];
  assert.deepEqual(
    tabel.data.map((rand) => rand.camp),
    CAMPURI_DETECTATE
  );
  assert.deepEqual(
    tabel.columns.map((coloana) => coloana.field),
    ["camp", "inregistrare_0", "inregistrare_1"]
  );
  assert.deepEqual(
    tabel.data.find((rand) => rand.camp === "indexeddb_key"),
    { camp: "indexeddb_key", minimizat: false, inregistrare_0: 4, inregistrare_1: 9 }
  );
  assert.deepEqual(
    tabel.data.find((rand) => rand.camp === "intrebare"),
    { camp: "intrebare", minimizat: false, inregistrare_0: "2+2", inregistrare_1: "3+3" }
  );
  assert.deepEqual(
    tabel.data.find((rand) => rand.camp === "camp_nou"),
    {
      camp: "camp_nou",
      minimizat: false,
      inregistrare_0: "prima valoare",
      inregistrare_1: "a doua valoare",
    }
  );
  assert.equal(tabel.options.movableRows, true);
  assert.equal(tabel.options.rowHeader.rowHandle, true);
  assert.equal(tabel.options.rowHeader.formatter, "handle");
  assert.equal(tabel.columns.slice(1).every((coloana) => coloana.resizable === true), true);
  assert.equal(findElement(root, (element) => element.tagName === "INPUT"), null);
  assert.match(readFileSync(`${rootDir}/index.html`, "utf8"), /vizualizare-logs-transpusa\.js/);
});

it("minimizarea ascunde doar continutul si pastreaza randul cu celulele lui", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-transpusa-root";
  setupIndexedDb([{ cheie: 1, valoare: { intrebare: "2+2", extra: {} } }]);
  incarcaVizualizarea(root);
  await asteaptaEvenimente();
  await asteaptaEvenimente();

  const tabel = FakeTabulator.instances[0];
  const dateRand = tabel.data.find((rand) => rand.camp === "intrebare");
  const elementRand = new FakeElement();
  let reformatari = 0;
  const rand = {
    getData: () => dateRand,
    getElement: () => elementRand,
    update(modificari) {
      Object.assign(dateRand, modificari);
      return Promise.resolve();
    },
    reformat() {
      reformatari += 1;
    },
  };
  const coloanaCamp = tabel.columns[0];
  const coloanaValoare = tabel.columns[1];
  const celulaCamp = { getRow: () => rand };
  const celulaValoare = {
    getRow: () => rand,
    getValue: () => dateRand.inregistrare_0,
  };

  assert.equal(coloanaValoare.formatter(celulaValoare), "2+2");
  const continutCamp = coloanaCamp.formatter(celulaCamp);
  assert.equal(continutCamp.children[0].textContent, "intrebare");
  assert.equal(continutCamp.children[1].textContent, "-");
  continutCamp.children[1].click();
  await Promise.resolve();

  assert.equal(dateRand.minimizat, true);
  assert.equal(dateRand.inregistrare_0, "2+2");
  assert.equal(tabel.columns.length, 2);
  assert.equal(coloanaValoare.formatter(celulaValoare), "");
  assert.equal(
    elementRand.classList.contains("vizualizare-logs-transpusa-rand-minimizat"),
    true
  );
  assert.equal(reformatari, 1);

  const continutMinimizat = coloanaCamp.formatter(celulaCamp);
  assert.equal(continutMinimizat.children[1].textContent, "+");
  continutMinimizat.children[1].click();
  await Promise.resolve();
  assert.equal(dateRand.minimizat, false);
  assert.equal(coloanaValoare.formatter(celulaValoare), "2+2");
});

it("adauga automat un rand cand schema curenta se schimba", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-transpusa-root";
  const inregistrari = [{ cheie: 1, valoare: { intrebare: "2+2" } }];
  setupIndexedDb(inregistrari);
  incarcaVizualizarea(root);
  await asteaptaEvenimente();
  await asteaptaEvenimente();

  const tabel = FakeTabulator.instances[0];
  assert.deepEqual(
    tabel.data.map((rand) => rand.camp),
    ["indexeddb_key", "intrebare"]
  );

  inregistrari[0].valoare.camp_nou = "valoare noua";
  await globalThis.deschideVizualizareLogsTranspuse({ container: root });

  assert.equal(tabel.replaceDataCalls, 1);
  assert.deepEqual(
    tabel.data.map((rand) => rand.camp),
    ["indexeddb_key", "intrebare", "camp_nou"]
  );
  assert.equal(tabel.data.find((rand) => rand.camp === "camp_nou").inregistrare_0, "valoare noua");
});

it("deschide pagina transposed intr-un tab separat cand API-ul este apelat din aplicatie", () => {
  const deschideri = [];
  globalThis.window = globalThis;
  globalThis.location = { href: "http://127.0.0.1:8770/index.html?quiz=test" };
  globalThis.open = (url, target) => {
    deschideri.push({ url, target });
  };
  globalThis.document = { getElementById: () => null };
  const code = readFileSync(
    `${rootDir}/Vizualizare logs/vizualizare-logs-transpusa.js`,
    "utf8"
  );
  new Function("window", code)(globalThis);

  globalThis.deschideVizualizareLogsTranspuse();

  assert.deepEqual(deschideri, [
    {
      url: "http://127.0.0.1:8770/Vizualizare%20logs/vizualizare-logs-transpusa.html",
      target: "youlearn-vizualizare-logs-tabulator-transposed",
    },
  ]);
});

it("afiseaza jurnal gol fara sa inventeze randuri", async () => {
  const root = new FakeElement();
  root.id = "vizualizare-logs-transpusa-root";
  setupIndexedDb([]);
  incarcaVizualizarea(root);
  await asteaptaEvenimente();

  assert.equal(FakeTabulator.instances.length, 0);
  assert.equal(root.querySelector("#vizualizare-logs-mesaj").textContent, "Jurnalul este gol.");
});
