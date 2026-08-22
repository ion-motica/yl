/**
 * Motor 2 (m2) — „Cl. 1 - Rigle". Motor complet separat de motorul 1 (FallingEngine):
 * scenă proprie + butoane proprii. Când m2 e activ, shell-ul m1 din arenă e suprimat
 * (scenă, slot butoane, bară fixă) — m1 nu există aici.
 *
 * Sursa curentă de adevăr pentru arhitectură/contract e
 * `documente de referinta/RIGLE-REFERENCE.md` — actualizeaz-o la orice schimbare aici.
 * `js/rigle/SPEC-etapa1.md` e istoric (etapa 1, doar mișcarea).
 *
 *   RigleEngine.mount({ arenaEl, optionsEl }, config?)
 *     → { destroy, setGridLines, setColumnLayout, reporneste, setNumerotareRanduri, setLift, setFov,
 *         setDaraGlorioasa, setPozitieMere }
 *
 * `arenaEl` = #arena (scena m2). `optionsEl` = #options (slotul m1, doar ca reper
 * pentru stratul de butoane = părintele lui) — NU e reutilizat, doar suprimat.
 */
(function (global) {
  "use strict";

  const STYLE_ID = "rigle-styles";

  const CSS = `
.rigle-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  --cell: 32px;
  font-family: system-ui, sans-serif;
  background: #fbfbf3;
}
/* Suprapunere „PAUZĂ" — propria copie a lui .game.is-paused .div-strat-anunturi::after
   din style.css, fiindcă acel element e unul dintre copiii #arena pe care Rigle îi
   ascunde. Duplicare intenționată, nu bug — vezi setPauza() în JS. */
.game.rigle-active.is-paused .rigle-scene::after {
  content: "PAUZĂ";
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  pointer-events: none;
}
.rigle-columns {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.rigle-col {
  position: absolute;
  background: #ffe14d;
  border: 1px solid #e6c02a;
  border-radius: 6px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}
.rigle-lift {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  background: #ffffff;
  border: 2px solid #3a4a63;
  border-radius: 8px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
}
.rigle-lift--ready {
  transition: left 0.35s ease;
}
.rigle-lift-q {
  font-weight: 800;
  font-size: 19px; /* fix, nu urmărește --cell — nu se micșorează la sume mari */
  white-space: nowrap;
  color: #1f2a3a;
  line-height: 1;
}
/* Span dedicat pt. „?" din întrebare — randeazaFact() îl creează separat (nu text brut
   în qEl), ca porneșteFovLift()/avanseazaFovLift() să-i poată citi poziția și,
   la coloana corectă, să-i înlocuiască conținutul cu suma, fără să atingă restul
   întrebării. Moștenește fontul din .rigle-lift-q (fără reguli proprii) cât timp
   arată „?"; .rigle-lift-raspuns se adaugă DOAR la dezvăluire. */
.rigle-lift-raspuns {
  background: #43a047;
  color: #eafbea;
  padding: 0 4px;
  border-radius: 4px;
  animation: rigle-blink 0.6s ease-in-out infinite; /* continuu, spre deosebire de
    .rigle-btn-mismatch--corect (static) — cerință explicită a userului. */
}
/* Rândul de mere NU mai e copil al .rigle-lift (era, până la cererea explicită
   „mere sub numerotare"): .rigle-lift are z-index:2 și creează context de
   stivuire propriu — orice copil al lui, indiferent ce z-index i-ai da, tot
   picta deasupra fraților lui .rigle-lift (deci și deasupra .rigle-row-numbers,
   z-index:1), fiindcă un z-index pe un descendent contează doar ÎN INTERIORUL
   contextului părintelui, nu față de frații părintelui. Soluție reală: rowEl e
   acum frate al lui .rigle-lift în .rigle-scene, cu propriul z-index:1 — la egalitate
   cu .rigle-row-numbers, ordinea decide cine picta deasupra: rowEl e adăugat
   ÎNAINTEA lui .rigle-row-numbers în DOM (vezi mount()), deci numerotarea (mai
   târziu în DOM) îl acoperă. Poziția (left/top) nu mai vine gratis din flex-ul
   liftului — se scrie explicit din JS, sincron, la fiecare punct unde se scrie și
   lift.style.left/top (computeGeometry, tick, selectColumn, coborârea glorioasă),
   folosind rowOffsetTop = distanța verticală constantă lift→rând (cache-uită, nu
   remăsurată la fiecare cadru). */
.rigle-lift-row {
  position: absolute;
  z-index: 1;
  display: flex;
}
.rigle-lift-row--ready {
  transition: left 0.35s ease; /* aceeași tranziție ca .rigle-lift--ready, ca
    rândul de mere să gliseze sincron cu cutia liftului, nu decuplat. */
}
/* „Prea puțin"/„prea mult" — dreptunghi portocaliu clipitor, copil al .rigle-lift,
   poziționat analitic (nu măsurat) relativ la colțul liftului — vezi
   actualizeazaMismatch() în JS. Ascuns implicit (display none), afișat doar când
   lățimea coloanei ≠ totalMere. */
.rigle-lift-mismatch {
  position: absolute;
  display: none;
  background: #ff9800;
  border-radius: 4px;
  animation: rigle-blink 0.6s ease-in-out infinite;
  pointer-events: none;
}
@keyframes rigle-blink {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.rigle-apple {
  position: relative;
  width: var(--cell);
  height: var(--cell);
  display: grid;
  place-items: center;
  box-sizing: border-box;
}
.rigle-apple--rosu {
  background: #e23b3b;
}
.rigle-apple--albastru {
  background: #2f6fe0;
}
/* Halou neutru: disc deschis exact în spatele mărului, ca legibilitatea să nu
   depindă de culoarea fundalului (roșu/albastru sau altele, care se vor schimba). */
.rigle-apple::before {
  content: "";
  position: absolute;
  inset: 12%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(248, 248, 244, 0.96) 55%,
    rgba(248, 248, 244, 0) 74%
  );
}
.rigle-apple-emoji {
  position: relative;
  z-index: 1;
  font-size: calc(var(--cell) * 0.74);
  line-height: 1;
}
/* Grila de caiet = DOAR linii, strat de sus peste tot (paper, coloane, lift).
   background-image e setat din JS (applyGridLines), în funcție de vertical/orizontal. */
.rigle-grid {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
/* Numerotarea rândurilor (CP „Numerotează rânduri din coloane") — peste coloane,
   sub lift. Un .rigle-row per linie de grilă dintr-o coloană, cu 1..lățime cifre
   înăuntru; opacity/color se scriu pe .rigle-row (nu pe fiecare cifră), ca
   actualizarea din modul animat să fie ieftină. */
.rigle-row-numbers {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.rigle-row {
  position: absolute;
  display: flex;
  box-sizing: border-box;
}
.rigle-row-cell {
  flex: 1 0 0;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: calc(var(--cell) * 0.5);
  line-height: 1;
  color: inherit;
}
/* Butoanele m2 — look-ul copiat din motorul 1, dar complet self-contained
   (clasă proprie, valori hardcodate; nu depinde de .option / #options). */
/* Butoanele m2: fiecare are lățimea coloanei lui și stă exact peste ea
   (left/width setate din JS); poziționate absolut în bara de jos. */
.rigle-buttons {
  margin-top: auto;
  position: relative;
  width: 100%;
  height: clamp(126px, 25dvh, 252px);
  box-sizing: border-box;
  pointer-events: none;
}
.rigle-btn {
  pointer-events: auto;
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.7rem 0.4rem;
  border: 2px solid rgba(61, 156, 245, 0.55);
  border-radius: 10px;
  background: rgba(20, 28, 40, 0.16); /* mai transparent cu 60% fata de 0.4 */
  color: #e8eef5;
  cursor: pointer;
  box-sizing: border-box;
  font: inherit;
}
.rigle-btn:hover {
  border-color: #3d9cf5;
}
.rigle-btn-num {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}
/* „n e prea mic"/„n e prea mare"/„n e corect" — etichetă sub numărul butonului
   coloanei curente, cu același puls ca .rigle-lift-mismatch (același @keyframes
   rigle-blink). Ascunsă implicit; actualizeazaMismatch() o arată doar pe butonul
   coloanei curente când lățimea ei diferă de totalMere. Poziționare provizorie
   (§ „deocamdată" din cerere) — doar sub cifră, nu lângă dreptunghiul de lângă
   mere. Se strânge pe conținut (nu align-self: stretch) — reglajEticheta() din
   JS decide când/cât se lățește și unde se ancorează, vezi reglajTextSiDivuriPortocaliiSiVerzi().
   position: absolute — SCOASĂ din fluxul flex al .rigle-btn dinadins: dacă ar fi
   un al doilea element flex (cum era înainte), apariția ei ar recentra grupul
   „cifră+etichetă" și ar împinge cifra în sus, diferit de butoanele fără etichetă
   vizibilă — exact bug-ul „30 apare mai sus decât 35/40". Scoasă din flux, cifra
   rămâne mereu singurul element flex, deci la același nivel pe toate butoanele;
   reglajEticheta() îi calculează top-ul din poziția reală a cifrei (după ce a fost
   scoasă din flux), nu dintr-un gap fix. left:50%+transform centrează implicit;
   reglajEticheta le suprascrie doar la ancorarea stânga/dreapta (excepția 2). */
.rigle-btn-mismatch {
  display: none;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  background: #ff9800;
  color: #1a1400;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.15;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  white-space: nowrap;
  text-align: center;
  animation: rigle-blink 0.6s ease-in-out infinite;
}
.rigle-btn-mismatch--vizibil {
  display: block;
}
/* „n e corect" — aceeași etichetă/loc, dar verde și statică (fără puls), ca să nu
   se confunde vizual cu avertismentul portocaliu clipitor „prea mic"/„prea mare". */
.rigle-btn-mismatch--corect {
  background: #43a047;
  color: #eafbea;
  animation: none;
}
/* FOV Lift — pătrățel zburător de la coloana aterizată spre o casetă cu 2 rânduri
   lipită deasupra liftului (PLAN-fov-lift.md). Caseta + pătrățelul sunt copii ai
   .rigle-scene, nu ai .rigle-lift — poziția li se recalculează analitic din JS
   (actualizeazaPozitieFovLift/avanseazaFovLift), nu prin ancorare CSS la lift. */
.rigle-fov-lift {
  position: absolute;
  z-index: 4; /* peste .rigle-grid (3) și .rigle-lift (2) */
  display: none;
  box-sizing: border-box;
  background: #ffffff;
  border: 2px solid #3a4a63;
  border-radius: 8px;
  padding: 4px 8px;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
}
.rigle-fov-lift--vizibila {
  display: block;
}
.rigle-fov-lift-linie {
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.35;
  padding: 0.05rem 0.3rem;
  border-radius: 5px;
  background: #ff9800; /* implicit portocaliu — „prea mic"/„prea mare" */
  color: #1a1400;
  opacity: 0; /* NU display:none — porneșteFovLift() măsoară offsetTop/Left/Width/Height
    pe aceste elemente înainte să devină vizibile; display:none le-ar da 0. */
  transition: opacity 0.15s ease;
}
.rigle-fov-lift-linie--vizibila {
  opacity: 1;
}
.rigle-fov-lift-linie--corect {
  background: #43a047;
  color: #eafbea;
}
.rigle-fov-zburator {
  position: absolute;
  z-index: 5;
  display: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #43a047;
  color: #eafbea;
  font-size: 0.7rem;
  font-weight: 700;
  transform: translate(-50%, -50%); /* (left, top) = centrul pătrățelului, nu colțul */
  pointer-events: none;
}
.rigle-fov-zburator--vizibil {
  display: flex;
}
/* Coborâre glorioasă — la coloana corectă, după ce pătrățelul FOV Lift și-a terminat
   drumul (sau imediat, dacă „Pe lift" e oprit din CP), liftul coboară rapid până jos ȘI,
   simultan, un front de dreptunghiuri urcă în sus (CP „Dara glorioasă" — Lungime/Desime
   controlează cât de sus ajunge/cât de dese sunt). Fiecare „urmă" e un dreptunghi de
   mărimea liftului, culoare vie aleasă aleator, cu fundal semitransparent — creat/șters
   dinamic din JS (creeazaDaraGlorioasa), nu element reutilizat ca restul FOV Lift,
   fiindcă numărul de urme variază cu durata cadrului și cu bifele CP. */
.rigle-glorie-dara {
  position: absolute;
  z-index: 1; /* sub .rigle-lift (2) — se vede „în urmă", nu peste el */
  box-sizing: border-box;
  border-width: 3px;
  border-style: solid;
  border-radius: 8px;
  opacity: 1;
  transition: opacity 0.45s ease;
  pointer-events: none;
}
/* Butoanele de sus (≡/CP/⏸) — fundal semitransparent cât e m2 activ, ca scrisul
   să se vadă peste coloanele galbene. Scoped pe m2: nu atinge motorul 1. */
.rigle-active .butoane-sus .menu-toggle,
.rigle-active .butoane-sus .cp-toggle,
.rigle-active .butoane-sus .play-pause {
  background: rgba(20, 28, 40, 0.55);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
`;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const DEFAULTS = {
    // intrebare/grupe/latimiColoane: folosite doar dacă NU se dă `urmatorulFact`
    // (fallback pentru un mount fără generator — vezi factInitial mai jos).
    intrebare: "2+1=?",
    grupe: [
      { n: 2, fundal: "rosu" },
      { n: 1, fundal: "albastru" },
    ],
    obiect: "🍏",
    latimiColoane: [2, 3, 4],
    coloanaInitialaIndex: 1, // index-ul coloanei pe care pornește liftul (nu lățimea ei)
    vitezaCoborare: 34, // px/s (mică — copii de clasa 1)
    gridVertical: true, // linii verticale (implicit engine; quizul rezolvă din CP)
    gridOrizontal: true, // linii orizontale
    pozitieTreime: true, // true = fiecare coloană o treime din spațiu; false = proporțional
    urmatorulFact: null, // () => fact | null. null ⇒ factul nu se schimbă la wrap.
    numerotareRanduri: "dezactivat", // "dezactivat" | "toate" | "animat"
    randuriInSus: 10, // modul "animat": câte rânduri deasupra liftului rămân vizibile
    randuriInJos: 10, // modul "animat": câte rânduri sub lift rămân vizibile
    mereSubNumerotare: true, // true = rândul de mere sub numerotare (numerotarea îl acoperă,
    // implicit); false = deasupra (mere peste numerotare) — vezi setPozitieMere()
    mereTransparenta: 50, // 0 = culori opace, 100 = complet transparente — la fel ca liftFundalTransparenta
    liftFundalTransparenta: 50, // 0 = alb opac, 100 = complet transparent
    liftMargine: true, // false = marginea liftului devine transparentă (nu dispare din layout)
    fovButon: true, // eticheta „n e prea mic/mare/corect" de pe buton
    fovLift: true, // pătrățelul zburător + caseta de sub lift
    fovLiftAnimatieCorect: true, // continuarea spre „?" (doar la coloana corectă)
    fovLiftDivizorViteza: 1, // 1 = viteza actuală, 10 = de 10x mai încet (CP slider)
    daraLungime: 10, // 0-10; 10 = frontul de sus al dârei ajunge la marginea de sus a arenei
    daraDesime: 50, // 0-100; 100 = dreptunghiuri cadru lângă cadru (fără gol)
  };

  const LIFT_INSET = 6; // padding (4px) + border (2px) ale .rigle-lift — v. lift.style.width și .rigle-lift-row
  const LIFT_ROW_GAP = 4; // .rigle-lift { gap: 4px } — spațiul dintre qEl și fostul loc al rândului de mere
  const ETICHETA_GAP = 5; // px sub cifra butonului (~0.3rem, cât era gap-ul flex înainte) — v. reglajEticheta
  const GRID_LINE = "rgba(70, 120, 190, 0.28) 1px, transparent 1px";
  const NUMEROTARE_CULOARE_STATICA = "rgba(70, 120, 190, 0.65)"; // modul "toate rândurile"
  const NUMEROTARE_HUE_APROAPE = 205; // albastru, la rândul liftului
  const NUMEROTARE_HUE_DEPARTE = 320; // roz-magenta, la marginea ferestrei (modul "animat")

  // FOV Lift — v. PLAN-fov-lift.md §2.1 pt. derivarea pragurilor. Homing exponențial
  // spre o țintă în mișcare lasă o eroare staționară = viteza_țintei / λ — cu
  // vitezaCoborare=34px/s și λ implicit=10, eroarea e ~3,4px; pragul de sosire TREBUIE
  // să fie mai mare (altfel pătrățelul nu ajunge niciodată, secvența rămâne agățată
  // tăcut). CP „Viteza pătrățelului" (cfg.fovLiftDivizorViteza, 1-10) împarte DOAR λ —
  // FOV_DURATA_MAX_ETAPA rămâne fixă. Testat: scalarea duratei odată cu λ (varianta
  // inițială) ducea la ~15s/etapă la divizor=10 (eroarea staționară, 34px, depășește
  // oricum pragul la viteză mică, deci durata devine mecanismul normal de sosire, nu
  // doar rezerva) — mult peste ce înseamnă intuitiv „10x mai încet". Cu durata fixă,
  // fiecare etapă durează cel mult 1,5s la orice viteză — vizibil mai lent, dar mărginit.
  const FOV_LAMBDA = 10; // rata de homing implicită, 1/s — la divizor=1 (CP „viteza actuală")
  const FOV_PRAG_SOSIRE = 8; // px — precizie de „a ajuns", nu depinde de viteză
  const FOV_DURATA_MAX_ETAPA = 1.5; // s — plasă de siguranță, fixă, nu se scalează cu viteza

  // Coborâre glorioasă — la coloana corectă, după ce cursa FOV Lift s-a terminat (sau
  // imediat, dacă „Pe lift" e oprit). Durata fixă (nu viteză constantă): liftul parcurge
  // orice distanță rămasă până jos, exact în COBORARE_GLORIOASA_DURATA secunde — ȘI, în
  // aceeași durată, frontul de sus al dârei urcă spre ținta lui (CP „Lungime").
  const COBORARE_GLORIOASA_DURATA = 0.8; // s
  const DARA_FADE_MS = 450; // ms — cât ține stingerea unei urme (CSS transition opacity)
  const GLORIE_CULORI = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#00acc1", "#d81b60"];

  function mount(hosts, config) {
    const arenaEl = hosts && hosts.arenaEl;
    const optionsEl = hosts && hosts.optionsEl;
    if (!arenaEl || !optionsEl) {
      throw new Error("RigleEngine.mount: lipsesc arenaEl / optionsEl");
    }
    const gameEl = (hosts && hosts.gameEl) || document.getElementById("game");
    const cfg = Object.assign({}, DEFAULTS, config || {});
    injectStyles();
    if (gameEl) gameEl.classList.add("rigle-active");

    let totalMere = cfg.grupe.reduce((sum, g) => sum + g.n, 0); // recalculat la fiecare fact
    const butoaneLayer = optionsEl.parentElement; // #div-strat-butoane

    // ── Suprimă shell-ul m1 din arenă (scenă + slot butoane + bară fixă). ──
    // m1 nu există cât timp m2 e activ; restaurăm exact la destroy.
    const restoreList = [];
    const hideEl = (el) => {
      if (!el) return;
      restoreList.push({ el, prev: el.style.display });
      el.style.display = "none";
    };
    [...arenaEl.children].forEach(hideEl);
    hideEl(optionsEl);
    hideEl(document.getElementById("lift-fixed-host"));

    // ── Scena m2: structura fixă se creează o dată aici (paper → coloane → lift →
    // grilă). Conținutul variabil (întrebare, mere, lățimi coloane, butoane) vine
    // din randeazaFact(), apelată la mount și la fiecare fact nou. ──
    const scene = document.createElement("div");
    scene.className = "rigle-scene";

    const columnsWrap = document.createElement("div");
    columnsWrap.className = "rigle-columns";

    const rowNumbersWrap = document.createElement("div");
    rowNumbersWrap.className = "rigle-row-numbers";

    const lift = document.createElement("div");
    lift.className = "rigle-lift";
    const qEl = document.createElement("div");
    qEl.className = "rigle-lift-q";
    // rowEl (rândul de mere) NU e copil al lift — vezi comentariul CSS de la
    // .rigle-lift-row pentru de ce (context de stivuire). E frate al lui lift în
    // scene, poziționat independent din JS.
    const rowEl = document.createElement("div");
    rowEl.className = "rigle-lift-row";
    const mismatchEl = document.createElement("div");
    mismatchEl.className = "rigle-lift-mismatch";
    lift.append(qEl, mismatchEl);

    const gridEl = document.createElement("div");
    gridEl.className = "rigle-grid";

    // FOV Lift — create o dată la mount, ca restul scenei; conținutul/poziția li se
    // schimbă din JS (porneșteFovLift/actualizeazaPozitieFovLift), nu se recreează.
    const fovLiftEl = document.createElement("div");
    fovLiftEl.className = "rigle-fov-lift";
    const fovLinie1El = document.createElement("div");
    fovLinie1El.className = "rigle-fov-lift-linie";
    const fovLinie2El = document.createElement("div");
    fovLinie2El.className = "rigle-fov-lift-linie";
    fovLiftEl.append(fovLinie1El, fovLinie2El);
    const fovZburatorEl = document.createElement("div");
    fovZburatorEl.className = "rigle-fov-zburator";

    // rowEl ÎNAINTEA lui rowNumbersWrap — la z-index egal (1), DOM mai târziu
    // câștigă, deci numerotarea (rowNumbersWrap) picta deasupra rândului de mere.
    scene.append(columnsWrap, rowEl, rowNumbersWrap, lift, gridEl, fovLiftEl, fovZburatorEl);
    arenaEl.appendChild(scene);

    // ── Bara de butoane proprie a m2, în stratul de butoane (peste scenă). ──
    const buttonsBar = document.createElement("div");
    buttonsBar.className = "rigle-buttons";
    butoaneLayer.appendChild(buttonsBar);

    // ── Geometrie + stare ──
    let cell = 32;
    let colX = [];
    let mismatchMinH = 0; // prag minim înălțime pt. bara portocalie „coloană mai îngustă" — vezi computeGeometry()
    let liftH = 0; // înălțimea liftului, calculată doar în computeGeometry() — actualizeazaNumerotareAnimata()
    // (rulează per frame, în tick()) o citește de aici, NU din lift.offsetHeight: o citire de layout
    // după fiecare scriere de lift.style.top ar forța recalcul de layout la 60fps.
    let liftW = 0; // lățimea liftului, cache-uită în reglajLift() — la fel ca liftH, ca
    // actualizeazaPozitieFovLift() (rulează per frame) să nu citească lift.offsetWidth.
    let rowOffsetTop = 0; // distanța verticală constantă lift.top → rowEl.top (rândul de
    // mere, acum frate independent al lui lift, nu copil) — recalculată doar în
    // computeGeometry() (depinde de qEl.offsetHeight, care nu se schimbă per cadru,
    // doar la fact nou/resize), citită fără remăsurare în tick()/coborârea glorioasă.
    let travel = 1;
    let colEls = [];
    let myButtons = [];
    let rowEls = []; // rowEls[coloană][rând] = elementul .rigle-row (numerotare)
    let necunoscutaEl = null; // span-ul „?" din întrebare — recreat la fiecare fact (randeazaFact)
    let paused = false;
    const playPauseBtn = document.getElementById("play-pause");
    let colIndex = cfg.coloanaInitialaIndex;
    if (colIndex < 0 || colIndex >= cfg.latimiColoane.length) {
      colIndex = Math.floor(cfg.latimiColoane.length / 2);
    }
    let y = 0; // 0..travel (top-ul liftului, de la marginea de sus a arenei)

    // ── FOV Lift: pătrățel zburător de la coloana aterizată spre caseta de sub lift,
    // apoi (la corect, dacă bifa e activă) spre „?" din întrebare. PLAN-fov-lift.md.
    // Homing analitic per cadru, nu tranziții CSS către un punct fix — ținta se mișcă
    // (liftul cade continuu + glisează orizontal la schimbarea coloanei). ──
    let fovActiv = false; // e o cursă (pătrățel zburând) în desfășurare acum
    let fovVizibil = false; // caseta + span-urile rămase afișate din ultima apăsare
    // (chiar după ce cursa curentă s-a terminat — persistă până la fact nou/bifă oprită)
    let fovEtapa = 0; // 0 = spre span1, 1 = spre span2, 2 = spre „?"
    let fovTimpEtapa = 0; // secunde de când a pornit etapa curentă (plasă de siguranță)
    let fovPozX = 0;
    let fovPozY = 0; // poziția curentă a pătrățelului zburător (coordonate „scenă")
    let fovTip = null; // "mic" | "mare" | "corect" — decide culoarea și dacă merge la etapa 2
    let fovBoxW = 0;
    let fovBoxH = 0; // dimensiunile casetei FOV Lift, măsurate o dată la pornirea cursei
    let fovSpan1Off = null; // { left, top, width, height } — poziția span1 relativ la casetă
    let fovSpan2Off = null;
    let fovNecunoscutaOff = null; // { left, top, width, height } — poziția „?" relativ la lift
    let fovLiftTop = 0; // = Math.min(y, travel), cache-uit o dată per cadru pt. țintele FOV
    let fovBoxTop = 0;
    let fovBoxLeft = 0; // poziția curentă a casetei (coordonate „scenă"), recalculată per cadru
    let fovRulareId = 0; // token — o cursă veche întârziată nu mai scrie stare după ce a pornit alta

    // ── Coborâre glorioasă: la coloana corectă, liftul coboară rapid până jos (0,8s) ȘI,
    // simultan, un front de dreptunghiuri urcă în sus — două fluxuri, aceeași durată,
    // direcții opuse. Înlocuiește incrementul normal de `y` din tick() cât timp e activă
    // (vezi avanseazaCoborareaGlorioasa). Spawn-ul e legat de DISTANȚA parcursă de
    // fiecare front (CP „Desime"), nu de un interval de timp fix — așa „Desime" chiar
    // înseamnă „cadru lângă cadru", indiferent cât de departe ajunge frontul. ──
    let coborareGlorioasaActiva = false;
    let coborareGlorioasaTimp = 0; // secunde de la pornire
    let coborareGlorioasaYStart = 0; // y-ul liftului în momentul pornirii
    let coborareGlorioasaYTintaSus = 0; // ținta frontului de sus (din CP „Lungime")
    let coborareGlorioasaVitezaJos = 0; // px/s — constantă pe durata cursei (liniar)
    let coborareGlorioasaVitezaSus = 0; // px/s — la fel, pt. frontul de sus
    let coborareGlorioasaDistJos = 0; // px acumulați de la ultima urmă (front jos = lift)
    let coborareGlorioasaDistSus = 0; // px acumulați de la ultima urmă (front sus)

    // Randare completă a conținutului variabil dintr-un fact (UI = f(state), fără
    // update parțial): întrebarea, rândul de mere, coloanele, butoanele, apoi
    // geometria. Ordinea contează — computeGeometry() citește lift.offsetHeight,
    // deci conținutul liftului trebuie deja în DOM.
    function randeazaFact(fact) {
      cfg.intrebare = fact.intrebare;
      cfg.grupe = fact.grupe;
      cfg.latimiColoane = fact.latimiColoane;
      totalMere = cfg.grupe.reduce((sum, g) => sum + g.n, 0);

      // 0. FOV Lift: fact nou = stare complet nouă (idempotență) — nicio cursă veche
      // supraviețuiește (vezi razgandire-ieftina.md §5). necunoscutaEl e recreat mai jos,
      // fără .rigle-lift-raspuns agățată de la factul anterior.
      fovRulareId += 1;
      fovActiv = false;
      fovVizibil = false;
      fovLiftEl.classList.remove("rigle-fov-lift--vizibila");
      fovZburatorEl.classList.remove("rigle-fov-zburator--vizibil");
      // Reset defensiv: normal, coborareGlorioasaActiva se închide singură chiar înainte
      // de faNouFact() (vezi avanseazaCoborareaGlorioasa); dar CP „Suma maximă" poate
      // apela reporneste() → faNouFact() direct, ocolind acea cale — fără reset aici,
      // flagul ar rămâne agățat pe true și ar bloca butoanele permanent.
      coborareGlorioasaActiva = false;

      // 1. întrebarea — „a+b=" ca text simplu + span dedicat pt. „?" (v. comentariul CSS
      // de la .rigle-lift-raspuns).
      qEl.replaceChildren();
      qEl.append(document.createTextNode(cfg.intrebare.replace(/\?$/, "")));
      necunoscutaEl = document.createElement("span");
      necunoscutaEl.className = "rigle-lift-necunoscuta";
      necunoscutaEl.textContent = "?";
      qEl.appendChild(necunoscutaEl);

      // 2. rândul de mere
      rowEl.replaceChildren();
      cfg.grupe.forEach((g) => {
        for (let i = 0; i < g.n; i++) {
          const cellEl = document.createElement("div");
          cellEl.className = `rigle-apple rigle-apple--${g.fundal}`;
          const emoji = document.createElement("span");
          emoji.className = "rigle-apple-emoji";
          emoji.textContent = cfg.obiect;
          cellEl.appendChild(emoji);
          rowEl.appendChild(cellEl);
        }
      });

      // 3. coloanele
      columnsWrap.replaceChildren();
      colEls = cfg.latimiColoane.map((w) => {
        const col = document.createElement("div");
        col.className = "rigle-col";
        col.dataset.w = String(w);
        columnsWrap.appendChild(col);
        return col;
      });

      // 4. butoanele — lățimea + poziția reală vin din computeGeometry() (pasul 5).
      buttonsBar.replaceChildren();
      myButtons = cfg.latimiColoane.map((w, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rigle-btn";
        const num = document.createElement("span");
        num.className = "rigle-btn-num";
        num.textContent = String(w);
        btn.appendChild(num);
        const mismatchLabel = document.createElement("span");
        mismatchLabel.className = "rigle-btn-mismatch";
        btn.appendChild(mismatchLabel);
        btn.addEventListener("click", () => selectColumn(idx));
        buttonsBar.appendChild(btn);
        return btn;
      });

      if (colIndex >= colEls.length) colIndex = Math.floor(colEls.length / 2);

      // 5. geometria
      computeGeometry();
    }

    function computeGeometry() {
      const arenaRect = arenaEl.getBoundingClientRect();
      const W = arenaRect.width || 360;
      const H = arenaRect.height || 720;
      // Coloanele și traseul liftului merg de la marginea de sus la cea de jos a
      // #arena (curg pe sub bara de sus și pe sub butoane).
      let margin = 0;

      if (cfg.pozitieTreime) {
        // Fiecare coloană = 1/N din lățimea arenei. `cellsPerThird` = nr. de celule
        // cât să încapă mereu, în orice treime, ȘI coloana ei ȘI liftul (bloc rigid,
        // poate fi mai lat decât coloana îngustă pe care stă parcat — „prea mult"
        // vizual din SPEC). `cell` derivă din asta, deci colX cade mereu pe multipli
        // exacți de `cell` — marginile coloanei coincid cu liniile grilei.
        const n = cfg.latimiColoane.length;
        const thirdW = W / n;
        const cellsPerThird = Math.max(Math.max(...cfg.latimiColoane), totalMere);
        cell = Math.max(1, Math.floor(thirdW / cellsPerThird));
        colX = cfg.latimiColoane.map((_, i) => i * cellsPerThird * cell);
      } else {
        const sumW = cfg.latimiColoane.reduce((s, w) => s + w, 0);
        const nGaps = Math.max(0, cfg.latimiColoane.length - 1);
        cell = Math.max(1, Math.floor(W / (sumW + nGaps + 1)));
        const gap = cell;
        const used = sumW * cell + nGaps * gap;
        margin = Math.max(0, Math.round((W - used) / 2));

        colX = [];
        let x = margin;
        cfg.latimiColoane.forEach((w) => {
          colX.push(x);
          x += w * cell + gap;
        });
      }

      // Prag minim pt. bara „coloană mai îngustă" din actualizeazaMismatch(): la sume
      // mari `cell` poate ajunge la 1-3px (vezi RIGLE-REFERENCE §5) și bara devine
      // practic invizibilă. Pragul = cât ar fi lățimea unei celule „în treime" la suma
      // de referință 5, aceeași pe pc și pe telefon — se adaptează singur la lățimea
      // arenei curente (mai mare pe ecran lat, mai mic pe telefon), fără prag separat.
      const SUMA_REFERINTA_MIN_H = 5;
      mismatchMinH = Math.max(1, Math.floor(W / cfg.latimiColoane.length / SUMA_REFERINTA_MIN_H));

      scene.style.setProperty("--cell", `${cell}px`);
      gridEl.style.backgroundSize = `${cell}px ${cell}px`;
      gridEl.style.backgroundPosition = `${margin}px 0px`;
      applyGridLines();

      colEls.forEach((el, i) => {
        el.style.left = `${colX[i]}px`;
        el.style.top = "0px";
        el.style.width = `${cfg.latimiColoane[i] * cell}px`;
        el.style.height = `${H}px`;
      });

      // Butoanele: lățimea coloanei lor, exact peste coloană.
      myButtons.forEach((btn, i) => {
        btn.style.left = `${colX[i]}px`;
        btn.style.width = `${cfg.latimiColoane[i] * cell}px`;
      });

      liftH = lift.offsetHeight || cell * 2.4;
      travel = Math.max(1, H - liftH);

      lift.style.left = `${colX[colIndex]}px`;
      lift.style.top = `${Math.min(y, travel)}px`;

      // rowEl urmează lift — qEl are text final (randeazaFact rulează înaintea lui
      // computeGeometry), deci qEl.offsetHeight e stabil aici. Calculat ÎNAINTE de
      // reglajTextSiDivuriPortocaliiSiVerzi(), fiindcă actualizeazaMismatch() (chemată
      // din ea) are nevoie de rowOffsetTop deja proaspăt.
      rowOffsetTop = LIFT_INSET + qEl.offsetHeight + LIFT_ROW_GAP;
      rowEl.style.left = `${colX[colIndex]}px`;
      rowEl.style.top = `${Math.min(y, travel) + rowOffsetTop}px`;

      randeazaNumerotare(H);
      reglajTextSiDivuriPortocaliiSiVerzi();
    }

    // ── Reglaj text/cutii — un singur loc pentru „încape textul în cutia lui?" ──
    // Apelat înainte de a considera randarea geometriei încheiată (din
    // computeGeometry, după ce lift/butoane/coloane au deja poziția și lățimea
    // finală a cadrului curent). Fiecare context de mai jos e independent: regulă
    // normală + excepții în cascadă, în ordinea în care se pot evalua (fiecare
    // excepție se verifică DUPĂ ce s-a aplicat remediul excepției anterioare —
    // nu sunt condiții pe starea inițială, ci pași succesivi).
    function reglajTextSiDivuriPortocaliiSiVerzi() {
      reglajLift(); // C1: cutia liftului vs. textul întrebării
      actualizeazaMismatch(); // C2: dreptunghiul de lângă mere + eticheta de sub buton (reglajEticheta)
    }

    // C1 — cutia liftului vs. textul întrebării „x+y=?".
    // Normal: „x+y=?" încape în lățimea rândului de mere.
    // Excepție: dacă nu încape, LĂȚEȘTE cutia liftului (spre dreapta — vezi
    // ancorarea .rigle-lift-row, altfel merele s-ar deplasa) ca să cuprindă textul.
    // Merele și fontul întrebării (19px, fix — gotcha #7) NU se ating, doar cutia.
    function reglajLift() {
      const latimeMere = totalMere * cell;
      const latimeText = qEl.scrollWidth + LIFT_INSET * 2; // scrollWidth = lățimea naturală (align-items: center, fără width propriu)
      liftW = Math.max(latimeMere, latimeText);
      lift.style.width = `${liftW}px`;
    }

    // C2 — eticheta portocalie/verde de sub cifra butonului, vs. lățimea coloanei
    // galbene (== lățimea butonului, vezi myButtons.forEach mai sus).
    // Normal: textul încape necomprimat, eticheta stă centrată pe coloană.
    // Excepție 1: dacă nu încape, word-wrap pe lățimea coloanei.
    // Excepție 2: dacă nici cu word-wrap cel mai lat rând nu încape, LĂȚEȘTE
    // eticheta exact cât cere acel rând (nu un cuvânt anume — oricare ar fi cel
    // mai lat) și o ancorează la marginea coloanei dinspre centrul arenei (stânga
    // pt. coloana din stânga, dreapta pt. cea din dreapta), trecând peste padding-ul
    // butonului — ca eticheta să nu iasă din arenă. Coloana din centru rămâne
    // centrată (se revarsă simetric, tot în arenă). Textul din interiorul etichetei
    // e mereu centrat (text-align: center, în CSS).
    // `top` se calculează din poziția reală a cifrei (numEl), NU dintr-un gap fix —
    // eticheta e position:absolute (CSS), deci cifra e mereu singurul element flex
    // din buton și stă la același nivel pe toate cele 3 butoane, indiferent dacă
    // eticheta e vizibilă sau nu (vezi comentariul din CSS, .rigle-btn-mismatch).
    function reglajEticheta(label, btn, coloanaWidth, pozitie) {
      const numEl = btn.querySelector(".rigle-btn-num");
      label.style.left = ""; // revine la CSS: left:50% + transform (centrat)
      label.style.right = "";
      label.style.transform = "";
      label.style.width = "";
      label.style.whiteSpace = "nowrap";
      label.style.top = `${numEl.offsetTop + numEl.offsetHeight + ETICHETA_GAP}px`;
      if (label.scrollWidth <= coloanaWidth) return; // normal

      label.style.whiteSpace = "normal"; // excepția 1: word-wrap
      label.style.width = `${coloanaWidth}px`;
      if (label.scrollWidth <= coloanaWidth) return;

      label.style.width = `${label.scrollWidth}px`; // excepția 2: lățește pe cel mai lat rând
      if (pozitie === "centru") return; // rămâne centrată (CSS), se revarsă simetric

      // position:absolute se măsoară de la cutia de padding a butonului (containing
      // block), deci padding-ul e deja „trecut peste" automat — mai rămâne doar
      // border-ul de compensat ca să ajungă la marginea reală (border-box) a
      // coloanei. (Dacă aș scădea și padding-ul, aș ieși cu atât mai mult din buton.)
      const btnStyle = getComputedStyle(btn);
      label.style.transform = "none"; // anulează translateX(-50%) din CSS
      if (pozitie === "stanga") {
        label.style.left = `${-parseFloat(btnStyle.borderLeftWidth)}px`;
      } else {
        label.style.left = "auto"; // anulează left:50% din CSS, ca right să decidă singur
        label.style.right = `${-parseFloat(btnStyle.borderRightWidth)}px`;
      }
    }

    // Eticheta „n e prea mic"/„n e prea mare"/„n e corect" (n = cifra butonului) —
    // doar pe butonul coloanei curente (colIndex), curățată de pe toate celelalte
    // la fiecare apel, ca să nu rămână agățată pe butonul coloanei părăsite.
    // Gated de cfg.fovButon (CP „Etichete FOV" — „Pe buton") — dezactivată, se
    // comportă ca și cum tip ar fi mereu null (curăță, nu afișează nimic).
    function actualizeazaEtichetaButon(tip) {
      myButtons.forEach((btn, i) => {
        const label = btn.querySelector(".rigle-btn-mismatch");
        if (!label) return;
        if (cfg.fovButon && i === colIndex && tip) {
          const n = cfg.latimiColoane[i];
          const esteCorect = tip === "corect";
          label.textContent = esteCorect ? `${n} e corect` : `${n} e prea ${tip}`;
          label.classList.add("rigle-btn-mismatch--vizibil");
          label.classList.toggle("rigle-btn-mismatch--corect", esteCorect);
          const pozitie = i === 0 ? "stanga" : i === myButtons.length - 1 ? "dreapta" : "centru";
          reglajEticheta(label, btn, btn.getBoundingClientRect().width, pozitie);
        } else {
          label.textContent = "";
          label.classList.remove("rigle-btn-mismatch--vizibil", "rigle-btn-mismatch--corect");
          label.style.left = "";
          label.style.right = "";
          label.style.transform = "";
          label.style.top = "";
          label.style.width = "";
        }
      });
    }

    // Text pt. caseta FOV Lift — pur, zero DOM. linie1 are aceeași formă ca în
    // actualizeazaEtichetaButon (nu extras în comun: acolo `tip` vine gata decis de
    // apelant, aici trebuie decis intern pt. orice idx — ar complica ambele fluxuri
    // pt. un câștig de 3 linii, AGENTS.md 9a).
    function calculeazaTextFov(idx) {
      const n = cfg.latimiColoane[idx];
      const corect = n === totalMere;
      const tip = corect ? "corect" : n < totalMere ? "mic" : "mare";
      const linie1 = corect ? `${n} e corect` : `${n} e prea ${tip}`;
      const expresie = cfg.intrebare.replace(/=\?$/, "");
      const semn = corect ? "=" : n < totalMere ? "<" : ">";
      const linie2 = `${n}${semn}${expresie}`;
      return { tip, linie1, linie2 };
    }

    // Repoziționează caseta FOV Lift analitic, din poziția curentă a liftului — apelată
    // în fiecare cadru cât fovVizibil (nu doar cât zboară pătrățelul), ca să urmărească
    // liftul din prima clipă („caseta urmărește liftul din start"). Fără nicio citire
    // DOM: colX/y/travel/liftW/liftH sunt deja cunoscute (liftW la fel ca liftH — Pasul 0).
    // Cache-uiește fovLiftTop/fovBoxTop/fovBoxLeft, refolosite de tintaFovEtapa() ca să
    // nu recalculeze aceeași poziție de două ori pe cadru.
    function actualizeazaPozitieFovLift() {
      fovLiftTop = Math.min(y, travel);
      // Marginea de sus a scenei taie caseta (overflow:hidden) dacă liftul e prea sus
      // (mereu cazul imediat după fact nou, y=0) — rămâne lipită de sus, suprapusă
      // parțial peste lift, în loc să dispară complet tăiată.
      fovBoxTop = Math.max(0, fovLiftTop - fovBoxH);
      const centruLift = colX[colIndex] + liftW / 2;
      fovBoxLeft = centruLift - fovBoxW / 2;
      fovLiftEl.style.top = `${fovBoxTop}px`;
      fovLiftEl.style.left = `${fovBoxLeft}px`;
    }

    // Pornește (sau repornește) cursa FOV Lift pt. coloana curentă — la FIECARE
    // apăsare de buton, corect sau greșit, mutare reală sau re-apăsare pe coloana
    // curentă. Pregătește totul o singură dată (text, dimensiuni, offset-uri); mișcarea
    // propriu-zisă se calculează per cadru, în avanseazaFovLift().
    function porneșteFovLift() {
      if (!cfg.fovLift) return;
      fovRulareId += 1;

      const { tip, linie1, linie2 } = calculeazaTextFov(colIndex);
      fovTip = tip;
      fovLinie1El.textContent = linie1;
      fovLinie2El.textContent = linie2;
      fovLinie1El.classList.remove("rigle-fov-lift-linie--vizibila");
      fovLinie2El.classList.remove("rigle-fov-lift-linie--vizibila");
      fovLinie1El.classList.toggle("rigle-fov-lift-linie--corect", tip === "corect");
      fovLinie2El.classList.toggle("rigle-fov-lift-linie--corect", tip === "corect");
      fovLiftEl.classList.add("rigle-fov-lift--vizibila");
      fovVizibil = true;

      // Dimensiuni + offset-uri — măsurate O SINGURĂ DATĂ acum, nu per cadru (Pasul 0).
      fovBoxW = fovLiftEl.offsetWidth;
      fovBoxH = fovLiftEl.offsetHeight;
      fovSpan1Off = {
        left: fovLinie1El.offsetLeft,
        top: fovLinie1El.offsetTop,
        width: fovLinie1El.offsetWidth,
        height: fovLinie1El.offsetHeight,
      };
      fovSpan2Off = {
        left: fovLinie2El.offsetLeft,
        top: fovLinie2El.offsetTop,
        width: fovLinie2El.offsetWidth,
        height: fovLinie2El.offsetHeight,
      };
      fovNecunoscutaOff = necunoscutaEl
        ? {
            left: necunoscutaEl.offsetLeft,
            top: necunoscutaEl.offsetTop,
            width: necunoscutaEl.offsetWidth,
            height: necunoscutaEl.offsetHeight,
          }
        : null;

      actualizeazaPozitieFovLift(); // poziționează imediat caseta, nu aștepta cadrul următor

      // Start: centrul celulei a N-a din coloana aterizată, la rândul curent al
      // liftului — analitic, independent de bifa „Numerotează rânduri" (nu citește
      // DOM din grilă; formula pt. rând e ca `pozitieReper`, fără „+1"-ul de acolo).
      const n = cfg.latimiColoane[colIndex];
      fovPozX = colX[colIndex] + (n - 0.5) * cell;
      const randCurent = Math.round((y + liftH) / cell);
      fovPozY = randCurent * cell + cell / 2;
      fovZburatorEl.textContent = String(n);
      fovZburatorEl.classList.add("rigle-fov-zburator--vizibil");
      fovZburatorEl.style.left = `${fovPozX}px`;
      fovZburatorEl.style.top = `${fovPozY}px`;

      fovEtapa = 0;
      fovTimpEtapa = 0;
      fovActiv = true;
    }

    // Ținta curentă a pătrățelului zburător — folosește fovBoxTop/fovBoxLeft/fovLiftTop,
    // deja cache-uite de actualizeazaPozitieFovLift() în cadrul curent (zero citire DOM).
    function tintaFovEtapa() {
      if (fovEtapa === 0) {
        return {
          x: fovBoxLeft + fovSpan1Off.left + fovSpan1Off.width / 2,
          y: fovBoxTop + fovSpan1Off.top + fovSpan1Off.height / 2,
        };
      }
      if (fovEtapa === 1) {
        return {
          x: fovBoxLeft + fovSpan2Off.left + fovSpan2Off.width / 2,
          y: fovBoxTop + fovSpan2Off.top + fovSpan2Off.height / 2,
        };
      }
      // etapa 2: spre „?" din întrebare — orizontal, colX[colIndex] (poziția finală a
      // liftului, nu cea din glisarea în curs — zborul durează mai mult decât cele
      // 0,35s de glisare, deci ținta finală e mereu cea corectă, vezi PLAN §3).
      if (!fovNecunoscutaOff) return { x: fovPozX, y: fovPozY };
      return {
        x: colX[colIndex] + fovNecunoscutaOff.left + fovNecunoscutaOff.width / 2,
        y: fovLiftTop + fovNecunoscutaOff.top + fovNecunoscutaOff.height / 2,
      };
    }

    // Avansează cursa FOV Lift cu un cadru — apelată din tick(), doar cât fovActiv.
    // Homing exponențial (frame-rate independent), NU tranziție CSS către un punct fix:
    // ținta se mișcă (liftul cade continuu), deci se re-țintește în fiecare cadru.
    // Pragul de sosire + durata maximă per etapă sunt ambele necesare — homing-ul spre o
    // țintă mobilă lasă o eroare staționară (viteza_țintei / FOV_LAMBDA); fără prag mai
    // mare decât eroarea aia, sau fără plasa de siguranță a duratei, cursa s-ar putea
    // bloca tăcut la o etapă (PLAN-fov-lift.md §2.1).
    function avanseazaFovLift(dt) {
      // CP „Viteza pătrățelului": divizor 1 = viteza implicită (λ=FOV_LAMBDA), divizor
      // 10 = 10x mai încet. Durata maximă NU se scalează (rămâne FOV_DURATA_MAX_ETAPA
      // fix) — măsurat: scalarea ei la fel ca λ ducea la ~15s/etapă (45s pt. o cursă
      // completă la coloana corectă), mult peste ce înseamnă intuitiv „10x mai încet".
      // La viteză mică, eroarea staționară oricum depășește pragul de sosire (vezi
      // comentariul de la constante), deci durata fixă devine mecanismul normal de
      // avans — fiecare etapă durează ~1,5s (nu 250ms ca la viteza implicită), vizibil
      // mai lent, dar mărginit, nu o așteptare de zeci de secunde.
      const divizor = Math.max(1, Math.min(10, cfg.fovLiftDivizorViteza || 1));
      const lambdaEfectiv = FOV_LAMBDA / divizor;

      const tinta = tintaFovEtapa();
      const factor = 1 - Math.exp(-lambdaEfectiv * dt);
      fovPozX += (tinta.x - fovPozX) * factor;
      fovPozY += (tinta.y - fovPozY) * factor;
      fovZburatorEl.style.left = `${fovPozX}px`;
      fovZburatorEl.style.top = `${fovPozY}px`;

      fovTimpEtapa += dt;
      const distanta = Math.hypot(tinta.x - fovPozX, tinta.y - fovPozY);
      if (distanta > FOV_PRAG_SOSIRE && fovTimpEtapa < FOV_DURATA_MAX_ETAPA) return;

      // sosire (sau plasa de siguranță): snap exact pe țintă, aplică efectul etapei,
      // avansează. Idempotent — următorul cadru pornește curat de la fovTimpEtapa=0.
      fovPozX = tinta.x;
      fovPozY = tinta.y;
      fovZburatorEl.style.left = `${fovPozX}px`;
      fovZburatorEl.style.top = `${fovPozY}px`;
      fovTimpEtapa = 0;

      if (fovEtapa === 0) {
        fovLinie1El.classList.add("rigle-fov-lift-linie--vizibila");
        fovEtapa = 1;
      } else if (fovEtapa === 1) {
        fovLinie2El.classList.add("rigle-fov-lift-linie--vizibila");
        if (fovTip === "corect" && cfg.fovLiftAnimatieCorect) {
          fovEtapa = 2;
        } else {
          terminaFovLift();
          if (fovTip === "corect") porneșteCoborareaGlorioasa();
        }
      } else {
        dezvaluieRaspuns();
        terminaFovLift();
        porneșteCoborareaGlorioasa(); // etapa 2 se atinge doar când fovTip === "corect"
      }
    }

    // Termină cursa curentă: ascunde pătrățelul zburător. Caseta + span-urile rămân
    // afișate (persistență — cf. cerinței: „rămâne dezvăluit până la fact nou").
    function terminaFovLift() {
      fovActiv = false;
      fovZburatorEl.classList.remove("rigle-fov-zburator--vizibil");
    }

    // Înlocuiește „?" cu suma corectă, într-un div verde care pulsează CONTINUU (nu o
    // singură dată — cerință explicită, spre deosebire de eticheta „corect" de pe
    // buton). Idempotent: dacă era deja dezvăluit (re-apăsare pe coloana corectă după
    // ce răspunsul se vede deja), nu ascunde/reface nimic — puls-ul continuu oricum
    // rulează deja, nu are ce să „re-pulseze".
    function dezvaluieRaspuns() {
      if (!necunoscutaEl || necunoscutaEl.classList.contains("rigle-lift-raspuns")) return;
      necunoscutaEl.textContent = String(totalMere);
      necunoscutaEl.classList.add("rigle-lift-raspuns");
    }

    // O urmă a dârei — dreptunghi de mărimea liftului, la poziția topPx dată, culoare
    // vie aleasă aleator (fundal semitransparent + margine plină aceeași culoare), care
    // se stinge singură (CSS transition) și se scoate din DOM. Creată/ștearsă dinamic
    // (nu element reutilizat, ca fovZburatorEl) — numărul de urme dintr-o cursă variază
    // cu CP „Desime" și cu durata reală a cadrelor.
    function creeazaDaraGlorioasa(topPx) {
      const dara = document.createElement("div");
      dara.className = "rigle-glorie-dara";
      const culoare = GLORIE_CULORI[Math.floor(Math.random() * GLORIE_CULORI.length)];
      dara.style.left = `${colX[colIndex]}px`;
      dara.style.top = `${topPx}px`;
      dara.style.width = `${liftW}px`;
      dara.style.height = `${liftH}px`;
      dara.style.borderColor = culoare;
      dara.style.background = `${culoare}55`; // hex+alfa (~33%) — fundal semitransparent, nu doar contur
      scene.appendChild(dara);
      requestAnimationFrame(() => {
        dara.style.opacity = "0"; // pornește tranziția CSS abia după primul layout (altfel nu se vede stingerea)
      });
      setTimeout(() => dara.remove(), DARA_FADE_MS + 60);
    }

    // Pornește coborârea glorioasă — la coloana corectă, după ce pătrățelul FOV Lift și-a
    // terminat drumul (sau imediat, dacă „Pe lift" e oprit din CP: fără cursă FOV, nimic
    // de așteptat). Butoanele se blochează (ca la pauză, dar fără suprapunerea „PAUZĂ" —
    // e un moment de tranziție spre factul următor, nu o pauză cerută de utilizator).
    // Idempotent: o cursă deja activă nu repornește (butoanele oricum sunt deja blocate,
    // deci re-apelarea ar necesita altă cale decât interacțiunea normală).
    //
    // Calculează vitezele (px/s) ale celor două fronturi — liniare, constante pe durata
    // cursei, deci avanseazaCoborareaGlorioasa() nu are nevoie să rețină poziția
    // cadrului anterior ca să afle cât s-a deplasat fiecare front. CP „Lungime" (0-10)
    // decide ținta frontului de sus: 10 = marginea de sus a arenei (y=0), 0 = nu se
    // mișcă deloc (rămâne la y-ul de pornire, deci nu creează nicio urmă).
    function porneșteCoborareaGlorioasa() {
      if (coborareGlorioasaActiva) return;
      coborareGlorioasaActiva = true;
      coborareGlorioasaTimp = 0;
      coborareGlorioasaYStart = y;
      myButtons.forEach((btn) => {
        btn.disabled = true;
      });

      coborareGlorioasaVitezaJos = (travel - y) / COBORARE_GLORIOASA_DURATA;
      const lungimeFrac = Math.max(0, Math.min(10, cfg.daraLungime)) / 10;
      coborareGlorioasaYTintaSus = y * (1 - lungimeFrac);
      coborareGlorioasaVitezaSus = (y - coborareGlorioasaYTintaSus) / COBORARE_GLORIOASA_DURATA;
      coborareGlorioasaDistJos = 0;
      coborareGlorioasaDistSus = 0;
    }

    // Avansează coborârea glorioasă cu un cadru — apelată din tick() ÎN LOC de
    // incrementul normal de `y`, cât timp e activă. Durată fixă (nu viteză constantă):
    // ambele fronturi parcurg orice distanță le rămâne, exact în
    // COBORARE_GLORIOASA_DURATA secunde, interpolare liniară — unul în jos (liftul),
    // celălalt în sus (dâra), simultan. Spawn legat de distanța acumulată de fiecare
    // front (nu de timp), pas = liftH / (Desime/100) — la Desime=100, pasul e liftH,
    // adică „urmă lângă urmă" (cadru lângă cadru). La final: y=0 + faNouFact() — exact
    // ca la wrap-ul normal.
    function avanseazaCoborareaGlorioasa(dt) {
      coborareGlorioasaTimp += dt;
      const t = Math.min(1, coborareGlorioasaTimp / COBORARE_GLORIOASA_DURATA);
      y = coborareGlorioasaYStart + (travel - coborareGlorioasaYStart) * t;
      lift.style.top = `${y}px`;
      rowEl.style.top = `${y + rowOffsetTop}px`;
      const yFrontSus = coborareGlorioasaYStart - (coborareGlorioasaYStart - coborareGlorioasaYTintaSus) * t;

      const desime = Math.max(0, Math.min(100, cfg.daraDesime));
      const pasSpatiu = liftH / Math.max(0.05, desime / 100);

      coborareGlorioasaDistJos += coborareGlorioasaVitezaJos * dt;
      while (coborareGlorioasaDistJos >= pasSpatiu) {
        creeazaDaraGlorioasa(y);
        coborareGlorioasaDistJos -= pasSpatiu;
      }

      coborareGlorioasaDistSus += coborareGlorioasaVitezaSus * dt;
      while (coborareGlorioasaDistSus >= pasSpatiu) {
        creeazaDaraGlorioasa(yFrontSus);
        coborareGlorioasaDistSus -= pasSpatiu;
      }

      if (t >= 1) {
        coborareGlorioasaActiva = false;
        y = 0;
        faNouFact();
      }
    }

    // „Prea puțin"/„prea mult": compară lățimea coloanei curente cu totalMere.
    // Coordonate calculate analitic, nu măsurate — lift.style.left = colX[colIndex],
    // deci în sistemul de coordonate al liftului (0 = marginea lui stângă), coloana
    // se termină la latimeColoana*cell, indiferent de padding-ul intern al liftului.
    // top-ul rândului de mere vine din rowOffsetTop (cache-uit în computeGeometry,
    // v. definiția lui) — NU din rowEl.offsetTop: de când rowEl e frate al lui lift
    // (nu copil), offsetTop al lui rowEl e relativ la scene, nu la lift, și
    // mismatchEl e poziționat în coordonate lift-locale. rowEl.offsetHeight rămâne
    // măsurat direct (înălțimea intrinsecă nu depinde de cine e părintele). Bara e
    // centrată pe axa verticală a rândului de mere — cu o excepție: la sumă mică
    // (<=5) și coloană mai îngustă, rândul de mere e prea scund/aglomerat ca bara
    // centrată să nu se suprapună vizibil peste mere, deci rămâne SUB rând, ca înainte.

    function actualizeazaMismatch() {
      const latimeColoana = cfg.latimiColoane[colIndex];
      if (latimeColoana === totalMere) {
        mismatchEl.style.display = "none";
        actualizeazaEtichetaButon("corect");
        return;
      }
      mismatchEl.style.display = "block";
      const centruRand = rowOffsetTop + rowEl.offsetHeight / 2;
      if (latimeColoana > totalMere) {
        // coloana mai lată — celule goale în continuarea rândului de mere
        actualizeazaEtichetaButon("mare");
        const h = Math.max(rowEl.offsetHeight, mismatchMinH);
        mismatchEl.style.left = `${totalMere * cell}px`;
        mismatchEl.style.width = `${(latimeColoana - totalMere) * cell}px`;
        mismatchEl.style.top = `${centruRand - h / 2}px`;
        mismatchEl.style.height = `${h}px`;
      } else {
        // coloana mai îngustă — mere care ies peste marginea galbenă
        actualizeazaEtichetaButon("mic");
        const h = Math.max(cell, mismatchMinH);
        mismatchEl.style.left = `${latimeColoana * cell}px`;
        mismatchEl.style.width = `${(totalMere - latimeColoana) * cell}px`;
        const top = totalMere <= 5 ? rowOffsetTop + rowEl.offsetHeight : centruRand - h / 2;
        mismatchEl.style.top = `${top}px`;
        mismatchEl.style.height = `${h}px`;
      }
    }

    // Rebuild complet al numerotării (nu update parțial): un .rigle-row pe fiecare
    // linie de grilă din fiecare coloană, cu 1..lățime cifre. Apelat din
    // computeGeometry() — deci la mount, resize, setColumnLayout, fact nou și
    // setNumerotareRanduri(). Modul "animat" pornește cu toate rândurile invizibile
    // (opacity 0); tick()/selectColumn() decid ce se vede.
    function randeazaNumerotare(H) {
      rowNumbersWrap.replaceChildren();
      rowEls = [];
      if (cfg.numerotareRanduri === "dezactivat") return;

      const maxRanduri = Math.max(0, Math.ceil(H / cell));
      cfg.latimiColoane.forEach((w, i) => {
        const randuriColoana = [];
        for (let r = 0; r < maxRanduri; r++) {
          const randEl = document.createElement("div");
          randEl.className = "rigle-row";
          randEl.style.left = `${colX[i]}px`;
          randEl.style.top = `${r * cell}px`;
          randEl.style.width = `${w * cell}px`;
          randEl.style.height = `${cell}px`;
          for (let k = 1; k <= w; k++) {
            const cifraEl = document.createElement("span");
            cifraEl.className = "rigle-row-cell";
            cifraEl.textContent = String(k);
            randEl.appendChild(cifraEl);
          }
          if (cfg.numerotareRanduri === "toate") {
            randEl.style.color = NUMEROTARE_CULOARE_STATICA;
            randEl.style.opacity = "1";
          } else {
            randEl.style.opacity = "0"; // "animat" — actualizeazaNumerotareAnimata() decide
          }
          rowNumbersWrap.appendChild(randEl);
          randuriColoana.push(randEl);
        }
        rowEls[i] = randuriColoana;
      });
    }

    // Modul "animat": fereastra de `randuriInSus` rânduri deasupra + `randuriInJos`
    // rânduri sub rândul liftului, pe coloana curentă — opacitate + culoare (hue) în
    // funcție de distanța (în orice direcție) până la rândul liftului. Ieftin: doar
    // `maxRanduri` scrieri de style, nicio creare de DOM (asta se întâmplă o singură
    // dată, în randeazaNumerotare).
    //
    // `pozitieReper` e FRACȚIONARĂ, nu rotunjită la rând întreg — altfel gradientul
    // sare o dată pe celulă parcursă (vizibil brusc). Fiindcă se recalculează la
    // fiecare cadru din tick(), iar `y` avansează continuu, opacitatea/culoarea
    // fiecărui rând se ajustează în fiecare cadru (practic la fiecare fracțiune de
    // pătrățel), nu doar când liftul trece pe rândul următor.
    function actualizeazaNumerotareAnimata() {
      if (cfg.numerotareRanduri !== "animat") return;
      const randuriColoana = rowEls[colIndex];
      if (!randuriColoana) return;
      const pozitieReper = (y + liftH) / cell + 1; // rândul liftului + cel de sub, fracționar
      const Xsus = Math.max(1, cfg.randuriInSus);
      const Xjos = Math.max(1, cfg.randuriInJos);

      randuriColoana.forEach((randEl, r) => {
        const distanta = pozitieReper - r; // pozitiv = deasupra liftului, negativ = sub
        const X = distanta >= 0 ? Xsus : Xjos;
        const distantaAbs = Math.abs(distanta);
        if (distantaAbs > X) {
          randEl.style.opacity = "0";
          return;
        }
        const t = distantaAbs / X;
        const hue = NUMEROTARE_HUE_APROAPE + (NUMEROTARE_HUE_DEPARTE - NUMEROTARE_HUE_APROAPE) * t;
        randEl.style.opacity = String(1 - t);
        randEl.style.color = `hsl(${hue}, 75%, 40%)`;
      });
    }

    function selectColumn(idx) {
      if (idx < 0 || idx >= colX.length) return;
      if (cfg.numerotareRanduri === "animat" && rowEls[colIndex]) {
        rowEls[colIndex].forEach((randEl) => {
          randEl.style.opacity = "0";
        });
      }
      colIndex = idx;
      lift.style.left = `${colX[colIndex]}px`; // glisare orizontală (tranziția CSS)
      rowEl.style.left = `${colX[colIndex]}px`; // sincron cu lift — v. .rigle-lift-row--ready
      actualizeazaNumerotareAnimata();
      actualizeazaMismatch();
      porneșteFovLift(); // la FIECARE apăsare — corect sau greșit, mutare reală sau re-apăsare
      // Coborâre glorioasă: dacă „Pe lift" e oprit, nu există nicio cursă FOV al cărei
      // final s-o declanșeze (vezi avanseazaFovLift) — pornește direct aici.
      if (!cfg.fovLift && cfg.latimiColoane[idx] === totalMere) {
        porneșteCoborareaGlorioasa();
      }
    }

    // Pauză proprie lui m2 — motorul 1 (falling-engine.js) are „if
    // (getQuiz().isCompleted()) return;" ca prim rând al handler-ului de pauză, iar
    // Rigle raportează isCompleted()→true (§2 RIGLE-REFERENCE), deci butonul/tasta nu
    // ajung niciodată la logica lui m1. Duplicat aici, nu adăugat în falling-engine.js
    // — pauza lui m1 e împletită cu fallHeld/animating/locked/bouncing/optionBtns,
    // stare fără sens pentru m2; „nicio modificare în falling-engine.js" e principiul
    // stabilit încă din etapa 1.
    function setPauza(val) {
      paused = val;
      if (playPauseBtn) playPauseBtn.textContent = paused ? "▶" : "⏸";
      if (gameEl) gameEl.classList.toggle("is-paused", paused);
      // Dacă e activă coborârea glorioasă, butoanele rămân blocate chiar la unpauzare —
      // altfel copilul ar putea schimba coloana în mijlocul tranziției spre factul nou.
      myButtons.forEach((btn) => {
        btn.disabled = paused || coborareGlorioasaActiva;
      });
    }

    function onPlayPauseClick() {
      setPauza(!paused);
    }
    if (playPauseBtn) playPauseBtn.addEventListener("click", onPlayPauseClick);

    function applyGridLines() {
      const parts = [];
      if (cfg.gridVertical) parts.push(`linear-gradient(to right, ${GRID_LINE})`);
      if (cfg.gridOrizontal) parts.push(`linear-gradient(to bottom, ${GRID_LINE})`);
      gridEl.style.backgroundImage = parts.length ? parts.join(", ") : "none";
    }

    function setGridLines(opts) {
      if (!opts) return;
      if (typeof opts.vertical === "boolean") cfg.gridVertical = opts.vertical;
      if (typeof opts.orizontal === "boolean") cfg.gridOrizontal = opts.orizontal;
      applyGridLines();
    }

    function setColumnLayout(opts) {
      if (!opts) return;
      if (typeof opts.treime === "boolean") cfg.pozitieTreime = opts.treime;
      const frac = travel > 0 ? y / travel : 0;
      computeGeometry();
      y = frac * travel;
    }

    // La fact nou se schimbă lățimile coloanelor, deci colX, deci lift.style.left —
    // cu tranziția activă liftul ar glisa orizontal exact când sare vertical sus.
    // Se scoate clasa înainte de randare, se pune la loc pe rAF (ca la mount).
    function schimbaFact(fact) {
      lift.classList.remove("rigle-lift--ready");
      rowEl.classList.remove("rigle-lift-row--ready");
      randeazaFact(fact);
      requestAnimationFrame(() => {
        lift.classList.add("rigle-lift--ready");
        rowEl.classList.add("rigle-lift-row--ready");
      });
    }

    function faNouFact() {
      const fact = cfg.urmatorulFact?.();
      if (fact) schimbaFact(fact);
    }

    // Folosită de CP: fără ea, o schimbare de interval din „Suma maxima" s-ar vedea
    // abia la următorul wrap (~20s), și controlul ar părea stricat.
    function reporneste() {
      y = 0;
      faNouFact();
    }

    // CP „Numerotează rânduri din coloane" — live, fără remount. computeGeometry()
    // rebuild-uiește randeazaNumerotare() cu noile cfg.numerotareRanduri/randuriInSus.
    function setNumerotareRanduri(opts) {
      if (!opts) return;
      if (typeof opts.mod === "string") cfg.numerotareRanduri = opts.mod;
      if (typeof opts.randuriInSus === "number") cfg.randuriInSus = opts.randuriInSus;
      if (typeof opts.randuriInJos === "number") cfg.randuriInJos = opts.randuriInJos;
      computeGeometry();
      actualizeazaNumerotareAnimata();
    }

    // CP „Lift" — transparență fundal alb + afișare margine. Live, fără remount.
    function aplicaStilLift() {
      const transparenta = Math.min(100, Math.max(0, cfg.liftFundalTransparenta));
      const alfa = (100 - transparenta) / 100;
      lift.style.background = `rgba(255, 255, 255, ${alfa})`;
      // Culoarea devine transparentă (nu border-width: 0), ca să nu schimbe cutia
      // liftului — actualizeazaMismatch() presupune padding+border constante.
      lift.style.borderColor = cfg.liftMargine ? "#3a4a63" : "transparent";
    }

    function setLift(opts) {
      if (!opts) return;
      if (typeof opts.transparentaFundal === "number") cfg.liftFundalTransparenta = opts.transparentaFundal;
      if (typeof opts.margine === "boolean") cfg.liftMargine = opts.margine;
      aplicaStilLift();
    }

    // CP „Etichete (FOV Feedback Oranj Verde)" — live, fără remount.
    function setFov(opts) {
      if (!opts) return;
      if (typeof opts.buton === "boolean") {
        cfg.fovButon = opts.buton;
        actualizeazaMismatch(); // reafișează/ascunde imediat eticheta curentă
      }
      if (typeof opts.lift === "boolean") {
        cfg.fovLift = opts.lift;
        if (!cfg.fovLift) {
          fovRulareId += 1;
          fovActiv = false;
          fovVizibil = false;
          fovLiftEl.classList.remove("rigle-fov-lift--vizibila");
          fovZburatorEl.classList.remove("rigle-fov-zburator--vizibil");
        }
      }
      if (typeof opts.animatieCorect === "boolean") cfg.fovLiftAnimatieCorect = opts.animatieCorect;
      if (typeof opts.divizorViteza === "number") {
        cfg.fovLiftDivizorViteza = Math.max(1, Math.min(10, opts.divizorViteza));
      }
    }

    // CP „Dara glorioasă" — Lungime (0-10) / Desime (0-100). Live, fără remount; se
    // citesc direct din cfg la fiecare pornire de cursă (porneșteCoborareaGlorioasa) —
    // nu trebuie nimic recalculat aici, doar reținută valoarea.
    function setDaraGlorioasa(opts) {
      if (!opts) return;
      if (typeof opts.lungime === "number") cfg.daraLungime = Math.max(0, Math.min(10, opts.lungime));
      if (typeof opts.desime === "number") cfg.daraDesime = Math.max(0, Math.min(100, opts.desime));
    }

    // CP „Bara cu mere" — poziție (sub/deasupra numerotării) + transparență.
    // Poziție: la z-index egal (amândouă 1 — vezi §5 RIGLE-REFERENCE), ordinea DOM
    // decide cine picta deasupra: insertBefore mută rowEl/rowNumbersWrap unul
    // relativ la celălalt, fără remount — mutarea unui nod existent păstrează
    // starea (clase, listeners).
    function aplicaPozitieMere() {
      if (cfg.mereSubNumerotare) {
        scene.insertBefore(rowEl, rowNumbersWrap);
      } else {
        scene.insertBefore(rowNumbersWrap, rowEl);
      }
    }
    // Transparență: opacity pe rowEl (tot rândul), nu culoare rgba() pe fundal — un
    // rgba() pe .rigle-apple--rosu/--albastru ar lăsa emoji-ul 🍏 (glif de font, imun
    // la background/color) mereu opac. Aceeași formulă ca aplicaStilLift() (0=opac,
    // 100=complet transparent).
    function aplicaTransparentaMere() {
      const alfa = (100 - Math.min(100, Math.max(0, cfg.mereTransparenta))) / 100;
      rowEl.style.opacity = String(alfa); // pe tot rândul (fundal colorat + halou +
      // emoji), nu doar pe culoarea de fundal — un rgba() pe fundal nu atinge emoji-ul
      // (glif opac, randat de font, imun la background/color din CSS).
    }
    function setPozitieMere(opts) {
      if (!opts) return;
      if (typeof opts.subNumerotare === "boolean") {
        cfg.mereSubNumerotare = opts.subNumerotare;
        aplicaPozitieMere();
      }
      if (typeof opts.transparenta === "number") {
        cfg.mereTransparenta = opts.transparenta;
        aplicaTransparentaMere();
      }
    }

    // Factul inițial vine din același callback ca la wrap, ca să nu existe două căi
    // diferite de a produce un fact. Fără callback (mount fără generator), se
    // folosesc valorile din cfg — comportament identic cu etapa 1.
    aplicaStilLift();
    aplicaPozitieMere();
    aplicaTransparentaMere();
    const factInitial = cfg.urmatorulFact
      ? cfg.urmatorulFact()
      : { intrebare: cfg.intrebare, grupe: cfg.grupe, latimiColoane: cfg.latimiColoane };
    randeazaFact(factInitial);
    // Activăm tranziția orizontală abia după prima așezare, ca liftul (și rândul
    // de mere, sincron) să nu gliseze din colț la pornire.
    requestAnimationFrame(() => {
      lift.classList.add("rigle-lift--ready");
      rowEl.classList.add("rigle-lift-row--ready");
    });

    // ── Taste 1/2/3 → coloana 1/2/3 (poziții stânga→dreapta). ──
    // Space/p/P NU se tratează aici: falling-engine.js are deja un listener de
    // keydown negardat (fără isCompleted()) care apelează necondiționat
    // `playPauseBtn.click()` pentru acele taste — ajunge oricum la
    // onPlayPauseClick() mai jos. Tratarea și aici ar comuta pauza de două ori pe
    // apăsare (dublu-toggle = anulare reciprocă) — verificat, era bug real.
    const onKey = (e) => {
      if (e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (paused || coborareGlorioasaActiva) return; // fără schimbare de coloană cât timp e pauză/coboară glorios
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx >= 0 && idx < colX.length) selectColumn(idx);
    };
    document.addEventListener("keydown", onKey);

    // ── Bucla de coborâre (lentă, continuă, wrap la podea → fact nou). ──
    let rafId = null;
    let lastTs = 0;
    function tick(ts) {
      if (!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      if (!paused) {
        if (coborareGlorioasaActiva) {
          avanseazaCoborareaGlorioasa(dt);
        } else {
          y += cfg.vitezaCoborare * dt;
          if (y >= travel) {
            y = 0;
            faNouFact();
          }
          lift.style.top = `${y}px`;
          rowEl.style.top = `${y + rowOffsetTop}px`;
        }
        actualizeazaNumerotareAnimata();
        if (fovVizibil) {
          actualizeazaPozitieFovLift();
          if (fovActiv) avanseazaFovLift(dt);
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // ── Recalcul la schimbare de dimensiune (mobil/desktop, rotire). ──
    const ro = new ResizeObserver(() => {
      const frac = travel > 0 ? y / travel : 0;
      computeGeometry();
      y = frac * travel;
    });
    ro.observe(arenaEl);

    function destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("keydown", onKey);
      if (playPauseBtn) {
        playPauseBtn.removeEventListener("click", onPlayPauseClick);
        playPauseBtn.textContent = "⏸"; // iconul implicit (nepauzat) — motorul 1 pornește mereu nepauzat
      }
      scene.remove();
      buttonsBar.remove();
      if (gameEl) {
        gameEl.classList.remove("rigle-active");
        gameEl.classList.remove("is-paused"); // nu lăsăm starea de pauză să "scurgă" spre motorul 1
      }
      restoreList.forEach(({ el, prev }) => {
        el.style.display = prev;
      });
    }

    return {
      destroy,
      setGridLines,
      setColumnLayout,
      reporneste,
      setNumerotareRanduri,
      setLift,
      setFov,
      setDaraGlorioasa,
      setPozitieMere,
    };
  }

  global.RigleEngine = { mount };
})(window);
