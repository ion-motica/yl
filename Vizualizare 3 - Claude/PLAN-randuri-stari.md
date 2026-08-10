# PLAN — Rândurile de stări sub tabelul „% fluență" (Setul 1 + Setul 2)

Status: **IMPLEMENTAT 10.08.2026**, verificat pe jurnalul real în browser.
Reguli de lucru: `AGENTS.md`.

## Abateri de la plan, apărute la implementare

1. **Săgeata NU refolosește `viz3-sageata-sus`** (cum spunea §5.2). Clasa aia e
   `display:none` + `position:absolute` și se aprinde din bifele 5.2, care comandă
   săgețile de PROCENT — refolosită, marcajele n-ar fi apărut niciodată. Clasă
   proprie, `.viz3-sosiri`, în flux normal după număr, aceeași culoare de accent.
2. **Fundalul rândului de titlu a cerut selector lung.** `.viz3-tabel-titlu-set th`
   (clasă + element) pierde în fața regulii sticky `.viz3-tabel tbody th` (clasă +
   2 elemente), deci fundalul rămânea alb. Corectat cu
   `.viz3-tabel tbody tr.viz3-tabel-titlu-set th`. *Notă: rândul Total existent are
   aceeași problemă nerezolvată (`.viz3-tabel-total th` e tot alb) — preexistent, nu
   l-am atins.*
3. **Două fixture-uri de test existente au trebuit completate.** Literalii `PRAGURI`
   din `tests/vizualizare3-tabel-fluenta.test.js` și `tests/vizualizare3-recomandare.test.js`
   aveau doar `interpretare_v1`; modelul cere acum și `filtru_standard_v1` + `stare`.
   Adăugate cu valorile reale din `config-praguri.js`.
4. **Marcajul de sosiri sta la STANGA numarului**, nu la dreapta. Motivul (userul):
   descrie relatia cu coloana PRECEDENTA, nu cu cea urmatoare — aceeasi conventie ca
   sagetile de procent din acelasi tabel, care stau pe muchia din stanga a celulei.
   Consecinta: `.viz3-tabel-stare td` e aliniat la **dreapta**, nu centrat, altfel
   numarul ar sari orizontal intre coloanele cu marcaj si cele fara. Verificat:
   numerele stau la 9px de muchia dreapta si cu, si fara marcaj; intre marcaj si
   numar raman 4px.
5. **`?v` final**: css 58, motor 44, bootstrap 57 (mai multe urcari, dupa corectiile
   de la punctele 2 si 4).
6. **REVENIT, 10.08.2026: marcajul verde `.viz3-sosiri` (punctele 1 și 4) a fost
   scos.** Userul, după ce a înțeles exact ce reprezenta (sosiri prin urcare, nu
   diferența numărului), a cerut simplificare: „elimina numarul verde si fa
   sagetile EXACT ca in randurile cu procente". Rândurile de stare folosesc acum
   `adaugaSageataCelula` — **aceeași** funcție care naște săgețile de pe procente
   (glif, culoare, poziție absolută pe muchia stângă) — cu un `tipRand: "stare"`
   nou, care primește propria clasă `.viz3-sageata--stare` (vizibilă necondiționat,
   fără bifă — spre deosebire de `--total`/`--acum`/`--toate`, care depind de
   bifele 5.2). Semantica s-a schimbat: nu mai e „câți au urcat prin tranziție",
   ci simpla comparație a numărului brut cu coloana precedentă — **aceeași
   convenție ca la procente**, cu aceeași limită (o categorie poate primi și
   pierde facts în aceeași zi; săgeata arată doar soldul net, nu mișcarea).
   Userul a fost informat de asta cât timp exista marcajul verde și a ales
   simplitatea în cunoștință de cauză.

   **`sosiri_prin_urcare` a rămas în motor**, testat (8 teste în
   `tests/vizualizare3-stari-pe-momente.test.js`), doar neconsumat de randare —
   nu l-am șters, ca să nu arunc un calcul corect și ieftin (17 ms) doar fiindcă
   UI-ul nu-l mai afișează acum. Dacă rămâne definitiv neutilizat, de curățat
   separat.
   **`?v` după revenire**: bootstrap urcat din nou (vezi header-ul `vizualizare3.html`
   pt. valoarea curentă — se schimbă la fiecare rundă, nu fixa un număr aici).

