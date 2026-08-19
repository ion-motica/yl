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

> **Pornești într-un chat nou? Citește doar acest bloc + „Scop, pe scurt" de mai jos — nu ai
> nevoie de restul fișierului decât dacă lucrezi direct pe Faza D (închisă) sau vrei istoricul
> exact al deciziilor. Planul complet e în `PLAN-motor-comun-raspuns.md`, dar NU trebuie recitit
> de la zero — tot ce contează practic e rezumat aici.**

**Faza:** D COMPLETĂ. **Faza E ÎN LUCRU** — pasul 1 (impunerea „CE nu CUM") gata; primul fișier
cu subquizuri reale migrat (`multiplication-1120-v3-train-eff-eq-forms.js`, 3/3 subquizuri).
Rămân `multiplication-1120-v2-modular.js` (9 subquizuri) și
`multiplication-1120-v4-intensiv-multipli-234.js` (5 subquizuri).
Commit-uri Faza D, în ordine: Lot 1 `f0ded97`, Lot 2 `7ed8cc1`, Lot 3 `5c08b54`, Lot 4 `38f8780`.
Faza E, pas 1: `15d8bdb`, `c7f0047`. Faza E, v3: `162530f`.
**Toate pushate pe `origin/master` — confirmat.**

**Faza E — v3 migrat (20.08.2026):** cele 3 subquizuri (`base`, `sq2EffVbs`, `sq2EffSbs`) din
`js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js` migrate de la `onAnswer` propriu
(fiecare construia câte un `Motor3Butoane` NOU la fiecare apăsare, prin `raspundeSubquiz`/
`creeazaM3BSubquiz`, șterse) la contractul declarativ (`esteCorect`/`actiuni`/`mesaje`) —
`subquiz-definition.js` construiește acum UN SINGUR M3B per activare de subquiz, nu unul pe
apăsare. Logica de rutare/numărare (declanșatoare spre SQ2, exit din SQ2 pe `sq2ExitMode`) mutată
neschimbată în `actiuni.dupaRaspunsCorect`; `dupaApasare` păstrează urmărirea `wrongFacts`.
Simplificare reală, nu doar mutare de cod: `roundViewFrom(runtime,{outcome:"step-correct",...})`
manual în fiecare ramură „continuă" a devenit inutil — cu `mesaje.corect` declarat o singură
dată, M3B construiește singur acel view la avansul automat.
**Bug real găsit, în afara scopului fișierului, reparat centralizat:** tiparul „un M3B nou la
fiecare apăsare" (folosit ad-hoc în toate cele 3 fișiere cu subquizuri, dinainte de Faza E) rupea
`turCorect` — `apasariInTur` (numărul de apăsări din tura curentă) trăia în closure-ul lui
`Motor3Butoane.creeaza()`, deci pornea mereu de la 0 la fiecare instanță nouă; o corectare (a doua
apăsare, după una greșită) apărea mereu ca „prima apăsare", deci `turCorect` era mereu egal cu
`corect`, nu cu adevărat „corect din prima". Migrarea (o singură instanță M3B per activare de
subquiz, nu per apăsare) repară asta ca efect direct, corect — nu era un bug de reparat separat,
dar consecința lui a scos la iveală un al doilea bug, real dar **neatins, în afara scopului**:
`setSq2Config` acceptă `exitCount` doar din `[3,4,5]` (ca panoul de control, `appendSq2ControlPanel`)
— un test folosea `exitCount:2`, respins silențios de validare, mascat până acum de bug-ul
`turCorect`. Testul a fost corectat (`exitCount:3` + o tură în plus, aceeași intenție de testare),
validarea `[3,4,5]` NU s-a atins (decizie de scop, nu de design — ține de panoul de control, nu de
răspuns/rutare).
**Fix centralizat, nu doar local:** fixul „șterge `view` la `pop`" (necesar ca `onResume` să nu fie
îngropat de view-ul automat al M3B), dinainte duplicat identic în `raspundeSubquiz` în toate cele 3
fișiere, mutat acum în `subquiz-definition.js` însuși (`onAnswer`) — orice subquiz viitor cu `pop`
îl primește gratuit, fără să-l reimplementeze. Test nou pentru asta:
„actiunea 'pop' vine fara view" în `subquiz-definition-faza-e-ce-nu-cum.test.js` (acum 8 teste).
Teste: `multiplication-1120-v3-train-eff-eq-forms.test.js` (20/20, 1 corectat ca mai sus),
`jurnal-intrebari.test.js` (8/8, integrare neatinsă). Suită completă: 506 teste, 433 trec, 73 pică
— exact `v2-modular` + `v4` (încă nemigrate) + 3 preexistente (`vizualizare3-tabel-fluenta`,
sensibile la dată). Verificat live în browser (tab curat): corect avansează, greșit rămâne pe loc
și înregistrează `wrongFacts`, push manual în SQ2 funcționează, 3 răspunsuri corecte ies din SQ2 și
revin corect la „Subquiz 1: baza" cu numărul de întrebări păstrat (2/12, nu resetat). Sufixul
„NEFUNCTIONAL" scos din `multiplication-1120-v3-train-eff-eq-forms-jurnal.js`. `index.html`:
`subquiz-definition.js` v4→v5, `multiplication-1120-v3-train-eff-eq-forms.js` v15→v16,
`-jurnal.js` v3→v4.

