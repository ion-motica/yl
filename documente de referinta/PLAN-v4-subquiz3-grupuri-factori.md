# PLAN — v4: Subquiz 3 pe grupuri de factori (fg)

Plan de implementare pentru `js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js`.
Scris 29.07.2026, după o rundă completă de clarificări cu userul.
**Nu se atinge v3** (`multiplication-1120-v3-train-eff-eq-forms.js`) — v4 e clona.

---

## 1. Scop

Subquiz 3 înlocuiește Subquiz 2 ca destinație a declanșatorilor de „intensiv".
În loc să exerseze facte alese individual (după greșeli/lentoare), sq3 alege un
**grup de factori** întreg, folosind scorul de fluență din jurnalul istoric.

Subquiz 1 devine un **pas de acoperire**: fiecare fact al nivelului, exact o dată.

---

## 2. Specificație (decisă, fără ambiguități rămase)

### 2.1 Domeniul

- Nivele 1..10; factorul nivelului `A = 10 + nivel` (11..20).
- **`b` merge 1..20 la fiecare nivel**, decuplat de `A`.
  Azi în v3 `b` e plafonat la `A` (`maxFactB()` returnează `factorForLevel(level)`) —
  în v4 se elimină plafonul. Un nivel are deci mereu 20 de facte: `A*1 ... A*20`.

### 2.2 Subquiz 1 — bază (acoperire)

- Fiecare fact al nivelului apare **exact o dată**.
- **Factele exersate în sq3 contează ca acoperite** → sq1 le sare.
- Nivelul se termină când toate cele 20 sunt acoperite (prin sq1 sau sq3).
  Constanta `QUESTIONS_PER_LEVEL = 12` devine obsoletă.
- Ordinea: **crescător cu amestec local, K = 4**. Se iau următoarele 4 facte
  neacoperite în ordine crescătoare, se amestecă între ele, se emit; apoi
  următorul grup de 4. Rezultat tipic: `3,1,4,2, 7,5,8,6, 11,9,...`
  Nu se poate sări de la 19 la 2.
  Notă de reuse: e conceptual ce face deja `Sequencer.createSlidingWindow`,
  dar fără repetiții — se evaluează refolosirea cu un mod „fără repetare"
  în loc de rescriere.
- `1*`, `10*`, `20*` apar exact o dată, automat, din regula de mai sus.
  Nu apar în niciun fg, deci sq3 nu le atinge niciodată.

### 2.3 Declanșarea sq3

Aceleași criterii ca azi pentru sq2, doar destinația se schimbă:
- (a) s-au acumulat 2 facte greșite;
- (b) la fiecare 5 răspunsuri în bază.

Plafon: **maxim 3 sq3 per nivel**. După al treilea, declanșatorii se ignoră și se
rămâne în sq1 tot restul nivelului. Contorul se resetează la schimbarea nivelului,
inclusiv la schimbarea manuală prin butoanele 1-10 (`switchLevel` → `resetLevelState`).

**Butonul manual „Bagă factul curent în subquiz 2!" se șterge** (`getArenaActions`,
`runArenaAction`, `startCurrentFactSq2`).

### 2.4 Grupurile de factori (fg)

Listă fixă, **9 grupuri** (`[12,14,16,18]` eliminat — user, 29.07.2026, „nu mă ajută";
motivul concret observat: la nivelul 2, A=12, unul din membrii grupului (12) coincide
cu factorul nivelului, producând întrebări de tipul `12*12=?`):

| # | fg | mărime |
|---|---|---|
| 1 | 2 4 8 16 | 4 |
| 2 | 4 8 12 16 | 4 |
| 3 | 2 4 6 8 | 4 |
| 4 | 5 15 | 2 |
| 5 | 3 6 9 | 3 |
| 6 | 12 15 18 | 3 |
| 7 | 7 11 13 17 19 | 5 |
| 8 | 3 6 12 18 | 4 |
| 9 | 3 9 18 | 3 |

