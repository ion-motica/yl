# RAPORT de activitate — Motor comun de răspuns

> **Fișier de stare, actualizat pe parcurs.** Planul e în
> `documente de referinta/PLAN-motor-comun-raspuns.md`.
>
> **Agent: citește acest fișier PRIMUL, la fiecare pornire de sesiune.** Sesiunile se întrerup
> (limită de 5 ore); asta e singura sursă care spune unde s-a rămas, fără să reconstruiești din cod.
>
> **Se actualizează după FIECARE fișier migrat**, nu la finalul lotului.

---

## Stare curentă

**Faza:** D — în lucru. Loturile 1, 2 și 3 COMPLETE (Lotul 1: commit `f0ded97`; Lotul 2: commit
`7ed8cc1`; Lotul 3: commit în curs de pregătire — vezi jurnal). 16/18 fișiere migrate.
**Următorul pas:** Lotul 4 — ultimele 3 fișiere, cele cu subquizuri reale
(`multiplication-1120-v2-modular.js` — 9 subquizuri, `multiplication-1120-v3-train-eff-eq-forms.js`
— 3 subquizuri, `multiplication-1120-v4-intensiv-multipli-234.js` — 5 subquizuri, aici se repară
și `sq5` din bug-ul original care a pornit tot refactorul). După Lotul 4 urmează Faza E
(`SubquizDefinition.define()` aruncă pe `onAnswer`, orchestrator impus la toate quizurile).
**Modulul:** `js/motor-3-butoane.js` — „Motor 3 butoane" (M3B), numele dat de user.
**Autorizare 18.08.2026, noapte:** userul a cerut explicit sa continui fara sa astept confirmare
la fiecare OPRIRE, "conform planului" — comit si implementez in continuare autonom. Autorizarea
e in vigoare, neschimbata.
**Aplicația:** funcțională; quizurile nemigrate rămân marcate „NEFUNCȚIONAL" în meniu intenționat.
**Ultima actualizare:** 19.08.2026

---

## Scop, pe scurt (ca să nu reciteşti tot planul la fiecare reluare)

Un singur cod pentru „corect → avansezi / greșit → rămâi pe întrebare", cu sloturi pentru
animații, impus astfel încât **nimic** să nu mai poată funcționa altfel — nici quizurile de azi,
nici cele viitoare. Plus: subquizul dă **CE** (ce întrebare urmează), niciodată **CUM** (ce se
întâmplă la apăsare).

**18 fișiere de migrat, 24 de intrări de meniu.** `rigle-cl1` e în afara scopului (motor propriu m2).

---

## Jurnal de progres

