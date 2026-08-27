import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.hidden = false;
    this.textContent = "";
    this.value = "";
    this.selectat = false;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  replaceChildren(...children) {
    this.children = children;
  }

  addEventListener(type, listener) {
    this.listeners[type] ||= [];
    this.listeners[type].push(listener);
  }

  click() {
    const event = { stopPropagation() {} };
    return Promise.all((this.listeners.click || []).map((listener) => listener(event)));
  }

  focus() {}

  select() {
    this.selectat = true;
  }
}

class FakeColumn {
  constructor(field, { visible = true, width = 180 } = {}) {
    this.field = field;
    this.visible = visible;
    this.width = width;
  }

  getField() {
    return this.field;
  }

  isVisible() {
    return this.visible;
  }

  getWidth() {
    return this.width;
  }
}

class FakeTable {
  constructor(coloane) {
    this.coloane = coloane;
    this.filtreAntet = [];
    this.filtre = [];
    this.sortari = [];
    this.layoutAplicat = null;
    this.clearFilterArgument = null;
  }

  getColumns() {
    return this.coloane;
  }

  getHeaderFilters() {
    return this.filtreAntet;
  }

  getFilters() {
    return this.filtre;
  }

  getSorters() {
    return this.sortari;
  }

  setColumnLayout(layout) {
    this.layoutAplicat = layout;
    const dupaCamp = new Map(this.coloane.map((coloana) => [coloana.field, coloana]));
    this.coloane = layout.map((stare) => {
      const coloana = dupaCamp.get(stare.field);
      coloana.visible = stare.visible;
      coloana.width = stare.width;
      return coloana;
    });
  }

  clearFilter(includeAntet) {
    this.clearFilterArgument = includeAntet;
    this.filtre = [];
    if (includeAntet) this.filtreAntet = [];
  }

  setHeaderFilterValue(field, value) {
    this.filtreAntet.push({ field, value });
  }

  setFilter(filtre) {
    this.filtre = filtre;
  }

  setSort(sortari) {
    this.sortari = sortari;
  }

  clearSort() {
    this.sortari = [];
  }
}

function incarcaModul() {
  globalThis.window = globalThis;
  globalThis.document = { createElement: (tagName) => new FakeElement(tagName) };
  const code = readFileSync(
    `${rootDir}/Vizualizare logs/vizualizare-logs-preseturi.js`,
    "utf8"
  );
  new Function("window", code)(globalThis);
  return globalThis.VizualizareLogsPreseturi;
}

function gasesteElement(root, conditie) {
  if (conditie(root)) return root;
  for (const child of root.children || []) {
    const gasit = gasesteElement(child, conditie);
    if (gasit) return gasit;
  }
  return null;
}

afterEach(() => {
  delete globalThis.VizualizareLogsPreseturi;
  delete globalThis.document;
  delete globalThis.navigator;
});

it("expune presetul Preview numai ca date declarative", () => {
  const api = incarcaModul();

  assert.equal(api.grupe.length, 1);
  assert.equal(api.grupe[0].nume, "Preview");
  assert.equal(api.grupe[0].preseturi[0].nume, "Preset 2");
  assert.equal(api.grupe[0].preseturi[0].coloane.length, 19);
  assert.deepEqual(api.grupe[0].preseturi[0].filtre, [
    { tip: "antet", camp: "a_cata_apasare_pe_buton", valoare: "1" },
  ]);
  assert.deepEqual(api.grupe[0].preseturi[0].sortari, [
    { camp: "data_ora_ro", directie: "desc" },
    { camp: "eq_form", directie: "asc" },
    { camp: "fact", directie: "asc" },
  ]);
  assert.doesNotMatch(JSON.stringify(api.grupe), /function/);
});

it("citeste starea curenta in formatul declarativ unic", () => {
  const api = incarcaModul();
  const tabel = new FakeTable([
    new FakeColumn("fact", { width: 36 }),
    new FakeColumn("data_ora_ro", { visible: false, width: 170 }),
  ]);
  tabel.filtreAntet = [{ field: "fact", type: "like", value: "2*" }];
  tabel.filtre = [{ field: "data_ora_ro", type: ">=", value: "2026-07-01" }];
  tabel.sortari = [{ field: "data_ora_ro", dir: "desc", column: {} }];

  const preset = api.citestePresetCurent({
    tabel,
    nume: "Manual",
    latimiColoaneMinimizate: new Map([["fact", 240]]),
  });

  assert.deepEqual(preset, {
    versiune: 1,
    nume: "Manual",
    coloane: [
      { camp: "fact", vizibila: true, latime: 240, minimizata: true },
      { camp: "data_ora_ro", vizibila: false, latime: 170, minimizata: false },
    ],
    filtre: [
      { tip: "antet", camp: "fact", valoare: "2*" },
      { tip: "camp", camp: "data_ora_ro", operator: ">=", valoare: "2026-07-01" },
    ],
    sortari: [{ camp: "data_ora_ro", directie: "desc" }],
  });
});

