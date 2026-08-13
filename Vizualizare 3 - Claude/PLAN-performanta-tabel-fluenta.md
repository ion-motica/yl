# PLAN — Performanța tabelului % fluență (de la ~12s la ~0,13s)

Status: **verificat pe date reale, gata de implementat, 13.08.2026.**
Reguli de lucru: `AGENTS.md`. Partea 2 e specificația executabilă pentru Sonnet 5.

Sesiunea precedentă a rezolvat *recalcularea inutilă* (cache pe sweep + cerculeț
de încărcare, commit `0dfc43b`). A rămas costul unei singure rulări: **~12 secunde
la deschiderea paginii**. Documentul ăsta rezolvă cauza acelui cost.

---

# PARTEA 1 — Analiza (de ce, și de ce NU altfel)

## 1. Ipoteza cea mai riscantă, testată prima

Userul a propus: „valorile zilelor precedente sunt stabile, de ce nu le păstrezi
în memorie?" — adică un cache pe zile, persistat.

Ipoteza riscantă din spatele oricărei variante de cache: **costul este muncă
necesară**, deci singura scăpare e să n-o mai repeți. Dacă ipoteza e falsă (costul
e muncă *redundantă*), atunci cache-ul tratează simptomul și lasă boala.

**Testată prima, pe jurnalul real** (`youlearn-salvare-log-activitate-2026-08-13-17-19.json`,
4071 apăsări brute, 3885 răspunsuri valide, 200 facts, 24 zile):

| adâncime | timp per model |
| --- | --- |
| 2 | 2954 ms |
| 5 | 2849 ms |
| 10 | 2860 ms |
| 20 | 2785 ms |

**Ipoteza e FALSĂ.** Semnalul: costul e practic identic la toate adâncimile. Dacă
munca ar fi proporțională cu datele efectiv folosite, adâncimea 20 ar costa de ~10×
cât adâncimea 2. Nu costă. Deci timpul nu se duce în calculul cerut, ci în
**rescanarea întregului istoric**, indiferent cât de puțin se folosește din el.

## 2. Cauza exactă

`motor-analiza.js:527`, `fereastraFactLaMoment`:

```js
function fereastraFactLaMoment(valide, cellId, k, adancime) {
  const aleFactului = valide
    .slice(0, k)                                                    // copiază k elemente
    .filter((i) => cheieCelulaDinInregistrare(i) === cellId);        // regex pe FIECARE
  return aleFactului.slice(Math.max(0, aleFactului.length - adancime));
}
```

Pentru fiecare fact, la fiecare coloană, în fiecare rând, funcția reia de la zero
tot istoricul și re-parsează cu regex fiecare înregistrare — ca să păstreze la
final doar ultimele 2–20.

Aritmetica, pe jurnalul real (domeniul 11-20 × 1-20):

- rânduri = 10 subtable + 1 „Toată fereastra" = **11**
- vizite-de-celulă per coloană = 10 subtable × 20 celule + 1 × 200 celule = **400**
- coloane (zile) = **24**
- apeluri `fereastraFactLaMoment` = 400 × 24 = **9 600**
- fiecare scanează în medie B/2 = 3885/2 ≈ **1 943** înregistrări
- total execuții de regex = 9 600 × 1 943 ≈ **18 650 000** per model
- sweep-ul de la încărcare rulează 4 adâncimi = **~74 600 000**

Verificare încrucișată: 12 157 ms ÷ 74 600 000 ≈ **163 ns** per iterație — exact
ordinul de mărime al unui `String()` + `.match(regex)`. Aritmetica și cronometrul
spun același lucru, deci diagnosticul nu se sprijină pe o singură măsurătoare.

