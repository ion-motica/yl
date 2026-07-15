(function (global) {
  "use strict";

  const NUME_BAZA_DATE = "youlearn_jurnal_intrebari";
  const NUME_COLECTIE = "intrebari";
  const PAGINA_VIZUALIZARE = "Vizualizare logs/vizualizare-logs.html";
  const NUME_TAB = "youlearn-vizualizare-logs-tabulator";
  const CAMP_CHEIE = "indexeddb_key";
  const LATIME_COLOANA_MINIMIZATA = 36;
  let tabelLogs = null;
  let containerCurent = null;
  let semnaturaColoaneCurente = "";
  const latimiColoaneMinimizate = new Map();
  const vizibilitateColoane = new Map();

  function deschidePaginaInTabNou() {
    const url = global.location
      ? new URL(PAGINA_VIZUALIZARE, global.location.href).href
      : PAGINA_VIZUALIZARE;
    return global.open?.(url, NUME_TAB) ?? null;
  }

  function valideazaParametri(parametri) {
    if (!parametri?.container || typeof parametri.container.replaceChildren !== "function") {
      throw new Error("Vizualizarea logurilor are nevoie de un element container valid.");
    }
    if (typeof global.Tabulator !== "function") {
      throw new Error("Biblioteca Tabulator nu este incarcata.");
    }
  }

  function construiesteInterfata(container) {
    if (container === containerCurent && container.querySelector?.("#vizualizare-logs-tabel")) {
      return {
        elementTabel: container.querySelector("#vizualizare-logs-tabel"),
        elementMesaj: container.querySelector("#vizualizare-logs-mesaj"),
        elementPreseturi: container.querySelector("#vizualizare-logs-preseturi"),
        elementSelector: container.querySelector("#vizualizare-logs-selector-coloane"),
        elementStatus: container.querySelector("#vizualizare-logs-status"),
      };
    }

    const pagina = document.createElement("div");
    pagina.className = "vizualizare-logs-page";

    const antet = document.createElement("header");
    antet.className = "vizualizare-logs-header";
    const titlu = document.createElement("h1");
    titlu.textContent = "Jurnal intrebari - Tabulator";
    antet.appendChild(titlu);

    const layout = document.createElement("div");
    layout.className = "vizualizare-logs-layout";

    const sidebar = document.createElement("aside");
    sidebar.id = "vizualizare-logs-sidebar";
    const titluSidebar = document.createElement("h2");
    titluSidebar.textContent = "Logs";
    const status = document.createElement("p");
    status.id = "vizualizare-logs-status";
    status.textContent = "Se incarca...";
    const preseturi = document.createElement("div");
    preseturi.id = "vizualizare-logs-preseturi";
    const selector = document.createElement("div");
    selector.id = "vizualizare-logs-selector-coloane";
    sidebar.append(titluSidebar, status, preseturi, selector);

    const main = document.createElement("main");
    main.id = "vizualizare-logs-main";
    const mesaj = document.createElement("div");
    mesaj.id = "vizualizare-logs-mesaj";
    mesaj.hidden = true;
    const elementTabel = document.createElement("div");
    elementTabel.id = "vizualizare-logs-tabel";
    main.append(mesaj, elementTabel);

    layout.append(sidebar, main);
    pagina.append(antet, layout);
    container.replaceChildren(pagina);
    containerCurent = container;
    latimiColoaneMinimizate.clear();

    return {
      elementTabel,
      elementMesaj: mesaj,
      elementPreseturi: preseturi,
      elementSelector: selector,
      elementStatus: status,
    };
  }

  function deschideBazaDateDoarPentruCitire() {
    if (!global.indexedDB) {
      return Promise.reject(new Error("IndexedDB nu este disponibil."));
    }

    return new Promise((resolve, reject) => {
      let bazaNoua = false;
      const cerere = global.indexedDB.open(NUME_BAZA_DATE);
      cerere.onupgradeneeded = () => {
        bazaNoua = true;
        cerere.transaction?.abort();
      };
      cerere.onsuccess = () => resolve(cerere.result);
      cerere.onerror = () => {
        if (bazaNoua) resolve(null);
        else reject(cerere.error || new Error("Baza jurnalului nu a putut fi deschisa."));
      };
      cerere.onblocked = () => reject(new Error("Baza jurnalului este blocata."));
    });
  }

  function citesteCuCursor(bazaDate) {
    return new Promise((resolve, reject) => {
      const inregistrari = [];
      const tranzactie = bazaDate.transaction(NUME_COLECTIE, "readonly");
      const cerere = tranzactie.objectStore(NUME_COLECTIE).openCursor(null, "next");

      cerere.onsuccess = () => {
        const cursor = cerere.result;
        if (!cursor) {
          resolve(inregistrari);
          return;
        }
        inregistrari.push({
          ...cursor.value,
          [CAMP_CHEIE]: cursor.primaryKey,
        });
        cursor.continue();
      };
      cerere.onerror = () => reject(cerere.error);
      tranzactie.onerror = () => reject(tranzactie.error);
      tranzactie.onabort = () => reject(tranzactie.error);
    });
  }

  async function citesteLoguriDinIndexedDB() {
    const bazaDate = await deschideBazaDateDoarPentruCitire();
    if (!bazaDate) return { stare: "inexistent", inregistrari: [] };
    try {
      if (!bazaDate.objectStoreNames.contains(NUME_COLECTIE)) {
        return { stare: "inexistent", inregistrari: [] };
      }
      return {
        stare: "disponibil",
        inregistrari: await citesteCuCursor(bazaDate),
      };
    } finally {
      bazaDate.close?.();
    }
  }

  function textCelula(valoare, valoareLipsa = "") {
    if (valoare == null) return valoareLipsa;
    if (typeof valoare === "object") return JSON.stringify(valoare);
    return String(valoare);
  }

  function detecteazaCampuri(inregistrari) {
    if (!inregistrari.length) return [];
    const campuriSalvate = Object.keys(inregistrari[0]).filter((camp) => camp !== CAMP_CHEIE);
    return [CAMP_CHEIE, ...campuriSalvate];
  }

  function detecteazaTipCamp(inregistrari, camp) {
    const inregistrareCuValoare = inregistrari.find(
      (inregistrare) => inregistrare[camp] != null
    );
    if (!inregistrareCuValoare) return "text";
    const valoare = inregistrareCuValoare[camp];
    if (typeof valoare === "boolean") return "boolean";
    if (typeof valoare === "number") return "numar";
    if (typeof valoare === "object") return "obiect";
    return "text";
  }

  function actualizeazaAntetMinimizat({ camp, antet, text, buton }) {
    const minimizata = latimiColoaneMinimizate.has(camp);
    antet.classList.toggle("is-minimizata", minimizata);
    text.classList.toggle("is-minimizat", minimizata);
    buton.textContent = minimizata ? "+" : "-";
    const actiune = minimizata ? "Restaureaza" : "Minimizeaza";
    buton.title = `${actiune} coloana ${camp}`;
    buton.setAttribute("aria-label", `${actiune} coloana ${camp}`);
  }

  function obtineColoanaDacaExista(tabel, camp) {
    const definitii = tabel?.getColumnDefinitions?.();
    if (Array.isArray(definitii) && !definitii.some((definitie) => definitie.field === camp)) {
      return null;
    }
    return tabel?.getColumn?.(camp) || null;
  }

  function reaplicaLatimileColoanelorMinimizate() {
    latimiColoaneMinimizate.forEach((_latimeInitiala, camp) => {
      const coloana = obtineColoanaDacaExista(tabelLogs, camp);
      coloana
        ?.getElement()
        ?.classList.toggle("vizualizare-logs-coloana-minimizata", true);
      coloana?.setWidth(LATIME_COLOANA_MINIMIZATA);
    });
  }

  function comutaMinimizareColoana({ camp, antet, text, buton }) {
    const coloana = obtineColoanaDacaExista(tabelLogs, camp);
    if (!coloana) return;
    let latimeDorita;

    if (latimiColoaneMinimizate.has(camp)) {
      latimeDorita = latimiColoaneMinimizate.get(camp);
      latimiColoaneMinimizate.delete(camp);
    } else {
      latimiColoaneMinimizate.set(camp, coloana.getWidth());
      latimeDorita = LATIME_COLOANA_MINIMIZATA;
    }

    actualizeazaAntetMinimizat({ camp, antet, text, buton });
    coloana
      .getElement()
      ?.classList.toggle("vizualizare-logs-coloana-minimizata", latimiColoaneMinimizate.has(camp));
    tabelLogs.redraw?.(true);
    const coloanaActuala = obtineColoanaDacaExista(tabelLogs, camp);
    coloanaActuala
      ?.getElement()
      ?.classList.toggle("vizualizare-logs-coloana-minimizata", latimiColoaneMinimizate.has(camp));
    reaplicaLatimileColoanelorMinimizate();
    if (!latimiColoaneMinimizate.has(camp)) coloanaActuala?.setWidth(latimeDorita);
  }

  function titluCuMinimizare(camp) {
    return function () {
      const antet = document.createElement("span");
      antet.className = "vizualizare-logs-antet-coloana";
      const text = document.createElement("span");
      text.className = "vizualizare-logs-antet-text";
      text.textContent = camp;
      const buton = document.createElement("button");
      buton.type = "button";
      buton.className = "vizualizare-logs-minimizeaza-coloana";
      ["pointerdown", "mousedown", "click"].forEach((tipEveniment) => {
        buton.addEventListener(tipEveniment, (eveniment) => {
          eveniment.stopPropagation();
          if (tipEveniment !== "click") return;
          comutaMinimizareColoana({ camp, antet, text, buton });
        });
      });
      antet.append(text, buton);
      actualizeazaAntetMinimizat({ camp, antet, text, buton });
      return antet;
    };
  }

  function definitieText(camp) {
    return {
      title: camp,
      field: camp,
      sorter: "string",
      headerFilter: "input",
      formatter: (celula) => textCelula(celula.getValue()),
      tooltip: (celula) => textCelula(celula.getValue()),
    };
  }

  function definitieObiect(camp, valoareLipsa = "") {
    return {
      ...definitieText(camp),
      sorter: (valoareA, valoareB) =>
        textCelula(valoareA, valoareLipsa).localeCompare(
          textCelula(valoareB, valoareLipsa),
          "ro"
        ),
      headerFilterFunc: (valoareFiltru, valoareRand) =>
        textCelula(valoareRand, valoareLipsa)
          .toLocaleLowerCase("ro")
          .includes(String(valoareFiltru ?? "").toLocaleLowerCase("ro")),
      formatter: (celula) => textCelula(celula.getValue(), valoareLipsa),
      tooltip: (celula) => textCelula(celula.getValue(), valoareLipsa),
    };
  }

  function definitieNumar(camp, afiseazaSecunde = false) {
    return {
      title: camp,
      field: camp,
      sorter: "number",
      headerFilter: "number",
      headerFilterFunc: "=",
      formatter: (celula) => {
        const valoare = celula.getValue();
        if (valoare == null) return "";
        return afiseazaSecunde ? `${valoare} s` : valoare;
      },
      tooltip: (celula) => textCelula(celula.getValue()),
    };
  }

  function definitieBoolean(camp) {
    return {
      title: camp,
      field: camp,
      sorter: "boolean",
      headerFilter: "list",
      headerFilterParams: {
        values: { "": "Toate", true: "true", false: "false" },
        clearable: true,
      },
      headerFilterFunc: (valoareFiltru, valoareRand) =>
        valoareFiltru === "" || String(valoareRand) === String(valoareFiltru),
      formatter: (celula) => {
        const valoare = celula.getValue();
        if (valoare == null) return "";
        return valoare === true ? "✓ true" : "✕ false";
      },
      tooltip: (celula) => textCelula(celula.getValue()),
    };
  }

  function definitieCampDetectat(camp, inregistrari) {
    const tip = detecteazaTipCamp(inregistrari, camp);
    if (camp === "fact") return { ...definitieText(camp), sorter: "alphanum" };
    if (tip === "boolean") return definitieBoolean(camp);
    if (tip === "numar") {
      return definitieNumar(camp, camp === "durata_raspuns_secunde");
    }
    if (tip === "obiect") return definitieObiect(camp);
    return definitieText(camp);
  }

  function construiesteColoaneLogs(inregistrari) {
    const coloane = detecteazaCampuri(inregistrari).map((camp) =>
      definitieCampDetectat(camp, inregistrari)
    );

    return coloane.map((coloana) => ({
      ...coloana,
      titleFormatter: titluCuMinimizare(coloana.field),
      resizable: true,
      headerSort: true,
      minWidth: LATIME_COLOANA_MINIMIZATA,
    }));
  }

  function asteaptaConstruireaTabelului(tabel) {
    if (tabel.initialized === true || typeof tabel.on !== "function") {
      return Promise.resolve(tabel);
    }
    return new Promise((resolve) => {
      const tabelConstruit = () => {
        tabel.off?.("tableBuilt", tabelConstruit);
        resolve(tabel);
      };
      tabel.on("tableBuilt", tabelConstruit);
    });
  }

  function initializeazaTabelLogs({ elementTabel, inregistrari, coloane }) {
    const semnaturaColoane = JSON.stringify(coloane.map((coloana) => coloana.field));
    if (tabelLogs && elementTabel === tabelLogs.element) {
      const schemaSchimbata = semnaturaColoane !== semnaturaColoaneCurente;
      const actualizareColoane = schemaSchimbata
        ? Promise.resolve(tabelLogs.setColumns?.(coloane))
        : Promise.resolve();
      if (schemaSchimbata) {
        latimiColoaneMinimizate.clear();
        vizibilitateColoane.clear();
      }
      semnaturaColoaneCurente = semnaturaColoane;
      return actualizareColoane
        .then(() => tabelLogs.replaceData(inregistrari))
        .then(() => tabelLogs);
    }

    tabelLogs?.destroy?.();
    tabelLogs = new global.Tabulator(elementTabel, {
      data: inregistrari,
      columns: coloane,
      index: CAMP_CHEIE,
      height: "100%",
      layout: "fitData",
      movableColumns: true,
      placeholder: "Jurnalul este gol.",
      renderVertical: "virtual",
    });
    tabelLogs.element = elementTabel;
    semnaturaColoaneCurente = semnaturaColoane;
    return asteaptaConstruireaTabelului(tabelLogs);
  }

  function initializeazaSelectorColoane({ elementSelector, tabel, coloane }) {
    const titlu = document.createElement("p");
    titlu.className = "vizualizare-logs-selector-titlu";
    titlu.textContent = "Coloane afisate";
    const componente = tabel.getColumns?.() || [];
    const coloaneCurente = componente.length
      ? componente.map((componenta) => ({ field: componenta.getField(), componenta }))
      : coloane.map((coloana) => ({ field: coloana.field, componenta: null }));
    const optiuni = coloaneCurente.map((coloana) => {
      const eticheta = document.createElement("label");
      eticheta.className = "vizualizare-logs-coloana-optiune";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = coloana.componenta?.isVisible?.() !== false;
      vizibilitateColoane.set(coloana.field, checkbox.checked);
      checkbox.dataset.camp = coloana.field;
      checkbox.addEventListener("change", () => {
        vizibilitateColoane.set(coloana.field, checkbox.checked);
        const coloanaCurenta = obtineColoanaDacaExista(tabel, coloana.field);
        if (checkbox.checked) coloanaCurenta?.show();
        else coloanaCurenta?.hide();
      });
      const text = document.createElement("span");
      text.textContent = coloana.field;
      eticheta.append(checkbox, text);
      return eticheta;
    });
    elementSelector.replaceChildren(titlu, ...optiuni);
  }

  function initializeazaPreseturi({ elementPreseturi, elementSelector, tabel, coloane }) {
    const apiPreseturi = global.VizualizareLogsPreseturi;
    if (!apiPreseturi) {
      elementPreseturi.textContent = "Modulul de preseturi nu este incarcat.";
      return;
    }

    apiPreseturi.randeazaPreseturi({
      element: elementPreseturi,
      grupe: apiPreseturi.grupe,
      laAplicarePreset: (preset) =>
        apiPreseturi.aplicaPreset({
          tabel,
          preset,
          latimiColoaneMinimizate,
          latimeColoanaMinimizata: LATIME_COLOANA_MINIMIZATA,
          dupaAplicareColoane: () => {
            reaplicaLatimileColoanelorMinimizate();
            initializeazaSelectorColoane({ elementSelector, tabel, coloane });
          },
        }),
      laCitirePreset: (nume) =>
        apiPreseturi.citestePresetCurent({
          tabel,
          nume,
          latimiColoaneMinimizate,
        }),
    });
  }

  function afiseazaMesaj({ elementTabel, elementMesaj, elementStatus }, mesaj) {
    elementTabel.hidden = true;
    elementMesaj.hidden = false;
    elementMesaj.textContent = mesaj;
    elementStatus.textContent = mesaj;
  }

  async function incarcaVizualizarea(parametri) {
    valideazaParametri(parametri);
    const interfata = construiesteInterfata(parametri.container);
    interfata.elementMesaj.hidden = true;
    interfata.elementTabel.hidden = false;
    interfata.elementStatus.textContent = "Se incarca...";

    try {
      const rezultat = await citesteLoguriDinIndexedDB();
      if (rezultat.stare === "inexistent") {
        afiseazaMesaj(interfata, "Nu exista inca jurnalul de intrebari.");
        return null;
      }

      if (!rezultat.inregistrari.length) {
        afiseazaMesaj(interfata, "Jurnalul este gol.");
        return null;
      }

      const coloane = construiesteColoaneLogs(rezultat.inregistrari);
      const tabel = await initializeazaTabelLogs({
        elementTabel: interfata.elementTabel,
        inregistrari: rezultat.inregistrari,
        coloane,
      });
      initializeazaSelectorColoane({
        elementSelector: interfata.elementSelector,
        tabel,
        coloane,
      });
      initializeazaPreseturi({
        elementPreseturi: interfata.elementPreseturi,
        elementSelector: interfata.elementSelector,
        tabel,
        coloane,
      });
      interfata.elementStatus.textContent = rezultat.inregistrari.length
        ? `${rezultat.inregistrari.length} inregistrari`
        : "Jurnalul este gol.";
      return tabel;
    } catch (error) {
      afiseazaMesaj(interfata, "Nu am putut incarca jurnalul.");
      global.console?.error?.("[VizualizareLogs] Jurnalul nu a putut fi incarcat.", error);
      return null;
    }
  }

  function deschideVizualizareLogs(parametri) {
    const container = parametri?.container || document.getElementById("vizualizare-logs-root");
    if (!container) return deschidePaginaInTabNou();
    return incarcaVizualizarea({ container });
  }

  global.deschideVizualizareLogs = deschideVizualizareLogs;

  const containerInitial = document.getElementById("vizualizare-logs-root");
  if (containerInitial) deschideVizualizareLogs({ container: containerInitial });
})(window);
