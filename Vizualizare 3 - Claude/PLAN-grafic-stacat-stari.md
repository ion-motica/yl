# PLAN — Grafic stivuit (stacked) peste rândurile de stări (Setul 1 + Setul 2)

Status: **specificație pt. aprobare, 10.08.2026.** Reguli de lucru: `AGENTS.md`.
Extinde `PLAN-randuri-stari.md` (rândurile Setul 1/Setul 2, implementate azi) cu un
strat vizual nou. Nimic din motor (`motor-analiza.js`) nu se atinge: e strict
prezentare peste `stariPeMomente`, deja calculat.

## 1. Scopul

Peste cele două blocuri de rânduri (Setul 1 — 5 stări, Setul 2 — 3 stări comasate),
o **bandă stivuită continuă pe verticală, câte una per coloană** (per calup/dată),
ca un stacked column chart: fiecare segment = o stare, înălțimea segmentului
proporțională cu numărul din acea stare, înălțimea totală constantă (= `suma`,
mereu 200 pe jurnalul real) și fixă — **nu depinde de câte rânduri are tabelul**,
banda taie pur și simplu peste graniițele rândurilor native (exact ca în pozele
Excel arătate de user: la o coloană cu mult `netestat`, roșul se revarsă vizual
peste rândul `abia_inceput`, fiindcă segmentul roșu ocupă mai mult decât înălțimea
proprie a rândului `netestat`).

Bandă = de la marginea de SUS a primului rând al setului (`netestat` / comasat)
până la marginea de JOS a ultimului rând (`fluent`) — **fără rândul `suma`**.

## 2. Culorile (decise de user, convenția ROGVAIV)

| Set | Stare | Culoare |
| --- | --- | --- |
| Setul 1 | `netestat` | Roșu |
| Setul 1 | `abia_inceput` | Oranj |
| Setul 1 | `nu_il_stie` | Galben |
| Setul 1 | `in_lucru` | Verde |
| Setul 1 | `fluent` | Albastru |
| Setul 2 | comasat (`netestat+abia_inceput+nu_il_stie`) | Ruginiu |
| Setul 2 | `in_lucru` | Verde |
| Setul 2 | `fluent` | Albastru |

**Schimbat 13.08.2026** (varianta inițială de mai jos, istoric): Setul 2 refolosea
literal primele 3 variabile ale Setului 1 (Roșu/Oranj/Galben), aplicate altor
segmente decât starea lor originală — `in_lucru` ieșea oranj, `fluent` ieșea
galben, fără legătură cu culoarea aceleiași stări din Setul 1. Userul a cerut
consistență de sens: `fluent`/`in_lucru` țin ACEEAȘI culoare ca în Setul 1
(albastru/verde), iar categoria comasată primește o culoare proprie — **ruginiu**
(`#f1902e`), media aritmetică a Roșu+Oranj+Galben (`#e63b2e`+`#f5a623`+`#f7d038`),
nu doar Roșu-ul reluat. 6 variabile în total:
`--viz3-stacat-rosu/oranj/galben/verde/albastru/ruginiu`.

## 3. Geometria (partea tehnică — de ce nu e o simplă extindere a barei existente)

Bara verticală existentă (`viz3-bara`, §3 `PLAN-bara-progres-tabel.md`) trăiește
**într-un singur `<td>`** (`position: relative` deja pe `.viz3-tabel tbody td`,
`:852`+`:934`) — segmentele ei sunt procente din înălțimea PROPRIE a acelei celule.

Graficul cerut acum trebuie să traverseze **5 (sau 3) rânduri `<tr>` diferite** în
aceeași coloană — table layout-ul HTML nu oferă asta gratis (nu e un `rowspan`,
fiindcă fiecare rând tot își păstrează propriul număr afișat separat). Soluție:

1. `construiesteBlocuriStari` (`:2227`) e modificată să **întoarcă** (nu doar să
   adauge în `tbody`) listele de `<tr>` create per set, în ordine
   (`{ set1: [trNetestat, trAbiaInceput, trNuIlStie, trInLucru, trFluent], set2: [...] }`).
   Fără căutare fragilă în DOM după clase — apelantul primește direct referințele.
2. Funcție nouă, `randeazaGraficeStacate(tabel, seturi, stariPeMomente)`, apelată
   din `randeazaTabelFluenta` **după** ce tabelul e în DOM (layout-ul trebuie să
   existe ca să măsurăm). Pentru fiecare coloană `i` (0..N-1) și fiecare set:
   - `tdSus = seturi.set1[0].children[i+1]` (primul rând al setului, celula
     coloanei `i`; `+1` sare peste `<th>` etichetă).
   - `tdJos = seturi.set1.at(-1).children[i+1]` (ultimul rând al setului).
   - `top = tdSus.getBoundingClientRect().top - tabel.getBoundingClientRect().top`
   - `bottom = tdJos.getBoundingClientRect().bottom - tabel.getBoundingClientRect().top`
   - `left`/`width` din `tdSus.getBoundingClientRect()` (identic la sus și jos —
     aceeași coloană).
   - Motiv pentru `getBoundingClientRect`, nu `offsetTop/offsetLeft`: celulele de
     tabel au un comportament istoric inconsistent între motoare de randare pt.
     `offsetParent` (uneori cade pe `<table>`, uneori nu) — diferențele de
     `getBoundingClientRect` sunt corecte indiferent de asta și indiferent de
     scroll (ambele dreptunghiuri sunt măsurate în același cadru, deci diferența
     e stabilă la orice poziție de scroll).
   - Se creează un `<div class="viz3-grafic-stacat">` cu `position:absolute` în
     coordonatele de mai sus, copil al **`<table>`** (nu al `.viz3-tabel-scroll`),
     ca banda să scroleze împreună cu coloanele (conținut normal al containerului
     scrolabil), nu să rămână pe loc.
   - Înăuntru, 5 (sau 3) `<div>`-uri flex, în ordine DOM normală (NU
     `column-reverse`, spre deosebire de bara existentă: aici stiva pornește de
     SUS, nu de jos), fiecare cu `flex-basis: ${numar/suma*100}%` și clasa de
     culoare corespunzătoare.
3. **`<table class="viz3-tabel">` primește `position: relative; isolation: isolate;`**
   (nou, `:852`). `isolation: isolate` izolează un context de stivuire propriu, ca
   să putem folosi `z-index: -1` pe bandă fără riscul să iasă în spatele altui
   conținut din pagină.
4. **Fără nicio modificare la `construiesteRandStare` (`:2203`) sau la săgeți**
   (`.viz3-sageata-sus/jos`, deja `position:absolute` în interiorul fiecărui
   `<td>`, `:1089`). Cu `isolation: isolate` pe tabel + `z-index: -1` pe
   `.viz3-grafic-stacat`, atât textul simplu (necolorat, non-poziționat) cât și
   săgețile (poziționate, `z-index:auto`) se pictează DUPĂ banda cu z-index
   negativ, indiferent de asta — regula CSS 2.1 de ordine de pictură (fundal →
   descendenți poziționați cu z-index negativ → descendenți normali → descendenți
   poziționați cu z-index auto/0). Rezultat: banda stă în spatele numerelor ȘI al
   săgeților, fără să atingem codul de azi.

## 4. Recalcularea geometriei

- La fiecare randare/re-randare a tabelului (schimbare adâncime/domeniu/sursă):
  `randeazaGraficeStacate` rulează din nou automat, fiindcă `randeazaTabelFluenta`
  reconstruiește tot tbody-ul.
- La `resize` fereastră: listener nou, cu debounce (~150ms), care re-rulează
  DOAR măsurătoarea + repoziționarea (nu tot randeazaTabelFluenta) — ieftin,
  plasă de siguranță în caz că lățimile coloanelor răspund la viewport (probabil
  nu, coloanele sunt content-width, dar costă aproape nimic să fie corect oricum).