| Data | Fază / Lot | Ce s-a făcut | Stare |
|---|---|---|---|
| 18.08.2026 | — | Plan scris (Opus 5), pus pe GitHub. Nicio modificare de cod. | plan gata |
| 18.08.2026 | — | Plan corectat: scop extins (3 motoare din afara `js/quizzes/`, ratate la prima numărare) + ordine schimbată (impunerea ÎNAINTE de migrare, decizia userului). | plan gata |
| 18.08.2026 | Faza A | Citire completă (18 fișiere + 17 subquizuri), contract propus, apoi corectat de user de mai multe ori: mecanism de avans forțat fără răspuns corect ("plasa de siguranță") — găsit într-un singur loc (sq3), eliminat complet din contract, nicăieri nu există limită de încercări. Clarificat: „răspuns corect" la nivel de tură = doar prima apăsare, apăsările ulterioare sunt corectare, nu re-evaluare (deja consemnat, corect, în jurnalul/Vizualizare 3 existent — verificat, nu era gaură nouă). Decizie nouă de scop: orice quiz trece prin `SubquizOrchestrator`, minim o bucată — vezi §12 din plan. Faza A aprobată. | **complet** |
| 18.08.2026 | Faza B | Scris `js/motor-3-butoane.js` (M3B) + `tests/motor-3-butoane.test.js` (15 teste, toate verzi). Numele și vocabularul motoarelor (mr/mq/msq/ML/M3B) date de user. Nimic altceva neatins: niciun quiz nu-l folosește încă, nu e încărcat în `index.html`. Suita completă: 423 teste, 420 trec (3 picate preexistente, sensibile la dată). | **scris, așteaptă verificare** |
| 18.08.2026 | Faza C | User a autorizat explicit continuarea autonomă, fără OPRIRI, "e noapte". `falling-engine.js` impune semnătura M3B (aruncă altfel); toate cele 24 de quizuri sufixate „NEFUNCTIONAL" în meniu; `rigle-cl1` verificat neafectat (static + test + live); test-santinelă nou. Reparat pe drum: un test preexistent (`falling-engine-jurnal-timing.test.js`) folosea un quiz simulat pe vechea cale — actualizat sa treaca prin M3B, nu relaxat. 7 teste noi picate, așteptate (title-uri sufixate), documentate mai jos — se rezolvă singure la migrare. Verificat live în browser: eroarea chiar apare la apăsare pe quiz nemigrat. | **complet** |
| 18.08.2026 | Faza D, Lot 1 | 5 fișiere migrate (`addition-table`, `addition-table-range`, `prime-divisors`, `sub-sau-langa-radical`, `bagare-sub-radical`). Corecție de comportament intenționată la `bagare-sub-radical` (Categoria 4+6). Commit `f0ded97`, push confirmat. | **complet** |
| 19.08.2026 | Faza D, Lot 2 | 5 fișiere migrate (`addition-table-singapore`, `addition-table-singapore-missing`, `division-with-remainder`, `prime-divisions`, `equations-e3-e6`). Corecție de comportament intenționată la `division-with-remainder` (Categoria 4+6, ca la `bagare-sub-radical`). Primele fișiere cu `promptHoldMs`+`continueStep` proprii — confirmat că trec neatinse prin M3B. Verificat live în browser pentru toate 5, zero erori consolă. 483 teste, 475 trec (8 picate, toate așteptate: 3 preexistente + 5 title-uri pentru fișiere încă nemigrate din Loturile 3-4). Commit `7ed8cc1`, push confirmat. | **complet** |
| 19.08.2026 | Faza D, Lot 3 | 5 fișiere/motoare migrate, 9 intrări de meniu deblocate (`succesive-quiz/engine.js`, `conexe-table-quiz/engine.js` ×4, `eff-quiz/engine.js` ×4, `pre-equations-eff-navigation.js`, `multiplication-1120-v2.js`). Cel mai mare volum de corecții de comportament din tot refactorul, concentrat în `multiplication-1120-v2.js` (6 subquiz-uri interne, comentariul sursă spunea explicit „greșelile sunt ignorate" la modul intensiv — corectat, fără excepție). Suita existentă a acelui fișier avea 10 teste care testau bug-urile ca feature, rescrise. 499 teste, 495 trec (4 picate, toate așteptate: 3 preexistente + 1 title pentru `multiplication-1120-v2-modular`, Lotul 4). Verificat live în browser. | **complet** |

---

## Faza A — inventar + contract

- [x] Citit `onAnswer`-ul tuturor celor 18 fișiere în scop
- [x] Citit cele 17 subquizuri (9 în `v2-modular`, 3 în `v3`, 5 în `v4`)
- [x] Tabel al variației reale — vezi `FAZA-A-inventar-contract.md`
- [x] Contract propus — vezi `FAZA-A-inventar-contract.md` §2 (corectat pe parcurs, vezi jurnal)
- [x] **OPRIRE** — prezentat userului, toate întrebările rezolvate, **aprobat**

## Faza B — modulul comun = „Motor 3 butoane" (M3B)

- [x] Modul scris — `js/motor-3-butoane.js`, global `Motor3Butoane`
- [x] Teste proprii, pe contract — `tests/motor-3-butoane.test.js`, **15 teste, toate verzi**
- [x] Toate testele existente încă verzi (423 total, 420 trec; cele 3 picate sunt preexistente,
      din `vizualizare3-tabel-fluenta.test.js`, sensibile la dată — verificat prin `git stash`)
- [x] Aplicația funcționează normal — modulul există, dar nu e încă impus și nu e încă folosit
      de niciun quiz; nu e nici măcar încărcat în `index.html` (se face la Faza C)
- [ ] **OPRIRE** — raportat, așteaptă verificarea userului

### Vocabularul motoarelor (dat de user, 18.08.2026)

| Prescurtare | Ce e | Fișier | Global |
|---|---|---|---|
| **mr** | motor randare | `js/falling-engine.js` | `FallingEngine` |
| **mq** | motor quizuri | `js/quiz-registry.js` | `QuizRegistry` |
| **msq** | motor subquizuri (orchestrator) | `js/subquiz/subquiz-orchestrator.js` | `SubquizOrchestrator` |
| **ML** | motor logare | `js/jurnal-intrebari.js` | `JurnalIntrebari` |
| **M3B** | motor 3 butoane | `js/motor-3-butoane.js` | `Motor3Butoane` |

### Ce face M3B, pe scurt

- **Regula unică:** corect → treci; greșit → rămâi pe aceeași întrebare, fără limită de încercări.
- **Turul** e noțiune de sine stătătoare în cod: M3B numără apăsările din turul curent și expune
  `numarApasare`, `estePrimaApasare`, `turCorect` — ca fiecare quiz să NU-și recalculeze singur
  „corect din prima" (de-acolo ar diverge implementările).
- **Cele 4 momente** în care un quiz poate cere acțiuni (pauze/animații, ca date, nu efecte):
  `inainteDeAfisareaIntrebarii`, `dupaAfisareaIntrebarii`, `inainteDeApasare`, `dupaApasare` —
  ultimele două la **fiecare** apăsare, corectă sau nu.
- **Rutarea** (push/pop/exit prin msq) se cere prin `dupaRaspunsCorect` — se evaluează **exclusiv**
  după o apăsare corectă, niciodată în timp ce se așteaptă răspunsul corect.
- **Nu logează nimic** — face logarea corectă prin construcție: ținând întrebarea neschimbată pe
  greșit, `roundSignature` din mr rămâne același, deci `a_cata_apasare_pe_buton` numără 1, 2, 3…
  în același tur, exact cum se așteaptă `motor-analiza.js`.
- **Semnătura** `motor-3-butoane-v1` pe fiecare rezultat + `esteRezultatValid()` — unealta cu care
  mr va refuza, în Faza C, orice rezultat care nu vine din M3B.

## Faza C — IMPUNEREA (aici se sparge totul, intenționat)

- [x] `falling-engine.js` validează semnătura modulului comun (`valideazaRaspunsMotor3Butoane`,
      în `resolveChoice`); altfel aruncă eroare explicită, cu numele fișierului planului
- [x] Sufixul „ - QUIZ NEFUNCTIONAL - IN REFACTORING" pus pe toate cele **24** de quizuri din
      meniu (19 titluri literale + 5 din constante `QUIZ_TITLE`/`QUIZ_NAME`, sufix la
      înregistrare, constanta neatinsă — nu contaminează `quiz_name` din jurnal)
- [x] Verificat explicit că `rigle-cl1.js` (motor m2) NU e afectat — static (grep: zero
      referințe reale la `FallingEngine`, doar comentarii care explică separarea) + suita lui
      dedicată (`tests/rigle-facte.test.js`, 10/10 verde) + verificat live că apăsarea unui
      răspuns pe un quiz nemigrat chiar aruncă eroarea în consolă
- [x] Test-santinelă: `tests/falling-engine-impune-motor-3-butoane.test.js` — un quiz pe
      vechea cale chiar crapă (verificat cu `assert.throws`), unul pe M3B funcționează normal
- [x] **OPRIRE** — raportat (autorizare explicită de a continua fără așteptare, vezi mai sus)

### Consecință așteptată: 7 teste noi picate (title-uri), pe lângă cele 3 preexistente

Suita completă: 425 teste, 415 trec, 10 pică. 3 sunt preexistente (`vizualizare3-tabel-fluenta`,
sensibile la dată). **7 sunt noi, așteptate, temporare** — teste care verifică titlul EXACT al
unui quiz la înregistrare, acum sufixat:

- `tests/addition-table-conexe-helper.test.js` ("registers quiz metadata")
- `tests/division-table-conexe-helper.test.js` ("registers quiz metadata")
- ~~`tests/equations-e3-e6.test.js`~~ — REZOLVAT, migrat în Lotul 2
- `tests/multiplication-1120-v2-modular.test.js` ("registers as a separate visible lab quiz")
- `tests/multiplication-table-conexe-helper.test.js` ("registers quiz metadata")
- ~~`tests/sub-sau-langa-radical.test.js`~~ — REZOLVAT, migrat în Lotul 1
- `tests/subtraction-table-conexe-helper.test.js` ("registers quiz metadata")

**Nu se repară acum** — se rezolvă de la sine, per fișier, pe măsură ce fiecare e migrat în
Faza D/E și sufixul i se scoate (titlul revine identic cu ce testul așteaptă azi).

## Faza D — migrarea (loturi de câte 5 fișiere)

> Pe măsură ce un fișier e migrat + testat, i se scoate sufixul „NEFUNCȚIONAL" de la intrările de
> meniu pe care le deblochează. Numărul din paranteză = câte intrări de meniu deblochează.

### Lotul 1
- [x] `js/quizzes/addition-table.js` (1) — migrat, 7 teste (scrise întâi, pe comportamentul
      vechi, apoi verificate identice după migrare). Găsit pe drum, neatins (comportament
      preexistent): `onAnswer` forțează `levelAdvanced:false` necondiționat pe ramura corectă,
      chiar și când nivelul chiar avansează — semnalul real e `quiz.getLevel()`.
- [x] `js/quizzes/addition-table-range.js` (1) — migrat, 6 teste, verificat live
- [x] `js/quizzes/prime-divisors.js` (1) — migrat, 6 teste, verificat live (lanț complet 8→4→2→1,
      3 pași intermediari + run-complete). Primul fișier cu pas intermediar real (Categoria 7):
      mutația de stare stă în `dupaRaspunsCorect`, `intrebareUrmatoare` rămâne stub neatins.
- [x] `js/quizzes/sub-sau-langa-radical.js` (1) — migrat, testul existent (11 teste) adaptat
      (adăugat `motor-3-butoane.js` la încărcare) și verde, verificat live
- [x] `js/quizzes/bagare-sub-radical.js` (1) — migrat, 8 teste, verificat live. **Comportament
      vizibil CORECTAT** (Categoria 4): înainte de migrare, un răspuns greșit sărea direct la
      altă întrebare — acum rămâne pe loc, ca peste tot. Pragul de 21 numără acum doar
      răspunsuri rezolvate (corecte), nu orice apăsare (Categoria 6) — 21 neschimbat ca număr.
- [x] **LOTUL 1 COMPLET.** Toate 5 fișiere migrate, testate, verificate live.

### Lotul 2
- [x] `js/quizzes/addition-table-singapore.js` (1) — migrat, 8 teste noi (scris test după
      migrare, fișierul nu avea test dedicat). Migrare pură, comportament neschimbat (gresit
      era deja conform). Prima migrare cu `promptHoldMs`/`continueStep` — confirmat că trec
      neatinse prin M3B (câmpuri de nivel `mr`, nu ating `outcome`/`correct`). Are pas
      intermediar real (coadă de fapte pe același tur) ȘI fază de retry separată — ambele
      verificate, inclusiv cazul „greșeală pe primul fapt → retry phase, fără avans de nivel".
- [x] `js/quizzes/addition-table-singapore-missing.js` (1) — migrat, 8 teste noi, aceeași
      structură ca fișierul de mai sus (+ dimensiunea `missingSide`), migrare pură.
- [x] `js/quizzes/division-with-remainder.js` (1) — migrat, 8 teste noi. **Comportament vizibil
      CORECTAT** (Categoria 4): înainte, un răspuns greșit sărea la o variantă „retry" (formă
      opusă) sau la o întrebare nouă — acum rămâne pe loc. Pragul de 21 numără acum doar
      răspunsuri rezolvate corect (Categoria 6), nu orice apăsare — 21 neschimbat ca număr.
      Șters codul mort rămas fără corecție (`oppositeForm`, `isRetry`, variantele „retry").
      Test dedicat: 21 rezolvări corecte cu răspuns greșit interleaved la fiecare, confirmă
      simultan că greșitul nu avansează contorul ȘI nu strică artificial streak-ul de 5.
- [x] `js/quizzes/prime-divisions.js` (1) — migrat, 6 teste noi. Frate cu
      `prime-divisors.js` (lotul 1) dar cu o diferență: aici FIECARE pas
      intermediar are propria pauză (`promptHoldMs:160`+`continueStep`, nu doar
      pasul terminal) — păstrată neatinsă. A necesitat restructurare `quizApi`
      (ca la `addition-table.js`), fiindcă `finishSeriesRun` folosea
      `this.beginRound(...)`. Capcană găsită la scrierea testului: `round.options`
      sunt STRING-uri de afișare, nu numerele interne — `isPrime("2")` dă fals
      negativ (verifică `n === 2`, strict) dacă nu convertești cu `Number(...)`
      întâi; al doilea test a fost inițial vid sub determinism complet (primul
      cât e mereu prim) — rescris cu căutare (`deterministic:false` + retry)
      pentru un lanț cu pas intermediar real, verificat de 8 ori la rând.
- [x] `js/quizzes/equations-e3-e6.js` (1) — migrat, testul existent (11 teste)
      adaptat (adăugat `motor-3-butoane.js` la încărcare) și verde. Migrare
      pură, comportament neschimbat (greșit era deja conform).
- [x] **LOTUL 2 COMPLET.** Verificat live în browser (nu doar teste node) pentru
      toate cele 5 fișiere: greșit rămâne pe loc, corect avansează, pas
      intermediar → nou pas, tur fără greșeli → avans nivel, tur cu greșeală →
      fază retry (istoric golit, faptul greșit reapare) — totul confirmat vizual
      prin citirea DOM-ului real, zero erori în consolă pe parcursul întregii
      sesiuni de verificare. Notă (nu e bug de reparat, preexistent, neatins):
      `division-with-remainder.js` afișează uneori „—" ca opțiune (field „r" cu
      `i=2` are un singur trap valid posibil, `pickTraps` nu poate umple al
      doilea) — verificat live că nu produce crash, doar o opțiune mereu greșită.
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

