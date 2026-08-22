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

  // Sterge tot ce e in store si pune in loc exact `inregistrari`, in ordinea
  // primita (ordinea = timp, vezi motor-analiza.js). Un singur loc care scrie
  // in bloc in jurnalul real — folosit de Replace si de Merge (Merge doar
  // calculeaza alt array de intrare, cu combinaFaraDuplicate, inainte).
  // Deliberat NU trece prin JurnalIntrebari.inregistreazaIntrebare: acela e
  // contractul cu o singura metoda aprobata pt. apasari reale din quiz
  // (vezi tests/jurnal-intrebari.test.js), nu pt. rescriere in bloc dintr-un
  // fisier extern.
  function inlocuiesteStoreJurnal(inregistrari) {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error("IndexedDB nu este disponibil."));
        return;
      }
      const cerere = global.indexedDB.open(NUME_BAZA_DATE);
      cerere.onupgradeneeded = () => {
        const baza = cerere.result;
        if (!baza.objectStoreNames.contains(NUME_COLECTIE)) {
          baza.createObjectStore(NUME_COLECTIE, { autoIncrement: true });
        }
      };
      cerere.onerror = () => reject(cerere.error);
      cerere.onsuccess = () => {
        const baza = cerere.result;
        const tranzactie = baza.transaction(NUME_COLECTIE, "readwrite");
        const store = tranzactie.objectStore(NUME_COLECTIE);
        store.clear();
        inregistrari.forEach((inregistrare) => store.add(inregistrare));
        tranzactie.oncomplete = () => {
          baza.close();
          resolve(inregistrari.length);
        };
        tranzactie.onerror = () => {
          baza.close();
          reject(tranzactie.error);
        };
        tranzactie.onabort = () => {
          baza.close();
          reject(tranzactie.error);
        };
      };
    });
  }

  // Un nume fix ar parea logic, dar Firefox nu suprascrie descarcarile: adauga
  // "(1)", "(2)"... la fiecare export nou, deci fisierele se aduna oricum. Mai
  // bine data+ora in nume: fiecare export ramane distinct si se intelege cand
  // a fost facut, nu doar al catelea e. Acelasi tipar la orice export din
  // pagina (jurnal, preseturi): doar prefixul se schimba.
  function numeFisierExport(prefix) {
    const acum = new Date();
    const doiDigiti = (n) => String(n).padStart(2, "0");
    const ziua = [acum.getFullYear(), doiDigiti(acum.getMonth() + 1), doiDigiti(acum.getDate())].join("-");
    const ora = [doiDigiti(acum.getHours()), doiDigiti(acum.getMinutes())].join("-");
    return `youlearn-${prefix}-${ziua}-${ora}.json`;
  }

  // Descarca orice lista de inregistrari ca fisier JSON, cu numele standard
  // (prefix + data + ora). Un singur loc: il folosesc si exportul manual, si
  // copia de rezerva automata dinaintea unui Replace.
  function descarcaJson(inregistrari, prefix) {
    const json = JSON.stringify(inregistrari, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = numeFisierExport(prefix);
    link.click();
    URL.revokeObjectURL(url);
  }

  // Buton care descarca jurnalul brut (asa cum sta in IndexedDB) ca JSON, ca
  // sa poata fi verificat in afara browserului, fara copy-paste din consola.
  function butonDescarcaJurnal() {
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = "Export log JSON in Downloads";
    buton.addEventListener("click", async () => {
      descarcaJson(await citesteJurnalul(), "salvare-log-activitate");
    });
    return buton;
  }

  // Buton care incarca inapoi un export facut cu butonul de mai sus, ca si
  // cum ar veni din IndexedDB. Browserul nu lasa o pagina sa citeasca singura
  // folderul Downloads (ar fi o gaura de securitate: orice site ar putea vedea
  // ce ai descarcat) — alegerea fisierului ramane a userului. Dialogul nativ
  // porneste de obicei chiar din Downloads, deci exportul cel mai recent e
  // primul vizibil daca sortezi dupa data.
  function butonImportaJurnal() {
    const fragment = document.createDocumentFragment();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.hidden = true;
    input.addEventListener("change", async () => {
      const fisier = input.files?.[0];
      input.value = "";
      if (!fisier) return;
      try {
        const inregistrari = JSON.parse(await fisier.text());
        if (!Array.isArray(inregistrari)) {
          throw new Error("fisierul nu contine o listă de apăsări");
        }
        salveazaImport(fisier.name, inregistrari);
        // Cine tocmai a importat vrea sa vada ce a importat.
        sursaActiva = "import";
        salveazaSursaActiva();
        reseteazaVizualizarea();
      } catch (eroare) {
        global.alert?.(`„${fisier.name}" nu poate fi citit ca jurnal: ${eroare.message}`);
      }
    });
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = "Import log JSON din Downloads";
    buton.addEventListener("click", () => input.click());
    fragment.append(buton, input);
    return fragment;
  }

  // Validare minima pt. un fisier care va scrie in jurnalul REAL (Replace/
  // Merge), nu doar pt. vizualizare: verificam ce chiar folosim noi mai
  // departe (array, obiecte, data_ora_ro pt. sortare) — nu reinventam
  // validarea completa pe 18 campuri din js/jurnal-intrebari.js (ramane
  // acolo, contract cu o singura metoda aprobata).
  function valideazaListaImportata(inregistrari) {
    if (!Array.isArray(inregistrari)) {
      throw new Error("fisierul nu contine o listă de apăsări");
    }
    inregistrari.forEach((inregistrare, index) => {
      if (
        !inregistrare ||
        typeof inregistrare !== "object" ||
        Array.isArray(inregistrare) ||
        typeof inregistrare.data_ora_ro !== "string"
      ) {
        throw new Error(`înregistrarea ${index + 1} nu are „data_ora_ro" valid`);
      }
    });
    return inregistrari;
  }

  // Pt. Merge: uneste ce e deja in IndexedDB cu ce vine din fisier, fara sa
  // numere de doua ori aceeasi apasare (continut identic — nu exista niciun
  // ID pe inregistrare), si reasaza tot setul cronologic dupa data_ora_ro.
  // Motorul citeste ordinea array-ului ca timp real (motor-analiza.js:66),
  // deci o simpla adaugare la coada n-ar respecta contractul daca fisierul
  // e mai vechi decat ce e deja in baza.
  function combinaFaraDuplicate(existente, dinFisier) {
    const cheieDe = (inregistrare) => JSON.stringify(inregistrare);
    const cheiExistente = new Set(existente.map(cheieDe));
    const dinFisierUnice = dinFisier.filter((inregistrare) => !cheiExistente.has(cheieDe(inregistrare)));
    const combinate = [...existente, ...dinFisierUnice].sort((a, b) => {
      if (a.data_ora_ro < b.data_ora_ro) return -1;
      if (a.data_ora_ro > b.data_ora_ro) return 1;
      return 0;
    });
    return { combinate, duplicateIgnorate: dinFisier.length - dinFisierUnice.length };
  }

  // Buton distructiv: sterge tot ce e in IndexedDB si pune in loc EXACT
  // continutul fisierului ales. De-aia, inainte sa stergem: (1) descarcam
  // automat o copie de rezerva a starii vechi, (2) cerem confirmare cu
  // numerele exacte, nu doar „esti sigur?". Dupa succes, comuta vizualizarea
  // pe „jurnal" — utilizatorul tocmai a rescris jurnalul real, normal sa-l
  // vada.
  function butonInlocuiesteJurnal() {
    const fragment = document.createDocumentFragment();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.hidden = true;
    input.addEventListener("change", async () => {
      const fisier = input.files?.[0];
      input.value = "";
      if (!fisier) return;
      try {
        const dinFisier = valideazaListaImportata(JSON.parse(await fisier.text()));
        const vechi = await citesteJurnalul();
        const confirmat = global.confirm?.(
          `Inlocuiesc jurnalul real din IndexedDB: se sterg ${vechi.length} înregistrări ` +
            `existente și se pun ${dinFisier.length} din „${fisier.name}".\n` +
            (vechi.length > 0
              ? `Se descarcă automat, mai întâi, o copie de rezervă a celor ${vechi.length} vechi.\n`
              : "") +
            `Continui?`
        );
        if (!confirmat) return;
        if (vechi.length > 0) descarcaJson(vechi, "backup-inainte-de-replace");
        const cate = await inlocuiesteStoreJurnal(dinFisier);
        sursaActiva = "jurnal";
        salveazaSursaActiva();
        reseteazaVizualizarea();
        global.alert?.(`Gata — jurnalul real are acum ${cate} înregistrări (din „${fisier.name}").`);
      } catch (eroare) {
        global.alert?.(`„${fisier.name}" nu poate fi folosit: ${eroare.message}`);
      }
    });
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = "Replace datele din IndexedDB cu JSON din Downloads";
    buton.addEventListener("click", () => input.click());
    fragment.append(buton, input);
    return fragment;
  }

  // Aditiv, nu distructiv: uneste fisierul cu ce e deja in IndexedDB
  // (combinaFaraDuplicate), apoi rescrie store-ul cu rezultatul sortat —
  // tehnic tot o rescriere in bloc (motorul cere ordine cronologica in
  // array, nu doar adaugare la coada), dar nimic din ce era acolo nu se
  // pierde. Confirmare simpla, fara backup automat (nimic nu e sters).
  function butonMergeJurnal() {
    const fragment = document.createDocumentFragment();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.hidden = true;
    input.addEventListener("change", async () => {
      const fisier = input.files?.[0];
      input.value = "";
      if (!fisier) return;
      try {
        const dinFisier = valideazaListaImportata(JSON.parse(await fisier.text()));
        const vechi = await citesteJurnalul();
        const { combinate, duplicateIgnorate } = combinaFaraDuplicate(vechi, dinFisier);
        const confirmat = global.confirm?.(
          `Combin ${vechi.length} existente cu ${dinFisier.length} din „${fisier.name}"` +
            (duplicateIgnorate > 0 ? ` (${duplicateIgnorate} identice, ignorate)` : "") +
            ` → ${combinate.length} în total.\nContinui?`
        );
        if (!confirmat) return;
        const cate = await inlocuiesteStoreJurnal(combinate);
        sursaActiva = "jurnal";
        salveazaSursaActiva();
        reseteazaVizualizarea();
        global.alert?.(`Gata — jurnalul real are acum ${cate} înregistrări.`);
      } catch (eroare) {
        global.alert?.(`„${fisier.name}" nu poate fi folosit: ${eroare.message}`);
      }
    });
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = "Merge datele din IndexedDB cu JSON din Downloads";
    buton.addEventListener("click", () => input.click());
    fragment.append(buton, input);
    return fragment;
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
  let titluriPe2Randuri = true;
  let titluriIncadrate = true;
  let caseteColorate = true;
  let alinireTitluriVerticala = "flex-end";
  let alinireTitluriOrizontala = "left";
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
  // Mărimea de dinainte de debifarea foliilor, ca rebifarea lor să o pună la loc:
  // tabla singură se lățește pe tot ecranul, dar aia e mărimea ei, nu a foliilor.
  let dimensiuneInainteDeStrans = null;
  // true după prima apăsare pe „Mărime tabel: − +". De-atunci mărimea o comandă
  // userul: nu se mai potrivește singură pe lățimea ecranului, nici la rotire.
  // Se uită la reîncărcarea paginii, ca orice alegere netransformată în default.
  let dimensiuneAleasaManual = false;
  // Cât crește/scade tabla la o apăsare. Multiplicativ, nu în pași fixi de px:
  // așa un pas se simte la fel și pe telefon (tabla mică), și pe PC (tabla mare).
  const PAS_ZOOM = 1.15;
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
    // Latimea tablei depinde de domeniu (1-10 e ingusta, 11-20 × 1-20 e de
    // doua ori mai lata). La trecerea spre un domeniu mai ingust, o dimensiune
    // ramasa de la unul lat ar face foliile mai mari decat tabla.
    if (dimensiuneFolie > latime) {
      dimensiuneFolie = latime;
      sliderDimensiune.slider.value = String(dimensiuneFolie);
    }
    sliderDimensiune.arata();
    aplicaDimensiune();
  }

  function puneDimensiuneFolie(valoare) {
    if (!sliderDimensiune) return;
    dimensiuneFolie = valoare;
    sliderDimensiune.slider.value = String(valoare);
    sliderDimensiune.arata();
    aplicaDimensiune();
  }

  // Cat loc are tabla pe latime in zona de vizualizare, fara paddingul ei.
  function latimeDisponibila() {
    if (!vizEl) return 0;
    const stil = getComputedStyle(vizEl);
    const padding = parseFloat(stil.paddingLeft) + parseFloat(stil.paddingRight);
    return Math.max(0, vizEl.clientWidth - padding);
  }

  // Cu foliile debifate se vede o singura tabla: ea se intinde pe toata latimea
  // disponibila, ca sa se poata citi si pe telefon, si pe PC. Nu trece de
  // marimea ei naturala (maximul sliderului): mai mult ar insemna doar sa umflam
  // o tabla care oricum incape.
  function potrivesteDimensiuneaLaEcran() {
    const latime = latimeTabla();
    const disponibil = latimeDisponibila();
    if (!latime || !disponibil) return;
    puneDimensiuneFolie(Math.min(disponibil, latime));
  }

  // Butoanele „− +" de langa titlul tablei. Limitele sunt exact cele ale
  // sliderului „Dimensiune folie": e aceeasi marime, comandata din doua locuri.
  function schimbaMarimeaTablei(factor) {
    if (!sliderDimensiune) return;
    const min = Number(sliderDimensiune.slider.min) || 10;
    const max = Number(sliderDimensiune.slider.max) || latimeTabla();
    const acum = dimensiuneFolie ?? max;
    dimensiuneAleasaManual = true;
    puneDimensiuneFolie(Math.round(Math.min(max, Math.max(min, acum * factor))));
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

  // Panza de care e nevoie ACUM. Plutirea are rost doar cat timp foliile chiar
  // se muta singure: fara ea (auto = 0, sau foliile oprite), panza se stramteaza
  // pe forma aranjamentului curent, ca div-ul sa nu mai tina spatiu gol in jurul
  // tablei. Efect secundar dorit: cu panza egala cu forma, `coordonateDestinatie`
  // n-are unde deplasa aranjamentul (maxCol/maxRnd = 0), deci el se aseaza fix in
  // coltul stanga-sus — chiar si cu „Reașezare pe linie/coloană random" bifata.
  function panzaCurenta() {
    if (foliiActive && autoSecunde > 0) return panzaMax();
    return aranjamente[foliiActive ? aranjamentCurent : "suprapus"] ?? aranjamente.suprapus;
  }

  // Marimea div-ului foliilor vine din datele aranjamentelor, nu din CSS.
  function sincronizeazaPanza() {
    const panza = panzaCurenta();
    document.documentElement.style.setProperty("--viz3-panza-coloane", String(panza.coloane));
    document.documentElement.style.setProperty("--viz3-panza-randuri", String(panza.randuri));
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
      const panza = panzaCurenta();
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
    // Cand panza e stransa pe forma (vezi `panzaCurenta`), libertatea e zero.
    const panza = panzaCurenta();
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

  // Cel mai mare font (sub `fontMax`) la care textul incape in `randuri`.
  // Numaram randurile, nu comparam pixeli: inaltimea reala iese cu ~7% peste
  // `line-height`, fiindca fontul adauga peste cutia randului.
  function fontCareIncape(el, randuri, fontMax) {
    let font = fontMax;
    for (let i = 0; i < MAX_PASI_POTRIVIRE; i += 1) {
      el.style.fontSize = `${font}px`;
      const incapeInRanduri =
        Math.round(el.scrollHeight / (INALTIME_RAND * font)) <= randuri;
      // Si pe latime: o bucata legata (ex. "+ Abia inceput") nu se rupe, deci
      // ar iesi lateral din caseta fara ca numarul de randuri sa se schimbe.
      const incapeInLatime = el.scrollWidth <= el.clientWidth + 1;
      if (incapeInRanduri && incapeInLatime) break;
      font *= PAS_POTRIVIRE;
    }
    return font;
  }

  // Alege asezarea titlurilor: cat mai putine randuri, dar fontul sa nu scada
  // sub prag. Toate titlurile primesc acelasi font, deci casutele arata la fel.
  // Se calculeaza o data, la randare: latimea casutei nu se schimba niciodata,
  // deci nici rezultatul. De-asta fontul nu mai zvacneste cand foliile se muta.
  function calculeazaFontulTitlurilor(foliiEl) {
    const titluri = foliiEl.map((el) => el.querySelector(".viz3-folie-titlu"));
    if (!titluri.length) return;
    const fontMax = valoareCss("--viz3-titlu-font-max", 40);
    const prag = valoareCss("--viz3-titlu-prag", 30);
    const randuriMax = Math.max(1, valoareCss("--viz3-titlu-randuri-max", 3));

    // Punem noi conditiile de masurare, in loc sa ne bazam ca le-a pus altcineva
    // inainte: altfel textul nu s-ar rupe si ar iesi mereu "incape pe un rand".
    // `transition: none` e obligatoriu: fontul e animat, iar fara asta fiecare
    // masuratoare ar citi marimea de DINAINTE de schimbare, nu pe cea pusa.
    // Latimea o da caseta; noi punem doar ce lipseste ca masuratoarea sa fie
    // corecta. `transition: none` e obligatoriu: fontul e animat, iar fara asta
    // fiecare masuratoare ar citi marimea de DINAINTE de schimbare.
    titluri.forEach((t) => {
      t.style.transition = "none";
      t.style.whiteSpace = "normal";
    });
    // Stergem rezultatul masuratorii dinainte: el e `min-height` pe casete, deci
    // am masura propriul nostru rezultat si inaltimea n-ar mai putea scadea
    // niciodata (ex. la un titlu mai scurt sau la un font mai mare).
    document.documentElement.style.removeProperty("--viz3-titlu-inaltime-calculata");

    let ales = fontMax;
    for (let randuri = 1; randuri <= randuriMax; randuri += 1) {
      ales = Math.min(...titluri.map((t) => fontCareIncape(t, randuri, fontMax)));
      if (ales >= prag) break;
    }

    // Fontul e comun, dar fiecare titlu se poate rupe pe alt numar de randuri
    // la acelasi font (unul scurt incape pe un rand, altul lung pe trei). Bara
    // fiecarei folii isi ia inaltimea doar din titlul ei, deci fara pasul asta
    // ar ramane inegale. Masuram toate la fontul ALES (nu la cel intermediar
    // din cautare) si retinem cea mai mare, ca s-o aplice toate casetele.
    // Masuram cu offsetHeight, nu scrollHeight: caseta e border-box, deci
    // min-height include si bordura (4px), pe care scrollHeight n-o numara.
    // Cu scrollHeight, caseta cu titlul cel mai lung iesea cu 4px mai inalta
    // decat celelalte trei (suprapuse peste ea) — de-aici bara "dublata".
    let inaltimeMaxima = 0;
    titluri.forEach((t) => {
      t.style.fontSize = `${ales}px`;
      inaltimeMaxima = Math.max(inaltimeMaxima, t.parentElement.offsetHeight);
    });

    titluri.forEach((t) => {
      t.style.fontSize = "";
      t.style.whiteSpace = "";
      t.style.transition = "";
    });
    document.documentElement.style.setProperty("--viz3-titlu-font-calculat", `${ales}px`);
    document.documentElement.style.setProperty("--viz3-titlu-inaltime-calculata", `${inaltimeMaxima}px`);
  }

  // Inaltimea barei de titluri, publicata pentru CSS. Din ea ies si spatiul de
  // deasupra tablei, si distanta pe verticala dintre folii — bara unei folii
  // sta deasupra ei, deci fara asta ar cadea peste folia de pe randul de sus.
  // Cu titluri pe 2 randuri, `calculeazaFontulTitlurilor` o afla oricum, ca
  // parte din egalizare; aici acoperim cazul in care bifa e stinsa.
  function masoaraTitlurile(foliiEl) {
    if (titluriPe2Randuri) {
      calculeazaFontulTitlurilor(foliiEl);
      return;
    }
    document.documentElement.style.removeProperty("--viz3-titlu-inaltime-calculata");
    const bare = foliiEl
      .map((el) => el.querySelector(".viz3-bara-titluri"))
      .filter(Boolean);
    if (!bare.length) return;
    const inalt = Math.max(...bare.map((b) => b.offsetHeight));
    document.documentElement.style.setProperty("--viz3-titlu-inaltime-calculata", `${inalt}px`);
  }

  // Fiecare titlu porneste de la offsetul lui fix (un sfert de latime, in
  // ordinea progresiei) si ramane la fontul maxim daca in dreapta lui e loc
  // gol. Daca ar calca peste titlul vecin, se micsoreaza cat sa incapa in
  // sfertul lui. De aici iese singur si cazul suprapus (vecinul e la +25%,
  // deci toate se micsoreaza) si cel desfacut (vecinul e departe, font mare).
  function potrivesteTitlurile(foliiEl, coord) {
    // Cu casute fixe nu se potriveste nimic: fiecare titlu sta in sfertul lui,
    // la marimea din CSS, oricum s-ar plimba foliile. Stergem ce a pus
    // eventual potrivirea dinamica inainte.
    if (titluriPe2Randuri) return;

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
      // Masuram latimea naturala pe UN rand, deci fara latime impusa.
      t.style.width = "";
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
      // Casuta din dreapta e goala? Titlul o poate ocupa pe un rand, la
      // marime plina.
      const incape = t.latNaturala + spatiu <= panaLaVecin;
      if (incape) {
        t.el.style.width = "";
        t.el.style.fontSize = `${fontMax}px`;
        return;
      }
      // E plina. Pe doua randuri incape mai mult text la acelasi font decat
      // pe unul singur, deci incercam intai asa.
      if (titluriPe2Randuri) {
        potrivestePeDouaRanduri(t.el, fontMax);
        return;
      }
      t.el.style.width = "";
      t.el.style.fontSize = `${fontMax * Math.max(0.05, (sfert - spatiu) / t.latNaturala)}px`;
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
    // Panza inainte de asezare: destinatiile se calculeaza pe ea.
    sincronizeazaPanza();
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

  // Verticala muta scrisul in caseta (align-items pe caseta). Orizontala e
  // text-align pe titlu, nu justify-content pe caseta: titlul are width:100%,
  // deci umple mereu caseta si justify-content n-ar avea pe unde sa-l mute.
  function aplicaAliniereTitluri() {
    document.documentElement.style.setProperty("--viz3-titlu-align-v", alinireTitluriVerticala);
    document.documentElement.style.setProperty("--viz3-titlu-text-align", alinireTitluriOrizontala);
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

  // Cand grila se debifeaza, foliile ies din DOM: ceasurile lor nu au voie sa
  // continue sa lucreze pe noduri detasate, iar cel de auto s-ar reprograma la
  // nesfarsit. Se apeleaza doar la disparitia grilei, nu la fiecare re-randare —
  // cat timp grila ramane afisata, `aseazaFoliile`/`programeazaAuto` isi curata
  // singure ceasurile, iar auto-ul trebuie sa supravietuiasca re-randarii.
  function opresteCeasurileFoliilor() {
    if (ceasGrup) {
      clearTimeout(ceasGrup);
      ceasGrup = null;
    }
    if (ceasAuto) {
      clearTimeout(ceasAuto);
      ceasAuto = null;
    }
  }

  function aplicaCompozitie() {
    const stiva = document.querySelector(".viz3-folii");
    if (!stiva) return;
    stiva.dataset.compFact = compozitie.fact ? "1" : "0";
    stiva.dataset.compEticheta = compozitie.eticheta ? "1" : "0";
    stiva.dataset.compPatratele = compozitie.patratele ? "1" : "0";
    stiva.dataset.compNumere = compozitie.numere ? "1" : "0";
    stiva.dataset.compUmple = compozitie.umple ? "1" : "0";
    // setAttribute, nu dataset: `dataset.titluri2Randuri` ar da atributul
    // `data-titluri2-randuri`, care nu se potriveste cu selectorul din CSS.
    stiva.setAttribute("data-titluri-2-randuri", titluriPe2Randuri ? "1" : "0");
    stiva.setAttribute("data-titluri-incadrate", titluriIncadrate ? "1" : "0");
    stiva.setAttribute("data-casete-colorate", caseteColorate ? "1" : "0");
    aplicaUmplere(stiva);
  }

  // Marimile de baza ale unui patratel (vezi .viz3-patratel din CSS).
  const DIM_PATRATEL = 10;
  const GAP_PATRATEL = 2;
  // Cat de aproape trebuie sa fie doua folii pe verticala ca titlurile lor sa
  // se poata calca. Randurile sunt la sute de px distanta, iar intalnirile
  // intermediare pot da si randuri fractionare.
  const TOLERANTA_RAND = 0.1;
  // Inaltimea unui rand (vezi line-height din CSS) si cat de fin coboram cand
  // cautam fontul care incape.
  const INALTIME_RAND = 1.15;
  const PAS_POTRIVIRE = 0.96;
  const MAX_PASI_POTRIVIRE = 30;

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
      bifa.dataset.preset = `compozitie_${opt.id}`;
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

  function randeazaSlider(reglaj, laSchimbare, prefixAxa) {
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
    slider.dataset.preset = `${prefixAxa}_${reglaj.id}`;

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
    camp.dataset.preset = `folii_${reglaj.id}`;
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
    bifa.dataset.preset = "folii_active";
    foliiActive = bifa.checked;
    const textBifa = document.createElement("span");
    textBifa.textContent = "Activează foliile";
    comutator.append(bifa, textBifa);

    const randAleator = document.createElement("label");
    randAleator.className = "viz3-optiune";
    const bifaAleator = document.createElement("input");
    bifaAleator.type = "checkbox";
    bifaAleator.checked = axa.glisare_aleatoare_implicit === true;
    bifaAleator.dataset.preset = "glisare_aleatoare";
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
    bifaReasezare.dataset.preset = "reasezare_aleatoare";
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
    bifaGrup.dataset.preset = "grupare_intermediara";
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

    const randTitluri = document.createElement("label");
    randTitluri.className = "viz3-optiune";
    const bifaTitluri = document.createElement("input");
    bifaTitluri.type = "checkbox";
    bifaTitluri.checked = axa.titluri_2_randuri_implicit === true;
    bifaTitluri.dataset.preset = "titluri_2_randuri";
    titluriPe2Randuri = bifaTitluri.checked;
    const textTitluri = document.createElement("span");
    textTitluri.textContent = "Titluri folii pe 2 rânduri și word-wrap frumos";
    bifaTitluri.addEventListener("change", () => {
      titluriPe2Randuri = bifaTitluri.checked;
      const stiva = document.querySelector(".viz3-folii");
      // Se remasoara in ambele moduri: si pe un rand bara are o inaltime, din
      // care ies distantele dintre folii.
      if (stiva) {
        aplicaCompozitie();
        masoaraTitlurile([...stiva.querySelectorAll(".viz3-folie")]);
      }
      aplicaAranjament();
    });
    randTitluri.append(bifaTitluri, textTitluri);

    const randIncadrate = document.createElement("label");
    randIncadrate.className = "viz3-optiune";
    const bifaIncadrate = document.createElement("input");
    bifaIncadrate.type = "checkbox";
    bifaIncadrate.checked = axa.titluri_incadrate_implicit === true;
    bifaIncadrate.dataset.preset = "titluri_incadrate";
    titluriIncadrate = bifaIncadrate.checked;
    const textIncadrate = document.createElement("span");
    textIncadrate.textContent = "Titluri folii încadrate";
    bifaIncadrate.addEventListener("change", () => {
      titluriIncadrate = bifaIncadrate.checked;
      aplicaAranjament();
    });
    randIncadrate.append(bifaIncadrate, textIncadrate);

    const randColorate = document.createElement("label");
    randColorate.className = "viz3-optiune";
    const bifaColorate = document.createElement("input");
    bifaColorate.type = "checkbox";
    bifaColorate.checked = axa.casete_colorate_implicit === true;
    bifaColorate.dataset.preset = "casete_colorate";
    caseteColorate = bifaColorate.checked;
    const textColorate = document.createElement("span");
    textColorate.textContent = "Casete colorate până la titlul foliei inclusiv";
    bifaColorate.addEventListener("change", () => {
      caseteColorate = bifaColorate.checked;
      aplicaAranjament();
    });
    randColorate.append(bifaColorate, textColorate);

    // Aliniere text in caseta: verticala si orizontala, doua grupuri de cate
    // 3 butoane, dar pe UN singur rand. Fiecare grup se comporta ca un radio:
    // un click activeaza butonul lui si dezactiveaza restul grupului lui.
    const randAliniere = document.createElement("div");
    randAliniere.className = "viz3-reglaj";
    const capAliniere = document.createElement("span");
    capAliniere.className = "viz3-reglaj-eticheta";
    capAliniere.textContent = "Titluri folii - Aliniere:";
    const randButoaneAliniere = document.createElement("div");
    randButoaneAliniere.className = "viz3-butoane-aliniere";
    randAliniere.append(capAliniere, randButoaneAliniere);

    const butoaneAliniere = [];
    const construiesteGrupAliniere = (optiuni, idImplicit, laSchimbare, numeGrup) => {
      const butoaneGrup = (optiuni ?? []).map((opt) => {
        const buton = document.createElement("button");
        buton.type = "button";
        buton.className = "viz3-buton-aliniere";
        buton.textContent = opt.eticheta;
        buton.title = opt.titlu;
        buton.disabled = !foliiActive;
        buton.dataset.preset = `${numeGrup}_${opt.id}`;
        if (opt.id === idImplicit) buton.classList.add("viz3-buton-aliniere--activ");
        buton.addEventListener("click", () => {
          butoaneGrup.forEach((b) => b.classList.toggle("viz3-buton-aliniere--activ", b === buton));
          laSchimbare(opt.valoare);
        });
        randButoaneAliniere.appendChild(buton);
        butoaneAliniere.push(buton);
        return buton;
      });
      return butoaneGrup;
    };

    const implicitV = axa.aliniere_titluri_verticala_implicit;
    const implicitH = axa.aliniere_titluri_orizontala_implicit;
    alinireTitluriVerticala =
      axa.optiuni_aliniere_verticala?.find((o) => o.id === implicitV)?.valoare ??
      alinireTitluriVerticala;
    alinireTitluriOrizontala =
      axa.optiuni_aliniere_orizontala?.find((o) => o.id === implicitH)?.valoare ??
      alinireTitluriOrizontala;
    aplicaAliniereTitluri();

    construiesteGrupAliniere(
      axa.optiuni_aliniere_verticala,
      implicitV,
      (valoare) => {
        alinireTitluriVerticala = valoare;
        aplicaAliniereTitluri();
      },
      "aliniere_verticala"
    );
    construiesteGrupAliniere(
      axa.optiuni_aliniere_orizontala,
      implicitH,
      (valoare) => {
        alinireTitluriOrizontala = valoare;
        aplicaAliniereTitluri();
      },
      "aliniere_orizontala"
    );

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
      buton.dataset.preset = `aranjament_${opt.id}`;
      if (opt.activa) buton.classList.add("viz3-buton-aranjament--activ");
      buton.addEventListener("click", () => schimbaAranjament(opt.id));
      randButoane.appendChild(buton);
      return buton;
    });
    butoaneAranjament = butoane;

    const reglaje = axa.reglaje ?? [];
    const gasesteReglaj = (id) => reglaje.find((r) => r.id === id);

    reglajDimensiune = gasesteReglaj("dimensiune");
    const dimensiune = randeazaSlider(
      reglajDimensiune,
      (v) => {
        dimensiuneFolie = v;
        aplicaDimensiune();
      },
      axa.id
    );
    sliderDimensiune = dimensiune;

    const viteza = randeazaSlider(
      gasesteReglaj("viteza"),
      (v) => {
        vitezaReasezare = v;
        aplicaViteza();
      },
      axa.id
    );

    const auto = randeazaNumar(gasesteReglaj("auto"), (v) => {
      const seStrangeaInainte = autoSecunde <= 0;
      autoSecunde = v;
      // Trecerea 0 ↔ non-0 schimba panza (stransa pe forma vs. plutitoare), deci
      // foliile se reaseaza o data. In rest, numarul doar reprogrameaza ceasul —
      // n-are rost sa le pornim o tranzitie la fiecare apasare de +/-.
      if (seStrangeaInainte !== (autoSecunde <= 0)) aplicaAranjament();
      aplicaAuto();
    });

    const deActivat = [
      bifaAleator,
      bifaReasezare,
      bifaGrup,
      bifaTitluri,
      bifaIncadrate,
      bifaColorate,
      ...butoaneAliniere,
      dimensiune.slider,
      viteza.slider,
      ...auto.controale,
    ];
    deActivat.forEach((el) => (el.disabled = !foliiActive));
    bifa.addEventListener("change", () => {
      foliiActive = bifa.checked;
      butoane.forEach((b) => (b.disabled = !foliiActive));
      deActivat.forEach((el) => (el.disabled = !foliiActive));
      // Debifarea lasa o singura tabla: o intindem pe latimea disponibila, ca sa
      // se citeasca. Rebifarea pune la loc marimea de dinainte — cea la care
      // incap patru folii pe panza.
      if (!foliiActive) {
        dimensiuneInainteDeStrans = dimensiuneFolie;
        if (!dimensiuneAleasaManual) potrivesteDimensiuneaLaEcran();
      } else if (dimensiuneInainteDeStrans !== null) {
        puneDimensiuneFolie(dimensiuneInainteDeStrans);
        dimensiuneInainteDeStrans = null;
      }
      aplicaAranjament();
      aplicaAuto();
    });

    grup.append(
      comutator,
      randAleator,
      randReasezare,
      randGrup,
      randTitluri,
      randIncadrate,
      randColorate,
      randAliniere,
      randButoane,
      dimensiune.rand,
      viteza.rand,
      auto.rand
    );
  }

  // Campurile intervalului custom: patru numere, „a-b × c-d". CP-ul valideaza
  // aici (limitele din definitie; capetele inversate se schimba intre ele) si
  // trimite motorului doar intervale corecte. Campurile se rescriu cu valorile
  // corectate, ca sa se vada exact ce s-a aplicat. O schimbare de camp conteaza
  // doar cand optiunea e bifata; altfel valorile asteapta bifarea.
  function construiesteCampuriInterval(opt, radio, intervalInitial) {
    const element = document.createElement("div");
    element.className = "viz3-interval-campuri";
    const campuri = {};

    function valoare(cheie) {
      const n = Math.round(Number(campuri[cheie].value));
      if (!Number.isFinite(n)) return intervalInitial[cheie];
      return Math.min(opt.limite.max, Math.max(opt.limite.min, n));
    }

    function interval() {
      const [aMin, aMax] = [valoare("aMin"), valoare("aMax")].sort((x, y) => x - y);
      const [bMin, bMax] = [valoare("bMin"), valoare("bMax")].sort((x, y) => x - y);
      const corectat = { aMin, aMax, bMin, bMax };
      Object.keys(campuri).forEach((cheie) => {
        campuri[cheie].value = String(corectat[cheie]);
      });
      return corectat;
    }

    [
      { cheie: "aMin", separator: null },
      { cheie: "aMax", separator: "-" },
      { cheie: "bMin", separator: "×" },
      { cheie: "bMax", separator: "-" },
    ].forEach(({ cheie, separator }) => {
      if (separator) {
        const sep = document.createElement("span");
        sep.textContent = separator;
        element.appendChild(sep);
      }
      const camp = document.createElement("input");
      camp.type = "number";
      camp.min = String(opt.limite.min);
      camp.max = String(opt.limite.max);
      camp.step = "1";
      camp.value = String(intervalInitial[cheie]);
      camp.addEventListener("change", () => {
        if (radio.checked) schimbaDomeniu(opt.id, interval());
      });
      campuri[cheie] = camp;
      element.appendChild(camp);
    });

    return { element, interval };
  }

  // ---- preseturi (P din MABP) — vezi CONTRACT-PRESETURI.md ---------------
  //
  // O zonă = o subsecțiune din CP, cu preseturile ei. Sertarul (localStorage)
  // e copia de lucru; sămânța (`PreseteVizualizare3`, din fișierul din repo)
  // se copiază în el o singură dată, la prima deschidere. De atunci încolo
  // doar sertarul contează — fișierul nu se mai citește ca sursă de adevăr.

  function cheieSertarPreset(zona) {
    return `viz3_presete_${zona}`;
  }

  function sertarDinSamanta(zona) {
    return {
      schema_version: 1,
      default: null,
      presete: presete
        .filter((p) => p.subsectiune === zona)
        .map((p) => ({ nume: p.nume, controale: { ...p.controale } })),
      sterse: [],
    };
  }

  function salveazaSertarPreset(zona, sertar) {
    try {
      global.localStorage?.setItem(cheieSertarPreset(zona), JSON.stringify(sertar));
    } catch {
      // Storage plin sau indisponibil: preseturile tin doar sesiunea curenta.
    }
  }

  // Sertar gol (prima deschidere): samanta se copiaza si se scrie imediat,
  // ca de atunci incolo cheia sa existe si fisierul din repo sa nu mai fie
  // citit ca sursa de adevar (exact modelul userului: o copie, editata).
  function obtineSertarPreset(zona) {
    try {
      const brut = global.localStorage?.getItem(cheieSertarPreset(zona));
      if (brut) {
        const parsat = JSON.parse(brut);
        if (parsat && Array.isArray(parsat.presete)) {
          return {
            schema_version: parsat.schema_version ?? 1,
            default: typeof parsat.default === "string" ? parsat.default : null,
            presete: parsat.presete,
            sterse: Array.isArray(parsat.sterse) ? parsat.sterse : [],
          };
        }
      }
    } catch {
      // Cade pe initializarea din samanta.
    }
    const initial = sertarDinSamanta(zona);
    salveazaSertarPreset(zona, initial);
    return initial;
  }

  // Un preset nu stie ce fac controalele: le pune valoarea si declanseaza
  // acelasi eveniment pe care l-ar declansa mana ta. Restul codului se
  // conformeaza, ca de obicei. Scopat la `container` (zona), ca un preset sa
  // nu poata atinge vreodata controale din afara zonei lui.
  function aplicaControalePreset(container, controale) {
    Object.entries(controale).forEach(([cheie, valoare]) => {
      const el = container.querySelector(`[data-preset="${cheie}"]`);
      if (!el || el.disabled) return;

      if (el.tagName === "BUTTON") {
        if (valoare === true) el.click();
        return;
      }
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked === valoare) return;
        el.checked = valoare;
        el.dispatchEvent(new Event("change"));
        return;
      }
      el.value = String(valoare);
      el.dispatchEvent(new Event(el.type === "range" ? "input" : "change"));
    });
  }

  // Citeste TOATE controalele [data-preset] din zona, cu valorile lor de
  // acum. Fara lista scrisa de mana: un control nou intra automat, de cum
  // primeste atributul. Butoanele-comutator (aranjament, aliniere) se
  // marcheaza cu clasa lor `--activ`, ca la orice alt buton din pagina.
  function capteazaControalePreset(container) {
    const controale = {};
    container.querySelectorAll("[data-preset]").forEach((el) => {
      const cheie = el.dataset.preset;
      if (el.tagName === "BUTTON") {
        controale[cheie] = [...el.classList].some((c) => c.endsWith("--activ"));
        return;
      }
      if (el.type === "checkbox" || el.type === "radio") {
        controale[cheie] = el.checked;
        return;
      }
      controale[cheie] = Number(el.value);
    });
    return controale;
  }

  // Randul buton+camp+OK, comun la „Salveaza ca preset" si „Redenumeste":
  // click pe buton deschide campul (precompletat cand e cazul), Enter/OK
  // confirma, Escape inchide fara sa schimbe nimic.
  //
  // Fara dialoguri native (`confirm`/`alert`): blocheaza JS-ul paginii pana
  // raspunde omul, deci nu se pot crea, inspecta sau apasa din cod — inclusiv
  // din teste automate. `onConfirm(nume, ajutor)` foloseste in loc:
  //   ajutor.eroare(text)         — arata un mesaj sub camp, campul ramane deschis.
  //   ajutor.confirmare(text, laDa) — inlocuieste campul cu un rand text + [OK] [Cancel];
  //                                    OK cheama `laDa()`, Cancel revine la camp (text intact).
  // Cand `onConfirm` chiar salveaza, apelantul re-randeaza toata zona, deci
  // randul asta dispare singur — nu mai trebuie inchis explicit.
  function randCampNume(textButon, valoareInitiala, onConfirm) {
    const rand = document.createElement("div");
    rand.className = "viz3-preset-inline";

    let stare = "buton"; // "buton" | "camp" | "confirmare"
    let mesajEroare = "";
    let confirmareInfo = null;

    function arata() {
      rand.replaceChildren();

      if (stare === "buton") {
        const buton = document.createElement("button");
        buton.type = "button";
        buton.textContent = textButon;
        buton.addEventListener("click", () => {
          stare = "camp";
          mesajEroare = "";
          arata();
        });
        rand.appendChild(buton);
        return;
      }

      if (stare === "confirmare") {
        const text = document.createElement("span");
        text.className = "viz3-preset-confirmare-text";
        text.textContent = confirmareInfo.text;
        const da = document.createElement("button");
        da.type = "button";
        da.textContent = "OK";
        da.addEventListener("click", confirmareInfo.laDa);
        const nu = document.createElement("button");
        nu.type = "button";
        nu.textContent = "Cancel";
        nu.addEventListener("click", () => {
          stare = "camp";
          arata();
        });
        rand.append(text, da, nu);
        return;
      }

      // stare === "camp"
      const camp = document.createElement("input");
      camp.type = "text";
      camp.className = "viz3-preset-camp-nume";
      camp.placeholder = "Nume preset";
      camp.value = valoareInitiala ?? "";
      const ok = document.createElement("button");
      ok.type = "button";
      ok.textContent = "OK";
      const confirma = () => {
        const nume = camp.value.trim();
        if (!nume) {
          camp.focus();
          return;
        }
        valoareInitiala = nume;
        mesajEroare = "";
        onConfirm(nume, {
          eroare(text) {
            mesajEroare = text;
            arata();
          },
          confirmare(text, laDa) {
            confirmareInfo = { text, laDa };
            stare = "confirmare";
            arata();
          },
        });
      };
      ok.addEventListener("click", confirma);
      camp.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") confirma();
        if (ev.key === "Escape") {
          stare = "buton";
          arata();
        }
      });
      rand.append(camp, ok);
      if (mesajEroare) {
        const eroare = document.createElement("span");
        eroare.className = "viz3-preset-mesaj";
        eroare.textContent = mesajEroare;
        rand.appendChild(eroare);
      }
      camp.focus();
      camp.select();
    }

    arata();
    return rand;
  }

  // Acelasi tipar ca la jurnal (butonImportaJurnal): alegerea fisierului
  // ramane a userului, dialogul native porneste de obicei chiar din Downloads.
  function butonImportaPreseturi(dupaImport) {
    const fragment = document.createDocumentFragment();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.hidden = true;
    input.addEventListener("change", async () => {
      const fisier = input.files?.[0];
      input.value = "";
      if (!fisier) return;
      try {
        const parsat = JSON.parse(await fisier.text());
        if (!parsat || !Array.isArray(parsat.presete)) {
          throw new Error("fișierul nu conține preseturi");
        }
        dupaImport(parsat);
      } catch (eroare) {
        global.alert?.(`„${fisier.name}" nu poate fi citit ca preseturi: ${eroare.message}`);
      }
    });
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = "Importă preseturi JSON din Downloads";
    buton.addEventListener("click", () => input.click());
    fragment.append(buton, input);
    return fragment;
  }

  // Construieste zona de preseturi a unei subsectiuni: randul de preseturi
  // (cu eticheta „Default preset:" langa cel implicit), actiunile presetului
  // selectat (Delete / Make default / Redenumeste), salvarea configuratiei
  // curente si portabilitatea (export/import/reimprospatare din samanta).
  // `container` e subsectiunea intreaga: capturarea si aplicarea citesc/scriu
  // doar `[data-preset]` din interiorul ei, niciodata din afara zonei.
  function construiesteZonaPreseturi(container, zona) {
    let sertar = obtineSertarPreset(zona);
    let numeSelectat = null;

    const zonaEl = document.createElement("div");
    zonaEl.className = "viz3-zona-preseturi";
    container.appendChild(zonaEl);

    function persista() {
      salveazaSertarPreset(zona, sertar);
    }

    function aplicaSiSelecteaza(preset) {
      aplicaControalePreset(container, preset.controale);
      numeSelectat = preset.nume;
      redeseneaza();
    }

    function salveazaCaPreset(nume, ajutor) {
      const controale = capteazaControalePreset(container);
      const indexExistent = sertar.presete.findIndex((p) => p.nume === nume);
      if (indexExistent !== -1) {
        ajutor.confirmare(
          "Numele este deja dat pentru un preset din această secțiune. " +
            "Apasă OK dacă vrei să îl înlocuiești, sau Cancel dacă vrei să modifici " +
            "numele noului preset, ca să păstrezi și presetul vechi.",
          () => {
            sertar.presete[indexExistent] = { nume, controale };
            sertar.sterse = sertar.sterse.filter((n) => n !== nume);
            numeSelectat = nume;
            persista();
            redeseneaza();
          }
        );
        return;
      }
      sertar.presete.push({ nume, controale });
      sertar.sterse = sertar.sterse.filter((n) => n !== nume);
      numeSelectat = nume;
      persista();
      redeseneaza();
    }

    function stergePreset(nume) {
      sertar.presete = sertar.presete.filter((p) => p.nume !== nume);
      if (!sertar.sterse.includes(nume)) sertar.sterse.push(nume);
      if (sertar.default === nume) sertar.default = null;
      if (numeSelectat === nume) numeSelectat = null;
      persista();
      redeseneaza();
    }

    function faDefault(nume) {
      sertar.default = nume;
      persista();
      redeseneaza();
    }

    function redenumeste(numeVechi, numeNou, ajutor) {
      if (numeNou === numeVechi) {
        redeseneaza();
        return;
      }
      if (sertar.presete.some((p) => p.nume === numeNou)) {
        ajutor.eroare(`„${numeNou}" e deja folosit în această secțiune.`);
        return;
      }
      const preset = sertar.presete.find((p) => p.nume === numeVechi);
      if (!preset) return;
      preset.nume = numeNou;
      if (sertar.default === numeVechi) sertar.default = numeNou;
      numeSelectat = numeNou;
      persista();
      redeseneaza();
    }

    // Numele din samanta care lipsesc din sertar si nu au fost sterse
    // explicit se adauga. Cele sterse nu reinviu — de-aia sertarul tine si
    // lista lor separat de lista preseturilor curente. Rezultatul se arata
    // inline (langa butoane), nu cu `alert`: un dialog nativ blocheaza JS-ul
    // paginii pana raspunde omul, deci nu poate fi verificat din cod.
    let mesajReimprospatare = "";

    function reimprospateazaDinSamanta() {
      const samanta = presete.filter((p) => p.subsectiune === zona);
      let adaugate = 0;
      samanta.forEach((p) => {
        const existaDeja = sertar.presete.some((existent) => existent.nume === p.nume);
        const fostSters = sertar.sterse.includes(p.nume);
        if (!existaDeja && !fostSters) {
          sertar.presete.push({ nume: p.nume, controale: { ...p.controale } });
          adaugate += 1;
        }
      });
      persista();
      mesajReimprospatare =
        adaugate > 0
          ? `${adaugate} preset(uri) noi adăugate din fișier.`
          : "Nimic nou de adăugat din fișier.";
      redeseneaza();
    }

    function exportaPreseturi() {
      const json = JSON.stringify(sertar, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = numeFisierExport(`presete-${zona}`);
      link.click();
      URL.revokeObjectURL(url);
    }

    function importaPreseturi(parsat) {
      sertar = {
        schema_version: parsat.schema_version ?? 1,
        default: typeof parsat.default === "string" ? parsat.default : null,
        presete: parsat.presete.filter((p) => p && typeof p.nume === "string" && p.controale),
        sterse: Array.isArray(parsat.sterse) ? parsat.sterse : [],
      };
      numeSelectat = null;
      mesajReimprospatare = "";
      persista();
      redeseneaza();
    }

    // Randeaza tot ce tine de zona, de la zero, de fiecare data cand starea
    // se schimba. Cateva butoane pentru cateva preseturi: costul e neglijabil.
    // Primul rand aparut nu are bordura de sus (e chiar sub titlul subsectiunii).
    function redeseneaza() {
      zonaEl.replaceChildren();
      let primulRand = true;
      const adaugaRand = (rand) => {
        if (primulRand) {
          rand.classList.add("viz3-presete--fara-bordura");
          primulRand = false;
        }
        zonaEl.appendChild(rand);
      };

      if (sertar.presete.length > 0) {
        const randButoane = document.createElement("div");
        randButoane.className = "viz3-presete";
        sertar.presete.forEach((preset) => {
          if (preset.nume === sertar.default) {
            const eticheta = document.createElement("span");
            eticheta.className = "viz3-preset-eticheta-default";
            eticheta.textContent = "Default preset:";
            randButoane.appendChild(eticheta);
          }
          const buton = document.createElement("button");
          buton.type = "button";
          buton.textContent = preset.nume;
          if (preset.nume === numeSelectat) buton.classList.add("viz3-preset-selectat");
          buton.addEventListener("click", () => aplicaSiSelecteaza(preset));
          randButoane.appendChild(buton);
        });
        adaugaRand(randButoane);
      }

      if (numeSelectat && sertar.presete.some((p) => p.nume === numeSelectat)) {
        const randActiuni = document.createElement("div");
        randActiuni.className = "viz3-presete";

        const sterge = document.createElement("button");
        sterge.type = "button";
        sterge.textContent = "Delete";
        sterge.addEventListener("click", () => stergePreset(numeSelectat));
        randActiuni.appendChild(sterge);

        if (sertar.default !== numeSelectat) {
          const implicit = document.createElement("button");
          implicit.type = "button";
          implicit.textContent = "Make default";
          implicit.addEventListener("click", () => faDefault(numeSelectat));
          randActiuni.appendChild(implicit);
        }

        randActiuni.appendChild(
          randCampNume("Redenumește", numeSelectat, (nou, ajutor) =>
            redenumeste(numeSelectat, nou, ajutor)
          )
        );

        adaugaRand(randActiuni);
      }

      const randSalvare = document.createElement("div");
      randSalvare.className = "viz3-presete";
      randSalvare.appendChild(
        randCampNume("Salvează setări curente ca Preset", "", salveazaCaPreset)
      );
      adaugaRand(randSalvare);

      const randPortabil = document.createElement("div");
      randPortabil.className = "viz3-presete";
      const btnExport = document.createElement("button");
      btnExport.type = "button";
      btnExport.textContent = "Exportă preseturile ca JSON";
      btnExport.addEventListener("click", exportaPreseturi);
      const btnRefresh = document.createElement("button");
      btnRefresh.type = "button";
      btnRefresh.textContent = "Reîmprospătează din fișier";
      btnRefresh.addEventListener("click", reimprospateazaDinSamanta);
      randPortabil.append(btnExport, butonImportaPreseturi(importaPreseturi), btnRefresh);
      if (mesajReimprospatare) {
        const status = document.createElement("span");
        status.className = "viz3-preset-mesaj";
        status.textContent = mesajReimprospatare;
        randPortabil.appendChild(status);
      }
      adaugaRand(randPortabil);
    }

    redeseneaza();

    return {
      aplicaDefault() {
        if (!sertar.default) return;
        const preset = sertar.presete.find((p) => p.nume === sertar.default);
        if (preset) aplicaSiSelecteaza(preset);
      },
    };
  }

  // Zonele de preseturi randate, ca defaultul lor sa se poata aplica o
  // singura data, dupa prima randare a vizualizarii (vezi mai jos).
  const zonePreseturi = [];

  function randeazaControlPanel(container, definitii) {
    const titlu = document.createElement("h1");
    titlu.textContent = "Vizualizare 3 - Claude";
    const subtitlu = document.createElement("p");
    subtitlu.className = "viz3-subtitlu";
    subtitlu.textContent = "Prototip: o opțiune activă per axă. Restul vor urma.";
    container.append(titlu, subtitlu);

    // Ordinea din `definitii-axe.js` e ordinea fluxului MABP (0 Domeniu -> 5
    // Vizualizare) si ramane asa in date. In CP afisam sectiunile invers, 5->0,
    // ca Vizualizarea sa fie prima. Numerele din titluri NU se schimba: ele spun
    // a cata etapa din flux e, nu a cata pozitie in meniu. Copiem inainte de
    // `reverse()`, array-ul global e inghetat.
    [...definitii].reverse().forEach((etapa) => {
      const sectiune = document.createElement("section");
      sectiune.className = "viz3-etapa";
      const titluEtapa = document.createElement("h2");
      titluEtapa.textContent = etapa.titlu;
      sectiune.appendChild(titluEtapa);

      // Axele netagate stau direct in etapa; cele cu `subsectiune` intra intr-un
      // container propriu, cu titlu si preseturile lui in cap. `tinta` e locul
      // unde se pune axa curenta.
      let subsectiuneCurenta = null;
      let tinta = sectiune;

      etapa.axe.forEach((axa) => {
        if (axa.subsectiune && axa.subsectiune !== subsectiuneCurenta) {
          subsectiuneCurenta = axa.subsectiune;
          tinta = document.createElement("div");
          tinta.className = "viz3-subsectiune";
          tinta.dataset.subsectiune = axa.subsectiune;
          const capSub = document.createElement("div");
          capSub.className = "viz3-subsectiune-titlu";
          capSub.textContent = etapa.subsectiuni?.[axa.subsectiune] ?? "";
          tinta.appendChild(capSub);
          zonePreseturi.push(construiesteZonaPreseturi(tinta, axa.subsectiune));
          sectiune.appendChild(tinta);
        } else if (!axa.subsectiune) {
          subsectiuneCurenta = null;
          tinta = sectiune;
        }

        const grup = document.createElement("div");
        grup.className = "viz3-axa";
        const eticheta = document.createElement("span");
        eticheta.className = "viz3-axa-eticheta";
        eticheta.textContent = axa.eticheta;
        grup.appendChild(eticheta);

        // Axa Reprezentare: un singur buton, sus, sub eticheta — salveaza toata
        // combinatia de bife, nu o optiune anume.
        if (axa === axaVizualizare) {
          const randButon = document.createElement("div");
          randButon.className = "viz3-rand-buton-default";
          randButon.appendChild(construiesteButonDefaultReprezentari());
          grup.appendChild(randButon);
        }

        if (axa.tip_control === "folii") {
          randeazaControlFolii(grup, axa);
          tinta.appendChild(grup);
          return;
        }

        if (axa.tip_control === "compozitie") {
          randeazaControlCompozitie(grup, axa);
          tinta.appendChild(grup);
          return;
        }

        if (axa.tip_control === "progres_tabel") {
          randeazaControlProgresTabel(grup, axa);
          tinta.appendChild(grup);
          return;
        }

        if (axa.tip_control === "grafic_stacat_stari") {
          randeazaControlGraficStacat(grup, axa);
          tinta.appendChild(grup);
          return;
        }

        optiuniAfisate(axa).forEach((opt) => {
          const input = document.createElement("input");
          input.type = axa.tip_selectie === "multipla" ? "checkbox" : "radio";
          input.name = `${etapa.etapa}-${axa.id}`;
          // Domeniu si Reprezentare pornesc din alegerea salvata; restul din definitii.
          if (axa === axaDomeniu && optiuneSalvata) {
            input.checked = opt.id === optiuneSalvata.id;
          } else if (axa === axaVizualizare) {
            input.checked = reprezentariActive.includes(opt.id);
          } else {
            input.checked = opt.activa === true;
          }
          input.disabled = opt.dezactivata === true;
          input.dataset.preset = `${axa.id}_${opt.id}`;

          // O optiune care isi declara intervalul schimba domeniul. CP-ul ii da
          // feature-ului datele explicit; feature-ul nu cauta singur ce e bifat.
          const campuriInterval = opt.interval_editabil
            ? construiesteCampuriInterval(
                opt,
                input,
                opt.id === optiuneSalvata?.id ? domeniuSalvat.interval : opt.interval
              )
            : null;
          if (opt.interval) {
            input.addEventListener("change", () => {
              if (!input.checked) return;
              schimbaDomeniu(opt.id, campuriInterval ? campuriInterval.interval() : opt.interval);
            });
          }

          const text = document.createElement("span");
          text.textContent = opt.eticheta;

          const elemente = [input, text];
          if (opt.dezactivata) {
            const motiv = document.createElement("span");
            motiv.className = "viz3-motiv";
            motiv.textContent = ` (${opt.motiv})`;
            elemente.push(motiv);
          }
          if (axa.marcaj_recomandare) {
            const marcaj = document.createElement("span");
            marcaj.className = "viz3-marcaj-recomandare";
            marcaj.dataset.marcajAdancime = String(opt.adancime);
            elemente.push(marcaj);
          }
          const rand = optiune(opt.eticheta, elemente);
          if (opt.dezactivata) rand.classList.add("viz3-dezactivata");

          // Optiunile functionale ale Reprezentarii sunt trasabile: primesc un
          // maner dedicat si un rand-container propriu, ca sa nu se confunde
          // apasarea manerului cu bifarea (vezi activeazaTragereOptiuniReprezentare).
          // Cele „vor urma" raman rand-uri simple, fixe.
          if (axa === axaVizualizare && !opt.dezactivata) {
            const container = document.createElement("div");
            container.className = "viz3-rand-reprezentare";
            container.dataset.optiuneId = opt.id;
            const maner = document.createElement("button");
            maner.type = "button";
            maner.className = "viz3-maner-tragere";
            maner.textContent = "⠿";
            maner.setAttribute("aria-label", `Reordonează: ${opt.eticheta}`);
            maner.title = "Trage pentru a reordona";
            container.append(maner, rand);
            grup.appendChild(container);
          } else {
            grup.appendChild(rand);
          }
          if (campuriInterval) grup.appendChild(campuriInterval.element);
        });

        if (axa.nota_dinamica) {
          const nota = document.createElement("div");
          nota.className = "viz3-nota-dinamica";
          nota.dataset.notaAxa = axa.id;
          grup.appendChild(nota);
        }

        if (axa === axaVizualizare) activeazaTragereOptiuniReprezentare(grup);

        tinta.appendChild(grup);
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

  // Bara de titluri = cate o caseta pentru fiecare folie, in ordinea
  // progresiei. Titlul foliei sta in caseta ei, deci pozitia rezulta din
  // caseta, nu se mai calculeaza. Casetele pana la ea inclusiv sunt pline: se
  // vede ce etape a parcurs si cate mai are.
  function randeazaBaraTitluri(folie, index, total) {
    const bara = document.createElement("div");
    bara.className = "viz3-bara-titluri";
    for (let i = 0; i < total; i += 1) {
      const caseta = document.createElement("div");
      caseta.className = "viz3-caseta";
      if (i <= index) caseta.classList.add("viz3-caseta--plina");
      if (i === index) {
        const titlu = document.createElement("span");
        titlu.className = "viz3-folie-titlu";
        // Un cuvant colorat per stare (data-stare), nu text simplu: la folia
        // "Netestat + Abia inceput" (2 stari in aceeasi caseta) altfel n-ar
        // fi cum sa distingem rosu de oranj. Separatorul "+" ramane necolorat.
        folie.stari.forEach((stare, idxStare) => {
          if (idxStare > 0) titlu.appendChild(document.createTextNode(" + "));
          const cuvant = document.createElement("span");
          cuvant.className = "viz3-folie-titlu-cuvant";
          cuvant.dataset.stare = stare;
          cuvant.textContent = ETICHETE_STARE[stare];
          titlu.appendChild(cuvant);
        });
        caseta.appendChild(titlu);
      }
      bara.appendChild(caseta);
    }
    return bara;
  }

  function randeazaFolie(model, folie, index, total) {
    const el = document.createElement("div");
    el.className = "viz3-folie";
    el.dataset.folie = folie.id;

    const bara = randeazaBaraTitluri(folie, index, total);

    const grila = document.createElement("div");
    grila.className = "viz3-grila";
    model.celule.forEach((celula) => {
      const areStarea = folie.stari.includes(celula.stare);
      grila.appendChild(areStarea ? randeazaCelula(celula) : randeazaFantoma(celula));
    });

    el.append(bara, grila);
    return el;
  }

  function randSursa(elemente) {
    const rand = document.createElement("div");
    rand.className = "viz3-sursa-rand";
    rand.append(...elemente);
    return rand;
  }

  // Alegerea sursei NU sterge nimic: importul salvat ramane pe loc, oricat ai
  // comuta. De-aia butonul lui e mereu acolo, doar dezactivat cat n-ai importat.
  function butonAlegeSursa(id, eticheta) {
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = eticheta;
    buton.disabled = id === "import" && !importSalvat;
    // Evidentiem ce se vede acum, nu ce s-a cerut: „jurnal" cu IndexedDB gol
    // cade pe dummy, si butonul n-are voie sa minta.
    if (id === sursaAfisata) buton.classList.add("viz3-sursa-aleasa");
    buton.addEventListener("click", () => {
      sursaActiva = id;
      salveazaSursaActiva();
      reseteazaVizualizarea();
    });
    return buton;
  }

  // Antetul comun (titlu + cele 3 randuri de sursa), refolosit de grila si de
  // tabel. `titluText` e singura diferenta intre reprezentari.
  // Antetul cu sursa se randeaza O SINGURA DATA, sus, oricate reprezentari ar fi
  // bifate: butoanele de sursa/import-export sunt ale paginii, nu ale unei
  // reprezentari. Fiecare reprezentare isi pune doar titlul ei, deasupra blocului
  // ei (vezi `construiesteTitluReprezentare`).
  function construiesteAntet(info) {
    const antet = document.createElement("div");
    antet.className = "viz3-viz-antet";
    // Trei randuri: ce vezi acum / ce poti alege / import-export.
    const sursa = document.createElement("div");
    sursa.className = "viz3-sursa";
    sursa.append(
      randSursa([info]),
      randSursa([
        butonAlegeSursa("jurnal", "Citește din IndexedDB"),
        butonAlegeSursa("import", "Alege log importat"),
        butonAlegeSursa("fixture", "Alege dummy log pe 8 săptămâni"),
      ]),
      randSursa([butonDescarcaJurnal(), butonImportaJurnal()]),
      randSursa([butonInlocuiesteJurnal(), butonMergeJurnal()])
    );
    antet.append(sursa);
    return antet;
  }

  // Capul unei reprezentari: titlul ei si, daca are, controalele care se tin de
  // el (la grila: „Mărime tabel: − +").
  function construiesteTitluReprezentare(titluText, controale = null) {
    const cap = document.createElement("div");
    cap.className = "viz3-reprezentare-cap";
    const titlu = document.createElement("h1");
    titlu.className = "viz3-reprezentare-titlu";
    titlu.textContent = titluText;
    cap.appendChild(titlu);
    if (controale) cap.appendChild(controale);
    return cap;
  }

  // „Mărime tabel: − +", langa titlul tablei. Butoanele sunt mari deliberat: se
  // apasa cu degetul pe telefon. Prima apasare opreste potrivirea automata pe
  // latimea ecranului pana la reincarcarea paginii — de-atunci marimea o comanzi
  // tu, si nici rotirea telefonului n-o mai schimba.
  function construiesteZoomTabla() {
    const zona = document.createElement("div");
    zona.className = "viz3-zoom-tabla";
    const eticheta = document.createElement("span");
    eticheta.className = "viz3-zoom-eticheta";
    eticheta.textContent = "Mărime tabel:";
    const buton = (semn, titlu, factor) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "viz3-buton-zoom";
      b.textContent = semn;
      b.title = titlu;
      b.addEventListener("click", () => schimbaMarimeaTablei(factor));
      return b;
    };
    zona.append(
      eticheta,
      buton("−", "Micșorează tabla", 1 / PAS_ZOOM),
      buton("+", "Mărește tabla", PAS_ZOOM)
    );
    return zona;
  }

  // `container` = sectiunea proprie a reprezentarii, deja goala si deja pusa in
  // pagina de `analizeazaSiRandeaza`. Randarea nu mai sterge tot `viz3-viz`:
  // alaturi de ea poate sta si o alta reprezentare.
  function randeazaVizualizarea(container, model) {
    // Titlul urmeaza domeniul ales: catalogul curent isi stie intervalul.
    container.appendChild(
      construiesteTitluReprezentare(
        `Starea curentă — tabla înmulțirii ${catalog.eticheta}`,
        construiesteZoomTabla()
      )
    );

    // Tabla = 4 folii transparente suprapuse. Suprapuse arată exact ca tabla
    // întreagă, fiindcă un fact are exact o stare.
    const stiva = document.createElement("div");
    stiva.className = "viz3-folii";
    folii.forEach((folie, i) =>
      stiva.appendChild(randeazaFolie(model, folie, i, folii.length))
    );
    // Numarul de casete din bara vine din datele foliilor, nu din CSS.
    document.documentElement.style.setProperty("--viz3-nr-folii", String(folii.length));
    // Forma grilei vine din catalogul domeniului ales, nu din CSS: 1-10 × 1-10
    // are 10 coloane, 11-20 × 1-20 are 20.
    document.documentElement.style.setProperty("--viz3-coloane", String(model.coloane));
    document.documentElement.style.setProperty("--viz3-randuri", String(model.randuri));
    container.appendChild(stiva);
    sincronizeazaPanza();
    sincronizeazaDimensiune();
    // Pornire cu foliile debifate (sau re-randare in starea asta): tabla singura
    // se aseaza tot pe latimea disponibila — daca userul n-a luat marimea pe mana
    // lui din butoanele „− +".
    if (!foliiActive && !dimensiuneAleasaManual) potrivesteDimensiuneaLaEcran();
    aplicaViteza();
    aplicaAranjament();
    // Masuram abia dupa ce browserul a asezat pagina: in timpul randarii,
    // masuratorile ies gresite. `setTimeout`, nu `requestAnimationFrame`:
    // rAF nu se executa deloc cat timp pagina sta intr-un tab nefocalizat.
    setTimeout(() => {
      masoaraTitlurile([...stiva.querySelectorAll(".viz3-folie")]);
    }, 0);
  }

  // ---- randarea tabelului de scor pe calupuri --------------------------

  // Formatarea unei celule: text + clasă, dupa ETICHETA de încredere. Toate
  // celulele au un scor (niciodată null); eticheta decide doar afișarea.
  function formateazaCelulaTabel(celula) {
    if (celula.eticheta === "date_insuficiente") {
      return { text: "—", clasa: "viz3-tabel-insuficient" };
    }
    const procent = `${Math.round(celula.scor * 100)}%`;
    if (celula.eticheta === "incredere_mica") {
      return { text: procent, clasa: "viz3-tabel-redus" };
    }
    return { text: procent, clasa: null };
  }

  function titluCelulaTabel(celula) {
    const purtate = celula.facts_testate - celula.facts_noi;
    const neatinse = celula.facts_total - celula.facts_testate;
    let text = `${celula.eticheta_text} · n=${celula.n} · zile=${celula.zile_distincte} · facts: ${celula.facts_noi} noi · ${purtate} purtate · ${neatinse} neatinse`;
    if (celula.data_prima_zi && celula.data_ultima_zi) {
      text += ` · ${celula.data_prima_zi} → ${celula.data_ultima_zi}`;
    }
    return text;
  }

  // Celulele de date calendaristice ale unui rand de antet: aceeasi logica la
  // randul din <thead> si la copia din josul tabelului, ca cele doua sa ramana
  // mereu identice. `tagCelula` = "th" (headerul de sus) sau "td" (copia de
  // jos, ca sa preia alinierea la dreapta a coloanelor de date, nu pe cea la
  // stanga a randurilor din tbody).
  function construiesteCeluleAntetDate(tr, antete, tagCelula) {
    antete.forEach((antet) => {
      const celula = document.createElement(tagCelula);
      celula.className = "viz3-tabel-date";
      celula.textContent = antet.eticheta;
      if (antet.este_azi) celula.classList.add("viz3-antet-azi");
      tr.appendChild(celula);
    });
  }

  // Copia randului de date calendaristice, sub "Nr. ex. lucrate": userul vede
  // etichetele si fara sa deruleze inapoi la headerul din capul tabelului.
  function construiesteRandDateDuplicat(antete) {
    const tr = document.createElement("tr");
    tr.className = "viz3-tabel-date-jos";
    const colTitlu = document.createElement("th");
    colTitlu.textContent = "Data:";
    tr.appendChild(colTitlu);
    construiesteCeluleAntetDate(tr, antete, "td");
    return tr;
  }

  // Un rand de numere simple (fara procente, fara bara, fara sageti): eticheta
  // + o celula per coloana. Folosit de "Nr. ex. lucrate /zi" si "Nr. ex cumulate".
  function construiesteRandNumere(eticheta, numere, clasa) {
    const tr = document.createElement("tr");
    tr.className = clasa;
    const cap = document.createElement("th");
    cap.scope = "row";
    cap.textContent = eticheta;
    tr.appendChild(cap);
    numere.forEach((n) => {
      const td = document.createElement("td");
      td.textContent = String(n);
      tr.appendChild(td);
    });
    return tr;
  }

  // Efortul cumulat de la inceputul jurnalului: fiecare coloana = suma tuturor
  // coloanelor de la ea la stanga, inclusiv. Singurul rand din tabel care nu
  // poate scadea niciodata — de-aia nu primeste niciodata sageata.
  function cumuleaza(numarPeZi) {
    let total = 0;
    return numarPeZi.map((n) => (total += n));
  }

  // Un rand din blocurile de stari: eticheta + o celula per coloana cu numarul
  // de facts, plus sageata EXACT ca la randurile de procent — acelasi glif/
  // culoare/pozitie, prin acelasi `adaugaSageataCelula` (§ mai jos). Compara
  // numarul coloanei curente cu al coloanei PRECEDENTE (nu exista goluri pe
  // randurile astea, deci referinta e mereu vecina imediata, spre deosebire de
  // procente unde se sare peste celule nedisplayate).
  // `claseCap` = culoarea starii pe eticheta randului (th-ul din stanga), nu pe
  // celulele cu numere (alea au deja propriul lor scor de incredere/heat).
  function construiesteRandStare({ eticheta, numere, clasa, claseCap }) {
    const tr = document.createElement("tr");
    tr.className = clasa;
    const cap = document.createElement("th");
    cap.scope = "row";
    cap.textContent = eticheta;
    if (claseCap) cap.classList.add(claseCap);
    tr.appendChild(cap);
    let anterior = null;
    numere.forEach((n) => {
      const td = document.createElement("td");
      td.textContent = String(n);
      adaugaSageataCelula(td, { cc: n, cs: anterior, tipRand: "stare" });
      anterior = n;
      tr.appendChild(td);
    });
    return tr;
  }

  // Cele doua blocuri de sub tabel: Setul 1 (cele 5 categorii, pt. programator)
  // si Setul 2 (primele trei comasate, pt. parinte si elev).
  //
  // Randul `suma` se calculeaza per coloana din chiar numerele afisate (nu dintr-o
  // constanta): asa ramane self-check real — daca o coloana nu da numarul de facts
  // din domeniu, se vede.
  //
  // Intoarce { set1, set2 }: randurile <tr> de stare ale fiecarui set, in ordine
  // (primul = varful benzii, ultimul = baza) - le foloseste randeazaGraficeStacate
  // ca sa gaseasca celulele-ancora fara sa caute prin DOM dupa clase.
  function construiesteBlocuriStari(tbody, stariPeMomente, numarColoane) {
    if (!stariPeMomente.length) return null;
    const numere = (cheie) => stariPeMomente.map((coloana) => coloana.contor[cheie]);
    const aduna = (...serii) => serii[0].map((_, idx) => serii.reduce((t, s) => t + s[idx], 0));

    function randTitluSet(text) {
      const tr = document.createElement("tr");
      tr.className = "viz3-tabel-titlu-set";
      const cap = document.createElement("th");
      cap.scope = "row";
      cap.colSpan = numarColoane + 1;
      cap.textContent = text;
      tr.appendChild(cap);
      return tr;
    }

    function randGol() {
      const tr = document.createElement("tr");
      tr.className = "viz3-tabel-rand-gol";
      const td = document.createElement("td");
      td.colSpan = numarColoane + 1;
      tr.appendChild(td);
      return tr;
    }

    const netestat = numere("netestat");
    const abiaInceput = numere("abia_inceput");
    const nuIlStie = numere("nu_il_stie");
    const inLucru = numere("in_lucru");
    const fluent = numere("fluent");
    const comasat = aduna(netestat, abiaInceput, nuIlStie);

    tbody.appendChild(randGol());

    tbody.appendChild(randTitluSet("Setul 1 - Pt programator"));
    const trNetestat = construiesteRandStare({
      eticheta: "netestat",
      numere: netestat,
      clasa: "viz3-tabel-stare",
      claseCap: "viz3-eticheta-stare-rosu",
    });
    const trAbiaInceput = construiesteRandStare({
      eticheta: "abia_inceput",
      numere: abiaInceput,
      clasa: "viz3-tabel-stare",
      claseCap: "viz3-eticheta-stare-oranj",
    });
    const trNuIlStie = construiesteRandStare({
      eticheta: "nu_il_stie",
      numere: nuIlStie,
      clasa: "viz3-tabel-stare",
      claseCap: "viz3-eticheta-stare-galben",
    });
    const trInLucru = construiesteRandStare({
      eticheta: "in_lucru",
      numere: inLucru,
      clasa: "viz3-tabel-stare",
      claseCap: "viz3-eticheta-stare-verde",
    });
    const trFluent = construiesteRandStare({
      eticheta: "fluent",
      numere: fluent,
      clasa: "viz3-tabel-stare",
      claseCap: "viz3-eticheta-stare-albastru",
    });
    tbody.append(trNetestat, trAbiaInceput, trNuIlStie, trInLucru, trFluent);
    tbody.appendChild(
      construiesteRandNumere("suma", aduna(netestat, abiaInceput, nuIlStie, inLucru, fluent), "viz3-tabel-suma")
    );

    tbody.appendChild(randTitluSet("Setul 2 - Pt parinte si elev"));
    const trComasat = construiesteRandStare({
      eticheta: "netestat + abia_inceput + nu_il_stie",
      numere: comasat,
      clasa: "viz3-tabel-stare",
      claseCap: "viz3-eticheta-stare-ruginiu",
    });
    const trInLucru2 = construiesteRandStare({
      eticheta: "in_lucru",
      numere: inLucru,
      clasa: "viz3-tabel-stare",
      claseCap: "viz3-eticheta-stare-verde",
    });
    const trFluent2 = construiesteRandStare({
      eticheta: "fluent",
      numere: fluent,
      clasa: "viz3-tabel-stare",
      claseCap: "viz3-eticheta-stare-albastru",
    });
    tbody.append(trComasat, trInLucru2, trFluent2);
    tbody.appendChild(construiesteRandNumere("suma", aduna(comasat, inLucru, fluent), "viz3-tabel-suma"));

    return {
      set1: [trNetestat, trAbiaInceput, trNuIlStie, trInLucru, trFluent],
      set2: [trComasat, trInLucru2, trFluent2],
    };
  }

  // Segmentele fiecarui set, de sus in jos (culoare = clasa CSS). Setul 2
  // (13.08.2026): fluent/in_lucru au ACEEASI culoare ca starea lor din Setul 1
  // (albastru/verde - acelasi sens); comasat (netestat+abia_inceput+nu_il_stie)
  // are o culoare proprie, ruginiu, nu mai reia rosu-ul lui netestat.
  const STACAT_SEGMENTE = {
    set1: [
      { cheie: "netestat", clasa: "viz3-grafic-stacat-rosu" },
      { cheie: "abia_inceput", clasa: "viz3-grafic-stacat-oranj" },
      { cheie: "nu_il_stie", clasa: "viz3-grafic-stacat-galben" },
      { cheie: "in_lucru", clasa: "viz3-grafic-stacat-verde" },
      { cheie: "fluent", clasa: "viz3-grafic-stacat-albastru" },
    ],
    set2: [
      { cheie: "comasat", clasa: "viz3-grafic-stacat-ruginiu" },
      { cheie: "in_lucru", clasa: "viz3-grafic-stacat-verde" },
      { cheie: "fluent", clasa: "viz3-grafic-stacat-albastru" },
    ],
  };

  function valoareSegmentStacat(contor, cheie) {
    if (cheie === "comasat") return contor.netestat + contor.abia_inceput + contor.nu_il_stie;
    return contor[cheie];
  }

  // Banda propriu-zisa (culorile): flex-basis per segment = procentul din suma
  // COLOANEI (nu o constanta) - daca suma e ruptă undeva, banda arata exact ce
  // arata numerele, nu ascunde un bug (§7 PLAN).
  function construiesteBandaStacata(segmenteDef, contor) {
    const suma = segmenteDef.reduce((t, s) => t + valoareSegmentStacat(contor, s.cheie), 0);
    const banda = document.createElement("div");
    banda.className = "viz3-grafic-stacat";
    segmenteDef.forEach((s) => {
      const seg = document.createElement("div");
      seg.className = `viz3-grafic-stacat-segment ${s.clasa}`;
      const valoare = valoareSegmentStacat(contor, s.cheie);
      seg.style.flexBasis = suma > 0 ? `${(valoare / suma) * 100}%` : "0%";
      banda.appendChild(seg);
    });
    return banda;
  }

  // Geometria (ancora): masurata din celulele reale, nu presupusa. `getBoundingClientRect`,
  // nu offsetTop/offsetLeft - celulele de tabel au un offsetParent istoric
  // inconsistent intre motoare de randare; diferentele de rect sunt corecte
  // indiferent de asta si indiferent de scroll (vezi §3 PLAN).
  function pozitioneazaAncoraStacat(ancora, tdSus, tdJos, tabel) {
    const rTabel = tabel.getBoundingClientRect();
    const rSus = tdSus.getBoundingClientRect();
    const rJos = tdJos.getBoundingClientRect();
    ancora.style.top = `${rSus.top - rTabel.top}px`;
    ancora.style.height = `${rJos.bottom - rSus.top}px`;
    ancora.style.left = `${rSus.left - rTabel.left}px`;
    ancora.style.width = `${rSus.width}px`;
  }

  // Construieste benzile unui SET (Setul 1 sau Setul 2): o ancora + o banda per
  // coloana. Ancora = pozitia masurata (rar schimbata: doar la randare/resize);
  // banda din interior = latime/pozitie/opacitate din variabile CSS (des
  // schimbate, de la slidere) - aceeasi separare ca la bara existenta dintr-o
  // singura celula, doar cu ancora explicita in loc de <td>.
  function randeazaBenziSetStacat(tabel, randuri, stariPeMomente, segmenteDef, dataSet) {
    if (!randuri || !randuri.length) return [];
    const benzi = [];
    const numarColoane = randuri[0].children.length - 1; // -1 pt. <th> eticheta
    const tdSusToate = randuri[0].children;
    const tdJosToate = randuri[randuri.length - 1].children;
    for (let i = 0; i < numarColoane; i += 1) {
      const tdSus = tdSusToate[i + 1];
      const tdJos = tdJosToate[i + 1];
      const contor = stariPeMomente[i].contor;

      const ancora = document.createElement("div");
      ancora.className = "viz3-grafic-stacat-ancora";
      ancora.dataset.set = dataSet;
      ancora.appendChild(construiesteBandaStacata(segmenteDef, contor));
      pozitioneazaAncoraStacat(ancora, tdSus, tdJos, tabel);
      tabel.appendChild(ancora);

      benzi.push({ ancora, tdSus, tdJos });
    }
    return benzi;
  }

  // Starea curenta a benzilor construite (pt. repozitionare la resize, fara sa
  // reconstruim segmentele - vezi listenerul de "resize" mai jos).
  let benziGraficStacatAtual = { set1: [], set2: [] };

  // Apelata DUPA ce tabelul e in DOM (are nevoie de layout real ca sa masoare).
  function randeazaGraficeStacate(tabel, randuriStari, stariPeMomente) {
    benziGraficStacatAtual = { set1: [], set2: [] };
    if (!randuriStari) return;
    benziGraficStacatAtual.set1 = randeazaBenziSetStacat(
      tabel,
      randuriStari.set1,
      stariPeMomente,
      STACAT_SEGMENTE.set1,
      "1"
    );
    benziGraficStacatAtual.set2 = randeazaBenziSetStacat(
      tabel,
      randuriStari.set2,
      stariPeMomente,
      STACAT_SEGMENTE.set2,
      "2"
    );
  }

  // Plasa de siguranta: doar repozitioneaza (nu reconstruieste) benzile deja
  // existente, in caz ca latimile coloanelor raspund la viewport. Debounce -
  // "resize" poate trage rafale de evenimente.
  let ceasResizeGraficStacat = null;
  function repozitioneazaGraficeStacate() {
    if (!tabelFluentaAtual) return;
    [...benziGraficStacatAtual.set1, ...benziGraficStacatAtual.set2].forEach(({ ancora, tdSus, tdJos }) => {
      pozitioneazaAncoraStacat(ancora, tdSus, tdJos, tabelFluentaAtual);
    });
  }
  window.addEventListener("resize", () => {
    clearTimeout(ceasResizeGraficStacat);
    ceasResizeGraficStacat = setTimeout(repozitioneazaGraficeStacate, 150);
  });

  // Sageata de directie pentru O celula: compara procentul rotunjit `cc` cu
  // referinta `cs` (ultima celula AFISATA din stanga, deja sarita peste goluri de
  // apelant). `cs === null` (prima celula afisata) sau `cc === cs` -> nicio sageata.
  // Etichetele de mod (--total/--acum/--toate) decid, prin CSS, care bifa o arata;
  // celula "acum" a unei subtable primeste O SINGURA sageata cu doua etichete, deci
  // "acum" + "toate" pornite nu dubleaza. Singurul loc unde se naste o sageata —
  // inclusiv pentru randurile de stare (`tipRand: "stare"`), care nu au bife de
  // afisare: eticheta lor (`--stare`) e mereu vizibila (CSS), fara sa depinda de
  // bifele 5.2, care privesc doar randurile de procent.
  function adaugaSageataCelula(td, { cc, cs, tipRand, esteAcum }) {
    if (cs === null || cc === cs) return;
    const urca = cc > cs;
    const sageata = document.createElement("span");
    sageata.className = urca ? "viz3-sageata-sus" : "viz3-sageata-jos";
    sageata.textContent = urca ? "↗" : "↘";
    if (tipRand === "total") {
      sageata.classList.add("viz3-sageata--total");
    } else if (tipRand === "subtabla") {
      sageata.classList.add("viz3-sageata--toate");
      if (esteAcum) sageata.classList.add("viz3-sageata--acum");
    } else if (tipRand === "stare") {
      sageata.classList.add("viz3-sageata--stare");
    }
    td.appendChild(sageata);
  }

  // Bara verticala din spatele scrisului (2.1): doua segmente stivuite de jos
  // intr-un flex column-reverse (primul copil DOM = S1 = jos). `cs` = procentul
  // celulei de referinta (deja sarita peste goluri de apelant), sau null pt.
  // prima celula afisata a randului. Vizibilitatea/marimea tin de clasele si
  // variabilele CSS aplicate pe <table> (aplicaOptiuniProgresTabel) - functia
  // asta construieste mereu structura, indiferent daca bara e activa acum.
  function construiesteBaraProgres(cc, cs) {
    const bara = document.createElement("div");
    bara.className = "viz3-bara";

    const s1 = document.createElement("div");
    s1.className = "viz3-bara-s1";
    const s2 = document.createElement("div");
    s2.className = "viz3-bara-s2";

    if (cs === null || cc === cs) {
      s1.style.flexBasis = `${cc}%`;
      s2.style.flexBasis = "0%";
    } else if (cc > cs) {
      s1.style.flexBasis = `${cs}%`;
      s2.style.flexBasis = `${cc - cs}%`;
      s2.classList.add("viz3-bara-s2--castig");
    } else {
      s1.style.flexBasis = `${cc}%`;
      s2.style.flexBasis = `${cs - cc}%`;
      s2.classList.add("viz3-bara-s2--pierdere");
    }

    const grila = document.createElement("div");
    grila.className = "viz3-bara-grila";

    bara.append(s1, s2, grila);
    return bara;
  }

  // Randul "Grafic bare", chiar deasupra randului Total: aceleasi perechi
  // (cc, cs) ale randului Total, dar DOAR bara (fara procentul scris - e
  // dedesubt, pe randul Total). Independent de bifa "In fiecare celula"
  // (clasa + variabile CSS proprii, vezi .viz3-bara--grafic) - cele doua
  // bife nu se ating (decizie: independente, nu "in loc de").
  function construiesteRandGraficBare(perechiTotal) {
    const tr = document.createElement("tr");
    tr.className = "viz3-tabel-grafic-bare";
    const cap = document.createElement("th");
    cap.scope = "row";
    cap.textContent = "Grafic bare";
    tr.appendChild(cap);
    perechiTotal.forEach(({ cc, cs }) => {
      const td = document.createElement("td");
      const bara = construiesteBaraProgres(cc, cs);
      bara.classList.add("viz3-bara--grafic");
      td.appendChild(bara);
      tr.appendChild(td);
    });
    return tr;
  }

  // Tragere orizontala cu degetul/mouse-ul, 1:1, fara inertie: elementul se
  // deruleaza exact cat s-a mutat pointerul, nu mai mult. Pointer Events prinde
  // touch si mouse cu acelasi cod — nu sunt doua feature-uri, unul singur.
  // `touch-action: pan-y` (in CSS) lasa scrollul vertical al paginii sa treaca
  // neatins prin element; doar orizontala o comandam noi.
  function activeazaTragereOrizontala(element) {
    let pointerId = null;
    let xPornire = 0;
    let scrollPornire = 0;
    element.addEventListener("pointerdown", (ev) => {
      if (ev.button != null && ev.button !== 0) return; // doar click stanga/atingere/pen
      pointerId = ev.pointerId;
      xPornire = ev.clientX;
      scrollPornire = element.scrollLeft;
      // NotFoundError daca browserul nu mai considera pointerul activ (evenimente
      // sintetice sau ordine neobisnuita) — tragerea tot merge, doar fara captura.
      try {
        element.setPointerCapture(pointerId);
      } catch {}
      element.classList.add("viz3-tragere-activa");
    });
    element.addEventListener("pointermove", (ev) => {
      if (ev.pointerId !== pointerId) return;
      element.scrollLeft = scrollPornire - (ev.clientX - xPornire);
    });
    const opresteTragerea = (ev) => {
      if (ev.pointerId !== pointerId) return;
      pointerId = null;
      element.classList.remove("viz3-tragere-activa");
    };
    element.addEventListener("pointerup", opresteTragerea);
    element.addEventListener("pointercancel", opresteTragerea);
  }

  // Ca si `randeazaVizualizarea`: primeste sectiunea proprie, deja goala. Oprirea
  // ceasurilor foliilor nu mai e treaba ei — grila poate fi bifata in acelasi
  // timp cu tabelul (vezi `opresteCeasurileFoliilor`).
  function randeazaTabelFluenta(container, model) {
    container.appendChild(
      construiesteTitluReprezentare(
        `Tabel % fluență per subtablă (serie calupuri) — ${model.eticheta_domeniu} · ${model.adancime} răsp/fact`
      )
    );

    if (model.antete.length === 0) {
      const gol = document.createElement("p");
      gol.className = "viz3-tabel-gol";
      gol.textContent =
        "Nicio dată în domeniul ales — tabelul apare când există răspunsuri înregistrate.";
      container.appendChild(gol);
      tabelFluentaAtual = null; // tabelul vechi (daca a existat) nu mai e in DOM
      return;
    }

    const scroll = document.createElement("div");
    scroll.className = "viz3-tabel-scroll";
    activeazaTragereOrizontala(scroll);
    const tabel = document.createElement("table");
    tabel.className = "viz3-tabel";

    const thead = document.createElement("thead");
    const randAntet = document.createElement("tr");
    const colTitluAntet = document.createElement("th");
    colTitluAntet.textContent = "Data:";
    randAntet.appendChild(colTitluAntet);
    construiesteCeluleAntetDate(randAntet, model.antete, "th");
    thead.appendChild(randAntet);

    const tbody = document.createElement("tbody");
    // Randurile <tr> ale blocurilor Setul 1/Setul 2 (daca s-au construit) - le
    // are nevoie randeazaGraficeStacate, mai jos, dupa ce tabelul e in DOM.
    let randuriStariAtual = null;
    model.randuri.forEach((rand) => {
      const tr = document.createElement("tr");
      if (rand.tip === "total") tr.classList.add("viz3-tabel-total");
      const capRand = document.createElement("th");
      capRand.scope = "row";
      capRand.textContent = rand.eticheta;
      tr.appendChild(capRand);

      // Referinta (cs) pt. bara de progres (2.1): ultimul procent AFISAT din
      // acest rand, sarind peste golurile dintre - nu neaparat coloana vecina.
      // Reseteaza la null la fiecare rand nou (fara referinta = prima celula).
      let procentAnteriorAfisat = null;
      // Colectate DOAR pt. randul Total: aceleasi perechi (cc, cs), refolosite
      // neschimbate de randul "Grafic bare" de deasupra (construiesteRandGraficBare).
      const perechiTotal = rand.tip === "total" ? [] : null;

      rand.celule.forEach((celula, idx) => {
        const td = document.createElement("td");
        let procentCurent = null;
        let afisata = false;
        if (rand.tip === "total") {
          // [C2] Total: mereu procent, niciodata gardat, niciodata "—".
          procentCurent = Math.round(celula.scor * 100);
          afisata = true;
          const text = document.createElement("span");
          text.className = "viz3-celula-text";
          text.textContent = `${procentCurent}%`;
          td.appendChild(text);
        } else if (motor.casutaEDeAfisat(celula)) {
          // Subtabla "valida in sine" -> procent (formatarea existenta).
          const { text: continut, clasa } = formateazaCelulaTabel(celula);
          procentCurent = Math.round(celula.scor * 100);
          afisata = true;
          const text = document.createElement("span");
          text.className = "viz3-celula-text";
          text.textContent = continut;
          td.appendChild(text);
          if (clasa) td.className = clasa;
        } else {
          // Subtabla sub prag -> gol (tooltip-ul explica de ce, mai jos).
          td.className = "viz3-tabel-celula-goala";
        }
        td.title = titluCelulaTabel(celula); // pastrat SI pe celulele goale

        if (afisata) {
          td.appendChild(construiesteBaraProgres(procentCurent, procentAnteriorAfisat));
          adaugaSageataCelula(td, {
            cc: procentCurent,
            cs: procentAnteriorAfisat,
            tipRand: rand.tip,
            esteAcum: model.antete[idx]?.este_acum === true,
          });
          if (perechiTotal) perechiTotal.push({ cc: procentCurent, cs: procentAnteriorAfisat });
          procentAnteriorAfisat = procentCurent;
        }

        tr.appendChild(td);
      });

      // Randul "Grafic bare" se insereaza chiar DEASUPRA randului Total.
      if (perechiTotal) tbody.appendChild(construiesteRandGraficBare(perechiTotal));
      tbody.appendChild(tr);
      // Sub Total: efortul zilei, efortul cumulat, copia randului de date, apoi
      // cele doua blocuri de stari (Setul 1 / Setul 2).
      if (rand.tip === "total") {
        tbody.appendChild(
          construiesteRandNumere(
            "Nr. ex. lucrate /zi",
            model.numar_exercitii_valide_pe_zi,
            "viz3-tabel-exercitii"
          )
        );
        tbody.appendChild(
          construiesteRandNumere(
            "Nr. ex cumulate",
            cumuleaza(model.numar_exercitii_valide_pe_zi),
            "viz3-tabel-exercitii"
          )
        );
        tbody.appendChild(construiesteRandDateDuplicat(model.antete));
        randuriStariAtual = construiesteBlocuriStari(tbody, model.stari_pe_momente, model.antete.length);
      }
    });

    tabel.append(thead, tbody);
    scroll.appendChild(tabel);
    container.appendChild(scroll);
    // Reglajele "Progres" (5.2) tin starea in variabile JS, nu in tabel - la
    // fiecare reconstructie (schimbare adancime/domeniu/sursa) se reaplica pe
    // tabelul nou, ca userul sa nu piarda ce a bifat/tras.
    tabelFluentaAtual = tabel;
    aplicaOptiuniProgresTabel();
    // Geometria benzilor stacate se masoara ACUM, cat tabelul e deja in DOM
    // (layout real) - vezi randeazaGraficeStacate.
    randeazaGraficeStacate(tabel, randuriStariAtual, model.stari_pe_momente);
    aplicaOptiuniGraficStacat();
    // Deschide pe coloanele recente (dreapta), nu pe cele mai vechi — acolo
    // majoritatea rândurilor sunt goale. `scrollWidth` e corect abia dupa ce
    // browserul a asezat tabelul, nu in timpul randarii (ca la masoaraTitlurile).
    setTimeout(() => {
      scroll.scrollLeft = scroll.scrollWidth;
    }, 0);

    // Linia de fezabilitate sub bifele de adâncime: cate poze ies din date.
    const nota = cpEl.querySelector('[data-nota-axa="adancime_foto"]');
    if (nota) {
      nota.textContent =
        `Adâncime: ultimele ${model.adancime} răspunsuri / fact · o coloană = o zi · ` +
        `date valide: ${model.numar_raspunsuri_valide} → ${model.antete.length} zile`;
    }
  }

  // Marcajul „(Recomandat)" langa optiunea de adancime castigatoare — informeaza,
  // nu alege in locul userului. Recalculat la fiecare analiza pe tabel (domeniul
  // sau sursa pot schimba recomandarea). Cand nicio adancime n-are celule bazate,
  // adancime_recomandata e null si toate marcajele se golesc.
  function actualizeazaMarcajeRecomandareAdancime(recomandare) {
    axaAdancime.optiuni.forEach((opt) => {
      const marcaj = cpEl.querySelector(`[data-marcaj-adancime="${opt.adancime}"]`);
      if (!marcaj) return;
      marcaj.textContent = opt.adancime === recomandare.adancime_recomandata ? " (Recomandat)" : "";
    });
  }

  // Tabelul de comparatie a adancimilor candidate, randat SUB tabelul de
  // evolutie. NU cheama replaceChildren pe container — randeazaTabelFluenta
  // tocmai l-a populat pe container (vizEl) si nu trebuie sters, doar completat.
  function randeazaTabelRecomandareAdancime(container, recomandare, axaAdancime) {
    const titlu = document.createElement("h2");
    titlu.className = "viz3-tabel-recomandare-titlu";
    titlu.textContent = "Tabel pt. recomandare adâncime per fact";
    container.appendChild(titlu);

    const tabel = document.createElement("table");
    tabel.className = "viz3-tabel viz3-tabel-recomandare";

    const thead = document.createElement("thead");
    const randAntet = document.createElement("tr");
    ["Adâncime per fact", "Nr. calupuri", "Celule în tabel (subtable × calupuri)",
     "Celule bazate (≥50 răsp. și ≥2 zile)", "% bazate"]
      .forEach((text) => {
        const th = document.createElement("th");
        th.textContent = text;
        randAntet.appendChild(th);
      });
    thead.appendChild(randAntet);

    const tbody = document.createElement("tbody");
    recomandare.candidati.forEach((candidat) => {
      const tr = document.createElement("tr");
      const esteRecomandata = candidat.adancime === recomandare.adancime_recomandata;
      if (esteRecomandata) {
        tr.classList.add("viz3-tabel-recomandat");
      }
      // Prima coloana = textul EXACT al bifei de adancime (congruenta cu CP),
      // nu doar numarul. Optiunea exista mereu (candidatii vin din axa).
      const optiune = axaAdancime.optiuni.find((o) => o.adancime === candidat.adancime);
      const etichetaAdancime = optiune ? optiune.eticheta : `${candidat.adancime} răspunsuri / fact`;
      [
        etichetaAdancime,
        candidat.poze,
        candidat.celule_total,
        candidat.contor.incredere_mare,
        `${Math.round(candidat.procent_bazate * 100)}%` + (esteRecomandata ? " (Recomandat)" : ""),
      ].forEach((valoare) => {
        const td = document.createElement("td");
        td.textContent = String(valoare);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    tabel.append(thead, tbody);
    container.appendChild(tabel);

    // Legenda de sub tabel: ce inseamna fiecare coloana. Termenii sunt EXACT
    // antetele coloanelor (congruenta cu tabelul); definitiile sunt textul
    // userului, verbatim.
    const legenda = document.createElement("dl");
    legenda.className = "viz3-legenda-recomandare";
    [
      ["Adâncime per fact", "Nr. de turns trecute de evaluat pt. fiecare fact."],
      ["Nr. calupuri", "În câte calupuri suprapuse se împarte istoricul de turns (= coloanele tabelului)."],
      ["Celule în tabel (subtable × calupuri)", 'Câte celule apar în tabelul de evoluție a fluenței tablei (except linia "Total") = nr. de subtable × nr. calupuri.'],
      ["Celule bazate (≥50 răsp. și ≥2 zile)", "Nr. de celule pentru calcularea cărora s-au folosit ≥ 50 de turns ȘI din 2+ zile diferite ⇒ raport mare signal/noise."],
      ["% bazate", '% de celule bazate din toate celulele din tabel (except rândul "Total").'],
    ].forEach(([termen, definitie]) => {
      const dt = document.createElement("dt");
      dt.textContent = termen;
      const dd = document.createElement("dd");
      dd.textContent = definitie;
      legenda.append(dt, dd);
    });
    container.appendChild(legenda);
  }

  // ---- flux principal ---------------------------------------------------

  const motor = global.MotorAnalizaVizualizare3;
  const praguri = global.ConfigPraguriVizualizare3;
  const axe = global.DefinitiiAxeVizualizare3;
  const folii = global.DefinitiiFoliiVizualizare3;
  const cfgCompozitie = global.DefinitiiCompozitieVizualizare3;
  const aranjamente = global.DefinitiiAranjamenteVizualizare3;
  const fixture = global.FixtureLoguriDummyVizualizare3;
  const presete = global.PreseteVizualizare3 ?? [];

  const cpEl = document.getElementById("viz3-cp");
  const vizEl = document.getElementById("viz3-viz");

  // Meniu mobil: pe ecran in portret (mai inalt decat lat = telefon), CP-ul e
  // un sertar ascuns; butonul "Meniu" si fundalul intunecat il deschid/inchid.
  // Pe ecran lat (desktop), clasa n-are efect — CSS-ul de portret nu se aplica.
  const meniuToggleEl = document.getElementById("viz3-meniu-toggle");
  const meniuBackdropEl = document.getElementById("viz3-cp-backdrop");
  const interogarePortret = global.matchMedia?.("(orientation: portrait)");

  // Cerculetul „se lucreaza": feedback imediat ca apasarea a fost primita, cat
  // motorul (re)calculeaza modelul si tabelul se randeaza. Vezi analizeazaSiRandeaza.
  const incarcareEl = document.getElementById("viz3-incarcare");

  function seteazaMeniuDeschis(deschis) {
    document.body.classList.toggle("viz3-meniu-deschis", deschis);
    meniuToggleEl?.setAttribute("aria-expanded", deschis ? "true" : "false");
    if (meniuBackdropEl) meniuBackdropEl.hidden = !deschis;
  }

  meniuToggleEl?.addEventListener("click", () => {
    seteazaMeniuDeschis(!document.body.classList.contains("viz3-meniu-deschis"));
  });
  meniuBackdropEl?.addEventListener("click", () => seteazaMeniuDeschis(false));
  // La rotire (portret -> landscape sau invers), sertarul se inchide — pe
  // landscape CP-ul revine oricum vizibil dintr-o coloana fixa, nu ca sertar.
  interogarePortret?.addEventListener?.("change", () => seteazaMeniuDeschis(false));

  // Tabla singura (folii debifate) se tine dupa latimea disponibila, deci se
  // repotriveste si cand ecranul isi schimba marimea: rotirea telefonului sau
  // redimensionarea ferestrei pe PC. Asteptam sa se opreasca tragerea de
  // fereastra, ca sa nu recalculam scara la fiecare pixel.
  let ceasRepotrivire = null;
  global.addEventListener?.("resize", () => {
    if (foliiActive || dimensiuneAleasaManual) return;
    if (ceasRepotrivire) clearTimeout(ceasRepotrivire);
    ceasRepotrivire = setTimeout(() => {
      ceasRepotrivire = null;
      if (!foliiActive && !dimensiuneAleasaManual) potrivesteDimensiuneaLaEcran();
    }, 150);
  });

  // Domeniul ales tine minte peste refresh, ca importul. Altfel fiecare Ctrl+R
  // te intoarce la tabla implicita, iar datele de pe alt interval par disparute
  // (grila iese goala desi jurnalul e acolo).
  const CHEIE_DOMENIU_SALVAT = "viz3_domeniu_salvat";

  function esteIntervalValid(interval) {
    return ["aMin", "aMax", "bMin", "bMax"].every((cheie) =>
      Number.isInteger(interval?.[cheie])
    );
  }

  function citesteDomeniuSalvat() {
    try {
      const brut = global.localStorage?.getItem(CHEIE_DOMENIU_SALVAT);
      if (!brut) return null;
      const parsat = JSON.parse(brut);
      if (!esteIntervalValid(parsat?.interval)) return null;
      return parsat;
    } catch {
      return null;
    }
  }

  function salveazaDomeniu(optiuneId, interval) {
    try {
      global.localStorage?.setItem(
        CHEIE_DOMENIU_SALVAT,
        JSON.stringify({ optiune_id: optiuneId, interval })
      );
    } catch {
      // Storage plin sau indisponibil: domeniul tine doar sesiunea curenta.
    }
  }

  // Domeniul curent = intervalul optiunii bifate. Il luam din definitii, ca sa
  // nu duplicam aici valoarea implicita. Cel salvat are prioritate, dar numai
  // daca optiunea lui inca exista si e activa — definitiile se pot schimba.
  const axaDomeniu = axe.flatMap((etapa) => etapa.axe).find((a) => a.id === "domeniu");
  const domeniuSalvat = citesteDomeniuSalvat();
  const optiuneSalvata = axaDomeniu?.optiuni.find(
    (o) => o.id === domeniuSalvat?.optiune_id && !o.dezactivata
  );
  const intervalPornire = optiuneSalvata
    ? domeniuSalvat.interval
    : axaDomeniu?.optiuni.find((o) => o.activa)?.interval;
  let catalog = global.construiesteCatalogInmultire(intervalPornire);

  // Combinatia „default" de reprezentari (ce se incarca la refresh) tine minte
  // peste refresh, ca domeniul. Defaultul se schimba DOAR cu butonul
  // „Set as default" (nu prin bifare: bifarea comuta doar ce vezi acum,
  // temporar). La refresh se incarca combinatia marcata, niciodata ultimele bife.
  const CHEIE_REPREZENTARE_DEFAULT = "viz3_reprezentare_default";

  // Se salveaza o lista JSON de id-uri. Valoarea veche (un singur id, text
  // simplu, de pe vremea radio-urilor) se citeste ca lista de un element, ca
  // defaultul deja marcat de user sa nu se piarda.
  function citesteReprezentariDefaultSalvate() {
    try {
      const brut = global.localStorage?.getItem(CHEIE_REPREZENTARE_DEFAULT);
      if (!brut) return [];
      if (!brut.startsWith("[")) return [brut];
      const lista = JSON.parse(brut);
      return Array.isArray(lista) ? lista.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }

  function salveazaReprezentariDefault(idOptiuni) {
    try {
      global.localStorage?.setItem(CHEIE_REPREZENTARE_DEFAULT, JSON.stringify(idOptiuni));
    } catch {
      // Storage plin/indisponibil: defaultul tine doar sesiunea curenta.
    }
  }

  // Sursa aleasa tine minte peste refresh, ca domeniul. Trei surse: „jurnal"
  // (jurnalul real, citit live din IndexedDB la fiecare selectare), „import"
  // (doar fisierul importat, fara fallback pe jurnal) si „fixture" (dummy-ul
  // generat).
  const CHEIE_SURSA_ACTIVA = "viz3_sursa_activa";
  const SURSE = ["jurnal", "import", "fixture"];

  function salveazaSursaActiva() {
    try {
      global.localStorage?.setItem(CHEIE_SURSA_ACTIVA, sursaActiva);
    } catch {
      // Storage indisponibil: alegerea tine doar sesiunea curenta.
    }
  }

  let sursaActiva = "jurnal";
  try {
    const salvata = global.localStorage?.getItem(CHEIE_SURSA_ACTIVA);
    if (SURSE.includes(salvata)) sursaActiva = salvata;
  } catch {
    // Ramane implicitul.
  }

  // Fisierul importat tine minte peste refresh (localStorage), ca sa nu-l
  // pierzi la un F5 din greseala. `null` = nu e niciun import activ; userul
  // a revenit explicit la sursa live sau n-a importat inca nimic.
  const CHEIE_IMPORT_SALVAT = "viz3_import_jurnal_salvat";

  function citesteImportSalvat() {
    try {
      const brut = global.localStorage?.getItem(CHEIE_IMPORT_SALVAT);
      if (!brut) return null;
      const parsat = JSON.parse(brut);
      if (!parsat || !Array.isArray(parsat.inregistrari)) return null;
      return parsat;
    } catch {
      return null;
    }
  }

  let importSalvat = citesteImportSalvat();

  // Migrare de la schema cu 2 surse: „import" salvat fara vreun fisier
  // importat insemna, pe vechea semantica, jurnalul real. Pe cea noua ar fi
  // un buton dezactivat — il ducem la sensul lui adevarat.
  if (sursaActiva === "import" && !importSalvat) sursaActiva = "jurnal";

  // Ce s-a afisat efectiv (poate diferi de ce s-a cerut: „jurnal" fara date
  // reale cade pe dummy). Butoanele se evidentiaza dupa asta.
  let sursaAfisata = sursaActiva;

  function salveazaImport(nume, inregistrari) {
    importSalvat = { nume, inregistrari };
    try {
      global.localStorage?.setItem(CHEIE_IMPORT_SALVAT, JSON.stringify(importSalvat));
    } catch {
      // Storage plin sau indisponibil: importul tot merge pentru sesiunea curenta.
    }
  }

  // Ce reprezentari sunt bifate (se afiseaza simultan) si adâncimea fotografiei
  // pentru tabel. Bifarea NU se persistă — la refresh se incarca combinatia
  // marcata cu „Set as default", ca la Domeniu (convenție).
  const axaVizualizare = axe.flatMap((etapa) => etapa.axe).find((a) => a.id === "vizualizare");
  const axaAdancime = axe.flatMap((etapa) => etapa.axe).find((a) => a.id === "adancime_foto");

  // Ordinea reprezentarilor FUNCTIONALE — cele „vor urma" raman fixe, la coada
  // listei din CP (vezi `optiuniAfisate`), nu intra in ordinea asta. Porneste din
  // combinatia salvata (asa ramane si ordinea trasa candva de user), altfel din
  // definitii; o optiune functionala noua, aparuta dupa ce s-a salvat ceva, intra
  // la coada, in ordinea ei din definitii — nu dispare.
  function idOptiuniFunctionale() {
    return (axaVizualizare?.optiuni ?? []).filter((o) => !o.dezactivata).map((o) => o.id);
  }

  function ordineFunctionalaDePornire() {
    const dinDefinitii = idOptiuniFunctionale();
    const salvata = citesteReprezentariDefaultSalvate().filter((id) => dinDefinitii.includes(id));
    if (salvata.length === 0) return dinDefinitii;
    const ramase = dinDefinitii.filter((id) => !salvata.includes(id));
    return [...salvata, ...ramase];
  }

  // Singura sursa de adevar pentru ordine. Tragerea (drag & drop, maner dedicat)
  // o permuta direct, la sfarsitul tragerii — vezi activeazaTragereOptiuniReprezentare.
  let ordineFunctionale = ordineFunctionalaDePornire();

  // Filtreaza si ordoneaza dupa `ordineFunctionale`, oricare ar fi ordinea in care
  // s-au bifat optiunile.
  function inOrdineaDefinitiilor(idOptiuni) {
    const cerute = new Set(idOptiuni);
    return ordineFunctionale.filter((id) => cerute.has(id));
  }

  // Ordinea de afisat in CP: functionalele, in ordinea trasa, apoi cele
  // „vor urma" la coada, fixe (nu se trag). Pt. orice alta axa, neschimbata.
  function optiuniAfisate(axa) {
    if (axa !== axaVizualizare) return axa.optiuni;
    const functionale = ordineFunctionale
      .map((id) => axa.optiuni.find((o) => o.id === id))
      .filter(Boolean);
    const dezactivate = axa.optiuni.filter((o) => o.dezactivata);
    return [...functionale, ...dezactivate];
  }

  // Defaultul salvat are prioritate, dar numai pentru optiunile care inca exista
  // si sunt functionale (definitiile se pot schimba). Daca nu ramane nimic din
  // el, optiunile `activa` din definitii; iar daca nici acolo nu e nimic, prima
  // optiune functionala — o reprezentare ramane mereu bifata.
  function combinatiaDePornire() {
    const salvate = inOrdineaDefinitiilor(citesteReprezentariDefaultSalvate());
    if (salvate.length > 0) return salvate;
    const dinDefinitii = inOrdineaDefinitiilor(
      (axaVizualizare?.optiuni ?? []).filter((o) => o.activa).map((o) => o.id)
    );
    if (dinDefinitii.length > 0) return dinDefinitii;
    const prima = (axaVizualizare?.optiuni ?? []).find((o) => !o.dezactivata);
    return prima ? [prima.id] : [];
  }

  let reprezentariDefault = combinatiaDePornire();
  let reprezentariActive = [...reprezentariDefault];

  // Butonul unic „Set as default" de sub eticheta axei: salveaza combinatia de
  // bife din momentul apasarii. Cand bifele curente sunt exact combinatia
  // salvata, arata „default", plin si inert — acelasi tipar ca butoanele „md".
  let butonDefaultReprezentari = null;

  function aceeasiCombinatie(a, b) {
    return a.length === b.length && a.every((id, i) => id === b[i]);
  }

  function construiesteButonDefaultReprezentari() {
    const buton = document.createElement("button");
    buton.type = "button";
    buton.className = "viz3-buton-default";
    buton.addEventListener("click", faDefaultReprezentari);
    butonDefaultReprezentari = buton;
    actualizeazaButonDefaultReprezentari();
    return buton;
  }

  function actualizeazaButonDefaultReprezentari() {
    if (!butonDefaultReprezentari) return;
    const esteDefault = aceeasiCombinatie(reprezentariActive, reprezentariDefault);
    butonDefaultReprezentari.textContent = esteDefault ? "default" : "Set as default";
    butonDefaultReprezentari.title = esteDefault
      ? "Combinația bifată acum e cea care se încarcă la deschidere"
      : "Salvează combinația bifată acum ca implicită la deschidere";
    butonDefaultReprezentari.classList.toggle("viz3-buton-default--activ", esteDefault);
  }

  // Salveaza combinatia bifata acum ca default (ce se incarca la refresh).
  // Apasarea cand ea e deja defaultul nu face nimic (a facut deja). NU schimba
  // ce vezi acum — doar bifarea face asta.
  function faDefaultReprezentari() {
    if (aceeasiCombinatie(reprezentariActive, reprezentariDefault)) return;
    reprezentariDefault = [...reprezentariActive];
    salveazaReprezentariDefault(reprezentariDefault);
    actualizeazaButonDefaultReprezentari();
  }

  // Alunecarea unui rand deplasat de o tragere, de la pozitia veche la cea noua
  // (FLIP: se citeste pozitia INAINTE de schimbare, apoi se aplica un transform
  // care il tine vizual la vechiul loc, si se elibereaza intr-un frame urmator —
  // saltul devine alunecare). `deltaY` = cat s-a mutat randul (vechi minus nou).
  function animeazaAlunecarea(rand, deltaY) {
    if (!deltaY) return;
    rand.style.transition = "none";
    rand.style.transform = `translateY(${deltaY}px)`;
    requestAnimationFrame(() => {
      rand.style.transition = "transform 150ms ease";
      rand.style.transform = "";
    });
  }

  // Tragere verticala cu maner dedicat (⠿), doar intre optiunile FUNCTIONALE ale
  // Reprezentarii — cele „vor urma" raman fixe, nu au maner. Acelasi mecanism
  // (Pointer Events) ca la tabelul de fluenta: touch si mouse cu un singur cod.
  // Randul tras urmareste degetul/mouse-ul 1:1; cand centrul lui trece de
  // mijlocul unui vecin, se schimba locul in DOM. Ordinea reala (`ordineFunctionale`)
  // si re-randarea tablei se actualizeaza o singura data, la sfarsitul tragerii —
  // nu la fiecare pixel, ca la re-potrivirea tablei pe ecran.
  function activeazaTragereOptiuniReprezentare(grup) {
    const randuri = () => [...grup.querySelectorAll(".viz3-rand-reprezentare")];
    let randTras = null;
    let pointerId = null;
    let yPornire = 0;

    function laPointerDown(ev) {
      if (ev.button != null && ev.button !== 0) return;
      const rand = ev.currentTarget.closest(".viz3-rand-reprezentare");
      if (!rand) return;
      randTras = rand;
      pointerId = ev.pointerId;
      yPornire = ev.clientY;
      try {
        rand.setPointerCapture(pointerId);
      } catch {}
      rand.classList.add("viz3-tras");
    }

    function laPointerMove(ev) {
      if (!randTras || ev.pointerId !== pointerId) return;
      randTras.style.transform = `translateY(${ev.clientY - yPornire}px)`;

      const toate = randuri();
      const index = toate.indexOf(randTras);
      const rectTras = randTras.getBoundingClientRect();
      const centruTras = rectTras.top + rectTras.height / 2;

      if (index > 0) {
        const vecin = toate[index - 1];
        const rectVecin = vecin.getBoundingClientRect();
        if (centruTras < rectVecin.top + rectVecin.height / 2) {
          grup.insertBefore(randTras, vecin);
          yPornire -= rectVecin.height; // continuitate: randul tras nu sare
          animeazaAlunecarea(vecin, rectVecin.top - vecin.getBoundingClientRect().top);
          return;
        }
      }
      if (index < toate.length - 1) {
        const vecin = toate[index + 1];
        const rectVecin = vecin.getBoundingClientRect();
        if (centruTras > rectVecin.top + rectVecin.height / 2) {
          grup.insertBefore(vecin, randTras);
          yPornire += rectVecin.height;
          animeazaAlunecarea(vecin, rectVecin.top - vecin.getBoundingClientRect().top);
        }
      }
    }

    function laPointerUp(ev) {
      if (!randTras || ev.pointerId !== pointerId) return;
      randTras.classList.remove("viz3-tras");
      randTras.style.transform = "";
      pointerId = null;
      randTras = null;
      // Ordinea noua = ordinea din DOM acum. Se propaga in starea reala si se
      // re-randeaza tabla o singura data (nu in timpul tragerii).
      ordineFunctionale = randuri().map((r) => r.dataset.optiuneId);
      reprezentariActive = inOrdineaDefinitiilor(reprezentariActive);
      actualizeazaButonDefaultReprezentari();
      rerandeaza();
    }

    randuri().forEach((rand) => {
      rand.querySelector(".viz3-maner-tragere")?.addEventListener("pointerdown", laPointerDown);
    });
    grup.addEventListener("pointermove", laPointerMove);
    grup.addEventListener("pointerup", laPointerUp);
    grup.addEventListener("pointercancel", laPointerUp);
  }

  let adancimeActiva = axaAdancime?.optiuni.find((o) => o.activa)?.adancime ?? 5;
  // true doar dupa ce userul bifeaza manual o alta adancime decat cea
  // recomandata; se reseteaza la fiecare deschidere a tabelului, schimbare de
  // domeniu sau de sursa (vezi reseteazaVizualizarea si listenerul de mai jos).
  let adancimeAlesaManual = false;
  let ultimaAnaliza = null; // { inregistrari, info } — pt. re-randare fără recitirea sursei

  // Starea comutatoarelor/reglajelor "Progres" (5.2), tinuta aici fiindca
  // tabelul insusi se reconstruieste des (schimbare adancime/domeniu/sursa) —
  // vezi aplicaOptiuniProgresTabel. Valorile initiale = defaultul din
  // definitii-axe.js (constructia controalelor le suprascrie oricum imediat).
  let progresTabelSagetiTotal = true;
  let progresTabelSagetiAcum = true;
  let progresTabelSagetiToate = true;
  let progresTabelBaraActiva = false;
  let progresTabelLatime = 100;
  let progresTabelPozitie = 50;
  let progresTabelInaltime = 90;
  let progresTabelOpacitateRosu = 50;
  // Randul "Grafic bare" (deasupra Total): stare + reglaje complet separate de
  // cele de mai sus - cele doua bife nu se ating intre ele (decizie: 1a).
  let progresTabelGraficBareActiv = true;
  let progresTabelGraficBareLatime = 100;
  let progresTabelGraficBarePozitie = 50;
  let progresTabelGraficBareInaltime = 90;
  let progresTabelGraficBareOpacitateRosu = 50;
  let tabelFluentaAtual = null; // <table> curent, sau null cand nu e randat

  // Comutatoarele (Setul 1 / Setul 2, independente) + UN SINGUR set de 3
  // reglaje comune ambelor (5.2, "Grafic stacked pt stări") - vezi
  // aplicaOptiuniGraficStacat. Implicit nebifate, ca bara verticală.
  let graficStacatSet1Activ = true;
  let graficStacatSet2Activ = true;
  let graficStacatLatime = 100;
  let graficStacatPozitie = 50;
  let graficStacatOpacitate = 88;

  // Bifa "Afișează Tabel pt. recomandare adâncime per fact" (ultima din 5.2).
  // Schimbarea ei re-randeaza (vezi delegarea de change), nu doar comuta o clasa
  // pe tabelul deja randat, ca la sageti/bara: blocul intreg (tabel + legenda)
  // fie exista in DOM, fie nu.
  let afiseazaTabelRecomandare = true;

  // Pur prezentare: clase + variabile CSS pe tabelul curent. Nu atinge modelul
  // motorului. No-op cand tabelul nu exista inca (ex. la construirea CP-ului).
  function aplicaOptiuniProgresTabel() {
    if (!tabelFluentaAtual) return;
    tabelFluentaAtual.classList.toggle("viz3-arata-sageti-total", progresTabelSagetiTotal);
    tabelFluentaAtual.classList.toggle("viz3-arata-sageti-acum", progresTabelSagetiAcum);
    tabelFluentaAtual.classList.toggle("viz3-arata-sageti-toate", progresTabelSagetiToate);
    tabelFluentaAtual.classList.toggle("viz3-arata-bara", progresTabelBaraActiva);
    tabelFluentaAtual.style.setProperty("--viz3-bara-latime", `${progresTabelLatime}%`);
    tabelFluentaAtual.style.setProperty("--viz3-bara-pozitie-frac", String(progresTabelPozitie / 100));
    tabelFluentaAtual.style.setProperty("--viz3-bara-inaltime-rand", `${progresTabelInaltime}px`);
    tabelFluentaAtual.style.setProperty(
      "--viz3-bara-opacitate-rosu",
      String(progresTabelOpacitateRosu / 100)
    );

    tabelFluentaAtual.classList.toggle("viz3-arata-grafic-bare", progresTabelGraficBareActiv);
    tabelFluentaAtual.style.setProperty("--viz3-grafic-bare-latime", `${progresTabelGraficBareLatime}%`);
    tabelFluentaAtual.style.setProperty(
      "--viz3-grafic-bare-pozitie-frac",
      String(progresTabelGraficBarePozitie / 100)
    );
    tabelFluentaAtual.style.setProperty(
      "--viz3-grafic-bare-inaltime-rand",
      `${progresTabelGraficBareInaltime}px`
    );
    tabelFluentaAtual.style.setProperty(
      "--viz3-grafic-bare-opacitate-rosu",
      String(progresTabelGraficBareOpacitateRosu / 100)
    );
  }

  // Pur prezentare, ca aplicaOptiuniProgresTabel: clase + variabile CSS pe
  // tabelul curent. Benzile insele (geometria) sunt deja in DOM
  // (randeazaGraficeStacate) - aici doar se arata/ascunde fiecare set si se
  // seteaza latime/pozitie/opacitate, comune ambelor.
  function aplicaOptiuniGraficStacat() {
    if (!tabelFluentaAtual) return;
    tabelFluentaAtual.classList.toggle("viz3-arata-grafic-stacat-set1", graficStacatSet1Activ);
    tabelFluentaAtual.classList.toggle("viz3-arata-grafic-stacat-set2", graficStacatSet2Activ);
    tabelFluentaAtual.style.setProperty("--viz3-grafic-stacat-latime", `${graficStacatLatime}%`);
    tabelFluentaAtual.style.setProperty(
      "--viz3-grafic-stacat-pozitie-frac",
      String(graficStacatPozitie / 100)
    );
    tabelFluentaAtual.style.setProperty(
      "--viz3-grafic-stacat-opacitate",
      String(graficStacatOpacitate / 100)
    );
  }

  // Buton "sliders": comuta panoul colapsabil de reglaje aflat imediat sub
  // randul bifei. Panoul ramane mereu in DOM (doar `hidden`), ca sliderele
  // sa-si pastreze valorile cand se inchide si redeschide panoul.
  function construiesteButonSlidere(panou) {
    const buton = document.createElement("button");
    buton.type = "button";
    buton.className = "viz3-buton-slidere";
    buton.textContent = "sliders";
    buton.setAttribute("aria-expanded", "false");
    buton.addEventListener("click", () => {
      const seDeschide = panou.hidden;
      panou.hidden = !seDeschide;
      buton.setAttribute("aria-expanded", String(seDeschide));
      buton.classList.toggle("viz3-buton-slidere--activ", seDeschide);
    });
    return buton;
  }

  // Comutatoarele + reglajele "Progres" (5.2): control special, ca folii, cu
  // comutatoare independente (nu se exclud).
  function randeazaControlProgresTabel(grup, axa) {
    const optSagetiTotal = axa.optiuni.find((o) => o.id === "sageti_total");
    const optSagetiAcum = axa.optiuni.find((o) => o.id === "sageti_acum");
    const optSagetiToate = axa.optiuni.find((o) => o.id === "sageti_toate");
    const optBara = axa.optiuni.find((o) => o.id === "bara_verticala");
    const optGraficBare = axa.optiuni.find((o) => o.id === "grafic_bare_rand");

    // O bifa de sageti: seteaza starea prin `aplicaStare` si reaplica clasele
    // (fara re-randare). dataset.preset = progres_tabel_<id> -> intra in sertarul
    // localStorage al subsectiunii; la restaurare sistemul reemite `change`, deci
    // listenerul de aici prinde valoarea.
    function faBifaSageti(opt, aplicaStare) {
      const rand = document.createElement("label");
      rand.className = "viz3-optiune";
      const bifa = document.createElement("input");
      bifa.type = "checkbox";
      bifa.checked = opt.activa === true;
      bifa.dataset.preset = `progres_tabel_${opt.id}`;
      aplicaStare(bifa.checked);
      const text = document.createElement("span");
      text.textContent = opt.eticheta;
      bifa.addEventListener("change", () => {
        aplicaStare(bifa.checked);
        aplicaOptiuniProgresTabel();
      });
      rand.append(bifa, text);
      return rand;
    }

    const subtitluSageti = document.createElement("div");
    subtitluSageti.className = "viz3-optiuni-subtitlu";
    subtitluSageti.textContent = "Afișează săgeți";

    const randTotal = faBifaSageti(optSagetiTotal, (v) => (progresTabelSagetiTotal = v));
    const randAcum = faBifaSageti(optSagetiAcum, (v) => (progresTabelSagetiAcum = v));
    const randToate = faBifaSageti(optSagetiToate, (v) => (progresTabelSagetiToate = v));

    // Rand liber intre grupul de sageti si subtitlul barei (cerinta).
    const spatiu = document.createElement("div");
    spatiu.className = "viz3-spatiu-optiuni";

    const subtitluBare = document.createElement("div");
    subtitluBare.className = "viz3-optiuni-subtitlu";
    subtitluBare.textContent = "Bară de progres verticală";

    // O bifa de bara + butonul ei "sliders" + panoul colapsabil cu cele 4
    // reglaje, chiar sub rand. `stare` grupeaza toti setterii (activ + cele 4
    // reglaje) intr-un singur obiect, ca "In fiecare celula" si "Grafic bare"
    // sa foloseasca aceeasi functie fara sa impartaseasca nicio variabila -
    // fiecare bifa isi are propriile slidere, independente (decizie: 1a).
    function construiesteGrupBara(opt, prefixPreset, stare) {
      const rand = document.createElement("div");
      rand.className = "viz3-rand-cu-slidere";

      const eticheta = document.createElement("label");
      eticheta.className = "viz3-optiune";
      const bifa = document.createElement("input");
      bifa.type = "checkbox";
      bifa.checked = opt.activa === true;
      bifa.dataset.preset = `progres_tabel_${opt.id}`;
      const text = document.createElement("span");
      text.textContent = opt.eticheta;
      eticheta.append(bifa, text);

      const panou = document.createElement("div");
      panou.className = "viz3-panou-slidere";
      panou.hidden = true;
      const butonSlidere = construiesteButonSlidere(panou);
      rand.append(eticheta, butonSlidere);

      const reglaje = axa.reglaje ?? [];
      const gasesteReglaj = (id) => reglaje.find((r) => r.id === id);

      const latime = randeazaSlider(gasesteReglaj("latime"), stare.latime, prefixPreset);
      const pozitie = randeazaSlider(gasesteReglaj("pozitie"), stare.pozitie, prefixPreset);
      const inaltime = randeazaSlider(gasesteReglaj("inaltime"), stare.inaltime, prefixPreset);
      const opacitateRosu = randeazaSlider(
        gasesteReglaj("opacitate_rosu"),
        stare.opacitateRosu,
        prefixPreset
      );
      panou.append(latime.rand, pozitie.rand, inaltime.rand, opacitateRosu.rand);

      // Sliderele n-au sens cat timp bifa e oprita - dezactivate, ca la
      // "Activeaza foliile".
      const sliderele = [latime.slider, pozitie.slider, inaltime.slider, opacitateRosu.slider];
      sliderele.forEach((el) => (el.disabled = !bifa.checked));
      stare.activ(bifa.checked);
      bifa.addEventListener("change", () => {
        stare.activ(bifa.checked);
        sliderele.forEach((el) => (el.disabled = !bifa.checked));
        aplicaOptiuniProgresTabel();
      });

      return { rand, panou };
    }

    const grupBara = construiesteGrupBara(optBara, "progres_tabel", {
      activ: (v) => (progresTabelBaraActiva = v),
      latime: (v) => {
        progresTabelLatime = v;
        aplicaOptiuniProgresTabel();
      },
      pozitie: (v) => {
        progresTabelPozitie = v;
        aplicaOptiuniProgresTabel();
      },
      inaltime: (v) => {
        progresTabelInaltime = v;
        aplicaOptiuniProgresTabel();
      },
      opacitateRosu: (v) => {
        progresTabelOpacitateRosu = v;
        aplicaOptiuniProgresTabel();
      },
    });

    const grupGraficBare = construiesteGrupBara(optGraficBare, "progres_tabel_grafic", {
      activ: (v) => (progresTabelGraficBareActiv = v),
      latime: (v) => {
        progresTabelGraficBareLatime = v;
        aplicaOptiuniProgresTabel();
      },
      pozitie: (v) => {
        progresTabelGraficBarePozitie = v;
        aplicaOptiuniProgresTabel();
      },
      inaltime: (v) => {
        progresTabelGraficBareInaltime = v;
        aplicaOptiuniProgresTabel();
      },
      opacitateRosu: (v) => {
        progresTabelGraficBareOpacitateRosu = v;
        aplicaOptiuniProgresTabel();
      },
    });

    grup.append(
      subtitluSageti,
      randTotal,
      randAcum,
      randToate,
      spatiu,
      subtitluBare,
      grupBara.rand,
      grupBara.panou,
      grupGraficBare.rand,
      grupGraficBare.panou
    );
  }

  // Comutatoarele "Grafic stacked pt stări" (5.2): doua bife independente
  // (Setul 1 / Setul 2, nu se exclud) + UN SINGUR panou de 3 reglaje, comun
  // amandurora (spre deosebire de "Progres" de mai sus, unde fiecare bifa
  // are reglajele ei) - decizia userului, 10.08.2026.
  function randeazaControlGraficStacat(grup, axa) {
    const optSet1 = axa.optiuni.find((o) => o.id === "set1");
    const optSet2 = axa.optiuni.find((o) => o.id === "set2");
    const reglaje = axa.reglaje ?? [];
    const gasesteReglaj = (id) => reglaje.find((r) => r.id === id);
    const prefixPreset = "grafic_stacat_stari";

    const panou = document.createElement("div");
    panou.className = "viz3-panou-slidere";
    panou.hidden = true;

    const latime = randeazaSlider(
      gasesteReglaj("latime"),
      (v) => {
        graficStacatLatime = v;
        aplicaOptiuniGraficStacat();
      },
      prefixPreset
    );
    const pozitie = randeazaSlider(
      gasesteReglaj("pozitie"),
      (v) => {
        graficStacatPozitie = v;
        aplicaOptiuniGraficStacat();
      },
      prefixPreset
    );
    const opacitate = randeazaSlider(
      gasesteReglaj("opacitate"),
      (v) => {
        graficStacatOpacitate = v;
        aplicaOptiuniGraficStacat();
      },
      prefixPreset
    );
    panou.append(latime.rand, pozitie.rand, opacitate.rand);
    const sliderele = [latime.slider, pozitie.slider, opacitate.slider];

    // Sliderele comune raman active cat timp ORICARE bifa e pornita -
    // dezactivate doar cand niciun grafic nu e afisat (n-ar avea ce sa regleze).
    function actualizeazaDisabled() {
      const vreunulActiv = graficStacatSet1Activ || graficStacatSet2Activ;
      sliderele.forEach((el) => (el.disabled = !vreunulActiv));
    }

    function faBifaSet(opt, aplicaStare) {
      const rand = document.createElement("label");
      rand.className = "viz3-optiune";
      const bifa = document.createElement("input");
      bifa.type = "checkbox";
      bifa.checked = opt.activa === true;
      bifa.dataset.preset = `${prefixPreset}_${opt.id}`;
      aplicaStare(bifa.checked);
      const text = document.createElement("span");
      text.textContent = opt.eticheta;
      bifa.addEventListener("change", () => {
        aplicaStare(bifa.checked);
        actualizeazaDisabled();
        aplicaOptiuniGraficStacat();
      });
      rand.append(bifa, text);
      return rand;
    }

    const randSet1 = faBifaSet(optSet1, (v) => (graficStacatSet1Activ = v));
    const randSet2 = faBifaSet(optSet2, (v) => (graficStacatSet2Activ = v));
    actualizeazaDisabled();

    const butonSlidere = construiesteButonSlidere(panou);
    grup.append(randSet1, randSet2, butonSlidere, panou);
  }

  function adancimeDinOptiune(idOptiune) {
    return axaAdancime?.optiuni.find((o) => o.id === idOptiune)?.adancime ?? adancimeActiva;
  }

  // Arată subsecțiunile de opțiuni ale TUTUROR reprezentărilor bifate (5.1, 5.2
  // sau ambele); subsecțiunile care nu aparțin niciunei reprezentări rămân mereu
  // vizibile.
  function actualizeazaSubsectiuni() {
    const etapaViz = axe.find((e) => e.reprezentare_subsectiuni);
    const mapare = etapaViz?.reprezentare_subsectiuni ?? {};
    const legate = new Set(Object.values(mapare));
    const vizibile = new Set(reprezentariActive.map((id) => mapare[id]).filter(Boolean));
    cpEl.querySelectorAll("[data-subsectiune]").forEach((el) => {
      const id = el.dataset.subsectiune;
      el.hidden = legate.has(id) && !vizibile.has(id);
    });
  }

  // Cel puțin o reprezentare rămâne bifată. Când a mai rămas una, rândul ei spune
  // prin tooltip de ce nu se debifează. Nu o dezactivăm vizibil: gri-ul înseamnă
  // deja „vor urma" în CP-ul ăsta, ar spune două lucruri diferite cu același semn.
  function actualizeazaBifaBlocata() {
    const singura = reprezentariActive.length === 1 ? reprezentariActive[0] : null;
    cpEl.querySelectorAll('input[data-preset^="vizualizare_"]').forEach((input) => {
      const id = input.dataset.preset.slice("vizualizare_".length);
      const rand = input.closest(".viz3-optiune") ?? input;
      rand.title = id === singura ? "Cel puțin o reprezentare trebuie să rămână bifată" : "";
    });
  }

  // Cache-ul sweep-ului de adancimi candidate (4 rulari complete ale motorului):
  // se recalculeaza doar cand se schimba efectiv sursa de date sau domeniul
  // (referinte diferite), nu la fiecare rerandare din CP — sagetile, barele
  // sau graficul stacat nu ating deloc datele, deci n-au de ce sa retriggerui-e
  // acelasi calcul greu.
  let cacheRecomandare = null;
  function obtineRecomandareAdancime(inregistrari, catalogCurent) {
    if (
      cacheRecomandare &&
      cacheRecomandare.inregistrari === inregistrari &&
      cacheRecomandare.catalog === catalogCurent
    ) {
      return cacheRecomandare.recomandare;
    }
    const recomandare = motor.construiesteRecomandareAdancime({
      inregistrari,
      catalog: catalogCurent,
      adancimi: axaAdancime.optiuni.map((o) => o.adancime),
      praguri,
    });
    cacheRecomandare = { inregistrari, catalog: catalogCurent, recomandare };
    return recomandare;
  }

  // Lasa browserul sa picteze cerculetul de incarcare inainte sa porneasca un
  // calcul sincron lung. Deliberat setTimeout, nu requestAnimationFrame: rAF e
  // suspendat cat timp tab-ul nu e vizibil/activ (ex. userul comuta pe alt tab
  // chiar dupa click) - randarea ar ramane blocata pana revine, in loc sa
  // continue in fundal ca inainte de acest fix.
  function asteaptaRandareaIncarcarii() {
    return new Promise((rezolva) => setTimeout(rezolva, 30));
  }

  function arataIncarcare() {
    if (incarcareEl) incarcareEl.hidden = false;
  }
  function ascundeIncarcare() {
    if (incarcareEl) incarcareEl.hidden = true;
  }

  // Blocul unei reprezentari, in sectiunea lui. Fiecare isi calculeaza modelul
  // ei si randeaza doar in `sectiune` — nimic din ce face una nu atinge blocul
  // celeilalte.
  function randeazaBlocTabelFluenta(sectiune, inregistrari) {
    const recomandare = obtineRecomandareAdancime(inregistrari, catalog);
    if (
      !adancimeAlesaManual &&
      recomandare.adancime_recomandata !== null &&
      recomandare.adancime_recomandata !== adancimeActiva
    ) {
      adancimeActiva = recomandare.adancime_recomandata;
      const optiuneRecomandata = axaAdancime.optiuni.find((o) => o.adancime === adancimeActiva);
      const inputRecomandat = optiuneRecomandata
        ? cpEl.querySelector(`input[data-preset="adancime_foto_${optiuneRecomandata.id}"]`)
        : null;
      if (inputRecomandat) inputRecomandat.checked = true;
    }
    // Modelul adancimii active a fost deja calculat in sweep-ul de mai sus
    // (e unul dintre candidati) — il refolosim in loc sa-l recalculam a 5-a
    // oara. Fallback defensiv daca vreodata adancimeActiva n-ar fi printre
    // candidati (nu se intampla azi, dar recalculul direct ramane corect).
    const candidatActiv = recomandare.candidati.find((c) => c.adancime === adancimeActiva);
    const model = candidatActiv
      ? candidatActiv.model
      : motor.construiesteModelTabelFluenta({ inregistrari, catalog, adancime: adancimeActiva, praguri });
    randeazaTabelFluenta(sectiune, model);
    actualizeazaMarcajeRecomandareAdancime(recomandare);
    if (afiseazaTabelRecomandare && model.antete.length > 0) {
      randeazaTabelRecomandareAdancime(sectiune, recomandare, axaAdancime);
    }
  }

  function randeazaBlocGrila(sectiune, inregistrari) {
    const model = motor.ruleazaAnaliza({
      inregistrari,
      catalog,
      configuratie: CONFIGURATIE,
      praguri,
    });
    randeazaVizualizarea(sectiune, model);
  }

  async function analizeazaSiRandeaza(inregistrari, info) {
    ultimaAnaliza = { inregistrari, info };
    arataIncarcare();
    await asteaptaRandareaIncarcarii();
    try {
      if (!reprezentariActive.includes("grila_10x10")) opresteCeasurileFoliilor();
      vizEl.replaceChildren();
      // Antetul cu sursa o singura data, sus; apoi cate o sectiune pentru fiecare
      // reprezentare bifata, in ordinea din definitii. Sectiunile sunt fratii pe
      // care ii va reordona drag & drop-ul: fiecare isi poarta id-ul in
      // `data-reprezentare`.
      vizEl.appendChild(construiesteAntet(info));
      reprezentariActive.forEach((idReprezentare) => {
        const sectiune = document.createElement("section");
        sectiune.className = "viz3-reprezentare";
        sectiune.dataset.reprezentare = idReprezentare;
        vizEl.appendChild(sectiune);
        if (idReprezentare === "tabel_fluenta") {
          randeazaBlocTabelFluenta(sectiune, inregistrari);
        } else {
          randeazaBlocGrila(sectiune, inregistrari);
        }
      });
      // Tabelul nu mai e in pagina: reglajele din 5.2 n-au ce comanda.
      if (!reprezentariActive.includes("tabel_fluenta")) tabelFluentaAtual = null;
    } finally {
      ascundeIncarcare();
    }
  }

  function rerandeaza() {
    if (ultimaAnaliza) analizeazaSiRandeaza(ultimaAnaliza.inregistrari, ultimaAnaliza.info);
  }

  // Ce se afiseaza, de sus in jos. Folosita si la pornire, si la schimbarea
  // sursei, si la schimbarea domeniului — nimic nu se sterge pe drum.
  async function reseteazaVizualizarea() {
    adancimeAlesaManual = false;
    if (sursaActiva === "fixture") {
      sursaAfisata = "fixture";
      await analizeazaSiRandeaza(fixture.construiesteFixture(), "Sursă: dummy log pe 8 săptămâni.");
      return;
    }
    if (sursaActiva === "import" && importSalvat) {
      sursaAfisata = "import";
      const cate = importSalvat.inregistrari.length;
      await analizeazaSiRandeaza(importSalvat.inregistrari, `Sursă: „${importSalvat.nume}" (${cate} apăsări).`);
      return;
    }
    // „jurnal" (si, defensiv, un „import" ramas fara fisier — nu se poate
    // alege din UI, dar starea persistata nu e sub controlul nostru).
    const reale = await citesteJurnalul();
    if (reale.length > 0) {
      sursaAfisata = "jurnal";
      await analizeazaSiRandeaza(reale, `Sursă: jurnal real din IndexedDB (${reale.length} apăsări).`);
      return;
    }
    sursaAfisata = "fixture";
    await analizeazaSiRandeaza(
      fixture.construiesteFixture(),
      "Sursă: dummy log pe 8 săptămâni (jurnalul real din IndexedDB e gol)."
    );
  }

  // Un domeniu nou = alt catalog, acelasi flux. Datele nu se recitesc altfel;
  // se schimba doar intervalul pe care il asezam.
  function schimbaDomeniu(optiuneId, interval) {
    catalog = global.construiesteCatalogInmultire(interval);
    salveazaDomeniu(optiuneId, interval);
    reseteazaVizualizarea();
  }

  randeazaControlPanel(cpEl, axe);
  actualizeazaBifaBlocata();
  actualizeazaSubsectiuni();
  // Delegare pe container: schimbarea reprezentarii (grila/tabel) sau a
  // marimii calupului re-randeaza fara sa recitim sursa de date.
  cpEl.addEventListener("change", (ev) => {
    const preset = ev.target?.dataset?.preset ?? "";
    if (preset.startsWith("vizualizare_")) {
      const idReprezentare = preset.slice("vizualizare_".length);
      // Cel putin o reprezentare ramane mereu bifata: debifarea ultimei se
      // anuleaza si nu se intampla nimic altceva.
      if (!ev.target.checked && reprezentariActive.length === 1) {
        ev.target.checked = true;
        return;
      }
      const cerute = ev.target.checked
        ? [...reprezentariActive, idReprezentare]
        : reprezentariActive.filter((id) => id !== idReprezentare);
      reprezentariActive = inOrdineaDefinitiilor(cerute);
      // Tabelul tocmai bifat isi ia din nou adancimea recomandata, ca inainte.
      if (ev.target.checked && idReprezentare === "tabel_fluenta") adancimeAlesaManual = false;
      // Bifarea DOAR comuta ce vezi acum; NU schimba defaultul. Doar butonul
      // „Set as default" salveaza combinatia — la refresh se incarca ea, nu
      // ultimele bife. O bifare netransformata-in-default se pierde la refresh.
      actualizeazaButonDefaultReprezentari();
      actualizeazaBifaBlocata();
      actualizeazaSubsectiuni();
      rerandeaza();
    }
    if (preset.startsWith("adancime_foto_") && ev.target.checked) {
      adancimeActiva = adancimeDinOptiune(preset.slice("adancime_foto_".length));
      adancimeAlesaManual = true;
      rerandeaza();
    }
    if (preset === "afiseaza_tabel_recomandare_activ") {
      afiseazaTabelRecomandare = ev.target.checked;
      rerandeaza();
    }
  });
  // Defaultul se aplica dupa prima randare, nu inainte: sliderul dimensiunii
  // foliei isi ia maximul real (latimea tablei) abia atunci (sincronizeazaDimensiune),
  // iar un preset aplicat mai devreme ar fi clampat gresit de un range fara max.
  reseteazaVizualizarea().then(() => {
    zonePreseturi.forEach((zona) => zona.aplicaDefault());
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
