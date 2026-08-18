# PLAN — Motor comun de răspuns (corect/greșit + animații) și cimentarea relației quiz–subquiz

> **Pentru agentul care execută (Sonnet 5), pornit dintr-un chat nou, pe alt PC, fără
> contextul discuției în care s-a născut planul.** Documentul e scris ca să fie suficient
> singur. Citește-l integral înainte de orice modificare, plus `AGENTS.md` (regulile de
> design) și `documente de referinta/razgandire-ieftina.md` (diagnostic de cuplare).
>
> Starea curentă a lucrului e **întotdeauna** în `documente de referinta/RAPORT-motor-comun-raspuns.md`.
> Îl citești **primul**, ca să știi unde s-a rămas. Îl actualizezi **după fiecare quiz migrat**,
> nu la final — sesiunea se poate întrerupe oricând (limită de 5 ore), iar raportul e singurul
> lucru care permite reluarea fără reconstrucție din cod.

Scris 18.08.2026 (Opus 5), pe baza unei analize măsurate pe codul real. Toate cifrele de mai
jos sunt **verificate prin grep/citire de cod**, nu estimate. Dacă vreuna nu se confirmă la
execuție, **oprește-te și raportează** — înseamnă că repo-ul s-a schimbat între timp și planul
trebuie recalibrat, nu „adaptat din mers".

---

## 1. Problema, măsurată