### Lotul 3 — motoarele partajate (deblochează 9 intrări de meniu)
- [x] `js/succesive-quiz/engine.js` (1) — migrat, 7 teste noi. Migrare pură
      (gresit era deja conform). Pas intermediar real (serie de N pași în lanț,
      Categoria 7) — analog cu `prime-divisors.js`. Nu a necesitat restructurare
      `quizApi` (nicio funcție internă nu folosea `this`).
- [x] `js/conexe-table-quiz/engine.js` (**4**) — migrat. Cel mai complex fișier
      din refactor pana acum (M1/M2 block-mode, cozi de retry, faza de
      recovery, macro-pasi peste MAI MULTE blocuri). Migrare pură (gresit era
      deja conform). `dupaRaspunsCorect` cheamă direct `onStepCorrect(meta)`
      existentă, neschimbată; `onStepWrong` ramane neatinsa (tot folosita de
      `onTimeout`), doar efectele ei secundare mutate in `dupaApasare`. Nu a
      necesitat restructurare `quizApi`. Cele 4 fișiere helper
      (`addition-table-conexe-helper.js` etc.) — suita EXISTENTA, extinsa,
      **49 de teste, toate verzi din prima incercare** (acoperă alternanța
      M1/M2, retry, recovery, avans de nivel dupa 4 blocuri perfecte, grading,
      timeout). Adăugat `js/motor-3-butoane.js` în `tests/helpers/load-quiz-
      environment.js` (fișier comun celor 4 suite).
