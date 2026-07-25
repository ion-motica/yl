# Cl. 1 - Rigle — Referință Completă

> Acesta este fișierul central de referință pentru quiz-ul „Cl. 1 - Rigle" și motorul lui
> (m2). Reflectă starea curentă a codului, nu doar planul inițial — vezi secțiunea 11
> pentru relația cu `js/rigle/SPEC-etapa1.md`.

---

## 1. Ce este Rigle?

Quiz pentru clasa 1: copilul „măsoară" o sumă de obiecte cu **rigle** (coloane de
lățimi diferite), primind feedback vizual **înainte** de a se angaja la un răspuns
(„mură-n gură"), nu după. Deocamdată (etapa 1) mecanica e livrată, dar validarea și
feedback-ul pedagogic încă nu — vezi secțiunea 4.

Un lift îngust, cu întrebarea și obiectele de numărat, coboară lent și continuu peste
3 coloane galbene. Copilul alege o coloană (buton sau tastă); liftul glisează acolo.
Lățimea coloanei față de numărul de obiecte va arăta (în etapele viitoare) dacă
răspunsul „încape exact".

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

**`config`** (implicit + ce trimite quiz-ul azi):

```js
{
  intrebare: "2+1=?",
  grupe: [ { n: 2, fundal: "rosu" }, { n: 1, fundal: "albastru" } ], // total = obiecte în lift
  obiect: "🍏",
  latimiColoane: [2, 3, 4],
  coloanaInitiala: 3,     // lățimea coloanei pe care pornește liftul
  vitezaCoborare: 34,     // px/s — mic, intenționat, pt. copii de cl. 1
  gridVertical: true,     // rezolvat de quiz din CP (secțiunea 6), nu hardcodat
  gridOrizontal: true,
  pozitieTreime: true,    // true = fiecare coloană o treime din spațiu; false = proporțional
}
```

Config-driven, ca variațiile viitoare (alt fact, alte lățimi, alt obiect) să nu ceară
cod nou în engine.

---

## 4. Ce e implementat azi vs. ce NU (etapa 1)

**Implementat:**
- Lift care coboară continuu; la podea, `y` sare instant sus, `x` rămâne pe ultima
  coloană aleasă (fără wrap orizontal).
- 3 coloane, lățimi 2/3/4, alegere prin buton sau taste 1/2/3 (poziții stânga→dreapta,
  nu valoarea lățimii).
- Bloc rigid: obiectele din lift nu se realiniază/marchează la ieșire din ghidaj —
  pur vizual, fără logică de „încape/nu încape".
- Grilă de caiet (linii, toggle independent vertical/orizontal din CP).

**NU e implementat** (etape viitoare, neplanificate încă în cod):
- Validare (nicio verificare corect/greșit).
- Feedback: pătrățele portocalii, „Prea mult"/„Prea puțin", mână care se clatină, clipit.
- Efect de succes, afișarea rezultatului („2+1=**3**"), coborâre glorioasă, avans la
  întrebarea următoare.
- Alte întrebări/facts (azi doar „2+1=?", fix), alte seturi de coloane, coloana 1, alte
  obiecte decât 🍏.
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

Panoul are 2 secțiuni:

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

Ambele secțiuni sunt **live** (apelează `mounted.setGridLines({...})` / respectiv
`mounted.setColumnLayout({...})`, fără remount) și **persistă** între reload-uri, la fel
ca celelalte bife simple din CP (ex. „Afiseaza Timpi raspuns").

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
| `cpOrder` | ordinea panourilor CP (globală, nu doar Rigle) | — |

Nimic din progresul/răspunsurile la Rigle nu persistă încă — etapa 1 n-are validare,
deci n-are ce să rețină.

---

## 8. Fișiere

| Fișier | Rol |
|---|---|
| `js/rigle/engine.js` | Motorul m2: stil injectat, scenă, geometrie, coborâre, glisare, grilă, mount/destroy/setGridLines. |
| `js/quizzes/rigle-cl1.js` | Înregistrare quiz în `QuizRegistry`, config etapa 1, contract `customEngine`, panoul CP. |
| `js/app.js` | 5 branch-uri `customEngine` (mount/unmount + guard-uri) + `renderRiglePanel()`. |
| `js/cp-registry.js` | `"rigle"` în `DEFAULT_ORDER`. |
| `index.html` | `<script>` pentru `js/rigle/engine.js` și `js/quizzes/rigle-cl1.js`, înainte de `app.js`. |
| `js/rigle/SPEC-etapa1.md` | Specificația inițială de implementare (istoric — vezi secțiunea 11). |
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

---

## 10. Unde sa caut rapid

- Comportament mișcare/geometrie/grilă: `js/rigle/engine.js`.
- Config etapa 1, contract `customEngine`, panou CP: `js/quizzes/rigle-cl1.js`.
- Cum e ținut m1 în standby, cele 5 branch-uri: `js/app.js`, caută `customEngine`.
- Ordinea implicită a panoului CP: `js/cp-registry.js`, `DEFAULT_ORDER`.

---

## 11. Relația cu `js/rigle/SPEC-etapa1.md`

`SPEC-etapa1.md` e artefactul de planificare inițială (scop/non-scop, riscuri, criterii
de succes falsificabile) — rămâne ca istoric al deciziilor din etapa 1, dar **nu** mai e
actualizat pas cu pas. Acest fișier (`RIGLE-REFERENCE.md`) e sursa curentă de adevăr;
actualizează-l pe *acesta* când se schimbă mecanica, contractul sau integrarea.
