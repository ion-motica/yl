// TABLA INMULTIRII - TABEL — intrebarea e tabla de inmultire completa a
// nivelului curent (nr tabla = nivel, 1-10), randata ca <table> cu linii
// invizibile. Un singur rand (factorul intrebat) arata "?" cu fundal
// portocaliu in celula "produs", incadrat cu un dreptunghi cu colturi
// rotunjite pe grupul "factor x nr-tabla = produs".
//
// Fiecare celula, rand si coloana are id stabil (prefix "ti-"), ca sa poata
// fi modificate punctual mai tarziu (reordonare/ascundere/highlight — cerute
// de user, nu implementate inca). Trecerea intre randuri, in ACELASI nivel,
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
  const ID_FRAME = `${PREFIX}-frame`;

  // Cheile in LayoutConfig (localStorage) pt. panoul CP al acestui quiz —
  // vezi `appendTablaInmultiriiTabelControlPanel` mai jos.
  const LC_ASCUNDE_TITLURI = "tablaInmultiriiTabel.ascundeTitluriColoane";
  const LC_ARATA_GRILA = "tablaInmultiriiTabel.arataGrila";
  const LC_PADDING_LATERAL = "tablaInmultiriiTabel.paddingLateralPx";
  const LC_PADDING_VERTICAL = "tablaInmultiriiTabel.paddingVerticalPx";
  const LC_MARIME_FONT_PX = "tablaInmultiriiTabel.marimeFontPx";
  // "campul cu dimensiune litera sa dea marimea fontului, nu procent" (user,
  // 01.09.2026) — vezi comentariul de la `programeazaRepozitionare` pt. de ce
  // un procent era chiar cauza tehnica a "resetului la caderea liftului".
  const MARIME_FONT_IMPLICITA = 16;
  const MARIME_FONT_MIN = 8;
  const MARIME_FONT_MAX = 48;
  const MARIME_FONT_PAS = 1; // "vreau pas 1, nu 10" (user, 01.09.2026)
  const PADDING_MIN = 0;
  const PADDING_MAX = 30;
  const PADDING_PAS = 1;
  const CULOARE_GRILA = "#2d3d52"; // acelasi gri-albastru ca bordura .menu-toggle

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
    return global.LayoutConfig?.get(LC_MARIME_FONT_PX, MARIME_FONT_IMPLICITA) ?? MARIME_FONT_IMPLICITA;
  }

  // Repozitioneaza chenarul-overlay (vezi mai jos) pe randul activ curent,
  // citit din DOM (elementul cu clasa placeholderului), nu dintr-o inchidere
  // legata de o instanta de quiz — asa poate fi apelat si din scrierile CP de
  // mai jos, care sunt functii comune, nu metode de instanta.
  //
  // `requestAnimationFrame`: motorul aplica randarea (promptHtml/patch) STRICT
  // sincron, in acelasi apel care a produs vederea — dar noi nu avem un semnal
  // direct de "acum e in DOM". requestAnimationFrame ruleaza abia la
  // urmatorul repaint, dupa ce orice scriere sincrona in DOM (a motorului) s-a
  // terminat deja — sigur, fara sondare (`setTimeout`/polling).
  function repozitioneazaChenar() {
    const wrapper = document.getElementById(ID_WRAPPER);
    const cadru = document.getElementById(ID_FRAME);
    if (!wrapper || !cadru) return;
    const tdProdus = wrapper.querySelector(`.${placeholderGeneric.clasa}`)?.closest("td");
    const f = tdProdus?.id?.startsWith(`${PREFIX}-produs-`) ? tdProdus.id.slice(`${PREFIX}-produs-`.length) : null;
    const tdFactor = f != null ? document.getElementById(idCelula("factor", f)) : null;
    if (!tdProdus || !tdFactor) {
      cadru.style.display = "none";
      return;
    }
    const rWrapper = wrapper.getBoundingClientRect();
    const r1 = tdFactor.getBoundingClientRect();
    const r2 = tdProdus.getBoundingClientRect();
    cadru.style.display = "block";
    cadru.style.left = `${r1.left - rWrapper.left}px`;
    cadru.style.top = `${r1.top - rWrapper.top}px`;
    cadru.style.width = `${r2.right - r1.left}px`;
    cadru.style.height = `${Math.max(r1.height, r2.height)}px`;
  }

  function programeazaRepozitionare() {
    if (typeof global.requestAnimationFrame === "function") {
      global.requestAnimationFrame(repozitioneazaChenar);
    } else {
      repozitioneazaChenar();
    }
  }

  // O singura data, pt. toata durata paginii — cadrul trebuie repozitionat si
  // la redimensionarea ferestrei (rotire telefon, bara URL etc.), nu doar la
  // schimbari facute de quiz. Verifica mereu `#ti-wrapper` prin id, deci e
  // ieftin si inofensiv cand acest quiz nu e cel activ (nu gaseste nimic, se
  // opreste imediat).
  global.addEventListener?.("resize", programeazaRepozitionare);

  // De ce NU e suficient sa chemam `programeazaRepozitionare()` doar din
  // codul nostru (`pregatesteFactor` etc.): verificat empiric in browser —
  // motorul nu aplica raspunsul corect instant, ci dupa animatia de "urcare"
  // a numarului ales spre intrebare (`animateRising`, falling-engine.js).
  // `pregatesteFactor` ruleaza sincron, MULT inainte ca patch-ul cu noul rand
  // sa ajunga cu adevarat in DOM — un singur `requestAnimationFrame` programat
  // atunci nimereste un moment gol (nici randul vechi, nici cel nou), ascunde
  // cadrul, si nimic nu-l mai repozitioneaza dupa aceea. Solutie: un
  // MutationObserver global, care reactioneaza la schimbarea REALA din DOM,
  // oricand ar veni ea — nu la momentul din codul nostru. `attributes:false`
  // exclude updateurile continue de `style.top` ale liftului care cade
  // (foarte frecvente), observam doar `childList` (exact ce schimba
  // `tinta.innerHTML = html` din `aplicaElementeDivIntrebare`).
  if (typeof global.MutationObserver === "function" && global.document?.body) {
    new global.MutationObserver(programeazaRepozitionare).observe(global.document.body, {
      childList: true,
      subtree: true,
    });
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
  // proprietate pe wrapper; cascada CSS face restul. Fiecare scriere
  // reprogrameaza si chenarul: dimensiunile celulelor s-au schimbat.
  function scrieAscundeTitluriColoane(ascunse) {
    global.LayoutConfig?.set(LC_ASCUNDE_TITLURI, ascunse);
    const rand = document.getElementById(ID_HEADER_ROW);
    if (rand) rand.style.display = ascunse ? "none" : "";
    programeazaRepozitionare();
  }

  function scrieArataGrila(arata) {
    global.LayoutConfig?.set(LC_ARATA_GRILA, arata);
    document.getElementById(ID_WRAPPER)?.classList.toggle("ti-grila", arata);
  }

  function scriePaddingLateralPx(valoare) {
    const clamped = Math.min(PADDING_MAX, Math.max(PADDING_MIN, Math.round(valoare)));
    global.LayoutConfig?.set(LC_PADDING_LATERAL, clamped);
    document.getElementById(ID_WRAPPER)?.style.setProperty("--ti-pad-x", `${clamped}px`);
    programeazaRepozitionare();
    return clamped;
  }

  function scriePaddingVerticalPx(valoare) {
    const clamped = Math.min(PADDING_MAX, Math.max(PADDING_MIN, Math.round(valoare)));
    global.LayoutConfig?.set(LC_PADDING_VERTICAL, clamped);
    document.getElementById(ID_WRAPPER)?.style.setProperty("--ti-pad-y", `${clamped}px`);
    programeazaRepozitionare();
    return clamped;
  }

  function scrieMarimeFontPx(valoare) {
    const clamped = Math.min(MARIME_FONT_MAX, Math.max(MARIME_FONT_MIN, Math.round(valoare)));
    global.LayoutConfig?.set(LC_MARIME_FONT_PX, clamped);
    const wrapper = document.getElementById(ID_WRAPPER);
    if (wrapper) wrapper.style.fontSize = `${clamped}px`;
    programeazaRepozitionare();
    return clamped;
  }

  // Numele canonice de coloana, exact cum le-a dat userul. "spatiu1"/"spatiu2"
  // nu sunt in textul original (acolo erau goale) — botez celulele goale ca sa
  // aiba si ele id, cerut explicit ("id pt fiecare celula, rand si coloana").
  // Coloana "plus" (dupa produs) si randul-schela de sub fiecare rand principal
  // au fost scoase (cerere user, 01.09.2026) — "adunari-repetate" preia rolul
  // lui "+" direct pe randul principal (ex. "2+").
  const COLOANE = [
    "factor", "x", "nr-tabla", "egal", "produs", "spatiu1",
    "numarare1", "numarare2", "numarare3", "spatiu2",
    "adunari-repetate", "counter",
  ];
  const ETICHETE_HEADER = {
    factor: "factor", x: "x", "nr-tabla": "nr tabla", egal: "egal", produs: "produs",
    numarare1: "numarare", "adunari-repetate": "adunari repetate", counter: "counter",
  };

  // Stilul de baza al celulelor traieste intr-un <style> imbricat in wrapper
  // (vezi construiesteTabelComplet), nu inline per celula — asa incat
  // "Arata grila"/padding-urile din CP sa se schimbe live pe TOATE celulele
  // deodata (o singura proprietate CSS pe wrapper, nu o bucla peste ~120
  // noduri DOM). Fiecare <td> primeste doar `class="ti-cell"`.
  // Fara `min-width` — "am zis spatiu intre scris si margine minim... coloanele
  // cu x/3/= sunt cat cele cu 2 cifre" (user, 01.09.2026): un min-width comun
  // tuturor celulelor fortase coloanele inguste (x, egal, nr-tabla la nivel
  // mic) sa fie la fel de late ca cele cu 2 cifre. Fara el, fiecare coloana se
  // dimensioneaza singura, dupa propriul continut (layout normal de tabel).
  function stilPartajat() {
    return (
      `.ti-cell{padding:var(--ti-pad-y,0) var(--ti-pad-x,0);border:1px solid transparent;` +
      `text-align:center;color:var(--text);box-sizing:border-box;}` +
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

  // Chenarul intrebarii curente NU se mai deseneaza pe celule de tabel — "l-am
  // cerut continuu, deasupra tabelului, nu desenat prin celule" (user,
  // 01.09.2026: varianta anterioara, cu bordura pe 5 <span>-uri adiacente,
  // arata "punctata" din cauza modului in care se aliniaza marginile intre
  // celule vecine). E un singur <div id="ti-frame"> absolut pozitionat, sora
  // cu <table> in interiorul #ti-wrapper (position:relative), repozitionat cu
  // JS pe randul activ — vezi `repozitioneazaChenar` mai sus si markup-ul din
  // `construiesteTabelComplet`.
  const STIL_CADRU_OVERLAY =
    "position:absolute;display:none;pointer-events:none;box-sizing:border-box;" +
    "border:2px solid var(--win);border-radius:8px;";

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
      switch (coloana) {
        case "factor": return String(f);
        case "x": return "x";
        case "nr-tabla": return String(level);
        case "egal": return "=";
        case "produs": return String(produsPentru(f));
        case "numarare1": return String((f - 1) * 3 + 1);
        case "numarare2": return String((f - 1) * 3 + 2);
        case "numarare3": return String((f - 1) * 3 + 3);
        // "scrie 2+ pe fiecare rand pe acare acum e doar 2" (user, 01.09.2026)
        // — inlocuieste randul-schela cu "+" separat.
        case "adunari-repetate": return `${level}+`;
        case "counter": return "";
        default: return "";
      }
    }

    // Continutul (fara <td>) al unei celule — comun randarii complete SI
    // patch-ului de tranzitie, ca sa nu existe doua locuri care decid cum
    // arata o celula (vezi js/bond-inventory.js pt. acelasi principiu).
    // Nicio celula nu mai poarta stil de "incadrare" — chenarul e overlay
    // separat (vezi STIL_CADRU_OVERLAY) — deci `esteActiv` conteaza DOAR pt.
    // "produs" (numar sau placeholder "?").
    function continutCelula(coloana, f, esteActiv) {
      const valoare =
        coloana === "produs" && esteActiv
          ? placeholder.marcaj(produsPentru(f) >= 10)
          : valoareStaticaCelula(coloana, f);
      return `<span>${valoare}</span>`;
    }

    function celulaHtml(coloana, f, esteActiv) {
      const id = idCelula(coloana, f);
      return `<td id="${id}" data-element-div-intrebare="${id}" class="ti-cell">${continutCelula(coloana, f, esteActiv)}</td>`;
    }

    function randMainRowHtml(f) {
      const esteActiv = f === factorCurent;
      const celule = COLOANE.map((coloana) => celulaHtml(coloana, f, esteActiv));
      return `<tr id="${idRand(f)}" data-element-div-intrebare="${idRand(f)}">${celule.join("")}</tr>`;
    }

    function headerRowHtml() {
      const celule = COLOANE.map((coloana) => {
        const text = ETICHETE_HEADER[coloana] ?? "";
        const stilRotit = text ? "writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;margin:0 auto;" : "";
        return (
          `<td id="${idColoana(coloana)}-header" class="ti-cell" style="height:5em;vertical-align:bottom;">` +
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
      return `<colgroup>${COLOANE.map((c) => `<col id="${idColoana(c)}">`).join("")}</colgroup>`;
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
      // `position:relative` pe wrapper: ancora pt. `#ti-frame`, overlay-ul
      // absolut pozitionat cu JS (vezi `repozitioneazaChenar`) — chenarul nu
      // se mai deseneaza pe celule. `font-size` in px (nu %) + `--ti-pad-x`/
      // `--ti-pad-y`/clasa "ti-grila" din CP — toate ajustabile live, fara sa
      // retrimita tot tabelul.
      const clasaGrila = getArataGrila() ? " ti-grila" : "";
      const stilWrapper =
        `position:relative;text-align:center;font-size:${getMarimeFontPx()}px;` +
        `--ti-pad-x:${getPaddingLateralPx()}px;--ti-pad-y:${getPaddingVerticalPx()}px;`;
      return (
        `<div id="${ID_WRAPPER}" class="${clasaGrila.trim()}" style="${stilWrapper}">` +
        `<style>${stilPartajat()}</style>` +
        `<div id="${ID_FRAME}" style="${STIL_CADRU_OVERLAY}"></div>` +
        `<table style="border-collapse:separate;border-spacing:0;margin:0 auto;font-family:'Segoe UI', system-ui, sans-serif;">` +
        colgroupHtml() + headerRowHtml() + randuri.join("") +
        `</table></div>`
      );
    }

    // Patch-ul de tranzitie: doar celula "produs" a randului nou (pusa pe
    // placeholder). Randul vechi nu mai are nevoie de patch — `produs`-ul lui
    // a fost deja dezvaluit in loc de `revealAnswerInPlace`
    // (falling-engine.js), iar restul celulelor nu poarta niciun stil legat
    // de "activ" (chenarul e overlay separat, vezi STIL_CADRU_OVERLAY).
    function elementePatchProdus(f, esteActiv) {
      return [{ id: idCelula("produs", f), html: continutCelula("produs", f, esteActiv) }];
    }

    function vederePentruRunda(extra = {}) {
      return {
        prompt: `${factorCurent}x${level}=?`,
        promptHtml: construiesteTabelComplet(),
        options: [...options],
        correctIndex,
        hintMessage: extra.hintMessage ?? HINT_MESSAGE,
        ...extra,
      };
    }

    function vederePentruTranzitie(extra = {}) {
      return { ...vederePentruRunda(extra), elementeDivIntrebare: elementePatchProdus(factorCurent, true) };
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

    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: `${factorCurent}x${level}=?`,
        promptHtml: construiesteTabelComplet(),
        elementeDivIntrebare: elementePatchProdus(factorCurent, true),
        options: [...options],
        correctIndex,
      });
    }

    function pregatesteFactor(nou) {
      factorCurent = nou;
      apasariInAparitiaCurenta = 0;
      construiesteOptiuni();
      sincronizeazaOrchestratorul();
      programeazaRepozitionare();
    }

    function incepeNivel() {
      neterminate = [];
      for (let f = MIN_FACTOR; f <= MAX_FACTOR; f++) neterminate.push(f);
      aparitiiPerFact = {};
      pregatesteFactor(alegeFactorCurent());
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
            // Randul rezolvat nu mai are nevoie de patch propriu — vezi
            // comentariul de la `elementePatchProdus`.

            if (factGata) {
              neterminate = neterminate.filter((f) => f !== rezolvatFactor);
            }

            if (neterminate.length > 0) {
              pregatesteFactor(alegeFactorCurent());
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
                  ...vederePentruTranzitie(),
                },
              };
            }

            // Chenarul dispare singur: `repozitioneazaChenar` nu mai gaseste
            // placeholderul (randul rezolvat era ultimul, deja dezvaluit).
            programeazaRepozitionare();
            const holdView = vederePentruRunda({ hintMessage: "" });

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
        programeazaRepozitionare();
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege produsul corect.",
          resetFall: true,
          ...vederePentruRunda({ hintMessage: "" }),
          elementeDivIntrebare: elementePatchProdus(factorCurent, true),
        };
      },

      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      pickNextRound: () => {
        incepeNivel();
        return vederePentruRunda();
      },

      // CP - Tabla inmultirii - Tabel (cerere user, 01.09.2026): bifa
      // "Ascunde titluri coloane" (implicit bifata) + stepper "Marime font".
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
        addStepper("Marime font (px)", getMarimeFontPx, scrieMarimeFontPx, MARIME_FONT_MIN, MARIME_FONT_MAX, MARIME_FONT_PAS);
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