- [x] `js/eff-quiz/engine.js` (**4**) — migrat, 7 teste noi (nu avea test
      dedicat). Migrare pură (gresit era deja conform). Pas intermediar real
      (Seria A, pana la 5 fapte, Categoria 7). Șters cod mort creat de migrare:
      fosta `onStepWrong` nu mai avea niciun apelant (spre deosebire de sora ei
      din `conexe-table-quiz/engine.js`, aici `onTimeout` avea logică proprie
      inline, nu o chema). Descoperire utilă la scrierea testului: cu registrul
      de greșeli gol, o serie A perfectă (5 corecte) avansează nivelul IMEDIAT
      (`allMastered` e vid-adevărat cand nu exista nicio greseala inregistrata
      vreodata) — o greșeală pe drum întârzie avansul (verificat, > 4 pași).
- [x] `js/quizzes/pre-equations-eff-navigation.js` (1) — migrat, testul existent
      (13 teste, acoperire foarte buna: retry, triunghi legat, moduri
      numeric/formula/alternat, simbol necunoscuta) adaptat (adăugat
      `motor-3-butoane.js` la încărcare) și verde din prima. Migrare pură
      (gresit era deja conform). Pas intermediar real (3 pași per triunghi).
- [x] `js/quizzes/multiplication-1120-v2.js` (1) — migrat. **Cel mai mare
      numar de incalcari Categoria 3/4/6 gasite intr-un singur fisier**: 6
      „subquiz"-uri interne (anchor/intensiv/anchorSumValues/rapidAnchorAdditions/
      effectiveAnchorAddition/nonAnchorProducts), fiecare cu propriul bug.
      Cel mai grav: modul „intensiv" (si surorile lui, `effectiveIntensiv`,
      `nonAnchorProductsIntensiv`) avea in cod comentariul explicit „Greșelile
      sunt IGNORATE — avansăm indiferent de corect/greșit" — corectat, fara
      exceptie, conform regulii userului. `onProductAnswer` avansa nivelul
      direct pe un raspuns GRESIT daca pragul de 21 apasari era atins —
      eliminat. Toate pragurile (12, 7, 21, 10, 3, 10) numara azi doar
      raspunsuri REZOLVATE (corecte), neschimbate ca numere. Suita existenta
      (519 linii, 31 teste) avea 10 teste care testau EXPLICIT bug-urile ca
      „feature" (titluri ca „even if wrong", „regardless of mistakes") —
      rescrise sa testeze comportamentul corectat; 4 din ele repurpozate ca
      teste directe „raspunsul gresit repetat nu avanseaza niciodata"
      (Categoria 6), fiindcă scenariul original (avans prin praguri de tip
      count in timp ce streak-ul mai mic concurează) a devenit structural
      inatins sub regula noua — pragul de „siguranță" pe count e in continuare
      viu in cod, dar calea realistă spre el trece acum prin recuperarea
      intensivă țintită, un rezultat mai bun. **33/33 teste verzi**, verificat
      live in browser (gresit ramane pe loc, corect avanseaza, zero erori
      consolă). Suita completă: 499 teste, 495 trec (4 pică, toate așteptate).
