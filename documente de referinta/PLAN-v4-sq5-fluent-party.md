# PLAN — v4: Subquiz 5 „Fluent party" (sq5)

Plan de implementare pentru `js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js`.
Scris 16.08.2026, completat cu deciziile userului din 17.08.2026, **implementat 17.08.2026**.
**Nu se modifică comportamentul lui sq1, sq2 sau sq3** — sq5 se adaugă lângă ele.

**Status: implementat.** Trei probleme reale, nevăzute în plan, au ieșit abia la implementare —
consemnate aici ca să nu fie „redescoperite" mai târziu:

1. **`switchLevel` nu ieșea din level 0.** Planul (R7) zicea doar „nu se reia după ce s-a terminat";
   nu acoperea cazul „nu s-a terminat încă". O schimbare manuală de nivel, cât timp level 0 încă nu
   rulase complet, recalcula `inLevel0` de la zero și rămânea tot acolo — un copil care apasă un
   buton de nivel chiar la pornire ar fi rămas blocat în „petrecere", nu ar fi ajuns la nivelul cerut.
   Fix: `switchLevel` marchează explicit `level0Done = true` înainte de `resetLevelState()` — alegere
   manuală de nivel = renunțare la level 0, nu doar amânare.
2. **Secțiunea CP nu apărea deloc**, deși `CpRegistry.register(...)` era corect. Motivul: ordinea
   panourilor are o listă hardcodată separată, `DEFAULT_ORDER` din `js/cp-registry.js`, folosită
   când nu există încă o ordine salvată — orice panou absent din ea e tăcut exclus din `list()`,
   indiferent că e înregistrat. Prins doar verificând efectiv în browser (`CpRegistry.getOrder()`
   nu includea `sq5FluentParty`), nu din citirea codului. Fix: adăugat în `DEFAULT_ORDER`.
3. **Sliderele de procent (SBS %, rol constant %) porneau pe 0, nu pe 50 (default D11/D15).**
   `readNumberSetting` face `Number(localStorage.getItem(cheie))`, iar `Number(null) === 0` — deci o
   cheie nescrisă încă pică pe 0 de fiecare dată când 0 e chiar el o alegere validă în interval (exact
   cazul procentelor, min=0). sq2/sq3 nu loveau asta (intervalele lor nu au 0 ca valoare validă
   diferită de default). Fix: `readPercentSetting`, citire proprie doar pentru cele două câmpuri de
   procent, fără să atingă `readNumberSetting` (folosit și de sq2/sq3, cu comportamentul lor păstrat).
4. **`level0Done` se seta permanent pe o sursă încă nerezolvată — sq5 nu pornea deloc, nici la
   pornirea quizului, nici la schimbarea manuală de mod/intrare din CP.** Găsit abia după ce userul
   a raportat exact asta. Cauza: `resetLevelState()` se cheamă și **eager**, sincron, la construirea
   quizului — înainte să existe vreo șansă ca citirea din IndexedDB să se fi terminat. La acel apel,
   `createOrchestrator()` vedea „0 facte fluente" (sursă goală, nu neapărat reală) și marca
   `level0Done = true` **definitiv** — chiar dacă imediat după, sursa reală (cu facte fluente) devenea
   disponibilă, decizia deja luată nu se mai revizuia niciodată în acea sesiune. Fix: decizia „0 facte
   → level0Done" se ia doar cu `fluentaEsteGata()` adevărat; apelul eager, cu sursa încă nerezolvată,
   nu mai atinge `level0Done` deloc, lăsând următoarea reconstrucție (prin `beginRoute()`, care rulează
   mereu după ce `pickNextRound()` a confirmat sursa gata) să decidă corect. Verificat că testul de
   regresie chiar prinde bug-ul: revenind temporar la logica veche, testul eșuează exact cum raporta
   userul (`'base'` în loc de `'sq5FluentParty'`); cu fix-ul, trece.

   **Al doilea aspect al aceluiași raport:** bifarea mod A/B sau intrării în CP nu avea efect vizibil
   până la o schimbare naturală de nivel — `hooks.onChange` doar re-randa panoul CP, fără să repornească
   runda curentă (la fel ca la sq3, unde e corect: sliderele lui nu trebuie să întrerupă un subquiz în
   desfășurare). Dar mod/intrare sunt **structurale** (decid CE subquiz pornește, nu doar cum se comportă
   unul deja pornit) — pentru ele adăugat un hook separat, `onRouteChange`, care chiar repornește runda
   (`restartActiveRound()`), doar pentru cele două radio-uri, nu și pentru sliderele/stepperele de reglaj fin.