**Faza E, pasul 1 — impunerea „CE nu CUM" (19.08.2026, sesiune nouă):**
- `js/subquiz/subquiz-definition.js` rescris: `define()` aruncă dacă definiția conține `onAnswer`
  (verificare `definition.onAnswer !== undefined`, mesaj explicit cu numele subquiz-ului).
  `createRuntime` nu mai are cale generică proprie (fostele `defaultGrade`/`objectExitRule`/
  `blockWrongTransition`/`genericOnAnswer` — șterse) — construiește UN SINGUR
  `Motor3Butoane.creeaza(...)` per runtime (nu per apăsare, spre deosebire de tiparul ad-hoc din
  Lotul 4) și deleagă orice apăsare la `motor.laApasareButon(...)`. Câmpurile declarative noi ale
  unui subquiz: `esteCorect(item,index)`, `actiuni.{inainteDeAfisareaIntrebarii,
  dupaAfisareaIntrebarii, inainteDeApasare, dupaApasare, dupaRaspunsCorect}`, `mesaje.{corect,
  gresit}` — **numele lui M3B însuși**, nu un vocabular nou (contractul din
  `FAZA-A-inventar-contract.md` §2, cu `esteCorect`/`intrebareUrmatoare`/`laIntrebareRezolvata`,
  era marcat explicit „nu aprobat" la 18.08.2026 — M3B, construit ulterior în Faza B, a devenit
  DE FACTO acel contract, generalizat la orice quiz; Faza E doar branșează subquiz-definition.js
  la el, nu inventează un al doilea modul). `generator` (deja CE, neatins) rămâne calea prin care
  un subquiz produce itemul următor; intern e branșat la `intrebareUrmatoare` al lui M3B.
  Starea (`createState`) nu mai pre-seamănă câmpuri generice (`questionCount` etc.) — s-a verificat
  (grep) că niciunul dintre cele 3 fișiere reale nu depindea de auto-incrementarea veche (fiecare
  își ținea singur contoarele, în propriul `onAnswer`, cu nume coincidente, nu prin ea); subquizul
  își ține în continuare singur contoarele, acum din `actiuni.dupaRaspunsCorect`/`dupaApasare`.
  Mesajul implicit de greșit (`"${alesul} nu e bun. Mai incearca!"`) păstrat ca default în
  `mesajeImplicite`, ca niciun subquiz existent să nu-și schimbe textul dacă nu-l suprascrie.
- **Descoperire importantă:** calea generică veche (folosită cand un subquiz NU definea `onAnswer`)
  era ea însăși neconformă — pe răspuns greșit, dacă `wrongAnswerRule?.mode !== "retrySame"`,
  cădea prin la `nextItem()`+`action:"continue"`, adică **avansa pe greșit by default**. Era cod
  mort (toate cele 3 fișiere reale definesc azi `onAnswer`, deci calea asta nu rula niciodată în
  producție), dar ar fi devenit calea UNICĂ, vie, sub gate-ul nou — trebuia reparată, nu doar
  păzită. Rescrierea de mai sus o repară prin construcție (M3B nu are nicio cale de avans pe
  greșit, hardcodat, fără parametru de bypass — spre deosebire de vechiul `blockWrongTransition`,
  care păstra mereu o portiță `allowOnWrong`/`allowTransitionOnWrong`; portița a fost eliminată
  complet, nu doar nefolosită).
