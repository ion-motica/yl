// Bootstrap pentru „Vizualizare 3 - Claude".
// Singurul strat care atinge DOM-ul și IndexedDB. Citește datele, apelează
// motorul pur și randează modelul rezultat. Nu recalculează metrici.

(function (global) {
  "use strict";

  const NUME_BAZA_DATE = "youlearn_jurnal_intrebari";
  const NUME_COLECTIE = "intrebari";
  const PAGINA = "Vizualizare 3 - Claude/vizualizare3.html";
  const NUME_TAB = "youlearn-vizualizare3-claude";

  // Etichetele vizibile, în ordinea progresiei.
  const ETICHETE_STARE = {
    netestat: "Netestat",
    abia_inceput: "Abia început",
    nu_il_stie: "Nu îl știe",
    in_lucru: "În lucru",
    fluent: "Fluent",
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

  // ---- starea de prezentare a foliilor ---------------------------------
  // Nu atinge configurația motorului; doar cum sunt așezate foliile.
  let foliiActive = false;
  let aranjamentCurent = "suprapus";

  // Compoziția celulei pe tabla desfăcută. Suprapusă arată mereu tot.
  const compozitie = {
    fact: true,
    eticheta: true,
    patratele: true,
    numere: true,
    umple: false,
  };

  function aplicaAranjament() {
    const stiva = document.querySelector(".viz3-folii");
    if (!stiva) return;
    stiva.dataset.aranjament = foliiActive ? aranjamentCurent : "suprapus";
    aplicaCompozitie();
  }

  function aplicaCompozitie() {
    const stiva = document.querySelector(".viz3-folii");
    if (!stiva) return;
    stiva.dataset.compFact = compozitie.fact ? "1" : "0";
    stiva.dataset.compEticheta = compozitie.eticheta ? "1" : "0";
    stiva.dataset.compPatratele = compozitie.patratele ? "1" : "0";
    stiva.dataset.compNumere = compozitie.numere ? "1" : "0";
    stiva.dataset.compUmple = compozitie.umple ? "1" : "0";
    aplicaUmplere(stiva);
  }

  // Marimile de baza ale unui patratel (vezi .viz3-patratel din CSS).
  const DIM_PATRATEL = 10;
  const GAP_PATRATEL = 2;

  const CLASE_COMPONENTE = {
    eticheta: ".viz3-celula-eticheta",
    stare: ".viz3-celula-stare",
    patratele: ".viz3-celula-patratele",
    detaliu: ".viz3-celula-detaliu",
  };

  function aplicaUmplere(stiva) {
    const activ = compozitie.umple && stiva.dataset.aranjament !== "suprapus";
    stiva
      .querySelectorAll(".viz3-celula")
      .forEach((celula) => aplicaUmplereCelula(celula, activ));
  }

  // Înălțimea celulei se împarte în felii egale între componentele vizibile.
  // Fiecare crește până atinge marginea laterală SAU limita feliei ei — care
  // vine prima. Astfel nimic nu se suprapune, iar la 3/2/1 componente feliile
  // sunt mai mari, deci scrisul crește mai mult.
  function aplicaUmplereCelula(celula, activ) {
    const toate = Object.entries(CLASE_COMPONENTE)
      .map(([id, sel]) => ({ id, el: celula.querySelector(sel) }))
      .filter(({ el }) => el);

    toate.forEach(({ el }) => {
      el.style.height = "";
      el.style.lineHeight = "";
      el.style.fontSize = "";
      el.style.top = "";
      el.style.removeProperty("--viz3-patratel-dim");
      el.style.removeProperty("--viz3-patratel-gap");
    });
    if (!activ) return;

    // Un rand bifat ocupa loc chiar daca e gol (ex. numerele unei celule
    // netestate). Altfel randul gol ar ramane pe langa felii si ar impinge
    // continutul afara din celula.
    const randuri = toate.filter(({ el }) => getComputedStyle(el).display !== "none");
    if (!randuri.length) return;

    const disponibil = celula.clientWidth - 2 * cfgCompozitie.spatiu_lateral;
    const gapuri = (randuri.length - 1) * cfgCompozitie.gap_vertical;
    const spatiu = celula.clientHeight - gapuri;
    const pondere = (id) => cfgCompozitie.felii[id] ?? 1;
    const totalPonderi = randuri.reduce((sum, { id }) => sum + pondere(id), 0);
    const toateBifate = randuri.length === Object.keys(CLASE_COMPONENTE).length;
    const { factor_patratele: factorPatratele, deplasare_verticala: deplasare } =
      cfgCompozitie.toate_bifate;

    randuri.forEach(({ id, el }) => {
      // Inaltimea se imparte dupa ponderi, nu egal: faptul primeste mai mult.
      // Ponderile sunt globale, deci randurile raman aliniate intre celule.
      const felie = (spatiu * pondere(id)) / totalPonderi;
      el.style.height = `${felie}px`;

      const latimeNaturala = el.scrollWidth;
      const inaltimeNaturala = cfgCompozitie.inaltimi[id];
      // Randul gol isi tine locul, dar nu are ce scala.
      if (!latimeNaturala || !disponibil) return;

      // Creste cat permite lateralul, dar fara sa iasa din felia lui.
      let factor = Math.min(disponibil / latimeNaturala, felie / inaltimeNaturala);
      if (toateBifate && id === "patratele") factor *= factorPatratele;

      if (id === "patratele") {
        // Cresc patratelele in sine, nu cutia lor.
        el.style.setProperty("--viz3-patratel-dim", `${DIM_PATRATEL * factor}px`);
        el.style.setProperty("--viz3-patratel-gap", `${GAP_PATRATEL * factor}px`);
      } else {
        // Textul creste prin font, deci cutia ramane inalta cat felia si
        // randurile nu se pot suprapune.
        const fontBaza = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${fontBaza * factor}px`;
        el.style.lineHeight = `${felie}px`;
      }
      // Cu toate bifate, scrisul si patratelele coboara spre randul cu numere.
      if (toateBifate && id !== "detaliu") el.style.top = `${deplasare}px`;
    });
  }

  function randeazaControlCompozitie(grup, axa) {
    axa.optiuni.forEach((opt) => {
      compozitie[opt.id] = opt.activa === true;
      const rand = document.createElement("label");
      rand.className = "viz3-optiune";
      if (opt.modificator) rand.classList.add("viz3-optiune--modificator");
      const bifa = document.createElement("input");
      bifa.type = "checkbox";
      bifa.checked = opt.activa === true;
      const text = document.createElement("span");
      text.textContent = opt.eticheta;
      bifa.addEventListener("change", () => {
        compozitie[opt.id] = bifa.checked;
        aplicaCompozitie();
      });
      rand.append(bifa, text);
      grup.appendChild(rand);
    });
  }

  function randeazaControlFolii(grup, axa) {
    const comutator = document.createElement("label");
    comutator.className = "viz3-optiune";
    const bifa = document.createElement("input");
    bifa.type = "checkbox";
    const textBifa = document.createElement("span");
    textBifa.textContent = "Activează foliile";
    comutator.append(bifa, textBifa);

    const randButoane = document.createElement("div");
    randButoane.className = "viz3-folii-butoane";
    const butoane = axa.optiuni.map((opt) => {
      const buton = document.createElement("button");
      buton.type = "button";
      buton.className = "viz3-buton-aranjament";
      buton.textContent = opt.eticheta;
      buton.title = opt.titlu;
      buton.disabled = true;
      buton.dataset.aranjament = opt.id;
      if (opt.activa) buton.classList.add("viz3-buton-aranjament--activ");
      buton.addEventListener("click", () => {
        aranjamentCurent = opt.id;
        butoane.forEach((b) =>
          b.classList.toggle("viz3-buton-aranjament--activ", b === buton)
        );
        aplicaAranjament();
      });
      randButoane.appendChild(buton);
      return buton;
    });

    bifa.addEventListener("change", () => {
      foliiActive = bifa.checked;
      butoane.forEach((b) => (b.disabled = !foliiActive));
      aplicaAranjament();
    });

    grup.append(comutator, randButoane);
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

        if (axa.tip_control === "folii") {
          randeazaControlFolii(grup, axa);
          sectiune.appendChild(grup);
          return;
        }

        if (axa.tip_control === "compozitie") {
          randeazaControlCompozitie(grup, axa);
          sectiune.appendChild(grup);
          return;
        }

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

    // Detaliul se randează mereu (gol la netestat), ca toate celulele să aibă
    // aceleași rânduri și aceeași înălțime.
    const detaliu = document.createElement("div");
    detaliu.className = "viz3-celula-detaliu";
    if (celula.n > 0) {
      const timp = celula.mediana_timp === null ? "-" : `${celula.mediana_timp.toFixed(1)}s`;
      const precizie =
        celula.precizie_prima === null ? "-" : `${Math.round(celula.precizie_prima * 100)}%`;
      detaliu.textContent = `n=${celula.n} · ${precizie} · ${timp}`;
    }

    el.append(eticheta, stare, patratele, detaliu);
    return el;
  }

  // O poziție fără celula stării foliei rămâne un contur-fantomă: păstrează
  // reperul poziției în tablă, fără să adauge informație.
  function randeazaFantoma(celula) {
    const el = document.createElement("div");
    el.className = "viz3-fantoma";
    el.style.gridColumn = String(celula.coloana);
    el.style.gridRow = String(celula.rand);
    return el;
  }

  function randeazaFolie(model, folie) {
    const el = document.createElement("div");
    el.className = "viz3-folie";
    el.dataset.folie = folie.id;

    const titlu = document.createElement("span");
    titlu.className = "viz3-folie-titlu";
    titlu.textContent = folie.eticheta;

    const grila = document.createElement("div");
    grila.className = "viz3-grila";
    model.celule.forEach((celula) => {
      const areStarea = folie.stari.includes(celula.stare);
      grila.appendChild(areStarea ? randeazaCelula(celula) : randeazaFantoma(celula));
    });

    el.append(titlu, grila);
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

    // Tabla = 4 folii transparente suprapuse. Suprapuse arată exact ca tabla
    // întreagă, fiindcă un fact are exact o stare.
    const stiva = document.createElement("div");
    stiva.className = "viz3-folii";
    folii.forEach((folie) => stiva.appendChild(randeazaFolie(model, folie)));
    container.appendChild(stiva);
    aplicaAranjament();
  }

  // ---- flux principal ---------------------------------------------------

  const motor = global.MotorAnalizaVizualizare3;
  const catalog = global.CatalogTablaInmultirii;
  const praguri = global.ConfigPraguriVizualizare3;
  const axe = global.DefinitiiAxeVizualizare3;
  const folii = global.DefinitiiFoliiVizualizare3;
  const cfgCompozitie = global.DefinitiiCompozitieVizualizare3;
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
