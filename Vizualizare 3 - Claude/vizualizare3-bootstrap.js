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

  // Reglajele foliilor. `dimensiuneFolie` rămâne null până măsurăm tabla.
  let dimensiuneFolie = null;
  let vitezaReasezare = 300;
  let autoSecunde = 0;
  let ceasAuto = null;
  let butoaneAranjament = [];
  let sliderDimensiune = null;
  let reglajDimensiune = null;

  // Maximul slider-ului = latimea reala a tablei, masurata dupa randare, ca sa
  // nu duplicam aici dimensiunile din CSS. Maximul se pune INAINTE de valoare:
  // altfel implicitul ar fi taiat de maximul HTML implicit (100).
  function sincronizeazaDimensiune() {
    const latime = latimeTabla();
    if (!latime || !sliderDimensiune) return;
    sliderDimensiune.slider.max = String(latime);
    if (dimensiuneFolie === null) {
      dimensiuneFolie = Math.min(reglajDimensiune?.implicit ?? latime, latime);
      sliderDimensiune.slider.value = String(dimensiuneFolie);
    }
    sliderDimensiune.arata();
    aplicaDimensiune();
  }

  function aplicaAranjament() {
    const stiva = document.querySelector(".viz3-folii");
    if (!stiva) return;
    stiva.dataset.aranjament = foliiActive ? aranjamentCurent : "suprapus";
    aplicaCompozitie();
  }

  function latimeTabla() {
    const grila = document.querySelector(".viz3-grila");
    return grila ? grila.offsetWidth : 0;
  }

  // O singură dimensiune, folosită și suprapus, și desfăcut.
  function aplicaDimensiune() {
    const latime = latimeTabla();
    if (!latime || dimensiuneFolie === null) return;
    document.documentElement.style.setProperty(
      "--viz3-folie-scara",
      String(dimensiuneFolie / latime)
    );
  }

  function aplicaViteza() {
    document.documentElement.style.setProperty("--viz3-durata", `${vitezaReasezare}ms`);
  }

  function schimbaAranjament(id) {
    aranjamentCurent = id;
    butoaneAranjament.forEach((b) =>
      b.classList.toggle("viz3-buton-aranjament--activ", b.dataset.aranjament === id)
    );
    aplicaAranjament();
  }

  // Alege o poziție la întâmplare, mereu diferită de cea curentă.
  function pozitieAleatoare() {
    const altele = butoaneAranjament
      .map((b) => b.dataset.aranjament)
      .filter((id) => id !== aranjamentCurent);
    if (!altele.length) return;
    schimbaAranjament(altele[Math.floor(Math.random() * altele.length)]);
  }

  // Pauza se numără DE LA AȘEZARE, nu de la pornirea mișcării. Deci ciclul e
  // `tranziție + pauză`, iar foliile ajung mereu la destinație înainte să
  // primească alt ordin — oricât de lentă ar fi reașezarea.
  function programeazaAuto(intarziere) {
    if (ceasAuto) {
      clearTimeout(ceasAuto);
      ceasAuto = null;
    }
    if (autoSecunde <= 0 || !foliiActive) return;
    ceasAuto = setTimeout(() => {
      pozitieAleatoare();
      programeazaAuto(vitezaReasezare + autoSecunde * 1000);
    }, intarziere);
  }

  function aplicaAuto() {
    // Prima mutare: doar pauza, foliile sunt deja așezate.
    programeazaAuto(autoSecunde * 1000);
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
    // Se aplica in toate aranjamentele, ca celulele sa arate la fel peste tot.
    stiva
      .querySelectorAll(".viz3-celula")
      .forEach((celula) => aplicaUmplereCelula(celula, compozitie.umple));
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

  function randeazaSlider(reglaj, laSchimbare) {
    const rand = document.createElement("div");
    rand.className = "viz3-reglaj";
    const cap = document.createElement("div");
    cap.className = "viz3-reglaj-cap";
    const eticheta = document.createElement("span");
    eticheta.textContent = reglaj.eticheta;
    const valoare = document.createElement("span");
    valoare.className = "viz3-reglaj-valoare";
    cap.append(eticheta, valoare);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(reglaj.min);
    if (reglaj.max !== null) slider.max = String(reglaj.max);
    slider.step = String(reglaj.pas);
    slider.disabled = true;

    const arata = () => {
      valoare.textContent = `${slider.value} ${reglaj.unitate}`;
    };
    slider.addEventListener("input", () => {
      arata();
      laSchimbare(Number(slider.value));
    });

    // Cand maximul se afla abia la randare, valoarea se pune acolo (vezi
    // sincronizeazaDimensiune), nu aici.
    if (reglaj.implicit !== undefined && reglaj.max !== null) {
      slider.value = String(reglaj.implicit);
      arata();
    }
    rand.append(cap, slider);
    return { rand, slider, arata };
  }

  function randeazaNumar(reglaj, laSchimbare) {
    const rand = document.createElement("div");
    rand.className = "viz3-reglaj";
    const eticheta = document.createElement("span");
    eticheta.className = "viz3-reglaj-eticheta";
    eticheta.textContent = reglaj.eticheta;

    const linie = document.createElement("div");
    linie.className = "viz3-reglaj-numar";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    const camp = document.createElement("input");
    camp.type = "number";
    camp.min = String(reglaj.min);
    camp.max = String(reglaj.max);
    camp.step = String(reglaj.pas);
    camp.value = String(reglaj.implicit ?? reglaj.min);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    const unitate = document.createElement("span");
    unitate.className = "viz3-reglaj-unitate";
    unitate.textContent = reglaj.nota ? `${reglaj.unitate} (${reglaj.nota})` : reglaj.unitate;

    const pune = (v) => {
      const limitat = Math.min(reglaj.max, Math.max(reglaj.min, v));
      camp.value = String(limitat);
      laSchimbare(limitat);
    };
    minus.addEventListener("click", () => pune(Number(camp.value) - reglaj.pas));
    plus.addEventListener("click", () => pune(Number(camp.value) + reglaj.pas));
    camp.addEventListener("change", () => pune(Number(camp.value)));

    [minus, camp, plus].forEach((el) => (el.disabled = true));
    linie.append(minus, camp, plus, unitate);
    rand.append(eticheta, linie);
    return { rand, controale: [minus, camp, plus] };
  }

  function randeazaControlFolii(grup, axa) {
    const comutator = document.createElement("label");
    comutator.className = "viz3-optiune";
    const bifa = document.createElement("input");
    bifa.type = "checkbox";
    bifa.checked = axa.activ_implicit === true;
    foliiActive = bifa.checked;
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
      buton.disabled = !foliiActive;
      buton.dataset.aranjament = opt.id;
      if (opt.activa) buton.classList.add("viz3-buton-aranjament--activ");
      buton.addEventListener("click", () => schimbaAranjament(opt.id));
      randButoane.appendChild(buton);
      return buton;
    });
    butoaneAranjament = butoane;

    const reglaje = axa.reglaje ?? [];
    const gasesteReglaj = (id) => reglaje.find((r) => r.id === id);

    reglajDimensiune = gasesteReglaj("dimensiune");
    const dimensiune = randeazaSlider(reglajDimensiune, (v) => {
      dimensiuneFolie = v;
      aplicaDimensiune();
    });
    sliderDimensiune = dimensiune;

    const viteza = randeazaSlider(gasesteReglaj("viteza"), (v) => {
      vitezaReasezare = v;
      aplicaViteza();
    });

    const auto = randeazaNumar(gasesteReglaj("auto"), (v) => {
      autoSecunde = v;
      aplicaAuto();
    });

    const deActivat = [dimensiune.slider, viteza.slider, ...auto.controale];
    deActivat.forEach((el) => (el.disabled = !foliiActive));
    bifa.addEventListener("change", () => {
      foliiActive = bifa.checked;
      butoane.forEach((b) => (b.disabled = !foliiActive));
      deActivat.forEach((el) => (el.disabled = !foliiActive));
      aplicaAranjament();
      aplicaAuto();
    });

    grup.append(comutator, randButoane, dimensiune.rand, viteza.rand, auto.rand);
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
    sincronizeazaDimensiune();
    aplicaViteza();
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

  // Butonul oferă mereu sursa PE CARE NU o vezi acum.
  function comutaSursa(container, aratamFixture) {
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = aratamFixture
      ? "Folosește jurnalul real"
      : "Folosește fixture demonstrativ";
    buton.addEventListener("click", () => porneste({ forteazaFixture: !aratamFixture }));
    container.querySelector(".viz3-sursa")?.appendChild(buton);
  }

  async function porneste({ forteazaFixture }) {
    const reale = forteazaFixture ? [] : await citesteJurnalul();
    if (!forteazaFixture && reale.length > 0) {
      analizeazaSiRandeaza(reale, `Sursă: jurnal real (${reale.length} apăsări).`);
      comutaSursa(vizEl, false);
    } else {
      const dummy = fixture.construiesteFixture();
      const motiv = forteazaFixture ? "" : " (jurnal real gol)";
      analizeazaSiRandeaza(dummy, `Sursă: fixture demonstrativ${motiv}.`);
      comutaSursa(vizEl, true);
    }
  }

  randeazaControlPanel(cpEl, axe);
  porneste({ forteazaFixture: false });
})(typeof globalThis !== "undefined" ? globalThis : this);
