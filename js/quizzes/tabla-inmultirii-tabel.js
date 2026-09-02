// TABLA INMULTIRII - TABEL — intrebarea e tabla de inmultire completa a
// nivelului curent (nr tabla = nivel, 1-10), randata ca <table> cu linii
// invizibile. Un singur rand (factorul intrebat) arata "?" pe fundal
// portocaliu in celula "produs" — SINGURUL semnal vizual al intrebarii
// active (fara chenar in jurul randului: scos explicit, user 02.09.2026 —
// "e o prostie, va fi inlocuit de altceva").
//
// Fiecare celula, rand si coloana are id stabil (prefix "ti-"), ca sa poata
// fi modificate punctual mai tarziu (ascundere/highlight — cerute de user,
// nu implementate inca; reordonarea factor/nr-tabla exista, vezi
// rocadaColoane() mai jos). Trecerea intre randuri, in ACELASI nivel,
// nu retrimite tot tabelul: foloseste contractul "Mod scriere intrebare
// noua" din falling-engine.js (`elementeDivIntrebare`, cauta
// `data-element-div-intrebare="id"` deja randat si ii schimba doar
// continutul). La schimbare de nivel, tabelul se rescrie integral (nu se
// trimite `elementeDivIntrebare` — motorul cade singur pe randare completa).
(function (global) {
  "use strict";

  const QUIZ_ID = "tabla-inmultirii-tabel";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const MIN_FACTOR = 1;
  const MAX_FACTOR = 10;

  // "din primele 5 neraspunse" (user, 01.09.2026).
  const CANDIDATI_PREFERATI = 5;
  // "1 RCPA (raspuns corect din prima apasare) SAU 2 aparitii — indiferent
  // de RCPA — inchide factul pe nivelul curent" (user, 01.09.2026).
  //
  // Atentie, distinctie esentiala: asta numara APARITII ale intrebarii
  // (o aparitie = de la afisare pana la apasarea corecta care o inchide —
  // regula unica din motor-3-butoane.js ramane neatinsa, orice numar de
  // apasari gresite in interiorul unei aparitii), NU apasari brute de buton.
  // `esteCorect` mai jos ramane 100% onest, fara nicio exceptie.
  //
  // NU folosim `context.corect_din_primul_turn_apasare` din motor (parea
  // solutia "gratis", dar verificat empiric era gresit aici): acel contor se
  // reseteaza doar din `motor.laAfisareaIntrebarii`, apelat STRICT din
  // `SubquizDefinition.createRuntime().begin()` — o singura data, la
  // pornirea subquiz-ului. Noi schimbam intrebarea cu
  // `runtime.setCurrentItem(...)` (vezi `sincronizeazaOrchestratorul`), care
  // NU cheama `begin()` din nou — deci acel contor ramane "prima apasare"
  // doar la prima apasare din toata sesiunea, niciodata dupa. Tinem in loc
  // un contor propriu (`apasariInAparitiaCurenta`), resetat de noi la
  // fiecare intrebare noua — pur observational, nu ajunge niciodata in
  // valoarea intoarsa de `esteCorect`.
  const MAX_APARITII_PER_FACT = 2;

  const HINT_MESSAGE = "Alege produsul corect.";
  const PREFIX = "ti";
  const ID_HEADER_ROW = `${PREFIX}-header-row`;
  const ID_WRAPPER = `${PREFIX}-wrapper`;
  const ID_TABLE = `${PREFIX}-table`;

  // Cheile in LayoutConfig (localStorage) pt. panoul CP al acestui quiz —
  // vezi `appendTablaInmultiriiTabelControlPanel` mai jos.
  const LC_ASCUNDE_TITLURI = "tablaInmultiriiTabel.ascundeTitluriColoane";
  const LC_ARATA_GRILA = "tablaInmultiriiTabel.arataGrila";
  const LC_PADDING_LATERAL = "tablaInmultiriiTabel.paddingLateralPx";
  const LC_PADDING_VERTICAL = "tablaInmultiriiTabel.paddingVerticalPx";
  // Marime font in px absoluti, NU procent (cerere user, 01.09.2026): un
  // procent e relativ la font-size-ul mostenit de la parinte (`.number` din
  // falling-engine.js, 5rem implicit), care se schimba de la sine cand
  // `fitNumberText` (acelasi fisier, ruleaza la orice re-randare, nu doar la
  // "liftul ajunge jos") micsoreaza acel parinte ca sa incapa continutul in
  // lift — de-acolo "resetul" de dimensiune raportat de user. Px absolut nu
  // mosteneste nimic de la parinte, deci ramane exact ce a ales userul din
  // CP, indiferent ce face fitNumberText in jurul lui. Cheie noua (nu
  // "marimeFontPct") ca sa nu reinterpretam gresit o valoare veche salvata ca
  // procent, acum ca px.
  const LC_MARIME_FONT_PX = "tablaInmultiriiTabel.marimeFontPx";
  const MARIME_FONT_PX_IMPLICITA = 28;
  const MARIME_FONT_PX_MIN = 8;
  const MARIME_FONT_PX_MAX = 48;
  const MARIME_FONT_PX_PAS = 1;
  // "Scris mic %" (redenumit din "Scris in numarare %", 02.09.2026, scop
  // extins) — procent DIN marimea de mai sus, aplicat acum pe TOATE coloanele
  // de dupa "produs" (spatiu1, numarare*, spatiu2, adunari-repetate, counter
  // — vezi claseCelula), nu doar pe cele "numarare". Cheia LayoutConfig ramane
  // neschimbata (semantica ei — un procent 0-100 — nu s-a schimbat, doar
  // scopul vizual s-a largit), ca sa nu pierdem valoarea deja salvata de
  // user. Ramane procent (nu px): un font-size CSS in procent e relativ la
  // parinte PRIN DEFINITIE — functioneaza corect indiferent ca parintele
  // (#ti-wrapper) e acum in px, fara calcul manual (vezi stilPartajat).
  //
  // Recalculata automat, o singura data la fiecare intrare intr-un nivel nou
  // (cerere user, 02.09.2026) — vezi redimensionareAutomataTabelInmultiri()
  // si planificaRedimensionareAutomata() mai jos: coloanele "numarare" cresc
  // cu nivelul (pana la 10), deci tabelul se poate lati mai mult decat
  // incape in cadrul albastru al intrebarii. Intre doua nivele, userul poate
  // ajusta manual din CP fara sa-i fie suprascrisa valoarea.
  const LC_MARIME_FONT_NUMARARE_PCT = "tablaInmultiriiTabel.marimeFontNumararePct";
  const MARIME_FONT_NUMARARE_IMPLICITA = 75;
  const MARIME_FONT_NUMARARE_MIN = 10;
  const MARIME_FONT_NUMARARE_MAX = 100;
  const MARIME_FONT_NUMARARE_PAS = 1;
  const PADDING_MIN = 0;
  const PADDING_MAX = 30;
  const PADDING_PAS = 1;
  const CULOARE_GRILA = "#2d3d52"; // acelasi gri-albastru ca bordura .menu-toggle

  // "Rocada comutativitate every turn" (cerere user, 02.09.2026) — la fiecare
  // intrebare noua, in ACELASI nivel, coloanele "factor" si "nr-tabla" isi
  // schimba locul (animat), demonstrand a*b=b*a. Stocat in ms (unitatea
  // naturala pt. o animatie); CP-ul arata/scrie in secunde — acelasi tipar
  // ca la alte durate din proiect (ex. getPauzaFinalizareNivelMs() din
  // addition-table-singapore-missing.js). 0 = FUNCTIA DEZACTIVATA COMPLET
  // (cerere expresa user, nu doar "swap instant") — coloanele raman fixe.
  const LC_ROCADA_DURATA_MS = "tablaInmultiriiTabel.rocadaDurataMs";
  const ROCADA_DURATA_S_IMPLICITA = 1.5;
  const ROCADA_DURATA_S_MIN = 0;
  const ROCADA_DURATA_S_MAX = 5;
  const ROCADA_DURATA_S_PAS = 0.1;

  function getAscundeTitluriColoane() {
    return global.LayoutConfig?.get(LC_ASCUNDE_TITLURI, true) ?? true;
  }

  function getArataGrila() {
    return global.LayoutConfig?.get(LC_ARATA_GRILA, true) ?? true;
  }

  function getPaddingLateralPx() {
    return global.LayoutConfig?.get(LC_PADDING_LATERAL, 0) ?? 0;
  }

  function getPaddingVerticalPx() {
    return global.LayoutConfig?.get(LC_PADDING_VERTICAL, 0) ?? 0;
  }

  function getMarimeFontPx() {
    return global.LayoutConfig?.get(LC_MARIME_FONT_PX, MARIME_FONT_PX_IMPLICITA) ?? MARIME_FONT_PX_IMPLICITA;
  }

  function getMarimeFontNumararePct() {
    return (
      global.LayoutConfig?.get(LC_MARIME_FONT_NUMARARE_PCT, MARIME_FONT_NUMARARE_IMPLICITA) ??
      MARIME_FONT_NUMARARE_IMPLICITA
    );
  }

  function getRocadaDurataMs() {
    const implicitMs = ROCADA_DURATA_S_IMPLICITA * 1000;
    return global.LayoutConfig?.get(LC_ROCADA_DURATA_MS, implicitMs) ?? implicitMs;
  }

  function getRocadaDurataS() {
    return getRocadaDurataMs() / 1000;
  }

  // Rotunjit la 0.1s (pasul stepper-ului) INAINTE de conversia in ms, ca sa
  // evitam erori de virgula mobila la clickuri repetate pe +/- (ex.
  // 1.5 - 0.1 - 0.1 = 1.2999999999999998 fara rotunjire) — acelasi motiv
  // pt. care celelalte steppere de mai sus rotunjesc (Math.round) inainte
  // de a scrie in LayoutConfig.
  function scrieRocadaDurataS(valoare) {
    const clampat = Math.min(ROCADA_DURATA_S_MAX, Math.max(ROCADA_DURATA_S_MIN, valoare));
    const rotunjit = Math.round(clampat * 10) / 10;
    global.LayoutConfig?.set(LC_ROCADA_DURATA_MS, Math.round(rotunjit * 1000));
    return rotunjit;
  }

  // Scrierile de mai jos ating direct DOM-ul deja randat (prin id fix), NU
  // trec prin round-ul quizului — o schimbare de layout din CP nu trebuie sa
  // ceara `pickNextRound()` (ar reporni nivelul curent si ar pierde progresul
  // facts-urilor deja rezolvate). Persistenta (`LayoutConfig`) tine setarea
  // corecta si pt. randarea completa urmatoare (nivel nou, quiz reselectat).
  //
  // Grila si padding-ul folosesc variabile CSS pe `#ti-wrapper` (vezi
  // `stilPartajat()`), nu stil inline per celula — o schimbare live nu
  // trebuie sa parcurga ~120 celule din DOM, doar sa schimbe o singura
  // proprietate pe wrapper; cascada CSS face restul.
  function scrieAscundeTitluriColoane(ascunse) {
    global.LayoutConfig?.set(LC_ASCUNDE_TITLURI, ascunse);
    const rand = document.getElementById(ID_HEADER_ROW);
    if (rand) rand.style.display = ascunse ? "none" : "";
  }

  function scrieArataGrila(arata) {
    global.LayoutConfig?.set(LC_ARATA_GRILA, arata);
    document.getElementById(ID_WRAPPER)?.classList.toggle("ti-grila", arata);
  }

  function scriePaddingLateralPx(valoare) {
    const clamped = Math.min(PADDING_MAX, Math.max(PADDING_MIN, Math.round(valoare)));
    global.LayoutConfig?.set(LC_PADDING_LATERAL, clamped);
    document.getElementById(ID_WRAPPER)?.style.setProperty("--ti-pad-x", `${clamped}px`);
    return clamped;
  }

  function scriePaddingVerticalPx(valoare) {
    const clamped = Math.min(PADDING_MAX, Math.max(PADDING_MIN, Math.round(valoare)));
    global.LayoutConfig?.set(LC_PADDING_VERTICAL, clamped);
    document.getElementById(ID_WRAPPER)?.style.setProperty("--ti-pad-y", `${clamped}px`);
    return clamped;
  }

  function scrieMarimeFontPx(valoare) {
    const clamped = Math.min(MARIME_FONT_PX_MAX, Math.max(MARIME_FONT_PX_MIN, Math.round(valoare)));
    global.LayoutConfig?.set(LC_MARIME_FONT_PX, clamped);
    const wrapper = document.getElementById(ID_WRAPPER);
    if (wrapper) wrapper.style.fontSize = `${clamped}px`;
    return clamped;
  }

  function scrieMarimeFontNumararePct(valoare) {
    const clamped = Math.min(MARIME_FONT_NUMARARE_MAX, Math.max(MARIME_FONT_NUMARARE_MIN, Math.round(valoare)));
    global.LayoutConfig?.set(LC_MARIME_FONT_NUMARARE_PCT, clamped);
    document.getElementById(ID_WRAPPER)?.style.setProperty("--ti-mic-font-scala", `${clamped}%`);
    return clamped;
  }

  // Latimea disponibila in "cadrul albastru al intrebarii" (liftul) —
  // ACEEASI cutie pe care questionMaxWidth() din falling-engine.js o masoara
  // pt. fitNumberText (motivul pt. care acest quiz a optat afara din ea, vezi
  // fixedTextSize mai sus: un <table> intreg are nevoie de logica proprie de
  // fit, nu de shrink-to-fit generic pe text). #falling/.falling-inner sunt
  // id/clase stabile din index.html, nu specifice acestui quiz.
  function latimeDisponibilaInCadru() {
    const lift = document.getElementById("falling");
    if (!lift) return 0;
    const rect = lift.getBoundingClientRect();
    const inner = lift.querySelector(".falling-inner");
    const padX = inner ? Math.max(12, (rect.width - inner.clientWidth) / 2 + 8) : 16;
    return Math.max(0, Math.floor(rect.width - padX * 2));
  }

  // "mai mare"/"mai mic" fata de cadrul albastru (cerere user, 02.09.2026,
  // numele si forma EXACT cum au fost cerute).
  function comparaLatimeTabelCuLatimeDivAlbastru() {
    const wrapper = document.getElementById(ID_WRAPPER);
    if (!wrapper) return "mai mic";
    const lc = latimeDisponibilaInCadru();
    const lt = wrapper.getBoundingClientRect().width;
    return lt > lc ? "mai mare" : "mai mic";
  }

  // Creste "Scris mic %" cu 1 cat timp mai are loc, apoi se opreste cu UN
  // pas inapoi (cerere user, 02.09.2026): fara pasul inapoi, bucla s-ar opri
  // exact pe prima valoare care DEPASESTE cadrul, nu pe ultima care inca
  // incape. `scrieMarimeFontNumararePct` intoarce valoarea CLAMPATA — daca
  // nu s-a schimbat fata de cea ceruta, am atins MARIME_FONT_NUMARARE_MAX si
  // nu mai are unde creste (oprire, fara overflow de corectat).
  function mareste() {
    let precedenta = getMarimeFontNumararePct();
    for (;;) {
      const aplicata = scrieMarimeFontNumararePct(precedenta + 1);
      if (aplicata === precedenta) return;
      if (comparaLatimeTabelCuLatimeDivAlbastru() === "mai mare") {
        scrieMarimeFontNumararePct(precedenta);
        return;
      }
      precedenta = aplicata;
    }
  }

  // Scade "Scris mic %" cu 1 cat timp tabelul tot depaseste cadrul. Se
  // opreste exact cand incape (nu are nevoie de pas inapoi, spre deosebire de
  // mareste() — "mai mic" e deja starea finala dorita). `scrieMarimeFontNumararePct`
  // clampat la MARIME_FONT_NUMARARE_MIN opreste bucla si daca tabelul tot nu
  // incape la minimul absolut (altfel ar bucla la infinit).
  function micsoreaza() {
    let valoare = getMarimeFontNumararePct();
    while (comparaLatimeTabelCuLatimeDivAlbastru() === "mai mare") {
      const aplicata = scrieMarimeFontNumararePct(valoare - 1);
      if (aplicata === valoare) return;
      valoare = aplicata;
    }
  }

  // Singura functie apelata din afara — vezi planificaRedimensionareAutomata
  // (in closure, stie cand tabelul nivelului curent chiar e in DOM). Exclusiv
  // pt. acest quiz (cerere user, 02.09.2026): NU atinge "Marime font (px)"
  // (marimea textului principal factor/x/nr-tabla/egal/produs — userul a
  // cerut explicit sa ramana neschimbata, controlata STRICT manual din CP) —
  // ajusteaza doar "Scris mic %", singurul procent care influenteaza latimea
  // coloanelor "numarare", care se inmultesc cu nivelul (pana la 10).
  function redimensionareAutomataTabelInmultiri() {
    if (comparaLatimeTabelCuLatimeDivAlbastru() === "mai mare") micsoreaza();
    else mareste();
  }

  // Numele canonice de coloana, exact cum le-a dat userul. "spatiu1"/"spatiu2"
  // nu sunt in textul original (acolo erau goale) — botez celulele goale ca sa
  // aiba si ele id, cerut explicit ("id pt fiecare celula, rand si coloana").
  // Coloana "plus" (dupa produs) si randul-schela de sub fiecare rand principal
  // au fost scoase (cerere user, 01.09.2026) — "adunari-repetate" preia rolul
  // lui "+" direct pe randul principal (ex. "2+").
  // Coloanele "numarare" sunt dinamice: atatea cate e nivelul (cerere user,
  // 01.09.2026) — "pt inmultirea cu 1, 1 coloana, pt tabla cu 2, 2 coloane
  // s.a.m.d.", ca pe randul f coloana k sa arate (f-1)*nivel+k — asa ULTIMA
  // coloana numarare de pe rand coincide mereu cu produsul f*nivel (vezi
  // valoareStaticaCelula). Functie de `nivel`, nu constanta ca inainte (cand
  // erau mereu exact 3).
  function coloanePentruNivel(nivel) {
    const numarare = [];
    for (let k = 1; k <= nivel; k++) numarare.push(`numarare${k}`);
    return [
      "factor", "x", "nr-tabla", "egal", "produs", "spatiu1",
      ...numarare, "spatiu2",
      "adunari-repetate", "counter",
    ];
  }
  // Cele 5 coloane care formeaza propozitia aritmetica "factor x nr-tabla =
  // produs" — folosite azi doar pt. "Scris mic %" (claseCelula: tot ce nu e
  // in acest grup primeste fontul mic). Nu mai desemneaza un chenar vizual
  // (scos, vezi comentariul din capul fisierului).
  const COLOANE_CADRU = ["factor", "x", "nr-tabla", "egal", "produs"];
  // "x/nr-tabla/egal nu trebuie sa fie late cat celulele cu 2 cifre — latime
  // de 1 caracter" (cerere user, 01.09.2026) — vezi clasa "ti-cell-simbol" in
  // stilPartajat()/claseCelula().
  const COLOANE_INGUSTE = ["x", "nr-tabla", "egal"];
  const ETICHETE_HEADER = {
    factor: "factor", x: "x", "nr-tabla": "nr tabla", egal: "egal", produs: "produs",
    numarare1: "numarare", "adunari-repetate": "adunari repetate", counter: "counter",
  };

  // Stilul de baza al celulelor traieste intr-un <style> imbricat in wrapper
  // (vezi construiesteTabelComplet), nu inline per celula — asa incat
  // "Arata grila"/padding-urile din CP sa se schimbe live pe TOATE celulele
  // deodata (o singura proprietate CSS pe wrapper, nu o bucla peste ~120
  // noduri DOM). Fiecare <td> primeste doar `class="ti-cell"`.
  function stilPartajat() {
    return (
      `.ti-cell{padding:var(--ti-pad-y,0) var(--ti-pad-x,0);border:1px solid transparent;` +
      `text-align:center;min-width:1.5em;color:var(--text);box-sizing:border-box;}` +
      // "x/nr-tabla/egal ingusta la 1 caracter" (cerere user, 01.09.2026).
      `.ti-cell.ti-cell-simbol{min-width:1ch;}` +
      // "Scris mic %" — toate coloanele de dupa "produs" (cerere user,
      // 02.09.2026, vezi claseCelula) — procent CSS relativ la parintele
      // mostenit (#ti-wrapper), calculeaza singur "N% din scrisul de la
      // 3*5=15" fara nicio aritmetica in JS.
      `.ti-cell.ti-cell-mic{font-size:var(--ti-mic-font-scala,50%);}` +
      `#${ID_WRAPPER}.ti-grila .ti-cell{border-color:${CULOARE_GRILA};}`
    );
  }

  function idCelula(coloana, f) { return `${PREFIX}-${coloana}-${f}`; }
  function idRand(f) { return `${PREFIX}-rand-${f}`; }
  function idColoana(coloana) { return `${PREFIX}-col-${coloana}`; }

  // Placeholderul standard, cu fundal portocaliu in loc de galben (cerere
  // user). Pastreaza clasa `placeholder-pt-raspuns` neschimbata — de ea are
  // nevoie `revealAnswerInPlace` din falling-engine.js ca sa gaseasca semnul
  // in DOM-ul deja randat si sa-l dezvaluie fara sa reconstruiasca tabelul.
  //
  // `spatiuRezervat`: "cand raspunsul are doua cifre, '?' sa aiba un spatiu
  // dupa el, ca la revelare sa nu se deformeze randul" (user, 01.09.2026) —
  // revelarea (`revealAnswerInPlace`) inlocuieste tot continutul span-ului,
  // deci spatiul de mai jos nu supravietuieste dupa revelare; scopul lui e
  // doar sa faca starea "?" sa ocupe deja latimea unui numar de 2 cifre,
  // ca sa nu sara latimea celulei exact in clipa revelarii.
  const placeholderGeneric = global.PlaceholderRaspuns.creeaza("?");
  const placeholder = {
    ...placeholderGeneric,
    marcaj: (spatiuRezervat) =>
      `<span class="${placeholderGeneric.clasa}" style="background:orange;color:#000;font-weight:700;border-radius:0.2em;padding:0 0.2em;">` +
      `${placeholderGeneric.semn}${spatiuRezervat ? " " : ""}</span>`,
  };

  // Interschimba doua coloane intregi ale unui <table>, cu animatie —
  // "rocada comutativitate" (cerere user, 02.09.2026: la fiecare intrebare
  // noua, coloanele "factor" si "nr-tabla" isi schimba locul, demonstrand
  // a*b=b*a). Functie primita de la user aproape verbatim (generata initial
  // cu ChatGPT) — cere <colgroup> cu cate un <col id="..."> per coloana si
  // fiecare rand cu exact o celula per coloana, fara rowspan/colspan; tabelul
  // din construiesteTabelComplet() respecta deja ambele conditii, deci
  // functia nu are nevoie de nicio adaptare.
  //
  // Continutul celulelor (valoareStaticaCelula/continutCelula, mai jos) e
  // legat de NUMELE coloanei, nu de pozitia ei vizuala — deci mutarea
  // nodurilor DOM facuta aici nu strica nimic din ce genereaza restul
  // fisierului. Fiecare celula/rand e identificat prin id (nu prin pozitie),
  // deci reordonarea e sigura pt. orice alt cod care cauta un id anume.
  async function rocadaColoane(tabelId, coloana1Id, coloana2Id, timpInMs) {
    const tabel = document.getElementById(tabelId);
    const coloana1 = document.getElementById(coloana1Id);
    const coloana2 = document.getElementById(coloana2Id);

    if (!(tabel instanceof HTMLTableElement)) {
      throw new TypeError(`Nu există un <table> cu id-ul „${tabelId}”.`);
    }

    if (!(coloana1 instanceof HTMLTableColElement) ||
        coloana1.closest('table') !== tabel) {
      throw new TypeError(
        `„${coloana1Id}” trebuie să fie id-ul unui <col> din tabelul „${tabelId}”.`
      );
    }

    if (!(coloana2 instanceof HTMLTableColElement) ||
        coloana2.closest('table') !== tabel) {
      throw new TypeError(
        `„${coloana2Id}” trebuie să fie id-ul unui <col> din tabelul „${tabelId}”.`
      );
    }

    if (!Number.isFinite(timpInMs) || timpInMs < 0) {
      throw new TypeError(
        'timpInMs trebuie să fie un număr finit mai mare sau egal cu 0.'
      );
    }

    if (coloana1Id === coloana2Id) {
      return false;
    }

    const colgroupuri = [...tabel.children]
      .filter(element => element.tagName === 'COLGROUP');

    if (colgroupuri.length !== 1) {
      throw new Error('Tabelul trebuie să aibă exact un <colgroup>.');
    }

    const colgroup = colgroupuri[0];
    const coloane = [...colgroup.children]
      .filter(element => element instanceof HTMLTableColElement);

    const indexColoana1 = coloane.indexOf(coloana1);
    const indexColoana2 = coloane.indexOf(coloana2);

    if (indexColoana1 === -1 || indexColoana2 === -1) {
      throw new Error(
        'Ambele coloane trebuie să fie copii direcți ai aceluiași <colgroup>.'
      );
    }

    const randuri = [...tabel.rows];

    for (const rand of randuri) {
      const celule = [...rand.cells];
      const areCeluleCombinate = celule.some(
        celula => celula.colSpan !== 1 || celula.rowSpan !== 1
      );

      if (celule.length !== coloane.length || areCeluleCombinate) {
        throw new Error(
          'Fiecare rând trebuie să aibă exact o celulă pentru fiecare coloană, fără rowspan/colspan.'
        );
      }
    }

    const tabeleInAnimatie = rocadaColoane.tabeleInAnimatie ||
      (rocadaColoane.tabeleInAnimatie = new WeakSet());

    if (tabeleInAnimatie.has(tabel)) {
      throw new Error(`Tabelul „${tabelId}” are deja o rocadă în desfășurare.`);
    }

    const celuleInitialePeRand = randuri.map(rand => [...rand.cells]);
    const toateCelulele = celuleInitialePeRand.flat();
    const celuleColoana1 = new Set(
      celuleInitialePeRand.map(celule => celule[indexColoana1])
    );
    const celuleColoana2 = new Set(
      celuleInitialePeRand.map(celule => celule[indexColoana2])
    );
    const celuleCareFacRocada = new Set([
      ...celuleColoana1,
      ...celuleColoana2
    ]);

    const pozitiiInitiale = new Map(
      toateCelulele.map(celula => [celula, celula.getBoundingClientRect()])
    );

    const stiluriInitiale = new Map(
      toateCelulele.map(celula => [celula, {
        transition: celula.style.transition,
        transform: celula.style.transform,
        position: celula.style.position,
        zIndex: celula.style.zIndex,
        backgroundColor: celula.style.backgroundColor,
        willChange: celula.style.willChange
      }])
    );

    tabeleInAnimatie.add(tabel);

    try {
      const coloaneInOrdineaNoua = [...coloane];
      [coloaneInOrdineaNoua[indexColoana1],
       coloaneInOrdineaNoua[indexColoana2]] =
        [coloaneInOrdineaNoua[indexColoana2],
         coloaneInOrdineaNoua[indexColoana1]];

      for (const coloana of coloaneInOrdineaNoua) {
        colgroup.append(coloana);
      }

      randuri.forEach((rand, indexRand) => {
        const celuleInOrdineaNoua = [...celuleInitialePeRand[indexRand]];
        [celuleInOrdineaNoua[indexColoana1],
         celuleInOrdineaNoua[indexColoana2]] =
          [celuleInOrdineaNoua[indexColoana2],
           celuleInOrdineaNoua[indexColoana1]];

        for (const celula of celuleInOrdineaNoua) {
          rand.append(celula);
        }
      });

      if (timpInMs === 0) {
        return true;
      }

      for (const celula of toateCelulele) {
        const pozitieInitiala = pozitiiInitiale.get(celula);
        const pozitieFinala = celula.getBoundingClientRect();
        const deplasareX = pozitieInitiala.left - pozitieFinala.left;

        celula.style.transition = 'none';
        celula.style.transform = `translateX(${deplasareX}px)`;
        celula.style.willChange = 'transform';

        if (celuleCareFacRocada.has(celula)) {
          celula.style.position = 'relative';
          celula.style.zIndex = celuleColoana1.has(celula) ? '20' : '19';
          celula.style.backgroundColor = 'transparent';
        }
      }

      await new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      for (const celula of toateCelulele) {
        celula.style.transition = `transform ${timpInMs}ms ease-in-out`;
        celula.style.transform = 'translateX(0)';
      }

      await new Promise(resolve => setTimeout(resolve, timpInMs));
      return true;
    } finally {
      for (const celula of toateCelulele) {
        const stil = stiluriInitiale.get(celula);
        celula.style.transition = stil.transition;
        celula.style.transform = stil.transform;
        celula.style.position = stil.position;
        celula.style.zIndex = stil.zIndex;
        celula.style.backgroundColor = stil.backgroundColor;
        celula.style.willChange = stil.willChange;
      }

      tabeleInAnimatie.delete(tabel);
    }
  }

  function createTablaInmultiriiTabelQuiz() {
    const { shuffle } = global.GameUtils;
    const { FactCatalog, FactStore } = global;

    let level = MIN_LEVEL;
    let gameCompleted = false;

    // Factorii 1..10 neterminati in nivelul curent, mereu pastrati crescator
    // (se scoate cu `.filter`, nu se adauga niciodata la mijloc). Un factor
    // ramane aici cat timp factul lui nu s-a inchis inca (vezi
    // MAX_APARITII_PER_FACT) — poate fi ales din nou dupa o aparitie
    // neincheiata cu RCPA.
    let neterminate = [];
    let factorCurent = null;
    // Cate aparitii ale fiecarui fact s-au INCHEIS deja pe nivelul curent
    // (cheia e `factId`, nu factorul — vezi comentariul de la
    // MAX_APARITII_PER_FACT). Se reseteaza la fiecare nivel nou.
    let aparitiiPerFact = {};
    // Cate apasari (orice fel) s-au facut in aparitia INCA DESCHISA a
    // intrebarii curente. Resetat la fiecare intrebare noua (`pregatesteFactor`),
    // incrementat din `esteCorect` (singurul loc apelat exact o data per
    // apasare reala) — vezi comentariul de la MAX_APARITII_PER_FACT.
    let apasariInAparitiaCurenta = 0;
    let options = [];
    let correctIndex = 0;
    let orchestrator = null;
    // Nivelul pt. care s-a rulat deja redimensionareAutomataTabelInmultiri()
    // — vezi planificaRedimensionareAutomata().
    let ultimulNivelRedimensionat = null;
    // Adevarat cat timp o animatie de rocada (vezi ruleazaRocadaDacaActiva)
    // e in desfasurare pe tabelul curent — evita sa chemam rocadaColoane()
    // a doua oara cat timp prima chemare inca animeaza (ar arunca eroare,
    // vezi implementarea ei).
    let rocadaInCurs = false;

    function produsPentru(f, targetLevel = level) { return f * targetLevel; }

    // Acelasi fapt (a=nivel, b=factor) ca la adaptorul existent
    // js/conexe-table-quiz/adapters/multiplication.js — asa incercarile de
    // aici si de la "Tabla inmultirii - intrebari ajutatoare 5*?=15" se
    // aduna pe ACELASI record din FactStore, nu pe doua paralele.
    function factForRow(f, targetLevel = level) {
      return FactCatalog.createFact({
        operation: "mul",
        promptForm: FactCatalog.PROMPT_FORMS.result,
        values: { a: targetLevel, b: f },
      });
    }

    function recordAttempt(correct, chosenAnswer, meta = {}) {
      const fact = factForRow(factorCurent);
      FactStore.recordAttempt(
        fact.factId,
        {
          at: meta.at,
          correct,
          responseMs: meta.responseMs,
          answer: chosenAnswer,
          timedOut: Boolean(meta.timedOut),
          quizId: QUIZ_ID,
        },
        fact
      );
    }

    function alegeFactorCurent() {
      const candidati = neterminate.slice(0, CANDIDATI_PREFERATI);
      return shuffle(candidati)[0];
    }

    function valoareStaticaCelula(coloana, f) {
      const numarareMatch = /^numarare(\d+)$/.exec(coloana);
      if (numarareMatch) {
        return String((f - 1) * level + Number(numarareMatch[1]));
      }
      switch (coloana) {
        case "factor": return String(f);
        case "x": return "x";
        case "nr-tabla": return String(level);
        case "egal": return "=";
        case "produs": return String(produsPentru(f));
        // "scrie 2+ pe fiecare rand pe acare acum e doar 2" (user, 01.09.2026)
        // — inlocuieste randul-schela cu "+" separat.
        case "adunari-repetate": return `${level}+`;
        // Spatiu (nu string gol) — cerere user, 02.09.2026: coloanele-tampon
        // dintre grupurile de coloane trebuie sa aiba continut vizibil (la
        // fontul mic, ti-cell-mic), nu doar sa fie goale.
        case "spatiu1": return " ";
        case "spatiu2": return " ";
        case "counter": return " ";
        default: return "";
      }
    }

    // "toate coloanele dupa produs au font size dat de campul Scris mic %"
    // (cerere user, 02.09.2026) — COLOANE_CADRU e EXACT {factor,x,nr-tabla,
    // egal,produs}, deci "nu e in COLOANE_CADRU" == "e dupa produs", fara sa
    // mai enumeram separat spatiu1/numarare*/spatiu2/adunari-repetate/counter.
    function claseCelula(coloana) {
      const extra = [];
      if (COLOANE_INGUSTE.includes(coloana)) extra.push("ti-cell-simbol");
      if (!COLOANE_CADRU.includes(coloana)) extra.push("ti-cell-mic");
      return extra.length ? `ti-cell ${extra.join(" ")}` : "ti-cell";
    }

    // Continutul (fara <td>) al unei celule — comun randarii complete SI
    // patch-ului de tranzitie, ca sa nu existe doua locuri care decid cum
    // arata o celula (vezi js/bond-inventory.js pt. acelasi principiu).
    // Singurul semnal vizual al intrebarii active e "?" pe celula "produs"
    // (fara chenar in jurul grupului — scos explicit, user 02.09.2026).
    function continutCelula(coloana, f, esteActiv) {
      const valoare =
        coloana === "produs" && esteActiv
          ? placeholder.marcaj(produsPentru(f) >= 10)
          : valoareStaticaCelula(coloana, f);
      return `<span>${valoare}</span>`;
    }

    function celulaHtml(coloana, f, esteActiv) {
      const id = idCelula(coloana, f);
      return `<td id="${id}" data-element-div-intrebare="${id}" class="${claseCelula(coloana)}">${continutCelula(coloana, f, esteActiv)}</td>`;
    }

    function randMainRowHtml(f) {
      const esteActiv = f === factorCurent;
      const celule = coloanePentruNivel(level).map((coloana) => celulaHtml(coloana, f, esteActiv));
      return `<tr id="${idRand(f)}" data-element-div-intrebare="${idRand(f)}">${celule.join("")}</tr>`;
    }

    function headerRowHtml() {
      const celule = coloanePentruNivel(level).map((coloana) => {
        const text = ETICHETE_HEADER[coloana] ?? "";
        const stilRotit = text ? "writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;margin:0 auto;" : "";
        return (
          `<td id="${idColoana(coloana)}-header" class="${claseCelula(coloana)}" style="height:5em;vertical-align:bottom;">` +
          `<span style="${stilRotit}">${text}</span></td>`
        );
      });
      // "bifa 'ascunde titluri coloane', default true" (user, 01.09.2026) —
      // id stabil, ca sa poata fi ascuns/aratat live din CP fara sa retrimita
      // tot tabelul (vezi appendTablaInmultiriiTabelControlPanel).
      const stilRand = getAscundeTitluriColoane() ? "display:none;" : "";
      return `<tr id="${ID_HEADER_ROW}" style="${stilRand}">${celule.join("")}</tr>`;
    }

    function colgroupHtml() {
      return `<colgroup>${coloanePentruNivel(level).map((c) => `<col id="${idColoana(c)}">`).join("")}</colgroup>`;
    }

    // Randare completa — folosita ca fallback (motorul cade pe ea singur
    // cand `elementeDivIntrebare` lipseste sau nu gaseste toate id-urile, ex.
    // la prima afisare sau la schimbare de nivel).
    function construiesteTabelComplet() {
      const randuri = [];
      for (let f = MIN_FACTOR; f <= MAX_FACTOR; f++) {
        randuri.push(randMainRowHtml(f));
      }
      // "sa dispara titlul 'Tabla inmultirii cu 2'" (user, 01.09.2026) — fara
      // caption deasupra tabelului.
      //
      // `border-collapse:separate` (nu `collapse`): in modul collapse,
      // bordurile a doua celule adiacente se combina intr-una singura, ceea ce
      // ar subtia liniile "Arata grila tabel" (fiecare .ti-cell isi are
      // propria bordura, vezi stilPartajat).
      // `id="ID_WRAPPER"` + `font-size`/`--ti-pad-x`/`--ti-pad-y`/clasa
      // "ti-grila" din CP (vezi appendTablaInmultiriiTabelControlPanel) —
      // toate ajustabile live, fara sa retrimita tot tabelul.
      const clasaGrila = getArataGrila() ? " ti-grila" : "";
      const stilWrapper =
        `text-align:center;font-size:${getMarimeFontPx()}px;` +
        `--ti-pad-x:${getPaddingLateralPx()}px;--ti-pad-y:${getPaddingVerticalPx()}px;` +
        `--ti-mic-font-scala:${getMarimeFontNumararePct()}%;`;
      return (
        `<div id="${ID_WRAPPER}" class="${clasaGrila.trim()}" style="${stilWrapper}">` +
        `<style>${stilPartajat()}</style>` +
        `<table id="${ID_TABLE}" style="border-collapse:separate;border-spacing:0;margin:0 auto;font-family:'Segoe UI', system-ui, sans-serif;">` +
        colgroupHtml() + headerRowHtml() + randuri.join("") +
        `</table></div>`
      );
    }

    // Patch-ul de tranzitie: doar cele 5 celule ale randului vechi (dezincadrate)
    // si ale randului nou (incadrate) — restul tabelului nu se atinge.
    function elementePatchTranzitie(vechiFactor, nouFactor) {
      const patch = [];
      for (const coloana of COLOANE_CADRU) {
        if (vechiFactor != null && vechiFactor !== nouFactor) {
          patch.push({ id: idCelula(coloana, vechiFactor), html: continutCelula(coloana, vechiFactor, false) });
        }
        patch.push({ id: idCelula(coloana, nouFactor), html: continutCelula(coloana, nouFactor, true) });
      }
      return patch;
    }

    function elementePatchDoarUnframe(vechiFactor) {
      return COLOANE_CADRU.map((coloana) => ({ id: idCelula(coloana, vechiFactor), html: continutCelula(coloana, vechiFactor, false) }));
    }

    function elementePatchCurent() {
      return COLOANE_CADRU.map((coloana) => ({ id: idCelula(coloana, factorCurent), html: continutCelula(coloana, factorCurent, true) }));
    }

    function vederePentruRunda(extra = {}) {
      return {
        prompt: `${factorCurent}x${level}=?`,
        promptHtml: construiesteTabelComplet(),
        options: [...options],
        correctIndex,
        hintMessage: extra.hintMessage ?? HINT_MESSAGE,
        // Opt-out din fitNumberText (falling-engine.js, cerere user,
        // 01.09.2026): quiz-ul isi gestioneaza singur marimea continutului
        // (campurile CP "Marime font"/"Scris in numarare %"), nu vrem sa i-o
        // suprascrie o functie gandita pt. prompturi text simple.
        fixedTextSize: true,
        ...extra,
      };
    }

    function vederePentruTranzitie(vechiFactor, extra = {}) {
      return { ...vederePentruRunda(extra), elementeDivIntrebare: elementePatchTranzitie(vechiFactor, factorCurent) };
    }

    function construiesteOptiuni() {
      const corect = produsPentru(factorCurent);
      // "distractorii random din intervalul 1-level*10" (user, 01.09.2026).
      const max = level * MAX_FACTOR;
      const candidati = [];
      for (let v = 1; v <= max; v++) if (v !== corect) candidati.push(v);
      const gresite = shuffle(candidati).slice(0, 2);
      options = shuffle([corect, gresite[0], gresite[1]]).map(String);
      correctIndex = options.indexOf(String(corect));
    }

    function sincronizeazaOrchestratorul(vechiFactor) {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: `${factorCurent}x${level}=?`,
        promptHtml: construiesteTabelComplet(),
        elementeDivIntrebare: elementePatchTranzitie(vechiFactor, factorCurent),
        options: [...options],
        correctIndex,
        fixedTextSize: true,
      });
    }

    function pregatesteFactor(nou, vechiFactor) {
      factorCurent = nou;
      apasariInAparitiaCurenta = 0;
      construiesteOptiuni();
      sincronizeazaOrchestratorul(vechiFactor);
      ruleazaRocadaDacaActiva(vechiFactor);
    }

    // Comuta vizual coloanele "factor"/"nr-tabla" la fiecare intrebare noua
    // DIN ACELASI nivel (vechiFactor != null — la prima intrebare a unui
    // nivel nou tabelul tocmai a fost reconstruit integral in ordinea
    // normala, deci nu exista o stare "dinainte" de la care sa animam un
    // swap). Durata 0 = functia dezactivata complet (cerere expresa user) —
    // coloanele raman fixe, nu se comuta niciodata.
    //
    // "Fire and forget": nu asteptam promisiunea — pregatesteFactor ramane
    // sincron, ca tot restul motorului de raspuns. Daca o rocada e deja in
    // desfasurare (copil care raspunde f. rapid), sarim peste turul asta:
    // fara eroare, fara stare stricata, doar o animatie "sarita" — turul
    // urmator reia normal.
    function ruleazaRocadaDacaActiva(vechiFactor) {
      if (vechiFactor == null) return;
      const durataMs = getRocadaDurataMs();
      if (durataMs <= 0 || rocadaInCurs) return;
      rocadaInCurs = true;
      rocadaColoane(ID_TABLE, idColoana("factor"), idColoana("nr-tabla"), durataMs)
        .catch(() => {})
        .finally(() => { rocadaInCurs = false; });
    }

    // Ruleaza redimensionareAutomataTabelInmultiri() o SINGURA DATA per nivel
    // (cerere user, 02.09.2026) — dupa aceea userul poate ajusta manual
    // "Scris mic %" din CP fara sa-i fie suprascrisa valoarea pana la
    // urmatorul nivel. `ultimulNivelRedimensionat` tine minte pt. ce nivel
    // s-a rulat deja, ca sa nu se repete la fiecare rerandare DIN interiorul
    // aceluiasi nivel (raspuns corect pe alt factor, patch de tranzitie etc.
    // — acelea NU trec prin incepeNivel()).
    //
    // Tabelul din DOM nu reflecta neaparat inca noul nivel in clipa asta: la
    // avansul NATURAL de nivel (dupaRaspunsCorect), incepeNivel() ruleaza
    // INAINTE de pauza/bannerul de schimbare de nivel (schimbare-de-nivel.js)
    // — promptHtml-ul nou nu ajunge in DOM decat dupa ce se termina acea
    // pauza. Verificam prin numarul de coloane "numarare" deja randate
    // (trebuie sa fie exact `level`) daca tabelul AFISAT chiar corespunde
    // nivelului curent, cu reincercari limitate (max ~5s) — acopera atat
    // pornirea directa (fara nicio pauza), cat si avansul natural (cu pauza).
    function planificaRedimensionareAutomata() {
      const nivelDePlanificat = level;
      let incercariRamase = 50;
      const incearca = () => {
        if (level !== nivelDePlanificat) return; // nivelul s-a schimbat iar intre timp, planul asta nu mai e valid
        const wrapper = document.getElementById(ID_WRAPPER);
        const coloaneNumarareInDom = wrapper
          ? wrapper.querySelectorAll('[id^="ti-numarare"]').length / (MAX_FACTOR - MIN_FACTOR + 1)
          : -1;
        if (coloaneNumarareInDom === nivelDePlanificat) {
          if (ultimulNivelRedimensionat !== nivelDePlanificat) {
            ultimulNivelRedimensionat = nivelDePlanificat;
            redimensionareAutomataTabelInmultiri();
          }
          return;
        }
        incercariRamase -= 1;
        if (incercariRamase <= 0) return; // siguranta: tabelul nu s-a materializat, renuntam curat
        setTimeout(incearca, 100);
      };
      requestAnimationFrame(incearca);
    }

    function incepeNivel() {
      neterminate = [];
      for (let f = MIN_FACTOR; f <= MAX_FACTOR; f++) neterminate.push(f);
      aparitiiPerFact = {};
      pregatesteFactor(alegeFactorCurent(), null);
      planificaRedimensionareAutomata();
    }

    // Motor 3 butoane (M3B): regula unica ramane neatinsa — "corect
    // avanseaza, gresit ramai pe loc", fara nicio exceptie, fara nicio
    // portita (vezi motor-3-butoane.js). `esteCorect` e 100% onest, ca la
    // orice alt quiz din proiect — nu exista nicio incercare "fortata".
    //
    // "1 RCPA sau 2 aparitii inchide factul" se implementeaza STRICT in
    // `dupaRaspunsCorect`, care oricum ruleaza doar cand aparitia curenta
    // s-a incheiat cu adevarat (apasare corecta): RCPA e "aparitia asta s-a
    // inchis din prima apasare", citit din contorul nostru local
    // (`apasariInAparitiaCurenta`, vezi comentariul de la
    // MAX_APARITII_PER_FACT — NU din motor). Numara aparitia inchisa pe
    // `factId`, si decide daca factorul iese din `neterminate` sau ramane
    // pentru o a doua aparitie. Nu atinge deloc ramura de "gresit" din M3B.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "tabel",
        title: "tabel",
        hintMessage: HINT_MESSAGE,
        esteCorect: (_item, index) => {
          apasariInAparitiaCurenta += 1;
          return Number(options[index]) === produsPentru(factorCurent);
        },
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `${ctx.alesul} nu e produsul corect. Încearcă din nou!`,
        },
        actiuni: {
          dupa_turn_apasare: (ctx) => {
            recordAttempt(ctx.corect, ctx.alesul, ctx.meta);
            return {};
          },
          dupaRaspunsCorect: () => {
            const rezolvatFactor = factorCurent;
            const rcpa = apasariInAparitiaCurenta === 1;
            const factId = factForRow(rezolvatFactor).factId;
            aparitiiPerFact[factId] = (aparitiiPerFact[factId] ?? 0) + 1;
            const factGata = rcpa || aparitiiPerFact[factId] >= MAX_APARITII_PER_FACT;
            const patchUnframe = elementePatchDoarUnframe(rezolvatFactor);

            if (factGata) {
              neterminate = neterminate.filter((f) => f !== rezolvatFactor);
            }

            if (neterminate.length > 0) {
              pregatesteFactor(alegeFactorCurent(), rezolvatFactor);
              return {
                action: "continue",
                view: {
                  outcome: "step-correct",
                  correct: true,
                  bounce: true,
                  // Fara `flash: "win"` — cerere user (01.09.2026): overlay-ul
                  // verde peste toata arena (`.flash.active.win`, `var(--correct)`
                  // in style.css) e prea puternic pt. acest quiz. Nu atinge CSS-ul
                  // comun — falling-engine.js declanseaza flash-ul doar daca
                  // `result.flash` e truthy, deci lipsa lui il opreste doar aici.
                  message: "Corect!",
                  ...vederePentruTranzitie(rezolvatFactor),
                },
              };
            }

            const holdView = { ...vederePentruRunda({ hintMessage: "" }), elementeDivIntrebare: patchUnframe };

            if (level >= MAX_LEVEL) {
              gameCompleted = true;
              return {
                action: "continue",
                view: {
                  outcome: "step-correct",
                  correct: true,
                  bounce: true,
                  message: "Corect!",
                  ...holdView,
                  pasUrmator: {
                    continua: {
                      outcome: "serie-terminata",
                      correct: true,
                      serie_terminata: true,
                      gameComplete: true,
                      banner: "Felicitări! Ai parcurs ultimul nivel!",
                      message: "Felicitări! Ai parcurs ultimul nivel!",
                    },
                  },
                },
              };
            }

            level += 1;
            incepeNivel();
            return {
              action: "continue",
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                message: "Corect!",
                ...holdView,
                pasUrmator: {
                  continua: {
                    outcome: "serie-terminata",
                    correct: true,
                    serie_terminata: true,
                    levelAdvanced: true,
                    banner: "Felicitări! Next level!",
                    message: `Felicitări! Nivel ${level}`,
                    nextRound: vederePentruRunda(),
                  },
                },
              },
            };
          },
        },
      });
    }

    orchestrator = global.SubquizOrchestrator.create({
      definitions: [baseDefinition()],
      activeSubquizIds: ["tabel"],
      context: { quizId: QUIZ_ID },
    });
    orchestrator.startFirst();

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => `Nivel ${level} · tabla lui ${level}`,
      getLevelButtonTitle: (targetLevel) => `Nivel ${targetLevel}: tabla lui ${targetLevel}`,

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      isCompleted: () => gameCompleted,
      setCompleted: (value) => { gameCompleted = value; },

      resetLevelState() {
        neterminate = [];
        factorCurent = null;
        aparitiiPerFact = {};
        apasariInAparitiaCurenta = 0;
        options = [];
        correctIndex = 0;
      },

      switchLevel(nextLevel) {
        if (nextLevel < MIN_LEVEL) level = MIN_LEVEL;
        else level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        gameCompleted = false;
        this.resetLevelState();
        return null;
      },

      placeholderRaspuns: placeholder,
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),

      beginRound() {
        incepeNivel();
        return vederePentruRunda();
      },

      onTimeout(meta = {}) {
        recordAttempt(false, null, { ...meta, timedOut: true });
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege produsul corect.",
          resetFall: true,
          ...vederePentruRunda({ hintMessage: "" }),
          elementeDivIntrebare: elementePatchCurent(),
        };
      },

      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      pickNextRound: () => {
        incepeNivel();
        return vederePentruRunda();
      },

      // CP - Tabla inmultirii - Tabel (cerere user, 01.09.2026, extins
      // 02.09.2026): bifa "Ascunde titluri coloane" (implicit bifata) +
      // steppere pt. padding, marime font principal (px, manual STRICT) si
      // "Scris mic %" (auto-calculat o data pe nivel, vezi
      // planificaRedimensionareAutomata — userul poate regla manual intre
      // nivele).
      // Tiparul de DOM (label+checkbox, div.pre-eq-stepper-field) copiat din
      // `appendRigleTabla110ControlPanel` (js/quizzes/rigle-tabla-1-10.js),
      // ca sa arate la fel ca restul panourilor CP.
      appendTablaInmultiriiTabelControlPanel(mount) {
        if (!mount) return;
        mount.replaceChildren();

        const addBifa = (text, getValoare, scrie) => {
          const rand = document.createElement("label");
          rand.className = "control-panel-lift-row";
          const bifa = document.createElement("input");
          bifa.type = "checkbox";
          bifa.checked = getValoare();
          bifa.addEventListener("change", () => scrie(bifa.checked));
          const span = document.createElement("span");
          span.textContent = text;
          rand.append(bifa, span);
          mount.appendChild(rand);
        };

        const addStepper = (text, getValoare, scrie, min, max, pas) => {
          const field = document.createElement("div");
          field.className = "control-panel-lift-field pre-eq-stepper-field";
          const label = document.createElement("label");
          label.textContent = text;
          const controls = document.createElement("div");
          controls.className = "pre-eq-stepper";
          const minus = document.createElement("button");
          minus.type = "button";
          minus.textContent = "-";
          const input = document.createElement("input");
          input.type = "number";
          input.min = String(min);
          input.max = String(max);
          input.step = String(pas);
          input.value = String(getValoare());
          const plus = document.createElement("button");
          plus.type = "button";
          plus.textContent = "+";
          const aplica = (valoare) => { input.value = String(scrie(Number(valoare))); };
          minus.addEventListener("click", () => aplica(Number(input.value) - pas));
          plus.addEventListener("click", () => aplica(Number(input.value) + pas));
          input.addEventListener("change", () => aplica(input.value));
          controls.append(minus, input, plus);
          field.append(label, controls);
          mount.appendChild(field);
        };

        addBifa("Ascunde titluri coloane", getAscundeTitluriColoane, scrieAscundeTitluriColoane);
        addBifa("Arata grila tabel", getArataGrila, scrieArataGrila);
        addStepper("Padding cell lateral", getPaddingLateralPx, scriePaddingLateralPx, PADDING_MIN, PADDING_MAX, PADDING_PAS);
        addStepper("Padding cell vertical", getPaddingVerticalPx, scriePaddingVerticalPx, PADDING_MIN, PADDING_MAX, PADDING_PAS);
        addStepper("Marime font (px)", getMarimeFontPx, scrieMarimeFontPx, MARIME_FONT_PX_MIN, MARIME_FONT_PX_MAX, MARIME_FONT_PX_PAS);
        addStepper(
          "Scris mic %",
          getMarimeFontNumararePct,
          scrieMarimeFontNumararePct,
          MARIME_FONT_NUMARARE_MIN,
          MARIME_FONT_NUMARARE_MAX,
          MARIME_FONT_NUMARARE_PAS
        );
        addStepper(
          "Rocada comutativitate (s)",
          getRocadaDurataS,
          scrieRocadaDurataS,
          ROCADA_DURATA_S_MIN,
          ROCADA_DURATA_S_MAX,
          ROCADA_DURATA_S_PAS
        );
      },
    };
  }

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Tabla inmultirii - Tabel",
    description: "Tabla înmulțirii ca tabel complet — alege produsul lipsă.",
    gestionareGreseli: { activ: false },
    create: createTablaInmultiriiTabelQuiz,
    // Incadrat la finalul "Clasa a 2-a" in js/manage_quiz_order_in_hamburger_menu.js
    // (cerere user, 01.09.2026).
  });
})(window);
