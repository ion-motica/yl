# PLAN — reparare sacadare la „Cl. 1 - Rigle" (reglaj text/etichete)

> Pentru executant (Sonnet 5). Citește întâi `documente de referinta/RIGLE-REFERENCE.md`.
> Regula de aur a acestui plan: **Pasul 0 se face și se validează înainte de Pasul 1.**
> Dacă Pasul 0 rezolvă sacadarea, Pasul 1 **nu se mai face**.

## 1. Simptom raportat

După commit `cbb5cc6` (reglaj text în cascadă), quizul merge sacadat, iar apăsarea pe
butonul unei coloane „stă" vizibil.

## 2. Ce s-a măsurat efectiv (fapte)

Măsurat în browser, pe `?v=28`:

| Măsurătoare | Rezultat | Concluzie |
|---|---|---|
| `tick()` apelează `computeGeometry()`? | Nu | Reglajul NU rulează per frame |
| Mutații pe `.rigle-lift` după o selecție | 1 | Nu există buclă `ResizeObserver` |
| Durata unui `selectColumn` | **5,3 ms** | Prea mult pt. un handler de click |
| Secvența scrie→citește din `reglajEticheta` | **0,78 ms** | 3 layout-uri forțate per etichetă |
| Layout forțat izolat (`lift.offsetHeight`) | 0,36 ms | Cost per citire |

## 3. Ipoteza de lucru

Sacadarea vine din **layout forțat** (*forced synchronous layout* / *layout thrashing*),
nu din apeluri repetate de funcții:

1. **Per frame:** `actualizeazaNumerotareAnimata()` (engine.js, apelată din `tick()`)
   citește `lift.offsetHeight` după ce `tick()` tocmai a scris `lift.style.top`.
   Scriere → citire = browserul trebuie să recalculeze layout-ul **în fiecare frame**.
2. **Agravare adusă de `cbb5cc6`:** etichetele au devenit `position: absolute` cu lățime
   explicită și animație activă, deci fiecare recalcul de layout e mai scump decât înainte.
3. **Per apăsare:** `reglajEticheta()` alternează scriere/citire de 3 ori
   (`whiteSpace` → `scrollWidth` → `width` → `scrollWidth` → `offsetTop`), plus
   `getBoundingClientRect()`. Fiecare citire după scriere forțează un layout nou.

**Ce NU s-a putut confirma:** sacadarea continuă nu a fost reprodusă direct — panoul de
browser folosit la verificare e ascuns, deci `requestAnimationFrame` e throttled și bucla
de coborâre nu rulează. Ipoteza de mai sus explică datele, dar **trebuie validată pe
mașina utilizatorului** înainte de a investi în Pasul 1.

## 4. Pasul 0 — test ieftin, se face PRIMUL

`lift.offsetHeight` se schimbă **doar** când se schimbă geometria (fact nou, resize),
niciodată între frame-uri. Valoarea e deja calculată în `computeGeometry()`:

```js
const liftH = lift.offsetHeight || cell * 2.4;   // ~linia 500
travel = Math.max(1, H - liftH);
```

**Modificare:** ridică `liftH` într-o variabilă de closure (lângă `travel`, `cell`,
`mismatchMinH`) și în `actualizeazaNumerotareAnimata()` folosește variabila în loc de a
citi `lift.offsetHeight`. Elimină un layout forțat **per frame**.

```js
// sus, lângă celelalte variabile de geometrie:
let liftH = 0;

// în computeGeometry():
liftH = lift.offsetHeight || cell * 2.4;
travel = Math.max(1, H - liftH);

// în actualizeazaNumerotareAnimata(): șterge citirea, folosește liftH
const pozitieReper = (y + liftH) / cell + 1;
```

**Validare obligatorie înainte de a merge mai departe** (vezi §6). Dacă utilizatorul
confirmă că sacadarea a dispărut, **planul se oprește aici**.

## 5. Pasul 1 — precalcul per coloană (doar dacă Pasul 0 nu ajunge)

Design cerut de utilizator: reglajul se calculează **o dată per turn, pentru fiecare
coloană**, se notează într-un obiect, iar apoi selecția doar aplică valorile.

### 5.1. Structura de date

```js
// Calculat o dată per fact/resize în computeGeometry(); citit fără măsurători la
// fiecare schimbare de coloană. Un element per coloană — „cum ar arăta dacă ar fi
// selectată coloana asta".
let reglajPeColoana = [];
// reglajPeColoana[i] = {
//   eticheta:   { text, esteCorect, whiteSpace, width, position, left, right, top },
//   dreptunghi: { vizibil, left, width, top, height }
// }
```

### 5.2. Pattern procedural obligatoriu: fazele separate

Regula care rezolvă problema: **nu alterna niciodată scriere cu citire.** Grupează toate
scrierile, apoi toate citirile. Astfel 3 coloane costă **2 recalculări de layout în
total**, nu 3 per coloană.

