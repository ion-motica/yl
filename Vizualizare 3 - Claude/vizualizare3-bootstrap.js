// Bootstrap pentru „Vizualizare 3 - Claude".
// Singurul strat care atinge DOM-ul și IndexedDB. Citește datele, apelează
// motorul pur și randează modelul rezultat. Nu recalculează metrici.

(function (global) {
  "use strict";

  const NUME_BAZA_DATE = "youlearn_jurnal_intrebari";
  const NUME_COLECTIE = "intrebari";
  const PAGINA = "Vizualizare 3 - Claude/vizualizare3.html";
  const NUME_TAB = "youlearn-vizualizare3-claude";

  const ETICHETE_STARE = {
    netestat: "· Netestat",
    date_insuficiente: "· Date insuficiente",
    in_lucru: "! În lucru",
    in_consolidare: "! În consolidare",
    fluent: "✓ Fluent",
  };

  // ---- deschidere din alt context (butonul din CP) ---------------------

  function deschideVizualizare3Claude() {
    const url = global.location ? new URL(PAGINA, global.location.href).href : PAGINA;
    return global.open?.(url, NUME_TAB) ?? null;
  }
  global.deschideVizualizare3Claude = deschideVizualizare3Claude;

  // Dacă nu suntem pe pagina modulului, expunem doar deschiderea în tab nou.
  const layout = document.getElementById("vizualizare3-layout");
  if (!layout) return;

  // ---- citirea jurnalului (ordinea cheii = ordinea salvării) ------------

  function citesteJurnalul() {
    if (!global.indexedDB) return Promise.resolve([]);
    return new Promise((resolve) => {
      let bazaNoua = false;
      const cerere = global.indexedDB.open(NUME_BAZA_DATE);
      cerere.onupgradeneeded = () => {
        bazaNoua = true;
        cerere.transaction?.abort();
      };
      cerere.onerror = () => resolve([]);
      cerere.onsuccess = () => {
        if (bazaNoua) {
          resolve([]);
          return;
        }
        const baza = cerere.result;
        if (!baza.objectStoreNames.contains(NUME_COLECTIE)) {
          resolve([]);
          return;
        }
        const inregistrari = [];
        const tranzactie = baza.transaction(NUME_COLECTIE, "readonly");
        tranzactie.objectStore(NUME_COLECTIE).openCursor(null, "next").onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) {
            resolve(inregistrari);
            return;
          }
          inregistrari.push(cursor.value);
          cursor.continue();
        };
        tranzactie.onerror = () => resolve(inregistrari);
      };
    });
  }

  // ---- configurația prototipului (o singură opțiune activă / axă) -------

  const CONFIGURATIE = {
    domeniu: { tip: "tabla", table_id: "mul:1-10x1-10", agregare_forme: "per_fact" },
    filtrare: { preset: "standard_v1" },
    segmentare: { tip: "tot_istoricul" },
    statistici: ["precizie_prima", "mediana_timp_corect", "n"],
    interpretare: { tip: "stare_curenta" },
    vizualizare: { tip: "grila_10x10" },
  };

  // ---- randarea control panelului din definițiile axelor ----------------

  function optiune(text, elemente) {
    const rand = document.createElement("label");
    rand.className = "viz3-optiune";
    rand.append(...elemente);
    return rand;
  }

  function randeazaControlPanel(container, definitii) {
    const titlu = document.createElement("h1");
    titlu.textContent = "Vizualizare 3 - Claude";
    const subtitlu = document.createElement("p");
    subtitlu.className = "viz3-subtitlu";
    subtitlu.textContent = "Prototip: o opțiune activă per axă. Restul vor urma.";
    container.append(titlu, subtitlu);

    definitii.forEach((etapa) => {
      const sectiune = document.createElement("section");
      sectiune.className = "viz3-etapa";
      const titluEtapa = document.createElement("h2");
      titluEtapa.textContent = etapa.titlu;
      sectiune.appendChild(titluEtapa);

      etapa.axe.forEach((axa) => {
        const grup = document.createElement("div");
        grup.className = "viz3-axa";
        const eticheta = document.createElement("span");
        eticheta.className = "viz3-axa-eticheta";
        eticheta.textContent = axa.eticheta;
        grup.appendChild(eticheta);

        axa.optiuni.forEach((opt) => {
          const input = document.createElement("input");
          input.type = axa.tip_selectie === "multipla" ? "checkbox" : "radio";
          input.name = `${etapa.etapa}-${axa.id}`;
          input.checked = opt.activa === true;
          input.disabled = opt.dezactivata === true;

          const text = document.createElement("span");
          text.textContent = opt.eticheta;

          const elemente = [input, text];
          if (opt.dezactivata) {
            const motiv = document.createElement("span");
            motiv.className = "viz3-motiv";
            motiv.textContent = ` (${opt.motiv})`;
            elemente.push(motiv);
          }
          const rand = optiune(opt.eticheta, elemente);
          if (opt.dezactivata) rand.classList.add("viz3-dezactivata");
          grup.appendChild(rand);
        });

        sectiune.appendChild(grup);
      });

      container.appendChild(sectiune);
    });
  }

  // ---- randarea grilei din model ---------------------------------------

  function randeazaCelula(celula) {
    const el = document.createElement("div");
    el.className = "viz3-celula";
    el.dataset.stare = celula.stare;
    el.style.gridColumn = String(celula.coloana);
    el.style.gridRow = String(celula.rand);

    const eticheta = document.createElement("div");
    eticheta.className = "viz3-celula-eticheta";
    eticheta.textContent = celula.eticheta;

    const stare = document.createElement("div");
    stare.className = "viz3-celula-stare";
    stare.textContent = ETICHETE_STARE[celula.stare] ?? celula.stare;

    const patratele = document.createElement("div");
    patratele.className = "viz3-celula-patratele";
    for (let i = 1; i <= 4; i += 1) {
      const p = document.createElement("span");
      p.className = "viz3-patratel" + (i <= celula.traseu ? " viz3-patratel--plin" : "");
      patratele.appendChild(p);
    }

    el.append(eticheta, stare, patratele);

    if (celula.n > 0) {
      const detaliu = document.createElement("div");
      detaliu.className = "viz3-celula-detaliu";
      const timp = celula.mediana_timp === null ? "-" : `${celula.mediana_timp}s`;
      const precizie =
        celula.precizie_prima === null ? "-" : `${Math.round(celula.precizie_prima * 100)}%`;
      detaliu.textContent = `n=${celula.n} · ${precizie} · ${timp}`;
      el.appendChild(detaliu);
    }

    return el;
  }

  function randeazaVizualizarea(container, model, info) {
    container.replaceChildren();

    const antet = document.createElement("div");
    antet.className = "viz3-viz-antet";
    const titlu = document.createElement("h1");
    titlu.textContent = "Starea curentă — tabla înmulțirii 1-10";
    const sursa = document.createElement("span");
    sursa.className = "viz3-sursa";
    sursa.textContent = info;
    antet.append(titlu, sursa);
    container.appendChild(antet);

    const grila = document.createElement("div");
    grila.className = "viz3-grila";
    model.celule.forEach((celula) => grila.appendChild(randeazaCelula(celula)));
    container.appendChild(grila);
  }

  // ---- flux principal ---------------------------------------------------

  const motor = global.MotorAnalizaVizualizare3;
  const catalog = global.CatalogTablaInmultirii;
  const praguri = global.ConfigPraguriVizualizare3;
  const axe = global.DefinitiiAxeVizualizare3;
  const fixture = global.FixtureLoguriDummyVizualizare3;

  const cpEl = document.getElementById("viz3-cp");
  const vizEl = document.getElementById("viz3-viz");

  function analizeazaSiRandeaza(inregistrari, info) {
    const model = motor.ruleazaAnaliza({
      inregistrari,
      catalog,
      configuratie: CONFIGURATIE,
      praguri,
    });
    randeazaVizualizarea(vizEl, model, info);
  }

  function comutaSursa(container, laFixture) {
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = laFixture ? "Folosește jurnalul real" : "Folosește fixture demonstrativ";
    buton.addEventListener("click", () => {
      if (laFixture) porneste({ forteazaFixture: false });
      else porneste({ forteazaFixture: true });
    });
    container.querySelector(".viz3-sursa")?.appendChild(buton);
  }

  async function porneste({ forteazaFixture }) {
    const reale = forteazaFixture ? [] : await citesteJurnalul();
    if (!forteazaFixture && reale.length > 0) {
      analizeazaSiRandeaza(reale, `Sursă: jurnal real (${reale.length} apăsări).`);
      comutaSursa(vizEl, true);
    } else {
      const dummy = fixture.construiesteFixture();
      const motiv = forteazaFixture ? "" : " (jurnal real gol)";
      analizeazaSiRandeaza(dummy, `Sursă: fixture demonstrativ${motiv}.`);
      comutaSursa(vizEl, false);
    }
  }

  randeazaControlPanel(cpEl, axe);
  porneste({ forteazaFixture: false });
})(typeof globalThis !== "undefined" ? globalThis : this);