YouLearn are un motor de randare comun (`js/falling-engine.js`) pe care **niciun quiz nu-l
modifică** — asta funcționează corect. Motorul e însă complet **pasiv**: cheamă
`quiz.onAnswer(index)` și primește înapoi un obiect complet („asta e noua întrebare, așa arată
butoanele, așa clipește, `outcome` e X"), pe care doar îl pictează. **Toată decizia — inclusiv
„rămân pe întrebare sau trec mai departe" — e luată de fiecare quiz în parte.**

Consecința, numărată în repo la 18.08.2026:

| Ce | Cât |
|---|---|
| Quizuri înregistrate în meniu (`QuizRegistry.register`) | **25** |
| Din care în scopul lucrării (fără `rigle-cl1`) | **24** |
| Fișiere cu `onAnswer` propriu, în scop | **18** |
| — în `js/quizzes/` | 15 |
| — motoare separate, în afara `js/quizzes/` | 3 |
| Fișiere cu subquizuri | 3 (`v2-modular`, `v3-train-eff-eq-forms`, `v4-intensiv-multipli-234`) |
| Subquizuri total | **17** (9 + 3 + 5) |
| Subquizuri care folosesc calea comună `genericOnAnswer` | **0 din 17** |
| Implementări distincte de „ce se întâmplă la apăsare" | **~30** |

`js/subquiz/subquiz-definition.js` conține deja `genericOnAnswer` — o cale comună, scrisă
evident cu intenția de a fi refolosită (are `wrongAnswerRule: {mode:"retrySame"}` și `exitRule`
ca **date**, nu ca cod). Se activează automat dacă un subquiz **nu** își definește propriul
`onAnswer`. **Zero subquizuri o folosesc.** Toate 17 și-au scris propriul `onAnswer`.

`AGENTS.md` conține deja, de mult, regula 4: *„Preferă aceeași funcție cu argumente diferite,
nu funcții separate pentru fiecare quiz."* A fost ignorată de ~30 de ori.

**De ce contează, concret:** două dintre duplicate au ajuns, **independent**, la exact același
bug — `sq3` (plasa de siguranță) și `sq5` (fiecare răspuns) avansau itemul intern dar întorceau
eticheta `outcome: "wrong-answer"`, pe care motorul o tratează literal ca „nu randa, rămâi pe
întrebarea veche". Rezultat vizibil pentru copil: ecranul rămânea pe întrebarea anterioară,
butoanele păreau moarte, iar **răspunsurile corecte erau notate greșit în jurnal** — contaminând
exact datele pe care se bazează analiza de fluență (Vizualizare 3) și alegerea întrebărilor.
Eticheta a fost reparată punctual (commit `3528709`), dar **cauza — duplicarea — a rămas**.

### 1.1. De ce nu ajung soluțiile „ușoare" (deja încercate, deja eșuate)

- **Regulă scrisă în `AGENTS.md`** — există (regula 4), ignorată de ~30 de ori. Un document nu
  oprește pe nimeni.
- **Cale comună disponibilă, dar opțională** — `genericOnAnswer` exact asta e. Adopție: **0/17**.
  Istoric (relatat de user): la restructurarea inițială s-a decis „valabil de-acum-încolo, nu
  modificăm quizurile vechi" — dar nici cele **noi** nu au fost făcute pe calea comună, fiecare a
  fost „de capul lui". Deci „construiește-o și las-o opțională" **a fost deja încercat, în exact
  forma asta, în exact acest cod, cu rezultat zero.**
- **Test-santinelă care detectează duplicarea** — verifică după faptă, nu împiedică fapta; și un
  agent grăbit, într-o sesiune viitoare fără context, relaxează testul ca să treacă mai departe.

**Singurul lucru care ține: calea greșită să nu mai existe.** De aceea impunerea vine **înainte**
de migrare (§5) — vezi decizia de ordine de acolo, care e deliberată și nu se re-litigă.

---

## 2. Scopul

Nu „reparăm sq5". **Cimentăm două lucruri, ca să nu mai poată fi ocolite:**

1. **Modul de răspuns:** apeși corect → treci mai departe; apeși greșit → rămâi pe aceeași
   întrebare până răspunzi corect; cu **locuri prevăzute pentru animații/pauze**.
2. **Relația quiz–subquiz:** subquizul dă **CE**, nu **CUM**. Face parte din structura quizului,
   nu-l modifică.

La final, **nimic nu mai funcționează altfel** — nici quizurile existente, nici cele viitoare.

### 2.1. Invariantul, formulat exact

> **Răspuns corect → avansează. Răspuns greșit → rămâi pe aceeași întrebare, marchezi butonul
> greșit, aștepți răspunsul corect.**

Diferența dintre quizuri/subquizuri stă **strict** în:
- **(a)** ce întrebare/fapt vine următor (`generator` — rămâne al quizului/subquizului);
- **(b)** cum se construiesc și se afișează variantele de răspuns.

**Niciodată** în ce se întâmplă la apăsarea unui buton.

**Singura excepție acceptată — plasa de siguranță.** Există deja în `sq3`: după 5 încercări
greșite pe același fapt, avansează forțat, ca un fapt pe care copilul chiar nu-l știe să nu
blocheze tot subquizul. Rămâne — dar ca **dată** (un număr dat modulului comun), nu ca ramură de
cod scrisă din nou în fiecare quiz.

### 2.2. Cele patru sloturi de animație (cerință explicită a userului)

Modulul comun trebuie să permită pauze/animații intermediare în patru puncte:

1. **înainte de afișarea întrebării**
2. **după afișarea întrebării**
3. **înainte de apăsarea butonului** (interval în care apăsarea e blocată)
4. **după apăsarea butonului**, înainte de următoarea întrebare

Mecanisme care există deja în cod și trebuie **absorbite** de modulul comun, nu lăsate paralele:
`promptHoldMs` + `continueStep` (7 utilizări), `runDelayMs` (11), `resetFall` (28), `bounce` (77),
și „revelarea la contact" din `falling-engine.js` (`DEFAULT_REVEAL_HOLD_MS = 160`, o pauză deja
hardcodată în motor).

---

## 3. Inventarul exact — ce se migrează

> **Atenție, capcană descoperită la scrierea planului:** o parte din quizurile din meniu **nu au
> cod propriu în `js/quizzes/`**. Cele 9 fișiere `*-eff-helper.js` / `*-table-conexe-helper.js` /
> `addition-succesive-helper.js` doar **înregistrează** quizul și deleagă la un motor comun din
> altă parte (`global.EFFQuiz`, `global.ConexeTableQuiz`, `global.SuccesiveQuiz`). Un `grep` pe
> `js/quizzes/` **le ratează complet**. Cele 3 motoare sunt în scop.

**`js/quizzes/rigle-cl1.js` NU se atinge** — are motor propriu (m2), separat de `falling-engine.js`,
cu alt contract. Decizie explicită a userului. Nu folosește `SubquizDefinition` (verificat).
**Verifică explicit înainte de impunere (Faza C) că nu e afectat.**

