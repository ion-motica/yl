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
 *         setDaraGlorioasa, setPozitieMere, setOpritDefinitiv,
 *         setCuloriTema({ fundal?, coloane?, valoriButoane?, grila?, numereColoane? }) }
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
  /* isolation:isolate = forțează un context de stivuire PROPRIU pt. scenă, fără să-i
     schimbe poziția față de proprii frați (spre deosebire de a-i da un z-index numeric,
     care ar face-o și pe asta). Fără el, .rigle-scene are position:absolute dar
     z-index:auto — deci NU crea context propriu — iar z-index-urile copiilor ei
     (grila, coloanele, liftul) nu se comparau între ele, ci cu orice altceva mai sus
     în arbore, oriunde s-ar fi nimerit prima ascendență cu context real. Descoperit
     25.08.2026: grila cu z-index negativ (gotcha #17) a „scăpat" din scenă și a
     dispărut complet — nu doar sub coloane, ci sub tot. Cu pozitive mici (1-4), coincidea
     să iasă deasupra oricum, deci bug-ul exista mereu, tăcut, doar nu avea cum să se
     vadă până la o valoare negativă. */
  isolation: isolate;
  --cell: 32px;
  font-family: system-ui, sans-serif;
  background: var(--rigle-culoare-fundal, #fbfbf3);
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
  background: var(--rigle-culoare-coloane, #ffe14d);
  /* FĂRĂ border-color aici — conturul se desenează pe canvas-ul grilei
     (randeazaContureColoane, după liniile de grilă), nu ca border CSS. Border-ul CSS
     dădea o linie vizibilă DOAR pe marginea dreaptă a fiecărei coloane (gotcha #15):
     marginea stângă a border-ului crește spre dreapta, la fel ca linia de grilă de la
     aceeași coordonată — grila (desenată peste) o acoperea complet; marginea dreaptă
     crește spre stânga, direcție opusă liniei de grilă de-acolo — nu se ating, deci
     rămânea vizibilă. border-width rămâne (afectează box-sizing), doar culoarea
     dispare. */
  border: 1px solid transparent;
  border-radius: 6px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}
.rigle-lift {
  position: absolute;
  z-index: 5; /* deasupra grilei (3) — cerere explicită (25.08.2026): grila trebuie
    să rămână un strat vizual (peste coloane), dar liftul și merele nu trebuie
    acoperite de ea. Gap-ul față de .rigle-lift-row (4) e păstrat identic cu cel
    dinainte (lift stătea cu un nivel deasupra rândului de mere) — nu se atingeau
    vizual, dar invariantul e păstrat din prudență. */
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
  transform-origin: left top; /* scalarea din CP „Dimensiune initiala lift" crește spre
    dreapta/jos din colțul stâng-sus, deci "left"/"top" rămân marginea vizuală reală —
    altfel poziționarea analitică de mai jos ar trebui să compenseze originea. */
}
.rigle-lift--ready {
  /* "transform" intră în tranziție ca micșorarea 2×→1× de la prima apăsare să curgă
     odată cu glisarea spre coloană — o singură mișcare, nu două. */
  transition: left 0.35s ease, transform 0.35s ease;
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
  z-index: 4; /* deasupra grilei (3), sub lift (5) — cerere 25.08.2026, vezi .rigle-lift */
  display: flex;
  transform-origin: left top;
}
.rigle-lift-row--ready {
  /* aceeași tranziție ca .rigle-lift--ready, ca rândul de mere să gliseze sincron cu
     cutia liftului, nu decuplat. "top" NU se tranziționează dinadins: e rescris la
     fiecare cadru de tick(), o tranziție l-ar face să rămână permanent în urmă. De-aia
     decalajul vertical la scalare merge prin translateY din transform (care SE
     tranziționează), nu prin "top" — vezi aplicaTransformariLift(). */
  transition: left 0.35s ease, transform 0.35s ease;
}
/* „Prea puțin"/„prea mult" — dreptunghi portocaliu clipitor. NU mai e copil al
   .rigle-lift (era, până la cererea explicită „lift+mere peste grilă, dreptunghiul
   SUB grilă" — 25.08.2026): un copil oricât de negativ i-ai da z-index-ul, tot
   pictează deasupra fraților lui .rigle-lift, din același motiv documentat mai sus la
   .rigle-lift-row (z-index-ul unui descendent contează doar ÎN INTERIORUL contextului
   părintelui). Acum e frate independent al lui .rigle-lift în .rigle-scene, cu
   z-index sub grilă — poziționat analitic în coordonate DE SCENĂ (nu lift-locale),
   compuse din poziția curentă a liftului + un offset local cache-uit — vezi
   mismatchLocalLeft/Top și actualizeazaMismatch() în JS. Ascuns implicit (display
   none), afișat doar când lățimea coloanei ≠ totalMere. */
.rigle-lift-mismatch {
  position: absolute;
  z-index: 2; /* sub grila (3), deasupra coloanelor/numerotării (1) — cerere 25.08.2026 */
  display: none;
  background: #ff9800;
  border-radius: 4px;
  animation: rigle-blink 0.6s ease-in-out infinite;
  pointer-events: none;
}
.rigle-lift-mismatch--ready {
  /* Fără asta, de când mismatchEl e frate (nu copil) al lui lift: poziția lui se scrie
     direct, instant, cu JS (xLiftCurent() întoarce ținta finală, nu o valoare
     intermediară) — ar sări brusc la stânga/dreapta în timp ce lift/rowEl alunecă lin
     spre aceeași țintă (tranziția LOR de 0.35s). Copil fiind, mișcarea venea gratis
     odată cu părintele; frate fiind, are nevoie de propria tranziție, gată la fel
     (adăugată pe rAF, ca la .rigle-lift--ready — nu de la prima așezare, ca să nu
     alunece din colț la pornire). */
  transition: left 0.35s ease;
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
/* Grila de caiet = DOAR linii, peste paper/coloane/numerotare (inclusiv conturul
   coloanelor desenat tot aici — randeazaContureColoane()), dar SUB lift/mere/
   dreptunghiul portocaliu de mismatch (25.08.2026, cerere explicită — vezi
   .rigle-lift, .rigle-lift-row, .rigle-lift-mismatch pt. z-index-urile exacte).
   Testat și varianta „fundal" (tot 25.08.2026) — respinsă: grila devine inutilă
   exact unde contează, peste coloanele opace, unde copilul numără pătrățele ca să
   măsoare. Vezi gotcha #17 pt. bug-ul real întâlnit pe drum (z-index negativ „scăpat"
   din scenă, nu problema de fond a cererii). E un <canvas> (nu div cu background-image
   repetat — vezi randeazaGrila() pt. motiv), desenat din JS, în funcție de
   vertical/orizontal. Dimensiunea reală (width/height, atribute, nu CSS) o dă
   randeazaGrila(); inset:0 îi dă doar mărimea de afișare. */
.rigle-grid {
  position: absolute;
  inset: 0;
  /* OBLIGATORIU pe canvas, nu doar inset:0 (gotcha #16): canvas e element "replaced",
     ca img/video — are mărime naturală proprie (bitmap-ul, in px CSS), iar inset:0 NU
     o suprascrie, cum făcea la div-ul cu background-image de dinainte. Fără astea,
     canvas-ul se afișa la mărimea bitmap-ului (dublu la dpr 2), deci tot ce desenam pe
     el apărea deplasat cu factorul dpr față de coloanele din DOM. */
  width: 100%;
  height: 100%;
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
  height: var(--rigle-inaltime-butoane);
  box-sizing: border-box;
  pointer-events: none;
}
/* Înălțimea barei de butoane, expusă ca variabilă pe #game (.rigle-active) fiindcă
   #arena NU se termină deasupra barei — bara stă ÎNĂUNTRUL casetei arenei (verificat:
   arena 0-655, butoane 491-655). Deci orice suprapunere care vrea să stea DEASUPRA
   butoanelor se ancorează cu "bottom: calc(var(--rigle-inaltime-butoane) + gap)", nu
   cu "bottom: 0" pe arenă — care ar cădea peste butoane. Variabilă, nu valoarea
   repetată: 25dvh se schimbă la rotire/redimensionare, iar o copie ar rămâne în urmă.
   Folosită azi de eticheta de subquiz din js/quizzes/rigle-tabla-1-10.js. */
.rigle-active {
  --rigle-inaltime-butoane: clamp(126px, 25dvh, 252px);
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
  color: var(--rigle-culoare-valori-butoane, #e8eef5);
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
  z-index: 6; /* peste .rigle-grid (3) și .rigle-lift (5) — vezi .rigle-lift pt. de ce 5 */
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
  z-index: 7; /* peste .rigle-fov-lift (6) — păstrează gap-ul de dinainte */
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
  z-index: 1; /* sub .rigle-lift (acum 5) — se vede „în urmă", nu peste el. Rămâne și
    sub grilă (3), neschimbat — userul a cerut explicit doar lift+mere peste grilă,
    dara n-a fost menționată. */
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

  const GRID_LINE_COLOR = "rgba(70, 120, 190, 0.28)"; // culoare implicită linii grilă — vezi cfg.culoareGrila
  const NUMEROTARE_CULOARE_STATICA = "rgba(70, 120, 190, 0.65)"; // implicit modul "toate rândurile" — vezi cfg.culoareNumerotare

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
    liftScalaInitiala: 1, // cât de mare reapare liftul (cutie + întrebare + mere) la
    // FIECARE fact nou; revine animat la 1 de la prima apăsare. 1 = neschimbat
    // (implicit, deci zero efect pt. rigle-cl1.js), 2 = dublu.
    liftPornire: null, // unde reapare liftul la FIECARE fact nou:
    //   null            = nu se atinge — rămâne pe ultima coloană apăsată (istoric, rigle-cl1)
    //   "coloana2"      = revine mereu pe coloana din mijloc
    //   "intreColoane"  = coboară pe linia dintre două coloane, alternând golul, fără
    //                     nicio coloană aleasă; prima apăsare îl mută pe coloană
    fovButon: true, // eticheta „n e prea mic/mare/corect" de pe buton
    fovLift: true, // pătrățelul zburător + caseta de sub lift
    fovLiftAnimatieCorect: true, // continuarea spre „?" (doar la coloana corectă)
    fovLiftDivizorViteza: 1, // 1 = viteza actuală, 10 = de 10x mai încet (CP slider)
    daraLungime: 10, // 0-10; 10 = frontul de sus al dârei ajunge la marginea de sus a arenei
    daraDesime: 50, // 0-100; 100 = dreptunghiuri cadru lângă cadru (fără gol)
    onSelectColumn: null, // ({idx, corect, totalMere, latime}) => void — opțional, apelat la
    // FIECARE apăsare de coloană (selectColumn), înaintea efectelor vizuale. Neapelat
    // dacă lipsește — zero regresie pentru quiz-uri care nu-l furnizează.
    culoareGrila: GRID_LINE_COLOR, // liniile de grilă (vertical+orizontal, aceeași culoare) — setCuloriTema({grila})
    culoareNumerotare: NUMEROTARE_CULOARE_STATICA, // cifrele din coloane, DOAR modul „toate
    // rândurile" — modul „animat" își păstrează gradientul HSL propriu (NUMEROTARE_HUE_*),
    // neatins — e un mecanism vizual diferit (distanță până la lift), nu „o culoare".
  };

  const LIFT_INSET = 6; // padding (4px) + border (2px) ale .rigle-lift — v. lift.style.width și .rigle-lift-row
  const LIFT_ROW_GAP = 4; // .rigle-lift { gap: 4px } — spațiul dintre qEl și fostul loc al rândului de mere
  const ETICHETA_GAP = 5; // px sub cifra butonului (~0.3rem, cât era gap-ul flex înainte) — v. reglajEticheta
  const GOL_INTRE_COLOANE = 1; // celule de grilă goale garantate între două coloane vecine
  const CULOARE_MARGINE_COLOANA = "#e6c02a"; // conturul coloanei, desenat pe canvas — vezi gotcha #15
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
    lift.append(qEl);
    // mismatchEl NU mai e copil al lui lift — e adăugat mai jos, ca frate în scene
    // (vezi comentariul CSS de la .rigle-lift-mismatch pt. motiv: z-index-ul unui
    // copil nu poate „ieși" sub un frate al părintelui lui).

    // Canvas, nu div cu background-image repetat — vezi randeazaGrila() pentru motiv
    // (banding la scară mare, cauzat de compozitorul GPU, nu de geometria calculată).
    const gridEl = document.createElement("canvas");
    gridEl.className = "rigle-grid";
    const gridCtx = gridEl.getContext("2d");

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
    scene.append(columnsWrap, rowEl, rowNumbersWrap, lift, mismatchEl, gridEl, fovLiftEl, fovZburatorEl);
    arenaEl.appendChild(scene);

    // ── Bara de butoane proprie a m2, în stratul de butoane (peste scenă). ──
    const buttonsBar = document.createElement("div");
    buttonsBar.className = "rigle-buttons";
    butoaneLayer.appendChild(buttonsBar);

    // ── Geometrie + stare ──
    let cell = 32;
    let colX = [];
    let margin = 0; // spațiul înaintea primei coloane (mod „în funcție de spațiu"; 0 în
    // „treime") — hoist din computeGeometry(), citit și de randeazaGrila(), care poate
    // rula independent de ea (setGridLines/setCuloriTema, fără recalcul de geometrie).
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
    // mismatchLocalLeft/Top: la fel ca rowOffsetTop, dar pt. dreptunghiul portocaliu
    // (mismatchEl, tot frate independent al lui lift, nu copil — vezi motivul la CSS
    // .rigle-lift-mismatch). Coordonate LIFT-locale, NEscălate — recalculate doar în
    // actualizeazaMismatch() (depind de totalMere/lățimea coloanei, nu de cadru); la
    // fiecare cadru (tick/coborârea glorioasă), poziția finală se recompune din ele +
    // poziția curentă a liftului (xLiftCurent()/y) + scalaLift, fără să ruleze din nou
    // toată logica „prea mult/prea puțin".
    let mismatchLocalLeft = 0;
    let mismatchLocalTop = 0;
    let travel = 1;
    let colEls = [];
    let myButtons = [];
    let rowEls = []; // rowEls[coloană][rând] = elementul .rigle-row (numerotare)
    let necunoscutaEl = null; // span-ul „?" din întrebare — recreat la fiecare fact (randeazaFact)
    let paused = false;
    let opritDefinitiv = false; // stop dur, distinct de pauza userului (fără suprapunerea
    // vizuală „PAUZĂ" — vezi setOpritDefinitiv). Folosit de quiz-uri cu „joc finalizat".
    const playPauseBtn = document.getElementById("play-pause");
    // -1 = „între coloane", stare validă doar cu cfg.liftPornire === "intreColoane":
    // liftul coboară pe linia dintre două coloane, fără nicio coloană aleasă, până la
    // prima apăsare. Tot codul care indexează cu colIndex (FOV, dâra glorioasă,
    // eticheta de pe buton) pornește DOAR din selectColumn(), care setează mereu un
    // index valid — de-aia starea asta nu cere gărzi decât în cele două locuri care
    // rulează și fără apăsare: poziționarea (xLiftCurent) și actualizeazaMismatch().
    let liniaIntre = -1; // golul pe care coboară liftul: 0 = c1-c2, 1 = c2-c3
    let scalaLift = 1; // scala curentă a ansamblului lift+mere; cade la 1 la prima apăsare
    let sceneW = 0; // lățimea scenei, reținută în computeGeometry — folosită de clamp-ul
    let sceneH = 0; // orizontal și de recalculeazaCursa(), care rulează și în afara ei
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

      // Dimensiunea de pornire — axă independentă de poziție (vezi cfg.liftScalaInitiala).
      // computeGeometry(), chemată la finalul randării, aplică transform-ul și recalculează
      // cursa pentru noua scală.
      scalaLift = cfg.liftScalaInitiala > 1 ? cfg.liftScalaInitiala : 1;

      // Poziția de pornire a liftului pentru factul ăsta — vezi cfg.liftPornire.
      // `null` (implicit, cazul rigle-cl1.js) nu atinge colIndex: liftul rămâne pe
      // ultima coloană apăsată, comportamentul dintotdeauna.
      if (cfg.liftPornire === "coloana2") {
        colIndex = Math.min(1, cfg.latimiColoane.length - 1);
      } else if (cfg.liftPornire === "intreColoane") {
        // Alternează linia la fiecare fact (0 = golul c1-c2, 1 = golul c2-c3); -1 la
        // primul fact ⇒ începe cu golul din stânga. colIndex = -1 e starea „nicio
        // coloană aleasă" — prima apăsare o încheie, prin selectColumn().
        liniaIntre = liniaIntre === 0 ? 1 : 0;
        colIndex = -1;
      }

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
      // Scena pornește sub bara de sus (Alege quiz/CP/Pauză), nu pe sub ea —
      // măsurată live (nu hardcodată), ca să rămână corectă indiferent de
      // dimensiunea reală a barei. `.butoane-sus` e unic în DOM (bara fixă a
      // shell-ului), nu ceva specific Rigle. `inset:0` din CSS dă deja
      // right/bottom/left:0 — setăm doar `top`, `height` rezultă din
      // constrângerea top+bottom (position:absolute).
      const barSus = document.querySelector(".butoane-sus");
      scene.style.top = `${barSus ? barSus.getBoundingClientRect().height : 0}px`;

      const arenaRect = scene.getBoundingClientRect();
      const W = arenaRect.width || 360;
      const H = arenaRect.height || 720;
      sceneW = W; // hoist devreme — randeazaGrila(), mai jos în aceeași funcție, are
      sceneH = H; // nevoie de ele pentru dimensiunea canvas-ului, înainte de secțiunea lift.
      // Coloanele și traseul liftului merg de la marginea de sus la cea de jos a
      // #arena (curg pe sub bara de sus și pe sub butoane).
      margin = 0;

      if (cfg.pozitieTreime) {
        // Fiecare coloană = 1/N din lățimea arenei. `cellsPerThird` = nr. de celule
        // cât să încapă mereu, în orice treime, ȘI coloana ei ȘI liftul (bloc rigid,
        // poate fi mai lat decât coloana îngustă pe care stă parcat — „prea mult"
        // vizual din SPEC). `cell` derivă din asta, deci colX cade mereu pe multipli
        // exacți de `cell` — marginile coloanei coincid cu liniile grilei.
        const n = cfg.latimiColoane.length;
        const thirdW = W / n;
        // `+ GOL_INTRE_COLOANE`: fără el, coloana cea mai lată umple exact slotul ei
        // (lățime == cellsPerThird ⇒ spațiu zero după ea) și se LIPEȘTE de vecina din
        // dreapta — se întâmpla la fiecare fact unde cea mai lată nu era ultima, iar
        // copilul nu mai vedea unde se termină una și începe cealaltă. Slotul e cu o
        // celulă mai lat decât cea mai lată coloană, deci rămâne garantat minim un
        // rând de grilă gol între oricare două coloane. Invariantul de la gotcha #4
        // se păstrează: colX rămâne multiplu întreg de `cell`.
        const cellsPerThird = Math.max(Math.max(...cfg.latimiColoane), totalMere) + GOL_INTRE_COLOANE;
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
      randeazaGrila();

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
      recalculeazaCursa();

      lift.style.top = `${Math.min(y, travel)}px`;

      // rowEl urmează lift — qEl are text final (randeazaFact rulează înaintea lui
      // computeGeometry), deci qEl.offsetHeight e stabil aici. Calculat ÎNAINTE de
      // reglajTextSiDivuriPortocaliiSiVerzi(), fiindcă actualizeazaMismatch() (chemată
      // din ea) are nevoie de rowOffsetTop deja proaspăt.
      rowOffsetTop = LIFT_INSET + qEl.offsetHeight + LIFT_ROW_GAP;
      rowEl.style.top = `${Math.min(y, travel) + rowOffsetTop}px`;

      randeazaNumerotare(H);
      reglajTextSiDivuriPortocaliiSiVerzi();

      // Orizontala se scrie ABIA aici, după reglajLift(): centrarea și clamp-ul din
      // xLiftCurent() au nevoie de `liftW` proaspăt, iar reglajLift() îl calculează
      // în reglajTextSiDivuriPortocaliiSiVerzi(). Verticala (top/rowOffsetTop) rămâne
      // mai sus — actualizeazaMismatch(), chemată tot de acolo, o citește deja.
      aplicaTransformariLift();
      lift.style.left = `${xLiftCurent()}px`;
      rowEl.style.left = `${xLiftCurent()}px`;
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
      pozitioneazaMismatchTop(y); // urmărește căderea, fără să recalculeze offset-ul local
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

    // X-ul (marginea stângă) al liftului ȘI al rândului de mere — folosesc mereu
    // aceeași valoare, ca să gliseze sincron. Normal = marginea stângă a coloanei
    // curente. „Între coloane" (colIndex < 0): rândul de mere se CENTREAZĂ pe mijlocul
    // golului dintre două coloane vecine, ca să se vadă calare pe linie, la egală
    // distanță de ambele rigle. Mijlocul golului, NU treimea arenei (W/3): coloanele
    // nu-și umplu treimea (au lățimi diferite + golul garantat de o celulă), deci W/3
    // cade de fapt pe marginea stângă a coloanei următoare — adică PE ea, nu între.
    // Mărit, ansamblul se CENTREAZĂ pe reperul lui (coloană sau gol) în loc să stea cu
    // marginea stângă pe el, și e împins spre centru dacă iese din scenă. Clamp-ul se
    // aplică DOAR cât e mărit: la scala 1 poziționarea rămâne bit-identică cu cea
    // dinainte, deci zero regresie (inclusiv rigle-cl1.js, care nu scalează niciodată).
    function xLiftCurent() {
      const latimeRand = totalMere * cell;
      let x;
      if (colIndex >= 0) {
        x =
          scalaLift === 1
            ? colX[colIndex]
            : colX[colIndex] + (cfg.latimiColoane[colIndex] * cell) / 2 - (latimeRand * scalaLift) / 2;
      } else if (colX.length < 2) {
        x = colX[0] ?? 0;
      } else {
        const i = Math.min(Math.max(liniaIntre, 0), colX.length - 2);
        const mijlocGol = (colX[i] + cfg.latimiColoane[i] * cell + colX[i + 1]) / 2;
        x = mijlocGol - (latimeRand * scalaLift) / 2;
      }
      if (scalaLift === 1) return x;
      // Lățimea vizuală = a cutiei, care e cea mai lată dintre mere și text (reglajLift).
      // Dacă nici așa nu încape (sume foarte mari), rămâne lipit stânga și iese dreapta —
      // preferabil unei micșorări automate care ar contrazice opțiunea aleasă din CP.
      const latimeVizuala = Math.max(liftW, latimeRand) * scalaLift;
      if (latimeVizuala >= sceneW) return 0;
      return Math.max(0, Math.min(x, sceneW - latimeVizuala));
    }

    // Scalarea merge prin transform, nu prin lățimi/font-size recalculate: o singură
    // proprietate animabilă acoperă cutia, textul întrebării ȘI merele deodată.
    // Rândul de mere primește în plus un translateY, fiindcă `top`-ul lui e rescris la
    // fiecare cadru de tick() și nu poate fi tranziționat — vezi .rigle-lift-row--ready.
    function aplicaTransformariLift() {
      lift.style.transform = scalaLift === 1 ? "" : `scale(${scalaLift})`;
      rowEl.style.transform =
        scalaLift === 1 ? "" : `translateY(${rowOffsetTop * (scalaLift - 1)}px) scale(${scalaLift})`;
    }

    // Cursa se scurtează cu cât liftul e mai mare — cerință explicită („uniform, cursa
    // mai scurtă"): cutia trebuie să se oprească tot la marginea de jos a scenei, iar
    // înălțimea ei vizuală e liftH * scalaLift (offsetHeight nu vede transform-ul).
    // Apelată și din selectColumn, unde scala cade la 1 fără o recalculare de geometrie.
    function recalculeazaCursa() {
      travel = Math.max(1, sceneH - liftH * scalaLift);
    }

    // Scrie poziția FINALĂ (coordonate de scenă) a lui mismatchEl din offset-ul local
    // cache-uit (mismatchLocalLeft/Top, calculate în actualizeazaMismatch) + poziția
    // CURENTĂ a liftului. Reutilizată de actualizeazaMismatch() (după ce recalculează
    // offset-ul) ȘI, doar pt. top, de tick()/avanseazaCoborareaGlorioasa() (care nu
    // recalculează offset-ul — doar urmăresc căderea, la fel ca rowEl). scalaLift
    // multiplică offset-ul local, ca dreptunghiul să crească vizual odată cu liftul
    // mărit (2×) din CP „Dimensiune initiala lift" — fără asta, ar rămâne la mărimea
    // „normală" cât timp liftul din jurul lui e dublu.
    function pozitioneazaMismatchLeft() {
      if (mismatchEl.style.display === "none") return;
      mismatchEl.style.left = `${xLiftCurent() + mismatchLocalLeft * scalaLift}px`;
    }
    function pozitioneazaMismatchTop(liftTopCurent) {
      if (mismatchEl.style.display === "none") return;
      mismatchEl.style.top = `${liftTopCurent + mismatchLocalTop * scalaLift}px`;
    }

    function actualizeazaMismatch() {
      // Între coloane: rândul de mere n-are cu ce fi comparat — nici bara portocalie,
      // nici eticheta de pe buton n-au sens până la prima apăsare.
      if (colIndex < 0) {
        mismatchEl.style.display = "none";
        actualizeazaEtichetaButon(null);
        return;
      }
      const latimeColoana = cfg.latimiColoane[colIndex];
      if (latimeColoana === totalMere) {
        mismatchEl.style.display = "none";
        actualizeazaEtichetaButon("corect");
        return;
      }
      mismatchEl.style.display = "block";
      const centruRand = rowOffsetTop + rowEl.offsetHeight / 2;
      let localW;
      if (latimeColoana > totalMere) {
        // coloana mai lată — celule goale în continuarea rândului de mere
        actualizeazaEtichetaButon("mare");
        const h = Math.max(rowEl.offsetHeight, mismatchMinH);
        mismatchLocalLeft = totalMere * cell;
        localW = (latimeColoana - totalMere) * cell;
        mismatchLocalTop = centruRand - h / 2;
        mismatchEl.style.height = `${h * scalaLift}px`;
      } else {
        // coloana mai îngustă — mere care ies peste marginea galbenă
        actualizeazaEtichetaButon("mic");
        const h = Math.max(cell, mismatchMinH);
        mismatchLocalLeft = latimeColoana * cell;
        localW = (totalMere - latimeColoana) * cell;
        mismatchLocalTop = totalMere <= 5 ? rowOffsetTop + rowEl.offsetHeight : centruRand - h / 2;
        mismatchEl.style.height = `${h * scalaLift}px`;
      }
      mismatchEl.style.width = `${localW * scalaLift}px`;
      // Coordonate de SCENĂ, nu lift-locale (mismatchEl e frate al lui lift, nu copil
      // — vezi comentariul CSS): compune offset-ul local de mai sus cu poziția curentă
      // a liftului. `Math.min(y, travel)` = aceeași formulă ca lift.style.top oriunde
      // altundeva în afara coborârii glorioase (unde actualizeazaMismatch() oricum nu
      // rulează — vezi tick()/avanseazaCoborareaGlorioasa() pt. urmărirea per-cadru).
      pozitioneazaMismatchLeft();
      pozitioneazaMismatchTop(Math.min(y, travel));
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
            randEl.style.color = cfg.culoareNumerotare;
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
      if (opritDefinitiv) return; // butoanele sunt oricum disabled — gardă și pt. apăsare programatică
      const corect = cfg.latimiColoane[idx] === totalMere;
      // Hook opțional (implicit null — vezi DEFAULTS) — apelat AICI, înaintea
      // oricărui efect vizual, ca semnalul „a fost corect?" să fie disponibil
      // uniform, indiferent de cfg.fovLift (care doar întârzie coborârea
      // glorioasă, nu și corectitudinea logică a apăsării). Zero efect asupra
      // quiz-urilor care nu-l furnizează (ex. rigle-cl1.js).
      cfg.onSelectColumn?.({ idx, corect, totalMere, latime: cfg.latimiColoane[idx] });
      if (cfg.numerotareRanduri === "animat" && rowEls[colIndex]) {
        rowEls[colIndex].forEach((randEl) => {
          randEl.style.opacity = "0";
        });
      }
      colIndex = idx; // încheie și starea „între coloane", dacă era activă
      // Prima apăsare încheie și mărirea: micșorarea la 1 curge în aceeași tranziție de
      // 0.35s cu glisarea spre coloană. Cursa se relaxează la loc (lift mai mic ⇒ mai
      // mult drum până jos), deci trebuie recalculată aici, nu abia la următoarea
      // computeGeometry.
      scalaLift = 1;
      recalculeazaCursa();
      aplicaTransformariLift();
      lift.style.left = `${xLiftCurent()}px`; // glisare orizontală (tranziția CSS)
      rowEl.style.left = `${xLiftCurent()}px`; // sincron cu lift — v. .rigle-lift-row--ready
      actualizeazaNumerotareAnimata();
      actualizeazaMismatch();
      porneșteFovLift(); // la FIECARE apăsare — corect sau greșit, mutare reală sau re-apăsare
      // Coborâre glorioasă: dacă „Pe lift" e oprit, nu există nicio cursă FOV al cărei
      // final s-o declanșeze (vezi avanseazaFovLift) — pornește direct aici.
      if (!cfg.fovLift && corect) {
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
        btn.disabled = paused || opritDefinitiv || coborareGlorioasaActiva;
      });
    }

    // Stop dur (nu pauza userului): oprește bucla de coborâre + blochează butoanele/
    // tastele, dar NU atinge `is-paused` — quiz-ul care cere stopul își arată propriul
    // mesaj (ex. „Joc finalizat."), nu suprapunerea genrică „PAUZĂ". setOpritDefinitiv(false)
    // reia normal (folosit la reselectarea manuală a unui nivel după finalizare).
    function setOpritDefinitiv(val) {
      opritDefinitiv = val === true;
      myButtons.forEach((btn) => {
        btn.disabled = paused || opritDefinitiv || coborareGlorioasaActiva;
      });
    }

    function onPlayPauseClick() {
      setPauza(!paused);
    }
    if (playPauseBtn) playPauseBtn.addEventListener("click", onPlayPauseClick);

    // Desenată pe canvas, nu ca `background-image` repetat (cum era înainte) — vezi
    // RIGLE-REFERENCE.md gotcha #14 pentru investigația completă. Pe scurt: un model
    // CSS repetat de zeci de ori e evaluat de compozitorul browserului (de regulă pe
    // GPU, în precizie redusă); eroarea se acumulează cu fiecare repetare, deci liniile
    // ies clare aproape de originea modelului și tot mai neuniforme mai departe de ea —
    // verificat empiric (linii orizontale clare sus, spălăcite jos, în ACEEAȘI captură).
    // Nicio valoare trimisă din JS, oricât de exactă, nu putea repara asta: eroarea
    // apare DUPĂ ce `cell`/`background-position` ajung la browser. Pe canvas fiecare
    // linie e desenată o singură dată, la coordonata fizică pe care i-o dau eu — nu mai
    // există „model repetat" de acumulat eroare pe el.
    function randeazaGrila() {
      const dpr = window.devicePixelRatio || 1;
      const wPx = Math.max(1, Math.round(sceneW * dpr));
      const hPx = Math.max(1, Math.round(sceneH * dpr));
      // Redimensionarea unui canvas îi golește conținutul — evităm s-o facem când
      // dimensiunea n-a diferit (rezize-ul e apelat des: fiecare fact, fiecare
      // schimbare de layout din CP).
      if (gridEl.width !== wPx) gridEl.width = wPx;
      if (gridEl.height !== hPx) gridEl.height = hPx;

      gridCtx.clearRect(0, 0, wPx, hPx);

      if (cfg.gridVertical || cfg.gridOrizontal) {
        gridCtx.fillStyle = cfg.culoareGrila;
        // Grosimea liniei, rotunjită independent la pixeli fizici — la fel ca poziția
        // fiecărei linii mai jos, nu printr-o valoare CSS trimisă înainte.
        const grosime = Math.max(1, Math.round(dpr));
        if (cfg.gridVertical) {
          for (let x = margin; x <= sceneW + 0.01; x += cell) {
            gridCtx.fillRect(Math.round(x * dpr), 0, grosime, hPx);
          }
        }
        if (cfg.gridOrizontal) {
          for (let y = 0; y <= sceneH + 0.01; y += cell) {
            gridCtx.fillRect(0, Math.round(y * dpr), wPx, grosime);
          }
        }
      }

      randeazaContureColoane(dpr, hPx);
    }

    // Conturul coloanelor — desenat AICI, DUPĂ liniile de grilă, pe ACELAȘI canvas, ca
    // să fie mereu PESTE ele, simetric pe ambele margini (gotcha #15: cu bordura CSS de
    // dinainte, marginea stângă a fiecărei coloane era acoperită de linia de grilă de
    // la aceeași coordonată — amândouă cresc spre dreapta, deci ocupă aceiași pixeli —
    // în timp ce marginea dreaptă, care cu border-box crește spre STÂNGA/interior, nu
    // se atingea deloc cu linia de grilă de-acolo și rămânea singura vizibilă). Aici
    // ambele margini folosesc aceeași logică (interior, de la xStanga/xDreapta), deci
    // sunt simetrice prin construcție — și, fiind desenate ultimele, acoperă grila.
    // Necondiționat de cfg.gridVertical/gridOrizontal: conturul coloanei nu ține de
    // bifele „Grilă" din CP, la fel cum bordura CSS de dinainte era mereu vizibilă.
    function randeazaContureColoane(dpr, hPx) {
      gridCtx.fillStyle = CULOARE_MARGINE_COLOANA;
      const grosime = Math.max(1, Math.round(dpr));
      cfg.latimiColoane.forEach((w, i) => {
        const xStanga = Math.round(colX[i] * dpr);
        const xDreapta = Math.round((colX[i] + w * cell) * dpr);
        gridCtx.fillRect(xStanga, 0, grosime, hPx); // margine stângă, spre interior
        gridCtx.fillRect(xDreapta - grosime, 0, grosime, hPx); // margine dreaptă, spre interior
        gridCtx.fillRect(xStanga, 0, xDreapta - xStanga, grosime); // sus
        gridCtx.fillRect(xStanga, hPx - grosime, xDreapta - xStanga, grosime); // jos
      });
    }

    function setGridLines(opts) {
      if (!opts) return;
      if (typeof opts.vertical === "boolean") cfg.gridVertical = opts.vertical;
      if (typeof opts.orizontal === "boolean") cfg.gridOrizontal = opts.orizontal;
      randeazaGrila();
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
      mismatchEl.classList.remove("rigle-lift-mismatch--ready");
      randeazaFact(fact);
      requestAnimationFrame(() => {
        lift.classList.add("rigle-lift--ready");
        rowEl.classList.add("rigle-lift-row--ready");
        mismatchEl.classList.add("rigle-lift-mismatch--ready");
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
      if (typeof opts.scalaInitiala === "number") cfg.liftScalaInitiala = opts.scalaInitiala;
      if (typeof opts.pornire === "string" || opts.pornire === null) {
        cfg.liftPornire = opts.pornire;
        // Fără remount, dar nici retroactiv pe factul curent: noua poziție de pornire
        // se aplică de la următorul fact (randeazaFact). Altfel liftul ar sări din
        // dreptul coloanei deja alese, în mijlocul unei întrebări la care copilul
        // tocmai se uită.
      }
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

    // CP „Culori" (doar tabla-1-10) — 5 elemente colorabile, 2 mecanisme diferite:
    // fundal/coloane/valoriButoane sunt 3 variabile CSS aplicate pe gameEl (#game),
    // strămoș comun al lui scene (fundal/coloane) ȘI al lui buttonsBar (valori
    // butoane) — cele două trăiesc în subarbori DOM diferite (scene e în arenaEl,
    // buttonsBar e în butoaneLayer), deci proprietatea trebuie setată mai sus, nu
    // pe scene. Fallback-ul din CSS (#fbfbf3/#ffe14d/#e8eef5) rămâne implicit dacă
    // nu se cheamă niciodată — zero regresie pt. rigle-cl1, care nu apelează asta.
    // grila/numereColoane sunt scrise direct pe cfg (ca orice altă opțiune CP) —
    // gridEl/rowNumbersWrap sunt deja în subarborele lui scene, n-au nevoie de
    // variabilă CSS pe gameEl.
    function setCuloriTema(opts) {
      if (!opts) return;
      if (gameEl) {
        if (typeof opts.fundal === "string") gameEl.style.setProperty("--rigle-culoare-fundal", opts.fundal);
        if (typeof opts.coloane === "string") gameEl.style.setProperty("--rigle-culoare-coloane", opts.coloane);
        if (typeof opts.valoriButoane === "string") {
          gameEl.style.setProperty("--rigle-culoare-valori-butoane", opts.valoriButoane);
        }
      }
      // Grila și numerotarea nu trec prin CSS custom properties (nu au nevoie —
      // gridEl/rowNumbersWrap sunt în același subarbore ca scene, spre deosebire de
      // buttonsBar): se scriu direct pe cfg, ca orice altă opțiune CP, și se re-aplică
      // prin funcțiile deja existente (fără remount).
      if (typeof opts.grila === "string") {
        cfg.culoareGrila = opts.grila;
        randeazaGrila();
      }
      if (typeof opts.numereColoane === "string") {
        cfg.culoareNumerotare = opts.numereColoane;
        computeGeometry(); // rebuild rânduri cu noua culoare statică — la fel ca setNumerotareRanduri()
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
      mismatchEl.classList.add("rigle-lift-mismatch--ready");
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
      if (paused || opritDefinitiv || coborareGlorioasaActiva) return; // fără schimbare de coloană cât timp e pauză/oprit/coboară glorios
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
      if (!paused && !opritDefinitiv) {
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
          pozitioneazaMismatchTop(y); // urmărește căderea, fără să recalculeze offset-ul local
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
        // nu lăsăm culorile custom să „scurgă" spre următorul quiz montat pe gameEl
        gameEl.style.removeProperty("--rigle-culoare-fundal");
        gameEl.style.removeProperty("--rigle-culoare-coloane");
        gameEl.style.removeProperty("--rigle-culoare-valori-butoane");
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
      setOpritDefinitiv,
      setCuloriTema,
    };
  }

  global.RigleEngine = { mount };
})(window);
