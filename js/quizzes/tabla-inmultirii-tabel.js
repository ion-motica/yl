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

  // "Domeniu facts:" (dropdown CP, cerere user, 05.09.2026) — alege ATAT
  // intervalul nr-tabla/nivel CAT SI intervalul factor/rand. Inainte, astea
  // 4 limite erau constante fixe (1-10); acum se deriva din domeniul activ
  // (vezi aplicaDomeniuFacts mai jos, SINGURUL loc care le scrie). Nivelul
  // ramane, ca inainte, limita inferioara REALA (selectabila manual din
  // butoanele de nivel — vezi buildLevelPicker in app.js, care porneste azi
  // bucla de butoane de la getMinLevel(), nu de la 1 fix).
  const DOMENII_FACTS = [
    { valoare: "tabla1-10_factor1-10", text: "1..10 - 1..10", minLevel: 1, maxLevel: 10, minFactor: 1, maxFactor: 10, levelImplicit: 2 },
    { valoare: "tabla1-10_factor11-20", text: "1..10 - 11..20", minLevel: 1, maxLevel: 10, minFactor: 11, maxFactor: 20, levelImplicit: 2 },
    { valoare: "tabla11-20_factor11-20", text: "11..20 - 11..20", minLevel: 11, maxLevel: 20, minFactor: 11, maxFactor: 20, levelImplicit: 12 },
  ];
  const DOMENIU_FACTS_IMPLICIT = DOMENII_FACTS[0].valoare;
  const LC_DOMENIU_FACTS = "tablaInmultiriiTabel.domeniuFacts";

  let MIN_LEVEL = DOMENII_FACTS[0].minLevel;
  let MAX_LEVEL = DOMENII_FACTS[0].maxLevel;
  // Nivelul cu care porneste quizul la selectare (cerere user, 02.09.2026)
  // — separat de MIN_LEVEL, care ramane limita inferioara REALA (nivelul 1
  // tot e selectabil manual din butoanele de nivel). Fiecare domeniu isi are
  // propriul implicit (vezi DOMENII_FACTS) — se recalculeaza odata cu
  // MIN/MAX_LEVEL, nu ramane legat de domeniul de pornire.
  let LEVEL_IMPLICIT = DOMENII_FACTS[0].levelImplicit;
  let MIN_FACTOR = DOMENII_FACTS[0].minFactor;
  let MAX_FACTOR = DOMENII_FACTS[0].maxFactor;

  // Gaseste domeniul dupa valoare, cu fallback pe primul (domeniul implicit)
  // daca valoarea nu se potriveste cu nimic cunoscut — acelasi principiu de
  // validare ca la orice camp "enum" din motorul CP (nu asignare bruta).
  function domeniuFactsValid(valoare) {
    return DOMENII_FACTS.find((d) => d.valoare === valoare) ?? DOMENII_FACTS[0];
  }

  function getDomeniuFacts() {
    return domeniuFactsValid(global.LayoutConfig?.get(LC_DOMENIU_FACTS, DOMENIU_FACTS_IMPLICIT)).valoare;
  }

  // SINGURUL loc care scrie MIN_LEVEL/MAX_LEVEL/MIN_FACTOR/MAX_FACTOR/
  // LEVEL_IMPLICIT — rulat la fiecare creare de instanta de quiz (vezi
  // createTablaInmultiriiTabelQuiz) si din nou la fiecare schimbare de
  // domeniu din CP (scrieDomeniuFacts). NU atinge `level` insusi — cel deja
  // in desfasurare e clampat separat de apelant (campul CP "domeniuFacts" de
  // mai jos cheama switchLevel dupa asta, ca sa reincadreze nivelul curent
  // in noul interval).
  function aplicaDomeniuFacts(valoare) {
    const domeniu = domeniuFactsValid(valoare);
    MIN_LEVEL = domeniu.minLevel;
    MAX_LEVEL = domeniu.maxLevel;
    MIN_FACTOR = domeniu.minFactor;
    MAX_FACTOR = domeniu.maxFactor;
    LEVEL_IMPLICIT = domeniu.levelImplicit;
    return domeniu;
  }

  function scrieDomeniuFacts(valoare) {
    const domeniu = domeniuFactsValid(valoare);
    global.LayoutConfig?.set(LC_DOMENIU_FACTS, domeniu.valoare);
    aplicaDomeniuFacts(domeniu.valoare);
  }

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

  // Doua variante, dupa bifa "Comută pe tabla adunării" (getAdunareActiva) —
  // vezi hintMessageCurent() mai jos.
  const HINT_MESSAGE_INMULTIRE = "Alege produsul corect.";
  const HINT_MESSAGE_ADUNARE = "Alege suma corectă.";
  const PREFIX = "ti";
  const ID_HEADER_ROW = `${PREFIX}-header-row`;
  const ID_WRAPPER = `${PREFIX}-wrapper`;
  const ID_TABLE = `${PREFIX}-table`;
  // Rame (cerere user, 02.09.2026) — vezi sectiunea RAME mai jos.
  const ID_RAMA_INTREBARE = `${PREFIX}-rama-intrebare`;
  const ID_RAMA_NUMARARE = `${PREFIX}-rama-numarare`;
  const ID_RAMA_ADUNARI_REPETATE = `${PREFIX}-rama-adunari-repetate`;

  // Cheile in LayoutConfig (localStorage) pt. panoul CP al acestui quiz —
  // vezi `appendTablaInmultiriiTabelControlPanel` mai jos.

  // "Comută pe tabla adunării" (bifa CP, cerere user 02.09.2026) — tot
  // tabelul (aceleasi 10 randuri) trece de la "factor x nr-tabla = produs"
  // la "factor + nr-tabla = suma". Implementata AICI, nu ca quiz separat, ca
  // sa nu duplicam cod ("Facem bifa aici ca sa nu mai duplicam cod, vedem
  // dupa" — user); daca se decide ulterior o solutie completa/separata,
  // asta ramane varianta rapida.
  //
  // La bifare/debifare, nivelul curent se RESTARTEAZA automat (cerere user,
  // 02.09.2026: "cand se aplica bifa se si trece automat la acelasi nivel,
  // care va fi la cealalta operatie") — prin `opts.onChange` (vezi
  // appendTablaInmultiriiTabelControlPanel mai jos), pe care app.js il leaga
  // de `restartActiveRound()` (acelasi tipar ca la Tonomat/
  // PreEquationNavigation: `appendXControlPanel(mount, { onChange })`).
  // `restartActiveRound()` foloseste `engine.startRound(quiz.beginRound(...))`
  // — ACEEASI cale ca la clickul pe un buton de nivel, singurul loc care
  // CHIAR repicteaza tabelul (renderRound() din falling-engine.js). Motiv
  // tehnic pt. de ce nu se poate mai simplu: `setCurrentItem()` (folosit de
  // sincronizeazaOrchestratorul mai jos) doar actualizeaza o variabila
  // interna, NU redeseneaza nimic (verificat empiric) — un restart complet
  // de nivel e singura cale sigura sa apara instant noua operatie pe toate
  // cele 10 randuri deodata, fara sa lase randuri "pe jumatate" in operatia
  // veche. La fel ca la clickul pe un buton de nivel (chiar acelasi nivel),
  // progresul nivelului curent (facts inchise) se reseteaza — comportament
  // asteptat pt. un restart, nu un bug.
  //
  // Instantaneul adunareActivaNivel (in createTablaInmultiriiTabelQuiz, langa
  // operatorCurent) ramane totusi util dincolo de restart: garanteaza ca
  // TOATE cele 10 randuri ale unui nivel deja randat citesc aceeasi valoare,
  // in loc sa recitim getAdunareActiva() separat in fiecare functie.
  //
  // NU atinge coloanele "numarare*"/"adunari-repetate" — raman calculate ca
  // la inmultire-impartire (cerere expresa user: "lasa coloanele de
  // numarare cal a inmultire-impartire, dar le vom schimba ulterior") — vezi
  // valoareStaticaCelula. Ce se schimba cu adevarat: simbolul din coloana
  // "x" (-> "+"), valoarea din coloana "produs" (-> suma), FactStore
  // `operation` ("add" in loc de "mul" — confirmat explicit de user:
  // "Evident, 'Adunari'"), hint-ul, promptul text si intervalul
  // distractorilor — vezi rezultatPentru/adunareActivaNivel mai jos.
  const LC_ADUNARE_ACTIVA = "tablaInmultiriiTabel.adunareActiva";

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

  // "Mutare coloane" (cerere user, 02.09.2026) — la fiecare intrebare noua,
  // in ACELASI nivel, tabelul poate anima o reordonare de coloane. Exact UN
  // mod activ deodata, ales dintr-un dropdown in CP ("Mutare coloane:"):
  //
  //   - "faraMutari"   — nicio animatie, coloanele raman fixe (cerere user,
  //                       02.09.2026) — prima optiune din dropdown, dar NU
  //                       implicitul (ramane "rocada"); echivalent cu orice
  //                       alt mod dus manual la durata 0, dar explicit,
  //                       fara sa mai fie nevoie de niciun stepper.
  //   - "rocada"       — coloanele "factor" si "nr-tabla" isi schimba locul
  //                       (F1 comutat), demonstrand a*b=b*a.
  //   - "alternareF2"  — orientarea ecuatiei alterneaza intre "factor x
  //                       nr-tabla = produs" (F2 STANGA) si "produs = factor
  //                       x nr-tabla" (F2 DREAPTA) — vezi documente de
  //                       referinta/EFF-REFERENCE.md, sectiunea 4.
  //   - "toateEqForms" — "Toate eq forms cu ? la nr. mare" (cerere user,
  //                       02.09.2026): sare la ALT fact form (dintre toate
  //                       cele 8 — 4 F1 x 2 F2, vezi SCHIMBA FACT FORM mai
  //                       jos), niciodata acelasi doua intrebari la rand.
  //                       "?" ramane mereu pe rolul "produs" (celula cu
  //                       placeholder e gasita prin id, nu prin pozitie —
  //                       vezi continutCelula), care e mereu numarul cel mai
  //                       mare din triada (factor,nr-tabla >= 1, deci
  //                       produs = factor*nr-tabla >= ambele) — chiar si
  //                       cand fact form-ul e unul de "impartire" (simbol
  //                       ":", f1_complementar*, unde produs e in mod normal
  //                       un operand DAT, nu rezultatul), intrebarea ramane
  //                       aceeasi ("cat fac factor x nr-tabla?"), doar
  //                       imbracata intr-o alta forma vizuala (ex. "?:3=4").
  //   - "toateEqFormsFaraNrTabla" — "Toate eq forms fara numarul subtablei
  //                       ca ?" (cerere user, 02.09.2026): ca "toateEqForms",
  //                       dar "?" NU mai e fix pe "produs" — se muta pe rolul
  //                       "rezultat" al fact form-ului ales (vezi
  //                       rolIntrebareCurent, valoareCorectaPentru mai jos),
  //                       deci poate ajunge pe "factor" (la f1_complementar)
  //                       sau ramane pe "produs" (f1_initial/f1_comutat) —
  //                       NICIODATA pe "nr-tabla" (f1_complementar_comutat,
  //                       exclus din pool, vezi TOATE_FACT_FORMS_FARA_NR_TABLA):
  //                       "nr-tabla" e CONSTANT pe tot nivelul (mereu = level),
  //                       deci o intrebare cu "?" acolo ar avea mereu acelasi
  //                       raspuns, indiferent de rand — nu testeaza nimic.
  //   - "toateEqFormsOriceRol" — "Toate eq forms, orice rol ca ?" (cerere
  //                       user, 02.09.2026): la fel ca varianta de mai sus,
  //                       dar FARA excluderea lui "nr-tabla" — toate cele 8
  //                       forme raman posibile, deci "?" poate ajunge si pe
  //                       "nr-tabla" (intrebare cu raspuns constant pe tot
  //                       nivelul — acceptata explicit de user pt. acest mod).
  //
  // Fiecare mod are propria durata (secunde, stocata in ms — unitatea
  // naturala pt. o animatie). 0 = modul ala, DACA E SELECTAT, e dezactivat
  // complet (cerere expresa user, nu doar "swap instant") — coloanele raman
  // fixe.
  const LC_MUTARE_COLOANE_MOD = "tablaInmultiriiTabel.mutareColoaneMod";
  const MUTARE_COLOANE_MOD_IMPLICIT = "rocada";
  const MUTARE_COLOANE_MODURI_VALIDE = new Set([
    "faraMutari",
    "rocada",
    "alternareF2",
    "toateEqForms",
    "toateEqFormsFaraNrTabla",
    "toateEqFormsOriceRol",
  ]);

  // Valoarea implicita pt. orice mod "Mutare coloane" care nu e rocada (ea
  // isi are propriul implicit, mai vechi, 1.5) SI nu a fost inca atins
  // manual de user (LayoutConfig.get cade pe implicit doar cand nu exista
  // NIMIC salvat pt. cheia aia — vezi getAlternareF2DurataMs() etc. mai jos).
  // Cerere user, 02.09.2026: implicitul de 0 (= dezactivat) la prima
  // selectare a unui mod nou parea "stricat" (nu se misca nimic) — inlocuit
  // cu o durata standard, rezonabila. Modurile deja atinse manual de user
  // (are ceva salvat, chiar si 0 explicit) NU sunt afectate.
  const DURATA_MUTARE_STANDARD_S = 0.8;

  const LC_ROCADA_DURATA_MS = "tablaInmultiriiTabel.rocadaDurataMs";
  const ROCADA_DURATA_S_IMPLICITA = 1.5;
  const ROCADA_DURATA_S_MIN = 0;
  const ROCADA_DURATA_S_MAX = 5;
  const ROCADA_DURATA_S_PAS = 0.1;

  const LC_ALTERNARE_F2_DURATA_MS = "tablaInmultiriiTabel.alternareF2DurataMs";
  const ALTERNARE_F2_DURATA_S_IMPLICITA = DURATA_MUTARE_STANDARD_S;
  const ALTERNARE_F2_DURATA_S_MIN = 0;
  const ALTERNARE_F2_DURATA_S_MAX = 5;
  const ALTERNARE_F2_DURATA_S_PAS = 0.1;

  const LC_TOATE_EQ_FORMS_DURATA_MS = "tablaInmultiriiTabel.toateEqFormsDurataMs";
  const TOATE_EQ_FORMS_DURATA_S_IMPLICITA = DURATA_MUTARE_STANDARD_S;
  const TOATE_EQ_FORMS_DURATA_S_MIN = 0;
  const TOATE_EQ_FORMS_DURATA_S_MAX = 5;
  const TOATE_EQ_FORMS_DURATA_S_PAS = 0.1;

  const LC_TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_MS =
    "tablaInmultiriiTabel.toateEqFormsFaraNrTablaDurataMs";
  const TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_IMPLICITA = DURATA_MUTARE_STANDARD_S;
  const TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_MIN = 0;
  const TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_MAX = 5;
  const TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_PAS = 0.1;

  const LC_TOATE_EQ_FORMS_ORICE_ROL_DURATA_MS =
    "tablaInmultiriiTabel.toateEqFormsOriceRolDurataMs";
  const TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_IMPLICITA = DURATA_MUTARE_STANDARD_S;
  const TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_MIN = 0;
  const TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_MAX = 5;
  const TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_PAS = 0.1;

  function getAdunareActiva() {
    return global.LayoutConfig?.get(LC_ADUNARE_ACTIVA, false) ?? false;
  }

  function scrieAdunareActiva(activa) {
    global.LayoutConfig?.set(LC_ADUNARE_ACTIVA, Boolean(activa));
  }

  // Mesajul de hint depinde de operatia curenta — parametru explicit (nu
  // getAdunareActiva() direct), ca sa poata primi instantaneul de nivel
  // (adunareActivaNivel), nu starea live din LayoutConfig — vezi comentariul
  // de la LC_ADUNARE_ACTIVA mai sus.
  function hintMessageCurent(adunareActiva) {
    return adunareActiva ? HINT_MESSAGE_ADUNARE : HINT_MESSAGE_INMULTIRE;
  }

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

  function getAlternareF2DurataMs() {
    const implicitMs = ALTERNARE_F2_DURATA_S_IMPLICITA * 1000;
    return global.LayoutConfig?.get(LC_ALTERNARE_F2_DURATA_MS, implicitMs) ?? implicitMs;
  }

  function getAlternareF2DurataS() {
    return getAlternareF2DurataMs() / 1000;
  }

  function getToateEqFormsDurataMs() {
    const implicitMs = TOATE_EQ_FORMS_DURATA_S_IMPLICITA * 1000;
    return global.LayoutConfig?.get(LC_TOATE_EQ_FORMS_DURATA_MS, implicitMs) ?? implicitMs;
  }

  function getToateEqFormsDurataS() {
    return getToateEqFormsDurataMs() / 1000;
  }

  function getToateEqFormsFaraNrTablaDurataMs() {
    const implicitMs = TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_IMPLICITA * 1000;
    return global.LayoutConfig?.get(LC_TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_MS, implicitMs) ?? implicitMs;
  }

  function getToateEqFormsFaraNrTablaDurataS() {
    return getToateEqFormsFaraNrTablaDurataMs() / 1000;
  }

  function getToateEqFormsOriceRolDurataMs() {
    const implicitMs = TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_IMPLICITA * 1000;
    return global.LayoutConfig?.get(LC_TOATE_EQ_FORMS_ORICE_ROL_DURATA_MS, implicitMs) ?? implicitMs;
  }

  function getToateEqFormsOriceRolDurataS() {
    return getToateEqFormsOriceRolDurataMs() / 1000;
  }

  function getMutareColoaneMod() {
    const stocat = global.LayoutConfig?.get(LC_MUTARE_COLOANE_MOD, MUTARE_COLOANE_MOD_IMPLICIT);
    return MUTARE_COLOANE_MODURI_VALIDE.has(stocat) ? stocat : MUTARE_COLOANE_MOD_IMPLICIT;
  }

  function scrieMutareColoaneMod(mod) {
    const valid = MUTARE_COLOANE_MODURI_VALIDE.has(mod) ? mod : MUTARE_COLOANE_MOD_IMPLICIT;
    global.LayoutConfig?.set(LC_MUTARE_COLOANE_MOD, valid);
    return valid;
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

  // Acelasi motiv de rotunjire ca la scrieRocadaDurataS.
  function scrieAlternareF2DurataS(valoare) {
    const clampat = Math.min(ALTERNARE_F2_DURATA_S_MAX, Math.max(ALTERNARE_F2_DURATA_S_MIN, valoare));
    const rotunjit = Math.round(clampat * 10) / 10;
    global.LayoutConfig?.set(LC_ALTERNARE_F2_DURATA_MS, Math.round(rotunjit * 1000));
    return rotunjit;
  }

  // Acelasi motiv de rotunjire ca la scrieRocadaDurataS.
  function scrieToateEqFormsDurataS(valoare) {
    const clampat = Math.min(TOATE_EQ_FORMS_DURATA_S_MAX, Math.max(TOATE_EQ_FORMS_DURATA_S_MIN, valoare));
    const rotunjit = Math.round(clampat * 10) / 10;
    global.LayoutConfig?.set(LC_TOATE_EQ_FORMS_DURATA_MS, Math.round(rotunjit * 1000));
    return rotunjit;
  }

  // Acelasi motiv de rotunjire ca la scrieRocadaDurataS.
  function scrieToateEqFormsFaraNrTablaDurataS(valoare) {
    const clampat = Math.min(
      TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_MAX,
      Math.max(TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_MIN, valoare)
    );
    const rotunjit = Math.round(clampat * 10) / 10;
    global.LayoutConfig?.set(LC_TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_MS, Math.round(rotunjit * 1000));
    return rotunjit;
  }

  // Acelasi motiv de rotunjire ca la scrieRocadaDurataS.
  function scrieToateEqFormsOriceRolDurataS(valoare) {
    const clampat = Math.min(
      TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_MAX,
      Math.max(TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_MIN, valoare)
    );
    const rotunjit = Math.round(clampat * 10) / 10;
    global.LayoutConfig?.set(LC_TOATE_EQ_FORMS_ORICE_ROL_DURATA_MS, Math.round(rotunjit * 1000));
    return rotunjit;
  }

  // Tabelul declarativ de optiuni CP (documente de referinta/
  // standard-optiuni-cp.md) — sursa unica pt. panoul CP (DOM, prin
  // MotorOptiuniControlPanel.construiesteDOM) SI pt. linkul de partajare
  // (getSharedConfig/getSharedLink/applySharedConfig, prin citesteConfig/
  // aplicaConfig). Inainte, cele doua erau scrise separat, manual, camp cu
  // camp — cerere user, 03.09.2026: "standardizam optiunile din CP ca sa
  // poata fi citite automat".
  //
  // `rerandeaza`: doar campul "mutareColoane" il foloseste (stepperele de
  // durata de mai jos apar/dispar dupa modul ales, prin activCand) — trimis
  // de apelant (appendTablaInmultiriiTabelControlPanel), null cand campurile
  // se construiesc STRICT pt. citire/scriere de config (getSharedConfig/
  // applySharedConfig), unde nu exista niciun DOM de rerandat.
  function campurileCP(quizPublicApi, opts = {}, rerandeaza = null) {
    return [
      {
        cheie: "domeniuFacts",
        tip: "enum",
        eticheta: "Domeniu facts:",
        optiuni: DOMENII_FACTS.map(({ valoare, text }) => ({ valoare, text })),
        get: getDomeniuFacts,
        set: (valoare) => {
          scrieDomeniuFacts(valoare);
          // Reincadreaza nivelul curent in noul interval (acelasi clamp ca
          // la clickul pe un buton de nivel) — vezi comentariul din
          // aplicaDomeniuFacts. NU face restart de runda aici (ar rula de N
          // ori intr-un applySharedConfig cu mai multe campuri, vezi capcana
          // documentata la equations-e3-e6.js in standard-optiuni-cp.md) —
          // restart-ul ramane STRICT in dupaSchimbare, ca la adunareActiva.
          quizPublicApi.switchLevel(quizPublicApi.getLevel());
        },
        implicit: DOMENIU_FACTS_IMPLICIT,
        dupaSchimbare: () => opts.onChange?.(),
      },
      global.MotorOptiuniControlPanel.campNivelStandard(quizPublicApi, LEVEL_IMPLICIT),
      {
        cheie: "adunareActiva",
        tip: "bifa",
        eticheta: "Comută pe tabla adunării",
        get: getAdunareActiva,
        set: scrieAdunareActiva,
        // Restarteaza automat nivelul curent (vezi comentariul de la
        // LC_ADUNARE_ACTIVA mai sus) — singura cale sa apara instant noua
        // operatie pe toate cele 10 randuri.
        dupaSchimbare: () => opts.onChange?.(),
      },
      {
        cheie: "ascundeTitluriColoane",
        tip: "bifa",
        eticheta: "Ascunde titluri coloane",
        get: getAscundeTitluriColoane,
        set: scrieAscundeTitluriColoane,
      },
      {
        cheie: "arataGrila",
        tip: "bifa",
        eticheta: "Arata grila tabel",
        get: getArataGrila,
        set: scrieArataGrila,
      },
      {
        cheie: "paddingLateralPx",
        tip: "numar",
        eticheta: "Padding cell lateral",
        get: getPaddingLateralPx,
        set: scriePaddingLateralPx,
        min: PADDING_MIN,
        max: PADDING_MAX,
        pas: PADDING_PAS,
      },
      {
        cheie: "paddingVerticalPx",
        tip: "numar",
        eticheta: "Padding cell vertical",
        get: getPaddingVerticalPx,
        set: scriePaddingVerticalPx,
        min: PADDING_MIN,
        max: PADDING_MAX,
        pas: PADDING_PAS,
      },
      {
        cheie: "marimeFontPx",
        tip: "numar",
        eticheta: "Marime font (px)",
        get: getMarimeFontPx,
        set: scrieMarimeFontPx,
        min: MARIME_FONT_PX_MIN,
        max: MARIME_FONT_PX_MAX,
        pas: MARIME_FONT_PX_PAS,
      },
      {
        cheie: "marimeFontNumararePct",
        tip: "numar",
        eticheta: "Scris mic %",
        get: getMarimeFontNumararePct,
        set: scrieMarimeFontNumararePct,
        min: MARIME_FONT_NUMARARE_MIN,
        max: MARIME_FONT_NUMARARE_MAX,
        pas: MARIME_FONT_NUMARARE_PAS,
      },
      {
        cheie: "mutareColoane",
        tip: "enum",
        eticheta: "Mutare coloane:",
        optiuni: [
          { valoare: "faraMutari", text: "Fara mutari de coloane" },
          { valoare: "rocada", text: "Rocada comutativitate (s)" },
          { valoare: "alternareF2", text: "Alternare a=b×c cu b×c=a (s)" },
          { valoare: "toateEqForms", text: "Toate eq forms cu ? la nr. mare (s)" },
          { valoare: "toateEqFormsFaraNrTabla", text: "Toate eq forms fără numărul subtablei ca ? (s)" },
          { valoare: "toateEqFormsOriceRol", text: "Toate eq forms, orice rol ca ? (s)" },
        ],
        get: getMutareColoaneMod,
        set: scrieMutareColoaneMod,
        implicit: MUTARE_COLOANE_MOD_IMPLICIT,
        dupaSchimbare: () => rerandeaza?.(),
      },
      {
        cheie: "rocadaDurataS",
        tip: "numar",
        eticheta: "Durata mutare coloane (s) (0 pt dezactivare)",
        get: getRocadaDurataS,
        set: scrieRocadaDurataS,
        min: ROCADA_DURATA_S_MIN,
        max: ROCADA_DURATA_S_MAX,
        pas: ROCADA_DURATA_S_PAS,
        zecimale: 1,
        activCand: (v) => v.mutareColoane === "rocada",
      },
      {
        cheie: "alternareF2DurataS",
        tip: "numar",
        eticheta: "Durata mutare coloane (s) (0 pt dezactivare)",
        get: getAlternareF2DurataS,
        set: scrieAlternareF2DurataS,
        min: ALTERNARE_F2_DURATA_S_MIN,
        max: ALTERNARE_F2_DURATA_S_MAX,
        pas: ALTERNARE_F2_DURATA_S_PAS,
        zecimale: 1,
        activCand: (v) => v.mutareColoane === "alternareF2",
      },
      {
        cheie: "toateEqFormsDurataS",
        tip: "numar",
        eticheta: "Durata mutare coloane (s) (0 pt dezactivare)",
        get: getToateEqFormsDurataS,
        set: scrieToateEqFormsDurataS,
        min: TOATE_EQ_FORMS_DURATA_S_MIN,
        max: TOATE_EQ_FORMS_DURATA_S_MAX,
        pas: TOATE_EQ_FORMS_DURATA_S_PAS,
        zecimale: 1,
        activCand: (v) => v.mutareColoane === "toateEqForms",
      },
      {
        cheie: "toateEqFormsFaraNrTablaDurataS",
        tip: "numar",
        eticheta: "Durata mutare coloane (s) (0 pt dezactivare)",
        get: getToateEqFormsFaraNrTablaDurataS,
        set: scrieToateEqFormsFaraNrTablaDurataS,
        min: TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_MIN,
        max: TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_MAX,
        pas: TOATE_EQ_FORMS_FARA_NR_TABLA_DURATA_S_PAS,
        zecimale: 1,
        activCand: (v) => v.mutareColoane === "toateEqFormsFaraNrTabla",
      },
      {
        cheie: "toateEqFormsOriceRolDurataS",
        tip: "numar",
        eticheta: "Durata mutare coloane (s) (0 pt dezactivare)",
        get: getToateEqFormsOriceRolDurataS,
        set: scrieToateEqFormsOriceRolDurataS,
        min: TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_MIN,
        max: TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_MAX,
        pas: TOATE_EQ_FORMS_ORICE_ROL_DURATA_S_PAS,
        zecimale: 1,
        activCand: (v) => v.mutareColoane === "toateEqFormsOriceRol",
      },
    ];
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

  // Eticheta headerului coloanei — de obicei ETICHETE_HEADER de mai sus, dar
  // "x" si "produs" se citesc altfel cand tabla curenta e de adunare (bifa
  // "Comută pe tabla adunării"): headerul e ascuns implicit (vezi
  // getAscundeTitluriColoane), dar daca userul il arata, trebuie sa
  // corespunda cu ce arata efectiv celulele (vezi valoareStaticaCelula), nu
  // sa ramana "x"/"produs" peste un rand care arata de fapt "+"/suma.
  // Parametru explicit (nu getAdunareActiva() direct) — vezi
  // hintMessageCurent mai sus, acelasi motiv.
  function etichetaHeader(coloana, adunareActiva) {
    if (adunareActiva) {
      if (coloana === "x") return "+";
      if (coloana === "produs") return "sumă";
    }
    return ETICHETE_HEADER[coloana] ?? "";
  }

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
  //
  // FARA padding pe span (cerere user, 02.09.2026 — "tabelul se lateste, apoi
  // se restrange cand dispare fundalul"): cauza reala era `padding:0 0.2em`
  // pus DOAR pe celula activa — o celula mai "umflata" decat surorile ei din
  // aceeasi coloana devine cea mai lata, deci coloana se largeste cat ea; la
  // intrebarea urmatoare, cand celula se rescrie fara portocaliu, padding-ul
  // dispare si coloana se ingusteaza la loc. `revealAnswerInPlace` schimba
  // doar `textContent`/`classList` (falling-engine.js) — NU atinge style-ul
  // inline, deci padding-ul ramanea acolo si dupa revelare, pana la
  // intrebarea urmatoare. Fix: fundalul umple celula prin
  // `display:flex;height:100%`, fara padding propriu (acelasi tipar ca la
  // vechiul chenar, stilCadru, acum scos) — latimea celulei nu mai depinde
  // deloc de starea placeholderului.
  // Culoarea de evidentiere a placeholderului — extrasa intr-o constanta
  // (02.09.2026) ca sa poata fi reutilizata EXACT (nu doar "similara") de
  // rama intrebarii mai jos: "aceeasi culoare cu care e evidentiat '?'"
  // (cerere user) — vezi STIL_RAMA_INTREBARE.
  const CULOARE_EVIDENTIERE_PLACEHOLDER = "orange";
  const placeholderGeneric = global.PlaceholderRaspuns.creeaza("?");
  const placeholder = {
    ...placeholderGeneric,
    marcaj: (spatiuRezervat) =>
      `<span class="${placeholderGeneric.clasa}" style="display:flex;align-items:center;justify-content:center;height:100%;box-sizing:border-box;background:${CULOARE_EVIDENTIERE_PLACEHOLDER};color:#000;font-weight:700;border-radius:0.2em;">` +
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

  // Reordoneaza TOATE coloanele unui <table> intr-o configuratie data, cu
  // animatie simultana — "alternare F2" (cerere user, 02.09.2026). Spre
  // deosebire de rocadaColoane() (exact 2 coloane), asta primeste ordinea
  // FINALA completa — necesar cand grupul "produs"+"egal" se muta la
  // cealalta extremitate a celor 5 coloane cadru (nu doar interschimba 2).
  // Functie primita de la user aproape verbatim (generata initial cu
  // ChatGPT) — aceleasi conditii ca la rocadaColoane(): <colgroup> cu cate
  // un <col id="..."> per coloana, fiecare rand cu exact o celula per
  // coloana, fara rowspan/colspan.
  async function gliseazaColoaneMultipleInConfiguratie(
    tabelId,
    ordineFinalaColoaneIds,
    durataAnimatieInMs
  ) {
    const tabel = document.getElementById(tabelId);

    if (!(tabel instanceof HTMLTableElement)) {
      throw new TypeError(`Nu există un <table> cu id-ul „${tabelId}”.`);
    }

    if (!Array.isArray(ordineFinalaColoaneIds)) {
      throw new TypeError('ordineFinalaColoaneIds trebuie să fie un Array.');
    }

    if (!Number.isFinite(durataAnimatieInMs) || durataAnimatieInMs < 0) {
      throw new TypeError(
        'durataAnimatieInMs trebuie să fie un număr finit mai mare sau egal cu 0.'
      );
    }

    const colgroupuri = [...tabel.children]
      .filter(element => element.tagName === 'COLGROUP');

    if (colgroupuri.length !== 1) {
      throw new Error('Tabelul trebuie să aibă exact un <colgroup> direct.');
    }

    const colgroup = colgroupuri[0];
    const coloaneInitiale = [...colgroup.children]
      .filter(element => element instanceof HTMLTableColElement);

    if (coloaneInitiale.length !== colgroup.children.length) {
      throw new Error('<colgroup> trebuie să conțină direct numai elemente <col>.');
    }

    if (coloaneInitiale.length === 0) {
      throw new Error('Tabelul trebuie să conțină cel puțin o coloană.');
    }

    if (coloaneInitiale.some(coloana => coloana.span !== 1)) {
      throw new Error('Nu sunt acceptate elemente <col> cu span diferit de 1.');
    }

    const iduriInitiale = coloaneInitiale.map(coloana => coloana.id);

    if (iduriInitiale.some(id => id === '')) {
      throw new Error('Fiecare element <col> trebuie să aibă un id.');
    }

    if (new Set(iduriInitiale).size !== iduriInitiale.length) {
      throw new Error('ID-urile elementelor <col> trebuie să fie unice.');
    }

    if (ordineFinalaColoaneIds.length !== coloaneInitiale.length) {
      throw new Error(
        'Ordinea finală trebuie să conțină toate coloanele tabelului, exact o dată.'
      );
    }

    if (ordineFinalaColoaneIds.some(id => typeof id !== 'string' || id === '')) {
      throw new TypeError(
        'Fiecare ID din ordinea finală trebuie să fie un șir nevid.'
      );
    }

    const iduriFinaleUnice = new Set(ordineFinalaColoaneIds);

    if (iduriFinaleUnice.size !== ordineFinalaColoaneIds.length) {
      throw new Error('Ordinea finală conține ID-uri duplicate.');
    }

    const iduriInitialeSet = new Set(iduriInitiale);
    const idNecunoscut = ordineFinalaColoaneIds.find(
      id => !iduriInitialeSet.has(id)
    );

    if (idNecunoscut !== undefined) {
      throw new Error(
        `„${idNecunoscut}” nu este ID-ul unei coloane din tabelul „${tabelId}”.`
      );
    }

    const randuri = [...tabel.rows];

    for (const rand of randuri) {
      const celule = [...rand.cells];
      const areCeluleCombinate = celule.some(
        celula => celula.colSpan !== 1 || celula.rowSpan !== 1
      );

      if (celule.length !== coloaneInitiale.length || areCeluleCombinate) {
        throw new Error(
          'Fiecare rând trebuie să aibă exact o celulă pentru fiecare coloană, fără rowspan/colspan.'
        );
      }
    }

    const ordineaEsteDejaCorecta = iduriInitiale.every(
      (id, index) => id === ordineFinalaColoaneIds[index]
    );

    if (ordineaEsteDejaCorecta) {
      return false;
    }

    const tabeleInAnimatie =
      gliseazaColoaneMultipleInConfiguratie.tabeleInAnimatie ||
      (gliseazaColoaneMultipleInConfiguratie.tabeleInAnimatie = new WeakSet());

    if (tabeleInAnimatie.has(tabel)) {
      throw new Error(`Tabelul „${tabelId}” are deja o glisare în desfășurare.`);
    }

    if (durataAnimatieInMs > 0) {
      if (!tabel.isConnected) {
        throw new Error(
          'Tabelul trebuie să fie conectat la document pentru a fi animat.'
        );
      }

      const dreptunghiTabel = tabel.getBoundingClientRect();
      if (dreptunghiTabel.width === 0 || dreptunghiTabel.height === 0) {
        throw new Error(
          'Tabelul trebuie să fie vizibil și să aibă dimensiuni nenule.'
        );
      }
    }

    const indexInitialDupaId = new Map(
      iduriInitiale.map((id, index) => [id, index])
    );
    const coloanaDupaId = new Map(
      coloaneInitiale.map(coloana => [coloana.id, coloana])
    );
    const coloaneFinale = ordineFinalaColoaneIds.map(
      id => coloanaDupaId.get(id)
    );
    const celuleInitialePeRand = randuri.map(rand => [...rand.cells]);
    const toateCelulele = celuleInitialePeRand.flat();
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
        willChange: celula.style.willChange,
        pointerEvents: celula.style.pointerEvents
      }])
    );

    tabeleInAnimatie.add(tabel);

    try {
      for (const coloana of coloaneFinale) {
        colgroup.append(coloana);
      }

      randuri.forEach((rand, indexRand) => {
        const celuleInitiale = celuleInitialePeRand[indexRand];

        for (const coloanaId of ordineFinalaColoaneIds) {
          rand.append(celuleInitiale[indexInitialDupaId.get(coloanaId)]);
        }
      });

      if (durataAnimatieInMs === 0) {
        return true;
      }

      for (const celula of toateCelulele) {
        const pozitieInitiala = pozitiiInitiale.get(celula);
        const pozitieFinala = celula.getBoundingClientRect();
        const deplasareX = pozitieInitiala.left - pozitieFinala.left;

        celula.style.transition = 'none';
        celula.style.transform = `translateX(${deplasareX}px)`;
        celula.style.willChange = 'transform';

        if (Math.abs(deplasareX) > 0.01) {
          const indexInitial = celuleInitialePeRand
            .find(celuleRand => celuleRand.includes(celula))
            .indexOf(celula);

          celula.style.position = 'relative';
          celula.style.zIndex = String(20 + indexInitial);
          celula.style.backgroundColor = 'transparent';
          celula.style.pointerEvents = 'none';
        }
      }

      await new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      for (const celula of toateCelulele) {
        celula.style.transition =
          `transform ${durataAnimatieInMs}ms ease-in-out`;
        celula.style.transform = 'translateX(0)';
      }

      await new Promise(resolve => setTimeout(resolve, durataAnimatieInMs));
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
        celula.style.pointerEvents = stil.pointerEvents;
      }

      tabeleInAnimatie.delete(tabel);
    }
  }

  // ============================ SCHIMBA FACT FORM ===========================
  //
  // "Fact form" (ff) = ordinea de citire a celor 3 numere dintr-un fapt de
  // inmultire — terminologie EFF, documente de referinta/EFF-REFERENCE.md,
  // sectiunile 3-4. F1 = familia faptului — 4 chei EXACT ca in referinta
  // (vezi si documente de referinta/eff-config.js): f1_initial, f1_comutat
  // (interschimba a si b), f1_complementar si f1_complementar_comutat
  // (operatia INVERSA — pt. inmultire, impartirea). F2 = orientarea
  // ecuatiei: "stanga" (doua_nr_in_STANGA in referinta) = "a op b = result",
  // "dreapta" (doua_nr_in_DREAPTA) = "result = a op b". 4 F1 x 2 F2 = toate
  // cele 8 fact forms — TOATE valide EFF in mod egal (cerere user,
  // 02.09.2026: "eff inseamna 8 forme valide, nu 4" — corectie fata de o
  // formulare gresita anterioara aici, care le trata pe 4 ca "mai putin
  // valide").
  //
  // Simbolul operatiei depinde STRICT de F1: f1_initial/f1_comutat -> "x"
  // (produs = factor x nr-tabla, in oricare ordine — inmultirea comuta);
  // f1_complementar/f1_complementar_comutat -> ":" (notatie scolara
  // romaneasca de impartire, ex. "12:3=4"), cu produsul mereu primul operand
  // (dividend) — impartirea NU comuta, deci nu exista "alta ordine" de
  // incercat acolo, spre deosebire de inmultire.
  const SIMBOL_INMULTIRE = "x";
  const SIMBOL_IMPARTIRE = ":";
  // Simbolurile cand tabla curenta e de adunare (getAdunareActiva) — vezi
  // simbolEfectiv() mai jos.
  const SIMBOL_ADUNARE = "+";
  const SIMBOL_SCADERE = "-";

  // Simbolul REAL de afisat, tinand cont de "Comută pe tabla adunării" —
  // BUG gasit de user (02.09.2026, ex. "8=10+2" in loc de "8=10-2"): prima
  // versiune folosea mereu "+" cat timp adunarea era activa, indiferent de
  // F1 — corect DOAR pt. formele directe (f1_initial/f1_comutat, simbol de
  // inmultire "x"), dar face ecuatia FALSA pt. formele complementare
  // (f1_complementar*, simbol de impartire ":"): acolo produsul (suma) e un
  // operand DAT, nu rezultatul, deci operatia care leaga cele 3 numere e
  // scaderea, nu adunarea (10-2=8, nu 10+2=8). Adunarea/scaderea sunt
  // operatii inverse una alteia, exact cum inmultirea/impartirea sunt
  // inverse una alteia — simbolul de adunare "mosteneste" aceeasi distinctie
  // F1 ca simbolul de inmultire: "x" (forme directe) -> "+", ":" (forme
  // complementare) -> "-". Cand adunarea NU e activa, intoarce simbolul
  // primit neschimbat (comportamentul de dinainte, neatins).
  function simbolEfectiv(simbolInmultireSauImpartire, adunareActiva) {
    if (!adunareActiva) return simbolInmultireSauImpartire;
    return simbolInmultireSauImpartire === SIMBOL_IMPARTIRE ? SIMBOL_SCADERE : SIMBOL_ADUNARE;
  }

  // Pt. fiecare F1: cei doi operanzi (in ordinea de citire a PERECHII,
  // inainte de F2) si rolul care ramane singur (rezultatul perechii).
  // Derivat direct din tabelul F1 al EFF-REFERENCE.md (a=factor,
  // b=nr-tabla, result=produs, op=x, op_invers=":") — conventie aleasa
  // aici ca "factor x nr-tabla = produs" (f1_initial + stanga) sa coincida
  // cu forma implicita a acestui tabel.
  const F1_TRANSFORMARI = {
    f1_initial:              { operand1: "factor", operand2: "nr-tabla", rezultat: "produs", simbol: SIMBOL_INMULTIRE },
    f1_comutat:              { operand1: "nr-tabla", operand2: "factor", rezultat: "produs", simbol: SIMBOL_INMULTIRE },
    f1_complementar:         { operand1: "produs", operand2: "nr-tabla", rezultat: "factor", simbol: SIMBOL_IMPARTIRE },
    f1_complementar_comutat: { operand1: "produs", operand2: "factor", rezultat: "nr-tabla", simbol: SIMBOL_IMPARTIRE },
  };

  const ROLURI_TRIADA = ["factor", "nr-tabla", "produs"];

  // Toate cele 8 combinatii F1 x F2 posibile — folosite de toate modurile
  // "Toate eq forms*" (vezi aleeFactFormDiferita/ruleazaMutareaColoanelorDacaActiva,
  // in createTablaInmultiriiTabelQuiz).
  const TOATE_FACT_FORMS = Object.keys(F1_TRANSFORMARI).flatMap((f1) =>
    ["stanga", "dreapta"].map((f2) => ({ f1, f2 }))
  );

  // Subset fara formele care ar pune "?" pe "nr-tabla" (cerere user,
  // 02.09.2026 — "toate eq forms except numarul subtablei"). "nr-tabla" e
  // CONSTANT pe tot nivelul (ex. mereu 7 la tabla lui 7) — o intrebare cu "?"
  // acolo ar avea mereu acelasi raspuns corect, indiferent de rand, deci nu
  // testeaza nimic. F1_TRANSFORMARI[f1].rezultat = rolul care devine "?"
  // pt. acel f1 (vezi rolIntrebareCurent mai jos).
  const TOATE_FACT_FORMS_FARA_NR_TABLA = TOATE_FACT_FORMS.filter(
    (ff) => F1_TRANSFORMARI[ff.f1].rezultat !== "nr-tabla"
  );

  // Citeste ordinea CURENTA a celor 3 roluri numerice direct din DOM
  // (colgroup) — nu presupune nicio stare retinuta separat pt. POZITIA lor
  // (doar simbolul "x"/":" are nevoie de stare urmarita, vezi
  // operatorCurent mai jos — pozitia se poate citi mereu direct din ce e
  // deja pe ecran, indiferent ce a facut deja rocada comutativitate intre
  // timp).
  function citesteOrdineaTriadei(tabelId) {
    const tabel = document.getElementById(tabelId);
    if (!(tabel instanceof HTMLTableElement)) {
      throw new TypeError(`Nu există un <table> cu id-ul „${tabelId}”.`);
    }
    const colgroup = tabel.querySelector("colgroup");
    const rolDupaId = new Map(ROLURI_TRIADA.map((rol) => [idColoana(rol), rol]));
    return [...colgroup.children]
      .map((c) => rolDupaId.get(c.id))
      .filter((rol) => rol !== undefined);
  }

  // Partea PURA (fara DOM) a schimbarii de fact form — separata explicit,
  // usor de verificat independent (toate cele 8 combinatii) fara sa aiba
  // nevoie de tabel/DOM. Intoarce ordinea celor 5 coloane cadru, ca NUME de
  // rol (nu id-uri DOM), plus simbolul de scris in coloana "x".
  function calculeazaCadruPentruFactForm(f1, f2) {
    const transformare = F1_TRANSFORMARI[f1];
    if (!transformare) {
      throw new TypeError(`f1 trebuie sa fie una din: ${Object.keys(F1_TRANSFORMARI).join(", ")}.`);
    }
    if (f2 !== "stanga" && f2 !== "dreapta") {
      throw new TypeError('f2 trebuie sa fie "stanga" sau "dreapta".');
    }
    const { operand1, operand2, rezultat, simbol } = transformare;
    const cadru = f2 === "stanga"
      ? [operand1, "x", operand2, "egal", rezultat]
      : [rezultat, "egal", operand1, "x", operand2];
    return { cadru, simbol };
  }

  // Muta tabelul in fact form-ul TINTA (F1 + F2), cu glisare simultana —
  // gliseazaColoaneMultipleInConfiguratie() (nu rocadaColoane, care
  // interschimba mereu exact 2 coloane fixe si nu poate muta produs+egal la
  // cealalta extremitate). Simbolul ("x" sau ":") traieste in CONTINUTUL
  // celulelor coloanei "x" (10 randuri), nu in pozitia ei — glisarea muta
  // NODURI, nu schimba text — deci il scriem separat, direct, INAINTE de
  // glisare.
  //
  // Functie module-level (fara acces la starea vreunui quiz anume) — quizul
  // care o foloseste trebuie sa-si tina singur, separat, care simbol e activ
  // acum (vezi operatorCurent + aplicaFactForm mai jos, in
  // createTablaInmultiriiTabelQuiz), ca urmatoarea intrebare din acelasi
  // nivel sa continue sa arate simbolul corect — elementePatchTranzitie
  // rescrie inclusiv celula "x" la fiecare intrebare noua. Acelasi motiv
  // pt. parametrul `adunareActiva`: vine din instantaneul de nivel al
  // apelantului (adunareActivaNivel), nu dintr-o citire proprie.
  async function schimbaFactForm(tabelId, f1, f2, durataMs, adunareActiva) {
    const { cadru, simbol } = calculeazaCadruPentruFactForm(f1, f2);

    const tabel = document.getElementById(tabelId);
    if (!(tabel instanceof HTMLTableElement)) {
      throw new TypeError(`Nu există un <table> cu id-ul „${tabelId}”.`);
    }

    // "Comută pe tabla adunării" (alta functie, vezi LC_ADUNARE_ACTIVA) poate
    // fi activa in acelasi timp cu o mutare de coloane — adunarea comuta la
    // fel ca inmultirea, deci rocada/alternareF2 raman semnificative si
    // pt. ea, dar simbolul REAL de scris trebuie tradus prin simbolEfectiv()
    // (vezi comentariul de acolo — "+" pt. formele directe, "-" pt. cele
    // complementare, NU mereu "+"), indiferent ce a calculat F1_TRANSFORMARI
    // mai sus (acela stie doar de x/":", nu si de adunare/scadere).
    const simbolDeScris = simbolEfectiv(simbol, adunareActiva);
    for (let f = MIN_FACTOR; f <= MAX_FACTOR; f++) {
      const span = document.getElementById(idCelula("x", f))?.querySelector("span");
      if (span) span.textContent = simbolDeScris;
    }

    const colgroup = tabel.querySelector("colgroup");
    const idCadru = new Set(COLOANE_CADRU.map((c) => idColoana(c)));
    const restAcum = [...colgroup.children].map((c) => c.id).filter((id) => !idCadru.has(id));

    return gliseazaColoaneMultipleInConfiguratie(tabelId, [...cadru.map(idColoana), ...restAcum], durataMs);
  }

  // ================================= RAME =====================================
  //
  // Trei rame (cerere user, 02.09.2026), toate dreptunghiuri cu colturi
  // rotunjite, `position:absolute` peste tabel — inlocuiesc vechiul chenar
  // scos explicit mai devreme ("e o prostie, va fi inlocuit de altceva").
  // CORECTIE (02.09.2026): prima versiune a ramei intrebarii avea colturi
  // DREPTE si bordura GALBENA — gresit dedus din eliminarea vechiului chenar
  // ("colturi rotunjite" descria implementarea VECHE (stiluri bakeate pe
  // celule, se stricau la reordonare) ca fiind proasta, nu forma rotunjita
  // in sine; iar culoarea trebuia sa coincida cu evidentierea lui "?", nu sa
  // fie distincta). Vezi STIL_RAMA_INTREBARE mai jos.
  //
  //   - rama intrebarii — incadreaza STRICT fapt-ul aritmetic testat (cele 5
  //     coloane cadru, oricare ar fi ordinea lor curenta). GLISEAZA intre
  //     randuri (translatie), ramanand cam aceeasi marime.
  //   - rama numarare — ancorata la RANDUL 1 al coloanelor "numarare1.."
  //     "numarare<nivel>", se EXTINDE/RESTRANGE in jos pana la randul
  //     factorului curent — coltul din dreapta-jos cade mereu exact pe
  //     celula cu produsul (ultima coloana numarare, vezi valoareStaticaCelula,
  //     cazul "numarare"). Ideea (user): "echivalentul inmultirii prin
  //     numarare unu cate unu".
  //   - rama adunari-repetate — acelasi tipar de extindere/restrangere ca
  //     rama numarare, dar pe coloana "adunari-repetate" (o singura coloana,
  //     nu un grup). Ideea (user): la 5x7, acopera "7+" de 5 ori — echivalentul
  //     inmultirii prin adunari repetate.
  //
  // Fiecare div, ale carui 4 coordonate (left/top/width/height) se
  // recalculeaza din pozitia REALA a celulelor de fiecare data — nu se poate
  // "strica" la reordonare, oricat de des s-ar intampla (spre deosebire de
  // vechiul chenar).
  //
  // Trei functii module-level (fara acces la starea vreunui quiz anume, ca si
  // schimbaFactForm mai sus) — primesc idul ramei SI stilul ei ca parametri
  // (creeazaRama), nu presupun ca exista o singura rama pe tabel si nu
  // cunosc culori/forme hardcodate:
  //   - colturiColoaneAB(wrapperId, idStanga, idDreapta) — PURA, calculeaza
  //     dreptunghiul (left/top/width/height, relativ la wrapper) care
  //     incadreaza ambele celule date. Foloseste offsetLeft/offsetTop/
  //     offsetWidth/offsetHeight (relative direct la offsetParent — vezi
  //     `position:relative` pe wrapper, in construiesteTabelComplet), NU
  //     getBoundingClientRect(): rocadaColoane/gliseazaColoaneMultipleIn-
  //     Configuratie reordoneaza coloanele SINCRON, dar anima tranzitia cu
  //     `transform` — iar getBoundingClientRect() ar citi pozitia FALSA,
  //     inca-in-tranzitie, exact in clipa in care ruleazaMutareaColoanelor-
  //     DacaActiva + glisiazaRamaLaFactorCurent ruleaza una dupa alta (gasit
  //     empiric, verificare Playwright, 02.09.2026). offsetLeft & co. sunt
  //     calculate din layout, NEATINSE de transform — dau direct pozitia
  //     FINALA, chiar daca vizual coloana inca gliseaza spre ea.
  //   - creeazaRama(wrapperId, ramaId, idStanga, idDreapta, stilRama) —
  //     creeaza div-ul (scotand intai unul vechi cu acelasi id, daca exista),
  //     il pozitioneaza cu colturiColoaneAB(), ii aplica stilRama (border +
  //     background — geometria se adauga separat) si il adauga in wrapper.
  //   - mutaRama(wrapperId, ramaId, idStanga, idDreapta, durataMs) —
  //     recalculeaza colturile cu colturiColoaneAB() si anima DIV-UL DEJA
  //     EXISTENT pana acolo, prin tranzitie CSS pe left/top/width/height (nu
  //     FLIP ca la coloane — rama nu e un nod mutat prin DOM, ci un
  //     dreptunghi ale carui 4 valori se schimba). durataMs=0 = salt instant.
  // Stilurile celor 3 rame — un singur loc, usor de comparat/ajustat.
  const RAZA_COLT_RAMA = "0.2em"; // aceeasi raza ca la placeholder (marcaj mai sus)
  const GROSIME_RAMA = "3px";
  // Bordura ACEEASI culoare cu care e evidentiat "?" (vezi
  // CULOARE_EVIDENTIERE_PLACEHOLDER mai sus) — fara umplere.
  const STIL_RAMA_INTREBARE =
    `border:${GROSIME_RAMA} solid ${CULOARE_EVIDENTIERE_PLACEHOLDER};` +
    `border-radius:${RAZA_COLT_RAMA};background:transparent;`;
  // Rosie, cu umplere rosie 75% transparenta (25% opaca) — "continutul rosu
  // transparent 75%" (cerere user); bordura ramane opaca, doar fondul (rgba)
  // e translucid. Vezi in raspuns explicatia cum se regleaza alpha-ul din
  // inspectorul Firefox.
  const STIL_RAMA_NUMARARE =
    `border:${GROSIME_RAMA} solid red;` +
    `border-radius:${RAZA_COLT_RAMA};background:rgba(255,0,0,0.25);`;
  // Verde, fara umplere (100% transparenta).
  const STIL_RAMA_ADUNARI_REPETATE =
    `border:${GROSIME_RAMA} solid green;` +
    `border-radius:${RAZA_COLT_RAMA};background:transparent;`;

  function colturiColoaneAB(wrapperId, idCelulaStanga, idCelulaDreapta) {
    const wrapper = document.getElementById(wrapperId);
    const stanga = document.getElementById(idCelulaStanga);
    const dreapta = document.getElementById(idCelulaDreapta);
    if (!wrapper || !stanga || !dreapta) return null;
    const stangaX = Math.min(stanga.offsetLeft, dreapta.offsetLeft);
    const dreaptaX = Math.max(stanga.offsetLeft + stanga.offsetWidth, dreapta.offsetLeft + dreapta.offsetWidth);
    const sus = Math.min(stanga.offsetTop, dreapta.offsetTop);
    const jos = Math.max(stanga.offsetTop + stanga.offsetHeight, dreapta.offsetTop + dreapta.offsetHeight);
    return {
      left: stangaX,
      top: sus,
      width: dreaptaX - stangaX,
      height: jos - sus,
    };
  }

  function creeazaRama(wrapperId, ramaId, idCelulaStanga, idCelulaDreapta, stilRama) {
    const wrapper = document.getElementById(wrapperId);
    const colturi = colturiColoaneAB(wrapperId, idCelulaStanga, idCelulaDreapta);
    if (!wrapper || !colturi) return null;
    document.getElementById(ramaId)?.remove();
    const rama = document.createElement("div");
    rama.id = ramaId;
    rama.style.cssText =
      `position:absolute;box-sizing:border-box;pointer-events:none;` +
      stilRama +
      `left:${colturi.left}px;top:${colturi.top}px;width:${colturi.width}px;height:${colturi.height}px;`;
    wrapper.appendChild(rama);
    return rama;
  }

  async function mutaRama(wrapperId, ramaId, idCelulaStanga, idCelulaDreapta, durataMs) {
    const rama = document.getElementById(ramaId);
    const colturi = colturiColoaneAB(wrapperId, idCelulaStanga, idCelulaDreapta);
    if (!rama || !colturi) return false;
    rama.style.transition = durataMs > 0
      ? `left ${durataMs}ms ease-in-out, top ${durataMs}ms ease-in-out, ` +
        `width ${durataMs}ms ease-in-out, height ${durataMs}ms ease-in-out`
      : "none";
    rama.style.left = `${colturi.left}px`;
    rama.style.top = `${colturi.top}px`;
    rama.style.width = `${colturi.width}px`;
    rama.style.height = `${colturi.height}px`;
    if (durataMs <= 0) return true;
    await new Promise((resolve) => setTimeout(resolve, durataMs));
    return true;
  }

  function createTablaInmultiriiTabelQuiz() {
    const { shuffle } = global.GameUtils;
    const { FactCatalog, FactStore } = global;

    // Sincronizeaza MIN/MAX_LEVEL/FACTOR cu domeniul persistat INAINTE de a
    // citi LEVEL_IMPLICIT mai jos — altfel o instanta noua (schimbare de
    // quiz, reload) ar porni cu limitele domeniului implicit chiar daca
    // userul lasase quizul pe alt domeniu la vizita anterioara.
    aplicaDomeniuFacts(getDomeniuFacts());
    let level = LEVEL_IMPLICIT;
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
    // Simbolul curent scris in coloana "x" — "x" sau ":" (vezi
    // schimbaFactForm/aplicaFactForm). NU se poate citi din pozitia
    // coloanelor in DOM (spre deosebire de ordinea celor 3 roluri, care se
    // citeste mereu direct din colgroup) — un fapt de inmultire poate avea
    // AICI ambiguitate reala doar pe simbol, nu pe pozitie, deci e singura
    // stare care chiar trebuie tinuta minte separat. Resetat la fiecare
    // nivel nou (incepeNivel), ca un tabel proaspat sa porneasca mereu la
    // inmultire.
    let operatorCurent = SIMBOL_INMULTIRE;
    // Adevarat cat timp o reordonare de coloane (rocada F1 SAU alternarea
    // F2 — mereu cel mult una, vezi "Mutare coloane" in CP, dropdown
    // exclusiv) anima pe tabelul curent — evita sa pornim o a doua animatie
    // cat timp prima inca ruleaza (copil care raspunde f. rapid).
    let oColoanaSeAnimeaza = false;
    // Instantaneul bifei "Comută pe tabla adunării" pt. nivelul curent — vezi
    // explicatia completa la LC_ADUNARE_ACTIVA. Refacut la fiecare
    // incepeNivel() (incl. restartul automat declansat chiar de bifa, prin
    // opts.onChange) si in resetLevelState — nu citim live getAdunareActiva()
    // in restul fisierului, ca toate cele 10 randuri ale unui nivel deja
    // randat sa ramana garantat in ACEEASI operatie.
    let adunareActivaNivel = getAdunareActiva();
    // Ultimul fact form ales de modul "Toate eq forms" — vezi
    // aleeFactFormDiferita/ruleazaMutareaColoanelorDacaActiva mai jos. Evita
    // sa alegem din nou ACELASI fact form doua intrebari la rand ("la ALT
    // eqform", cerere user). Resetat la fiecare nivel nou — un tabel
    // proaspat porneste mereu la f1_initial+stanga, deci orice fact form e
    // valabil pt. prima rotatie a noului nivel.
    let ultimaFactForm = null;
    // Rolul din triada (factor/nr-tabla/produs) pe care sta "?" ACUM — vezi
    // continutCelula/esteCorect/construiesteOptiuni mai jos. Implicit
    // "produs" (comportamentul dintotdeauna, valabil pt. rocada/alternareF2/
    // toateEqForms) — DOAR modurile "toateEqFormsFaraNrTabla" si
    // "toateEqFormsOriceRol" il schimba, in ruleazaMutareaColoanelorDacaActiva,
    // pe rolul "rezultat" al fact form-ului ales (cerere user, 02.09.2026).
    // Resetat la fiecare nivel nou, ca ultimaFactForm.
    let rolIntrebareCurent = "produs";
    // ResizeObserver pe #ti-wrapper — vezi resincronizeazaRamele/
    // porniObservatorRezizeRama mai jos. O singura instanta, refolosita
    // (nu recreata) la fiecare nivel nou — doar tinta ei (.observe) se
    // schimba, cand wrapper-ul e reconstruit.
    let observatorRezizeRama = null;

    // Rezultatul randului — produsul (inmultire) sau suma (adunare), dupa
    // instantaneul de nivel adunareActivaNivel (nu getAdunareActiva() live —
    // vezi comentariul de la declaratia ei). Nume neutru (nu "produsPentru")
    // din 02.09.2026, de cand poate calcula si suma.
    function rezultatPentru(f, targetLevel = level) {
      return adunareActivaNivel ? f + targetLevel : f * targetLevel;
    }

    // Valoarea corecta pt. rolul care e ACUM "?" (rolIntrebareCurent) — de
    // regula "produs" (rezultatPentru, ca dintotdeauna), dar la modurile
    // "toateEqFormsFaraNrTabla"/"toateEqFormsOriceRol" poate fi "factor"
    // (chiar randul, f) sau "nr-tabla" (nivelul, constant). Un singur loc
    // care stie asta — folosit de randare (continutCelula), de verificarea
    // raspunsului (esteCorect) si de generarea optiunilor
    // (construiesteOptiuni), ca sa nu se poata desincroniza intre ele.
    function valoareCorectaPentru(f, targetLevel = level) {
      if (rolIntrebareCurent === "factor") return f;
      if (rolIntrebareCurent === "nr-tabla") return targetLevel;
      return rezultatPentru(f, targetLevel);
    }

    // Acelasi fapt (a=nivel, b=factor) ca la adaptoarele existente
    // js/conexe-table-quiz/adapters/multiplication.js (operation "mul") si
    // js/conexe-table-quiz/adapters/addition.js (operation "add") — asa
    // incercarile de-aici (in oricare mod, vezi getAdunareActiva) se aduna
    // pe ACELASI record din FactStore cu cele din quizurile dedicate, nu pe
    // unul paralel. "add"/"mul" sunt string-urile EXACTE cerute de
    // FactCatalog (js/fact-catalog.js, OPERATORS) — confirmat cu userul
    // explicit ("Evident, 'Adunari'"), nu presupus.
    function factForRow(f, targetLevel = level) {
      return FactCatalog.createFact({
        operation: adunareActivaNivel ? "add" : "mul",
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
        // "Comută pe tabla adunării" trece simbolul prin simbolEfectiv() —
        // vezi comentariul de acolo (nu e mereu "+": formele complementare
        // au nevoie de "-", altfel ecuatia devine falsa, ex. "8=10+2" gresit
        // in loc de "8=10-2" — bug gasit de user, 02.09.2026). Aceeasi
        // functie e folosita si de schimbaFactForm, ca scrierea live din
        // timpul unei mutari de coloane sa ramana consistenta.
        case "x": return simbolEfectiv(operatorCurent, adunareActivaNivel);
        case "nr-tabla": return String(level);
        case "egal": return "=";
        case "produs": return String(rezultatPentru(f));
        // "scrie 2+ pe fiecare rand pe acare acum e doar 2" (user, 01.09.2026)
        // — inlocuieste randul-schela cu "+" separat.
        //
        // Primul rand al domeniului arata produsul COMPLET, nu doar level+
        // (cerere user, 05.09.2026): la domeniile cu MIN_FACTOR>1 (ex.
        // "1..10 - 11..20"/"11..20 - 11..20"), primul rand ilustreaza DE LA
        // CE NUMAR incep adunarile repetate — la tabla lui 3, domeniu cu
        // factor 11..20, primul rand (11x3=33) arata "33+", nu doar "3+".
        // Formula pe MIN_FACTOR (nu o valoare per-domeniu hardcodata), ca sa
        // functioneze neschimbata si la domenii viitoare adaugate in
        // DOMENII_FACTS. Mereu inmultire (f * level, NU rezultatPentru) —
        // coloana asta nu urmeaza "Comută pe tabla adunării", la fel ca
        // pana acum (vezi comentariul de la LC_ADUNARE_ACTIVA mai sus).
        case "adunari-repetate": return f === MIN_FACTOR ? `${f * level}+` : `${level}+`;
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
    // Singurul semnal vizual al intrebarii active e "?" pe celula al carei
    // rol e rolIntrebareCurent — de regula "produs" (fara chenar in jurul
    // grupului — scos explicit, user 02.09.2026), dar poate fi "factor" la
    // modurile "toateEqForms*" noi (vezi valoareCorectaPentru mai sus).
    function continutCelula(coloana, f, esteActiv) {
      const valoare =
        coloana === rolIntrebareCurent && esteActiv
          ? placeholder.marcaj(valoareCorectaPentru(f) >= 10)
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
        const text = etichetaHeader(coloana, adunareActivaNivel);
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
      // `position:relative` — ancora pt. rama intrebarii mai jos (div separat,
      // `position:absolute`, calculat relativ la acest wrapper).
      const stilWrapper =
        `text-align:center;font-size:${getMarimeFontPx()}px;position:relative;` +
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

    // Promptul text (fallback/aria) al rundei curente — string-ul EXACT
    // trebuie sa coincida in ambele locuri unde se construieste vederea
    // rundei (vederePentruRunda si sincronizeazaOrchestratorul), de-aia
    // functie separata, nu doua template-uri copiate.
    function promptText() {
      return `${factorCurent}${adunareActivaNivel ? "+" : "x"}${level}=?`;
    }

    function vederePentruRunda(extra = {}) {
      return {
        prompt: promptText(),
        promptHtml: construiesteTabelComplet(),
        options: [...options],
        correctIndex,
        hintMessage: extra.hintMessage ?? hintMessageCurent(adunareActivaNivel),
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

    // Candidati de distractor pt. rolul "nr-tabla" — spre deosebire de
    // "factor"/"produs" (unde raspunsul corect variaza cu randul f, deci un
    // interval larg 1..max ofera destule valori PLAUZIBILE), "nr-tabla" e
    // CONSTANT pe tot nivelul (mereu = level) — un interval larg ar da
    // distractori evident departati (usor de eliminat prin comparatie), deci
    // ii alegem explicit din vecinatatea lui level (ex. la nivel 7: 6,8,5,9...).
    function candidatiDistractorNrTabla() {
      const candidati = [];
      for (let delta = 1; candidati.length < 8; delta++) {
        if (level - delta >= MIN_LEVEL) candidati.push(level - delta);
        candidati.push(level + delta);
      }
      return candidati;
    }

    function construiesteOptiuni() {
      const corect = valoareCorectaPentru(factorCurent);
      // "distractorii random din intervalul 1-level*10" (user, 01.09.2026)
      // — la inmultire. `rezultatPentru(MAX_FACTOR)` da automat marginea
      // corecta si la adunare (level+MAX_FACTOR, suma maxima posibila pe
      // nivelul asta) — ACEEASI functie ca la `corect` mai sus, deci nu se
      // pot desincroniza intre ele daca se schimba vreodata formula. La
      // modurile "toateEqForms*" (cerere user, 02.09.2026), rolIntrebareCurent
      // poate fi si "factor" (interval 1..MAX_FACTOR) sau "nr-tabla"
      // (candidatiDistractorNrTabla — vezi comentariul de acolo).
      let candidati;
      if (rolIntrebareCurent === "factor") {
        candidati = [];
        for (let v = MIN_FACTOR; v <= MAX_FACTOR; v++) if (v !== corect) candidati.push(v);
      } else if (rolIntrebareCurent === "nr-tabla") {
        candidati = candidatiDistractorNrTabla().filter((v) => v !== corect);
      } else {
        const max = rezultatPentru(MAX_FACTOR);
        candidati = [];
        for (let v = 1; v <= max; v++) if (v !== corect) candidati.push(v);
      }
      const gresite = shuffle(candidati).slice(0, 2);
      options = shuffle([corect, gresite[0], gresite[1]]).map(String);
      correctIndex = options.indexOf(String(corect));
    }

    function sincronizeazaOrchestratorul(vechiFactor) {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: promptText(),
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
      // ruleazaMutareaColoanelorDacaActiva INAINTE de construiesteOptiuni/
      // sincronizeazaOrchestratorul (ordine schimbata, cerere user,
      // 02.09.2026): la modurile "toateEqForms*" ea decide si
      // rolIntrebareCurent (pe ce rol sta "?" acum) — optiunile si patch-ul
      // de randare de mai jos trebuie sa vada valoarea NOUA, nu pe cea
      // ramasa de la intrebarea anterioara. Pt. celelalte moduri (rocada/
      // alternareF2/toateEqForms), rolIntrebareCurent ramane oricum "produs"
      // — reordonarea nu le schimba comportamentul.
      ruleazaMutareaColoanelorDacaActiva(vechiFactor);
      construiesteOptiuni();
      sincronizeazaOrchestratorul(vechiFactor);
      glisiazaRamaLaFactorCurent(vechiFactor);
      gliseazaRamaVerticalaLaFactorCurent(vechiFactor, ID_RAMA_NUMARARE, "numarare1", `numarare${level}`);
      gliseazaRamaVerticalaLaFactorCurent(vechiFactor, ID_RAMA_ADUNARI_REPETATE, "adunari-repetate", "adunari-repetate");
    }

    // Aplica un fact form complet (F1+F2) prin schimbaFactForm() (module-
    // level), actualizand IN ACELASI TIMP operatorCurent — singurul motiv
    // pt. care exista acest wrapper subtire: schimbaFactForm() nu are acces
    // la starea per-instanta a quizului, deci nu poate tine minte singur ce
    // simbol ("x"/":") sa foloseasca urmatoarea intrebare din acelasi nivel.
    async function aplicaFactForm(f1, f2, durataMs) {
      operatorCurent = F1_TRANSFORMARI[f1].simbol;
      return schimbaFactForm(ID_TABLE, f1, f2, durataMs, adunareActivaNivel);
    }

    // Comuta vizual coloanele la fiecare intrebare noua DIN ACELASI nivel
    // (vechiFactor != null — la prima intrebare a unui nivel nou tabelul
    // tocmai a fost reconstruit integral in ordinea normala, deci nu exista
    // o stare "dinainte" de la care sa animam un swap). Exact UN mod activ
    // deodata (dropdown "Mutare coloane:" din CP — vezi getMutareColoaneMod):
    //
    //   - "rocada"      — rocadaColoane() interschimba "factor"/"nr-tabla"
    //                      (F1 comutat), oriunde s-ar afla ele acum.
    //   - "alternareF2" — aplicaFactForm() alterneaza orientarea (F2),
    //                      pastrand ordinea curenta a operanzilor (deci daca
    //                      userul trece ulterior pe modul "rocada", cele
    //                      doua nu se calca reciproc).
    //
    // Durata 0 pt. modul selectat = functia dezactivata complet (cerere
    // expresa user) — coloanele raman fixe, nu se misca niciodata.
    //
    // "Fire and forget": nu asteptam promisiunea — pregatesteFactor ramane
    // sincron, ca tot restul motorului de raspuns. Daca o mutare e deja in
    // desfasurare (copil care raspunde f. rapid), sarim peste turul asta:
    // fara eroare, fara stare stricata, doar o animatie "sarita" — turul
    // urmator reia normal.
    // Alege un fact form (F1+F2) diferit de ultimul aplicat de acest mod —
    // vezi ultimaFactForm mai sus. shuffle() e acelasi utilitar folosit de
    // alegeFactorCurent mai sus, nu Math.random() direct.
    // `pool` — de regula TOATE_FACT_FORMS (8), dar modul "toateEqFormsFaraNrTabla"
    // paseaza TOATE_FACT_FORMS_FARA_NR_TABLA (6) — vezi ruleazaMutareaColoanelorDacaActiva.
    function aleeFactFormDiferita(pool = TOATE_FACT_FORMS) {
      const candidati = ultimaFactForm
        ? pool.filter((ff) => ff.f1 !== ultimaFactForm.f1 || ff.f2 !== ultimaFactForm.f2)
        : pool;
      const aleasa = shuffle(candidati)[0];
      ultimaFactForm = aleasa;
      return aleasa;
    }

    // Ordinea VIZUALA curenta a celor 5 coloane cadru (nume de rol, ex.
    // ["nr-tabla","x","factor","egal","produs"]) — citita direct din DOM
    // (colgroup), la fel ca citesteOrdineaTriadei mai sus, dar pt. toate
    // cele 5 (nu doar cele 3 numerice) — are nevoie si de "x"/"egal" ca sa
    // stie care sunt CAPETELE grupului (extremele), nu doar rolurile
    // numerice. Folosita de rama intrebarii (vezi idCeluleExtremeCadru).
    function coloaneCadruInOrdineaCurenta() {
      const tabel = document.getElementById(ID_TABLE);
      const colgroup = tabel?.querySelector("colgroup");
      if (!colgroup) return null;
      const rolDupaId = new Map(COLOANE_CADRU.map((c) => [idColoana(c), c]));
      const ordonate = [...colgroup.children].map((c) => rolDupaId.get(c.id)).filter((rol) => rol !== undefined);
      return ordonate.length === COLOANE_CADRU.length ? ordonate : null;
    }

    // Id-urile celulelor STANGA/DREAPTA (extremele grupului cadru) pt. randul
    // factorului `f`, in ordinea VIZUALA curenta — astea sunt cele doua id-uri
    // pe care le cere mutaRama/creeazaRama (vezi sectiunea RAMA INTREBARE).
    function idCeluleExtremeCadru(f) {
      const ordonate = coloaneCadruInOrdineaCurenta();
      if (!ordonate) return null;
      return {
        stanga: idCelula(ordonate[0], f),
        dreapta: idCelula(ordonate[ordonate.length - 1], f),
      };
    }

    // Durata (ms) modului "Mutare coloane" CURENT selectat — indiferent care
    // e activ, exact unul dintre cele trei. Rama intrebarii isi sincronizeaza
    // glisarea pe aceeasi durata (cerere user, 02.09.2026: "cred ca va fi
    // egal si cu cel pt mutare coloane"), ca sa para ACELASI gest, nu doua
    // animatii independente care nu se termina deodata.
    function duratMutareColoaneCurenta() {
      const mod = getMutareColoaneMod();
      if (mod === "faraMutari") return 0;
      if (mod === "alternareF2") return getAlternareF2DurataMs();
      if (mod === "toateEqForms") return getToateEqFormsDurataMs();
      if (mod === "toateEqFormsFaraNrTabla") return getToateEqFormsFaraNrTablaDurataMs();
      if (mod === "toateEqFormsOriceRol") return getToateEqFormsOriceRolDurataMs();
      return getRocadaDurataMs();
    }

    // Gliseaza rama intrebarii la randul factorului CURENT — apelata dupa
    // ruleazaMutareaColoanelorDacaActiva (vezi pregatesteFactor mai jos), ca
    // sa citeasca ordinea coloanelor DUPA ce o eventuala mutare si-a scris
    // deja noua ordine in colgroup (mutarile din acest fisier reordoneaza
    // DOM-ul sincron, chiar daca animatia lor vizuala mai dureaza — vezi
    // comentariile din rocadaColoane/gliseazaColoaneMultipleInConfiguratie).
    // Nimic de facut la prima intrebare a unui nivel (vechiFactor==null) —
    // acolo rama nu exista inca, se ocupa planificaRamaLaNivelNou (mai jos)
    // de crearea ei, o data ce tabelul chiar apare in DOM.
    function glisiazaRamaLaFactorCurent(vechiFactor) {
      if (vechiFactor == null) return;
      const celule = idCeluleExtremeCadru(factorCurent);
      if (!celule) return;
      mutaRama(ID_WRAPPER, ID_RAMA_INTREBARE, celule.stanga, celule.dreapta, duratMutareColoaneCurenta())
        .catch(() => {});
    }

    function ruleazaMutareaColoanelorDacaActiva(vechiFactor) {
      if (vechiFactor == null || oColoanaSeAnimeaza) return;
      const mod = getMutareColoaneMod();

      // "faraMutari" — nimic de facut, niciodata: nicio mutare de coloane,
      // "?" ramane pe "produs" (ca la rocada/alternareF2/toateEqForms).
      if (mod === "faraMutari") {
        rolIntrebareCurent = "produs";
        return;
      }

      // Cele doua moduri noi (cerere user, 02.09.2026) sunt singurele care
      // muta "?" de pe "produs" — vezi rolIntrebareCurent (declaratie mai
      // sus) si valoareCorectaPentru. Toate celelalte moduri de mai jos
      // reseteaza explicit inapoi pe "produs", ca o eventuala trecere
      // anterioara prin unul din aceste doua (cu "?" pe alt rol) sa nu
      // ramana "agatata" dupa ce userul schimba modul din dropdown.
      if (mod === "toateEqFormsFaraNrTabla" || mod === "toateEqFormsOriceRol") {
        const durataMs =
          mod === "toateEqFormsFaraNrTabla"
            ? getToateEqFormsFaraNrTablaDurataMs()
            : getToateEqFormsOriceRolDurataMs();
        if (durataMs <= 0) return;
        const pool = mod === "toateEqFormsFaraNrTabla" ? TOATE_FACT_FORMS_FARA_NR_TABLA : TOATE_FACT_FORMS;
        const { f1, f2 } = aleeFactFormDiferita(pool);
        rolIntrebareCurent = F1_TRANSFORMARI[f1].rezultat;
        oColoanaSeAnimeaza = true;
        aplicaFactForm(f1, f2, durataMs)
          .catch(() => {})
          .finally(() => { oColoanaSeAnimeaza = false; });
        return;
      }

      rolIntrebareCurent = "produs";

      if (mod === "toateEqForms") {
        const durataMs = getToateEqFormsDurataMs();
        if (durataMs <= 0) return;
        const { f1, f2 } = aleeFactFormDiferita();
        oColoanaSeAnimeaza = true;
        aplicaFactForm(f1, f2, durataMs)
          .catch(() => {})
          .finally(() => { oColoanaSeAnimeaza = false; });
        return;
      }

      if (mod === "alternareF2") {
        const durataMs = getAlternareF2DurataMs();
        if (durataMs <= 0) return;
        const ordineaCurenta = citesteOrdineaTriadei(ID_TABLE); // [r0,r1,r2]
        const produsPrimul = ordineaCurenta[0] === "produs";
        const [operand1Real] = produsPrimul ? ordineaCurenta.slice(1) : ordineaCurenta;
        const f1 = operand1Real === "factor" ? "f1_initial" : "f1_comutat";
        const f2Nou = produsPrimul ? "stanga" : "dreapta";
        oColoanaSeAnimeaza = true;
        aplicaFactForm(f1, f2Nou, durataMs)
          .catch(() => {})
          .finally(() => { oColoanaSeAnimeaza = false; });
        return;
      }

      const durataMs = getRocadaDurataMs();
      if (durataMs <= 0) return;
      oColoanaSeAnimeaza = true;
      rocadaColoane(ID_TABLE, idColoana("factor"), idColoana("nr-tabla"), durataMs)
        .catch(() => {})
        .finally(() => { oColoanaSeAnimeaza = false; });
    }

    // Asteapta pana tabelul NIVELULUI CERUT chiar exista in DOM, apoi cheama
    // `onGata()` — vezi motivul intarzierii mai jos. Extras dintr-un singur
    // apelant initial (planificaRedimensionareAutomata) cand a mai aparut un
    // al doilea consumator identic (planificaRamaLaNivelNou, 02.09.2026):
    // ambele au nevoie de EXACT acelasi lucru, un moment sigur dupa care
    // tabelul e garantat pictat — nu de doua bucle de polling separate.
    //
    // Tabelul din DOM nu reflecta neaparat inca noul nivel in clipa asta: la
    // avansul NATURAL de nivel (dupaRaspunsCorect), incepeNivel() ruleaza
    // INAINTE de pauza/bannerul de schimbare de nivel (schimbare-de-nivel.js)
    // — promptHtml-ul nou nu ajunge in DOM decat dupa ce se termina acea
    // pauza. Verificam prin numarul de coloane "numarare" deja randate
    // (trebuie sa fie exact `level`) daca tabelul AFISAT chiar corespunde
    // nivelului curent, cu reincercari limitate (max ~5s) — acopera atat
    // pornirea directa (fara nicio pauza), cat si avansul natural (cu pauza).
    function asteaptaTabelulPictat(nivelAsteptat, onGata) {
      let incercariRamase = 50;
      const incearca = () => {
        if (level !== nivelAsteptat) return; // nivelul s-a schimbat iar intre timp, planul asta nu mai e valid
        const wrapper = document.getElementById(ID_WRAPPER);
        const coloaneNumarareInDom = wrapper
          ? wrapper.querySelectorAll('[id^="ti-numarare"]').length / (MAX_FACTOR - MIN_FACTOR + 1)
          : -1;
        if (coloaneNumarareInDom === nivelAsteptat) {
          onGata();
          return;
        }
        incercariRamase -= 1;
        if (incercariRamase <= 0) return; // siguranta: tabelul nu s-a materializat, renuntam curat
        setTimeout(incearca, 100);
      };
      requestAnimationFrame(incearca);
    }

    // Ruleaza redimensionareAutomataTabelInmultiri() o SINGURA DATA per nivel
    // (cerere user, 02.09.2026) — dupa aceea userul poate ajusta manual
    // "Scris mic %" din CP fara sa-i fie suprascrisa valoarea pana la
    // urmatorul nivel. `ultimulNivelRedimensionat` tine minte pt. ce nivel
    // s-a rulat deja, ca sa nu se repete la fiecare rerandare DIN interiorul
    // aceluiasi nivel (raspuns corect pe alt factor, patch de tranzitie etc.
    // — acelea NU trec prin incepeNivel()).
    function planificaRedimensionareAutomata() {
      const nivelDePlanificat = level;
      asteaptaTabelulPictat(nivelDePlanificat, () => {
        if (ultimulNivelRedimensionat !== nivelDePlanificat) {
          ultimulNivelRedimensionat = nivelDePlanificat;
          redimensionareAutomataTabelInmultiri();
        }
      });
    }

    // Creeaza rama intrebarii (vezi sectiunea RAMA INTREBARE, module-level)
    // la prima intrebare a unui nivel nou — tabelul tocmai reconstruit nu are
    // inca nicio rama (cea veche, daca a existat, a disparut o data cu tot
    // DOM-ul vechi). Citeste `factorCurent` in interiorul callback-ului (nu
    // il capteaza inainte) — la momentul cand `onGata` chiar ruleaza poate
    // trece ceva timp (pauza de schimbare de nivel), dar `factorCurent`
    // ramane oricum valabil pt. ACELASI nivel (garantat de asteaptaTabelulPictat).
    function planificaRamaLaNivelNou() {
      const nivelDePlanificat = level;
      asteaptaTabelulPictat(nivelDePlanificat, () => {
        porniObservatorRezizeRama();
        const celule = idCeluleExtremeCadru(factorCurent);
        if (celule) creeazaRama(ID_WRAPPER, ID_RAMA_INTREBARE, celule.stanga, celule.dreapta, STIL_RAMA_INTREBARE);
      });
    }

    // Reancoreaza INSTANT (durataMs=0) toate ramele active la geometria lor
    // CURENTA — spre deosebire de gliseazaRama*/planificaRama*, care le MUTA
    // la o intrebare NOUA, asta doar corecteaza pozitia unor rame deja
    // corect tintite (acelasi rand/coloane, aceeasi tinta), fara sa schimbe
    // la ce tintesc. Foloseste mutaRama, care oricum nu face nimic daca rama
    // ceruta inca nu exista (creeazaRama nu a rulat inca) — sigur de apelat
    // oricand. Vezi porniObservatorRezizeRama mai jos pt. cand se declanseaza.
    function resincronizeazaRamele() {
      if (factorCurent == null) return;
      const celuleIntrebare = idCeluleExtremeCadru(factorCurent);
      if (celuleIntrebare) {
        mutaRama(ID_WRAPPER, ID_RAMA_INTREBARE, celuleIntrebare.stanga, celuleIntrebare.dreapta, 0).catch(() => {});
      }
      mutaRama(ID_WRAPPER, ID_RAMA_NUMARARE, idCelula("numarare1", MIN_FACTOR), idCelula(`numarare${level}`, factorCurent), 0)
        .catch(() => {});
      mutaRama(ID_WRAPPER, ID_RAMA_ADUNARI_REPETATE, idCelula("adunari-repetate", MIN_FACTOR), idCelula("adunari-repetate", factorCurent), 0)
        .catch(() => {});
    }

    // BUG gasit de user (02.09.2026: "la inmultirea cu 10 rama nu e bine,
    // acopera doar si partial 0" — reprodus abia in Playwright, dupa mai
    // multe incercari, cu "Toate eq forms" activ si multe intrebari la rand).
    // Cauza reala: #ti-wrapper are `text-align:center` (vezi
    // construiesteTabelComplet) — tabelul (mai ingust decat wrapper-ul) se
    // CENTREAZA in interiorul lui, deci offsetLeft-ul unei celule (relativ
    // la wrapper, folosit de colturiColoaneAB) INCLUDE acest "gol" de
    // centrare. Daca LATIMEA wrapper-ului se schimba din motive STRAINE de
    // acest quiz (alt panou de pe pagina creste/scade in inaltime, apare/
    // dispare o bara de scroll — vezi panoul "Timpi raspuns" din CP —
    // DEPANARE), tabelul se recentreaza cu alt gol — dar rama, calculata O
    // SINGURA DATA la ultima mutaRama, ramane "inghetata" la vechiul offset,
    // ramane in urma. Exact ce a raportat userul.
    //
    // Fix: ResizeObserver pe #ti-wrapper — la orice schimbare de dimensiune
    // a lui, INDIFERENT de cauza (n-are de-a face doar cu "Timpi raspuns" —
    // orice alt panou viitor cu acelasi efect e acoperit la fel), toate
    // ramele se reancoreaza instant la geometria REALA curenta.
    function porniObservatorRezizeRama() {
      const wrapper = document.getElementById(ID_WRAPPER);
      if (!wrapper) return;
      if (!observatorRezizeRama) {
        observatorRezizeRama = new ResizeObserver(() => resincronizeazaRamele());
      } else {
        observatorRezizeRama.disconnect();
      }
      observatorRezizeRama.observe(wrapper);
    }

    // Rama "verticala" (numarare / adunari-repetate) — spre deosebire de rama
    // intrebarii (care GLISEAZA intre randuri, ramanand cam aceeasi marime),
    // astea raman ANCORATE la primul rand (MIN_FACTOR — NU literalul 1, vezi
    // "Domeniu facts:" mai sus: la domeniul 11..20 primul rand e factor 11,
    // nu 1, care nici nu exista in DOM) si doar se EXTIND/RESTRANG in jos pana
    // la randul factorului curent (cerere user, 02.09.2026) — coltul din
    // dreapta-jos al ramei numarare cade mereu exact pe celula cu produsul.
    // Generice: primesc NUMELE rolurilor de coloana stanga/dreapta (nu
    // id-uri de celula) — cele doua rame difera doar prin ce coloana(e)
    // acopera si ce stil au.
    //
    // La NIVEL NOU: creeaza rama STRICT pe primul rand (MIN_FACTOR, inaltime
    // minima), apoi o extinde IMEDIAT pana la randul factorului ales —
    // vizibil ca o "crestere" chiar de la prima intrebare (cerere user:
    // "TOATE incep simultan imediat dupa afisarea intrebarii ... si dureaza
    // toate la fel de mult: tt"), nu un salt instant la marimea finala.
    function planificaRamaVerticalaLaNivelNou(ramaId, coloanaStanga, coloanaDreapta, stilRama) {
      const nivelDePlanificat = level;
      asteaptaTabelulPictat(nivelDePlanificat, () => {
        const idStangaR1 = idCelula(coloanaStanga, MIN_FACTOR);
        const idDreaptaR1 = idCelula(coloanaDreapta, MIN_FACTOR);
        creeazaRama(ID_WRAPPER, ramaId, idStangaR1, idDreaptaR1, stilRama);
        mutaRama(ID_WRAPPER, ramaId, idStangaR1, idCelula(coloanaDreapta, factorCurent), duratMutareColoaneCurenta())
          .catch(() => {});
      });
    }

    // La schimbare de intrebare (acelasi nivel): doar extinde/restrange (un
    // singur mutaRama, fara sa recreeze) — capatul de sus ramane fix la
    // primul rand (MIN_FACTOR), capatul de jos gliseaza la noul rand activ.
    function gliseazaRamaVerticalaLaFactorCurent(vechiFactor, ramaId, coloanaStanga, coloanaDreapta) {
      if (vechiFactor == null) return; // se ocupa planificaRamaVerticalaLaNivelNou
      mutaRama(
        ID_WRAPPER,
        ramaId,
        idCelula(coloanaStanga, MIN_FACTOR),
        idCelula(coloanaDreapta, factorCurent),
        duratMutareColoaneCurenta()
      ).catch(() => {});
    }

    function incepeNivel() {
      neterminate = [];
      for (let f = MIN_FACTOR; f <= MAX_FACTOR; f++) neterminate.push(f);
      aparitiiPerFact = {};
      operatorCurent = SIMBOL_INMULTIRE;
      adunareActivaNivel = getAdunareActiva();
      ultimaFactForm = null;
      rolIntrebareCurent = "produs";
      pregatesteFactor(alegeFactorCurent(), null);
      planificaRedimensionareAutomata();
      planificaRamaLaNivelNou();
      planificaRamaVerticalaLaNivelNou(ID_RAMA_NUMARARE, "numarare1", `numarare${level}`, STIL_RAMA_NUMARARE);
      planificaRamaVerticalaLaNivelNou(ID_RAMA_ADUNARI_REPETATE, "adunari-repetate", "adunari-repetate", STIL_RAMA_ADUNARI_REPETATE);
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
        hintMessage: hintMessageCurent(adunareActivaNivel),
        esteCorect: (_item, index) => {
          apasariInAparitiaCurenta += 1;
          return Number(options[index]) === valoareCorectaPentru(factorCurent);
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
        operatorCurent = SIMBOL_INMULTIRE;
        adunareActivaNivel = getAdunareActiva();
        ultimaFactForm = null;
        rolIntrebareCurent = "produs";
      },

      // Structura CP declarativă, raportată o singură dată către motorul
      // central (cerere user, 04.09.2026) — vezi
      // MotorOptiuniControlPanel.inregistreazaControlPanel(), apelat din
      // app.js imediat după QuizRegistry.createActive(). Feature-urile
      // centrale (share-link etc.) citesc de acolo, nu mai cer nimic direct
      // quizului — foloseste ACELASI campurileCP() ca panoul CP propriu-zis,
      // nu o lista paralela.
      get controlPanel() {
        return { sectiuni: [{ id: QUIZ_ID, campuri: campurileCP(this) }] };
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
      // 02.09.2026, migrat la motorul comun 03.09.2026 — vezi
      // documente de referinta/standard-optiuni-cp.md). Panoul se deseneaza
      // din campurileCP() de mai sus; singura logica specifica ramasa aici e
      // functia de rerandare, transmisa STRICT campului "mutareColoane"
      // (stepperele de durata trebuie sa corespunda modului nou ales).
      appendTablaInmultiriiTabelControlPanel(mount, opts) {
        if (!mount) return;
        const rerandeaza = () => this.appendTablaInmultiriiTabelControlPanel(mount, opts);
        global.MotorOptiuniControlPanel.construiesteDOM(mount, campurileCP(this, opts, rerandeaza));
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
