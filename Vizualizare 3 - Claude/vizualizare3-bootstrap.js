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
  let glisareAleatoare = true;
  let reasezareAleatoare = true;
  let deplasareCurenta = { col: 0, rnd: 0 };
  let proportieRamanePeLoc = 0;
  let grupareIntermediara = true;
  let cfgGrupare = {};
  let ceasGrup = null;
  // Cat a durat ultima trecere: dubla, daca a avut act intermediar. Ceasul
  // automat asteapta atat, ca pauza sa se numere tot de la asezare.
  let durataTranzitiei = 0;
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

  // Panza pe care plutesc aranjamentele: cat cere cel mai mare dintre ele.
  // Un aranjament nou, mai lat, o creste automat. Functie, nu constanta: asa
  // nu depinde de ordinea in care se initializeaza modulele.
  function panzaMax() {
    const forme = Object.values(aranjamente);
    return {
      coloane: Math.max(...forme.map((a) => a.coloane)),
      randuri: Math.max(...forme.map((a) => a.randuri)),
    };
  }

  function intregAleator(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function amesteca(lista) {
    const copie = [...lista];
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  // Alege ce folii se strang si in ce grupuri. Lista goala = trecere directa,
  // fara act intermediar.
  function alegeGrupuri(nrFolii) {
    if (!grupareIntermediara) return [];
    if (Math.random() >= cfgGrupare.proportie_cu_grup) return [];
    const tipare = cfgGrupare.tipare_grup;
    const tipar = tipare[Math.floor(Math.random() * tipare.length)];
    const indici = amesteca([...Array(nrFolii).keys()]);
    const grupuri = [];
    let luate = 0;
    tipar.forEach((marime) => {
      if (luate + marime <= indici.length) {
        grupuri.push(indici.slice(luate, luate + marime));
        luate += marime;
      }
    });
    return grupuri;
  }

  // Unde se intalnesc: un slot tras la sorti, slotul unuia dintre ei, sau la
  // mijlocul drumului. Mijlocul poate cadea intre sloturi, ceea ce e in regula:
  // formula pozitiei accepta si coordonate fractionare.
  function loculIntalnirii(membri, acum) {
    const mod = Math.floor(Math.random() * 3);
    if (mod === 0) {
      const panza = panzaMax();
      return {
        col: intregAleator(0, panza.coloane - 1),
        rnd: intregAleator(0, panza.randuri - 1),
      };
    }
    if (mod === 1) {
      return acum[membri[Math.floor(Math.random() * membri.length)]];
    }
    const medie = (cheie) =>
      membri.reduce((suma, i) => suma + acum[i][cheie], 0) / membri.length;
    return { col: medie("col"), rnd: medie("rnd") };
  }

  // Unde ajunge fiecare folie. Cu glisare aleatoare, sloturile se amestecă,
  // deci o folie nu ajunge mereu în același loc.
  // `pastreazaLocul` = rămâne în exact același loc pe pânză, deci se vede doar
  // reordonarea foliilor în interiorul formei.
  function coordonateDestinatie(stiva, pastreazaLocul) {
    const foliiEl = [...stiva.querySelectorAll(".viz3-folie")];
    const grila = aranjamente[stiva.dataset.aranjament] ?? aranjamente.suprapus;
    const indici = foliiEl.map((_, i) => i);
    const sloturi = glisareAleatoare ? amesteca(indici) : indici;
    const ultimSlot = grila.coloane * grila.randuri - 1;

    // Aranjamentul intreg se aseaza undeva pe panza. Libertatea e exact cat
    // ramane dupa ce incape forma lui: un rand de 4 se poate misca doar pe
    // verticala, un patrat 2x2 in ambele directii, o singura folie oriunde.
    const panza = panzaMax();
    const maxCol = panza.coloane - grila.coloane;
    const maxRnd = panza.randuri - grila.randuri;
    if (!pastreazaLocul) {
      deplasareCurenta = reasezareAleatoare
        ? { col: intregAleator(0, maxCol), rnd: intregAleator(0, maxRnd) }
        : { col: 0, rnd: 0 };
    }
    // Locul pastrat se strange in forma curenta, daca ea e mai lata.
    const deplasare = {
      col: Math.min(deplasareCurenta.col, maxCol),
      rnd: Math.min(deplasareCurenta.rnd, maxRnd),
    };

    return foliiEl.map((_, i) => {
      const slot = Math.min(sloturi[i], ultimSlot);
      return {
        col: (slot % grila.coloane) + deplasare.col,
        rnd: Math.floor(slot / grila.coloane) + deplasare.rnd,
      };
    });
  }

  function coordonateCurente(foliiEl) {
    return foliiEl.map((el) => ({
      col: parseFloat(el.style.getPropertyValue("--col")) || 0,
      rnd: parseFloat(el.style.getPropertyValue("--rnd")) || 0,
    }));
  }

  function valoareCss(nume, implicit) {
    const v = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(nume)
    );
    return Number.isFinite(v) ? v : implicit;
  }

  // Fiecare titlu porneste de la offsetul lui fix (un sfert de latime, in
  // ordinea progresiei) si ramane la fontul maxim daca in dreapta lui e loc
  // gol. Daca ar calca peste titlul vecin, se micsoreaza cat sa incapa in
  // sfertul lui. De aici iese singur si cazul suprapus (vecinul e la +25%,
  // deci toate se micsoreaza) si cel desfacut (vecinul e departe, font mare).
  function potrivesteTitlurile(foliiEl, coord) {
    const W = dimensiuneFolie;
    const latimeTablei = latimeTabla();
    if (!W || !latimeTablei) return;
    const scara = W / latimeTablei;
    const gap = valoareCss("--viz3-folie-gap", 16);
    const fontMax = valoareCss("--viz3-titlu-font-max", 40);
    const spatiu = valoareCss("--viz3-titlu-spatiu", 4);
    const sfert = W / 4;

    const titluri = foliiEl.map((el, i) => {
      const t = el.querySelector(".viz3-folie-titlu");
      t.style.fontSize = `${fontMax}px`;
      return {
        el: t,
        x: coord[i].col * (W + gap) + (i * W) / 4,
        rnd: coord[i].rnd,
        latNaturala: t.scrollWidth * scara,
      };
    });

    const dupaX = [...titluri].sort((a, b) => a.x - b.x);
    dupaX.forEach((t, k) => {
      if (!t.latNaturala) return;
      // Doar titlurile de pe ACELASI rand se pot calca. Cele de pe randuri
      // diferite sunt la sute de pixeli pe verticala, oricat de aproape ar
      // parea pe orizontala.
      const vecin = dupaX
        .slice(k + 1)
        .find((alt) => Math.abs(alt.rnd - t.rnd) < TOLERANTA_RAND);
      const panaLaVecin = vecin ? vecin.x - t.x : Infinity;
      // Casuta din dreapta e goala? Titlul o poate ocupa, deci ramane mare.
      // E plina? Se strange in sfertul lui.
      const incape = t.latNaturala + spatiu <= panaLaVecin;
      const latimeTinta = incape ? t.latNaturala : sfert - spatiu;
      const factor = Math.min(1, Math.max(0.05, latimeTinta / t.latNaturala));
      t.el.style.fontSize = `${fontMax * factor}px`;
    });
  }

  function aplicaCoordonate(foliiEl, coord) {
    foliiEl.forEach((el, i) => {
      el.style.setProperty("--col", String(coord[i].col));
      el.style.setProperty("--rnd", String(coord[i].rnd));
    });
    potrivesteTitlurile(foliiEl, coord);
  }

  function aseazaFoliile(stiva, pastreazaLocul = false) {
    const foliiEl = [...stiva.querySelectorAll(".viz3-folie")];
    if (!foliiEl.length) return;
    if (ceasGrup) {
      clearTimeout(ceasGrup);
      ceasGrup = null;
    }

    const finale = coordonateDestinatie(stiva, pastreazaLocul);
    const grupuri = alegeGrupuri(foliiEl.length);

    if (!grupuri.length) {
      aplicaCoordonate(foliiEl, finale);
      durataTranzitiei = vitezaReasezare;
      return;
    }

    // Actul 1: grupurile se strang. Cine nu e in niciun grup asteapta pe loc.
    const acum = coordonateCurente(foliiEl);
    const intermediare = [...acum];
    const destinatii = [...finale];
    grupuri.forEach((membri) => {
      const intalnire = loculIntalnirii(membri, acum);
      membri.forEach((i) => (intermediare[i] = intalnire));
      // Uneori grupul nu se mai desface: ramane suprapus si in destinatie,
      // deci un slot ramane gol.
      if (Math.random() < cfgGrupare.proportie_grup_ramane) {
        const gazda = membri[Math.floor(Math.random() * membri.length)];
        membri.forEach((i) => (destinatii[i] = finale[gazda]));
      }
    });

    aplicaCoordonate(foliiEl, intermediare);
    // Actul 2: de la grup spre destinatie, dupa ce primul act s-a terminat.
    ceasGrup = setTimeout(() => aplicaCoordonate(foliiEl, destinatii), vitezaReasezare);
    durataTranzitiei = 2 * vitezaReasezare;
  }

  function aplicaAranjament() {
    const stiva = document.querySelector(".viz3-folii");
    if (!stiva) return;
    stiva.dataset.aranjament = foliiActive ? aranjamentCurent : "suprapus";
    aseazaFoliile(stiva);
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

  // Repetarea aceleiași forme are voie doar dacă se vede ceva: adică dacă
  // foliile se pot reamesteca între sloturi. La suprapus stau toate în aceeași
  // celulă, deci acolo repetarea n-ar schimba nimic — se schimbă mereu forma.
  function repetareaSeVede() {
    const grila = aranjamente[aranjamentCurent] ?? aranjamente.suprapus;
    return glisareAleatoare && grila.coloane * grila.randuri > 1;
  }

  function reamestecaPeLoc() {
    const stiva = document.querySelector(".viz3-folii");
    if (!stiva) return;
    aseazaFoliile(stiva, true);
  }

  function pozitieAleatoare() {
    // Uneori rămâne în exact aceeași formă și același loc, doar reordonează
    // foliile: contrastul dintre „s-a mutat" și „doar s-a rearanjat".
    if (repetareaSeVede() && Math.random() < proportieRamanePeLoc) {
      reamestecaPeLoc();
      return;
    }
    const toate = butoaneAranjament.map((b) => b.dataset.aranjament);
    const candidati = repetareaSeVede()
      ? toate
      : toate.filter((id) => id !== aranjamentCurent);
    if (!candidati.length) return;
    schimbaAranjament(candidati[Math.floor(Math.random() * candidati.length)]);
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
      // Trecerea cu act intermediar dureaza dublu; pauza se numara dupa ea.
      programeazaAuto(durataTranzitiei + autoSecunde * 1000);
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
  // Cat de aproape trebuie sa fie doua folii pe verticala ca titlurile lor sa
  // se poata calca. Randurile sunt la sute de px distanta, iar intalnirile
  // intermediare pot da si randuri fractionare.
  const TOLERANTA_RAND = 0.1;

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
    // sincronizeazaDimensiune), nu aici. `laSchimbare` porneste si starea
    // interna, altfel controlul ar arata o valoare iar codul ar folosi alta.
    if (reglaj.implicit !== undefined && reglaj.max !== null) {
      slider.value = String(reglaj.implicit);
      arata();
      laSchimbare(reglaj.implicit);
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
    laSchimbare(Number(camp.value));
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

    const randAleator = document.createElement("label");
    randAleator.className = "viz3-optiune";
    const bifaAleator = document.createElement("input");
    bifaAleator.type = "checkbox";
    bifaAleator.checked = axa.glisare_aleatoare_implicit === true;
    glisareAleatoare = bifaAleator.checked;
    const textAleator = document.createElement("span");
    textAleator.textContent = "Glisează la poziție aleatoare";
    bifaAleator.addEventListener("change", () => {
      glisareAleatoare = bifaAleator.checked;
      aplicaAranjament();
    });
    randAleator.append(bifaAleator, textAleator);

    const randReasezare = document.createElement("label");
    randReasezare.className = "viz3-optiune";
    const bifaReasezare = document.createElement("input");
    bifaReasezare.type = "checkbox";
    bifaReasezare.checked = axa.reasezare_aleatoare_implicit === true;
    reasezareAleatoare = bifaReasezare.checked;
    proportieRamanePeLoc = axa.proportie_ramane_pe_loc ?? 0;
    const textReasezare = document.createElement("span");
    textReasezare.textContent = "Reașezare pe linie/coloană random";
    bifaReasezare.addEventListener("change", () => {
      reasezareAleatoare = bifaReasezare.checked;
      aplicaAranjament();
    });
    randReasezare.append(bifaReasezare, textReasezare);

    const randGrup = document.createElement("label");
    randGrup.className = "viz3-optiune";
    const bifaGrup = document.createElement("input");
    bifaGrup.type = "checkbox";
    bifaGrup.checked = axa.grupare_implicita === true;
    grupareIntermediara = bifaGrup.checked;
    cfgGrupare = {
      proportie_cu_grup: axa.proportie_cu_grup ?? 0.5,
      tipare_grup: axa.tipare_grup ?? [[2]],
      proportie_grup_ramane: axa.proportie_grup_ramane ?? 0.5,
    };
    const textGrup = document.createElement("span");
    textGrup.textContent = "Grupează intermediar 2-3 suprapuneri de folii";
    bifaGrup.addEventListener("change", () => {
      grupareIntermediara = bifaGrup.checked;
    });
    randGrup.append(bifaGrup, textGrup);

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

    const deActivat = [
      bifaAleator,
      bifaReasezare,
      bifaGrup,
      dimensiune.slider,
      viteza.slider,
      ...auto.controale,
    ];
    deActivat.forEach((el) => (el.disabled = !foliiActive));
    bifa.addEventListener("change", () => {
      foliiActive = bifa.checked;
      butoane.forEach((b) => (b.disabled = !foliiActive));
      deActivat.forEach((el) => (el.disabled = !foliiActive));
      aplicaAranjament();
      aplicaAuto();
    });

    grup.append(
      comutator,
      randAleator,
      randReasezare,
      randGrup,
      randButoane,
      dimensiune.rand,
      viteza.rand,
      auto.rand
    );
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
    // Panza isi ia marimea din datele aranjamentelor, nu din CSS.
    const panza = panzaMax();
    document.documentElement.style.setProperty("--viz3-panza-coloane", String(panza.coloane));
    document.documentElement.style.setProperty("--viz3-panza-randuri", String(panza.randuri));
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
  const aranjamente = global.DefinitiiAranjamenteVizualizare3;
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
