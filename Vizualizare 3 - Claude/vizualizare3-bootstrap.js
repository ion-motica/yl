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

  // Buton care descarca jurnalul brut (asa cum sta in IndexedDB) ca JSON, ca
  // sa poata fi verificat in afara browserului, fara copy-paste din consola.
  function butonDescarcaJurnal() {
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = "Export log JSON in Downloads";
    buton.addEventListener("click", async () => {
      const inregistrari = await citesteJurnalul();
      const json = JSON.stringify(inregistrari, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = numeFisierExport("salvare-log-activitate");
      link.click();
      URL.revokeObjectURL(url);
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
    slider.dataset.preset = `folii_${reglaj.id}`;

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

    definitii.forEach((etapa) => {
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

        axa.optiuni.forEach((opt) => {
          const input = document.createElement("input");
          input.type = axa.tip_selectie === "multipla" ? "checkbox" : "radio";
          input.name = `${etapa.etapa}-${axa.id}`;
          // Doar axa Domeniu tine minte alegerea; restul pornesc din definitii.
          const bifatDinSalvare = axa === axaDomeniu && optiuneSalvata;
          input.checked = bifatDinSalvare ? opt.id === optiuneSalvata.id : opt.activa === true;
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
          const rand = optiune(opt.eticheta, elemente);
          if (opt.dezactivata) rand.classList.add("viz3-dezactivata");
          grup.appendChild(rand);
          if (campuriInterval) grup.appendChild(campuriInterval.element);
        });

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
        titlu.textContent = folie.eticheta;
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
    // Evidentiem ce se vede acum, nu ce s-a cerut: fara import si fara jurnal
    // real, „import" cade oricum pe dummy, si butonul n-are voie sa minta.
    if (id === sursaAfisata) buton.classList.add("viz3-sursa-aleasa");
    buton.addEventListener("click", () => {
      sursaActiva = id;
      salveazaSursaActiva();
      reseteazaVizualizarea();
    });
    return buton;
  }

  function randeazaVizualizarea(container, model, info) {
    container.replaceChildren();

    const antet = document.createElement("div");
    antet.className = "viz3-viz-antet";
    const titlu = document.createElement("h1");
    // Titlul urmeaza domeniul ales: catalogul curent isi stie intervalul.
    titlu.textContent = `Starea curentă — tabla înmulțirii ${catalog.eticheta}`;
    // Trei randuri: ce vezi acum / ce poti alege / import-export.
    const sursa = document.createElement("div");
    sursa.className = "viz3-sursa";
    sursa.append(
      randSursa([info]),
      randSursa([
        butonAlegeSursa("import", "Alege log importat"),
        butonAlegeSursa("fixture", "Alege dummy log pe 8 săptămâni"),
      ]),
      randSursa([butonDescarcaJurnal(), butonImportaJurnal()])
    );
    antet.append(titlu, sursa);
    container.appendChild(antet);

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
    // Panza isi ia marimea din datele aranjamentelor, nu din CSS.
    const panza = panzaMax();
    document.documentElement.style.setProperty("--viz3-panza-coloane", String(panza.coloane));
    document.documentElement.style.setProperty("--viz3-panza-randuri", String(panza.randuri));
    sincronizeazaDimensiune();
    aplicaViteza();
    aplicaAranjament();
    // Masuram abia dupa ce browserul a asezat pagina: in timpul randarii,
    // masuratorile ies gresite. `setTimeout`, nu `requestAnimationFrame`:
    // rAF nu se executa deloc cat timp pagina sta intr-un tab nefocalizat.
    setTimeout(() => {
      masoaraTitlurile([...stiva.querySelectorAll(".viz3-folie")]);
    }, 0);
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

  // Sursa aleasa tine minte peste refresh, ca domeniul. „import" inseamna
  // datele tale (fisierul importat, sau jurnalul real daca n-ai importat).
  const CHEIE_SURSA_ACTIVA = "viz3_sursa_activa";
  const SURSE = ["import", "fixture"];

  function salveazaSursaActiva() {
    try {
      global.localStorage?.setItem(CHEIE_SURSA_ACTIVA, sursaActiva);
    } catch {
      // Storage indisponibil: alegerea tine doar sesiunea curenta.
    }
  }

  let sursaActiva = "import";
  try {
    const salvata = global.localStorage?.getItem(CHEIE_SURSA_ACTIVA);
    if (SURSE.includes(salvata)) sursaActiva = salvata;
  } catch {
    // Ramane implicitul.
  }
  // Ce s-a afisat efectiv (poate diferi de ce s-a cerut: „import" fara niciun
  // import cade pe dummy). Butoanele se evidentiaza dupa asta.
  let sursaAfisata = sursaActiva;

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

  function salveazaImport(nume, inregistrari) {
    importSalvat = { nume, inregistrari };
    try {
      global.localStorage?.setItem(CHEIE_IMPORT_SALVAT, JSON.stringify(importSalvat));
    } catch {
      // Storage plin sau indisponibil: importul tot merge pentru sesiunea curenta.
    }
  }

  function analizeazaSiRandeaza(inregistrari, info) {
    const model = motor.ruleazaAnaliza({
      inregistrari,
      catalog,
      configuratie: CONFIGURATIE,
      praguri,
    });
    randeazaVizualizarea(vizEl, model, info);
  }

  // Ce se afiseaza, de sus in jos. Folosita si la pornire, si la schimbarea
  // sursei, si la schimbarea domeniului — nimic nu se sterge pe drum.
  async function reseteazaVizualizarea() {
    if (sursaActiva === "fixture") {
      sursaAfisata = "fixture";
      analizeazaSiRandeaza(fixture.construiesteFixture(), "Sursă: dummy log pe 8 săptămâni.");
      return;
    }
    if (importSalvat) {
      sursaAfisata = "import";
      const cate = importSalvat.inregistrari.length;
      analizeazaSiRandeaza(importSalvat.inregistrari, `Sursă: „${importSalvat.nume}" (${cate} apăsări).`);
      return;
    }
    const reale = await citesteJurnalul();
    if (reale.length > 0) {
      sursaAfisata = "import";
      analizeazaSiRandeaza(reale, `Sursă: jurnal real (${reale.length} apăsări).`);
      return;
    }
    sursaAfisata = "fixture";
    analizeazaSiRandeaza(
      fixture.construiesteFixture(),
      "Sursă: dummy log pe 8 săptămâni (jurnal real gol, niciun log importat)."
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
  // Defaultul se aplica dupa prima randare, nu inainte: sliderul dimensiunii
  // foliei isi ia maximul real (latimea tablei) abia atunci (sincronizeazaDimensiune),
  // iar un preset aplicat mai devreme ar fi clampat gresit de un range fara max.
  reseteazaVizualizarea().then(() => {
    zonePreseturi.forEach((zona) => zona.aplicaDefault());
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
