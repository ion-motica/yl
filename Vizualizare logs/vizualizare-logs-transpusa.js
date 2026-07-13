(function (global) {
  "use strict";

  const NUME_BAZA_DATE = "youlearn_jurnal_intrebari";
  const NUME_COLECTIE = "intrebari";
  const PAGINA_VIZUALIZARE = "Vizualizare logs/vizualizare-logs-transpusa.html";
  const NUME_TAB = "youlearn-vizualizare-logs-tabulator-transposed";
  const CAMP_CHEIE = "indexeddb_key";
  const CAMP_RAND = "camp";
  const CAMP_MINIMIZAT = "minimizat";
  const PREFIX_COLOANA_LOG = "inregistrare_";
  let tabelLogs = null;
  let containerCurent = null;

  function deschidePaginaInTabNou() {
    const url = global.location
      ? new URL(PAGINA_VIZUALIZARE, global.location.href).href
      : PAGINA_VIZUALIZARE;
    return global.open?.(url, NUME_TAB) ?? null;
  }

  function valideazaParametri(parametri) {
    if (!parametri?.container || typeof parametri.container.replaceChildren !== "function") {
      throw new Error("Vizualizarea transposed are nevoie de un element container valid.");
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
        elementStatus: container.querySelector("#vizualizare-logs-status"),
      };
    }

    const pagina = document.createElement("div");
    pagina.className = "vizualizare-logs-page";

    const antet = document.createElement("header");
    antet.className = "vizualizare-logs-header";
    const titlu = document.createElement("h1");
    titlu.textContent = "Jurnal intrebari - Tabulator Transposed";
    antet.appendChild(titlu);

    const layout = document.createElement("div");
    layout.className = "vizualizare-logs-layout";

    const sidebar = document.createElement("aside");
    sidebar.id = "vizualizare-logs-sidebar";
    const titluSidebar = document.createElement("h2");
    titluSidebar.textContent = "Logs transposed";
    const status = document.createElement("p");
    status.id = "vizualizare-logs-status";
    status.textContent = "Se incarca...";
    const preseturi = document.createElement("div");
    preseturi.id = "vizualizare-logs-preseturi";
    preseturi.textContent = "Grupari si preseturi - ulterior";
    sidebar.append(titluSidebar, status, preseturi);

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

    return {
      elementTabel,
      elementMesaj: mesaj,
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

  function textCelula(valoare) {
    if (valoare == null) return "";
    if (typeof valoare === "object") return JSON.stringify(valoare);
    if (typeof valoare === "boolean") return valoare ? "true" : "false";
    return String(valoare);
  }

  function detecteazaCampuri(inregistrari) {
    if (!inregistrari.length) return [];
    const campuriSalvate = Object.keys(inregistrari[0]).filter((camp) => camp !== CAMP_CHEIE);
    return [CAMP_CHEIE, ...campuriSalvate];
  }

  function construiesteRanduriTranspuse(inregistrari) {
    return detecteazaCampuri(inregistrari).map((camp) => {
      const rand = {
        [CAMP_RAND]: camp,
        [CAMP_MINIMIZAT]: false,
      };
      inregistrari.forEach((inregistrare, index) => {
        rand[`${PREFIX_COLOANA_LOG}${index}`] = inregistrare[camp] ?? null;
      });
      return rand;
    });
  }

  function aplicaStareRand(elementRand, minimizat) {
    elementRand
      ?.classList.toggle("vizualizare-logs-transpusa-rand-minimizat", minimizat);
  }

  function formatterCamp(celula) {
    const rand = celula.getRow();
    const dateRand = rand.getData();
    const minimizat = dateRand[CAMP_MINIMIZAT] === true;
    aplicaStareRand(rand.getElement?.(), minimizat);

    const continut = document.createElement("span");
    continut.className = "vizualizare-logs-transpusa-camp";
    const text = document.createElement("span");
    text.className = "vizualizare-logs-transpusa-camp-text";
    text.textContent = dateRand[CAMP_RAND];
    const buton = document.createElement("button");
    buton.type = "button";
    buton.className = "vizualizare-logs-transpusa-comuta-rand";
    buton.textContent = minimizat ? "+" : "-";
    const actiune = minimizat ? "Restaureaza" : "Minimizeaza";
    buton.title = `${actiune} randul ${dateRand[CAMP_RAND]}`;
    buton.setAttribute("aria-label", buton.title);
    ["pointerdown", "mousedown", "click"].forEach((tipEveniment) => {
      buton.addEventListener(tipEveniment, (eveniment) => {
        eveniment.stopPropagation();
        if (tipEveniment !== "click") return;
        const stareNoua = !rand.getData()[CAMP_MINIMIZAT];
        aplicaStareRand(rand.getElement?.(), stareNoua);
        Promise.resolve(rand.update({ [CAMP_MINIMIZAT]: stareNoua })).then(() => {
          rand.reformat?.();
        });
      });
    });
    continut.append(text, buton);
    return continut;
  }

  function formatterValoare(celula) {
    if (celula.getRow().getData()[CAMP_MINIMIZAT] === true) return "";
    return textCelula(celula.getValue());
  }

  function titluInregistrare(inregistrare) {
    return function () {
      const antet = document.createElement("span");
      antet.className = "vizualizare-logs-transpusa-antet";
      const cheie = document.createElement("span");
      cheie.className = "vizualizare-logs-transpusa-antet-cheie";
      cheie.textContent = `#${textCelula(inregistrare[CAMP_CHEIE])}`;
      antet.appendChild(cheie);
      if (inregistrare.data_ora_ro != null) {
        const data = document.createElement("span");
        data.className = "vizualizare-logs-transpusa-antet-data";
        data.textContent = textCelula(inregistrare.data_ora_ro);
        antet.appendChild(data);
      }
      return antet;
    };
  }

  function construiesteColoaneTranspuse(inregistrari) {
    const coloanaCamp = {
      title: "Camp",
      field: CAMP_RAND,
      frozen: true,
      width: 250,
      minWidth: 170,
      resizable: true,
      headerSort: false,
      formatter: formatterCamp,
    };
    const coloaneLog = inregistrari.map((inregistrare, index) => ({
      title: `#${textCelula(inregistrare[CAMP_CHEIE])}`,
      titleFormatter: titluInregistrare(inregistrare),
      field: `${PREFIX_COLOANA_LOG}${index}`,
      width: 190,
      minWidth: 80,
      resizable: true,
      headerSort: false,
      cssClass: "vizualizare-logs-transpusa-valoare",
      formatter: formatterValoare,
    }));
    return [coloanaCamp, ...coloaneLog];
  }

  function initializeazaTabelLogs({ elementTabel, randuri, coloane }) {
    if (tabelLogs && elementTabel === tabelLogs.element) {
      tabelLogs.setColumns?.(coloane);
      return Promise.resolve(tabelLogs.replaceData(randuri)).then(() => tabelLogs);
    }

    tabelLogs?.destroy?.();
    tabelLogs = new global.Tabulator(elementTabel, {
      data: randuri,
      columns: coloane,
      index: CAMP_RAND,
      height: "100%",
      layout: "fitData",
      movableRows: true,
      rowHeader: {
        formatter: "handle",
        rowHandle: true,
        headerSort: false,
        frozen: true,
        width: 34,
        minWidth: 34,
        resizable: false,
      },
      placeholder: "Jurnalul este gol.",
      renderVertical: "virtual",
    });
    tabelLogs.element = elementTabel;
    return Promise.resolve(tabelLogs);
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

      const randuri = construiesteRanduriTranspuse(rezultat.inregistrari);
      const coloane = construiesteColoaneTranspuse(rezultat.inregistrari);
      const tabel = await initializeazaTabelLogs({
        elementTabel: interfata.elementTabel,
        randuri,
        coloane,
      });
      interfata.elementStatus.textContent = rezultat.inregistrari.length
        ? `${rezultat.inregistrari.length} inregistrari / ${randuri.length} randuri`
        : "Jurnalul este gol.";
      return tabel;
    } catch (error) {
      afiseazaMesaj(interfata, "Nu am putut incarca jurnalul.");
      global.console?.error?.(
        "[VizualizareLogsTranspuse] Jurnalul nu a putut fi incarcat.",
        error
      );
      return null;
    }
  }

  function deschideVizualizareLogsTranspuse(parametri) {
    const container =
      parametri?.container || document.getElementById("vizualizare-logs-transpusa-root");
    if (!container) return deschidePaginaInTabNou();
    return incarcaVizualizarea({ container });
  }

  global.deschideVizualizareLogsTranspuse = deschideVizualizareLogsTranspuse;

  const containerInitial = document.getElementById("vizualizare-logs-transpusa-root");
  if (containerInitial) deschideVizualizareLogsTranspuse({ container: containerInitial });
})(window);