**Deviație de la criteriul 16** („teste nemodificate"): D4 (default mod A) intră inevitabil în
coliziune cu 3 teste preexistente ale căror mock-uri de `fluentaSursa` marchează fluent un `b` la
**toate** cele 10 subtable deodată (artefact dinainte să existe sq5 — level 0 include prin definiție
și subtabla nivelului curent, deci orice fact fluent la nivelul testat activează și level 0). Cele 3
teste (criteriile 17/18/19) au primit `localStorageSeed` explicit (`sq5Mode: "B"`, `sq5Entry:
"random"`) ca să rămână izolate de sq5 — fără nicio schimbare de assertion sau flux. Detaliu complet
în mesajul de finalizare al sesiunii, nu repetat aici.

Baseline la scrierea planului: `node --test tests/multiplication-1120-v4-intensiv-multipli-234.test.js
tests/snapshot-fluenta.test.js` → **19/19 verzi**; `npm run check:docs` → OK. Orice regresie față de
asta e a implementării, nu preexistentă.

---

## 0. Ce s-a măsurat efectiv, înainte de plan

Toate cifrele sunt **măsurate pe cod și pe logul real** (`tests/fixture-jurnal-v4.json`), nu estimate.
Dacă implementarea contrazice vreuna, s-a rupt ceva.

| Ce | Rezultat |
|---|---|
| Forme de ecuație active (`QF_PROFILE`, `answerType === "number"`) | **exact 24** |
| Distribuția răspunsului pe cele 24 | **8 dau `a`, 8 dau `b`, 8 dau `c`** |
| Câte sunt forme de **împărțire** | **12 din 24** |
| Facte cu `a == b` (11\*11 … 20\*20) | doar **12 promptere distincte** din 24 (fiecare dublat) |
| Facte cu `b == 1` | **0** forme au ca răspuns produsul (16 dau `a`, 8 dau `b`) |
| Butoane de răspuns | **exact 3, statice în HTML** — [index.html:81-90](index.html:81) |
| Cost calcul snapshot fluență | **9,8 ms** pe 1711 înregistrări |
| Facte **fluente** pe logul real | **41 / 200** (rest: 91 netestat, 27 in_lucru, 22 abia_inceput, 19 nu_il_stie) |
| Fluente per subtablă | 11→7, 12→6, 13→5, 14→3, 15→5, 16→**2**, 17→3, 18→**1**, 19→**1**, 20→8 |
| `b` maxim printre factele fluente | **10** — niciun fact fluent nu are `b ≥ 11` |
| Perechi (fact fluent × formă) disponibile | **984** |
| Numere distincte în „spectrul" factelor fluente | **54** |
| Întrebări aduse de **un singur** număr din spectru | min **8**, median 8, max 72 |
| Cel mai slab triplet posibil (toate 24 formele active) | **24 întrebări** — deci mereu ≥ 10 |
| P(triplet random ≥10 întrebări), **N = 24 forme** | **100%** |
| P(triplet random ≥10 întrebări), **N = 4 forme (default)** | **53%** → ~2 încercări |
| P(triplet random ≥10 întrebări), **N = 1 formă** | 51%, dar **113 din 300 de sesiuni n-au NICIUN triplet valid** |
| Durata level 0 (41 facte, `TURNS=3`, `BLOC=12`, slider 50%) | **132-168 întrebări**, median **144** |
| Idem, slider 0% (tot VBS) | **exact 123** — minimul teoretic, fiindcă blocul VBS țintește doar facte nesatisfăcute |
| Idem, slider 100% (tot SBS) | median **148** — SBS „irosește" turns pe facte deja satisfăcute |
| Durata sq5 în mod B, per nivel (slider 50%) | A=18 (1 fact): **12**; A=16 (2 facte): **12**; A=11 (7 facte): **24**; A=20 (8 facte): **36** |
| Precizia sliderului | la 50% ies **49,4%** întrebări SBS — corect **doar** pentru că blocul VBS are aceeași lungime ca cel SBS |
| Inegalitate pe termen scurt (monedă per bloc, 50%, ~12 blocuri) | P(5+ blocuri la rând de același fel) = **32%**; P(7+) = **7%** |
| Descompunerea fină a celor 24 de forme | 8 factor + 4 produs + 4 deîmpărțit + 4 împărțitor + 4 cât |
| **Cele 2 roluri (D15)** | **rol1 = 16 forme** (factor ≡ împărțitor ≡ cât), **rol2 = 8 forme** (produs ≡ deîmpărțit) |
| Operațiile din fiecare rol | **rol1: 8 cu `*` + 8 cu `:`; rol2: 4 cu `*` + 4 cu `:`** — deci rolul constant **nu** fixează semnul |
| Valoarea răspunsului per rol | **rol1 → un număr mic** (`a` sau `b`); **rol2 → numărul mare** (produsul) |
| Selecție triplet: first-fit vs. best-of-10 | 146 → **134** întrebări, dar rol2 scade la 22% (față de 33% natural) |
| Rolul are ≥2 forme active, funcție de `N` (eq forms) | N=4: rol1 **91%**, rol2 **41%** · N=6: 99% / 68% · N=8: 100% / 86% |
| Bloc cu rol constant, fezabilitate level 0 | **ambele roluri** merg (rol1: 192 perechi, rol2: 48) |
| Idem, mod B | merge peste tot **cu 3 excepții**: A=16 doar rol1 (2 produse distincte); A=18 și A=19 (1 fact) niciun rol |
| Mix final rol1/rol2 pe level 0 (best-of-10, SBS 50%) | rol-const **0%** → 78/22 · **50% cu alegere 50/50** → **68/32** · 100% → 58/42 |
| Referință „toate cele 24 de forme egal probabile" | **rol1 67% / rol2 33%** |
| Sursa de fluență e gata | **asincron**, după crearea quizului — [quiz:206-216](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:206) |
| Aplicația cere prima rundă | **sincron** — [app.js:601](js/app.js:601) |
| Hook existent „repornește runda" | `restartActiveRound()` — [app.js:606](js/app.js:606), deja folosit ca `onChange` la panourile CP |

---

## 1. Scop

sq5 **nu construiește fluență nouă** — asta rămâne treaba lui sq1 (acoperire) și sq3 (grupuri de
factori). sq5 ia o fluență **deja câștigată**, de regulă pe 1-2 forme de ecuație, și o generalizează
la toate cele 24.

Formularea userului: *„până la fluență s-a antrenat pe 1-2 eqforms, acum la fluență se antrenează pe
mai multe eqforms […] acum îl antrenăm să fie fluent în toate cele 24 de eqf pentru acel fact"*.

---

## 2. Decizii luate (16-17.08.2026) — nu se re-litigă

| # | Decizie |
|---|---|
| D1 | **Repetiția e permisă și dorită.** Un fact poate fi reluat de mai multe ori în sq5, „fie în aceeași eqf, fie diferită, **preferabil diferită**". |
| D2 | La pornire se afișează **„Se pregătește quizul…"**, se așteaptă datele, apoi începe quizul. Fără cursă, fără pornire pe date incomplete. |
| D3 | **SBS = triplete random cu verificare** (mecanica userului, §3.4). |
| D4 | **Default = mod A** („Level 0 cu toate"). |
| D5 | Level 0 rulează **la fiecare pornire de quiz**. Userul: „poate o să decid că e prea mult, doar o repetiție per fluent fact, sau level 0 la sfârșit" — deci trebuie **ieftin de schimbat**, nu optimizat acum. |
| D6 | Selecția formelor de ecuație rămâne **random**; dozarea (înmulțiri vs. împărțiri) se discută ulterior. |
| D7 | sq5 se declanșează și la **schimbarea manuală de nivel** (butoanele 1-10). Userul: „încă nu știu, poate să fie o problemă, deocamdată lasă-l așa". |
| D8 | **Level 0 conține doar sq5**, și e singurul loc cu facte din mai multe subtable. În mod B, sq5 folosește doar factele fluente din **subtabla nivelului curent**. |
| D9 | Câmpul „Nr. de subtable" **nu se implementează** (eliminat de user pe 16.08.2026). |
| D10 | Bifele „Tipuri de eq forms" — **nu acum** („încă nu"). |
| D11 | **SBS nu mai e bifă, ci proporție.** Sesiunea de sq5 e un lanț de blocuri de câte `BLOC` întrebări; fiecare bloc e SBS sau VBS. Câmp „SBS %", default **50%**. `0%` = tot VBS, `100%` = tot SBS. |
| D12 | **Contează media**, nu regularitatea: se aruncă o monedă cu probabilitatea din câmp la începutul fiecărui bloc, fără evidență corectoare. Userul a acceptat explicit inegalitatea pe termen scurt (32% șansă de 5+ blocuri la rând de același fel într-un level 0). |
| D13 | Ambele câmpuri sunt **steppere cu săgeți sus/jos**, nu slidere: „SBS %" (default 50) și „lungime șir" (default **12**, era 10). |
| D14 | Tripletul de butoane se alege **best-of-10**: 10 candidați random, se păstrează cel cu cele mai **variate** facte nesatisfăcute și cu **deficitul** cel mai mare de turns. Nu „primul care trece". |
| D15 | Câmp nou: **„SBS cu rol constant %"**, default **50%**. În acele blocuri SBS necunoscuta are **un singur rol** pe tot blocul. **Rolurile sunt două, prin echivalență** (decizie user, 17.08.2026): la `*`/`:` — **rol1** = factor ≡ împărțitor ≡ cât, **rol2** = produs ≡ deîmpărțit; la `+`/`−` (pentru quizuri viitoare) — rol1 = termen ≡ diferență ≡ scăzător, rol2 = sumă ≡ descăzut. |
| D16 | **Niciodată un bloc SBS cu o singură formă de ecuație**, decât dacă userul o cere explicit (adică pune sliderul de eq forms pe 1). Un bloc cu rol constant se formează doar dacă rolul are **≥2 forme active**; altfel blocul cade pe SBS liber. |

---

## 3. Specificația

### 3.1 Sursa de fluență

- Eticheta categorică **exactă** din grila Vizualizare 3: `starePtFact(a, b) === "fluent"`
  (`clasificaStare` — precizie ≥90%, mediană ≤2s, minim 5 răspunsuri, 2 zile distincte).
  **Nu** scorul continuu `scorPtFact`, care rămâne exclusiv al lui `alegeFG` din sq3.
- Același precedent ca excepția facte-fluente din sq3 (§10 din `PLAN-v4-subquiz3-grupuri-factori.md`).
  Două definiții ale fluenței care pot diverge în timp = exact ce s-a respins acolo.
- Se calculează **o singură dată**, la pornire, pentru toate cele 200 de facte.

### 3.2 Mod A / mod B (radio)

- **A) „Level 0 cu toate"** — *default*. O rundă unică **înainte de nivelul 1**, cu factele fluente din
  **toate** cele 10 subtable. Level 0 **conține doar sq5**; când se termină, începe nivelul 1 normal.