- Sufixul „NEFUNCTIONAL" pus pe cele 3 quizuri cu subquizuri (singurii consumatori azi ai
  `SubquizOrchestrator`): `multiplication-1120-v2-modular.js`,
  `multiplication-1120-v3-train-eff-eq-forms-jurnal.js`, `multiplication-1120-v4-intensiv-
  multipli-234.js`. `index.html` — 4 cache-bust bumps (`subquiz-definition.js` v3→v4, cele 3
  fișiere de quiz +1 fiecare).
- Test-santinelă nou: `tests/subquiz-definition-faza-e-ce-nu-cum.test.js`, 7 teste — gate-ul chiar
  aruncă (direct din `define()` ȘI din `SubquizOrchestrator.create()`), un subquiz fără `onAnswer`
  rămâne pe loc la greșit (5 încercări la rând, fără limită) și avansează la corect, `esteCorect`
  implicit face comparație numerică (ca vechiul `defaultGrade`), `actiuni.dupaRaspunsCorect` poate
  cere rutare (push/pop/exit), mesajul implicit de greșit e neschimbat. Toate 7 verzi.
- Verificat live în browser (`youlearn-verify`): cele 3 quizuri apar sufixate în meniu; selectarea
  oricăruia aruncă imediat eroarea așteptată (la construcția orchestratorului, nu abia la prima
  apăsare — mai devreme decât gate-ul din Faza C, care arunca la `onAnswer`); un quiz nemodificat
  (`addition-table.js`, „Tabla adunarii - Clasic") funcționează normal, inclusiv un răspuns corect
  care avansează întrebarea. Zero erori neașteptate în consolă.
- Suita completă: 505 teste, 406 trec, 99 pică — **exact** cele așteptate: 96 = toate testele din
  cele 3 fișiere + `jurnal-intrebari.test.js` (integrare cu v3, cade odată cu el) care ating un
  subquiz cu `onAnswer` propriu, + 3 preexistente (`vizualizare3-tabel-fluenta.test.js`, sensibile
  la dată, neafectate). Zero eșecuri neașteptate în afara acestui set — verificat explicit
  (`grep` pe fișierele din stack traces).
- **NEATINS încă, deliberat:** cele 17 subquizuri reale (migrarea lor, §5 pas 3 din plan — următorul
  pas, cu OPRIRE după FIECARE fișier, nu după tot lotul) și §12 (al doilea gard: orice quiz —
  inclusiv cele 15 „simple" de azi — trebuie construit prin `SubquizOrchestrator`, cu minim o
  bucată „bază"). Ordinea aleasă pentru ce urmează: întâi cele 3 fișiere reale (deja sufixate,
  deja sparte — la fel ca Faza C→D), abia apoi §12 (fără fereastră de spargere: se învelesc cele
  15 quizuri simple ÎNTÂI, verificat că nu li se schimbă comportamentul, gate-ul „trebuie construit
  prin orchestrator" se pune ABIA la final, când nimic nu mai are ce sparge).
**Modulul:** `js/motor-3-butoane.js` — „Motor 3 butoane" (M3B), numele dat de user.
**Autorizare 18.08.2026, noapte:** userul a cerut explicit sa continui fara sa astept confirmare
la fiecare OPRIRE, "conform planului" — comit si implementez in continuare autonom. Autorizarea
e in vigoare, neschimbata; reconfirmată explicit 19.08.2026 („continua aplicarea planului").
**Aplicația:** funcțională, cu excepția celor 3 quizuri cu subquizuri (sufixate „NEFUNCTIONAL",
intenționat — vezi mai sus).
**Ultima actualizare:** 19.08.2026, sesiune Faza E

### De ce s-a oprit sesiunea anterioară exact aici

Autorizarea din 18.08.2026 („continuă fără să aștepți input, e noapte") era generală, pe tot
planul — nu doar pe Faza D. Sesiunea anterioară a ales totuși să se oprească la finalul Fazei D
(nu în mijlocul Fazei E), din judecată proprie, pe motivele astea:

1. **Faza D era un punct de oprire complet și sigur**: toate cele 18 fișiere migrate, testate,
   verificate live, commise, pushate — nimic pe jumătate făcut, aplicația 100% funcțională.
2. **Faza E e calitativ diferită, nu doar „mai mult din același lucru"**: atinge fișierele
   PARTAJATE `subquiz-definition.js`/`subquiz-orchestrator.js` (neatinse deliberat în toată
   Faza D) și extinde scopul la toate cele 15 quizuri azi „simple" (niciodată atinse de vreun
   mecanism de subquiz) — o rază de acțiune calitativ mai largă decât orice s-a făcut până acum.
3. **Planul însuși tratează Faza E mai atent**: granularitatea lui de OPRIRE e „după fiecare
   fișier", nu „după fiecare lot" ca la Faza D — semn că autorul planului (tot userul, într-o
   sesiune anterioară) o considera mai delicată.
4. **Asimetria riscului la o întrerupere**: o Fază D neterminată tot ar lăsa restul aplicației
   funcțional (fișierele nemigrate rămân „NEFUNCȚIONAL" vizibil, nu ascuns). O Fază E întreruptă
   la mijloc ar putea lăsa fișiere re-suffixate „NEFUNCȚIONAL" fără să apuce să fie reparate la
   loc, dacă sesiunea s-ar întrerupe înainte de capăt — un risc care nu exista la Faza D.

**Nu e o respingere a autorizării** — dacă utilizatorul confirmă (sau dacă instrucțiunea din
chat-ul nou repetă „continuă autonom, fără să aștepți") poți relua direct Faza E, în aceeași
manieră riguroasă (test întâi, migrare, verificare live, commit/push per fișier — respectând
granularitatea proprie a Fazei E, adică raportează/oprește-te după FIECARE fișier, nu după tot
lotul de 3, dacă nu ai o autorizare explicită și pentru asta).

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
| 19.08.2026 | Faza D, Lot 3 | 5 fișiere/motoare migrate, 9 intrări de meniu deblocate (`succesive-quiz/engine.js`, `conexe-table-quiz/engine.js` ×4, `eff-quiz/engine.js` ×4, `pre-equations-eff-navigation.js`, `multiplication-1120-v2.js`). Cel mai mare volum de corecții de comportament din tot refactorul, concentrat în `multiplication-1120-v2.js` (6 subquiz-uri interne, comentariul sursă spunea explicit „greșelile sunt ignorate" la modul intensiv — corectat, fără excepție). Suita existentă a acelui fișier avea 10 teste care testau bug-urile ca feature, rescrise. 499 teste, 495 trec (4 picate, toate așteptate: 3 preexistente + 1 title pentru `multiplication-1120-v2-modular`, Lotul 4). Verificat live în browser. Commit `5c08b54`, push confirmat. | **complet** |
| 19.08.2026 | Faza D, Lot 4 | Ultimele 3 fișiere cu subquizuri reale migrate: `multiplication-1120-v2-modular.js` (9 subquizuri — toate 9 aveau bug ascuns, nu doar cele 3 marcate în inventar; gasit si reparat bug real de „pop fără view"), `multiplication-1120-v3-train-eff-eq-forms.js` (3 subquizuri, toate Categoria 2, exact ca prezis în inventar), `multiplication-1120-v4-intensiv-multipli-234.js` (5 subquizuri — **fișierul bug-ului ORIGINAL**: `sq5FluentParty` reparat definitiv, Categoria 5 de la `sq3FactorGroup` — plasa de siguranță de 5 încercări — ELIMINATĂ complet, plus un `allowOnWrong` prost-folosit descoperit la `baseDefinition`, ratat de inventarul din Faza A). **Faza D COMPLETĂ — toate 18 fișiere migrate, zero titluri NEFUNCTIONAL rămase.** 498 teste, 495 trec (3 pică, toate preexistente). Verificat live în browser, inclusiv 8 răspunsuri greșite la rând în sq3 (peste fostul plafon de 5) rămânând pe aceeași întrebare cu butoane complet funcționale. | **complet** |
| 20.08.2026 | Faza E, v3 | 3/3 subquizuri migrate din `multiplication-1120-v3-train-eff-eq-forms.js` (`base`, `sq2EffVbs`, `sq2EffSbs`) la contractul declarativ, `onAnswer`/`raspundeSubquiz`/`creeazaM3BSubquiz` șterse din fișier. Găsit și reparat: tiparul vechi „M3B nou la fiecare apăsare" rupea `turCorect` (o corectare arăta mereu ca „prima apăsare"); reparat ca efect direct al migrării (o instanță M3B per activare, nu per apăsare) — a scos la iveală un al doilea bug, separat, în afara scopului (`setSq2Config` respinge `exitCount:2`, doar `[3,4,5]` acceptate ca panoul de control) — testul corectat să folosească o valoare validă, validarea neatinsă. Fix „pop fără view" centralizat în `subquiz-definition.js` (dinainte duplicat local în cele 3 fișiere), cu test nou dedicat. Suita fișierului: 20/20 (1 test corectat). `jurnal-intrebari.test.js`: 8/8, neatins. Suită completă: 506 teste, 433 trec, 73 pică (exact v2-modular+v4 nemigrate + 3 preexistente). Verificat live în tab curat: corect avansează, greșit rămâne și înregistrează `wrongFacts`, push/pop SQ2 funcționează cu numărul de întrebări păstrat la revenire. Sufix scos, commit în lucru. | **complet** |
| 19.08.2026 | Faza E, pas 1 | `subquiz-definition.js` rescris: `onAnswer` interzis structural (aruncă), calea generică deleagă integral la Motor3Butoane (un `esteCorect`/`actiuni`/`mesaje` per runtime). Cele 3 quizuri cu subquizuri sufixate „NEFUNCTIONAL". Descoperit și reparat un bug latent (cod mort, nu rula în producție): calea generică veche avansa pe răspuns greșit by default cand `wrongAnswerRule` nu era „retrySame". 7 teste noi (`subquiz-definition-faza-e-ce-nu-cum.test.js`), toate verzi. Suită completă: 505 teste, 406 trec, 99 pică (96 așteptate — cele 3 fișiere + jurnal-intrebari — + 3 preexistente, nimic neașteptat). Verificat live: sufix vizibil, eroare la selectarea oricăruia din cele 3, quiz nemodificat funcționează normal. | **pas 1 complet** |

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
- [x] `js/quizzes/multiplication-1120-v2-modular.js` (1) — migrat, **9 subquizuri**.
      Inainte de migrare am recitit atent inventarul din Faza A si am gasit ca
      TOATE cele 9 (nu doar cele 3 marcate „Cat 2/3" in inventar) aveau o forma
      de bug: fie ignorau corectitudinea complet (modurile intensive), fie
      verificau pragul de iesire ÎNAINTE de verificarea corect/gresit — asa ca
      un raspuns GRESIT putea el insusi declansa exit/push (`anchors`,
      `rapidAnchorAdditions`, `effectiveAnchorAddition`, `nonAnchorProducts`,
      `domainProducts`, toate „Cat 1" in inventarul original, aveau de fapt
      acest bug ascuns). Toate 9 corectate. Fiecare subquiz primeste propria
      instanta M3B (creata la fiecare apasare — niciun hook nu are nevoie de
      `apasariInTur` persistent); `def.onAnswer(event)` intoarce rezultatul
      COMPLET al lui M3B (nu doar `.view`), fiindca subquiz-definition.js
      asteapta o comanda `{action,view}`, nu o vedere plata.
      **Bug real gasit la testare, nu doar teoretic**: orchestratorul trateaza
      `command.view ?? resumed.view` la „pop" ca alternative EXCLUSIVE, nu ca
      straturi — dar M3B construieste mereu un `view` (chiar minimal), asa ca
      `command.view` castiga mereu, ingropand vederea completa produsa de
      `onResume` (promptul disparea complet la revenirea din modul intensiv).
      Reparat: `view`-ul se sterge explicit cand actiunea finala e „pop"
      (niciun „pop" din acest fisier nu avea `view` propriu inainte de
      migrare — pastreaza contractul exact). `advanceLevel` (declansata de
      semnalul `routeComplete` al orchestratorului, in AFARA oricarei instante
      M3B) isi pune singura semnatura. Suita existenta (775 linii, 43 teste):
      33/43 verzi din prima incercare; 7 teste rescrise (aceleasi tipare Cat.6
      ca la fisierul-sora `multiplication-1120-v2.js`: praguri numarate pe
      apasari brute -> corectate la raspunsuri rezolvate, 3 repurpozate ca
      teste „gresit nu avanseaza niciodata"); 3 teste (bug-ul de „pop") au
      trecut abia dupa reparatie. **43/43 teste verzi**, verificat live in
      browser inclusiv tranzitia push→intensiv→pop (promptul revine corect,
      nu ramane gol), zero erori consola. Suita completa: 499 teste, 496 trec
      (3 pica, toate preexistente, sensibile la data — ZERO title-uri ramase).
- [x] `js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js` (1, prin
      wrapper-ul `-jurnal.js`) — migrat, **3 subquizuri** (`base`, `sq2EffVbs`,
      `sq2EffSbs`). Confirmat exact ce spunea inventarul: TOATE 3 erau
      Categoria 2 (avansau necondiționat, `runtime.nextItem()` apelat
      indiferent de corect/gresit) — singurul fisier din tot refactorul cu
      100% din continut afectat vizibil. Corectat, fara exceptie. Are din nou
      capcana „pop fara view" gasita la fisierul-sora modular — acelasi
      `raspundeSubquiz` cu stergerea explicita a `view`-ului la „pop".
      **Descoperire utila**: switch-ul preexistent `sq2ExitMode` („correct" vs
      „any") se mapeaza exact pe `turCorect` din M3B — „correct" numara doar
      turele rezolvate DIN PRIMA incercare, „any" numara orice tura rezolvata
      (cu sau fara reincercari) — o distinctie care nu avea sens curat inainte
      de migrare (gresitul sarea la alta intrebare). Suita existenta (427
      linii, 19 teste): 18/19 verzi din prima incercare; 1 test rescris (testa
      explicit bug-ul „any conteaza apasari gresite" ca feature) + 1 test nou
      adaugat pt. distinctia „correct" vs „any". **20/20 teste verzi**, plus
      suita `jurnal-intrebari.test.js` (8 teste, verifica INTEGRAREA cu
      jurnalul de intrebari) verde neschimbata. Verificat live in browser
      inclusiv tranzitia push→SQ2→pop (promptul revine corect), zero erori
      consola. Suita completa: 500 teste, 497 trec (3 pica, toate preexistente).
- [x] `js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js` (1) — migrat,
      **5 subquizuri** (`base`, `sq3FactorGroup`, `sq2EffVbs`, `sq2EffSbs`,
      `sq5FluentParty`). **Fișierul unde a trăit bug-ul ORIGINAL** care a pornit
      tot refactorul (eticheta reparată deja, la începutul lucrării — commit
      inițial din această sesiune — dar politica de avans NU). Cel mai mare
      fișier din tot refactorul (2387 linii).
      - **`sq5FluentParty`**: bug-ul ORIGINAL propriu-zis — `outcome` rămânea
        "step-correct" chiar pe răspuns greșit (cu `answerRevealed:true` ca
        să ascundă desincronizarea), fiindcă design-ul spunea explicit "sq5
        numără turns corecte sau nu, nu cere reușită" (§3.4 din planul vechi
        al lui sq5). Corectat, fără excepție: greșit rămâne pe aceeași
        pereche, `turnsByKey`/`formsUsedByKey` numără doar la rezolvare.
      - **`sq3FactorGroup`**: **Categoria 5 ELIMINATĂ complet** — plasa de
        siguranță (`SQ3_EXIT_MAX_ATTEMPTS=5`, avans forțat după 5 încercări
        indiferent de corectitudine) era encoding-ul exact al lucrului pe care
        userul l-a respins ferm chiar la începutul acestei sesiuni. O dată
        eliminată, `attemptsByB` a devenit redundant cu `correctCountsByB` —
        șters, cu tot cu constanta. Politica "once" (facte deja fluente,
        netestate în sesiune) însemna "o încercare, corectă sau greșită" —
        acum "un singur răspuns CORECT e suficient".
      - **`baseDefinition`**: descoperire la recitire atentă — folosea
        `allowOnWrong:true` (mecanism din subquiz-definition.js) ca să lase
        declanșatoarele ("2 facte greșite", "la fiecare a 5-a întrebare",
        finalul de nivel) să treacă CHIAR pe răspunsul greșit care le
        declanșa — însemnând că o apăsare greșită putea ea însăși schimba
        întrebarea afișată (push în sq3, sau chiar avans de nivel). Inventarul
        din Faza A îl clasificase "Categoria 1, deja conform" — clasificare
        incompletă, ratase exact interacțiunea asta. Corectat: toate
        declanșatoarele mutate în `dupaRaspunsCorect`, `allowOnWrong` devine
        inutil și e scos peste tot din fișier.
      - **`sq2EffVbs`/`sq2EffSbs`**: aceeași Categorie 2 ca la v3 (`handleIntensiveAnswer`
        partajată, `runtime.nextItem()` necondiționat) — corectată identic,
        cu `turCorect` din M3B pentru distincția `sq2ExitMode` „correct" vs „any".
      Suita existentă (971 linii, 30 teste) avea 7 teste care testau EXPLICIT
      mecanismele eliminate ca feature (titluri ca „criteriul 6b: plasa de
      siguranță", „... allowOnWrow"") — rescrise sau (cazul plasei de
      siguranță) înlocuite cu un test direct „nu forțează avansul niciodată".
      **28/28 teste verzi**. Verificat live în browser: **8 răspunsuri greșite
      la rând în sq3 (mai multe decât fostul plafon de 5) — întrebarea rămâne
      exact aceeași, butoanele rămân complet funcționale (nu „griuiite", exact
      simptomul din raportul inițial de bug)**, zero erori consolă. Suita
      completă: 498 teste, 495 trec (3 pică, toate preexistente, sensibile la
      dată) — **ZERO title-uri „NEFUNCTIONAL" rămase în tot repo-ul**.
- [x] **LOTUL 4 COMPLET. FAZA D COMPLETĂ — toate cele 18 fișiere migrate.**
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

## Faza E — Pasul 2: subquizul dă CE, nu CUM

- [x] `SubquizDefinition.define()` aruncă dacă definiția conține `onAnswer` — 19.08.2026,
      `js/subquiz/subquiz-definition.js` rescris integral (vezi „Stare curentă" pt. detalii:
      calea generică nouă deleagă la Motor3Butoane, un singur `esteCorect`/`actiuni`/`mesaje`
      per runtime, nu per apăsare)
- [x] Sufixul „NEFUNCȚIONAL" pus pe cele 3 quizuri cu subquizuri — 19.08.2026
- [ ] `multiplication-1120-v2-modular.js` — 9 subquizuri migrate, sufix scos
- [x] `multiplication-1120-v3-train-eff-eq-forms.js` — 3/3 subquizuri migrate, sufix scos —
      20.08.2026 (vezi „Stare curentă" pt. detalii: bug real de `turCorect` reparat ca efect
      direct al migrării, fix „pop fără view" centralizat în `subquiz-definition.js`)
- [ ] `multiplication-1120-v4-intensiv-multipli-234.js` — 5 subquizuri migrate, sufix scos
- [x] Test-santinelă: `define({ onAnswer })` chiar aruncă — 19.08.2026,
      `tests/subquiz-definition-faza-e-ce-nu-cum.test.js` (7 teste, toate verzi; include și
      `SubquizOrchestrator.create()` cu o definiție cu `onAnswer`, nu doar `define()` direct)
- [ ] §12: al doilea gard — orice quiz (inclusiv cele 15 „simple" de azi) construit prin
      `SubquizOrchestrator`, minim o bucată „bază"; NEÎNCEPUT, planificat DUPĂ migrarea celor
      17 subquizuri reali (vezi „Stare curentă" pt. ordinea aleasă și motivul)
- [ ] **OPRIRE** — raportat (acest punct: pasul 1 complet, gata de pasul 3 — migrarea per fișier)

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
