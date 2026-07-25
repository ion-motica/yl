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
}
```

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

**La `destroy()`**: oprește bucla + tastele, scoate nodurile m2, restaurează exact
`display`-ul reținut pe fiecare element ascuns, scoate clasa `rigle-active`.

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

**NU e implementat** (etape viitoare, neplanificate încă în cod):
- Validare (nicio verificare corect/greșit) — `indexCorect` din fact e transportat, dar
  nefolosit.
- Feedback: pătrățele portocalii, „Prea mult"/„Prea puțin", mână care se clatină, clipit.
- Efect de succes, afișarea rezultatului („2+1=**3**"), coborâre glorioasă, avans la
  întrebarea următoare.
- Alte forme de ecuație (`?+3=5`, `21=12+?`) — geometria le suportă deja (§3), dar
  generatorul azi produce doar `a+b=?`.
- Alt număr de coloane decât 3, alte obiecte decât 🍏.
- Niveluri, progres, timeout, sunet.

---

## 5. Layout vizual și geometrie

**Straturi** în `.rigle-scene` (jos → sus, z-index crescător):

| z | Element | Note |
|---|---|---|
| — | `.rigle-scene` (paper) | fundal `#fbfbf3`, `overflow: hidden`, `--cell` = lățimea unei celule |
| 1 | `.rigle-columns` → `.rigle-col` × 3 | galbene, pe **toată** înălțimea `#arena` |
| 2 | `.rigle-lift` | text „2+1=?" + rând de `.rigle-apple` |
| 3 | `.rigle-grid` | **doar linii**, peste tot — inclusiv peste coloane și peste lift |

Coloanele și traseul liftului merg de la marginea de sus la cea de jos a `#arena` —
curg pe sub bara de sus (≡/CP/⏸) și pe sub bara de butoane (butoanele au fundal
semitransparent tocmai ca să rămână lizibile peste ele).

**Geometrie** (`computeGeometry()`, recalculată la fiecare resize și la `setColumnLayout()`):
două moduri, alese din CP (secțiunea 6), ambele populează `colX[]` + `cell`:
- **„Treime"** (`cfg.pozitieTreime = true`, implicit): arena se împarte în `N` treimi
  egale (`N` = nr. coloane); fiecare coloană stă lipită de marginea stângă a treimii ei
  (0 decalaj). `cellsPerThird = max(max(latimiColoane), totalMere)` — nr. de celule cât
  să încapă mereu, în orice treime, *și* coloana ei, *și* liftul (bloc rigid, poate fi
  mai lat decât coloana îngustă pe care stă parcat — vezi „prea mult" din §4). `cell =
  floor(thirdW / cellsPerThird)`, deci `colX[i] = i * cellsPerThird * cell` cade mereu pe
  multipli exacți de `cell` — marginile coloanei coincid cu liniile grilei (grila nu e
  decor, e reperul de numărat pătrățele al copilului, de-aia alinierea trebuie exactă,
  nu aproximativă).
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

Panoul are 3 secțiuni:

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

Toate 3 secțiunile sunt **live** (`setGridLines` / `setColumnLayout` / `reporneste`,
fără remount) și **persistă** între reload-uri, la fel ca celelalte bife simple din CP
(ex. „Afiseaza Timpi raspuns").

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
| `cpOrder` | ordinea panourilor CP (globală, nu doar Rigle) | — |

Nimic din progresul/răspunsurile la Rigle nu persistă încă — nicio etapă livrată n-are
validare, deci n-are ce să rețină.

---

## 8. Fișiere

| Fișier | Rol |
|---|---|
| `js/rigle/facte.js` | Generator pur de facte: `RigleFacte.genereazaFact()` / `.alegeVariante()`, zero DOM, zero `LayoutConfig`. |
| `js/rigle/engine.js` | Motorul m2: stil injectat, scenă, geometrie, coborâre, glisare, grilă, randare din fact, mount/destroy/setGridLines/setColumnLayout/reporneste. |
| `js/quizzes/rigle-cl1.js` | Înregistrare quiz în `QuizRegistry`, config, callback `urmatorulFact`, contract `customEngine`, panoul CP. |
| `js/app.js` | 5 branch-uri `customEngine` (mount/unmount + guard-uri) + `renderRiglePanel()`. |
| `js/cp-registry.js` | `"rigle"` în `DEFAULT_ORDER`. |
| `index.html` | `<script>` pentru `facte.js` → `engine.js` → `rigle-cl1.js` (ordinea contează), înainte de `app.js`. |
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