it("aplica starea finala, ignora campurile lipsa si pastreaza campurile noi", () => {
  const api = incarcaModul();
  const tabel = new FakeTable([
    new FakeColumn("camp_nou", { width: 36 }),
    new FakeColumn("fact"),
    new FakeColumn("data_ora_ro"),
  ]);
  const latimiMinimizate = new Map([["camp_nou", 190]]);
  let finalizari = 0;

  api.aplicaPreset({
    tabel,
    latimiColoaneMinimizate: latimiMinimizate,
    latimeColoanaMinimizata: 36,
    dupaAplicareColoane: () => {
      finalizari += 1;
    },
    preset: {
      nume: "Fact",
      coloane: [
        { camp: "data_ora_ro", vizibila: false, latime: 150 },
        { camp: "lipsa", vizibila: true, latime: 100 },
        { camp: "fact", vizibila: true, latime: 220, minimizata: true },
      ],
      filtre: [
        { tip: "antet", camp: "data_ora_ro", valoare: "2026" },
        { tip: "primul_factor_in", camp: "fact", valori: [1, 2] },
        { tip: "camp", camp: "lipsa", operator: "=", valoare: 1 },
      ],
      sortari: [
        { camp: "fact", directie: "desc" },
        { camp: "lipsa", directie: "asc" },
      ],
    },
  });

  assert.deepEqual(tabel.layoutAplicat, [
    { field: "data_ora_ro", visible: false, width: 150 },
    { field: "fact", visible: true, width: 36 },
    { field: "camp_nou", visible: true, width: 190 },
  ]);
  assert.deepEqual([...latimiMinimizate], [["fact", 220]]);
  assert.equal(finalizari, 1);
  assert.equal(tabel.clearFilterArgument, true);
  assert.deepEqual(tabel.filtreAntet, [{ field: "data_ora_ro", value: "2026" }]);
  assert.equal(tabel.filtre.length, 1);
  assert.equal(typeof tabel.filtre[0], "function");
  assert.equal(tabel.filtre[0]({ fact: "1*9=9" }), true);
  assert.equal(tabel.filtre[0]({ fact: "3*2=6" }), false);
  assert.deepEqual(tabel.sortari, [{ column: "fact", dir: "desc" }]);
});

it("rendererul aplica preseturi si copiaza starea curenta in clipboard", async () => {
  const api = incarcaModul();
  const element = new FakeElement();
  const texteCopiate = [];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (text) => texteCopiate.push(text) } },
  });
  let presetAplicat = null;

  api.randeazaPreseturi({
    element,
    grupe: [{ nume: "Grupa", preseturi: [{ nume: "Cronologic", coloane: [] }] }],
    laAplicarePreset: (preset) => {
      presetAplicat = preset;
    },
    laCitirePreset: (nume) => ({
      versiune: 1,
      nume,
      coloane: [],
      filtre: [],
      sortari: [],
    }),
  });

  assert.ok(
    gasesteElement(
      element,
      (item) =>
        item.textContent ===
        "Click = sortare simpla. Shift + click = adauga sortarea la cele existente."
    )
  );

  await gasesteElement(element, (item) => item.textContent === "Cronologic").click();
  assert.equal(presetAplicat.nume, "Cronologic");

  gasesteElement(element, (item) => item.placeholder === "Numele presetului").value =
    "Preset clipboard";
  await gasesteElement(
    element,
    (item) => item.textContent === "Save current view as preset"
  ).click();
  assert.equal(texteCopiate.length, 1);
  assert.equal(JSON.parse(texteCopiate[0]).nume, "Preset clipboard");
  assert.equal(
    gasesteElement(element, (item) => item.textContent === "Preset copiat in clipboard.")
      .textContent,
    "Preset copiat in clipboard."
  );
});