- [x] **LOTUL 3 COMPLET.** Toate 5 fișiere/motoare migrate, cele 9 intrări de
      meniu deblocate, verificate live, commis (vezi jurnal).

### Lotul 4 — cele cu subquizuri
- [ ] `js/quizzes/multiplication-1120-v2-modular.js` (1) — are test, **9 subquizuri**
- [ ] `js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js` (1) — are test, **3 subquizuri**
- [ ] `js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js` (1) — are test, **5 subquizuri** (aici se repară și `sq5`)
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

## Faza E — Pasul 2: subquizul dă CE, nu CUM

- [ ] `SubquizDefinition.define()` aruncă dacă definiția conține `onAnswer`
- [ ] Sufixul „NEFUNCȚIONAL" pus pe cele 3 quizuri cu subquizuri
- [ ] `multiplication-1120-v2-modular.js` — 9 subquizuri migrate, sufix scos
- [ ] `multiplication-1120-v3-train-eff-eq-forms.js` — 3 subquizuri migrate, sufix scos
- [ ] `multiplication-1120-v4-intensiv-multipli-234.js` — 5 subquizuri migrate, sufix scos
- [ ] Test-santinelă: `define({ onAnswer })` chiar aruncă
- [ ] **OPRIRE** — raportat

## Faza F — verificare finală

