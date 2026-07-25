# PLAN — Cl. 1 Rigle, etapa 2: facte variabile + variante de răspuns

Status: **implementat, 25.07.2026.** Istoric — sursa curentă de adevăr e
`documente de referinta/RIGLE-REFERENCE.md` (secțiunile 3, 4, 5, 6, 7, 9).
Reguli de lucru: `AGENTS.md`. Context obligatoriu înainte de a atinge cod:
`documente de referinta/RIGLE-REFERENCE.md`.
Implementator vizat: **Sonnet 5** — lucru mecanic (o funcție pură + un callback + un
control CP). **Nicio decizie deschisă**: toate întrebările au primit răspuns (§2, §3).

---

## 1. Scopul

Azi factul e hardcodat (`2+1=?`) și coloanele sunt hardcodate (`[2,3,4]`).
După etapa asta:

- factul se generează aleator, `a+b=c` cu `c` într-un interval reglabil din CP;
- cele 3 coloane au ca lățimi **cele 3 variante de răspuns** pentru `c`;
- la fiecare wrap al liftului (când ajunge jos și reapare sus) apare un fact nou;
- un control nou în CP — „Suma maxima" — reglează intervalul lui `c`.

**Continuă să NU existe validare.** Butoanele mută liftul, atât. Nu se verifică
nimic, nu există corect/greșit, scor, progres. (Etapa 1 non-scop, rămâne non-scop.)

---

## 2. Deciziile userului (sursa de adevăr pentru tot ce urmează)

| # | Decizie |
|---|---|
| 1a | `x` = suma minimă, `y` = suma maximă; `c ∈ [x, y]` |
| 1b | Două steppere cu butoane `−` / `+`, nu slider cu două capete |
| 1c | Dacă `x > y`, `y` e împins în sus ca să rămână `x ≤ y`; la 30 ambele se opresc |
| 2a | `a, b ≥ 1`, deci `c ≥ 2` |
| 2b | Fact nou **la fiecare wrap** |
| 3a | Una din cele 3 variante e **exact** `c` |
| 3b | Celelalte două sunt **aleatoare** în `[c−3, c+3]`, nu fixe la `±3` |
| 3c | Coloanele rămân sortate **crescător**, dar variantele se aleg astfel încât **poziția coloanei corecte să varieze aleator**: `cvv`, `vcv`, `vvc` |
| 4a | Se scoate pragul de 14px pe celulă; celula are voie să scadă liber |
| 4b | Fără plafon mai jos pe sumă deocamdată |
| 4c | Mărimea textului întrebării se decuplează de `--cell` |

---

## 3. Plafonul variantelor — decis

**Variantele au voie să depășească 30. Limita 1–30 se aplică sumei, nu lățimii coloanei.**
(Decis de user, 25.07.2026.)

`c` merge până la 30 (limita slider-ului). Variantele sunt în `[c−3, c+3]`, deci la
`c = 30` variantele de sus sunt 31, 32, 33 — coloane de până la 33 de pătrățele.

Motivul, enumerat explicit — ce s-ar fi întâmplat dacă le tăiam la 30:

| `c` | valori disponibile sub `c` | valori disponibile peste `c` | poziții posibile pt. corect |
|---|---|---|---|
| 30 | {27,28,29} | ∅ | doar `vvc` |
| 29 | {26,27,28} | {30} | `vcv`, `vvc` |
| 28 | {25,26,27} | {29,30} | toate 3 |

Deci la `c = 30` răspunsul corect ar fi **întotdeauna coloana din dreapta** — exact
tipul de tipar pe care decizia 3c îl interzice.

La `c = 30` corectul ar fi fost **întotdeauna coloana din dreapta** — exact tiparul pe
care decizia 3c îl interzice.

Costul deciziei luate: la `c = 30` celula e 3px în loc de 4px (`floor(125/33)` vs.
`floor(125/30)`) — irelevant, la scara aia oricum nu se mai numără mere, iar userul a
acceptat asta explicit la 4a.

Implementare: `LATIME_MAX_COLOANA = Infinity`. Dacă vreodată se răzgândește cineva,
se pune `30` în constanta aia și nimic altceva.