Ironie utilă: funcția vecină `construiesteStariPeMomente` (`:598-601`) **are deja**
soluția corectă, cu un comentariu care o explică („o singură trecere prin `valide`,
cu un cursor per fact… fără re-filtrarea întregii liste la fiecare moment").
Tratamentul n-a fost aplicat și celeilalte funcții.

## 3. Soluția aleasă: index construit o dată

Se construiește o singură dată per model, printr-o trecere peste `valide`:

- `listaPeFact: Map<cellId, întrebare[]>` — răspunsurile fiecărui fact, în ordine;
- `pozitiiPeFact: Map<cellId, number[]>` — poziția globală (în `valide`) a fiecărui
  răspuns al factului, **crescătoare**.

Fereastra la momentul `k` devine: caută binar câte poziții sunt `< k`, apoi taie
ultimele `adancime` din lista factului. Din ~1 943 execuții de regex per apel →
~12 comparații de numere întregi.

Nu e o aproximare și nu schimbă nicio regulă de calcul: e **exact aceeași
fereastră**, obținută altfel. De-aia criteriul de acceptare poate fi „rezultat
identic", nu „rezultat plauzibil".

## 4. Rezultatul măsurat

| Scenariu | Înainte | După | Raport |
| --- | --- | --- | --- |
| **Sweep complet la încărcare** (jurnal real, 11-20) | **12 157 ms** | **130 ms** | **93,4×** |
| Un model, jurnal real, adâncime 2 | 3 132 ms | 30 ms | 104× |
| Un model, jurnal real, adâncime 20 | 2 792 ms | 53 ms | 53× |
| Un model, fixture dummy 1-10 (domeniul userului) | 928–982 ms | 19–50 ms | 20–49× |
| Grila 10×10 (`ruleazaAnaliza`) | 9 ms | neatinsă | — |

Grila a fost măsurată separat exact ca să nu rămână o a doua bombă nedescoperită:
9 ms, nu e o problemă și nu se atinge.

## 5. Corectitudine: 72 de comparații stricte, 0 diferențe

Comparație **recursivă strictă** (`Object.is`, deci prinde și `NaN` vs `null`, și
`-0` vs `0` — pe care `JSON.stringify` le-ar fi ascuns), pe 9 scenarii × 8 adâncimi
(1, 2, 3, 5, 10, 20, 50, 1000):

jurnal real 11-20 · o singură subtablă · o singură celulă · domeniu fără date ·
primele 3 apăsări · o singură apăsare · fixture dummy 1-10 · o subtablă din dummy ·
array gol.

**Rezultat: 0 diferențe.**

**Testul de sanitate a testului** (ca să nu declar victorie cu un test fără putere):
am rulat aceeași comparație împotriva unei versiuni cu bug intenționat (`<=` în loc
de `<`, adică off-by-one la limita ferestrei). A fost prinsă în **56 din 72** de
scenarii; cele 16 ratate sunt exact cele fără date, unde nicio metodă n-ar putea
detecta ceva. Deci verificarea are putere reală acolo unde există date.

## 6. Alternative respinse (explicit)

**A. Cache persistat pe zile în localStorage** — propunerea inițială a userului.
**Nu respinsă ca idee — devine doar inutilă după fix.** Ordinea contează: dacă
rescanarea n-ar fi putut fi eliminată, ASTA era soluția corectă.

Motivul e un singur număr: după fix, o recalculare completă costă **130 ms**.
Un cache pe zile ar scădea-o poate la ~50 ms. Diferența e sub pragul de percepție,
în timp ce costul e permanent: cod de invalidare (praguri, domeniu, adâncime,
Merge, Replace) plus un format ținut pe disc.

**Notă de corectitudine (13.08.2026):** o versiune anterioară a acestui document
respingea varianta invocând `combinaFaraDuplicate` (`vizualizare3-bootstrap.js:224`),
care re-sortează istoricul după dată la Merge, deci inserează înregistrări în
mijlocul trecutului. **Argumentul era slab și a fost retras** după obiecția
userului: aplicația știe exact când s-a apăsat Merge/Replace, deci ar invalida
cache-ul explicit — n-ar fi o coruptibilitate tăcută, ci o invalidare banală.
Singurul motiv real rămâne cel de mai sus: nu mai are ce economisi.

**De reluat dacă** măsurătoarea de după fix arată că încărcarea completă (citire
IndexedDB + calcul + randare) rămâne peste ~1s — atunci se măsoară din nou unde
se duce timpul și se decide pe date, nu pe presupunerea de azi.

**B. Cursor incremental în loc de căutare binară** — momentele se parcurg crescător,
deci s-ar putea avansa un cursor per fact (O(1) amortizat în loc de O(log n)).
Respinsă: câștigul peste 130 ms e nemăsurabil, dar cere stare resetată per rând —
mai multe ocazii de greșeală, pentru nimic. Căutarea binară e fără stare.

**C. Doar memorarea cheilor** (`cheieCelulaDinInregistrare` o dată per înregistrare,
păstrând rescanarea). Respinsă: rămân aceleași ~18,6 milioane de comparații, doar
mai ieftine — estimativ 3–5×, nu 93×. Tratează simptomul.

**D. Web Worker** — mută pe alt fir, nu face mai rapid; adaugă asincronism și
mesaje. După fix nu mai e nimic de mutat.

## 7. Pre-mortem: „e peste trei săptămâni și fix-ul a stricat ceva. Ce s-a întâmplat?"

| Scenariu de eșec | Cât de probabil | Cum îl prevenim |
| --- | --- | --- |
| Indexul e construit **în interiorul** buclei (per celulă), nu o dată → mai lent decât înainte | mediu — e greșeala naturală | Spec: o singură linie, într-un loc anume (§P2.3). Criteriu: sweep < 500 ms, altfel s-a greșit plasarea |
| Off-by-one la granița ferestrei (`<` vs `<=`) | mediu | Harnessul de comparație îl prinde în 56/72 scenarii — e chiar bugul testat |
| Se schimbă din reflex și `construiesteStariPeMomente` | mic | Explicit în afara scopului (§P2.6). E deja O(B), n-are ce câștiga |
| Se uită bump-ul `?v=` → userul vede cod vechi și crede că fix-ul n-a mers | **mare** (s-a mai întâmplat) | Pas dedicat în spec (§P2.4), cu numerele exacte |
| Cele 3 teste care picau deja sunt confundate cu o regresie a acestui fix | mare | Documentat exact mai jos |
| Cache-ul din `0dfc43b` e șters „că nu mai trebuie" | mic | Explicit în afara scopului |

**Cele 3 teste care picau ÎNAINTE de orice modificare din această zonă** (verificat
prin `git stash`, pică identic și pe `9724c9e`, și pe `0dfc43b`): în
`tests/vizualizare3-tabel-fluenta.test.js`, testele așteaptă ca eticheta ultimei
coloane să fie textul literal `"acum"`, dar motorul întoarce data reală (`12.07`,
`05.08`). Cauza: commit-ul `79407b8` (iulie) a schimbat antetul din „acum" în dată
și n-a actualizat testele. **Datorie de test preexistentă, fără legătură cu
performanța. NU se repară în această rundă** (ar amesteca două subiecte); merită
propusă separat.

## 8. Criterii falsificabile (fixate ÎNAINTE de implementare)

Fix-ul se **respinge** dacă oricare dintre:

1. vreo diferență în comparația strictă (≥1 din cele 72) — orice diferență, oricât
   de mică, înseamnă că nu e același calcul;
2. sweep-ul pe jurnalul real > **500 ms** (măsurat: 130 ms; peste prag = indexul e
   probabil construit în loc greșit);
3. vreunul din cele **5 teste care trec acum** în `vizualizare3-tabel-fluenta.test.js`
   începe să pică;
4. erori în consola browserului, sau tabelul nu se randează;
5. numărul de coloane sau vreun procent afișat diferă vizual de cel de azi.

---

# PARTEA 2 — Specificație de implementare (pentru Sonnet 5)

Muncă mecanică, bine delimitată: 5 înlocuiri de text într-un singur fișier, plus
bump de versiune. Nimic de proiectat — designul e decis și verificat mai sus.

## P2.1 Fișiere atinse

| Fișier | Ce se schimbă |
| --- | --- |
| `Vizualizare 3 - Claude/motor-analiza.js` | 5 înlocuiri (mai jos) |
| `Vizualizare 3 - Claude/vizualizare3.html` | doar `?v=` la `motor-analiza.js`: **45 → 46** |

**Nimic altceva.** Fără `vizualizare3-bootstrap.js`, fără CSS, fără `tests/`.

## P2.2 Cele 5 înlocuiri, exact

Toate în `motor-analiza.js`. Fiecare text „VECHI" se potrivește **exact o dată** în
fișier (verificat) — dacă vreuna nu se potrivește sau se potrivește de mai multe
ori, **oprește-te și raportează**, nu improviza.

### Înlocuirea 1 — `fereastraFactLaMoment` (în jurul liniei 527)

VECHI:
```js
  function fereastraFactLaMoment(valide, cellId, k, adancime) {
    const aleFactului = valide
      .slice(0, k)
      .filter((intrebare) => cheieCelulaDinInregistrare(intrebare) === cellId);
    return aleFactului.slice(Math.max(0, aleFactului.length - adancime));
  }
```

NOU:
```js
  // Index construit O SINGURA DATA per model: raspunsurile fiecarui fact, in
  // ordine, plus pozitiile lor GLOBALE in `valide` (crescatoare). Inlocuieste
  // rescanarea intregului istoric la fiecare (fact x moment x fereastra) —
  // aceeasi idee pe care construiesteStariPeMomente o foloseste deja mai jos.
  function construiesteIndexPeFact(valide) {
    const listaPeFact = new Map();
    const pozitiiPeFact = new Map();
    valide.forEach((intrebare, index) => {
      const cellId = cheieCelulaDinInregistrare(intrebare);
      if (cellId === null) return;
      if (!listaPeFact.has(cellId)) {
        listaPeFact.set(cellId, []);
        pozitiiPeFact.set(cellId, []);
      }
      listaPeFact.get(cellId).push(intrebare);
      pozitiiPeFact.get(cellId).push(index);
    });
    return { listaPeFact, pozitiiPeFact };
  }

  // Cate elemente din `pozitii` (sortat crescator) sunt strict mai mici decat `k`.
  // Strict `<`, ca `valide.slice(0, k)` de dinainte: momentul k e exclusiv.
  function cateInainteDe(pozitii, k) {
    let jos = 0;
    let sus = pozitii.length;
    while (jos < sus) {
      const mijloc = (jos + sus) >> 1;
      if (pozitii[mijloc] < k) jos = mijloc + 1;
      else sus = mijloc;
    }
    return jos;
  }

  function fereastraFactLaMoment(index, cellId, k, adancime) {
    const lista = index.listaPeFact.get(cellId);
    if (!lista) return [];
    const cate = cateInainteDe(index.pozitiiPeFact.get(cellId), k);
    return lista.slice(Math.max(0, cate - adancime), cate);
  }
```

### Înlocuirea 2 — semnătura `construiesteCelulaFoto` (în jurul liniei 538)

VECHI:
```js
  function construiesteCelulaFoto({ valide, cellIds, k, kAnterior, adancime, praguriV1 }) {
```

NOU:
```js
  function construiesteCelulaFoto({ index, cellIds, k, kAnterior, adancime, praguriV1 }) {
```

### Înlocuirea 3 — apelul ferestrei (în jurul liniei 546)

VECHI:
```js
      const fereastra = fereastraFactLaMoment(valide, cellId, k, adancime);
```

NOU:
```js
      const fereastra = fereastraFactLaMoment(index, cellId, k, adancime);
```

### Înlocuirea 4 — `areRaspunsNou` (în jurul liniei 554)

VECHI:
```js
      const areRaspunsNou = valide
        .slice(kAnterior, k)
        .some((intrebare) => cheieCelulaDinInregistrare(intrebare) === cellId);
      if (areRaspunsNou) factsNoi += 1;
```

NOU:
```js
      // „A primit raspuns nou in aceasta coloana?" = are vreo pozitie in
      // [kAnterior, k). Din pozitiile sortate, fara sa rescanam felia.
      const pozitii = index.pozitiiPeFact.get(cellId);
      const areRaspunsNou = pozitii
        ? cateInainteDe(pozitii, k) > cateInainteDe(pozitii, kAnterior)
        : false;
      if (areRaspunsNou) factsNoi += 1;
```

### Înlocuirea 5 — construirea indexului, o dată (în jurul liniei 733)

VECHI:
```js
    const randuri = ferestre.map(({ tip, eticheta, cellIds }) => ({
      tip,
      eticheta,
      celule: momente.map((k, idx) =>
        construiesteCelulaFoto({
          valide,
          cellIds,
```

NOU:
```js
    const index = construiesteIndexPeFact(valide);
    const randuri = ferestre.map(({ tip, eticheta, cellIds }) => ({
      tip,
      eticheta,
      celule: momente.map((k, idx) =>
        construiesteCelulaFoto({
          index,
          cellIds,
```

## P2.3 Regula critică de plasare

`const index = construiesteIndexPeFact(valide);` stă pe **un singur rând, exact
înaintea lui `const randuri = ...`** — adică o dată per model, în afara ambelor
bucle (`ferestre.map` și `momente.map`).

Dacă ajunge înăuntrul vreunei bucle, rezultatul rămâne corect dar viteza se
prăbușește sub cea de azi. De-aia criteriul de acceptare 2 (sweep < 500 ms) e
obligatoriu: e singurul care prinde această greșeală.

Plasarea e **după** early-return-ul pentru `B === 0`, deci nu se construiește
degeaba pe jurnal gol.

## P2.4 Bump de versiune (nu-l sări)

În `vizualizare3.html`:
```
<script src="motor-analiza.js?v=45"></script>   →   ?v=46
```
Fără el, browserul userului servește motorul vechi din cache și fix-ul pare că
n-a funcționat. Restul `?v=` rămân neatinse.

## P2.5 Verificare (toate cinci, în ordine)

1. **Sintaxă:** `node --check "Vizualizare 3 - Claude/motor-analiza.js"`

2. **Comparație veche-vs-nouă, strictă.** Recreează în scratchpad harnessul
   descris în §5: încarcă `git show HEAD:"Vizualizare 3 - Claude/motor-analiza.js"`
   (versiunea veche) și fișierul nou, izolat, în două obiecte-gazdă separate
   (`new Function("globalThis", cod)(gazda)`), rulează
   `construiesteModelTabelFluenta` pe ambele și compară **recursiv cu `Object.is`**
   (nu `JSON.stringify` — ascunde `NaN` vs `null`).
   - Date: `C:/Users/I/Downloads/youlearn-salvare-log-activitate-2026-08-13-17-19.json`
     (jurnal real) + `fixture-loguri-dummy.js` (pentru domeniul 1-10, unde jurnalul
     real n-are date).
   - Scenarii: cele 9 din §5, × adâncimile 1, 2, 3, 5, 10, 20, 50, 1000.
   - **Așteptat: 0 diferențe din 72.** Orice diferență = oprește-te și raportează.

3. **Timp:** sweep-ul (`construiesteRecomandareAdancime`, 4 adâncimi) pe jurnalul
   real, domeniul 11-20 × 1-20. **Așteptat ~130 ms; peste 500 ms = respins** (vezi
   §P2.3).

4. **Teste:** `node --test tests/*.test.js`. În `vizualizare3-tabel-fluenta.test.js`
   trebuie să rămână **5 treceri și exact aceleași 3 picări** descrise în §7 (cele cu
   `"acum"`). Orice a 4-a picare = regresie.

5. **Browser** (server `youlearn-verify`, port 8771, pagina
   `/Vizualizare 3 - Claude/vizualizare3.html`): pagina se încarcă vizibil rapid,
   tabelul se randează, `read_console_messages` fără erori, schimbarea adâncimii
   funcționează. Pe fixture domeniul e 1-10 (jurnalul real din IndexedDB e gol în
   browserul de test) — e în regulă, e chiar domeniul care-l interesează pe user.

## P2.6 În afara scopului (NU face)

- `construiesteStariPeMomente` — deja o singură trecere, O(B). Nu o unifica cu
  indexul nou: risc pe cod care merge, pentru câștig nemăsurabil.
- Cache-ul `cacheRecomandare` și cerculețul din `0dfc43b` — rămân cum sunt.
- Cele 3 teste cu `"acum"` — preexistente, altă temă (§7).
- Orice cache persistat (localStorage) — amânat cu motiv în §6.A (devine inutil
  după fix; se reia doar dacă măsurătoarea de după arată că mai e nevoie).
- `ruleazaAnaliza` / grila — 9 ms, nu e o problemă.
- Commit — doar la cererea explicită a userului.

## P2.7 Raportarea către user

Spune numerele reale, nu „merge acum": timpul măsurat înainte/după, numărul de
comparații stricte și rezultatul lor, și starea testelor (5 trec / 3 picau deja).
Dacă vreun criteriu din §8 pică, raportează asta, nu-l ocoli.
