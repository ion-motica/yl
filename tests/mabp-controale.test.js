import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { creeazaGrupOptiuni } from "../Vizualizare si interpretare logs/mabp-controale.js";

class ElementMinimal {
  constructor(tagName, documentRef) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = documentRef;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.id = "";
    this.type = "";
    this.name = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
  }

  append(...copii) {
    this.children.push(...copii);
  }

  setAttribute(nume, valoare) {
    this.attributes[nume] = String(valoare);
  }

  removeAttribute(nume) {
    delete this.attributes[nume];
  }

  getAttribute(nume) {
    return this.attributes[nume] ?? null;
  }

  addEventListener(tip, listener) {
    this.listeners[tip] ||= [];
    this.listeners[tip].push(listener);
  }

  dispatch(tip) {
    for (const listener of this.listeners[tip] || []) {
      listener({ type: tip, target: this });
    }
  }
}

class DocumentMinimal {
  constructor() {
    this.elemente = [];
  }

  createElement(tagName) {
    const element = new ElementMinimal(tagName, this);
    this.elemente.push(element);
    return element;
  }

  getElementById(id) {
    return this.elemente.find((element) => element.id === id) || null;
  }
}

function pregatesteDOM() {
  const documentRef = new DocumentMinimal();
  return { documentRef, container: documentRef.createElement("div") };
}

function cauta(element, predicat) {
  const rezultate = predicat(element) ? [element] : [];
  for (const copil of element.children) {
    rezultate.push(...cauta(copil, predicat));
  }
  return rezultate;
}

function texteDin(element) {
  return [
    element.textContent,
    ...element.children.flatMap((copil) => texteDin(copil)),
  ].filter(Boolean);
}

const optiuniMod = [
  { id: "stare", eticheta: "Stare curentă" },
  { id: "directie", eticheta: "Direcție", descriere: "Compară două ferestre." },
  { id: "exploratoriu", eticheta: "Exploratoriu" },
];