**Nota separată despre capătul de jos:** la `c = 2`, sub 2 există o singură lățime
validă (1), deci `vvc` (două variante mai mici) e **imposibil matematic**, indiferent
ce decidem. La `c = 2` corectul apare doar pe pozițiile 1 și 2. Nu e reparabil, e o
consecință a faptului că o coloană nu poate avea 0 pătrățele. La `c ≥ 3` toate cele 3
poziții sunt posibile.

---

## 4. Generatorul de facte — fișier nou `js/rigle/facte.js`

### 4.1 De ce fișier separat

Logica asta e **pură**: primește numere, întoarce numere, nu atinge DOM, nu citește
`LayoutConfig`, nu știe de quiz. Într-un fișier separat se testează cu harnessul deja
existent din `tests/` (vezi §9), fără stub pentru `QuizRegistry`. Cost: un `<script>`
în plus. Beneficiu: exact partea cu cazuri-limită dificile (fezabilitatea pozițiilor)
devine verificabilă fără browser.

Dacă preferi mai puține fișiere: aceleași două funcții pot sta în `rigle-cl1.js`
exportate pe `global.RigleFacte`. Testul rămâne posibil, dar cere stubarea registrului.

### 4.2 Contract public

```js
window.RigleFacte = {
  genereazaFact({ sumaMin, sumaMax }),   // → obiect fact (§4.5)
  alegeVariante(suma),                   // → { latimiColoane, indexCorect }
};
```

Ambele **pure**: aceleași intrări → aceeași formă de rezultat, fără efecte laterale.
Aleatoriul vine din `Math.random()` — acceptabil, dar înseamnă că testele verifică
*proprietăți* (distribuție, invarianți), nu valori exacte.

### 4.3 Constante cu nume (fără numere magice)

```js
const DELTA_VARIANTE = 3;        // fereastra ±3 din decizia 3b
const NR_VARIANTE = 3;           // 3 coloane
const LATIME_MIN_COLOANA = 1;    // o coloană nu poate avea 0 pătrățele
const LATIME_MAX_COLOANA = Infinity; // vezi §3 — pune 30 dacă userul răstoarnă decizia
const SUMA_MIN_ABSOLUTA = 2;     // decizia 2a: a,b ≥ 1
const SUMA_MAX_ABSOLUTA = 30;
```

### 4.4 `alegeVariante(suma)` — algoritmul, pas cu pas

Fluxul se citește de sus în jos (AGENTS.md 9a):

```
1. construiește cele două rezervoare de distractori
2. determină ce poziții sunt fezabile
3. alege o poziție aleator dintre cele fezabile
4. extrage distractorii din rezervoare
5. sortează crescător și raportează indexul corectului
```

**Pas 1 — rezervoarele.** Distractorii nu au voie să fie egali cu `suma`, deci
rezervoarele o exclud prin construcție:

```
jos = întregii din [ max(LATIME_MIN_COLOANA, suma − DELTA_VARIANTE),  suma − 1 ]
sus = întregii din [ suma + 1,  min(LATIME_MAX_COLOANA, suma + DELTA_VARIANTE) ]
```

**Pas 2 — fezabilitatea.** Poziția `p ∈ {0, 1, 2}` = indexul pe care va cădea corectul
după sortarea crescătoare. Ca să cadă pe `p`, exact `p` distractori trebuie să fie mai
mici decât `suma`, iar restul mai mari:

```
nJos = p
nSus = NR_VARIANTE − 1 − p
p e fezabilă  ⟺  jos.length ≥ nJos  ȘI  sus.length ≥ nSus
```

**Pas 3 — alegerea poziției.** Uniform dintre pozițiile fezabile. NU uniform din
`{0,1,2}` cu reîncercare — la `c = 2` s-ar bucla la infinit pe `p = 2`.

**Pas 4 — extragerea.** `nJos` valori distincte din `jos`, `nSus` valori distincte din
`sus`, fiecare fără repunere în același rezervor. Distincția globală e garantată:
cele două rezervoare sunt disjuncte și niciunul nu conține `suma`.

**Pas 5 — rezultatul.**

```js
const latimiColoane = [...distractori, suma].sort((a, b) => a - b);
const indexCorect = latimiColoane.indexOf(suma);
// invariant care trebuie să țină mereu: indexCorect === p
```

### 4.5 `genereazaFact({ sumaMin, sumaMax })`

```
1. normalizează intervalul   (apărare, nu decor — vezi mai jos)
2. alege suma
3. alege descompunerea a + b
4. cere variantele
5. compune obiectul fact
```