## Eșecuri de teste PREEXISTENTE (nu de la runda asta)

3 teste din `tests/vizualizare3-tabel-fluenta.test.js` pică și pe codul curat din HEAD
(verificat rulând fișierul de test din HEAD pe motorul din HEAD, în scratchpad): așteaptă
ultimul antet `'acum'`, dar `formateazaZiuaAntet` (`:511`) întoarce mereu `ZZ.LL` — n-are
nicio ramură care să producă `'acum'`. Cineva a schimbat formatul antetului și n-a
actualizat testele. Total suită: **387 pass / 3 fail**, cele 3 fiind acestea.

Context de design: `CONTINUARE-proiect-MABP.md` (secțiunea „Progres/direcție"),
`SPECIFICATIE.md` §13, `PLAN-tabel-fluenta.md` (tabelul pe care se clădește asta),
`PLAN-sageti-progres-moduri.md` (săgețile existente).

Toate cifrele de verificare din acest document sunt **măsurate pe jurnalul real**
`youlearn-jurnal-merged-2026-08-09.json` (4047 apăsări → 3862 întrebări, 12.07–09.08,
domeniul 11-20 × 1-20 = 200 facts, zero necatalogate), nu inventate.

## 1. Scopul

Sub tabelul existent se adaugă două blocuri de rânduri care arată **câte facts** sunt
în fiecare stare, la fiecare coloană (= zi), plus câte au ajuns acolo **urcând** de la
o categorie inferioară.

Scopul declarat de user: să arate părintelui și copilului că nu pedalează în gol.
NU e un instrument de măsurare fină — e un instrument de încurajare onestă.

## 2. Ce se afișează, în ordine

După rândul `Toată fereastra` existent:

| rând | conținut |
|---|---|
| `Nr. ex. lucrate /zi` | rândul existent, DOAR redenumit (era „Nr. ex. lucrate") |
| `Nr. ex cumulate` | **NOU** — suma care se adună coloană cu coloană, de la începutul logului |
| `Data:` | rândul existent, neatins |
| *(rând gol)* | separare vizuală |
| `Setul 1 - Pt programator` | rând de titlu |
| `netestat` | numărul de facts; **fără** săgeată (n-are nimic sub el) |
| `abia_inceput` | număr + săgeată (sosiri prin urcare din `netestat`) |
| `nu_il_stie` | număr + săgeată |
| `in_lucru` | număr + săgeată |
| `fluent` | număr + săgeată |
| `suma` | constantă = numărul de facts din domeniu; self-check |
| `Setul 2 - Pt parinte si elev` | rând de titlu |
| `netestat + abia_inceput + nu_il_stie` | numărul comasat; **fără** săgeată |
| `in_lucru` | număr + săgeată |
| `fluent` | număr + săgeată |
| `suma` | constantă; self-check |

Formatul celulei: `62 ↗13` — numărul de stare, apoi săgeata verde cu numărul de sosiri.
Când sosirile sunt 0, nu apare nimic după număr.

`Nr. ex cumulate` nu primește săgeată: crește prin construcție, o săgeată n-ar spune nimic.

## 3. Deciziile userului (nu se re-litigă)

1. **Săgeata numără facts care au urcat**, nu creșterea numărului din categorie.
   („5 facts au ajuns în `in_lucru` venind de mai jos", nu „numărul a crescut de la 5 la 6".)
2. **Se numără TOATE urcările**, inclusiv cele din `netestat`/`abia_inceput` în `in_lucru`.
   Userul știe că acelea sunt logistică (quizul a ajuns la fact, sau s-au strâns 5 răspunsuri),
   nu învățare, și le vrea afișate: **Setul 1 e despre logistică, nu despre învățare.**
   Măsurat pe real: pe 6.08, din 8 sosiri în `in_lucru`, 7 erau descoperiri, nu învățare.
   *În Setul 2 efectul e invizibil (grupul comasat ascunde de unde a venit factul) — userul
   a fost informat, a acceptat.*
3. **Fără poartă de așteptare.** Săgeți la fiecare zi consecutivă. Valid: e o numărătoare
   literală de facts care și-au schimbat categoria, nu o comparație de procente.
4. **Ambele seturi vizibile simultan**, fără bifă de comutare.
5. **`nu_il_stie` NU se redenumește**, deși pe jurnalul real 50 din 55 de verdicte
   `nu_il_stie` vin din viteză, nu din precizie (userul: datele sunt de la un adult,
   nereprezentative pentru copii — se reevaluează când lucrează copii reali).
6. `suma` apare o dată per set (redundanță voită — e self-check).

## 4. Descoperirea care simplifică implementarea

Sosirile prin urcare în `in_lucru` sunt **același număr** în ambele seturi:

- Setul 1: „era în `netestat`, `abia_inceput` sau `nu_il_stie`, acum e în `in_lucru`"
- Setul 2: „era în grupul comasat, acum e în `in_lucru`"

Grupul comasat **este** reuniunea acelor trei. La fel pentru `fluent`. Deci motorul
calculează UN set de numere; ambele blocuri de rânduri îl citesc. Fără calcul dublu.

## 5. Modificări, fișier cu fișier

### 5.1 `motor-analiza.js`

Funcție nouă, pură, plasată lângă `construiesteCelulaFoto` (`:538`):

```js
// Cate facts sunt in fiecare stare la fiecare moment, si cate au ajuns acolo
// URCAND de la o categorie inferioara fata de momentul precedent.
// Foloseste `filtru_standard_v1` + `stare` — ACELEASI praguri ca grila 10x10, ca
// un fact sa nu aiba o stare in grila si alta aici. (Ferestrele difera: grila
// segmenteaza in calupuri, tabelul foloseste `adancime` — asta e asteptat.)
// O SINGURA trecere prin `valide`, cu un cursor per fact: fara re-filtrarea
// listei la fiecare moment (masurat: 17 ms pe jurnalul real de 3862 intrebari).
function construiesteStariPeMomente({ valide, momente, cellIds, adancime, praguri })
// -> [ { contor: {netestat, abia_inceput, nu_il_stie, in_lucru, fluent},
//        sosiri_prin_urcare: {abia_inceput, nu_il_stie, in_lucru, fluent} } ]
```

Reguli:
- ordinea categoriilor = `TRASEU_STARE` (`:257`, deja în modul, nu se exportă).
- `netestat` nu apare în `sosiri_prin_urcare` — n-are nimic sub el.
- prima coloană: toate sosirile 0 (n-are cu ce compara).
- `praguri.stare` și `praguri.filtru_standard_v1` sunt deja disponibile — funcția
  primește `praguri` întreg, ca restul motorului. Fără parametru nou.

În `construiesteModelTabelFluenta` (`:595`): un apel și un câmp nou pe modelul
întors, `stari_pe_momente`. Pe ramura `B === 0` (`:630`) câmpul e `[]`.

**De ce în modelul tabelului, nu funcție separată chemată din bootstrap:** `valide` și
`momente` se construiesc acolo; o funcție separată le-ar recalcula de la zero
(măsurat: modelul tabelului ia deja 2789 ms pe jurnalul real).

### 5.2 `vizualizare3-bootstrap.js`

În `randeazaTabelFluenta` (`:2266`), în blocul care rulează după rândul Total (`:2373`).

1. `construiesteRandExercitii` (`:2173`) — schimbă textul `:2178` în `"Nr. ex. lucrate /zi"`.
2. Funcție nouă `construiesteRandCumulat(numarPeZi)` — aceeași formă, sumă rulantă.
   Fără date noi din motor: `numar_exercitii_valide_pe_zi` există deja în model.
3. Funcție nouă `construiesteRandStare({ eticheta, numere, sosiri, clasa })` —
   **singurul loc** unde se naște un rând de stare. Un rând = etichetă + o celulă per
   coloană; celula = numărul, plus `↗N` dacă `sosiri > 0`. Refolosește clasa existentă
   `viz3-sageata-sus` (verde) — aici creșterea e mereu veste bună, deci culoarea e
   corectă fără excepții.
4. Funcție nouă `construiesteBlocuriStari(stariPeMomente)` — construiește cele două
   blocuri din §2, apelând `construiesteRandStare` de 5 + 3 ori. Setul 2 își calculează
   rândul comasat adunând cele trei numere ale Setului 1, și își ia sosirile direct
   (vezi §4).
5. Ordinea de inserare în `tbody`, la `:2373`: exerciții/zi → cumulat → `Data:` →
   rând gol → blocurile.

Săgețile noi **nu** trec prin `adaugaSageataCelula` (`:2194`) — aia compară procente
și are etichetele de mod `--total/--acum/--toate` pentru bifele din 5.2. Rândurile de
stări au altă natură (numărătoare, nu procent) și nu intră sub acele bife.

### 5.3 `vizualizare3.css`

Clase noi, la finalul fișierului, lângă regulile de tabel:
- `.viz3-tabel-titlu-set` — rândul de titlu al setului (bold, fundal ușor).
- `.viz3-tabel-rand-gol` — rândul de separare (înălțime fixă, fără chenar).
- `.viz3-tabel-stare` — rândurile de numere.
- `.viz3-tabel-suma` — rândul `suma` (gri, mic — e self-check, nu conținut).
- `.viz3-sosiri` — numărul de lângă săgeată (mic, verde, lângă `viz3-sageata-sus`).

Săgețile de aici sunt în flux normal, NU absolute ca cele de pe procente — se scriu
după număr, nu peste el.

### 5.4 `vizualizare3.html` — cache busting

Modificate: `.css`, `motor-analiza.js`, `.js`. Urcă:
- `vizualizare3.css?v=54` → `?v=55` (`:7`)
- `motor-analiza.js?v=43` → `?v=44` (`:20`)
- `vizualizare3-bootstrap.js?v=55` → `?v=56` (`:21`)

Fără asta, browserul userului servește cod vechi și pare că nu merge.

## 6. Pre-mortem / riscuri

| risc | verdict |
|---|---|
| **Performanță** | Măsurat: +17 ms peste cele 2789 ms pe care le ia deja modelul tabelului. 0,6%. Nu e risc. |
| **Stările diferă de grilă** | Da, și e normal: aceleași praguri, ferestre diferite (grila = calupuri, tabelul = adâncime). De documentat, nu de „reparat". |
| **`abia_inceput` sare brusc** | Real, pe 31.07: 20 → 86, fiindcă quizul a atins 71 de facts noi (`netestat` a căzut 91 → 20). Arată ca o prăbușire, e benign. |
| **Numărul scade dar săgeata e pozitivă** | Posibil și corect: un rând poate primi facts prin urcare și pierde altele în același timp (ex. `abia_inceput` pe 5.08: 20 sosiri din `netestat`, dar net +13). Săgeata numără sosiri, nu soldul. |
| **Suma ≠ numărul de facts** | Ar fi bug. Intră în criteriile de acceptare (§7.1). |
| **Fereastră contaminată în log** | 31.07–03.08 (`sq3FactorGroup` cu necunoscuta pe factorul mic, exploatabilă; corectat pe 04.08). La adâncime 15 fereastra medie ajunge înapoi 11,5 zile, deci datele alea sunt încă înăuntru pe 09.08 și ies singure. Userul a decis: nu se exclude nimic, se corectează din mers. |

**Alternative respinse:**
- Funcție separată exportată, chemată din bootstrap → ar recalcula `valide`+`momente` (2,8 s).
- Poartă de așteptare pe săgeți → inutilă la o numărătoare de facts (vezi §3.3).
- Excluderea sosirilor din `netestat`/`abia_inceput` → userul le vrea (§3.2).
- Redenumirea lui `nu_il_stie` → userul a decis nu (§3.5).

## 7. Criterii de acceptare — verificabile pe jurnalul real

Fișier: `youlearn-jurnal-merged-2026-08-09.json`, domeniu 11-20 × 1-20, adâncime 15.

1. **Suma** fiecărei coloane = **200**, în ambele seturi, la orice adâncime.
2. **Coloana 9.08, Setul 1**: `netestat` 0 · `abia_inceput` 19 · `nu_il_stie` 55 ·
   `in_lucru` 62 · `fluent` 64.
3. **Coloana 9.08, Setul 2**: 74 · 62 · 64.
4. **Sosiri prin urcare 8.08 → 9.08**: `in_lucru` 13, `fluent` 6. (Aceleași numere în
   ambele seturi — §4.)
5. **Sosiri prin urcare 5.08 → 6.08**: `in_lucru` 8, `fluent` 4.
6. **Prima coloană**: nicio săgeată nicăieri.
7. **`abia_inceput` nu depinde de adâncime**: pe adâncime 10 și 20, coloana 9.08 dă tot
   **19**. (E „câte facts au sub 5 răspunsuri în total" — adâncimea nu-l atinge.)
8. **Coloana 9.08, adâncime 10, Setul 1**: 0 · 19 · 55 · 62 · 64.
   **adâncime 20**: 0 · 19 · 58 · 61 · 62.
9. **`Nr. ex cumulate`** pe ultima coloană = numărul total de răspunsuri valide din log;
   fiecare coloană = suma tuturor coloanelor de la ea la stânga, inclusiv.
10. **Rândurile vechi neatinse**: procentele, bara, săgețile de procent, `Grafic bare`,
    `Data:` — identice cu azi. Bifele din 5.2 funcționează la fel.
11. `node --check` pe `motor-analiza.js` și `vizualizare3-bootstrap.js` **înainte** de browser.
12. `node --test "tests/*.test.js"` → toate verzi. (`tests/equations-e3-e6.test.js` are un
    test flaky cunoscut, generare aleatoare — dacă pică DOAR el, re-rulează o dată.)

## 8. Testele — fișier nou `tests/vizualizare3-stari-pe-momente.test.js`

Același tipar ca `tests/vizualizare3-tabel-fluenta.test.js` (`incarcaMotor()`, literal
`PRAGURI`, catalog literal minim, apăsări brute). Teste minime:

1. **Fără date**: `stari_pe_momente` = `[]`.
2. **O coloană**: toate facts în `netestat` în afară de cele testate; suma = numărul de
   facts din catalog; toate sosirile 0.
3. **Urcare simplă**: un fact trece `nu_il_stie` → `in_lucru` între două coloane →
   `sosiri_prin_urcare.in_lucru === 1`.
4. **Coborâre nu produce sosire**: un fact care coboară nu apare în `sosiri_prin_urcare`
   al categoriei în care aterizează.
5. **Suma e invariantă**: pe un fixture cu mai multe coloane, fiecare coloană sumează la
   `catalog.celule.length`.

## 9. Verificarea în browser (obligatorie — e schimbare de UI)

1. `preview_start`, deschide `vizualizare3.html`, bifează „Tabel % fluență".
2. Importă jurnalul real → verifică punctele 1-9 din §7 direct pe ecran.
3. Schimbă adâncimea 15 → 10 → 20: rândurile se recalculează, `abia_inceput` rămâne 19 (§7.7).
4. Comută pe „Grila X × Y stare" și înapoi: grila și foliile funcționează identic.
5. `read_console_messages` — zero erori.
6. Screenshot ca dovadă pentru user.

## 10. În afara scopului (NU face)

- Optimizarea celor 2789 ms ai modelului existent (problemă preexistentă, rundă separată).
- Bifă de comutare între seturi; bifă care ascunde blocul (userul: rămân ambele, mereu).
- Excluderea sosirilor logistice; redenumirea categoriilor; poarta de așteptare.
- Motorul dincolo de funcția nouă + câmpul nou; grila; foliile; alte quizuri.
- Commit — doar la cererea explicită a userului.

## 11. Definition of done

- Fișiere modificate: `Vizualizare 3 - Claude/motor-analiza.js`,
  `Vizualizare 3 - Claude/vizualizare3-bootstrap.js`,
  `Vizualizare 3 - Claude/vizualizare3.css`,
  `Vizualizare 3 - Claude/vizualizare3.html` (doar `?v`),
  plus fișierul nou `tests/vizualizare3-stari-pe-momente.test.js`.
  NIMIC altceva (`.claude/settings.local.json` și `node_modules/` nu se ating).
- `node --check` pe cele două JS, apoi `node --test "tests/*.test.js"` verde.
- Criteriile §7 verificate pe jurnalul real, cu screenshot arătat userului.
- Editare DOAR cu Edit/Write (fișierele au diacritice; PowerShell le corupe).