- **B) „în interiorul fiecărui level"** — sq5 rulează în fiecare nivel, cu factele fluente **doar din
  subtabla nivelului**, conform dropdown-ului de la §3.3.

Cele două se exclud: cu A activ, sq5 **nu** mai rulează în interiorul nivelurilor.

### 3.3 Intrarea în sq5 — dropdown, doar pentru mod B

Cele trei opțiuni se mapează **direct** pe mecanica existentă a orchestratorului, fără cod nou de
rutare (`activeSubquizIds` e ordonat, iar `exit` trece la următorul —
[subquiz-orchestrator.js:141-158](js/subquiz/subquiz-orchestrator.js:141)):

| Opțiune | Implementare |
|---|---|
| „La începutul nivelului" (**default**) | `activeSubquizIds: ["sq5", "base"]` |
| „La finalul nivelului" | `activeSubquizIds: ["base", "sq5"]` → după sq5, `routeComplete` → `advanceLevel()` |
| „Random între alte subquizuri" | `push`/`pop` din interiorul lui `base`, ca sq3 |

**„Random", mecanica exactă:**
- **o singură dată per nivel**;
- se verifică în **aceleași două puncte** ca sq3 — `state.wrongFacts.length >= 2` și
  `state.questionCount % 5 === 0` ([quiz:720-728](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:720))
  — fără hook nou;
