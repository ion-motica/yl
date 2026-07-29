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
  setLift({ transparentaFundal?, margine? }),  // live, §6 „Lift"
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

Panoul are 5 secțiuni:

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

**„Lift"** — transparența fundalului alb + afișarea marginii:

| Câmp | Interval/tip | Implicit | Cheie `LayoutConfig` |
|---|---|---|---|
| Transparență fundal alb lift | stepper 0-100 | `50` | `rigleLiftTransparentaFundal` |
| Afișează marginea liftului | bifă | ON | `rigleLiftMargine` |

`transparență=50` → `background: rgba(255,255,255,0.5)` (`alfa = (100-transparență)/100`
— 100 = complet transparent, 0 = alb opac). Bifa „margine" **nu** schimbă
`border-width` (rămâne `2px` mereu) — schimbă doar `border-color` (`#3a4a63` ↔
`transparent`), ca să nu strice invariantul de la §5 „Mismatch" (care presupune
padding+border constante).

Toate 5 secțiunile sunt **live** (`setGridLines` / `setColumnLayout` / `reporneste` /
`setNumerotareRanduri` / `setLift`, fără remount) și **persistă** între reload-uri, la
fel ca celelalte bife simple din CP (ex. „Afiseaza Timpi raspuns").

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