```
calculeazaReglajPeColoana():          // rulează o dată per fact
  FAZA A (numai scrieri)   → pune textul + clasele pe toate cele 3 etichete,
                             whiteSpace='nowrap', width='', position=''
  FAZA B (numai citiri)    → citește scrollWidth + lățimea butonului pt. toate 3
  FAZA C (numai aritmetică)→ decide pt. fiecare: încape / trebuie wrap / trebuie lățit
  FAZA D (numai scrieri)   → pt. cele care au nevoie: whiteSpace='normal', width=coloană
  FAZA E (numai citiri)    → citește scrollWidth + offsetTop pt. acelea
  FAZA F (numai aritmetică)→ compune obiectele finale în reglajPeColoana[]
```

Dreptunghiul portocaliu (`actualizeazaMismatch`) intră în același tabel: formulele lui
sunt pur aritmetice (`min`, `abs`, `cell`, `mismatchMinH`), singurele măsurători fiind
`rowEl.offsetTop` / `rowEl.offsetHeight` — **citite o singură dată**, în FAZA B, și
refolosite pentru toate cele 3 coloane.

### 5.3. Aplicarea

```js
// Numai scrieri. Zero citiri de layout. Idempotentă: resetează înainte de a aplica.
function aplicaReglaj(idx) { ... }
```

- `selectColumn(idx)` → `aplicaReglaj(idx)` (înlocuiește `actualizeazaMismatch()`)
- `computeGeometry()` → `reglajTextSiDivuriPortocaliiSiVerzi()`, care devine:

```js
function reglajTextSiDivuriPortocaliiSiVerzi() {
  reglajLift();                 // C1 — neschimbat
  calculeazaReglajPeColoana();  // C2 — măsoară o dată, pt. toate coloanele
  aplicaReglaj(colIndex);       // scrie starea curentă
}
```

Fluxul rămâne procedural, se citește de sus în jos (AGENTS.md 9a).

### 5.4. Ce NU se schimbă

- `reglajLift()` — logica rămâne identică (cutia liftului vs. textul întrebării).
- Comportamentul vizibil — cascada normal → word-wrap → lățire + ancorare rămâne
  exact cea validată în `cbb5cc6`. Ăsta e un refactor de performanță, **nu** o
  schimbare de comportament (AGENTS.md 10).
- CSS-ul etichetelor.

## 6. Criterii de succes (falsificabile)

Nu „pare mai fluid". Se măsoară:

1. **Durata `selectColumn`** — snippet de rulat în consolă, înainte și după:
   ```js
   (function(){ const a=performance.now();
     document.dispatchEvent(new KeyboardEvent('keydown',{key:'1'}));
     return (performance.now()-a).toFixed(2)+' ms'; })()
   ```
   Referință actuală: **5,3 ms**. Țintă după Pasul 1: **sub 1 ms**.

2. **FPS în timpul coborârii** (rulat în browserul real al utilizatorului, cu fereastra
   vizibilă — altfel `requestAnimationFrame` e throttled și măsurătoarea e falsă):
   ```js
   (function(){ let f=0; const t0=performance.now();
     (function c(){ f++; performance.now()-t0<3000 ? requestAnimationFrame(c)
       : console.log('FPS:', (f/3).toFixed(1)); })(); })()
   ```
   Țintă: aproape de rata de refresh a ecranului, fără scăderi la schimbarea factului.

3. **Non-regresie vizuală** — se re-verifică cele 4 cazuri validate în `cbb5cc6`:
   normal centrat, ancorare stânga exactă (`labelLeft - btnLeft === 0`), ancorare
   dreapta exactă (`labelRight - btnRight === 0`), centru rămâne centrat.

## 7. Riscuri și capcane

- **Riscul principal:** Pasul 1 e un refactor al unui cod verificat pixel cu pixel. Dacă
  Pasul 0 rezolvă problema, Pasul 1 e cost fără beneficiu. De-aia ordinea e obligatorie.
- **Capcană la FAZA D/E:** dacă se scrie pe o etichetă și se citește imediat de pe alta,
  se pierde tot câștigul — layout-ul e global, nu per element. Toate scrierile întâi,
  pentru toate etichetele, apoi toate citirile.
- **Capcană la idempotență:** `aplicaReglaj` trebuie să reseteze `position`, `left`,
  `right`, `top`, `width`, `whiteSpace` înainte de a aplica, altfel starea „lățit" rămâne
  agățată la factul următor (vezi `razgandire-ieftina.md` §5).
- **`?v=` bump** în `index.html` la fiecare modificare, altfel browserul servește cod vechi.

## 8. Alternative respinse

- **Debounce pe `selectColumn`** — ascunde simptomul, nu elimină layout-ul forțat din
  bucla de frame; apăsarea ar deveni și mai puțin reactivă.
- **`will-change` / `contain: layout` pe etichete** — ar reduce costul unui recalcul, dar
  nu elimină cauza (citirea per frame) și adaugă straturi de compunere greu de motivat.
- **Revenire la `cbb5cc6^`** — ar pierde comportamentul cerut de utilizator (word-wrap +
  lățire adaptativă), care e corect funcțional; problema e de performanță, nu de design.