**Pas 1 — normalizarea.** Funcția e publică, deci își validează intrarea:

```js
let min = clamp(sumaMin, SUMA_MIN_ABSOLUTA, SUMA_MAX_ABSOLUTA);
let max = clamp(sumaMax, SUMA_MIN_ABSOLUTA, SUMA_MAX_ABSOLUTA);
if (min > max) max = min;
```

Atenție la decizia 2a vs. slider-ul 1–30: slider-ul are voie să arate 1, dar generatorul
lucrează de la 2 în sus. `x = 1` în CP înseamnă efectiv `c` de la 2. E o consecință a
faptului că `1 = a + b` cu `a,b ≥ 1` nu are soluție — nu e o scăpare, e ce a cerut 2a.

**Pas 2 — suma.** Întreg uniform în `[min, max]`.

**Pas 3 — descompunerea.** `a` = întreg uniform în `[1, suma − 1]`; `b = suma − a`.
Așa fiecare sumă din interval apare la fel de des, indiferent câte descompuneri are.
(Alternativa — uniform peste toate perechile `(a,b)` — ar favoriza sumele mari; nu o
vrem, intervalul e reglat de user tocmai ca să controleze dificultatea.)

**Pas 5 — obiectul fact:**

```js
{
  a, b, suma,
  intrebare: `${a}+${b}=?`,
  grupe: [ { n: a, fundal: "rosu" }, { n: b, fundal: "albastru" } ],
  latimiColoane,   // sortate crescător
  indexCorect,     // pentru etapele viitoare; etapa 2 nu-l folosește la nimic
}
```

`indexCorect` se transportă **deși nu e folosit** azi — e singurul lucru care nu se
poate reconstitui din restul obiectului fără să reimplementezi generatorul. Nu adaugă
niciun mecanism, e un câmp de date.

---

## 5. Cum se leagă de motor — costul unei forme noi de ecuație

Userul a semnalat că vor urma `?+3=5` și `21=12+?`. Verificat în cod: **motorul nu
trebuie atins deloc când apar**, fiindcă cele trei lucruri sunt deja câmpuri
independente și nimic nu le derivă unul din altul:

| Câmp | Ce descrie | Azi | La `?+3=5` |
|---|---|---|---|
| `intrebare` | textul randat | `"2+1=?"` | `"?+3=5"` |
| `grupe` | ce e în lift (→ `totalMere` → lățimea liftului) | `a` roșii + `b` albastre | altceva, se decide atunci |
| `latimiColoane` | variantele necunoscutei | variante ale lui `c` | variante ale lui `a` |

Cheia: în `computeGeometry()` (`engine.js`) treimea e deja dimensionată cu
`cellsPerThird = max(max(latimiColoane), totalMere)` — termenul `totalMere` există
tocmai ca liftul să poată fi **mai lat decât orice coloană**. La `?+3=5` liftul ar ține
5 mere iar coloana corectă ar avea 2 pătrățele; geometria suportă deja cazul, nu e
nevoie de cod nou.

Testul de răzgândire ieftină (`documente de referinta/razgandire-ieftina.md`):
- *„Dacă mă răzgândesc la forma ecuației, în câte locuri scriu?"* → unul: `facte.js`.
- *„Dacă se dovedește o prostie, cât costă s-o scot?"* → o funcție ștearsă.

**Deci NU adăugăm azi niciun parametru `forma`, niciun switch, niciun tabel de forme.**
Ar fi generalizare după un singur caz (AGENTS.md 7). Când apare forma a doua reală, se
adaugă o funcție soră lângă `genereazaFact` și un tabel dacă atunci chiar au aceeași
formă — nu înainte.

---

## 6. Modificări în `js/rigle/engine.js`

### 6.1 Callback pentru fact nou (contract config)

Se adaugă în `DEFAULTS`:

```js
urmatorulFact: null,   // () => fact | null. null ⇒ factul nu se schimbă la wrap.
```

`null` implicit înseamnă că, dacă cineva montează motorul fără callback, se comportă
exact ca azi. Zero regresie pentru orice altă folosire.

### 6.2 Extragerea randării într-o funcție

Azi conținutul liftului, coloanele și butoanele se construiesc o singură dată, inline
în `mount()`. Se extrag într-o funcție apelabilă de mai multe ori:

```js
function randeazaFact(fact) {
  // 1. întrebarea
  // 2. rândul de mere (replaceChildren + grupe)
  // 3. coloanele (replaceChildren pe columnsWrap, re-creare colEls)
  // 4. butoanele (replaceChildren pe buttonsBar, re-creare myButtons + listeneri)
  // 5. computeGeometry()
}
```

**Randare completă, nu update parțial** (razgandire-ieftina §12, „UI = f(state)"):
`replaceChildren()` + redesenare din fact. 3 coloane + 3 butoane o dată la ~20 de
secunde — costul e zero, iar codul de „undo" parțial e exact ce produce bug-uri la a
treia comutare. Nu scrie cod care mută proprietăți pe nodurile vechi.

**Ordinea din interiorul funcției contează** și trebuie respectată: `computeGeometry()`
citește `lift.offsetHeight` pentru `travel`, deci conținutul liftului trebuie deja în
DOM când e apelată. Pașii 1–4 înainte de pasul 5, fără excepție.

**`totalMere` nu mai poate fi o constantă calculată o dată în `mount()`** — se
recalculează din `fact.grupe` la fiecare randare. Azi e `const totalMere = ...` la
`engine.js:192`; devine o variabilă de stare actualizată în `randeazaFact`.

### 6.3 Suprimarea tranziției orizontale la schimbarea factului

La fact nou se schimbă lățimile coloanelor, deci se schimbă `colX`, deci se schimbă
`lift.style.left`. Cu clasa `.rigle-lift--ready` activă, liftul ar **glisa** orizontal
exact în momentul în care sare vertical sus — arată ca un bug.

Se refolosește fix trucul deja existent din `mount()` (`engine.js:341`): se scoate clasa
înainte de randare, se pune la loc pe `requestAnimationFrame` după:

```js
lift.classList.remove("rigle-lift--ready");
randeazaFact(fact);
requestAnimationFrame(() => lift.classList.add("rigle-lift--ready"));
```

Rezultatul dorit: la wrap liftul **sare** (sus + eventual lateral), nu alunecă.

### 6.4 Wrapul cere factul nou

În `tick()`:

```js
if (y >= travel) {
  y = 0;
  const fact = cfg.urmatorulFact?.();
  if (fact) schimbaFact(fact);   // = 6.3 + 6.2
}
```

`y = 0` **înainte** de schimbare, ca `computeGeometry()` să nu mai facă fracția de
poziție pe un `travel` vechi.

### 6.5 Metodă publică nouă: `reporneste()`

Se adaugă la obiectul returnat de `mount()`:

```js
return { destroy, setGridLines, setColumnLayout, reporneste };
```

`reporneste()` = `y = 0` + cere fact nou + `schimbaFact`. Folosită de CP când userul
schimbă intervalul: altfel efectul slider-ului s-ar vedea abia la următorul wrap, adică
peste ~20 de secunde (`travel ≈ 700px` / `vitezaCoborare = 34px/s`), ceea ce face
controlul să pară stricat.

### 6.6 Se scoate pragul de 14px (decizia 4a)

Două locuri în `computeGeometry()`, ambele ramuri:

```js
// treime:
cell = Math.max(1, Math.floor(thirdW / cellsPerThird));
// spațiu:
cell = Math.max(1, Math.floor(W / (sumW + nGaps + 1)));
```

Pragul rămâne, dar la `1` — o celulă de 0 sau negativă ar rupe geometria. `1` nu e
plafon estetic, e apărare aritmetică.

**Verificare că asta chiar repară overflow-ul**, cu cifre: la `c = 30` avem
`cellsPerThird = 33`, `thirdW = 375/3 = 125px`.
- Cu pragul vechi: `cell = max(14, floor(125/33)) = max(14, 3) = 14px` →
  ultima coloană se termină la `2·33·14 + 33·14 = 1386px`, în arena de 375px. Depășire de 3,7×.
- Cu pragul nou: `cell = max(1, 3) = 3px` → ultima coloană se termină la
  `2·33·3 + 33·3 = 297px` ≤ 375px. ✓

### 6.7 Textul întrebării se decuplează de `--cell` (decizia 4c)

În CSS-ul injectat, `.rigle-lift-q`:

```css
font-size: clamp(11px, calc(var(--cell) * 0.62), 22px);
white-space: nowrap;
```

`white-space: nowrap` **nu e opțional**: fără el, la celule mici textul s-ar rupe pe
două rânduri, ar crește înălțimea liftului, deci s-ar schimba `travel` — un bug de
mișcare pornit dintr-o problemă de tipografie.

Valorile verificate pe extreme (lățime lift = `totalMere · cell`):

| `c` | `cell` | font | lift | text | încape? |
|---|---|---|---|---|---|
| 2 | 25px | 15,5px | 50px | `1+1=?` ≈ 45px | da, la limită |
| 3 (azi) | 31px | 19,2px | 93px | `2+1=?` ≈ 55px | da |
| 7 | 13px | 11px (prins de clamp) | 91px | `3+4=?` ≈ 32px | da |
| 30 | 3px | 11px (prins de clamp) | 90px | `17+13=?` ≈ 46px | da |

La `cell = 31` (azi) clamp-ul nu se activează → **zero regresie vizuală pe configurația
curentă**. Asta e și criteriul de verificare: după modificare, la sume mici, liftul
trebuie să arate identic cu înainte.

**Mărul NU primește clamp.** `.rigle-apple-emoji` rămâne `calc(var(--cell) * 0.74)`.
Mărul reprezintă un pătrățel; dacă i-am pune podea, ar depăși celula și ar strica exact
alinierea la grilă pe care userul a cerut-o. La sume mari merele devin puncte — e
consecința acceptată la 4a, nu un lucru de reparat aici.

### 6.8 Ce NU se atinge în engine

- **Rândul de mere are voie să depășească padding-ul liftului.** Măsurat în browser pe
  codul curent: cutia liftului are 93px lățime, spațiul interior 81,8px (padding 4px +
  border 1,6px pe fiecare parte), iar rândul de 93px iese simetric cu 5,6px de fiecare
  parte — ceea ce îi aduce marginea stângă exact pe `colX` (`appleRow.left = 124`,
  `col[1].left = 124`). Centrarea simetrică anulează padding-ul la orice mărime de
  celulă. **Nu adăuga `overflow: hidden`, nu schimba `box-sizing`, nu „repara"
  depășirea** — ai strica alinierea merelor la grilă.
- Formula `colX[i] = i * cellsPerThird * cell` și invariantul „marginile coloanei cad pe
  liniile grilei" (gotcha #4 din RIGLE-REFERENCE). Nu introduce decalaje independente de
  `cell`.
- `applyGridLines`, `setGridLines`, `setColumnLayout`, `destroy`.

---

## 7. Modificări în `js/quizzes/rigle-cl1.js`

### 7.1 Chei noi în `LayoutConfig`

| Cheie | Ce | Implicit |
|---|---|---|
| `rigleSumaMin` | `x` | `2` |
| `rigleSumaMax` | `y` | `5` |

Implicitul `2..5` e ales ca prima deschidere să semene cu ce e azi și să rămână lizibil:
variante până la 8 → `cellsPerThird = 8` → `cell = floor(125/8) = 15px` → mărul ≈ 11px,
încă numărabil. Userul îl mută instant din CP dacă vrea altceva.

### 7.2 `CONFIG_ETAPA1` pierde ce e generat

Ies din config: `intrebare`, `grupe`, `latimiColoane` — vin acum din generator.
Rămân: `obiect`, `vitezaCoborare`, `gridVertical`, `gridOrizontal`, `pozitieTreime`.

`coloanaInitiala: 3` **devine index, nu lățime.** Azi valoarea `3` înseamnă „coloana
care are lățimea 3" (`latimiColoane.indexOf(3)`, `engine.js:268`). Cu variante aleatoare,
lățimea 3 deseori nu există → `indexOf` întoarce `-1` → codul cade pe mijloc din
întâmplare. Se schimbă în `coloanaInitialaIndex: 1` (a doua coloană, mijlocul) și
`engine.js:268` folosește direct indexul. Asta era ultimul paragraf pe care userul l-a
marcat „nu înțeleg" — pe scurt: azi configul zice *„pornește pe coloana lată de 3"*, iar
de mâine zice *„pornește pe a doua coloană"*, fiindcă lățimile nu mai sunt fixe.

Pornirea mereu pe mijloc e acum inofensivă: cu decizia 3c, corectul nu mai e sistematic
la mijloc.

### 7.3 `mountArena` dă callback-ul

```js
const cfg = Object.assign({}, CONFIG_ETAPA1, {
  gridVertical: getGridVertical(),
  gridOrizontal: getGridOrizontal(),
  pozitieTreime: getColoaneTreime(),
  urmatorulFact: () => global.RigleFacte.genereazaFact({
    sumaMin: getSumaMin(),
    sumaMax: getSumaMax(),
  }),
});
mounted = global.RigleEngine.mount(hosts, cfg);
```

Quizul citește `LayoutConfig` **la fiecare apel**, deci modificarea din CP se aplică
factului următor fără remount. Motorul nu știe ce e o sumă, un interval sau un
`LayoutConfig` — respectă „quizul raportează, feature-ul procesează" (AGENTS.md).

Factul inițial (la mount) se obține prin același callback, ca să nu existe două căi
diferite de a produce un fact.

---

## 8. CP — secțiunea „Suma maxima"

Se adaugă în `appendRigleControlPanel`, **după** „Poziție coloane".

### 8.1 Structura

Subtitlu `control-panel-lift-title` cu textul `Suma maxima`, apoi două steppere.

**Nu se scrie CSS nou.** Există deja tiparul complet, folosit de
`js/quizzes/pre-equations-eff-navigation.js:656`:

```
div.control-panel-lift-field.pre-eq-stepper-field
├── label            ("Minim" / "Maxim")
└── div.pre-eq-stepper
    ├── button "−"
    ├── input[type=number][min][max][step=1]
    └── button "+"
```

Clasele `.pre-eq-stepper-field` / `.pre-eq-stepper` sunt în `style.css:1618-1660`.
Refolosirea lor ține diff-ul minim și **evită bump-ul de cache pe `style.css`**.
Prefixul `pre-eq-` e nepotrivit semantic pentru Rigle — o redenumire în ceva neutru
(`.cp-stepper`) ar atinge și quizul de pre-ecuații, deci **nu face parte din
schimbarea asta**; e curățenie separată, de propus la nevoie (AGENTS.md 10 și 14).

### 8.2 Regula de cuplare a valorilor (decizia 1c)

Ambele direcții, deși userul a formulat-o doar pe una — altfel poate coborî `y` sub `x`
și ajunge într-un interval invalid:

```js
function seteazaMin(valoare) {
  const min = clamp(valoare, 1, 30);
  const max = Math.max(getSumaMax(), min);   // „daca x>y atunci y++"
  salveaza(min, max);
}
function seteazaMax(valoare) {
  const max = clamp(valoare, 1, 30);
  const min = Math.min(getSumaMin(), max);   // simetric
  salveaza(min, max);
}
```

`Math.max(y, x)` e echivalent cu `y++` pentru pași de ±1 (singurii posibili din butoane),
dar rezistă și la tastare directă în `input[type=number]`, unde saltul poate fi mai mare.

La `x = 30`: `max(y, 30) = 30`, deci `y` devine 30 și `x` nu poate trece de 30 —
comportamentul cerut, fără cod special de blocare.

**După fiecare schimbare:** se rescriu ambele `input.value` (pot fi împinse amândouă) și
se apelează `mounted?.reporneste()`, ca efectul să fie vizibil imediat (§6.5).

---

## 9. Verificare

### 9.1 Static

```bash
node --check js/rigle/facte.js && node --check js/rigle/engine.js && node --check js/quizzes/rigle-cl1.js
```

Obligatoriu **înainte** de a deschide browserul: o eroare de parsare dă preview alb cu
consolă goală și te trimite să vânezi fantome.

### 9.2 Distribuția pozițiilor — testul care contează

Cerința 3c e ușor de implementat greșit și imposibil de verificat din ochi. Snippet de
rulat în consola browserului (minim obligatoriu):

```js
const t = {0:0, 1:0, 2:0};
for (let i = 0; i < 3000; i++) t[RigleFacte.alegeVariante(7).indexCorect]++;
console.log(t);   // așteptat: ~1000 / ~1000 / ~1000
```

Verificări de capăt, în aceeași consolă:

```js
RigleFacte.alegeVariante(2)   // indexCorect ∈ {0,1} mereu; latimi ⊆ [1,5]; niciodată 0 sau negativ
RigleFacte.alegeVariante(30)  // toate 3 pozițiile apar; max variantă ≤ 33 (cu decizia din §3)
```

Invariant de verificat pe ~1000 de rulări la sume aleatoare: cele 3 lățimi sunt
**distincte**, toate `≥ 1`, `suma` e printre ele exact o dată, iar
`latimiColoane[indexCorect] === suma`.

**Opțional** (nu blochează livrarea): `tests/rigle-facte.test.js`, pe tiparul din
`tests/numara-tics.test.js` — `readFileSync` + `new Function("window", sursa)(globalThis)`,
apoi aceleași aserțiuni ca mai sus. Fișierul e pur, deci nu are nevoie de niciun stub.
Merită dacă generatorul va mai fi atins (adică la prima formă nouă de ecuație).

### 9.3 În browser — criterii falsificabile

Server propriu (nu portul altei sesiuni), apoi bump de cache aplicat:

1. La fiecare wrap apare un fact nou și **cele patru lucruri se schimbă coerent**:
   textul întrebării, numărul de mere (`a` roșii + `b` albastre), lățimile celor 3
   coloane, cifrele de pe butoane = lățimile coloanelor.
2. La wrap liftul **sare**, nu glisează lateral (§6.3).
3. Marginile coloanelor cad **exact** pe liniile grilei, la sumă mică și la sumă 30.
   Verificat numeric, nu din ochi: `(col.left − bgPos) / cell` întreg pentru toate 3.
4. La `x = y = 30` nimic nu iese din arenă în dreapta (§6.6).
5. Textul întrebării rămâne citibil la sumă 30; merele au voie să fie puncte.
6. La sume mici (2–5) liftul arată ca înainte de schimbare — fără regresie.
7. Stepperele: `−`/`+` respectă 1–30; urcarea lui `x` peste `y` îl împinge pe `y`;
   valorile supraviețuiesc unui reload.
8. Comutarea „treime" ↔ „în funcție de spațiu" funcționează în continuare, la orice sumă.
9. Comut pe alt quiz și înapoi → motorul 1 nemodificat, Rigle se remontează curat.
10. Zero erori în consolă.

---

## 10. Fișiere atinse

| Fișier | Ce |
|---|---|
| `js/rigle/facte.js` | **nou** — generator pur (§4) |
| `js/rigle/engine.js` | callback `urmatorulFact`, `randeazaFact`, `reporneste`, prag 1px, clamp pe font (§6) |
| `js/quizzes/rigle-cl1.js` | chei noi, config redus, `coloanaInitialaIndex`, secțiunea CP (§7, §8) |
| `index.html` | `<script>` nou pentru `facte.js` **înaintea** lui `rigle-cl1.js`; bump `engine.js?v=8→9`, `rigle-cl1.js?v=3→4` |
| `documente de referinta/RIGLE-REFERENCE.md` | actualizare după implementare (§11) |

`style.css` **nu** se atinge (§8.1), deci nu are bump.
Ordinea scripturilor contează: `facte.js` → `engine.js` → `rigle-cl1.js` → `app.js`.

---

## 11. Actualizarea referinței (parte din livrare, nu opțional)

După implementare, în `documente de referinta/RIGLE-REFERENCE.md`:

- §3 contract engine: `urmatorulFact` în config, `reporneste()` în API-ul returnat.
- §4 „implementat vs. NU": factele nu mai sunt fixe; validarea rămâne pe lista NU.
- §5 geometrie: pragul e 1px, nu 14px, și de ce.
- §6 CP: secțiunea „Suma maxima".
- §7 persistență: `rigleSumaMin`, `rigleSumaMax`.
- §8 fișiere: `facte.js`.
- §9 gotchas: **nou** — rândul de mere depășește intenționat padding-ul liftului
  (§6.8); și suprimarea tranziției la schimbarea factului (§6.3).

---

## 12. Ce NU facem în etapa asta

- Validare, corect/greșit, scor, progres, sunet, timeout.
- Forme noi de ecuație (`?+3=5`, `21=12+?`) — doar ne asigurăm că nu le blocăm (§5).
- Alt număr de coloane decât 3, alte obiecte decât 🍏, coloana de lățime 1 ca element de
  design separat.
- Feedback vizual de potrivire (pătrățele portocalii, „Prea mult"/„Prea puțin").
- Redenumirea claselor CSS `pre-eq-stepper*` (§8.1).
- Orice plafon pe sumă peste cel din slider (decizia 4b).