- [ ] Niciun titlu din meniu nu mai conține „QUIZ NEFUNCTIONAL - IN REFACTORING"
- [ ] Titlurile sunt identice cu cele dinainte de lucrare
- [ ] Toate testele repo-ului verzi + `npm run check:docs` + `npm run check:encoding`
- [ ] Cele 11 criterii din §9 al planului, verificate unul câte unul
- [ ] **OPRIRE** — raport final

---

## Note / probleme întâlnite

- **18.08.2026** — La prima numărare, scopul a fost subestimat: un `grep` pe `js/quizzes/` ratează
  3 motoare de quiz din afara folderului (`js/eff-quiz/engine.js`, `js/conexe-table-quiz/engine.js`,
  `js/succesive-quiz/engine.js`), care alimentează **9** intrări de meniu prin fișiere-helper ce
  doar înregistrează și deleagă. Verifică numărul de intrări de meniu (25 cu tot cu `rigle-cl1`)
  înainte de Faza C.
- **18.08.2026** — Semnalat, verificat, ÎNCHIS, nu era scop nou: `recordAttempt`/`FactStore` din
  interiorul quizurilor (ex. `addition-table.js`) se cheamă la fiecare apăsare, nu o dată per tură
  — la prima vedere părea o gaură separată, care ar corupe statisticile de fluență din Vizualizare 3.
  Verificat: `motor-analiza.js` + `SPECIFICATIE.md` au deja mecanismul corect, dintr-o sesiune
  anterioară — `a_cata_apasare_pe_buton` (calculat în `falling-engine.js` din `roundSignature`
  neschimbat) + `grupeazaApasarilePeIntrebari` + `corect_din_prima` (strict din prima apăsare).
  Depinde de motorul comun de răspuns (Faza B-E din plan) să funcționeze peste tot — nu e o
  lucrare separată. Definiția completă e consemnată în `QUIZ-SPEC-SABLON.md` (de citit la orice
  lucru viitor pe un quiz/subquiz).
- **Teste preexistente picate, fără legătură cu lucrarea:** 3 teste din
  `tests/vizualizare3-tabel-fluenta.test.js` (sensibile la dată) picau deja la 18.08.2026,
  verificat prin `git stash`. Nu le confunda cu regresii de-ale tale.

*(se completează pe parcurs — orice caz care nu încape în contract, orice bug descoperit și
raportat separat, orice decizie luată de user pe parcurs)*