- **Nu** la scroll orizontal: banda e copil al `<table>`, deci se mișcă natural cu
  conținutul scrolat, fără cod dedicat (vezi §3 punctul „copil al `<table>`").

## 5. Controalele noi în CP

O singură axă nouă, `subsectiune: "tabel_optiuni"` (rămâne în 5.2, ca „Progres"),
plasată **după** axa `progres_tabel` (`definitii-axe.js:299`), cu propriul titlu
de grup — secțiunea cerută de user, „Grafic stacked pt stări":

```js
{
  id: "grafic_stacat_stari",
  eticheta: "Grafic stacked pt stări",
  subsectiune: "tabel_optiuni",
  tip_control: "grafic_stacat_stari",   // control special, ca "progres_tabel"
  optiuni: [
    { id: "set1", eticheta: "Grafic pt 1 (Setul 1)", activa: true },
    { id: "set2", eticheta: "Grafic pt 2 (Setul 2)", activa: true },
  ],
  reglaje: [
    { id: "latime", eticheta: "Lățime bandă", tip: "slider", min: 5, max: 100, pas: 1, implicit: 100, unitate: "%" },
    { id: "pozitie", eticheta: "Poziție bandă (0 stânga · 100 dreapta)", tip: "slider", min: 0, max: 100, pas: 1, implicit: 50, unitate: "%" },
    { id: "opacitate", eticheta: "Opacitate", tip: "slider", min: 0, max: 100, pas: 1, implicit: 88, unitate: "%" },
  ],
}
```

Ambele bife **implicit bifate** (decizie ulterioară a userului, 10.08.2026, după
verificarea în browser — inițial fuseseră nebifate, ca bara existentă). **Un
singur set de 3 slidere**, comun ambelor grafice (decizia userului, §4/§5 din
discuție) — spre
deosebire de „Progres", unde fiecare bifă avea reglajele ei proprii, aici cele
două bife împart aceleași 3 variabile CSS. Fără slider de înălțime: înălțimea
e fixă, dată de poziția rândurilor (§1), nu un reglaj.

Randare: funcție nouă `randeazaControlGraficStacat(grup, axa)`, analoagă
`randeazaControlProgresTabel` (`:2875`) dar mai simplă (o singură pereche de
slidere-comune, nu 2×4). Aplicare live: funcție nouă `aplicaOptiuniGraficStacat()`
(analoagă `aplicaOptiuniProgresTabel`, `:2825`), setează clase
`viz3-arata-grafic-stacat-set1` / `-set2` pe `<table>` + variabilele CSS
`--viz3-grafic-stacat-latime/pozitie-frac/opacitate`. Aceeași integrare cu
preseturile (localStorage) ca restul lui 5.2 — chei `dataset.preset`:
`grafic_stacat_stari_set1`, `_set2`, `_latime`, `_pozitie`, `_opacitate`.

## 6. CSS nou (`vizualizare3.css`)

- `.viz3-tabel { position: relative; isolation: isolate; }` — adăugat la regula
  existentă (`:852`).
- `.viz3-grafic-stacat` — `position:absolute; z-index:-1; display:flex;
  flex-direction:column; overflow:hidden; pointer-events:none;` + `display:none`
  implicit, arătat prin clasele `viz3-arata-grafic-stacat-set1`/`-set2` pe
  `<table>` (fiecare bandă individuală primește `data-set="1"` sau `"2"`, clasa
  de vizibilitate se leagă de asta).
- `.viz3-grafic-stacat-segment` — `flex-basis` setat inline per segment (JS,
  ca la `viz3-bara-s1/s2`), `opacity: var(--viz3-grafic-stacat-opacitate)`.
- 5 clase de culoare (`--rosu/oranj/galben/verde/albastru`) + variabilele
  `--viz3-grafic-stacat-latime/pozitie-frac/opacitate` în `:root`.

## 7. Cazuri-limită

- **Coloană cu `suma !== 200`** (n-ar trebui, e self-check, dar defensiv):
  fracțiile se calculează din `suma` REALĂ a coloanei (adunarea celor 5/3
  numere afișate), nu dintr-o constantă — dacă suma e ruptă undeva, banda
  reflectă exact ce arată numerele, nu ascunde bug-ul.
  - **`suma === 0`** (posibil doar teoretic — catalog gol): fără bandă pe acea
    coloană (evită împărțire la 0); niciun caz real în datele curente.
- **O singură coloană** (tabel foarte scurt): banda se construiește normal,
  fără nimic special (nu există „coloană precedentă" relevantă aici, spre
  deosebire de săgeți).
- **Font/zoom diferit → rânduri cu înălțimi ușor diferite** între ele (text
  wrap la etichete lungi, etc.): măsurătoarea per-coloană ia `top` din primul
  rând și `bottom` din ultimul, deci se adaptează automat — nu presupune
  rânduri egale ca înălțime.
- **Bifă activă + schimbare adâncime**: tabelul se reconstruiește, banda se
  reconstruiește automat din nou (fără cod suplimentar de păstrare a stării —
  bifele/sliderele rămân în variabilele JS, ca la „Progres").

## 8. Criterii de acceptare (verificabile în browser)

Pe jurnalul real (`youlearn-jurnal-merged-2026-08-09.json`), adâncime 15:

1. Cu ambele bife oprite: nimic vizibil nou, tabelul arată exact ca azi.
2. Bifă „Grafic pt 1" pornită: pe coloana 9.08 (netestat 0 · abia_inceput 19 ·
   nu_il_stie 55 · in_lucru 62 · fluent 64, `suma=200`), banda arată, de sus în
   jos: roșu 0% (invizibil), oranj 9,5%, galben 27,5%, verde 31%, albastru 32%
   — și taie vizual peste graniițele rândurilor native (nu se aliniază cu ele).
3. Bifă „Grafic pt 2" pornită (independent de Grafic 1, ambele pot fi active
   simultan): coloana 9.08 (74 · 62 · 64) → roșu 37%, oranj 31%, galben 32%.
4. Banda se oprește exact la baza rândului `fluent`; rândul `suma` de dedesubt
   n-are nimic peste el.
5. Numerele și săgețile rămân perfect lizibile peste bandă, la orice opacitate
   ≥ 30%.
6. Sliderul Lățime îngustează banda; Poziție o mută stânga↔dreapta; Opacitate
   0% → invizibilă, 100% → opacă; toate live, fără recitirea sursei.
7. Scroll orizontal: banda rămâne aliniată cu coloana ei (nu rămâne în urmă,
   nu fuge înainte).
8. Schimbare adâncime 15→10→20: banda se recalculează corect pe noile numere.
9. Reîncărcarea paginii păstrează bifele + cele 3 slidere (localStorage).
10. `node --check` pe `vizualizare3-bootstrap.js` + `vizualizare3.css` valid;
    `node --test "tests/*.test.js"` neschimbat (nicio funcție de motor atinsă).
11. `read_console_messages` — zero erori.

## 9. În afara scopului (NU face)

- Orice schimbare în `motor-analiza.js` — datele există deja (`stariPeMomente`).
- Rescrierea `construiesteRandStare` sau a săgeților existente.
- Slider de înălțime (fixă, din poziția rândurilor).
- Culori separate pentru Setul 2 (refolosește primele 3 din Setul 1).
- Commit — doar la cererea explicită a userului.

## 10. Fișiere atinse

`Vizualizare 3 - Claude/vizualizare3-bootstrap.js`,
`Vizualizare 3 - Claude/vizualizare3.css`,
`Vizualizare 3 - Claude/definitii-axe.js`,
`Vizualizare 3 - Claude/vizualizare3.html` (doar `?v`, css 60→61, definitii-axe
45→46, bootstrap 58→59). Nimic în `motor-analiza.js` sau `tests/`.
