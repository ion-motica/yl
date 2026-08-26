# Cl. 1 - Rigle — Referință Completă

> Acesta este fișierul central de referință pentru quiz-ul „Cl. 1 - Rigle" și motorul lui
> (m2). Reflectă starea curentă a codului, nu doar planul inițial — vezi secțiunea 11
> pentru relația cu `js/rigle/SPEC-etapa1.md`.

---

## 1. Ce este Rigle?

Quiz pentru clasa 1: copilul „măsoară" o sumă de obiecte cu **rigle** (coloane de
lățimi diferite), primind feedback vizual **înainte** de a se angaja la un răspuns
(„mură-n gură"), nu după. Mecanica + variația factelor sunt livrate; validarea și
feedback-ul pedagogic încă nu — vezi secțiunea 4.

Un lift îngust, cu întrebarea (`a+b=?`) și obiectele de numărat, coboară lent și
continuu peste 3 coloane galbene ale căror lățimi sunt cele 3 variante de răspuns
pentru sumă (una corectă, două distractori aleatori). Copilul alege o coloană (buton
sau tastă); liftul glisează acolo. Lățimea coloanei față de numărul de obiecte va
arăta (în etapele viitoare) dacă răspunsul „încape exact". La fiecare wrap al
liftului (ajunge jos, reapare sus) apare un fact nou, cu o sumă aleatoare în
intervalul reglat din CP.

---

## 2. Arhitectură: motor complet separat (m2)

Rigle **nu** trece prin `FallingEngine` (motorul 1 / m1), care rulează toate celelalte
quiz-uri din `js/quizzes/`. E un motor propriu, `RigleEngine` (m2), cu scenă proprie și
butoane proprii — zero cuplare cu `.option`/`#options`/`falling-engine.js`.

**De ce**: mecanica lui m1 dezvăluie corect/greșit *după* apăsare; Rigle are nevoie de
feedback de potrivire *înainte* de a valida — un model de interacțiune diferit, nu doar
o variație de conținut peste m1.

**Cum coexistă cu app.js** (care e centrat pe m1):

- Quiz-ul Rigle raportează `isCompleted() → true`. Bucla de cădere din
  `falling-engine.js` (`startFallLoop`), `onPick` și play/pause verifică deja
  `getQuiz().isCompleted()` înainte de a face ceva — deci m1 devine complet inert cât
  timp Rigle e activ, **fără nicio modificare în `falling-engine.js`**.
- Quiz-ul declară `customEngine: true`. `app.js` verifică acest flag în 5 puncte și, în
  loc de fluxul normal `engine.startRound(quiz.beginRound(...))`, apelează
  `quiz.mountArena(hosts)` / `quiz.unmountArena()`:
  1. `switchQuiz` — la intrare, dacă quiz-ul *anterior* era `customEngine` →
     `unmountArena()`.
  2. `switchQuiz` — la ieșire, dacă noul quiz e `customEngine` → `mountArena(...)` în
     loc de `startRound`.
  3. Startup (bootstrap-ul de la finalul `app.js`) — aceeași ramură mount vs. startRound.
  4. `buildLevelPicker` — dacă `customEngine`, golește level picker-ul și iese (Rigle nu
     are niveluri).
  5. `renderProgress` — dacă `customEngine`, ascunde bara de progres, golește
     level-info, apelează doar `renderArenaActions()`, apoi iese.

`RigleEngine.mount()`, la rândul lui, **suprimă** tot shell-ul lui m1 din interiorul
`#arena` (nu-l refolosește) — vezi secțiunea 3.

---

## 3. Contract engine (`js/rigle/engine.js` → `window.RigleEngine`)

```js
RigleEngine.mount(hosts, config) → {
  destroy(),
  setGridLines({ vertical?, orizontal? }),
  setColumnLayout({ treime? }),
  reporneste(),   // y=0 + cere fact nou prin cfg.urmatorulFact() + randează
  setNumerotareRanduri({ mod?, randuriInSus?, randuriInJos? }),  // live, §6 „Numerotează rânduri"
  setLift({ transparentaFundal?, margine?, pornire?, scalaInitiala? }),  // live, §6 „Lift".
                             // `pornire`/`scalaInitiala` se aplică de la următorul fact,
                             // nu retroactiv — vezi mai jos.
  setPozitieMere({ subNumerotare?, transparenta? }),  // live, §6 „Bara cu mere"
  setOpritDefinitiv(bool),  // stop dur (fall + butoane + taste 1/2/3), NU pauza
                             // userului — nu atinge is-paused/„PAUZĂ". Folosit de
                             // rigle-tabla-1-10.js pt. „Joc finalizat." la nivel 10.
  setCuloriTema({ fundal?, coloane?, valoriButoane?, grila?, numereColoane? }),  // live,
                             // §6 „Culori" — vezi și paragraful de mai jos (2 mecanisme).
}
```

`setCuloriTema` combină **două mecanisme diferite**, după element:

- `fundal`/`coloane`/`valoriButoane` — variabile CSS. NU se setează pe `scene` (ar fi
  natural, dar greșit): `scene` (`.rigle-scene`, în `arenaEl`) și `buttonsBar`
  (`.rigle-buttons`, în `#div-strat-butoane`, altundeva în DOM) sunt în **subarbori
  diferiți**, fără relație strămoș-descendent — o variabilă CSS setată pe `scene` NU ar
  ajunge la `.rigle-btn`. De-aia se setează pe `gameEl` (`#game`), strămoș comun al
  amândurora. CSS-ul citește `var(--rigle-culoare-fundal, #fbfbf3)` (idem
  `--rigle-culoare-coloane` pe `.rigle-col`, `--rigle-culoare-valori-butoane` pe
  `.rigle-btn`, moștenit de `.rigle-btn-num`) — dacă `setCuloriTema` nu e apelat
  niciodată (cazul `rigle-cl1.js`), fallback-ul CSS păstrează culorile hard-codate
  originale, zero regresie. La `destroy()`, cele 3 proprietăți se elimină explicit de pe
  `gameEl` (`removeProperty`) — altfel ar „scurge" spre următorul quiz montat pe `gameEl`
  (inclusiv `rigle-cl1.js`, care folosește aceleași clase CSS).
- `grila`/`numereColoane` — scrise direct pe `cfg.culoareGrila`/`cfg.culoareNumerotare`
  (ca orice altă opțiune CP), reaplicate prin `randeazaGrila()`/`computeGeometry()`, nu
  prin CSS custom properties — `gridEl`/`rowNumbersWrap` sunt deja în subarborele lui
  `scene`, n-au nevoie de o variabilă pe `gameEl`. Nu necesită cleanup la `destroy()`:
  `cfg` e reconstruit de la zero din `DEFAULTS` la fiecare `mount()`, spre deosebire de
  `gameEl`, care e un element DOM **partajat** între mount-uri succesive. Implicit
  `rgba(70, 120, 190, 0.28)`/`rgba(70, 120, 190, 0.65)` — deliberat translucide (linii
  de grilă/cifre subtile, nu solide); `numereColoane` afectează DOAR modul „toate
  rândurile" din §6 „Numerotează rânduri" — modul „animat" își păstrează gradientul HSL
  propriu (`NUMEROTARE_HUE_APROAPE`/`NUMEROTARE_HUE_DEPARTE`), neatins, un mecanism
  vizual diferit (distanță până la lift), nu „o culoare" pe care s-o suprascrii.

`hosts = { arenaEl, optionsEl, gameEl }`:

- `arenaEl` = `#arena` — aici randează m2 propria scenă (`.rigle-scene`).
- `optionsEl` = `#options` (slotul butoanelor lui m1) — folosit **doar** ca reper:
  `optionsEl.parentElement` = `#div-strat-butoane`, unde m2 își montează propria bară
  de butoane (`.rigle-buttons`). `#options` însuși e ascuns, nu refolosit.
- `gameEl` = `#game` — primește clasa `rigle-active` cât timp m2 e montat (folosită de
  CSS ca să dea fundal semitransparent butoanelor de sus ≡/CP/⏸, scoped, fără să
  atingă m1).

**La `mount()`**:
1. Ascunde (nu elimină) tot ce ține de m1: toți copiii `#arena`, `#options` întreg, și
   `#lift-fixed-host` (necesar — vezi gotcha #1 în secțiunea 9). Reține `display`
   original al fiecăruia, ca să restaureze exact la `destroy()`.
2. Construiește scena m2 și bara de butoane proprie (secțiunea 5).
3. Pornește bucla de coborâre (`requestAnimationFrame`) și ascultătorul de taste 1/2/3.
4. Observă `#arena` cu `ResizeObserver` pentru recalcul geometrie (rotire, mobil↔desktop).
5. Adaugă propriul `click` pe `#play-pause` (căutat direct prin `getElementById`, ca la
   `#lift-fixed-host`) — pauza lui m2 e complet independentă de `paused` din
   `falling-engine.js` (gotcha #12).

**La `destroy()`**: oprește bucla + tastele + listener-ul de pauză, scoate nodurile m2,
restaurează exact `display`-ul reținut pe fiecare element ascuns, scoate clasa
`rigle-active` **și** `is-paused`, resetează iconul `#play-pause` la „⏸" — motorul 1
(sau orice pornește după) nu trebuie să moștenească o stare de pauză de la Rigle.

**`config`** — ce trimite quiz-ul azi:

```js
{
  obiect: "🍏",
  coloanaInitialaIndex: 1,  // INDEX-ul coloanei pe care pornește liftul (mijloc), nu
                             // lățimea — lățimile sunt aleatoare, nu mai există o
                             // „coloană de lățime 3" garantată.
  vitezaCoborare: 34,       // px/s — mic, intenționat, pt. copii de cl. 1
  gridVertical: true,       // rezolvat de quiz din CP (secțiunea 6), nu hardcodat
  gridOrizontal: true,
  pozitieTreime: true,      // true = fiecare coloană o treime din spațiu; false = proporțional
  urmatorulFact: () => RigleFacte.genereazaFact({ sumaMin, sumaMax }),  // (§4, RigleFacte)
  liftScalaInitiala: 1,     // cât de mare reapare ansamblul lift+mere la fiecare fact
                             // (1 = neschimbat, deci zero efect pt. rigle-cl1.js; 2 = dublu).
                             // Revine animat la 1 de la prima apăsare — vezi §6 „Lift".
  liftPornire: null,        // unde reapare liftul la FIECARE fact nou (vezi §5 „Pornirea liftului"):
                             //   null = nu se atinge colIndex — rămâne pe ultima coloană apăsată
                             //          (comportamentul istoric; `rigle-cl1.js` nu trimite opțiunea)
                             //   "coloana2" / "intreColoane" — vezi §6 „Lift".
  onSelectColumn: null,     // opțional — ({idx, corect, totalMere, latime}) => void, apelat la
                             // FIECARE apăsare de coloană, înaintea efectelor vizuale. Neapelat
                             // dacă lipsește (rigle-cl1.js nu-l furnizează — zero regresie).
                             // Folosit de rigle-tabla-1-10.js pt. niveluri + jurnal, §8.
}
```

`intrebare` / `grupe` / `latimiColoane` **nu** se mai trimit din quiz — vin din
`fact = cfg.urmatorulFact()`, apelat la mount și la fiecare wrap (`randeazaFact(fact)`
mută valorile din `fact` în `cfg`, deci `cfg.latimiColoane` etc. reflectă mereu factul
curent, dar cine le setează s-a mutat din quiz în generator). `DEFAULTS` din engine
păstrează totuși `intrebare`/`grupe`/`latimiColoane`/`obiect` fixe (fallback), pentru
un `mount()` ipotetic fără `urmatorulFact` — „zero regresie" pentru orice altă folosire
a engine-ului.

Config-driven, ca variațiile viitoare (altă formă de ecuație — `?+3=5`, `21=12+?` — alt
obiect) să nu ceară cod nou în engine: vezi §4 pentru de ce geometria suportă deja un
lift mai lat decât orice coloană.

---

## 4. Ce e implementat azi vs. ce NU

**Implementat:**
- Lift care coboară continuu; la podea, `y` sare instant sus, `x` rămâne pe ultima
  coloană aleasă (fără wrap orizontal) — **și** apare un fact nou (vezi mai jos).
- Facte variabile: `a+b=?` cu `a,b>=1`, sumă aleatoare într-un interval `[min,max]`
  reglat din CP („Suma maxima", secțiunea 6), generate de `js/rigle/facte.js`
  (`window.RigleFacte`, funcții pure — algoritm detaliat în
  `js/rigle/PLAN-etapa2-variatie-facte.md` §4).
- 3 coloane, lățimile = cele 3 variante de răspuns pentru sumă (una corectă + 2
  distractori aleatori din `[suma-delta, suma+delta]`, excl. `suma`); poziția coloanei
  corecte (după sortarea crescătoare) variază aleator — nu e sistematic pe mijloc sau pe
  o poziție fixă. Alegere prin buton sau taste 1/2/3 (poziții stânga→dreapta, nu
  valoarea lățimii).
- **`delta` crește liniar cu suma**, nu e fix: `±3` la `suma=3`, `±10` la `suma=30`
  (`deltaVariante(suma)` din `facte.js`, interpolare liniară între cele două puncte,
  `Math.round`). Sume mai mari → interval mai greu de ghicit din alegerea coloanei, nu
  doar mai multe obiecte de numărat.
- Bloc rigid: obiectele din lift nu se realiniază/marchează la ieșire din ghidaj —
  pur vizual, fără logică de „încape/nu încape".
- Grilă de caiet (linii, toggle independent vertical/orizontal din CP), aliniată exact
  la marginile coloanelor indiferent de sumă (gotcha #4).
- **Feedback vizual „prea mult"/„prea puțin"**: dacă lățimea coloanei curente ≠
  `totalMere`, un dreptunghi portocaliu (`.rigle-lift-mismatch`) marchează diferența —
  peste celulele goale (coloană mai lată) sau sub merele care ies (coloană mai îngustă).
  Live, la fiecare schimbare de coloană sau fact — nu ține de „validare" (nu se
  scorează nimic).
- **Eticheta text „n e prea mic"/„n e prea mare"/„n e corect"**, sub cifra butonului
  coloanei curente (`.rigle-btn-mismatch`, `actualizeazaEtichetaButon`/`reglajEticheta`)
  — cascadă normal→word-wrap→lățire+ancorare, gated de CP „Etichete FOV" → „Pe buton".
- **FOV Lift** (`porneșteFovLift`/`avanseazaFovLift`, PLAN-fov-lift.md): la fiecare
  apăsare, un pătrățel verde zburător pornește de la poziția analitică a celulei „N" din
  coloana aterizată și zboară (homing exponențial per cadru, nu tranziție CSS) spre o
  casetă cu 2 rânduri lipită deasupra liftului — „N e prea mic/mare/corect" + „N<a+b" /
  „N>a+b" / „N=a+b". La coloana corectă, continuă spre „?" din întrebare și îl înlocuiește
  cu suma, într-un div verde care pulsează continuu, dezvăluire care rămâne până la fact
  nou. Gated de CP „Etichete FOV" → „Pe lift" / „Cu animație pt. corect". Viteza
  pătrățelului (λ de homing) e reglabilă din CP „Viteza pătrățelului" (1×-10× mai încet).
- **Coborâre glorioasă**: la coloana corectă, imediat ce cursa FOV Lift s-a terminat (sau
  imediat la apăsare, dacă „Pe lift" e oprit din CP), liftul coboară rapid până jos în
  0,8s (durată fixă, `COBORARE_GLORIOASA_DURATA`), lăsând o dâră de contururi fantomă
  (`.rigle-glorie-dara`, create/șterse dinamic) care se sting rapid. Butoanele + tastele
  1/2/3 sunt blocate cât timp durează; la final, `y=0` + fact nou, exact ca la wrap-ul
  normal. Nu depinde de nicio bifă CP — pornește mereu la coloana corectă.
- **Pauză proprie**, independentă de motorul 1 — buton `#play-pause` + tastele
  Space/p/P opresc bucla de coborâre (`y` înghețat), dezactivează butoanele `.rigle-btn`
  și arată „PAUZĂ" peste scenă (gotcha #12 pentru mecanismul exact).

**NU e implementat** (etape viitoare, neplanificate încă în cod):
- Validare cu scor/progres — coloana corectă e recunoscută vizual (`n === totalMere`,
  folosit de eticheta de pe buton, FOV Lift și coborârea glorioasă), dar nimic nu se
  scorează, nu există „răspuns dat"/„încercare" înregistrată. Avansul la întrebarea
  următoare la coloana corectă *e* implementat (coborârea glorioasă), dar fără nicio
  urmă persistentă (scor, istoric) — e doar tranziția vizuală.
- Mâna care se clatină (feedback fizic pe lift la coloană greșită).
- Alte forme de ecuație (`?+3=5`, `21=12+?`) — geometria le suportă deja (§3), dar
  generatorul azi produce doar `a+b=?`.
- Alt număr de coloane decât 3, alte obiecte decât 🍏.
- Niveluri, progres, timeout, sunet.

---

## 5. Layout vizual și geometrie

**Scena pornește SUB bara de sus** (Alege quiz/CP/Pauză), nu pe sub ea:
`computeGeometry()` măsoară live `.butoane-sus.getBoundingClientRect().height` și
scrie `scene.style.top = <înălțimea ei>px` la fiecare recalcul (fact nou, resize,
schimbare mod) — `height` rezultă singur din constrângerea top+bottom
(`position:absolute`, `inset:0` din CSS dă deja `right/bottom/left:0`). De-aici
încolo, `computeGeometry()` citește dimensiunile din `scene.getBoundingClientRect()`,
**nu** din `arenaEl` — cele două nu mai coincid. `.butoane-sus` e unic în DOM (bara
fixă a shell-ului aplicației), nu ceva specific Rigle; măsurat live, nu hardcodat,
ca să rămână corect indiferent de mărimea reală a barei.

**Straturi** în `.rigle-scene` (jos → sus, z-index crescător; la z egal, ordinea DOM
decide — elementul mai târziu în DOM picta deasupra):

| z | Element | Note |
|---|---|---|
| — | `.rigle-scene` (paper) | fundal `#fbfbf3`, `overflow: hidden`, `isolation: isolate` (gotcha #17), `--cell` = lățimea unei celule |
| 1 | `.rigle-columns` → `.rigle-col` × 3 | galbene, pe **toată** înălțimea scenei (sub bara de sus, nu și pe sub ea) |
| 1 | `.rigle-row-numbers` → `.rigle-row` | numerotarea rândurilor (CP), DOM după `.rigle-columns` → o acoperă |
| 2 | `.rigle-lift-mismatch` | dreptunghiul portocaliu „prea mult/prea puțin" — **frate** al lui `.rigle-lift`, nu copil (vezi gotcha #18) |
| 3 | `.rigle-grid` (`<canvas>`) | **doar linii** + conturul coloanelor (`randeazaContureColoane`) — peste coloane/numerotare/mismatch, dar SUB lift/mere (25.08.2026, gotcha #18); desenat pe canvas, nu `background-image` — vezi gotcha #14 |
| 4 | `.rigle-lift-row` → `.rigle-apple` × n | rândul de mere — **frate** al lui `.rigle-lift`, nu copil (vezi mai jos) |
| 5 | `.rigle-lift` | text „2+1=?" (rândul de mere ȘI dreptunghiul de mismatch NU mai sunt aici) |
| 6 | `.rigle-fov-lift` | eticheta „N e prea mic/mare/corect" de lângă lift |
| 7 | `.rigle-fov-zburator` | pătrățelul zburător (FOV Lift) |

**De ce rândul de mere (și, din 25.08.2026, dreptunghiul de mismatch) sunt frați, nu
copii ai liftului** (cerință explicită, de două ori: întâi „mere sub numerotarea
rândurilor", apoi „lift+mere peste grilă, dreptunghiul SUB grilă"): `.rigle-lift` are
`position:absolute` + `z-index` propriu, deci creează context de stivuire — orice
copil al lui, indiferent ce z-index i-ai da, tot pictează deasupra FRAȚILOR lui
`.rigle-lift` (deci nu poate ajunge, de ex., sub `.rigle-grid`, care e frate al
liftului, nu descendent), fiindcă z-index-ul unui descendent contează doar ÎN
INTERIORUL contextului părintelui, niciodată față de frații părintelui — o limitare
CSS reală (stacking context), nu un bug de implementare. Soluție, aplicată identic de
două ori: elementul e extras ca frate al lui `.rigle-lift` în `.rigle-scene`, cu
propriul z-index. Poziția (`left`/`top`) nu mai vine gratis din flex-ul/coordonatele
liftului — se scrie explicit din JS, sincron, la fiecare punct unde se scrie și
`lift.style.left/top` (`computeGeometry`, `tick`, `selectColumn`, coborârea
glorioasă).

Pentru `rowEl` (mere): folosește `rowOffsetTop` (distanța verticală constantă
lift→rând: `LIFT_INSET + qEl.offsetHeight + 4`, cache-uită în `computeGeometry()`, NU
remăsurată per cadru). Tranziția CSS de glisare orizontală (`.rigle-lift-row--ready`,
oglindă la `.rigle-lift--ready`) e comutată în aceleași locuri ca la lift.

Pentru `mismatchEl` (dreptunghiul portocaliu) — vezi gotcha #18 pentru detalii și
pentru o a doua capcană găsită pe drum (desincronizare de tranziție, nu doar de
poziție).

Coloanele și traseul liftului merg de la marginea de sus la cea de jos a `#arena` —
curg pe sub bara de sus (≡/CP/⏸) și pe sub bara de butoane (butoanele au fundal
semitransparent tocmai ca să rămână lizibile peste ele).

**Geometrie** (`computeGeometry()`, recalculată la fiecare resize și la `setColumnLayout()`):
două moduri, alese din CP (secțiunea 6), ambele populează `colX[]` + `cell`:
- **„Treime"** (`cfg.pozitieTreime = true`, implicit): arena se împarte în `N` treimi
  egale (`N` = nr. coloane); fiecare coloană stă lipită de marginea stângă a treimii ei
  (0 decalaj). `cellsPerThird = max(max(latimiColoane), totalMere) + GOL_INTRE_COLOANE`
  — nr. de celule cât să încapă mereu, în orice treime, *și* coloana ei, *și* liftul
  (bloc rigid, poate fi mai lat decât coloana îngustă pe care stă parcat — vezi „prea
  mult" din §4). `cell = floor(thirdW / cellsPerThird)`, deci
  `colX[i] = i * cellsPerThird * cell` cade mereu pe multipli exacți de `cell` —
  marginile coloanei coincid cu liniile grilei (grila nu e decor, e reperul de numărat
  pătrățele al copilului, de-aia alinierea trebuie exactă, nu aproximativă).
  **`+ GOL_INTRE_COLOANE` (=1) e obligatoriu, nu cosmetic** (adăugat 23.08.2026): fără
  el, coloana cea mai lată are lățime exact `cellsPerThird`, deci spațiu **zero** după
  ea, și se lipește de vecina din dreapta — copilul nu mai vede unde se termină una și
  începe cealaltă. Se întâmpla la **fiecare** fact unde cea mai lată coloană nu era
  ultima (măsurat: 26 din 40 de probe). Golul după coloana `i` e `(cellsPerThird −
  latimi[i]) * cell`, deci minimum garantat 1 celulă. Modul „în funcție de spațiu"
  avea deja golul lui (`gap = cell`), nu s-a atins.
- **„În funcție de spațiu"** (`cfg.pozitieTreime = false`): `cell` = `W / (Σlățimi + nGaps
  + 1)` — un gol de mărimea unei celule între coloane și pe margini (comportamentul
  original, singurul din etapa 1). Aliniată la grilă din aceleași motive (v. mai jos).
- **Pragul minim pe `cell` e `1px`, nu `14px`.** Cu sume mari (până la 30, variante până
  la 33 — vezi §4), `cellsPerThird`/`sumW` cresc mult și `cell` reală poate ajunge la
  2-3px; un prag de 14px ar forța coloanele să depășească arena (verificat: la sumă 30,
  cu prag 14px ultima coloană ajungea la ~3,7× lățimea arenei). `1` nu e plafon estetic,
  e doar apărare împotriva unei celule de 0 sau negative.
- **`totalMere` nu mai e o constantă** — se recalculează din `fact.grupe` la fiecare
  `randeazaFact()`, fiindcă numărul de obiecte variază cu factul.
- În ambele moduri: coloanele + butoanele lor primesc **același** `left`/`width`, calculat
  din `colX[i]` și `latimiColoane[i] * cell` — de-aia fiecare buton stă exact peste
  coloana lui, indiferent de mod.
- `lift.style.width` = suma obiectelor × `cell`; `travel` = înălțimea utilă minus
  înălțimea liftului.

**Mișcare**: `y` prin `requestAnimationFrame` (viteză constantă, wrap la podea); `x`
prin tranziția CSS `.rigle-lift--ready { transition: left 0.35s ease }`, aplicată abia
după primul așezare (ca liftul să nu gliseze din colț la mount).

**Mărul**: 🍏 emoji, cu halou neutru (`radial-gradient` deschis) în spatele lui prin
`.rigle-apple::before` — legibil indiferent de fundalul roșu/albastru din spate.

**Butoane m2** (`.rigle-btn`): look copiat vizual din `.option` a lui m1, dar clasă +
CSS proprii, hardcodate — zero dependență de `.option`/`#options`. Poziționate absolut
în `.rigle-buttons`, cu `left`/`width` = geometria coloanei corespunzătoare.

**Mismatch „prea mult/prea puțin"** (`.rigle-lift-mismatch`, `actualizeazaMismatch()`):
un `div` **copil al `.rigle-lift`**, poziționat analitic, nu măsurat — fiindcă
`lift.style.left = colX[colIndex]`, în sistemul de coordonate al liftului (0 = colțul
lui stâng) coloana curentă se termină exact la `latimiColoane[colIndex] * cell`,
indiferent de padding/border-ul intern al liftului:
- **Coloană mai lată** (`latime > totalMere`): `left: totalMere*cell`, `width:
  (latime-totalMere)*cell`, la `top`/`height` = `rowEl.offsetTop`/`offsetHeight`
  (astea DOAR se măsoară — depind de înălțimea randată a textului întrebării).
- **Coloană mai îngustă** (`latime < totalMere`): `left: latime*cell`, `width:
  (totalMere-latime)*cell`, `top` = sub rândul de mere (`rowEl.offsetTop +
  offsetHeight`), `height: cell` (înălțimea unui rând de pătrățele — inițial era o
  bandă subțire, `max(4, cell*0.35)`, dar era prea mică; corectat), nu peste mere.
- **Egal**: `display: none`.
Verificat empiric (ambele cazuri, valori exacte, două sume diferite) — potrivire
pixel-perfectă cu formula, nicio ajustare vizuală necesară.
Apelat din `computeGeometry()` (fact/resize/mod) și din `selectColumn()`.

---

## 6. Panoul CP — „CP — Rigle"

Urmează exact convenția panourilor CP per-quiz deja existente (`equationTonomat`,
`preEquationNav`, `sq2EffVbs`): quiz-ul expune `appendRigleControlPanel(mount)`, iar
`app.js` doar înregistrează panoul în `CpRegistry` și îl apelează din `renderRiglePanel()`
— zero logică specifică Rigle în `app.js`.

```js
CpRegistry.register({
  id: "rigle",
  title: "CP — Rigle",
  isEnabled: () => typeof quiz?.appendRigleControlPanel === "function",
  quizSpecific: true,
});
```

`quizSpecific: true` face ca `CpShell` să facă **auto-scroll** la secțiunea „CP — Rigle"
când se deschide panoul CP în timp ce Rigle e quiz-ul activ (mecanism generic din
`cp-shell.js`, adăugat pentru toate panourile per-quiz — nu e specific implementării
Rigle, dar Rigle îl moștenește automat prin flag).

Panoul are 6 secțiuni:

**„Grila"** — 2 bife independente (pot fi ambele ON/OFF):

| Bifă | Implicit | Cheie `LayoutConfig` |
|---|---|---|
| Vertical | ON | `rigleGridVertical` |
| Orizontal | OFF | `rigleGridOrizontal` |

**„Poziție coloane"** — 2 radio exclusive (exact una activă), `name="rigle-col-pozitie"`:

| Opțiune | Implicit | Valoare `rigleColoaneTreime` |
|---|---|---|
| Fiecare coloană are o treime din spațiu | ON (implicit) | `true` |
| În funcție de spațiu | OFF | `false` |

**„Suma maxima"** — 2 steppere (`-`/`input[number]`/`+`, tipar refolosit din
`pre-equations-eff-navigation.js`, clasele `.pre-eq-stepper-field`/`.pre-eq-stepper` din
`style.css` — de-aia nu are bump `style.css`):

| Câmp | Interval | Implicit | Cheie `LayoutConfig` |
|---|---|---|---|
| Minim | 1-30 | `2` | `rigleSumaMin` |
| Maxim | 1-30 | `5` | `rigleSumaMax` |

Cuplare: dacă Minim > Maxim, Maxim e împins în sus (și simetric la Maxim < Minim, Minim
coboară) — nu poate exista un interval invalid. La fiecare schimbare, ambele câmpuri se
persistă și se apelează `mounted.reporneste()`, ca efectul să fie vizibil imediat, nu
abia la următorul wrap (~20s).

**„Numerotează rânduri din coloane"** — 3 radio exclusive, `name="rigle-numerotare"`,
plus un stepper (tipar `addStepper` generalizat cu `min`/`max`/`dupaAplicare`, refolosit
de la Suma maxima — vezi §8):

| Opțiune | Valoare `rigleNumerotare` |
|---|---|
| Dezactivat (implicit) | `"dezactivat"` |
| Pe toate rândurile | `"toate"` |
| Animat fade-in pe coloana curentă | `"animat"` |

| Câmp | Interval | Implicit | Cheie `LayoutConfig` |
|---|---|---|---|
| Câte rânduri în sus | 1-50 | `10` | `rigleRanduriInSus` |
| Câte rânduri în jos | 1-50 | `10` | `rigleRanduriInJos` |

Fiecare rând de grilă din fiecare coloană arată `1..lățimeaColoanei` (aceleași cifre pe
orice rând — poziția celulei, nu un contor). **„Toate rândurile"**: statice, o singură
culoare, pe toate cele 3 coloane. **„Animat"**: doar pe coloana curentă (a liftului), o
fereastră **bidirecțională** — `randuriInSus` rânduri deasupra + `randuriInJos` rânduri
sub rândul liftului, fiecare direcție cu propriul plafon — cu opacitate 1→0 și culoare
pe un gradient HSL 205°(albastru, la lift)→320°(roz-magenta, la marginea ferestrei,
în orice direcție) — v. `NUMEROTARE_HUE_APROAPE`/`NUMEROTARE_HUE_DEPARTE` în
`engine.js`. Poziția de referință (`pozitieReper`) e **fracționară**, nu rotunjită la
rând întreg — se recalculează în fiecare cadru din `tick()`, deci opacitatea/culoarea
fiecărui rând se ajustează continuu pe măsură ce liftul coboară, nu doar o dată pe
celulă parcursă (era vizibil brusc înainte de corectare). La schimbare de coloană,
fereastra veche se golește explicit (altfel ar rămâne vizibilă pe coloana părăsită).

**„Bara cu mere"** — 2 radio exclusive, `name="rigle-mere-pozitie"`, plus un stepper:

| Opțiune | Implicit | Valoare `rigleMereSubNumerotare` |
|---|---|---|
| Sub numerotarea rândurilor | ON (implicit) | `true` |
| Deasupra numerotării rândurilor | OFF | `false` |

| Câmp | Interval | Implicit | Cheie `LayoutConfig` |
|---|---|---|---|
| Transparență bară mere | stepper 0-100 | `50` | `rigleMereTransparenta` |

Poziția e o mutare DOM (`insertBefore` pe `rowEl`/`rowNumbersWrap` unul relativ la
celălalt în `.rigle-scene`), nu un z-index diferit — amândouă rămân z-index 1; ordinea
DOM decide cine picta deasupra (§5). Transparența scrie `rowEl.style.opacity` (aceeași
formulă alfa ca la „Lift") pe **tot** rândul, nu `rgba()` doar pe culoarea de fundal —
un fundal translucid nu ar atinge emoji-ul 🍏 (glif de font, randat opac, imun la
`background`/`color` din CSS); `opacity` pe container fondează fundalul colorat, haloul
și emoji-ul într-un singur strat, care se estompează uniform.

**„Lift"** — transparența fundalului alb + afișarea marginii:

| Câmp | Interval/tip | Implicit | Cheie `LayoutConfig` |
|---|---|---|---|
| Transparență fundal alb lift | stepper 0-100 | `50` | `rigleLiftTransparentaFundal` |
| Afișează marginea liftului | bifă | ON | `rigleLiftMargine` |

**„Comportament initial lift"** — 2 radio, la finalul secțiunii „Lift", **doar la
`rigle-tabla-1-10.js`** (`rigleT110LiftPornire`, implicit `"coloana2"`), 23.08.2026:

| Opțiune | `cfg.liftPornire` | Ce face |
|---|---|---|
| Întotdeauna pe coloana 2 (implicit) | `"coloana2"` | La fiecare fact nou liftul revine pe coloana din mijloc. |
| Între 2 coloane | `"intreColoane"` | Liftul coboară pe linia dintre două coloane, **fără nicio coloană aleasă**; prima apăsare (buton sau tastă 1/2/3) îl mută pe coloană, apoi totul e normal. Golul alternează la fiecare fact: c1-c2, c2-c3, c1-c2… |

**Atenție — „Întotdeauna pe coloana 2" NU e comportamentul istoric**, e o schimbare.
Verificat empiric înainte de implementare: motorul nu reseta niciodată `colIndex` la
fact nou, deci liftul **rămânea pe ultima coloană apăsată** (apeși coloana 1 ⇒ factul
următor pornește tot de pe 1); `coloanaInitialaIndex` conta doar la primul fact.
Comportamentul vechi e păstrat de `cfg.liftPornire = null`, adică exact ce folosește
`rigle-cl1.js` — zero regresie acolo (verificat live).

Poziția „între coloane" e **mijlocul golului dintre coloanele vecine**, cu rândul de
mere centrat pe el — NU treimea arenei (`W/3`): coloanele nu-și umplu treimea (lățimi
diferite + golul garantat de o celulă, v. §5), deci `W/3` cade fix pe marginea stângă a
coloanei următoare, adică **pe** ea, nu între. `colIndex = -1` e starea „nicio coloană
aleasă"; tot codul care indexează cu `colIndex` (FOV, dâra glorioasă, eticheta de pe
buton) pornește **doar** din `selectColumn()`, care setează mereu un index valid — de
aceea starea cere gărzi doar în cele două locuri care rulează și fără apăsare:
`xLiftCurent()` (poziționarea) și `actualizeazaMismatch()` (care ascunde bara portocalie
și eticheta cât nu există coloană de comparat).

**„Dimensiune initiala lift"** — 2 radio, tot la finalul secțiunii „Lift", tot doar la
`rigle-tabla-1-10.js` (`rigleT110LiftScalaInitiala`, implicit **2**), 23.08.2026:
`Normala` (`cfg.liftScalaInitiala = 1`) / `Dubla` (`= 2`). La fiecare fact nou ansamblul
lift+mere reapare la scala aleasă și **revine la 1 de la prima apăsare**, în aceeași
tranziție de 0.35s cu glisarea spre coloană — o singură mișcare, nu două. Axă
independentă de „Comportament initial lift": se combină liber.

Detalii care nu se ghicesc din cod:
- Scalarea merge prin `transform: scale()` pe `.rigle-lift` și `.rigle-lift-row`, cu
  `transform-origin: left top`, **nu** prin lățimi/font-size recalculate: o singură
  proprietate animabilă acoperă cutia, textul întrebării ȘI merele. `offsetHeight`/
  `offsetWidth` NU văd transform-ul, de-aia `liftH`/`liftW` rămân nescalate și se
  înmulțesc explicit cu `scalaLift` unde contează.
- Rândul de mere primește `translateY(rowOffsetTop * (scala − 1))` pe lângă `scale()`.
  Motivul: `top`-ul lui e rescris la fiecare cadru din `tick()`, deci **nu** poate fi
  tranziționat — dacă decalajul vertical ar merge prin `top`, rândul ar sări instant în
  sus în timp ce cutia se micșorează lin. Prin transform, ambele curg în aceeași tranziție.
- Mărit, ansamblul se **centrează** pe reperul lui (coloana sau golul), în loc să stea cu
  marginea stângă pe el, și e împins spre centru dacă ar ieși din scenă. Clamp-ul se
  aplică **doar** cât `scalaLift !== 1`, ca poziționarea la scala 1 să rămână bit-identică
  cu cea dinainte. Dacă nici centrat nu încape (sume foarte mari), rămâne lipit stânga și
  iese în dreapta — nu se micșorează automat, ar contrazice opțiunea din CP.
  Verificat pe 60 de probe (2 moduri × 10 niveluri × 3): 6 clamp-uri reale, 0 ieșiri din scenă.
- Cursa se scurtează cât e mărit (`travel = sceneH − liftH * scalaLift`) — cerință
  explicită. `recalculeazaCursa()` rulează și din `selectColumn()`, nu doar din
  `computeGeometry()`: la micșorare cursa se relaxează la loc imediat, altfel liftul s-ar
  opri prematur până la următorul recalcul de geometrie.

`transparență=50` → `background: rgba(255,255,255,0.5)` (`alfa = (100-transparență)/100`
— 100 = complet transparent, 0 = alb opac). Bifa „margine" **nu** schimbă
`border-width` (rămâne `2px` mereu) — schimbă doar `border-color` (`#3a4a63` ↔
`transparent`), ca să nu strice invariantul de la §5 „Mismatch" (care presupune
padding+border constante).

Toate 6 secțiunile sunt **live** (`setGridLines` / `setColumnLayout` / `reporneste` /
`setNumerotareRanduri` / `setPozitieMere` / `setLift`, fără remount) și **persistă**
între reload-uri, la fel ca celelalte bife simple din CP (ex. „Afiseaza Timpi raspuns").

`rigle` a fost adăugat explicit în `DEFAULT_ORDER` din `cp-registry.js` — fără el,
panoul nu ar apărea deloc la un `localStorage` curat (doar la useri cu o ordine CP deja
salvată, unde intră automat la coadă).

---

## 7. Persistență

| Cheie `LayoutConfig` | Ce | Implicit |
|---|---|---|
| `rigleGridVertical` | linii verticale grilă | `true` |
| `rigleGridOrizontal` | linii orizontale grilă | `false` |
| `rigleColoaneTreime` | poziție coloane: treime (`true`) vs. proporțional (`false`) | `true` |
| `rigleSumaMin` | suma minimă a factului generat | `2` |
| `rigleSumaMax` | suma maximă a factului generat | `5` |
| `rigleNumerotare` | numerotare rânduri: `"dezactivat"`\|`"toate"`\|`"animat"` | `"dezactivat"` |
| `rigleRanduriInSus` | modul „animat": câte rânduri deasupra liftului rămân vizibile | `10` |
| `rigleRanduriInJos` | modul „animat": câte rânduri sub lift rămân vizibile | `10` |
| `rigleMereSubNumerotare` | bara de mere sub (`true`) vs. deasupra (`false`) numerotării | `true` |
| `rigleMereTransparenta` | transparența culorilor merelor (0-100) | `50` |
| `rigleLiftTransparentaFundal` | transparența fundalului alb al liftului (0-100) | `50` |
| `rigleLiftMargine` | afișează marginea neagră a liftului | `true` |
| `cpOrder` | ordinea panourilor CP (globală, nu doar Rigle) | — |

Nimic din progresul/răspunsurile la Rigle nu persistă încă — nicio etapă livrată n-are
validare, deci n-are ce să rețină.

---

## 8. Fișiere

| Fișier | Rol |
|---|---|
| `js/rigle/facte.js` | Generator pur de facte: `RigleFacte.genereazaFact()` / `.alegeVariante()`, zero DOM, zero `LayoutConfig`. |
| `js/rigle/engine.js` | Motorul m2: stil injectat, scenă, geometrie, coborâre, glisare, grilă, numerotare rânduri, mismatch „prea mult/puțin", stil lift, pauză proprie, randare din fact, mount/destroy/setGridLines/setColumnLayout/reporneste/setNumerotareRanduri/setLift. |
| `js/rigle/orchestrator-3-coloane.js` | `window.Orchestrator3Coloane` — rulează o rută de subquizuri pentru motorul cu 3 coloane. **NU e o variantă a lui `js/subquiz/subquiz-orchestrator.js` și cele două NU se unifică** (decizie explicită, 23.08.2026): rutarea de acolo (push/pop) ar fi fost potrivită, dar contractul de date e m1 — produce `view = {prompt, options[3], correctIndex}` (etichete text pentru `falling-engine.js`) și construiește un `Motor3Butoane` per subquiz care decide „avansează/rămâi". Motorul m2 nu consumă view-uri: **trage** un fact prin `cfg.urmatorulFact()`, randează singur, iar avansul îl decide coborârea fizică; `latimiColoane` sunt lățimi care dictează geometria, nu etichete. Adaptarea ar fi însemnat aruncarea exact a părții pentru care există orchestratorul comun. API: `creeaza({context, definitii, ruta, laRutaCompleta})` → `{urmatorulFact, laApasare, reseteaza, setRuta, idCurent, numeCurent, tureTotalePeRuta}`. Un subquiz declară `{id, nume, ture, creeaza(context)}`; terminarea e pe `ture` (număr fix) — un subquiz cu lungime variabilă va cere un `esteTerminat()`, se adaugă atunci. |
| `js/quizzes/rigle-cl1.js` | Înregistrare quiz „Adunari cu coloane verticale" în `QuizRegistry`, config, callback `urmatorulFact`, contract `customEngine`, panoul CP (`appendRigleControlPanel`, chei `LayoutConfig` prefix `rigle`). |
| `js/quizzes/rigle-tabla-1-10.js` | Clonă a `rigle-cl1.js` — quiz „Adunari cu coloane - Tabla adunarii 1-10", **același** `RigleEngine`, propriile chei `LayoutConfig` (prefix `rigleT110`) și propriul panou CP (`appendRigleTabla110ControlPanel`) — reglajele nu se amestecă cu cele ale originalului. **Nu mai folosește „Suma maxima"** — 10 niveluri, nivelul N = x+N, x=0-10; nivelul NU persistă, resetează la reselectarea quizului, ca la `addition-table-range.js`. **Un nivel = o RUTĂ completă de subquizuri** (23.08.2026), rulată de `Orchestrator3Coloane` (rând separat mai jos): `sq coloane fixe` (5 ture) → `sq bază` (4 ture) = 9 ture. Lungimea nivelului se **derivă** din rută (`RUTA` din fișier), nu invers — scoaterea unei cârje = ștergi id-ul din `RUTA`, nivelul se scurtează singur. Avansul de nivel și „Joc finalizat." se fac în `laRutaCompleta()`, la rută completă, indiferent de corectitudine. `sq bază` = comportamentul original (x din cele mai mici `FEREASTRA_INTRODUCERE=4` valori nelucrate + recoadă peste 2-3 ture la fumble; lățimi din `RigleFacte.alegeVariante`, altele la fiecare tură). `sq coloane fixe` = **același set de 3 coloane pe toate cele 5 ture**: aritmetica îl închide la exact 3 facts (x∈[0,10] ⇒ suma∈[N,N+10]; fiecare lățime w dă un singur fact, x = w−N), deci 2 din 5 ture repetă — acceptat explicit, nu e limitare de implementare. Lățimile: 3 distincte dintr-o fereastră de `LATIMI_IMPRASTIERE_MAX=4`, în ordine aleatoare stânga-dreapta, fără pas constant impus (o progresie ieșită întâmplător NU se respinge). Turele 1-3 = cele 3 facts distincte, turele 4-5 = prioritate celor ratate din prima apăsare, altfel aleator — **dar niciodată aceeași valoare de două ori la rând** (regulă anti-repetare, cerută 23.08.2026: cu coloanele fixe, un fact repetat imediat nu mai cere măsurat, e doar „apasă iar acolo"). Anti-repetarea are precedență peste prioritatea greșitelor: dacă singurul candidat prioritar e chiar cel tocmai arătat, rămâne în coadă și se servește o tură mai târziu (verificat: fumble pe tura 3 ⇒ tura 4 e alt fact, tura 5 e cel ratat). **`xLucrate` e stare la nivel de NIVEL, în contextul partajat al orchestratorului**, nu transfer sq1→bază: baza sare peste ce-a lucrat orice alt subquiz, deci un nivel acoperă 3+4=7 valori x distincte. Fiecare apăsare se loghează cu `subquiz_name`/`subquiz_id` completate (erau `null`). Corectitudinea per apăsare vine din `window.Motor3Butoane` (M3B), folosit AICI ca bibliotecă pură de bookkeeping — Rigle tot NU trece prin `falling-engine.js`. Fiecare apăsare se loghează direct în `window.JurnalIntrebari.inregistreazaIntrebare(...)` (18 câmpuri; `subquiz_name`/`subquiz_id`/`hints_aratate_pt_raspuns` rămân `null` — nu au corespondent la Rigle). La avans de nivel: flash propriu (`.rigle-t110-nivel-banner`, element separat adăugat în `hosts.arenaEl`, NU `#level-banner` din `#arena` — Rigle îl ascunde la mount, la fel ca „PAUZĂ", §9) cu textul „Felicitări! Next level!" — text și stil CSS copiate de la `addition-table-range.js`/`.level-banner`. **Niveluri REALE** (nu doar stub-uri): `getLevel`/`getMaxLevel`/`getLevelLabel`/`getLevelButtonTitle`/`switchLevel` sunt conectate la starea internă — butoanele standard din „Alege quiz" → „Alegeti nivelul:" (`app.js: buildLevelPicker`) merg direct pe acest quiz (22.08.2026: eticheta permanentă „Nivel N" din colțul stânga-sus + stepper-ul CP „Nivel curent" au fost SCOASE, înlocuite de butoanele standard — aveau o desincronizare reală, stepperul CP nu se actualiza când nivelul se schimba din altă parte). **La finalul nivelului 10**: `urmatorulFact()` NU mai wrap-uiește la 1 — cheamă `mounted.setOpritDefinitiv(true)` (nou în `engine.js`, vezi §3: stop dur, distinct de pauza userului, NU declanșează suprapunerea „PAUZĂ") și arată permanent „Joc finalizat." pe același `.rigle-t110-nivel-banner` (fără auto-ascundere). Alegerea manuală a altui nivel (buton standard sau `switchLevel`) anulează starea de finalizare (`setOpritDefinitiv(false)`, ascunde bannerul, repornește). **CP — secțiunea „Culori"** (22.08.2026, doar aici — NU pe `rigle-cl1.js`): radio „Element:" cu 3 opțiuni (Fundal `.rigle-scene`/Coloane `.rigle-col`/Valori butoane `.rigle-btn` — text, moștenit de `.rigle-btn-num`), `input[type=color]` sub radio, live prin `mounted.setCuloriTema({...})` (§3) — pe schimbare de radio, picker-ul își reafișează valoarea curentă a elementului nou selectat (fără să schimbe nimic). „Save Color": adaugă culoarea curent previzualizată într-o paletă personală, max. 10 sloturi, independentă de elemente/scheme (`rigleT110PaletaCuloriSalvate`) — plină, butonul nu mai adaugă (nu suprascrie, nu rotește); un slot completat e el însuși clickabil, aplică acea culoare pe elementul curent selectat. „Save current color scheme": grupează cele 3 culori active ACUM într-un preset (`{id, fundal, coloane, valoriButoane}`, `rigleT110SchemeCulori`), afișat ca rând cu 3 pătrățele + See/Edit/Delete — See **și** Edit aplică live cele 3 culori ale presetului (identice azi; „Edit" nu deschide un mod de rescriere-în-loc, doar un alias — dacă apare nevoia de editare reală, desparte comportamentul); Delete scoate presetul din listă. Cele 5 culori active persistă individual (`rigleT110Culoare_fundal`/`_coloane`/`_valoriButoane`/`_grila`/`_numereColoane`), aplicate la fiecare `mountArena()` prin `mounted.setCuloriTema(toateCuloriTema())` — generic, pe toate elementele din `ELEMENTE_CULOARE`, nu doar la interacțiune cu CP, ca prima randare să fie deja corectă. **„Grila" (linii verticale+orizontale, aceeași culoare) și „Numere din coloane"** (22.08.2026, extensie a listei „Element:"): la introducere, implicit-ul lor era `rgba(...)` translucid — IDENTIC cu constantele originale din engine.js (`GRID_LINE_COLOR`/`NUMEROTARE_CULOARE_STATICA`), nu o aproximare hex — ca „niciodată salvat" să nu forțeze opacitate completă la fiecare mount; doar `input[type=color]` (care nu acceptă alpha) primea o conversie hex DOAR pt. afișare (`cssColorToHex()`, prin parserul de culori al browser-ului, nu regex pe rgba). **23.08.2026: toate 5 valorile `implicit` din `ELEMENTE_CULOARE` au fost înlocuite** cu o schemă aleasă de user prin CP și codificată direct (nu doar salvată în propriul `localStorage`) — Fundal `#000040`, Coloane `#0c1d94`, Valori butoane `#e8eef5` (neschimbat), Grila `#305506`, Numere din coloane `#fdec73` — toate opace acum (Grila/Numere din coloane și-au pierdut transparența implicită, schimbare intenționată). O valoare deja salvată în `LayoutConfig` de un user care a personalizat din CP rămâne prioritară față de acest implicit (neafectată de schimbare — `getCuloareElement` citește mereu salvatul înaintea lui `def.implicit`). Scheme salvate ÎNAINTE de această extensie au doar 3 câmpuri — `aplicaSchema()`/randarea rândului de pătrățele ignoră (nu suprascriu cu `undefined`, care ar ȘTERGE cheia din `LayoutConfig`) elementele lipsă dintr-un preset vechi. Singurul cod nou de motor: `cfg.onSelectColumn` + `setOpritDefinitiv` + `setCuloriTema` (vezi §3) — restul rămâne config-driven. |
| `js/app.js` | 5 branch-uri `customEngine` (mount/unmount + guard-uri, generice — nu știu care quiz Rigle e activ) + `renderRiglePanel()`/`renderRigleTabla110Panel()` (câte una per clonă, hardcodate pe metoda ei). |
| `js/cp-registry.js` | `"rigle"` și `"rigleTabla110"` în `DEFAULT_ORDER`. |
| `index.html` | `<script>` pentru `facte.js` → `engine.js` → `rigle-cl1.js` → `rigle-tabla-1-10.js` (ordinea contează), înainte de `app.js`. |
| `tests/rigle-facte.test.js` | Teste pentru `facte.js` (distribuția pozițiilor, cazuri-limită sumă 2/30) — `node --test`. |
| `js/rigle/SPEC-etapa1.md` | Specificația inițială de implementare (istoric — vezi secțiunea 11). |
| `js/rigle/PLAN-etapa2-variatie-facte.md` | Plan facte variabile + variante (istoric — implementat, vezi secțiunea 11). |
| `documente de referinta/RIGLE-REFERENCE.md` | Acest fișier — referință curentă. |

Stilul e injectat din JS (`injectStyles()`, ca la `facts din coloane animate`) —
`style.css` **nu** e atins de Rigle.

---

## 9. Gotchas cunoscute

1. **`#lift-fixed-host` trebuie ascuns separat.** În modul „bară fixă" (implicit prin
   ASNW), conținutul liftului lui m1 stă acolo, **în afara** `#arena` — ascunderea
   copiilor `#arena` singură nu-l acoperă. Dacă reapare o bară cu conținut de tip
   „1=?:2" peste scena Rigle, aici e cauza.
2. **`DEFAULT_ORDER` trebuie să conțină id-ul panoului CP.** `CpRegistry.getOrder()`
   cade pe `DEFAULT_ORDER.filter(id => panels.has(id))` când nu există încă o ordine
   salvată (`localStorage` curat) — un panou nou, neadăugat acolo, pur și simplu nu
   apare pentru useri noi.
3. **Nu confunda tastele 1/2/3 cu lățimile 2/3/4.** Tastele selectează *poziția*
   coloanei (stânga/mijloc/dreapta), nu valoarea ei — coincide cu ordinea butoanelor,
   nu cu cifrele scrise pe ele.
4. **Grila trebuie să cadă exact pe marginile coloanelor, în ambele moduri.** Nu e decor
   de caiet — e reperul copilului pentru „câte pătrățele mai trebuie până la rezultat".
   În ambele moduri, `colX[i]` se construiește ca multiplu întreg de `cell` pornind din
   același `margin`/`0` ca `gridEl.style.backgroundPosition` — dacă modifici formula de
   geometrie, păstrează invariantul ăsta (nu introduce un decalaj independent de `cell`,
   cum a fost `TREIME_GAP` inițial — greșeală corectată).
5. **Rândul de mere are voie să depășească padding-ul cutiei liftului — nu „repara".**
   Cutia liftului are `padding: 4px` + `border: 2px`; rândul de mere (`totalMere * cell`)
   poate fi mai lat decât spațiul interior. Centrarea flex simetrică anulează exact acel
   padding, iar marginea stângă a rândului ajunge tot pe `colX` — verificat: la o coloană
   de 93px, rândul iese 5,6px de fiecare parte și marginea stângă cade exact pe grilă.
   `overflow: hidden` sau schimbarea `box-sizing` ar strica alinierea merelor la grilă.
6. **La schimbare de fact, tranziția orizontală a liftului se suprimă temporar.**
   `schimbaFact()` scoate clasa `.rigle-lift--ready` înainte de `randeazaFact()` și o
   pune la loc pe `requestAnimationFrame` — altfel, cum lățimile coloanelor (deci
   `colX[colIndex]`) se schimbă exact când `y` sare la 0, liftul ar **glisa** lateral
   vizibil în loc să sară instant, ca un bug de mișcare.
7. **`.rigle-lift-q` (textul întrebării) e singurul element din scenă cu mărime FIXĂ
   (`19px`), nu proporțională cu `--cell`.** Intenționat — cerință explicită („textul
   să nu se micșoreze"), diferit de tot restul scenei, care scalează cu `--cell`. Nu
   reintroduce `calc(var(--cell) * ...)` aici fără să verifici mai întâi overflow-ul la
   `suma=30`: cutia liftului poate ajunge la 90px lățime, iar un text de tipul
   „10+20=?" la 19px ocupă ~79px — verificat empiric pe ~95 de facte la sumă 30, nu
   iese niciodată din cutie, dar marja scade sub 15px în cazurile cele mai lungi
   (2 cifre + 2 cifre pe ambii termeni). Mărul (`.rigle-apple-emoji`) rămâne proporțional
   cu `--cell` — doar textul întrebării e fix.
8. **Numerotarea rândurilor se creează o singură dată (nu în fiecare cadru).**
   `randeazaNumerotare()` rulează din `computeGeometry()` (mount, resize,
   `setColumnLayout`, fact nou) și rebuild-uiește tot (`.rigle-row` per linie de grilă
   × 3 coloane — la sumă mare, zeci de mii de noduri, dar creat o dată, nu pe cadru).
   Doar modul „animat" scrie ceva pe `tick()`, și scrie `opacity`/`color` pe
   **wrapper-ul de rând** (`.rigle-row`), niciodată pe cifrele individuale
   (`.rigle-row-cell`, `color: inherit`) — de-aia actualizarea per-cadru costă
   `maxRanduri` scrieri de style, nu `maxRanduri × lățime`. Nu muta stilul pe cifre
   individuale fără un motiv concret — anulează exact optimizarea asta.
9. **`requestAnimationFrame` se oprește când tab-ul nu e vizibil** (`document.hidden`).
   La testare automată în panoul de preview: dacă pare că liftul „nu cade" deloc după
   ce aștepți, verifică `document.visibilityState` înainte să bănuiești un bug de
   mișcare — dacă panoul Browser nu e afișat activ, rAF-ul motorului e throttled de
   browser, nu de cod.
10. **Ascunderea marginii liftului schimbă `border-color`, nu `border-width`.** Dacă ai
    fi scos bordura din tot (`border: none` sau `border-width: 0`), `box-sizing:
    border-box` ar fi redistribuit spațiul — ar fi mutat cu 2px centrarea rândului de
    mere (gotcha #5) și, prin extensie, coordonatele lui `.rigle-lift-mismatch` (§5).
    Culoarea devine `transparent`; cutia rămâne identică geometric.
11. **`.rigle-lift-mismatch` se poziționează analitic (`totalMere*cell`,
    `latimiColoane[colIndex]*cell`), nu citind `rowEl.offsetLeft`.** Măsurat empiric:
    `rowEl.offsetLeft` variază câțiva px (centrare flex + `gap`) și **nu** e o bază de
    calcul stabilă pentru orizontală. Verticala (`rowEl.offsetTop`/`offsetHeight`)
    chiar trebuie măsurată — depinde de înălțimea randată a textului, fără formulă
    simplă. Nu schimba orizontala pe măsurare fără motiv.
12. **Pauza lui m2 NU tratează Space/p/P în `onKey` — bug real, găsit la testare.**
    `falling-engine.js` are propriul `document.addEventListener("keydown", ...)`,
    **negardat** de `isCompleted()`, care apelează necondiționat
    `dom.playPauseBtn.click()` pentru Space/p/P, indiferent ce quiz e activ — deci
    tasta ajunge oricum la `#play-pause`, care are și listener-ul lui m2
    (`onPlayPauseClick`). Dacă `onKey` din `engine.js` AR fi tratat și el direct
    Space/p/P (apelând `setPauza()`), o singură apăsare ar fi comutat pauza **de
    două ori** (o dată din `onKey`, o dată din click-ul sintetic al lui m1) — anulare
    reciprocă, tasta părea că nu face nimic. `onKey` din m2 tratează **doar** 1/2/3;
    pauza vine exclusiv prin click pe `#play-pause` (real sau sintetic din m1).
    Simetric, click-ul direct pe buton merge normal (listener-ul lui m1 pe click
    *este* gardat de `isCompleted()`, deci nu interferează).
13. **`#arena` NU se termină deasupra barei de butoane — bara stă ÎNĂUNTRUL casetei
    arenei.** Măsurat live (23.08.2026, viewport 655px): arena `0-655`, `.rigle-buttons`
    `491-655`. Deci `bottom: 0` pe un element din `#arena` cade **peste** butoane, nu
    deasupra lor — greșeală făcută și corectată la eticheta de subquiz din
    `rigle-tabla-1-10.js`. Orice suprapunere care trebuie să stea deasupra butoanelor
    se ancorează cu `bottom: calc(var(--rigle-inaltime-butoane) + gap)`. Variabila e
    definită de `engine.js` pe `.rigle-active` (`clamp(126px, 25dvh, 252px)`) și e
    **aceeași** cu `height`-ul lui `.rigle-buttons` — nu copia valoarea, `25dvh` se
    schimbă la rotire/redimensionare și copia ar rămâne în urmă (verificat: la bară de
    164px→250px, eticheta rămâne fix la 4px deasupra).
14. **Grila se desena neuniform (linii orizontale clare sus, spălăcite jos, în ACEEAȘI
    captură) — motorul are acum grilă pe `<canvas>`, nu `background-image` repetat**
    (raportat 25.08.2026, cu 2 rânduri de capturi). Istoricul e important, fiindcă
    prima reparație a fost insuficientă — nu de aruncat din memorie:
    - **Diagnostic 1 (corect, dar incomplet):** geometria era exactă — verificat
      înainte de orice modificare: coloanele la 0/11/22 celule fix, cifrele
      numerotării exact o celulă, `background-position` 0. Nimic greșit în calcule.
    - **Fix 1 (insuficient):** aliniat `cell`/`margin`/grosimea liniei la pixeli
      FIZICI întregi (`laPixeliFizici()`, acum șters). Ipoteza: la DPR fracționar
      (1.25), o celulă de 9px CSS = 11,25 px fizici, fiecare repetare a dalei
      `background-size` cade pe altă fracțiune de pixel. Reducea vizibil problema,
      dar userul a raportat din nou banding **după Ctrl+F5** (deci nu era cache) —
      fix-ul nu elimina cauza, doar o atenua.
    - **Diagnostic 2 (cauza reală):** un `background-image` repetat de zeci de ori
      pe o suprafață mare e evaluat de compozitorul browserului (de regulă GPU, în
      precizie redusă, ~float32); eroarea se ACUMULEAZĂ cu fiecare repetare — de-aia
      liniile ies clare aproape de originea modelului (`background-position`) și tot
      mai neuniforme mai departe de ea, în ACEEAȘI randare. Nicio valoare trimisă din
      JS, oricât de exactă, nu putea repara asta: eroarea apare DUPĂ ce `cell`/
      `background-position` ajung la browser — verificat că propriul calcul se
      întorcea exact (`Math.floor(x*1.25)/1.25 * 1.25` exact întreg, testat cu node).
    - **Fix 2 (definitiv):** `.rigle-grid` a devenit `<canvas>` (`gridEl` +
      `gridCtx`, `randeazaGrila()` înlocuiește `applyGridLines()`). Fiecare linie se
      desenează O SINGURĂ DATĂ, cu `fillRect` la o coordonată fizică rotunjită
      independent (`Math.round(x * dpr)`) — nu mai există „model repetat" pe care să
      se acumuleze eroare. `laPixeliFizici()` a devenit inutilă (motivul ei era
      strict despre dala repetată) și a fost ștearsă; `cell`/`margin` s-au întors la
      formulele simple dinainte (`Math.floor`/`Math.round`, fără aliniere la DPR) —
      nu mai contează pentru grilă, iar pentru coloane/butoane (elemente simple, nu
      modele repetate) n-a fost niciodată problema.
    - **Verificat prin citire de pixeli, nu capturi** (`canvas.getContext("2d").
      getImageData()`): pe 37 de linii verticale × toată înălțimea (717 px fizici,
      eșantionat din 7 în 7) și 64 de linii orizontale × toată lățimea — ZERO variații
      de alpha. Capturile de ecran mint la decupare/scalare (verificat separat: două
      decupaje din aceeași imagine pot părea că au celule de forme diferite doar din
      cauza redimensionării) — pixelii citiți din canvas nu.
    - Se aplică ambelor quizuri Rigle (motor comun).
    **Atenție la măsurare (rămâne valabil):** `getBoundingClientRect()` întoarce
    valori cu zgomot de virgulă mobilă (`135.99999904632568` în loc de `136`), deci
    un test „poziția × DPR e întreagă?" pe rect dă fals-negativ — verifică pe
    `el.style.left` (elemente poziționate din JS) sau, pt. canvas, pe pixelii citiți
    din `getImageData()`, nu pe `getBoundingClientRect()`.
15. **Bordura `.rigle-col` apărea DOAR pe marginea dreaptă a fiecărei coloane, pe
    toate coloanele — cauză geometrică, nu de precizie** (raportat 25.08.2026, imediat
    după gotcha #14, cu 2 capturi arătând aceeași linie chihlimbarie `#e6c02a` pe toate
    3 coloanele; userul a corectat explicit diagnosticul inițial „compozitor GPU" ca
    supra-complicat — cauza era la o comandă concretă, nu la o teorie). Border-ul CSS
    (`border: 1px solid #e6c02a`, `box-sizing: border-box`) se desenează SPRE INTERIORUL
    box-ului de la fiecare margine: marginea stângă ocupă pixelii `[left, left+bw)` —
    crește spre DREAPTA; marginea dreaptă ocupă `[left+width-bw, left+width)` — crește
    spre STÂNGA. Linia de grilă de pe canvas (gotcha #14), la aceeași coordonată, crește
    mereu spre dreapta (`fillRect(x, y, grosime, h)`). La marginea stângă a coloanei,
    border-ul și linia de grilă ocupă EXACT aceiași pixeli (amândouă cresc spre
    dreapta) — grila (desenată peste, z-index mai mare) acoperea complet border-ul. La
    marginea dreaptă, border-ul crește spre stânga iar linia de grilă de-acolo crește
    spre dreapta — ocupă pixeli ADIACENȚI, NU se ating — border-ul rămânea singurul
    vizibil. Verificat cu node înainte de reparație (nu doar presupus): ambele margini
    ale oricărei coloane cad pe multipli întregi de `cell` (deci matematic „la fel"),
    ceea ce a arătat că asimetria nu putea veni din calculul de poziție, ci din
    DIRECȚIA de desenare a border-ului CSS vs. a liniei de grilă.
    **Reparat mutând conturul pe același canvas ca grila** (`randeazaContureColoane()`,
    apelată necondiționat la finalul `randeazaGrila()`, DUPĂ liniile de grilă — deci
    mereu PESTE ele, pe ambele margini deopotrivă, simetric prin construcție: aceeași
    logică „spre interior" aplicată identic la stânga și la dreapta). `.rigle-col` CSS
    păstrează `border: 1px solid transparent` (doar pt. `box-sizing`, culoarea a
    dispărut) — `border-radius: 6px` rămâne (rotunjește fundalul), dar conturul desenat
    pe canvas are colțuri drepte — mic compromis vizual acceptat, necerut de user.
    Culoarea (`CULOARE_MARGINE_COLOANA = "#e6c02a"`) a rămas hard-codată, ca înainte —
    nu ține de CP „Culori" (acela are `grila`, un element separat). Necondiționat de
    `cfg.gridVertical`/`gridOrizontal`: conturul coloanei nu ține de bifele „Grilă",
    la fel cum border-ul CSS de dinainte era mereu vizibil, indiferent de ele.
    **Verificat prin citire de pixeli** pe toate 3 coloanele, ambele margini, la 2
    configurații diferite de lățimi: exact `rgb(230,192,42,255)`, fără excepție.
    Se aplică ambelor quizuri Rigle (motor comun).
16. **`<canvas>` NU se întinde cu `inset: 0` — are nevoie de `width/height: 100%`**
    (raportat 25.08.2026: pe telefon „grila nu se mai potriveste deloc" cu coloanele,
    liftul și conturul). `canvas` e element **replaced** (ca `img`/`video`): are mărime
    naturală proprie — dimensiunea bitmap-ului, interpretată în px CSS — iar
    `position:absolute; inset:0` **nu** o suprascrie, cum făcea la `<div>`-ul cu
    `background-image` de dinainte. Am schimbat div→canvas păstrând aceeași clasă CSS,
    fără să știu că regula se comportă diferit pe alt tip de element. Efect: bitmap-ul
    e `sceneW * dpr` lat, dar se AFIȘA la `sceneW * dpr` px CSS (nu `sceneW`), deci tot
    ce desenam pe canvas apărea deplasat cu **factorul dpr**, proporțional cu distanța
    față de marginea stângă. Măsurat pe mobil (dpr 2): scena 375×668, caseta canvas-ului
    750×1336; coloana 2 la 117px CSS, dar conturul ei desenat apărea la 234px —
    **decalaj 117px**; coloana 3, decalaj 234px. Prima coloană părea mereu corectă
    (0 × dpr = 0), de-aia bug-ul se citea ca „merge pe PC". Pe desktop dpr era 1.25,
    deci eroarea de 25% se pierdea vizual într-o grilă deasă; pe telefon (dpr 2-3) sare
    în ochi. **NU e un bug de mobil — e același bug peste tot, doar amplificat de dpr.**
    Reparat adăugând `width: 100%; height: 100%` pe `.rigle-grid` (bitmap-ul rămâne la
    `dpr`, doar caseta de afișare e forțată la mărimea scenei). Verificat după reparație:
    caseta canvas = exact caseta scenei, 1 px bitmap = `1/dpr` px CSS, decalaj max **0px**
    pe mobil (dpr 2) ȘI pe desktop, la ambele quizuri Rigle.
    **Lecție de verificare (importantă):** verificarea inițială „prin citirea pixelilor"
    a ratat complet bug-ul fiindcă era **circulară** — citeam bitmap-ul la poziția
    `round(colX * dpr)`, exact formula cu care desenam, deci se potrivea mereu. Dovedea
    doar că aritmetica mea e consecventă cu ea însăși, nu că rezultatul ajunge pe ecran
    peste coloane. Ca să fie validă, verificarea trebuie să compare **geometria AFIȘATĂ
    a canvas-ului** (`canvas.getBoundingClientRect()`, raportul `cr.width/canvas.width`)
    cu **pozițiile reale ale elementelor DOM** — două surse independente, nu formula
    proprie cu ea însăși.
17. **`z-index` negativ pe `.rigle-grid` a făcut grila să dispară COMPLET (nu doar sub
    coloane) — cauza era `.rigle-scene`, nu grila** (25.08.2026: cerere „grila în
    fundal" → implementat `z-index: -1` → raportat „acum nu văd grila deloc", cu
    captură confirmând dispariția totală, inclusiv în golurile dintre coloane, unde
    nimic n-ar fi trebuit s-o acopere). `.rigle-scene` are `position: absolute` dar
    **fără** `z-index` propriu (`auto`) — conform spec CSS, un element poziționat cu
    `z-index:auto` **nu-și creează propriul context de stivuire**. Deci `z-index`-urile
    copiilor ei (grilă, coloane, lift) nu se comparau între ele, ci cu orice altceva mai
    sus în arbore, la prima ascendență cu context real de stivuire — o valoare negativă
    a împins grila sub un strat opac de undeva mult mai sus, invizibil oriunde, nu doar
    sub coloane. **Verificat live înainte de reparație** (nu presupus): setând temporar
    `scene.style.zIndex = "0"` direct în consolă, grila a reapărut instant — vizibilă în
    goluri, ascunsă sub coloane — confirmând că problema era contextul lipsă, nu
    valoarea `-1` în sine. Bug-ul exista **dinainte**, tăcut: cu valori pozitive mici
    (1-4, cum aveau grila/coloanele/liftul până acum), „scăpatul" din scenă nu se vedea,
    fiindcă acele numere ieșeau oricum deasupra a orice s-ar fi nimerit mai sus în
    arbore — abia negativul l-a scos la iveală.
    **Reparat cu `isolation: isolate` pe `.rigle-scene`** (nu `z-index: 0` — acela ar fi
    putut muta scena față de PROPRII ei frați din `#arena`; `isolation: isolate` forțează
    un context de stivuire nou fără alt efect secundar). Cu asta, `z-index`-urile
    interne (grilă, coloane, lift, FOV) redevin corect izolate, indiferent de valoare.
    **Decizia de design** (după testarea variantei „fundal"): varianta „fundal" a fost
    respinsă explicit, fiindcă face grila inutilă exact unde contează, peste coloanele
    opace, unde copilul numără pătrățele ca să măsoare — grila a rămas z-index 3, peste
    coloane/numerotare. Dar imediat după (aceeași zi), o cerere separată a scos
    lift/mere/mismatch de sub ea — vezi gotcha #18 pentru forma finală (grila nu mai e
    „peste tot", doar peste coloane/numerotare/conturul lor).
18. **„Lift+mere peste grilă, dreptunghiul portocaliu SUB ea" — o cerere simplă, o
    restructurare reală** (25.08.2026, imediat după gotcha #17). Grila (z-index 3) era
    deasupra liftului (2) și a rândului de mere (1) — cerință: inversează asta, DAR
    dreptunghiul de mismatch (copil al liftului până atunci) trebuie să rămână sub
    grilă. Un copil nu poate ieși sub un frate al părintelui lui (aceeași limitare de
    stivuire ca la gotcha „rândul de mere e frate, nu copil", mai sus) — dacă liftul
    urcă deasupra grilei, orice-i e copil urcă silit cu el. Soluție: `mismatchEl`
    extras ca frate al lui `.rigle-lift` în `.rigle-scene` (a doua oară, după `rowEl`),
    cu z-index propriu (2, sub grilă). Z-index-urile finale:
    coloane/numerotare (1) < mismatch (2) < grilă (3) < mere (4) < lift (5) <
    FOV lift (6) < FOV zburător (7) — FOV a trebuit și el urcat, ca să rămână deasupra
    liftului (invariant preexistent, nu cerut explicit acum, dar păstrat din prudență).
    **A doua capcană, mai subtilă — desincronizare de TRANZIȚIE, nu doar de poziție.**
    Cât timp `mismatchEl` era copil, se mișca „gratis" cu liftul (glisarea orizontală
    de 0,35s a liftului mișca automat tot ce era înăuntru). Ca frate, poziția lui se
    scrie direct din JS (`xLiftCurent()` întoarce ținta FINALĂ, nu o valoare
    intermediară) — fără o tranziție proprie, ar SĂRI instant la noua poziție în timp
    ce lift/rowEl alunecă lin spre aceeași țintă, o desincronizare vizibilă. Găsită la
    verificare (nu presupusă): am eșantionat poziția din 60 în 60ms în timpul
    glisării și am văzut `mmLeft` constant deasupra/dedesubtul lui `liftLeft` cu o
    diferență care se schimbă — semn că nu se mișcă împreună. Reparat adăugând
    `.rigle-lift-mismatch--ready` (`transition: left 0.35s ease`), comutată exact ca
    `.rigle-lift--ready`/`.rigle-lift-row--ready` (scoasă înainte de `randeazaFact`,
    pusă la loc pe `requestAnimationFrame`, ca să nu alunece din colț la MOUNT).
    **Poziționare, complet**: `mismatchLocalLeft`/`mismatchLocalTop` (variabile cache,
    lângă `rowOffsetTop`) rețin offset-ul NEscălat, relativ la lift, calculat doar în
    `actualizeazaMismatch()` (depinde de `totalMere`/lățimea coloanei, nu de cadru).
    Poziția FINALĂ = `xLiftCurent()`/`Math.min(y,travel)` (poziția curentă a liftului)
    `+ offset_local * scalaLift` — multiplicarea cu `scalaLift` (nu un `transform:
    scale()` separat, ca la `rowEl`) reproduce matematic exact ce ar fi dat un copil
    scalat de la originea liftului (`final = origine + local*scală`), mai simplu de
    verificat pe două axe decât compensarea prin `translateX/Y` folosită la `rowEl`
    (care are nevoie de ea doar pe verticală, fiindcă orizontal nu are niciun offset
    față de lift). `pozitioneazaMismatchTop(y)` se cheamă separat, din `tick()` și
    `avanseazaCoborareaGlorioasa()` — la fel ca `rowEl.style.top`, NU recalculează
    logica „prea mult/prea puțin", doar reaplică offset-ul deja cache-uit peste noua
    poziție a liftului, ca mismatch-ul să urmărească vizual căderea continuă fără
    costul unui recalcul complet la fiecare cadru.
19. **Toate z-index-urile scenei sunt adunate în `zIndexRigle()`** (25.08.2026, cerere
    explicită „ca să poți modifica ușor" — refactor pur, `const Z = zIndexRigle();`,
    fără nicio schimbare de valoare/comportament, verificat: toate z-index-urile
    calculate identice cu înainte). Schimbă valorile ACOLO (parametrii funcției), nu
    umblând prin CSS — tabelul de straturi de mai sus rămâne descrierea ordinii
    RELATIVE, dar sursa de-adevăr pentru valorile EXACTE e acum funcția, nu CSS-ul.

---

## 10. Unde sa caut rapid

- Comportament mișcare/geometrie/grilă: `js/rigle/engine.js`.
- Config etapa 1, contract `customEngine`, panou CP: `js/quizzes/rigle-cl1.js`.
- Cum e ținut m1 în standby, cele 5 branch-uri: `js/app.js`, caută `customEngine`.
- Ordinea implicită a panoului CP: `js/cp-registry.js`, `DEFAULT_ORDER`.

---

## 11. Relația cu documentele de plan (istorice)

`js/rigle/SPEC-etapa1.md` (scop/non-scop, riscuri, criterii de succes falsificabile
pentru etapa 1 — doar mișcarea) și `js/rigle/PLAN-etapa2-variatie-facte.md` (facte
variabile + variante de răspuns, cu deciziile userului și algoritmul detaliat) sunt
artefacte de planificare — rămân ca istoric al deciziilor, ambele **implementate**, dar
**niciunul nu mai e actualizat pas cu pas**. Acest fișier (`RIGLE-REFERENCE.md`) e sursa
curentă de adevăr; actualizează-l pe *acesta* când se schimbă mecanica, contractul sau
integrarea — nu documentele de plan.