### 3.1. Cele 18 fișiere de migrat

| # | Fișier | Test azi? | Subquizuri | Câte intrări de meniu deblochează |
|---|---|---|---|---|
| 1 | `js/quizzes/addition-table.js` | **NU** | — | 1 |
| 2 | `js/quizzes/addition-table-range.js` | **NU** | — | 1 |
| 3 | `js/quizzes/prime-divisors.js` | **NU** | — | 1 |
| 4 | `js/quizzes/sub-sau-langa-radical.js` | DA | — | 1 |
| 5 | `js/quizzes/bagare-sub-radical.js` | **NU** | — | 1 |
| 6 | `js/quizzes/addition-table-singapore.js` | **NU** | — | 1 |
| 7 | `js/quizzes/addition-table-singapore-missing.js` | **NU** | — | 1 |
| 8 | `js/quizzes/division-with-remainder.js` | **NU** | — | 1 |
| 9 | `js/quizzes/prime-divisions.js` | **NU** | — | 1 |
| 10 | `js/quizzes/equations-e3-e6.js` | DA | — | 1 |
| 11 | `js/succesive-quiz/engine.js` | **NU** | — | 1 |
| 12 | `js/conexe-table-quiz/engine.js` | DA (4 fișiere de test helper) | — | **4** |
| 13 | `js/eff-quiz/engine.js` | **NU** | — | **4** |
| 14 | `js/quizzes/pre-equations-eff-navigation.js` | DA | — | 1 |
| 15 | `js/quizzes/multiplication-1120-v2.js` | DA | — | 1 |
| 16 | `js/quizzes/multiplication-1120-v2-modular.js` | DA | **9** | 1 |
| 17 | `js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js` | DA | **3** | 1 |
| 18 | `js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js` | DA | **5** | 1 |