Toate valorile sunt în 2..19, deci mereu în domeniul 1..20 — nu există intersecție vidă.

**Notă:** eliminarea lui `[12,14,16,18]` nu rezolvă problema generală — și celelalte
fg-uri conțin valori care pot coincide cu A la un anumit nivel: `12 15 18` la nivelele
2/5/8 (A=12/15/18), `7 11 13 17 19` la nivelele 1/3/7/9 (A=11/13/17/19), `4 8 12 16` la
2/6, `3 6 12 18` la 2/8, `2 4 8 16` la 6, `5 15` la 5, `3 9 18` la 8 — doar `2 4 6 8` și
`3 6 9` nu ating niciodată domeniul 11..20. Userul a cerut eliminarea punctuală a
grupului care a produs coincidența observată, nu o regulă generală anti-coincidență —
dacă deranjează din nou la alt nivel/fg, e un semnal să discutăm o regulă sistematică
(ex. excluderea lui A din fg la calculul `alegeFG` pentru nivelul curent), nu doar
eliminarea punctuală a încă unui grup.

### 2.5 `alegeFG()`

Pentru fiecare fg **nefolosit încă în nivelul curent**:

- `medie` = media scorurilor de fluență ale factelor `A*b`, `b ∈ fg`, **doar pentru
  `A`-ul nivelului curent** (nu se agregă pe verticală peste alte subtabele).
  Fact netestat → scor 0, și intră în medie.
- `acoperire` = (câte facte din fg sunt deja acoperite în nivelul curent) / (mărimea fg).
  Valoare 0..1. Calculată **live**, din starea în memorie.
- `scor = (medie + 1) * (acoperire + 2)`

Câștigă **scorul cel mai mic** (fluență proastă și/sau puțin lucrat).