describe("creeazaGrupOptiuni", () => {
  it("randeaza selectia unica drept radio-uri native in acelasi fieldset", () => {
    const { documentRef, container } = pregatesteDOM();
    const control = creeazaGrupOptiuni({
      documentRef,
      container,
      id: "mod-analiza",
      eticheta: "Mod de analiză",
      ajutor: "Alege o singură variantă.",
      tipSelectie: "unica",
      optiuni: optiuniMod,
      selectate: ["directie"],
    });

    assert.equal(control.element.tagName, "FIELDSET");
    assert.equal(container.children[0], control.element);
    assert.equal(cauta(control.element, (element) => element.tagName === "LEGEND").length, 1);
    assert.deepEqual(
      control.intrari.map(({ type, name, value, checked }) => ({
        type,
        name,
        value,
        checked,
      })),
      [
        { type: "radio", name: "mod-analiza", value: "stare", checked: false },
        { type: "radio", name: "mod-analiza", value: "directie", checked: true },
        { type: "radio", name: "mod-analiza", value: "exploratoriu", checked: false },
      ],
    );
    assert.deepEqual(control.citeste(), ["directie"]);
    assert.equal(
      control.element.getAttribute("aria-describedby"),
      "mod-analiza-ajutor",
    );
  });

  it("permite bifarea mai multor checkbox-uri si anunta o singura data schimbarea nativa", () => {
    const { documentRef, container } = pregatesteDOM();
    const schimbari = [];
    const control = creeazaGrupOptiuni({
      documentRef,
      container,
      id: "axe",
      eticheta: "Axe",
      tipSelectie: "multipla",
      optiuni: [
        { id: "fact", eticheta: "Fact" },
        { id: "subtabla", eticheta: "Subtablă" },
        { id: "eff", eticheta: "EFF" },
      ],
      selectate: ["fact", "eff"],
      laSchimbare(selectate) {
        schimbari.push(selectate);
      },
    });

    assert.deepEqual(control.intrari.map((intrare) => intrare.type), [
      "checkbox",
      "checkbox",
      "checkbox",
    ]);
    assert.deepEqual(control.citeste(), ["fact", "eff"]);

    control.intrari[1].checked = true;
    control.intrari[1].dispatch("change");

    assert.deepEqual(schimbari, [["fact", "subtabla", "eff"]]);
  });

  it("citeste si seteaza programatic selectiile fara sa cheme callback-ul", () => {
    const { documentRef, container } = pregatesteDOM();
    let numarSchimbari = 0;
    const control = creeazaGrupOptiuni({
      documentRef,
      container,
      id: "vizualizare",
      eticheta: "Structura vizualizării",
      tipSelectie: "unica",
      optiuni: optiuniMod,
      laSchimbare() {
        numarSchimbari += 1;
      },
    });

    control.seteaza(["exploratoriu"]);
    assert.deepEqual(control.citeste(), ["exploratoriu"]);
    assert.deepEqual(control.intrari.map((intrare) => intrare.checked), [
      false,
      false,
      true,
    ]);

    control.seteaza([]);
    assert.deepEqual(control.citeste(), []);
    assert.equal(numarSchimbari, 0);
  });

  it("pastreaza motivul optiunii dezactivate in descrierea accesibila", () => {
    const { documentRef, container } = pregatesteDOM();
    const control = creeazaGrupOptiuni({
      documentRef,
      container,
      id: "structura",
      eticheta: "Structură",
      tipSelectie: "unica",
      optiuni: [
        { id: "tabel", eticheta: "Tabel" },
        {
          id: "linie",
          eticheta: "Grafic linie",
          descriere: "Arată schimbarea în timp.",
          dezactivata: true,
          motivDezactivare: "Necesită cel puțin două ferestre.",
        },
      ],
      selectate: ["tabel"],
    });

    const intrareDezactivata = control.intrari[1];
    const iduriDescriere = intrareDezactivata
      .getAttribute("aria-describedby")
      .split(" ");
    const elementeDescriere = cauta(
      control.element,
      (element) => iduriDescriere.includes(element.id),
    );
    assert.equal(intrareDezactivata.disabled, true);
    assert.deepEqual(
      elementeDescriere.map((element) => element.textContent),
      ["Arată schimbarea în timp.", "Necesită cel puțin două ferestre."],
    );
    assert.equal(elementeDescriere[1].hidden, false);

    assert.throws(() => control.seteaza(["linie"]), /dezactivată/);
    assert.deepEqual(control.citeste(), ["tabel"]);

    control.seteazaDezactivat(true);
    assert.equal(control.element.disabled, true);
    assert.deepEqual(control.intrari.map((intrare) => intrare.disabled), [true, true]);

    control.seteazaDezactivat(false);
    assert.equal(control.element.disabled, false);
    assert.deepEqual(control.intrari.map((intrare) => intrare.disabled), [false, true]);
  });

  it("combina indisponibilitatile dinamice cu cele permanente si blocarea grupului", () => {
    const { documentRef, container } = pregatesteDOM();
    const control = creeazaGrupOptiuni({
      documentRef,
      container,
      id: "axe-dinamice",
      eticheta: "Axe dinamice",
      tipSelectie: "unica",
      optiuni: [
        { id: "selectata", eticheta: "Selectată" },
        {
          id: "dinamica",
          eticheta: "Dinamică",
          descriere: "Descrierea opțiunii dinamice.",
        },
        {
          id: "permanenta",
          eticheta: "Permanentă",
          dezactivata: true,
          motivDezactivare: "Indisponibilă permanent.",
        },
      ],
      selectate: ["selectata"],
    });

    control.seteazaIndisponibile({
      dinamica: "Lipsesc datele necesare.",
    });

    const intrareDinamica = control.intrari[1];
    const motivDinamic = cauta(
      control.element,
      (element) =>
        element.className === "mabp-grup-optiuni__motiv-indisponibilitate" &&
        element.textContent === "Lipsesc datele necesare.",
    )[0];
    assert.equal(intrareDinamica.disabled, true);
    assert.equal(motivDinamic.hidden, false);
    assert.deepEqual(
      intrareDinamica.getAttribute("aria-describedby").split(" "),
      ["axe-dinamice-optiune-2-descriere", motivDinamic.id],
    );
    assert.throws(() => control.seteaza(["dinamica"]), /indisponibilă/);
    assert.deepEqual(control.citeste(), ["selectata"]);

    control.seteazaDezactivat(true);
    assert.deepEqual(control.intrari.map((intrare) => intrare.disabled), [
      true,
      true,
      true,
    ]);

    control.seteazaDezactivat(false);
    assert.deepEqual(control.intrari.map((intrare) => intrare.disabled), [
      false,
      true,
      true,
    ]);

    control.seteazaDezactivat(true);

    control.seteazaIndisponibile({});
    assert.equal(motivDinamic.hidden, true);
    assert.equal(motivDinamic.textContent, "");
    assert.equal(
      intrareDinamica.getAttribute("aria-describedby"),
      "axe-dinamice-optiune-2-descriere",
    );
    assert.deepEqual(control.intrari.map((intrare) => intrare.disabled), [
      true,
      true,
      true,
    ]);

    control.seteazaDezactivat(false);
    assert.deepEqual(control.intrari.map((intrare) => intrare.disabled), [
      false,
      false,
      true,
    ]);
  });

  it("respinge atomic motivele dinamice invalide sau aplicate selectiei curente", () => {
    const { documentRef, container } = pregatesteDOM();
    const control = creeazaGrupOptiuni({
      documentRef,
      container,
      id: "indisponibilitati-atomice",
      eticheta: "Indisponibilități",
      tipSelectie: "unica",
      optiuni: [
        { id: "selectata", eticheta: "Selectată" },
        { id: "existenta", eticheta: "Existentă" },
        { id: "alta", eticheta: "Alta" },
      ],
      selectate: ["selectata"],
    });
    control.seteazaIndisponibile({ existenta: "Motiv inițial." });

    const intrareExistenta = control.intrari[1];
    const motivExistenta = cauta(
      control.element,
      (element) =>
        element.className === "mabp-grup-optiuni__motiv-indisponibilitate" &&
        element.textContent === "Motiv inițial.",
    )[0];
    const verificaStareInitiala = () => {
      assert.equal(intrareExistenta.disabled, true);
      assert.equal(motivExistenta.hidden, false);
      assert.equal(motivExistenta.textContent, "Motiv inițial.");
      assert.deepEqual(control.citeste(), ["selectata"]);
    };

    assert.throws(
      () =>
        control.seteazaIndisponibile({
          existenta: "Motiv schimbat.",
          necunoscuta: "Nu există.",
        }),
      /nu există/,
    );
    verificaStareInitiala();

    assert.throws(
      () =>
        control.seteazaIndisponibile({
          existenta: "Motiv schimbat.",
          alta: "   ",
        }),
      /text nevid/,
    );
    verificaStareInitiala();

    assert.throws(
      () =>
        control.seteazaIndisponibile({
          existenta: "Motiv schimbat.",
          selectata: "Nu poate fi dezactivată.",
        }),
      /nu poate deveni indisponibilă/,
    );
    verificaStareInitiala();

    assert.throws(() => control.seteazaIndisponibile(null), /trebuie să fie un obiect/);
    verificaStareInitiala();

    assert.throws(
      () => control.seteazaIndisponibile(new Map([["alta", "Motiv."]])),
      /obiect simplu/,
    );
    verificaStareInitiala();
  });

  it("tine toate etichetele la vedere fara select, details sau menu", () => {
    const { documentRef, container } = pregatesteDOM();
    const control = creeazaGrupOptiuni({
      documentRef,
      container,
      id: "axe-vizibile",
      eticheta: "Axe",
      tipSelectie: "multipla",
      optiuni: optiuniMod,
    });

    assert.equal(control.element.hidden, false);
    assert.equal(cauta(control.element, (element) => element.tagName === "LABEL").length, 3);
    assert.deepEqual(texteDin(control.element), [
      "Axe",
      "Stare curentă",
      "Direcție",
      "Compară două ferestre.",
      "Exploratoriu",
    ]);
    assert.deepEqual(
      cauta(control.element, (element) =>
        ["SELECT", "DETAILS", "SUMMARY", "MENU"].includes(element.tagName),
      ),
      [],
    );
    control.intrari.forEach((intrare) => {
      const eticheta = cauta(
        control.element,
        (element) =>
          element.tagName === "LABEL" &&
          element.getAttribute("for") === intrare.id,
      );
      assert.equal(eticheta.length, 1);
    });
  });

  it("respinge configuratiile invalide inainte sa modifice DOM-ul", () => {
    const { documentRef, container } = pregatesteDOM();
    const baza = {
      documentRef,
      container,
      id: "test",
      eticheta: "Test",
      tipSelectie: "unica",
      optiuni: optiuniMod,
    };

    assert.throws(() => creeazaGrupOptiuni(null), /Parametrii grupului/);
    assert.throws(
      () => creeazaGrupOptiuni({ ...baza, documentRef: null }),
      /documentRef/,
    );
    assert.throws(
      () => creeazaGrupOptiuni({ ...baza, container: null }),
      /container/,
    );
    assert.throws(
      () => creeazaGrupOptiuni({ ...baza, tipSelectie: "dropdown" }),
      /tipSelectie/,
    );
    assert.throws(
      () => creeazaGrupOptiuni({ ...baza, id: "id cu spatii" }),
      /spații/,
    );
    assert.throws(
      () => creeazaGrupOptiuni({ ...baza, optiuni: [] }),
      /optiuni/,
    );
    assert.throws(
      () =>
        creeazaGrupOptiuni({
          ...baza,
          optiuni: [
            { id: "repetat", eticheta: "Unu" },
            { id: "repetat", eticheta: "Doi" },
          ],
        }),
      /duplicat/,
    );
    assert.throws(
      () =>
        creeazaGrupOptiuni({
          ...baza,
          optiuni: [
            {
              id: "indisponibil",
              eticheta: "Indisponibil",
              dezactivata: true,
            },
          ],
        }),
      /motivDezactivare/,
    );
    assert.throws(
      () =>
        creeazaGrupOptiuni({
          ...baza,
          optiuni: [
            {
              id: "indisponibil",
              eticheta: "Indisponibil",
              dezactivata: true,
              motivDezactivare: "   ",
            },
          ],
        }),
      /motivDezactivare/,
    );
    assert.throws(
      () =>
        creeazaGrupOptiuni({
          ...baza,
          optiuni: [
            { id: "disponibil", eticheta: "Disponibil" },
            {
              id: "indisponibil",
              eticheta: "Indisponibil",
              dezactivata: true,
              motivDezactivare: "Nu există date compatibile.",
            },
          ],
          selectate: ["indisponibil"],
        }),
      /dezactivată/,
    );
    assert.throws(
      () => creeazaGrupOptiuni({ ...baza, selectate: ["stare", "directie"] }),
      /cel mult un ID/,
    );
    assert.throws(
      () => creeazaGrupOptiuni({ ...baza, selectate: ["inexistent"] }),
      /nu există/,
    );
    assert.throws(
      () => creeazaGrupOptiuni({ ...baza, laSchimbare: true }),
      /laSchimbare/,
    );
    assert.deepEqual(container.children, []);

    const altDOM = pregatesteDOM();
    const parametri = {
      ...baza,
      documentRef: altDOM.documentRef,
      container: altDOM.container,
    };
    creeazaGrupOptiuni(parametri);
    assert.throws(() => creeazaGrupOptiuni(parametri), /deja folosit/);
  });
});