**10 din 18 n-au niciun test** (#1, 2, 3, 5, 6, 7, 8, 9, 11, 13). Pentru ele, **testele se scriu
ÎNAINTE de a atinge fișierul** — altfel modifici pe orb. Userul a confirmat explicit: „le faci
teste". Asta e o parte mare din efortul total, nu un detaliu.

**Note:**
- `multiplication-1120-v3-train-eff-eq-forms.js` nu se înregistrează singur — exportă
  `global.Mul1120V3TrainEffEqFormsQuiz`, iar înregistrarea o face fișierul `-jurnal.js` (22 linii).
- `js/eff-quiz/engine.js` alimentează 4 quizuri din meniu (adunare/scădere/înmulțire/împărțire EFF);
  `js/conexe-table-quiz/engine.js` tot 4. Migrarea lor deblochează 4 intrări de meniu deodată.

### 3.2. Loturile de lucru (5 fișiere per lot, în această ordine)

Ordinea nu e arbitrară: **simplu → complex**, ca designul modulului comun să fie validat pe
cazuri ușoare înainte de a ajunge la motoarele partajate și la cele cu subquizuri.

- **Lotul 1:** #1–#5 (`addition-table`, `addition-table-range`, `prime-divisors`, `sub-sau-langa-radical`, `bagare-sub-radical`)
- **Lotul 2:** #6–#10 (`addition-table-singapore`, `…-missing`, `division-with-remainder`, `prime-divisions`, `equations-e3-e6`)
- **Lotul 3:** #11–#15 (`succesive-quiz`, `conexe-table-quiz`, `eff-quiz`, `pre-equations-eff-navigation`, `multiplication-1120-v2`) — **deblochează 9 intrări de meniu**
- **Lotul 4:** #16–#18 (cele 3 cu subquizuri: `v2-modular`, `v3`, `v4`) — aici se repară și `sq5`

**Consecință de acceptat conștient:** `v4` (deci bug-ul rămas la `sq5`) se repară abia în
**Lotul 4**. E prețul validării designului pe cazuri simple întâi. Dacă userul vrea `v4` mai
devreme, **el decide**, nu tu.

---

## 4. Ce se construiește — contractul modulului comun

**NU proiecta modulul din prima, din cap.** Faza A începe cu un **inventar al variației reale**,
pentru că modulul trebuie să acopere cazurile care există, nu cele imaginate. Riscul principal al
întregului plan (§6, R2) e un modul care nu încape peste realitate și primește „portițe" — care
recreează exact problema.

### 4.1. Cerințe obligatorii ale modulului

Un singur fișier nou, cu denumiri în română (regula 12 din `AGENTS.md`), care:

1. **Deține invariantul** din §2.1 — corect avansează, greșit rămâne. Quizul **nu mai are cum**
   să exprime altceva.
2. **Primește de la quiz doar date**, nu decizii:
   - dacă răspunsul e corect (quizul evaluează — el știe conținutul);
   - vederea întrebării curente (pentru cazul „rămâi");
   - o funcție care produce **următoarea** întrebare — chemată **doar** când se avansează;
   - mesajele de afișat;
   - duratele/animațiile pe cele patru sloturi din §2.2;
   - opțional, plasa de siguranță ca număr de încercări.
3. **Produce rezultatul** în forma pe care `falling-engine.js` o așteaptă azi — inclusiv eticheta
   `outcome` corectă, calculată **de modul**, niciodată scrisă de mână de vreun quiz.
4. **Marchează rezultatul** (un câmp-semnătură), ca motorul să poată verifica în Faza C că
   rezultatul chiar vine de la el.
5. E **testabil fără DOM** (funcție pură peste date — punctul 1 din `razgandire-ieftina.md`), cu
   teste proprii, separate de testele quizurilor.

### 4.2. Vocabularul `outcome` — de respectat exact

Valorile folosite azi (numărate): `step-correct` (77), `run-complete` (34), `wrong-answer` (20),
`round` (16), `timeout` (9). Semnificația critică, în `falling-engine.js`:

- `outcome: "wrong-answer"` + buton apăsat ⇒ **„nu randa, rămâi pe întrebarea veche"**
  (`applyAnswerResult`, ~linia 852: `wrongPick`; apoi ~linia 818: `if (shouldRender && !wrongPick)
  renderRound(result)`). **Nu** înseamnă doar „a fost greșit".
- Din clipa în care s-a avansat efectiv la alt item, eticheta trebuie să fie `step-correct`,
  chiar dacă răspunsul a fost greșit (cazul plasei de siguranță). Altfel reapare exact bug-ul
  din §1.
- `js/subquiz/subquiz-definition.js` are al doilea strat: `blockWrongTransition` anulează orice
  tranziție întoarsă dintr-un răspuns greșit, dacă nu e marcată explicit `allowOnWrong: true`.

Aceste două straturi sunt **contractul**, nu detalii de implementare. Modulul comun le respectă;
nu le rescrie și nu le ocolește.

---

## 5. Ordinea de lucru — faze și puncte de OPRIRE

> **Ordinea e stabilită explicit de user și NU se re-litigă: impunerea vine ÎNAINTE de migrare.**
>
> Agentul care a scris planul a propus inițial ordinea inversă (migrezi întâi, impui la final),
> ca să nu se spargă quizurile. Userul a respins-o și a dat mecanismul corect: **quizurile
> nemigrate CHIAR trebuie să se spargă**, iar spargerea se face **vizibilă** prin redenumire în
> meniu (§5.1). Motivul e solid: orice fereastră în care modulul comun e „disponibil dar
> opțional" e exact starea istorică ce a produs adopție 0/17. Ordinea userului elimină acea
> fereastră structural. Suplimentar, quizurile marcate „NEFUNCȚIONAL" în meniu creează presiune
> vizibilă spre terminarea lucrării — spre deosebire de o stare intermediară tăcută, care se
> poate uita la nesfârșit.

### 5.1. Marcajul în meniu — mecanica exactă

În momentul impunerii (Faza C), **toate cele 24 de quizuri în scop** devin nefuncționale. Fiecare
primește, în titlul înregistrat la `QuizRegistry.register`, sufixul:

```
 - QUIZ NEFUNCTIONAL - IN REFACTORING
```

Exemplu concret, cu titlul real din `js/quizzes/addition-eff-helper.js`:

```
"T+ EFF — Adunare extended fact family - QUIZ NEFUNCTIONAL - IN REFACTORING"
```

**Pe măsură ce un fișier e migrat și testat, sufixul se scoate** de la intrările de meniu pe care
le deblochează (vezi coloana din §3.1 — migrarea lui `eff-quiz/engine.js` scoate sufixul de la 4
intrări deodată). Titlul revine **exact** la forma originală, fără urme.

Atenție la cele 5 titluri care vin din constante, nu din literali:
`QUIZ_TITLE` în `equations-e3-e6.js`, `multiplication-1120-v2-modular.js`,
`multiplication-1120-v4-intensiv-multipli-234.js`, `pre-equations-eff-navigation.js`, și
`QUIZ_NAME` în `multiplication-1120-v3-train-eff-eq-forms-jurnal.js`. Sufixul se pune la
înregistrare, **nu** în constantă — constanta e folosită și ca `quiz_name` în jurnal, iar
murdărirea ei ar contamina datele.

**`rigle-cl1.js` NU primește sufix** — nu e în scop, rămâne funcțional tot timpul.

### Faza A — inventar + contract (se termină cu OPRIRE)

1. Citește `onAnswer`-ul **tuturor** celor 18 fișiere în scop + cele 17 subquizuri. Nu presupune,
   citește. **Include cele 3 motoare din afara `js/quizzes/`** (§3).
2. Scrie un tabel al **variației reale**: ce face fiecare la corect, la greșit, ce pauze
   folosește, ce cazuri speciale are (avans de nivel, `run-complete`, secvențe multi-pas ca
   `prime-divisions` sau descompunerea din `addition-table-singapore`).
3. Propune contractul exact al modulului comun (semnătură, argumente, ce întoarce), arătând
   pentru **fiecare** din cele ~30 de cazuri cum se exprimă prin el.
4. **OPREȘTE-TE. Prezintă userului și așteaptă aprobarea.** Nu scrie modulul înainte.

### Faza B — modulul comun + testele lui (se termină cu OPRIRE)

1. Scrie modulul, conform contractului aprobat.
2. Scrie testele lui, direct pe contract (nu pe structura internă — regula 11 din `AGENTS.md`).
3. Nimic altceva nu se modifică încă. Toate testele existente rămân verzi. **Aplicația
   funcționează normal la acest punct** — modulul există, dar nu e încă impus.
4. **OPREȘTE-TE. Raportează.**

### Faza C — IMPUNEREA (aici se sparge totul, intenționat)

1. `falling-engine.js`: validează că rezultatul primit de la `quiz.onAnswer()` poartă semnătura
   modulului comun. Dacă nu — **aruncă eroare explicită**, zgomotoasă (punctul 9 din
   `razgandire-ieftina.md`: „erori explicite, imediate"). Nu avertisment, nu fallback tăcut.
2. Pune sufixul „NEFUNCȚIONAL" pe **toate cele 24** de quizuri din meniu (§5.1).
3. Verifică explicit că `rigle-cl1.js` (motor m2) **nu** e afectat și rămâne funcțional.
4. Test-santinelă: un quiz care încearcă vechea cale **chiar** crapă.
5. **OPREȘTE-TE. Raportează.** Din acest moment, singurele quizuri funcționale sunt `rigle-cl1`
   și cele deja migrate (la acest punct: zero).

### Faza D — migrarea, în loturi de câte 5 (OPRIRE după fiecare lot)

Pentru **fiecare** fișier din lot, în ordinea din §3.2:

1. **Dacă nu are test** (10 din 18): scrie-i întâi testele, pe comportamentul **de dinainte de
   refactorizare** (îl citești din git: `git show <commit-de-dinainte>:<cale>`), și verifică-le
   verzi pe versiunea veche **înainte** de orice modificare. Ele sunt plasa de siguranță a migrării.
2. **Fă o copie a fișierului** (metoda cerută de user). Copia primește un `QUIZ_ID` și un titlu
   distincte (sufix), și se adaugă în `index.html` lângă original — altfel cele două înregistrări
   se ciocnesc pe același ID. Precedent existent în proiect: `v2` vs. `v2-modular`, `v3` vs.
   `v3-jurnal`. Așa userul poate compara **live**, una lângă alta.
3. Migrează copia pe modulul comun. Elimină logica proprie de corect/greșit/avans.
4. Rulează testele: `node --test tests/<fișier>.test.js`
   (**atenție:** `npm test` rulează un singur fișier, nelegat — nu te baza pe el).
5. Verifică live în browser (server local, vezi `AGENTS.md` → „Deschiderea locală în Codex browser").
6. **Șterge originalul**; copia preia ID-ul, titlul și `order`-ul original (ca progresul salvat pe
   ID să nu se piardă), **fără** sufixul „NEFUNCȚIONAL". Actualizează `index.html`.
7. **Bump `?v=N`** în `index.html` pentru fiecare fișier atins — fără el browserul userului
   servește codul vechi și „nu merge".
8. **Actualizează `RAPORT-motor-comun-raspuns.md`** — după **fiecare** fișier, nu la finalul lotului.

La finalul fiecărui lot de 5:

> **OPREȘTE-TE.** Scrie exact: *„Am modificat și testat quizurile a, b, c, d, e."* Userul le
> testează și el, apoi îți spune să continui. La reluare: citești raportul, vezi unde ai rămas,
> continui conform planului. **Nu trece la lotul următor din proprie inițiativă.**

### Faza E — Pasul 2: subquizul dă CE, nu CUM

Se face **după** ce toate cele 18 fișiere sunt migrate. Atinge doar cele 3 fișiere cu subquizuri.

1. `js/subquiz/subquiz-definition.js`: `define()` **aruncă** dacă definiția conține `onAnswer`.
   Din acest moment un subquiz poate da **doar** `generator`, `initialState` și date de
   configurare — deci **CE**, nu **CUM**. Calea comună (fostul `genericOnAnswer`) devine singura,
   delegând modulului comun.
2. Pune sufixul „NEFUNCȚIONAL" pe cele 3 quizuri cu subquizuri, până sunt migrate.
3. Migrează cele 17 subquizuri (9 + 3 + 5), câte un fișier o dată, cu testele lui, scoțând
   sufixul pe măsură.
4. Test-santinelă: `SubquizDefinition.define({ onAnswer })` chiar aruncă.
5. **OPREȘTE-TE după fiecare fișier.** Raportează.

### Faza F — verificare finală

1. **Niciun titlu din meniu nu mai conține sufixul** „NEFUNCȚIONAL".
2. Toate testele repo-ului verzi + `npm run check:docs` + `npm run check:encoding`.
3. Criteriile din §9, verificate unul câte unul.
4. **OPREȘTE-TE. Raport final.**

---

## 6. Pre-mortem — ce poate merge prost

**R1. Cele 10 fișiere fără teste.** Migrare pe orb = regresii invizibile în quizuri pe care
copilul le folosește. **Atenuare:** testele se scriu întâi, pe comportamentul de dinainte de
refactorizare (citit din git), și trec verzi pe versiunea veche înainte de orice atingere.
Nenegociabil.

**R2. Modulul comun nu încape peste realitate.** Cel mai probabil mod de eșec *de design*.
`prime-divisions.js` descompune pas cu pas (fiecare pas = altă întrebare în aceeași rundă),
`addition-table-singapore.js` are faze de retry și avans de nivel, `v4` are subquizuri care se
împing/scot reciproc, iar cele 3 motoare partajate (EFF, conexe, succesive) au fiecare propriile
tipare. Dacă modulul nu le acoperă, presiunea va fi să i se adauge „portițe" — adică exact
duplicarea, mutată un nivel mai sus. **Atenuare:** Faza A se face **înainte** de a scrie o linie
din modul, și fiecare din cele ~30 de cazuri trebuie să se exprime prin contract **pe hârtie**.

**R3. Abandon la jumătate.** Cu ordinea aleasă (impunere înainte de migrare), abandonul la
jumătate lasă o parte din quizuri **vizibil nefuncționale** în meniu. E deranjant — și exact de
asta e mai sigur decât alternativa: o stare intermediară tăcută se uită la nesfârșit (istoric
dovedit: adopție 0/17), una vizibilă nu. **Atenuare:** raportul face starea explicită; sufixul
din meniu o face imposibil de ignorat.

**R4. Regresii fine de comportament live.** Pauzele, revelarea răspunsului, săltarea — se pot
schimba subtil fără ca testele să prindă (sunt lucruri vizuale). **Atenuare:** userul verifică
live fiecare lot înainte de a aproba continuarea.

**R5. Întreruperi la limita de 5 ore.** Garantat că apar. **Atenuare:** raportul actualizat după
**fiecare fișier**, nu după fiecare lot.

**R6. Agentul „o ia pe câmp" în timpul implementării.** Documentat, s-a întâmplat chiar în
sesiunea în care s-a scris planul: absorbit de detaliul tehnic, agentul a pierdut din vedere
directivele structurale primare — inclusiv unele pe care le scrisese el însuși cu câteva minute
înainte. **Atenuare:** la fiecare OPRIRE, re-citește §2.1 (invariantul) și regulile 10, 13, 14
din `AGENTS.md` **înainte** de a raporta; nu presupune că sunt încă „în minte".

**R7. Impunere pe jumătate.** Dacă rămâne o portiță „doar pentru cazuri speciale", riscul revine
identic și complet. Nu ține pe jumătate de măsură.

**R8. Quizuri ratate la inventar.** S-a întâmplat deja la scrierea planului: un `grep` pe
`js/quizzes/` rata cele 3 motoare din afara folderului, care alimentează 9 intrări de meniu.
**Atenuare:** înainte de Faza C, numără intrările din meniu (`QuizRegistry.register`) și
confirmă că fiecare are un fișier corespunzător în lista din §3.1. Dacă numărul nu dă 25 (24 +
`rigle-cl1`), **oprește-te și raportează**.

---

## 7. Red-team pe premisele planului

**A1. „Un singur cod pentru toate" poate fi greșit pentru un caz real.** Posibil. Dacă la Faza A
apare un quiz care chiar nu încape — **nu-i faci portiță tăcută**: oprești, raportezi, și userul
decide (îl scoate din scop, ca `rigle-cl1`, sau schimbă contractul pentru toți). Un caz scos
explicit din scop e onest; o portiță generică e începutul următoarei duplicări.

**A2. Efortul e mare și beneficiul e invizibil pentru copil.** Adevărat: după toată lucrarea,
aplicația arată la fel. Beneficiul e că bug-ul din §1 nu se mai poate naște — nici acum, nici în
quizul care se scrie peste trei luni. Ăsta e singurul motiv pentru care lucrarea merită, și
merită spus deschis, nu ascuns sub „refactorizare".

**A3. Planul presupune că `falling-engine.js` nu se rescrie.** E premisa care ține tot restul
(motorul comun, deja respectat). Dacă Faza A arată că impunerea cere rescrierea motorului,
**oprește-te** — asta ar fi o lucrare de alt ordin de mărime, cu alt calcul de risc, și se
re-decide, nu se face din inerție.

**A4. Testele scrise acum, pe comportamentul actual, cimentează și eventuale bug-uri existente.**
Real. Sunt teste de **non-regresie**, nu de corectitudine — scopul lor e „nu am stricat nimic",
nu „totul e corect". Dacă la scrierea unui test descoperi un comportament clar greșit,
**raportează-l separat, nu-l repara în tăcere** (regula 14 din `AGENTS.md`).

**A5. Perioada cu quizuri nefuncționale poate fi lungă.** 18 fișiere, din care 10 au nevoie de
teste scrise de la zero. Dacă userul are nevoie de un quiz anume în perioada asta, **el decide**
reordonarea loturilor — planul nu e mai important decât folosirea reală a aplicației.

---

## 8. Alternative considerate și respinse

- **Doar o regulă în `AGENTS.md`.** Respinsă: regula 4 există deja și a fost ignorată de ~30 de ori.
- **Modul comun disponibil, dar opțional.** Respinsă: e exact `genericOnAnswer`, adopție 0/17.
  Deja încercat, deja eșuat, în acest cod.
- **Doar un test-santinelă anti-duplicare.** Respinsă: verifică după faptă și e primul lucru
  relaxat de un agent grăbit. Păstrat ca plasă **secundară**, nu ca mecanism principal.
- **Migrare întâi, impunere la final** (propunerea inițială a agentului). **Respinsă de user:**
  lasă o fereastră în care modulul e opțional — exact starea care a produs adopție zero. Vezi §5.
- **Motorul de randare devine activ (cere el singur întrebarea următoare).** Respinsă pentru
  **acum**: ar însemna rescrierea lui `falling-engine.js` și a relației lui cu toate cele 18
  fișiere deodată — cost mare, greu de dat înapoi (întrebarea 2 din `razgandire-ieftina.md`).
- **Migrare „big bang", toate cele 18 deodată.** Respinsă: nimic nu mai e verificabil separat, iar
  la prima întrerupere de 5 ore rămâi cu repo-ul în stare nefuncțională și neverificată.

---

## 9. Criterii de succes (falsificabile)

1. **Invariantul, verificat automat:** pentru fiecare din cele 24 de quizuri, un test dovedește că
   un răspuns greșit **nu** schimbă întrebarea afișată, iar unul corect **o schimbă**.
2. **Zero implementări proprii:** `grep` peste `js/` nu mai găsește niciun `onAnswer` cu logică
   proprie de corect/greșit/avans. Singurele apariții sunt apeluri către modulul comun.
3. **Impunere reală:** un quiz de test scris deliberat pe vechea cale **crapă cu eroare
   explicită** — atât la nivel de motor, cât și la `SubquizDefinition.define()`.
4. **Subquizurile dau doar CE:** `SubquizDefinition.define({ onAnswer })` aruncă. Cele 17
   subquizuri funcționează doar prin `generator` + `initialState` + date.
5. **Plasa de siguranță supraviețuiește ca dată:** `sq3` avansează în continuare forțat după 5
   încercări greșite pe același fapt, fără nicio linie de cod proprie pentru asta.
6. **Cele patru sloturi de animație funcționează** și acoperă toate utilizările existente azi
   (`promptHoldMs`/`continueStep` × 7, `runDelayMs` × 11).
7. **Bug-ul din §1 nu se mai poate exprima:** niciun quiz nu mai poate scrie `outcome` de mână.
8. **Niciun titlu din meniu nu mai conține** „QUIZ NEFUNCTIONAL - IN REFACTORING", iar titlurile
   sunt **identice** cu cele dinainte de lucrare.
9. **Non-regresie:** toate testele existente rămân verzi, `npm run check:docs` și
   `npm run check:encoding` curate.
10. **`rigle-cl1.js` neatins** și funcțional pe toată durata lucrării.
11. **Raportul reflectă realitatea** la orice moment: cineva care îl citește, fără alt context,
    știe exact ce e gata și ce urmează.

---

## 10. Ce NU se face în această lucrare

- **Nu se atinge `rigle-cl1.js`** (motor propriu m2) — decizie explicită a userului.
- **Nu se rescrie `falling-engine.js`** ca motor activ (vezi §8). Doar validarea din Faza C.
- **Nu se schimbă comportamentul vizibil** al niciunui quiz. Dacă un quiz se comportă azi corect,
  după migrare arată și se simte identic. Excepția știută și dorită: `sq5` din `v4`, care azi
  avansează pe răspuns greșit și după migrare va **rămâne** pe întrebare, conform invariantului.
- **Nu se repară bug-uri descoperite pe parcurs** — se raportează separat (regula 14).
- **Nu se redenumesc/mută lucruri „pentru curățenie"** (regula 10).

---

## 11. Reguli de lucru pe toată durata

- **Citește raportul primul lucru, la fiecare pornire de sesiune.**
- **Actualizează raportul după fiecare fișier**, nu la final.
- **Oprește-te la fiecare OPRIRE** din §5. Nu continua din proprie inițiativă.
- **Commit** doar la cerere explicită a userului, cu mesaj simplu, între ghilimele (fără
  substituții de shell).
- **Bump `?v=N`** în `index.html` la orice fișier `.js`/`.css` atins.
- **`node --check <fișier>`** înainte de a deschide browserul — o eroare de sintaxă dă pagină albă
  și consolă goală, și pierzi mult timp căutând în altă parte.
- **Nu edita fișiere cu diacritice prin PowerShell** (`Get-Content|Set-Content` le strică în
  mojibake). Folosește uneltele de editare directă.
- Comenzile se rulează **din rădăcina proiectului**, fără prefix `cd`.