**Departajare la egalitate:** comparație lexicografică crescătoare pe valorile `b`
sortate ale fg-ului; câștigă primul. (Interpretarea răspunsului „în ordinea
crescătoare"; e cazul frecvent la începutul nivelului, când acoperirea e 0 peste tot.)

### 2.6 Rularea sq3

- Factele = `A*b` pentru `b ∈ fg` ales.
- Formele de întrebare: 3 butoane, aceleași capcane (`buildMulDivEqFormOptions`).
  Forma de ecuație e **uniformă pe tot stack-ul** și se rotește periodic — vezi §2.8.
  Sq3 are **propriul** control de nr. forme, în CP SQ3; nu folosește `sq2EqFormCount`.
- Ciclare prin facte, fără repetarea imediată a aceluiași fact (ca `buildBQueue` azi).
- **Ieșire**, oricare survine prima:
  - fiecare fact are ≥ 3 răspunsuri corecte (nu neapărat consecutive), **sau**
  - fiecare fact a fost întrebat de ≥ 5 ori (plasă de siguranță).
- La ieșire se revine în sq1; factele exersate rămân marcate ca acoperite.

### 2.7 Subquiz 2

Rămâne în cod, **nu se mai declanșează niciodată** automat. Secțiunea lui de CP
se ascunde (vezi §5, punct deschis).

### 2.8 Afișarea grupului de factori împreună (stack)

În sq3 nu se afișează doar întrebarea curentă, ci **toate factele din fg simultan**,
ca stack vertical (exemplu la A=11, fg `3 6 9`):

```
3*11=?
6*11=?     <- rândul curent
9*11=?
```

- **Toate rândurile arată `?`.** (Varianta în care rândurile deja rezolvate își arată
  rezultatul — 33, 66, 99 — e reținută explicit ca idee de viitor, inclusiv pentru
  tabla 1-10; vezi §9.)
- **Ordinea rândurilor: fixă crescătoare** după factorul din grup (3, 6, 9), indiferent
  de ordinea în care sunt efectiv întrebate.
- **Forma de ecuație e uniformă pe tot stack-ul** și se rotește periodic: toate
  rândurile trec simultan pe forma nouă. Cadența se reglează din CP SQ3 (§2.9):
  `0` = nu se rotește deloc, `1` = la fiecare întrebare, `2`, `3`, ... până la
  numărul de facte din fg.
  - La `0`, forma se alege o dată, la intrarea în sq3, și rămâne fixă tot subquizul.
  - Fg-urile au mărimi diferite (2-5 facte), deci maximul „nr. facte din fg" e
    variabil. **Decizie de implementare:** sliderul are interval fix `0..5` (cel mai
    mare fg), iar la rulare valoarea efectivă e `min(valoare, mărimea fg-ului curent)`
    — o rotire mai rară decât un ciclu complet prin fg n-ar avea sens.
- **Formele a căror necunoscută e chiar factorul nivelului sunt excluse** cât timp
  stack-ul e afișat. Motiv: ar da același răspuns pe toate rândurile —

  ```
  ?*3=33
  ?*6=66
  ?*9=99
  ```

  toate au răspunsul 11, deci după primul rând restul turului e pe gratis, iar cele
  3 butoane ar fi identice la fiecare rând. (Când stack-ul e oprit din CP, restricția
  nu se aplică — se vede o singură întrebare, deci nu e degenerată; rămâne rația
  existentă din `canUseLevelFactorAnswer`.)
- **Evidențierea e per tur, nu cumulativă.** Într-un tur se testează un singur fact
  din fg, chiar dacă tot fg-ul e afișat. Deci: rândul curent primește o bandă
  galbenă dedesubt, iar celelalte („netestate în turul acesta") se griuiesc.
  Cele două efecte sunt bife independente în CP SQ3 (§2.9) — pot fi active separat
  sau împreună.
- Se răspunde **doar la rândul curent**; butoanele rămân 3.
- **Ordinea factorilor în text** (`11*3` vs. `3*11`) nu e o setare separată: vine din
  forma de ecuație aleasă — `QF_PROFILE` are deja activate atât `f1_initial`, cât și
  `f1_comutat`. Indiferent de ce se afișează, câmpul logat `fact` rămâne canonic
  `A*b=produs` (vezi §2.10).

Implementare: prin `promptHtml`, randat direct ca HTML de motor. Tipar existent:
`buildVerticalPromptHtml` din `js/succesive-quiz/engine.js:72`, activat de un flag.

**Capcană de evitat.** `buildRevealedState` (`js/falling-engine.js:490-514`)
reconstruiește afișajul din `state.prompt` — șirul simplu, de o singură linie — și
**suprascrie** `promptHtml`. La dezvăluirea răspunsului (sosirea liftului), stack-ul
s-ar prăbuși într-o singură linie. Bug-ul apare *doar* la dezvăluire, nu la afișarea
inițială, deci scapă ușor la o verificare superficială. Soluție cu precedent: quizul
trimite propriul `promptHtml` dezvăluit din rezultatul lui `onAnswer` — vezi
`js/quizzes/addition-table-range.js:408`, acceptat de `hasRenderableState`
(`js/falling-engine.js:729`).

### 2.9 CP SQ3 (secțiune nouă)

Panou propriu pentru sq3 (independent de cel al sq2, care se ascunde integral):

- bifă **„afișează grupul de factori împreună"** — implicit **activă**;
- bifă **„evidențiază factul testat curent"** (banda galbenă);
- bifă **„dez-evidențiază factele netestate în turul curent"** (griuire);
- **slider „rotire forme la fiecare"**: `0` (deloc), `1`, `2`, `3`, ... `5`
  — efectiv plafonat la mărimea fg-ului curent (§2.8);
- **control pentru numărul de forme de ecuație** din care se rotește sq3.

**Fără butoane „md"** (decis 29.07.2026). Bifele și sliderele se salvează simplu în
`localStorage` la fiecare schimbare, ca celelalte controale ale quizului — deci
valoarea văzută acum e și cea care se încarcă la refresh. Standardul
`standard-butoane-default-md.md` **nu** se aplică aici; dacă se schimbă decizia,
regula lui e că bifarea devine tranzitorie și doar „md" fixează ce se încarcă.

### 2.10 Identitatea factului în log (regulă transversală)

Câmpul `fact` din jurnal se scrie **întotdeauna** `A*b=produs` (factorul nivelului
primul), indiferent de forma afișată pe ecran.

Motiv: analiza derivă cheia de celulă parsând exact acel șir —
`cheieCelulaDinInregistrare` transformă `"11*3=33"` în `mul:11x3` **fără să sorteze**
cele două numere. Dacă s-ar loga `"3*11=33"`, ar rezulta `mul:3x11`, o celulă complet
separată; istoricul aceleiași înmulțiri s-ar rupe în două jumătăți, fiecare părând
mai subțire decât realitatea.

Nu se pierde nimic: textul efectiv afișat se salvează separat, în `eq_form` și
`intrebare`.

### 2.11 Snapshot-ul de fluență

- Se calculează **o singură dată, la pornirea quizului**, pentru **toate nivelele**
  (A = 11..20 × b = 1..20 = 200 de facte).
- Sursa: `MotorAnalizaVizualizare3.calculeazaScorFact`, prin conducta
  `normalizeaza → grupeazaApasarilePeIntrebari → selecteazaDomeniu →
  aplicaFiltre → calculeazaStatistici → calculeazaScorFact`.
- **Atenție:** `segmenteazaInCalupuri` **nu e exportată** în API-ul public. Nu e
  nevoie de ea: pentru `tip: "tot_istoricul"` calupul e literalmente
  `{ curent: intrebariCelula, referinta: null }`, deci se construiește pe loc și se
  dă direct lui `aplicaFiltre`. (Verificat rulând conducta pe exportul real.)
- Maparea log→fact merge din start: `cheieCelulaDinInregistrare` parsează câmpul
  `fact` (ex. `"11*2=22"`) în `mul:11x2`, independent de forma ecuației — iar quizul
  scrie deja exact acel câmp.
- Citirea e asincronă. **Până e gata, `medie = 0` pentru toate** → decizia rămâne
  pur pe acoperire. Comportament deterministic, nu eroare.

---

## 3. Pre-mortem — ce poate merge prost

**R1. Testele nu au IndexedDB.** Mediul `node --test` nu are `indexedDB`, deci
modulul de snapshot trebuie să aibă o *cusătură*: o funcție sincronă care primește
înregistrările injectate (folosită de teste) și una asincronă care citește din
IndexedDB (folosită în browser). Dacă se scrie doar varianta async, feature-ul
rămâne netestabil. **Cel mai probabil mod de eșec al acestui plan.**

**R2. Datele reale — verificat pe export, 29.07.2026. Nu sunt sărace, dar au o
gaură sistematică.** Rulat conducta completă peste exportul real
(`youlearn-salvare-log-activitate-2026-07-29-19-26.json`, 1711 apăsări →
1620 întrebări grupate, 12 zile, tot din clona `v3 - jurnal`):

- **0 întrebări necatalogate** — tot ce există cade fix în domeniul v4 (A=11..20 × b=1..20).
- **109/200 celule au date; 103/200 au scor > 0.** Deci ramura „fluență diferită de
  zero" **se poate valida pe date reale**; nu e nevoie de fixture-ul dummy pentru asta.
- **Cele 91 de celule lipsă nu sunt aleatorii.** Defalcarea:
  - **45** sunt `b > A`, imposibile în v3 din plafonul `maxFactB()`
    (9 la A=11, 8 la A=12, ... 1 la A=19, 0 la A=20 → 9+8+7+6+5+4+3+2+1+0 = 45);
  - **10** sunt `b = 1`, imposibile din `FACT_B_MIN = 2` (una per subtablă);
  - **36** rămase sunt goluri *în interiorul* domeniului permis de v3 (ex. `17*12`),
    pentru că nivelul se termina după 12 întrebări iar fereastra glisantă pornea de
    la 2 — **`b` nu a depășit niciodată 13** în tot istoricul, la nicio subtablă.

Consecință: exportul e un **fixture real bun** pentru teste (schema exactă, volum
realist). Se salvează o copie redusă în `tests/`, nu se citește din `Downloads`.
Constatarea despre gaură validează direct designul v4 (acoperire completă, `b` decuplat
de `A`) — e chiar problema pe care o rezolvă.

**R2b. Alegerea fg degenerează la început.** Consecință directă a găurii de mai sus:
factele cu `b ≥ 14` au toate scor 0, deci fg-urile care le conțin ies mereu cu
`medie = 0`. Simulat pe date reale (la momentul acela, cu `[12 14 16 18]` încă în
listă), la **toate cele 10 nivele** câștiga acel fg, cu scor exact 2,000 la 7 din 10
nivele. Deci primele sq3-uri erau aproape identice de la nivel la nivel, până se
strâng date. **După eliminarea lui `[12 14 16 18]`** (§2.4, 29.07.2026), recalculat:
câștigă `[12 15 18]` la 9 din 10 nivele, cu excepția nivelului 2 (A=12), unde
`[7 11 13 17 19]` câștigă clar (vezi criteriul 11 din §6) — recalcularea a mutat
degenerarea pe alt fg, nu a eliminat-o.

Nu e o defecțiune — chiar acelea sunt factele necunoscute — dar merită știut că
formula nu distinge „netestat" de „testat și foarte slab": ambele dau 0. Dacă
repetitivitatea deranjează, cea mai ieftină corecție e departajarea aleatoare la
egalitate (egalitățile la 2,000 sunt frecvente, nu marginale), nu schimbarea formulei.

**R3. `b = 1` degradează la o singură formă.** Pentru `b=1`, `A*1 = A`, deci
răspunsul corect e chiar factorul nivelului la majoritatea formelor. Regula
anti-ghicit (`canUseLevelFactorAnswer`, max 1 la 10 întrebări) o va bloca des, iar
`fallbackQuestionForB` va produce `A*?=A` cu răspunsul 1. Nu e o defecțiune —
codul are deja ramura asta — dar întrebarea pentru `b=1` va arăta aproape mereu la fel.
De verificat explicit în teste că `b=1` chiar apare o dată pe nivel și nu e sărit.

**R4. Regula anti-ghicit devine parțial fără obiect în sq1.** Cu fiecare fact exact
o dată, `A` nu mai poate fi răspuns des în sq1. Istoricul e însă partajat
(`shared.levelFactorAnswerHistory`) între sq1 și sq3. De verificat că nu blochează
nedorit generarea în sq3, unde factele se repetă.

**R5. Lungimea nivelului.** 20 de facte de acoperit, minus cele acoperite în sq3.
Un sq3 pe fg-ul de 5 (`7 11 13 17 19`) cere minim 15 răspunsuri corecte și maxim 25
(plafonul de 5/fact). Cu 3 sq3-uri, un nivel poate depăși 70 de întrebări.
Userul a fost avertizat și a zis „vedem" — de re-evaluat după prima rulare reală.

**R6. Ordinea verificărilor la finalul nivelului.** Dacă ultimul răspuns din sq1
acoperă și ultimul fact, verificarea „nivel complet" trebuie să aibă prioritate în
fața declanșatorului de sq3 — altfel se intră în sq3 dintr-un nivel deja terminat.

**R7. Cuplare la Vizualizare 3.** v4 va depinde de `motor-analiza.js` +
`config-praguri.js` încărcate în `index.html`. Ambele sunt IIFE-uri curate care doar
definesc funcții și setează un global (verificat: `node --check` trece pe ambele,
fără efecte secundare de pagină). Riscul e de organizare, nu funcțional.

---

## 4. Alternative considerate și respinse

- **Scor = `medie * acoperire` (produs simplu).** Respins: un factor la 0 anulează
  tot produsul, deci un fg deja fluent dar neatins (`acoperire = 0`) ar câștiga
  automat în fața unuia slab. Verificat pe exemplu numeric cu userul.
- **`(medie+2)*(acoperire+1)`.** Respins: constanta mai mare amortizează factorul
  la care e aplicată, deci ar fi dat lui `acoperire` pondere mai mare decât lui
  `medie` — exact invers față de ce voia userul. Inversat în `(medie+1)*(acoperire+2)`.
- **Duplicarea funcției de scor în quiz**, ca să evităm cuplarea la Vizualizare 3.
  Respins: ar exista două definiții ale fluenței care pot diverge în timp.
- **Serviciu comun de analiză a logului, cu cache incremental.** Amânat explicit de
  user (vezi §6). Acum: o citire simplă, completă, o dată per pornire de quiz.
- **Snapshot per nivel.** Respins de user în favoarea unuia singur, la pornirea
  quizului, pentru toate nivelele.

---

## 5. Pași de implementare

### Pas 1 — `js/snapshot-fluenta.js` (fișier nou)

API public, gândit ca să poată fi înlocuit ulterior de serviciul comun:

```
global.SnapshotFluenta = {
  construiesteDinInregistrari(inregistrari, optiuni) -> { scorPtFact(a, b) }  // sincron, pt. teste
  pregateste(optiuni) -> Promise<{ scorPtFact(a, b) }>                        // citește IndexedDB
}
```

- `scorPtFact(a, b)` returnează 0..1; **0** pentru fact netestat sau snapshot neîncărcat.
- Cititorul de IndexedDB se scrie aici, standalone. **Nu se refolosește** cel din
  `vizualizare3-bootstrap.js`: acela e închis în garda de pagină `if (!layout) return;`,
  deci nici nu se definește în afara paginii Vizualizare 3.
- Quizul consumă **doar** `scorPtFact` — asta e cusătura pentru migrarea viitoare.

### Pas 2 — modificări în quizul v4

1. `FACT_B_MIN = 1`, `FACT_B_MAX = 20`; se elimină plafonarea lui `b` la `A`.
2. `FG_LIST` + `alegeFG()` (§2.5).
3. Definiția `sq3` (§2.6) adăugată în `SubquizOrchestrator`.
4. sq1 rescris pe acoperire (§2.2): set de facte neacoperite, coadă K=4 amestecată,
   terminare când setul e gol.
5. Rutarea declanșatorilor către sq3 + plafonul de 3/nivel.
6. Ștergerea acțiunii manuale de arenă.
7. Ascunderea secțiunii CP a lui sq2.
8. Cablarea snapshot-ului la crearea quizului.
9. Afișarea stack (§2.8): construirea `promptHtml`, rotirea uniformă a formei,
   excluderea formelor cu răspuns = factorul nivelului, banda galbenă / griuirea.
   **Inclusiv `promptHtml`-ul dezvăluit trimis din `onAnswer`** — altfel stack-ul se
   prăbușește la o linie exact la sosirea liftului.
10. Secțiunea CP SQ3 (§2.9), cu persistare simplă în `localStorage`.

### Pas 3 — `index.html`

- `<script>` pentru `Vizualizare 3 - Claude/config-praguri.js`,
  `Vizualizare 3 - Claude/motor-analiza.js`, `js/snapshot-fluenta.js`
  — **înaintea** scriptului quizului v4.
- Bump `?v=N` pe v4 (regulă de cache busting a proiectului).

### Pas 4 — fixture real + teste

Fixture: se salvează în `tests/` o versiune **redusă** a exportului real (azi 1,2 MB
în `Downloads` — nu se citește de acolo). Conducta consumă doar 5 câmpuri:
`data_ora_ro`, `fact`, `a_raspuns_corect`, `a_cata_apasare_pe_buton`,
`durata_raspuns_secunde`. Restul (`intrebare`, `valori_variante_de_raspuns`,
`hints_aratate_pt_raspuns`, `extra`, `quiz_name`, ...) se pot elimina — fișierul
scade de câteva ori. **Obligatoriu:** după reducere, fixture-ul trebuie să reproducă
identic cifrele din §6.10; altfel s-a tăiat ceva ce conta.

Teste: `tests/multiplication-1120-v4-intensiv-multipli-234.test.js` și
`tests/snapshot-fluenta.test.js`.

---

## 6. Criterii de succes (falsificabile)

1. **Domeniu:** la nivel 1, factele generate sunt exact `11*1 .. 11*20`; la nivel 10,
   `20*1 .. 20*20`. `getInfo11_20().facts.length === 20` la orice nivel.
2. **Acoperire fără repetiții:** într-un nivel jucat fără sq3, cele 20 de facte apar
   fiecare exact o dată; niciunul de două ori.
3. **Ordine K=4:** primele 4 facte emise sunt o permutare a `{1,2,3,4}`,
   următoarele 4 o permutare a `{5,6,7,8}` ș.a.m.d.
4. **sq3 scurtează sq1:** dacă sq3 exersează `b ∈ {3,6,9}`, acele facte nu mai apar
   în sq1, iar nivelul se termină după ce restul de 17 sunt acoperite.
5. **Plafon:** cel mult 3 intrări în sq3 per nivel, oricâți declanșatori apar.
6. **Ieșire sq3:** iese la 3 corecte/fact; și iese la 5 întrebări/fact chiar dacă
   nu s-au atins 3 corecte.
7. **`alegeFG` — caz numeric verificabil.** Nivel 1 (A=11), jurnal gol (toate
   `medie = 0`), acoperit `{1,2,3,4,7}`. Tabelul de mai jos e din **înainte** de
   eliminarea lui `[12 14 16 18]` (§2.4) — îl păstrez ca să arate mecanica
   formulei, dar acel rând nu mai există în lista curentă (rezultatul final nu
   se schimbă: fără el, egalitatea rămâne între `[5,15]` și `[12,15,18]`, tot
   `5 < 12` decide, tot **`5 15`** câștigă):

   | fg | acoperite | acoperire | scor = (0+1)·(acoperire+2) |
   |---|---|---|---|
   | 2 4 8 16 | 2,4 | 2/4 = 0,5 | 2,5 |
   | 4 8 12 16 | 4 | 1/4 = 0,25 | 2,25 |
   | 2 4 6 8 | 2,4 | 2/4 = 0,5 | 2,5 |
   | ~~12 14 16 18~~ (eliminat) | — | 0 | ~~2,0~~ |
   | 5 15 | — | 0 | **2,0** |
   | 3 6 9 | 3 | 1/3 ≈ 0,333 | 2,333 |
   | 12 15 18 | — | 0 | **2,0** |
   | 7 11 13 17 19 | 7 | 1/5 = 0,2 | 2,2 |
   | 3 6 12 18 | 3 | 1/4 = 0,25 | 2,25 |
   | 3 9 18 | 3 | 1/3 ≈ 0,333 | 2,333 |

   Minim = 2,0, egalitate între `[5,15]` și `[12,15,18]`. Departajare lexicografică
   crescătoare: primul element 5 < 12 → **câștigă `5 15`**.
8. **fg nerepetat:** un fg folosit într-un nivel nu mai poate fi ales în același nivel.
9. **Snapshot gol:** cu jurnal gol, `scorPtFact` returnează 0 pentru orice `(a,b)`,
   fără excepții aruncate.
10. **Snapshot pe date reale** (fixture din exportul din 29.07.2026), cifre exacte
    de reprodus — orice abatere înseamnă că s-a rupt conducta:
    - 1711 apăsări → **1620** întrebări grupate;
    - **0** întrebări necatalogate față de domeniul A=11..20 × b=1..20;
    - **109/200** celule cu `n > 0`; **103/200** cu scor > 0;
    - `scorPtFact(12, 7)` > 0 (celula cu cel mai mare volum, 51 apăsări);
    - `scorPtFact(11, 1)` === 0 și `scorPtFact(20, 19)` === 0 (celule fără date).
11. **`alegeFG` pe date reale** (recalculat după eliminarea lui `[12 14 16 18]`,
    §2.4): la primul declanșator natural al fiecărui nivel (acoperit `{1,2,3,4,5}`),
    câștigă `[12,15,18]` la 9 din 10 nivele; la nivelul 2 (A=12) câștigă
    `[7,11,13,17,19]`, pentru că A coincide cu un membru al fg-ului altfel
    câștigător. Test de regresie pentru formulă + departajare împreună.
12. **Stack:** pentru fg `3 6 9`, `promptHtml` conține exact 3 rânduri, în ordinea
    3, 6, 9, indiferent de ordinea în care sunt întrebate.
13. **Stack-ul supraviețuiește dezvăluirii:** după un răspuns, `promptHtml` are tot
    3 rânduri, cu răspunsul completat pe rândul curent — nu o singură linie.
    (Regresie directă pentru capcana din §2.8.)
14. **Forme degenerate excluse:** cu stack-ul activ, nicio întrebare din sq3 nu are
    ca răspuns corect factorul nivelului.
15. **Cadența de rotire:** cu sliderul pe `0`, toate întrebările dintr-un sq3 au
    aceeași formă; cu `1`, forma se schimbă la fiecare întrebare.
16. **Log stabil:** indiferent de forma afișată (inclusiv cea comutată, `3*11=?`),
    câmpul `fact` logat e `11*3=33`, iar cheia derivată e `mul:11x3`.

---

## 7. Istoricul deciziei despre formele de ecuație în sq3

Punctul ăsta s-a mutat de două ori; se consemnează ca să nu fie „corectat" înapoi din
greșeală.

1. Inițial: sq3 moștenea sliderul de nr. forme al sq2. Respins — sliderul ar fi fost
   ascuns odată cu restul panoului sq2, iar valoarea lui implicită e 1, deci sq3 ar fi
   rulat cu o singură formă, fără cale de schimbare.
2. Apoi: sq3 primește **toate** formele, ca subquizul de bază, și se ascunde și sliderul.
3. **Acum (final):** odată ce grupul se afișează ca stack (§2.8), formele amestecate pe
   rânduri diferite ar arăta haotic. Deci forma e **uniformă pe tot stack-ul** și se
   rotește periodic, iar sq3 primește **propriul** control de nr. forme, în CP SQ3 (§2.9).
   Panoul sq2 rămâne ascuns integral — controlul din sq3 e nou, nu reciclat.

---

## 8. Ce NU se face acum

**Serviciul comun de analiză a logului** (cache în memorie, citire incrementală
`IDBKeyRange.lowerBound`, actualizare prin `BroadcastChannel`, încălzire la pornirea
aplicației, extragerea cititorului din garda de pagină a Vizualizare 3).

Userul l-a numit **conexiune vitală** — alegerea întrebărilor în cam toate quizurile
viitoare se va face pe baza analizei logului — dar a amânat construirea lui explicit
pe 29.07.2026 și a cerut să i se reamintească. Detaliile tehnice constatate stau în
memoria de sesiune (`project_youlearn_serviciu_analiza_loguri`).

Consecință acceptată acum: fiecare pornire de quiz reface o citire completă a
jurnalului. La dimensiunea actuală a logului e neglijabil; la câteva mii de rânduri
devine motivul pentru care se reia punctul ăsta.

---

## 9. Idei reținute pentru mai târziu

**Rândurile rezolvate să-și arate rezultatul în stack.** În loc ca toate rândurile să
arate `?` (§2.8), factele deja rezolvate în sesiunea curentă de sq3 și-ar arăta
rezultatul: `3*11=33`, `6*11=?`, `9*11=?`. Userul a ales varianta cu `?` peste tot
pentru v4, dar a cerut explicit reținerea alternativei — „pentru copii e o idee foarte
bună", fiindcă vezi tiparul construindu-se (33, 66, 99) și prinzi structura grupului.
A spus că **o va implementa și la tabla T\*1-10\*1-10**, deci e idee de produs, nu
notă locală. Consemnată și în memoria de sesiune
(`project_youlearn_stack_fg_rezultate_vizibile`).