- **sq3 are prioritate**: sq5 încearcă doar la verificările la care sq3 nu s-a declanșat
  („random are prioritate mai mică decât regula determinată");
- poziție random dar apariție garantată: la începutul nivelului se alege `k` uniform din `{1, 2, 3}`
  și sq5 pornește la a `k`-a verificare eligibilă. Trei, pentru că verificarea de la al 20-lea răspuns
  nu e utilizabilă — nivelul se termină înainte (R6 din planul sq3);
- dacă nivelul se termină înainte de a `k`-a verificare, sq5 nu rulează în acel nivel.

### 3.4 Rularea: serii SBS pe triplete random

Mecanica cerută de user (D3), verbatim: *„iei 3 numere random din spectrul de triplete al factelor
fluente. Vezi dacă poți să faci o serie de 10 întrebări cu aceste 3 numere ca butoane de răspuns.
Dacă da, go; else ia alte 3 numere random și reia."*

**Definiții operaționale:**

- **Spectru** = mulțimea tuturor numerelor care apar în `{a, b, c}` ale factelor fluente **din domeniul
  modului**, restrânsă la factele care **încă n-au primit numărul cerut de turns** (vezi „terminare").
- O pereche (fact, formă) e **eligibilă** pentru un triplet dacă răspunsul ei corect e unul din cele
  3 numere ale tripletului.
- **Bloc** = `BLOC` întrebări (default **12**). Sesiunea de sq5 e un **lanț de blocuri**; la începutul
  fiecăruia se aruncă o monedă cu probabilitatea din câmpul „SBS %" (D11, D12):
  - **bloc SBS** — se alege un triplet (algoritmul de mai sus), iar cele `BLOC` întrebări au **același
    set de 3 butoane**, trase din perechile eligibile. Un astfel de bloc e, cu probabilitatea din
    câmpul „SBS cu rol constant %" (D15), **cu rol constant** — vezi mai jos;
  - **bloc VBS** — întrebare cu întrebare, orice fact nesatisfăcut, orice formă activă, cu capcanele
    obișnuite din `buildMulDivEqFormOptions`. Fără stack vertical — sq5 nu refolosește
    `renderStackHtml` din sq3.
- În ambele tipuri se preferă (a) factele care încă au turns de primit, (b) formele nefolosite încă
  pentru acel fact (D1: „preferabil diferită").
- **Turn** = o întrebare pusă și răspunsă, **corect sau nu**.

**Blocuri SBS cu rol constant (D15, D16).** Rolul necunoscutei e definit prin **echivalență
matematică**, nu prin numele din enunț — două roluri, nu cinci:

| | conține | forme | răspunsul e | operații |
|---|---|---|---|---|
| **rol1** | factor ≡ împărțitor ≡ cât | **16** din 24 | un **număr mic** (`a` sau `b`) | 8 cu `*`, 8 cu `:` |
| **rol2** | produs ≡ deîmpărțit | **8** din 24 | **numărul mare** (produsul) | 4 cu `*`, 4 cu `:` |

Echivalențele sunt exacte: în `c:b=a`, deîmpărțitul `c` **este** produsul, iar împărțitorul și câtul
**sunt** cei doi factori. Analog la adunare/scădere, pentru quizuri viitoare: rol1 = termen ≡ diferență
≡ scăzător, rol2 = sumă ≡ descăzut.

Consecință importantă, verificată: **rolul constant NU fixează operația** — fiecare rol conține și
forme cu `*`, și forme cu `:`. Un bloc „rol2" poate conține `11*3=?` și `?:3=11` una după alta. Asta a
fost cerința explicită a userului (17.08.2026): „nu vreau SBS cu un singur eqform decât dacă cer asta
în mod expres". (Cu descompunerea fină în 5 roluri, fiecare rol avea un singur semn — de-aia s-a
renunțat la ea.)

- **Alegerea rolului: 50/50 între rol1 și rol2.** Măsurat: cu „rol constant" pe 50% și alegere 50/50,
  mixul final pe level 0 iese **68% rol1 / 32% rol2**, adică practic distribuția naturală a formelor
  (67/33). Fără blocuri cu rol constant, best-of-10 îl împinge la 78/22.
- **Garda anti-formă-unică (D16):** blocul cu rol constant se formează doar dacă rolul are **≥2 forme
  active** după filtrul „nr. de eq forms". Altfel → SBS liber. La `N = 4` (default) rol1 trece în 91%
  din cazuri, rol2 în 41%; de la `N = 8` în sus, 100% / 86%. Deci rol2 devine constant utilizabil
  după câteva zile de creștere `+1/zi` — nu e o defecțiune, e o rampă.
- **Reversibilitate** (cerută explicit de user): tot ce știe sq5 despre roluri e **un predicat de o
  linie** — `rol(raspuns, a, b) = raspuns === a*b ? "rol2" : "rol1"`. Constructorul de bloc doar
  filtrează perechile după el. Întoarcerea la cele 5 roluri fine, sau orice altă grupare, e
  rescrierea acelei funcții; nimic altceva din sq5 nu depinde de taxonomie
  (`razgandire-ieftina.md`, punctele 3 și 14).

**Cele două blocuri au OBLIGATORIU aceeași lungime.** Câmpul se numește „lungime șir", nu „lungime șir
SBS", și guvernează ambele tipuri. Motivul nu e estetic: eticheta promite *„întrebările din fluent
party să fie aproximativ x% SBS"* — un procent peste **întrebări**. Moneda se aruncă însă per **bloc**.
Cele două coincid doar dacă blocurile au aceeași mărime. Dacă blocul VBS ar fi de o singură întrebare,
un 50% pe monedă ar produce 12/13 = **92%** întrebări SBS, iar câmpul ar minți. Verificat: la 50% ies
49,4% întrebări SBS (§0).

**Terminare (ieșirea din sq5):** când **fiecare** fact fluent din domeniu a primit ≥ `TURNS` turns
(default 3). Pentru că tripletul se trage din spectrul **factelor nesatisfăcute**, fiecare bloc
avansează cel puțin un fact nesatisfăcut → bucla se termină garantat.

**Blocul început se duce până la capăt** — sq5 iese la *finalul* blocului în care s-a satisfăcut și
ultimul fact, nu în mijlocul lui. Diferența e neglijabilă la level 0 (median 144 vs. 137) dar decisivă
în mod B, la nivelele sărace, și exact pe dimensiunea care contează pentru scopul lui sq5:

| | A=18 (1 fact fluent) | A=16 (2 facte) |
|---|---|---|
| oprire imediată | 3 întrebări, **3** forme distincte | 6 întrebări, **3** forme |
| **termină blocul** (ales) | 12 întrebări, **12** forme distincte | 12 întrebări, **7,2** forme |

Cu oprire imediată, un nivel cu un singur fact fluent ar arăta 3 forme din 24 și s-ar termina în trei
întrebări — adică fix opusul lui „îl antrenăm să fie fluent în toate cele 24". E o linie de cod
diferență, dacă se răzgândește cineva.

**Interacțiunea celor două numere, contraintuitivă și de documentat în CP:** cu **multe** facte
fluente comandă `TURNS` (level 0: 41 facte × 3 turns ≈ 144 întrebări); cu **puține** facte comandă
`BLOC` (A=18, un singur fact fluent → tot 12 întrebări, adică 12 turns pe același fact, în 12 forme
diferite). Ambele măsurate, §0. Al doilea caz e chiar ce a cerut userul prin D1 — nu e o anomalie.

**Plasa obligatorie de la bucla „else ia alte 3":** vezi §4, problema P2 — la `N = 1` formă activă
bucla nu se termină niciodată fără ea. Când tripletul nu se poate forma, blocul **cade automat pe
VBS** pentru rândul respectiv; nu e nevoie de o ramură nouă de control.

**Capcană de motor:** ultimul turn răspuns greșit ar bloca ieșirea. `blockWrongTransition`
([subquiz-definition.js:77-96](js/subquiz/subquiz-definition.js:77)) anulează orice tranziție
întoarsă dintr-un răspuns greșit dacă nu e marcată explicit. Ieșirea din sq5 **trebuie** să aibă
`allowOnWrong: true` — e fix bug-ul reparat la sq3 în commit-ul `c44027d`.

**Zero facte fluente** în domeniu → sq5 nu pornește deloc (nu intră în `activeSubquizIds`,
declanșatorul „random" întoarce `null`). Level 0 gol → direct nivelul 1, fără ecran.

### 3.5 Formele de ecuație și creșterea „+1 pe zi"

- Interval `1..24`, **default 4**. (24 e numărul real de forme — verificat, §0.)
- Selecția celor `N` din 24: **random** (D6).
- **Creștere automată:** +1 după fiecare **zi calendaristică de utilizare a lui sq5**:
  - la prima intrare în sq5 dintr-o zi: dacă există o zi anterioară înregistrată, diferită de azi →
    `N += 1` (plafonat la 24), apoi se scrie ziua curentă;
  - prima zi de folosire **nu** incrementează (rulează cu 4);
  - **ziua se ia în ora locală**, nu UTC. `toISOString()` ar muta ziua seara și ar da un +1 fantomă.
- **Oprire la intervenție manuală:** dacă userul mută sliderul, creșterea automată se oprește
  definitiv („rămâne acolo"). Flag separat în `localStorage`.

### 3.6 CP sq5 — câmpuri și chei

Secțiune nouă, înregistrată ca cele existente ([app.js:768-773](js/app.js:768) e tiparul pentru
`sq3FactorGroups`). Persistare simplă în `localStorage` la fiecare schimbare, **fără butoane „md"** —
ca la sq3; standardul `standard-butoane-default-md.md` nu se aplică.

| Control | Cheie | Default |
|---|---|---|
| radio A („Level 0 cu toate") / B („în fiecare level") | `yl:mul1120v4:sq5Mode` | **`"A"`** |
| dropdown intrare (activ doar pe B) | `yl:mul1120v4:sq5Entry` | `"levelStart"` |
| slider nr. turns per fact | `yl:mul1120v4:sq5TurnsPerFact` | `3` |
| slider nr. eq forms (1-24) | `yl:mul1120v4:sq5EqFormCount` | `4` |
| ultima zi de utilizare | `yl:mul1120v4:sq5EqFormLastDay` | — |
| flag „slider mutat manual" | `yl:mul1120v4:sq5EqFormManual` | `false` |
| stepper **„SBS %"** (0-100, pas 5) | `yl:mul1120v4:sq5SbsPct` | `50` |
| stepper **„lungime șir"** (3-30, pas 1) | `yl:mul1120v4:sq5BlocLen` | `12` |
| stepper **„din care cu rol constant %"** (0-100, pas 5) | `yl:mul1120v4:sq5RolConstPct` | `50` |

Ultimele două sunt **steppere cu săgeți `−`/`+`** (D13), nu slidere. Tiparul există deja în proiect și
se refolosește ca atare, inclusiv CSS-ul: clasele `pre-eq-stepper-field` / `pre-eq-stepper` —
[rigle-cl1.js:215-244](js/quizzes/rigle-cl1.js:215), [style.css:1669](style.css:1669). Nu se scrie CSS nou.

Eticheta lui „SBS %" spune **„aproximativ"**, fiindcă chiar așa e: moneda per bloc dă media corectă
(49,4% măsurat la reglajul 50%), dar pe o sesiune scurtă poate ieși vizibil inegal — 32% șansă de 5+
blocuri la rând de același fel într-un level 0. Acceptat explicit prin D12.

Eticheta lui „lungime șir" trebuie să spună că guvernează **ambele** tipuri de bloc (§3.4), altfel
pare că se aplică doar la SBS.

### 3.7 Ce **nu** atinge sq5

- **Nu marchează facte ca `covered`.** (a) contractul lui sq1 e „fiecare fact al nivelului exact o
  dată" — acoperirea ține de curriculumul nivelului, nu de un drill; (b) ar întoarce `exitPolicyForB`
  din sq3 pe `"skip"` fix pentru factele fluente
  ([quiz:476-481](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:476)), erodând sq3 fără
  să fi cerut cineva asta; (c) în level 0 nu există nivel curent, deci n-ar avea ce marca.
- **Nu schimbă** `alegeFG`, `FG_LIST`, plafonul sq3, sq1 sau sq2.
- **Câmpul `fact` din jurnal rămâne canonic `A*b=produs`**, cu `A` al **factului**, nu al nivelului
  (§4, problema P3).
- `metadata.subquiz = SQ5_ID` — obligatoriu, ca rândurile sq5 să fie **separabile în jurnal**
  (riscul R4). `subquiz_id` e deja purtat prin `normalizeaza`
  ([motor-analiza.js:24](Vizualizare%203%20-%20Claude/motor-analiza.js:24)).
- `subquizName()` primește ramura sq5, altfel `subquiz_name` se loghează `null`.

---

## 4. Trei probleme tehnice și soluțiile lor

### P1 — Sursa de fluență e gata **după** ce level 0 ar trebui să pornească

`fluentaSursa` pornește ca `SnapshotFluenta.sursaGoala()` — „netestat" pentru toate cele 200 de facte
— și e înlocuită abia când se rezolvă citirea din IndexedDB. Aplicația cere prima rundă **sincron**.
Deci level 0 poate vedea zero facte fluente, iar rezultatul e **indistinct de comportamentul corect**
(level 0 gol se sare tăcut). Calculul costă 9,8 ms; problema e momentul, nu viteza.

**Soluție (D2):**
1. În `js/snapshot-fluenta.js`: `pregatesteOData()` — promisiune **singleton**, pornită la încărcarea
   scriptului — și `iaSincron()`, care întoarce sursa rezolvată sau `null`.
2. Quizul, la `pickNextRound()`: dacă `iaSincron()` e `null`, întoarce o rundă statică cu mesajul
   **„Se pregătește quizul…"**, butoane goale, fără lift care cade. Tipar existent de rundă statică:
   `advanceLevel()` la final de joc
   ([quiz:1467-1478](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:1467)).
3. Când promisiunea se rezolvă, quizul cere repornirea rundei. Hook-ul există deja:
   `restartActiveRound()` ([app.js:606](js/app.js:606)), folosit azi ca `onChange` de panourile CP.
   Se pasează explicit quizului (o linie în `switchQuiz`/pornire), conform regulii 3 din `AGENTS.md`
   — aplicația apelează feature-ul și îi dă ce-i trebuie, nu invers.

*Notă pentru implementator:* în `falling-engine.js:1031` există o cusătură asincronă (`renderRound`
poate întoarce o promisiune, iar motorul ține liftul până se rezolvă). **Nu e utilizabilă aici** —
ține animația, nu alegerea întrebărilor, care s-a făcut deja.

### P2 — Bucla „else ia alte 3 numere" se poate învârti la infinit

Măsurat (§0): cu toate cele 24 de forme active, **100%** din triplete susțin ≥10 întrebări, pentru că
fiecare număr din spectru aduce singur ≥8 întrebări (3 × 8 = 24 > 10). Dar sliderul „nr. de eq forms"
restrânge formele, deci și numărul de întrebări per număr:

- la **N = 4** (default): doar **53%** din triplete reușesc → ~2 încercări, perfect acceptabil;
- la **N = 1**: în **113 din 300** de sesiuni simulate **nu există niciun triplet valid** — bucla,
  scrisă literal, nu se termină niciodată.

`N = 1` e o valoare legală a sliderului, deci nu e caz exotic.

**Soluție:** bucla e **mărginită** (ex. 20 de încercări) și reține **cel mai bun** triplet găsit
(cel cu cele mai multe perechi eligibile). Dacă niciunul nu atinge `BLOC`, blocul rulează oricum cu
cel mai bun triplet, reciclând perechile eligibile — un triplet are mereu ≥3 perechi (fiecare număr
din spectru provine dintr-o întrebare reală), deci fundul sacului nu e niciodată zero. Dacă nu s-a
găsit **niciun** triplet, blocul **cade pe VBS**.

**Caz degenerat, tot aici:** dacă spectrul are **sub 3 numere distincte**, nu se poate forma niciun
triplet. Se întâmplă doar dacă domeniul are foarte puține facte fluente și toate sunt degenerate
(`a == b`, unde `{a, b, c}` are 2 valori, sau `b == 1`, la fel). Pe logul real nu apare (toate cele 41
au `b ∈ 2..10`), dar netratat e o buclă infinită. Fallback: sq5 rulează fără SBS.

### P3 — `factorForLevel(level)` e hardcodat în tot lanțul de construit întrebări

Level 0 rulează facte din **toate** subtablele în timp ce `level` e 1. Dar toate funcțiile care
construiesc o întrebare iau `A` din nivelul curent, nu din fact:
[`makeFact`](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:318),
[`questionItem`](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:342),
[`fallbackQuestionForB`](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:365),
[`buildQuestionForB`](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:392),
[`factLabel`](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:413).

**Consecința dacă se refolosesc ca atare:** `17*8` întrebat cât `level` e 1 se loghează
`fact: "11*8=88"` → cheia devine `mul:11x8` în loc de `mul:17x8`. Se scrie **date false peste o celulă
reală**, tăcut, exact în analiza pe care sq5 se bazează. Regula §2.10 din planul sq3 („câmpul `fact` e
întotdeauna canonic") e load-bearing aici.

**Domeniul problemei:** **doar** level 0. În mod B toate factele sunt din subtabla nivelului, deci
`factorForLevel(level)` e deja corect.

**Soluție:** argument explicit `a`, cu default `factorForLevel(level)`, în toate cele cinci funcții —
regula 4 din `AGENTS.md`. **Niciun apel existent nu se schimbă**, deci testele curente rămân
contractul de regresie.

---

## 5. Pre-mortem — ce poate merge prost

**R1. Bucla infinită de la P2.** Cel mai probabil mod de eșec *dur*: îngheață pagina, nu doar
feature-ul. Se declanșează la o valoare legală a unui slider.

**R2. Log corupt în level 0 (P3).** Cea mai gravă consecință: otrăvește analiza pe care se bazează
sq5, sq3 și grila pe care userul citește progresul. Invizibil la testare rapidă.

**R3. Ieșirea blocată pe ultimul răspuns greșit** (`allowOnWrong`). Regresie deja plătită o dată la sq3.

**R4. Volum: sq5 domină jurnalul.** Level 0 = **130-170 întrebări** (median 150), **la fiecare pornire
de quiz** (D5). Un nivel întreg de sq1+sq3 are ~70. În câteva zile, majoritatea jurnalului e sq5, iar
grila din Vizualizare 3 ajunge să descrie performanța pe forme exotice, nu fluența de bază.
Atenuarea există pe jumătate: `subquiz_id` se loghează și se propagă prin motor, **dar nu există
niciun filtru pe el în Vizualizare 3**. De verificat înainte să se umple logul.

**R5. Bucla de reacție: sq5 strică fluența pe care o consumă.** 12 din 24 de forme sunt împărțiri.
Un fact „fluent la înmulțire" rulat pe forme de împărțire dă răspunsuri mai lente și mai multe
greșeli. `clasificaStare` cere precizie ≥90% și mediană ≤2s pe **toate** intrările celulei — deci
factele pot **cădea din „fluent" tocmai pentru că sq5 le-a rulat**, iar pool-ul lui sq5 se subțiază
singur. Nu e neapărat nedorit (dacă ținta e fluența pe toate formele, un fact fluent doar la `a*b=?`
chiar nu e fluent) — dar e o schimbare de semantică a grilei, nu un detaliu de implementare.

**R6. D7 înmulțește declanșările.** Butoanele 1-10 apelează `resetLevelState()`
([quiz:1521-1526](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:1521)), deci în mod B
fiecare click pornește un sq5. Patru click-uri curioase = patru runde. Acceptat conștient de user
(„deocamdată lasă-l așa") — de reluat dacă devine supărător.

**R7. Level 0 nu trebuie să se reia la `switchLevel`.** Flagul „level 0 făcut" se ține **în afara**
lui `shared`, care se resetează la fiecare schimbare de nivel — altfel fiecare click pe butoanele
1-10 repornește o rundă de 150 de întrebări.

**R8. Regula anti-ghicit devine zgomot în level 0.** `canUseLevelFactorAnswer`
([quiz:325-329](js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js:325)) blochează întrebările
al căror răspuns e factorul **nivelului**. În level 0 nu există factor comun, deci regula n-are obiect
— dar va bloca arbitrar întrebări al căror răspuns nimerește `11`. În mod B, invers: regula devine mai
apăsată ca oricând, fiindcă 8 din 24 de forme au ca răspuns chiar `a`.
**Decizie de implementare:** în level 0 regula se dezactivează pentru sq5 (istoricul rămâne partajat,
doar nu se consultă); în mod B rămâne activă.

**R9. Testele n-au IndexedDB.** Cusătura există (`config.fluentaSursa`) și trebuie folosită și de
`iaSincron()`, care în teste trebuie să poată fi ocolit.

---

## 6. Red-team pe premisele designului

**A1. „Fluent" taie exact factele care ar avea cea mai mare nevoie de generalizare.**
Pe logul real, **toate cele 41 de facte fluente au `b ≤ 10`**. Motivul: în v3 `b` era plafonat la `A`
și n-a depășit niciodată 13 (R2 din planul sq3), iar `clasificaStare` cere minim 5 răspunsuri pe 2
zile. Deci „Fluent party", azi, e **petrecere pe multiplicatorii mici** — fix factele deja cel mai
bine știute. Factele grele (`17*14`) nu pot intra în sq5 până nu adună singure istoric prin sq1/sq3,
adică săptămâni. Nu e bug, e o consecință a criteriului — dar contrazice intuiția „antrenez ce am
nevoie".

**A2. sq5 scrie în logul care decide cine intră în sq5.** Vezi R4 + R5. Singurul feature din proiect
care își modifică propriul criteriu de intrare.

**A3. „24 de forme" nu înseamnă 24 peste tot.** Pentru cele 10 facte cu `a == b` sunt doar **12
promptere distincte**; pentru `b == 1`, **nicio** formă nu are ca răspuns produsul. Sliderul pe 24
promite ceva ce datele nu pot livra pentru 20 din cele 200 de celule.

**A4. Sliderul de eq forms controlează, tăcut, cât de bine merge SBS.** La 24 de forme orice triplet
merge; la 4 (default) reușesc 53%; la 1 sesiunea poate rămâne fără niciun triplet valid. Cele două
controale par independente în CP, dar nu sunt. Plasa de la P2 le decuplează, dar merită știut.

**A5. sq5 nu măsoară ce își propune.** Ieșirea e „`TURNS` turns per fact, corecte sau nu" — deci sq5
**expune** copilul la forme noi, dar nu verifică niciodată că a devenit fluent în ele. Iar `+1/zi` e un
**cronometru de calendar**, nu un semnal de învățare: după 20 de zile ești pe 24 de forme indiferent
dacă stăpânești vreuna. Măsurarea care ar închide bucla — fluență **per formă**, nu per fact — e
posibilă cu datele existente (`eq_form` se loghează deja), dar e proiect separat. Vezi §10.

**A6. Nimic din sq5 nu e ireversibil, cu o excepție.** Codul e ștergibil ieftin (un subquiz nou lângă
altele + un argument cu default în cinci funcții). **Datele scrise în jurnal nu sunt.** Dacă R4/R5 se
dovedesc supărătoare, codul se scoate într-un sfert de oră, dar rândurile rămân — de-asta
`metadata.subquiz = SQ5_ID` (§3.7) nu e cosmetică, e singura poartă de ieșire.

---

## 7. Alternative considerate și respinse

- **Prag pe scorul continuu (`scorPtFact >= x`) în loc de eticheta „fluent".** Respins: userul a numit
  explicit eticheta, iar sq3 §10 a stabilit precedentul. Două definiții ale fluenței ar diverge.
- **SBS „un fact, toate rolurile"** (butoane = `{a, b, c}` ale unui singur fact). Respins în favoarea
  tripletelor random (D3): ideea userului acoperă și cazul ăsta automat, când rămâne un singur fact
  nesatisfăcut, fără să fie nevoie de o regulă separată.
- **SBS ca la sq2** (3 facte, fiecare cu un rol fix). Respins: restrânge fiecare fact la 8 din 24 de
  forme, împotriva scopului lui sq5, fără să câștige ceva față de triplete.
- **Un constructor de întrebări separat pentru sq5** (în loc de argumentul `a`). Respins: duplicare a
  logicii de formă/capcană/logare, cu garanția că cele două copii vor diverge — regula 4 `AGENTS.md`.
- **Snapshot persistat în `localStorage` ca să fie sincron la pornire.** Respins: stare derivată
  persistată, exact ce interzice punctul 8 din `razgandire-ieftina.md`, și introduce staleness
  într-un criteriu de decizie. Mesajul „Se pregătește quizul…" (D2) rezolvă fără date derivate pe disc.

---

## 8. Pași de implementare

Ordinea e aleasă ca fiecare pas să fie verificabil singur, iar cel cu risc de regresie (pasul 2) să
fie izolat și acoperit de testele existente.

**Pas 1 — `js/snapshot-fluenta.js`: pre-warm memoizat + citire sincronă** (P1).
`pregatesteOData()` (promisiune singleton, pornită la încărcarea scriptului) + `iaSincron()`.
`construiesteDinInregistrari` și `pregateste` rămân **neatinse** — testele lor sunt contractul.

**Pas 2 — argument `a` explicit în lanțul de construit întrebări** (P3).
`makeFact`, `questionItem`, `fallbackQuestionForB`, `buildQuestionForB`, `factLabel` primesc `a` cu
default `factorForLevel(level)`. **Niciun apel existent nu se schimbă.**
*Criteriu de trecere la pasul 3:* cele 19 teste rămân verzi, fără modificări în fișierele de test.

**Pas 3 — „Se pregătește quizul…"** (P1, punctele 2-3): runda statică + pasarea lui
`restartActiveRound` către quiz (o linie în `app.js`).

**Pas 4 — nucleul sq5, ca logică pură** (testabil fără DOM): `facteFluente(domeniu)`, `spectru()`,
`alegeTriplet()` cu bucla mărginită și „cel mai bun triplet" (P2), `perechiEligibile(triplet)`,
contorul de turns, regula de terminare.

**Pas 5 — definiția sq5 în orchestrator:** `SQ5_ID`, `initialState`, generator (serie SBS sau întrebare
simplă), `onAnswer` cu ieșirea la `TURNS` și **`allowOnWrong: true`**.

**Pas 6 — rutarea:** `createOrchestrator()` compune `activeSubquizIds` după mod și dropdown (§3.3);
level 0 pentru mod A, cu flagul „făcut" **în afara** lui `shared` (R7); `push` pentru „random" din
cele două puncte existente, cu prioritate pentru sq3.

**Pas 7 — forme de ecuație + creșterea pe zi** (§3.5), cu ziua în **ora locală** și flagul de
intervenție manuală.

**Pas 8 — secțiunea CP sq5** (§3.6), înregistrată ca `sq5FluentParty`, după tiparul `sq3FactorGroups`
din [app.js:768](js/app.js:768).

**Pas 9 — afișare și jurnal:** ramuri sq5 în `subquizName()`, `getLevelLabel()`, `getInfo11_20()`
(inclusiv eticheta de level 0 și progresul „x / y facte satisfăcute").

**Pas 10 — `index.html`:** bump `?v=` pe quizul v4 (azi `?v=3`) și pe `js/snapshot-fluenta.js`
(azi `?v=1`). Fără bump, browserul servește codul vechi și feature-ul „nu merge".

**Pas 11 — teste** în `tests/multiplication-1120-v4-intensiv-multipli-234.test.js` și
`tests/snapshot-fluenta.test.js`. Se rulează individual (`npm test` rulează un singur fișier,
nelegat de v4):

```bash
node --test tests/multiplication-1120-v4-intensiv-multipli-234.test.js tests/snapshot-fluenta.test.js
```

Planul nu se adaugă în indexul de documente (`PLAN-*.md` nu intră sub regulile `check-doc-index.mjs`,
la fel ca planul sq3); `npm run check:docs` trebuie să rămână verde oricum.

---

## 9. Criterii de succes (falsificabile)

1. **Domeniu mod B:** la nivelul 5 (A=15), pe fixture-ul real, sq5 rulează exact factele
   `15*2, 15*3, 15*4, 15*5, 15*6`. La nivelul 8 (A=18), exact unul: `18*2`.
2. **Domeniu level 0:** exact **41** de facte, distribuite 7/6/5/3/5/2/3/1/1/8 pe subtablele 11…20.
3. **Volum level 0:** cu `TURNS = 3`, `BLOC = 12`, SBS 50%, toate cele 24 de forme active — între
   **132 și 168** de întrebări (median ~144), și **0 facte rămase nesatisfăcute**.
   La SBS `0%` sunt exact **123** — minimul teoretic.
4. **Volum mod B** (SBS 50%): A=18 (1 fact fluent) → **12** întrebări; A=16 (2 facte) → **12**;
   A=20 (8 facte) → **36**.
4b. **Proporția e onestă:** cu câmpul pe 50%, procentul de **întrebări** (nu de blocuri) marcate SBS
   e 50% ±2 pe o rulare de level 0. Cu câmpul pe 0% nu apare niciun bloc SBS; cu 100%, niciun VBS.
4c. **Blocul se termină:** la A=18 (un singur fact fluent), sq5 pune **12** întrebări cu **12 forme
   distincte**, nu 3 — regresie directă pentru regula „blocul început se duce până la capăt".
4d. **Rolurile:** predicatul de rol împarte cele 24 de forme în **16 (rol1) + 8 (rol2)**, iar fiecare
   rol conține **și forme cu `*`, și forme cu `:`** (rol1: 8+8; rol2: 4+4).
4e. **Mix de roluri:** cu „SBS 50%" + „rol constant 50%" + alegere 50/50, level 0 iese **68% rol1 /
   32% rol2** (±2), adică practic distribuția naturală 67/33. Cu „rol constant 0%" iese 78/22 —
   testul prinde dacă mecanismul de echilibrare a fost dezactivat din greșeală.
4f. **Garda anti-formă-unică (D16):** niciun bloc SBS nu rulează cu o singură formă de ecuație activă,
   decât dacă sliderul „nr. de eq forms" e chiar pe 1. Cu rolul având <2 forme active, blocul cade pe
   SBS liber, nu pe un bloc cu o singură formă.
5. **Bucla P2 se termină întotdeauna:** cu `N = 1` formă activă, în cel mai prost caz (niciun triplet
   valid), sq5 nu se blochează — rulează serie scurtă sau fără SBS. Test cu `random` determinist.
6. **Triplete, matematica de bază:** cu toate cele 24 de forme active, orice triplet din spectru
   susține **≥ 24** de întrebări eligibile (deci ≥ 10, mereu).
7. **Ieșire:** fiecare fact primește ≥ `TURNS` turns, **și când toate răspunsurile sunt greșite**
   (regresie directă pentru `blockWrongTransition`).
8. **Log canonic cross-tablă:** în level 0, o întrebare despre `17*8`, afișată sub orice formă
   (inclusiv `136:17=?`), se loghează cu `fact === "17*8=136"` → cheie `mul:17x8`, **nu** `mul:11x8`.
9. **Separabilitate:** toate rândurile produse de sq5 au `subquiz_id === SQ5_ID` și `subquiz_name`
   nenul.
10. **Zero fluente:** cu o sursă în care nimic nu e fluent, sq5 nu pornește în niciun mod, nu aruncă
    excepții, iar nivelul 1 începe normal.
11. **„Se pregătește quizul…":** cu sursa nepregătită, prima rundă e cea statică, iar după rezolvarea
    promisiunii runda se repornește **o singură dată**, nu în buclă.
12. **Level 0 nu se reia** la apăsarea butoanelor de nivel 1-10 (R7).
13. **Random, o dată per nivel:** oricâte verificări eligibile apar, sq5 pornește **cel mult o dată**
    per nivel; când sq3 e eligibil în același punct, câștigă sq3.
14. **Creșterea pe zi:** cu ziua simulată, `N` crește 4 → 5 → 6 la a doua și a treia zi de utilizare;
    **nu** crește de două ori în aceeași zi; **nu** mai crește după ce sliderul a fost mutat manual.
15. **Forme preferat diferite (D1):** într-o serie, un fact reluat primește o formă nefolosită încă,
    cât timp mai există una disponibilă.
16. **Non-regresie:** cele 19 teste existente rămân verzi, nemodificate.
17. **`covered` neatins:** după un sq5 complet, `shared.baseState.covered` are exact aceleași
    elemente ca înainte.

---

## 10. Ce NU se face acum

**Fluență per formă de ecuație.** Măsurarea care ar transforma sq5 dintr-un cronometru într-un
antrenor: în loc de „a treia zi ⇒ 6 forme", „factul `11*3` e fluent în 9 din 24 de forme, mai lucrăm
pe celelalte 15". Datele există deja (`eq_form` se loghează la fiecare întrebare) și conducta din
`motor-analiza.js` ar putea grupa pe `(fact, eq_form)` în loc de doar `fact`. E însă un proiect de
dimensiunea Vizualizare 3, nu un pas din sq5, și devine interesant abia după ce sq5 produce date pe
forme multiple. Legat direct de A5.

**Filtru pe `subquiz_id` în Vizualizare 3.** Atenuarea pentru R4/R5. Câmpul e purtat prin motor
([motor-analiza.js:24](Vizualizare%203%20-%20Claude/motor-analiza.js:24)), dar niciun control nu-l
folosește. Devine necesar în momentul în care userul se uită la grilă și nu mai recunoaște cifrele.

**Dozarea formelor** (înmulțiri vs. împărțiri) — D6, „vedem după aia".

**Reglarea volumului lui level 0** — D5. Userul a anticipat trei variante („o repetiție per fluent
fact", „level 0 la sfârșit", altceva). De-aia `TURNS`, `BLOC` și poziția lui level 0 trebuie să stea
ca **valori și rutare**, nu topite în logică.

**Serviciul comun de analiză a logului** — rămâne amânat, ca în §8 din planul sq3. sq5 adaugă un
consumator al aceleiași citiri, ceea ce întărește argumentul, dar nu-l schimbă.
