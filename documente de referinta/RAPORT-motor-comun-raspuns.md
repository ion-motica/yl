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

**Faza:** D COMPLETĂ. **Faza E COMPLETĂ** — pașii 1-3 (toate cele 17 subquizuri reale, 9 în
v2-modular, 3 în v3, 5 în v4, migrate la contractul declarativ „CE nu CUM") ȘI §12 (învelirea celor
15 fișiere „simple" + gardul). **Faza F COMPLETĂ (20.08.2026) — toate cele 11 criterii din §9 al
planului verificate riguros, unul câte unul; PLANUL ÎNTREG E ÎNCHEIAT.** Vezi „Ultima actualizare"
de mai jos pentru raportul complet al Fazei F, criteriu cu criteriu.

> **⚠ 21.08.2026 — gărzile au scos la iveală 3 bug-uri reale (una singură raportată de user),
> reparate printr-o corecție arhitecturală în orchestrator. Commit: `da4447b`. Vezi „Bug-uri de
> tranziție de rutare (21.08.2026)" de mai jos.** Pe scurt: rezultatele de la *tranzițiile de
> rutare* (avans de nivel, revenire din sq3) ieșeau din quiz fără marcaje, gărzile aruncau, iar
> `applyAnswerResult` nu mai rula — ecranul rămânea pe întrebarea veche cu butoanele active
> („întrebare-fantomă din subtabla veche", raportat de user la v4). Reparat mutând finalul de rută
> ÎN orchestrator (`onRouteComplete`) și propagând semnătura M3B într-un singur loc, la intrarea în
> `handle` (acoperă și recursia — a treia cauză, găsită abia la verificarea live).
> **Verificarea Fazei F, criteriul 3, a fost prea superficială: un singur răspuns per quiz, fără
> să ajungă vreodată la o schimbare de nivel — de-aia n-a prins nimic.**

**§12, detaliile învelirii (20.08.2026)** — toate cele 15 fișiere „simple" din checklist învelite în
`SubquizOrchestrator`: `equations-e3-e6.js`, `addition-table.js`, `addition-table-range.js`,
`prime-divisors.js`, `sub-sau-langa-radical.js`, `bagare-sub-radical.js`,
`addition-table-singapore.js`, `addition-table-singapore-missing.js`,
`division-with-remainder.js`, `prime-divisions.js`, `succesive-quiz/engine.js`,
`conexe-table-quiz/engine.js` (4 intrări meniu), `eff-quiz/engine.js` (4 intrări meniu),
`pre-equations-eff-navigation.js`, `multiplication-1120-v2.js` (cel mai mare/complex —
1411 linii, 6 „subquiz"-uri interne informale pe `stage`/`mode`, 9 situri de sincronizare) —
**PLUS al doilea gard (enforcement), impus în `falling-engine.js`, verificat empiric pe toate
cele 24 de intrări reale de meniu.** Sesiune, 20.08.2026 seara: userul a autorizat continuarea
autonomă prin toată lista, fără oprire, apoi a autorizat explicit și gardul separat („continuă și
cu gardul acum") — vezi „Autorizare activă" mai jos, secțiunea „Tranziție de sesiune". Sesiunea a
fost întreruptă o dată de o limită de utilizare (după `addition-table-singapore-missing.js`) și
reluată cu „continuă de unde ai rămas" — fără pierdere de lucru. **Zero decizii reale de design de
raportat la învelire — vezi secțiunea „Decizii amânate" de la finalul acestui fișier.**
Commit-uri Faza D, în ordine: Lot 1 `f0ded97`, Lot 2 `7ed8cc1`, Lot 3 `5c08b54`, Lot 4 `38f8780`.
Faza E, pas 1: `15d8bdb`, `c7f0047`. Faza E, v3: `162530f`. Faza E, v2-modular: `d70c544`.
Faza E, v4: `7a0f012`. Faza E, §12: `848b871`, `7b0cf98`, `1d1c50d`, `7e1db3b`, `e6c762c`,
`33ade82` (sub-sau-langa-radical.js), `62012bd` (bagare-sub-radical.js), `66cc595`
(addition-table-singapore.js), `f4d67bd` (addition-table-singapore-missing.js), `3ebbbf6`
(division-with-remainder.js), `99b33bf` (prime-divisions.js), `6c66f2a`
(succesive-quiz/engine.js), `b44f4d2` (conexe-table-quiz/engine.js), `eb809b2`
(eff-quiz/engine.js), `25f0b7b` (pre-equations-eff-navigation.js), `b3235b2`
(multiplication-1120-v2.js), `0384779` (al doilea gard, falling-engine.js — ULTIMUL commit §12).
**Toate pushate pe `origin/master` — confirmat.**

**Faza E, §12 — equations-e3-e6.js învelit (20.08.2026), PRIMUL quiz „simplu":** o singură bucată
„bază" (`push`/`pop`/`exit` nu se folosesc — nu e nevoie, exact ca în plan). `esteCorect`/`actiuni`
copiate identic din vechea configurație M3B directă (citesc `current` din closure-ul quiz-ului, nu
din itemul dat de motor — neschimbat).
**Capcană structurală reală, generală pentru toate cele 15 quizuri „simple", găsită și rezolvată:**
tiparul stabilit deja în toate (`beginRound`/`pickNextRound` gestionează întrebarea curentă direct,
fără să treacă prin motor) intră în conflict cu auto-pornirea leneșă a orchestratorului — dacă
`onAnswer` e primul lucru care atinge orchestratorul, `SubquizOrchestrator.onAnswer` tratează acel
apel ca „pornește și arată prima întrebare", NU ca „procesează apăsarea" — ar regenera o întrebare
NOUĂ (prin `generator`) și ar arunca la gunoi apăsarea reală a userului. **Rezolvare (simplificată
20.08.2026, după observația userului că prima variantă era complicată inutil — vezi jurnal),
reutilizabilă la toate cele 14 rămase:** orchestratorul e pornit O SINGURĂ DATĂ, la construirea
quiz-ului, cu un `generator` complet gol (nu se mai cheamă niciodată după aia — `dupaRaspunsCorect`
întoarce mereu o comandă explicită, niciodată `undefined`); de-acolo încolo, `sincronizeazaOrchestratorul()`
e UN SINGUR apel necondiționat (`orchestrator.getCurrentRuntime().setCurrentItem(...)`), chemat
ori de câte ori întrebarea curentă se schimbă. Fără ramificație „e pornit sau nu", fără
`current ?? pickNewQuestion()` — inutile, dat fiind că `generator`-ul gol nu se mai atinge oricum.
**A doua capcană, mai subtilă, găsită prin verificare directă (nu de suita existentă):** vederea
de „răspuns greșit" o construiește acum motorul comun (`construiesteVedere` = `view()` din
subquiz-definition.js), NU `roundView()` proprie a quiz-ului ca înainte — îi lipsea
`successionHistory` (panoul de sumar din arenă). Corectat: `actiuni.dupaApasare` (rulează la
FIECARE apăsare, corectă sau nu) întoarce explicit `{successionHistory: ...}`, recalculat la
fiecare apăsare — pe ramura corectă e oricum suprascris de `roundView()` completă din
`dupaRaspunsCorect`, fără conflict.
**Verificat cu script dedicat (nu doar suita existentă):** prima apăsare nu e înghițită (grading
corect chiar de la prima apăsare), greșit rămâne + `successionHistory` prezent, corect avansează,
run-complete/avans de nivel funcționează, continuarea DUPĂ run-complete funcționează (verificat că
`falling-engine.js` NU retrimite `nextRound`-ul trunchiat prin `beginRound` — `??` scurtcircuitează
acea ramură când `nextRound` e deja prezent, ceea ce e mereu cazul la acest fișier), schimbarea de
nivel (`switchLevel`+`beginRound(pickNextRound())`) funcționează. **Notă, verificată, NU e bug
introdus, NU s-a atins:** `beginRound(next)` cu un `next` trunchiat (din `roundView()`, fără
câmpul `correct`) ar corupe grading-ul ulterior (`current.correct` ar deveni `undefined`) — dar
acest apel EXACT nu se întâmplă niciodată în aplicația reală pentru acest fișier (verificat în
`falling-engine.js`); comportamentul e identic, needitat, cu codul dinainte de migrare.
Teste: `equations-e3-e6.test.js` — 11/11 verzi (2 teste extinse să încarce
`subquiz/item-generator.js`+`subquiz-definition.js`+`subquiz-orchestrator.js`, la fel ca toate
celelalte suite din Faza E). Suită completă: 506 teste, 503 trec, 3 pică — exact cele 3
preexistente. Verificat live în browser: greșit rămâne, corect avansează, zero erori consolă.
`index.html`: `equations-e3-e6.js` v6→v7.

**Faza E, §12 — addition-table.js învelit (20.08.2026), al 2-lea quiz „simplu":** același tipar
simplu (pornire o singură dată, sincronizare necondiționată). O capcană specifică acestui fișier:
`options` proprii sunt NUMERE, dar motorul comun normalizează la STRING-uri — `isResolvedCombo`
compară strict (`===`) cu un număr, deci `ctx.alesul` (string-ul normalizat) ar fi picat mereu
tăcut. Corectat: citește `options[ctx.index]` (numărul original din closure), nu `ctx.alesul`,
peste tot. Găsit și `divisionHistory`/`prompt` lipsă pe vederea de răspuns greșit (aceeași formă
de gol ca `successionHistory` la equations-e3-e6) — corectate la fel. Teste: 7/7 verzi. Suită
completă: 506, 503 trec, 3 pică (preexistente). Verificat cu script dedicat + live. `index.html`:
`addition-table.js` v1→v2.

**Faza E, §12 — sub-sau-langa-radical.js învelit (20.08.2026), al 5-lea quiz „simplu", PRIMA
diferență structurală reală față de tipar:** spre deosebire de primele 4 fișiere, aici
`dupaRaspunsCorect` avea o ramură (fără avans de nivel) care întorcea `{}` — fără `action`. Sub
M3B-ul folosit DIRECT (dinainte de înveliire), asta cădea pe calea implicită a lui M3B
(`config.intrebareUrmatoare`), care alegea singură întrebarea următoare. Sub orchestrator, calea
implicită e generatorul GOL al definiției (cerut de tipar, nu se mai cheamă niciodată) — ar fi
produs un item gol în loc de o întrebare reală, o rupere vizibilă. Reparat făcând explicit ce se
întâmpla implicit înainte: ramura fără avans cheamă acum `pickNewQuestion()` chiar în
`dupaRaspunsCorect` și întoarce `{action:"continue", view: roundView()}` — comportament identic,
doar explicit în loc de implicit (exact cerința deja stabilită a tiparului: „`dupaRaspunsCorect`
intoarce mereu o comandă explicită, niciodată `undefined`"). Confirmată din pre-analiza sesiunii
anterioare: acest fișier NU are capcana `options[ctx.index]` vs `ctx.alesul` (niciun hook nu
citește `ctx.alesul`, ambele acțiuni ignoră parametrul `item`/`ctx` sau citesc direct din closure).
**A doua particularitate:** fișierul folosește `promptHtml` (conținut HTML real, cu radicali/exponenți),
spre deosebire de `addition-table*`/`prime-divisors.js` (unde `prompt` era text simplu) —
`sincronizeazaOrchestratorul()` transportă acum și acel câmp, altfel vederea de răspuns greșit ar
fi arătat un `promptHtml` absent (deși `prompt` conținea deja HTML-ul, `promptHtml` separat lipsea
din orchestrator dacă nu era transportat explicit). **Plasarea sincronizării:** spre deosebire de
celelalte 4 (o singură funcție „beginXRound" e locul unic de mutație), aici `current` se schimbă
din 3 locuri diferite (`beginRound`, `advanceLevel` prin `pickNewQuestion()`, și ramura nouă din
`dupaRaspunsCorect` tot prin `pickNewQuestion()`) — sincronizarea a fost centralizată chiar în
`pickNewQuestion()` (singurul loc care produce efectiv o întrebare NOUĂ), plus un apel explicit
suplimentar în `beginRound` (redundant în calea reală, dar necesar pt. testele care cheamă
`beginRound()` fără argument — cale activ exercitată, nu doar teoretică, spre deosebire de bug-ul
#2 documentat la `equations-e3-e6.js`). **Verificat live în browser, exact scenariul de risc**
(nu presupus): un răspuns greșit imediat DUPĂ un avans de nivel arată corect întrebarea NOUĂ (de
la nivelul nou), nu una învechită — testat programatic direct pe instanța înregistrată real în
pagină (`QuizRegistry.get(...).create(...)`, cu scriptul real încărcat din `index.html`, nu doar
izolat în Node), zero erori consolă. Teste: 11/11 din prima încercare (adăugat
`item-generator.js`/`subquiz-definition.js`/`subquiz-orchestrator.js` la încărcare, ca la
`equations-e3-e6.test.js`). Suită completă: 506, 503 trec, 3 pică (preexistente). `index.html`:
`sub-sau-langa-radical.js` v1→v2. Commit `33ade82`, push confirmat.

**Faza E — v4 migrat (20.08.2026), ULTIMUL fișier cu subquizuri reale:** toate 5 subquizuri din
`js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js` (`base`, `sq3FactorGroup`,
`sq2EffVbs`, `sq2EffSbs`, `sq5FluentParty` — **fișierul bug-ului ORIGINAL**) migrate identic ca la
celelalte două. `sq2EffVbs`/`sq2EffSbs` foloseau `turCorect` (ca la v3) — migrarea le repară la
fel, dar practic sunt cod mort azi (nu se mai declanșează automat, decizie user 29.07.2026), deci
fără efect observabil pe nicio rută reală. **Găsit din nou, verificat explicit, corectat pe loc**
(nu o corecție nouă — aceeași capcană structurală identificată deja la v2-modular): `sq5Definition`
avea o ramură de `exit` fără `view` propriu (finalul unei sesiuni sq5 în mod B, `entryMode!=="push"`)
— în ruta implicită (`sq5Entry="levelStart"`, valoarea din `readChoiceSetting`), sq5 e PRIMUL
subquiz din rută, nu ultimul, deci un mesaj implicit ar fi supraviețuit pe prima întrebare din
„base". Corectat cu `view:{message:undefined}` explicit, verificat cu script dedicat (nu doar
suita existentă) — confirmat `undefined`, fără scurgere.
Teste: `multiplication-1120-v4-intensiv-multipli-234.test.js` — **28/28 verzi din prima încercare**
(nimic rescris), inclusiv testul de regresie exact pe bug-ul original („raspunsul gresit in sq5
ramane pe aceeasi intrebare"). Suită completă: 506 teste, 503 trec, 3 pică — **exact cele 3
preexistente** (`vizualizare3-tabel-fluenta`, sensibile la dată) — **zero eșecuri legate de
lucrarea asta, pentru prima dată din Faza C încoace**. Verificat live în browser: greșit rămâne +
`wrongFacts`, corect avansează, zero erori consolă. Sufixul „NEFUNCTIONAL" scos — acesta a fost
ultimul. `index.html`: `multiplication-1120-v4-intensiv-multipli-234.js` v8→v9.
**Cu asta, pașii 1-3 din §5 (plan) sunt COMPLEȚI — toate cele 17 subquizuri reale, în toate cele
3 fișiere, trec prin contractul declarativ „CE nu CUM". Rămâne doar §12.**

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

**Faza E — v2-modular migrat (20.08.2026):** toate 9 subquizuri din
`js/quizzes/multiplication-1120-v2-modular.js` (`anchors`, `intensiv`, `anchorSumValues`,
`rapidAnchorAdditions`, `effectiveAnchorAddition`, `effectiveAnchorAdditionIntensive`,
`nonAnchorProducts`, `nonAnchorProductsIntensive`, `domainProducts`) migrate identic ca la v3 —
`raspundeSubquiz`/`creeazaM3BSubquiz` șterse, contract declarativ (`esteCorect`/`actiuni`/
`mesaje`). **Spre deosebire de v3, niciun hook nu folosea `turCorect`/`numarApasare`** (verificat
prin grep înainte de migrare) — deci bug-ul „M3B nou per apăsare" nu avea efect observabil aici;
migrarea a fost o mutare mai curat mecanică, fără corecție de comportament ascunsă.
**Capcană găsită și evitată, specifică arhitecturii noi (nu un bug, o constrângere structurală):**
`actiuni.*` nu au acces la `runtime` (spre deosebire de vechiul `onAnswer(event)`, care primea
`event.runtime` proaspăt la fiecare apăsare) — deci un hook nu mai poate apela `runtime.nextItem()`
manual. Asta înseamnă că mesajul „Corect!" implicit (`mesaje.corect`, evaluat de M3B DUPĂ ce
`dupaRaspunsCorect` a mutat deja starea) e SINGURA cale de a arăta un mesaj custom pe avansul
automat în interiorul aceluiași subquiz — dar `mesaje.corect` se aplică UNIFORM și pe ramurile de
`exit`/`push` care nu au `view` propriu, ceea ce vechiul cod NU făcea (mesajul rămânea `undefined`
acolo). Verificat explicit, ramură cu ramură, care `exit`-uri fără `view` propriu sunt urmate, în
ruta „normal", de un ALT subquiz (deci mesajul ar fi rămas vizibil pe prima lui întrebare) — găsit
un singur caz real (`anchorSumValues` → `rapidAnchorAdditions`); corectat cu
`view:{message:undefined}` explicit pe acea ramură (`intensiv`-ul standalone are aceeași formă dar
e dovedit inert — ruta lui e mereu ultima/singura, deci mesajul e oricum aruncat de `advanceLevel`
— i-am pus totuși aceeași gardă, cost zero). Pentru `domainProducts`, mesajul de tranziție
(„Domeniul urmator: X") era construit manual, o singură dată, exact la schimbarea de domeniu —
recreat ca `mesaje.corect` DINAMIC, care detectează tranziția verificând `currentDomainCount===0`
(proaspăt resetat de `enterNextProductDomain`, chemat de `dupaRaspunsCorect`) — singurul semnal
disponibil unui hook fără acces la „ce fel de tranziție tocmai s-a întâmplat".
**Verificat cu un script dedicat (nu doar suita existentă)**, exact aceste 2 puncte delicate:
mesajul NU se scurge din `anchorSumValues` în `rapidAnchorAdditions` (`undefined`, confirmat) și
tranziția de domeniu arată "Domeniul urmator: 11-15" EXACT la a 15-a întrebare corectă din primul
domeniu, apoi „Corect!" revine normal — toate corecte, fără nicio corecție necesară după prima
scriere (spre deosebire de v3, unde testarea a scos la iveală bug-ul `turCorect`).
Teste: `multiplication-1120-v2-modular.test.js` — **43/43 verzi din prima încercare** (nimic
rescris). Suită completă: 506 teste, 476 trec, 30 pică — exact `v4` (încă nemigrat) + 3
preexistente. Verificat live în browser: greșit rămâne și înregistrează `wrongFacts`, corect
avansează, zero erori consolă. Sufixul „NEFUNCTIONAL" scos. `index.html`:
`multiplication-1120-v2-modular.js` v9→v10.

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
**Aplicația:** complet funcțională — zero sufixe „NEFUNCTIONAL" rămase (ultimul scos la migrarea
v4, 20.08.2026). Migrările/învelirile de până acum au inclus și corecții de bug intenționate,
documentate individual (Faza D Lot 1/2, Faza E v3/v4) — nu doar mutări mecanice.
**Ultima actualizare:** 20.08.2026 seara — **PLANUL ÎNTREG E COMPLET, inclusiv Faza F.** Userul a
cerut „Faza F acum" imediat după finalizarea §12. Toate cele 11 criterii din §9 al planului
verificate riguros, unul câte unul, cu comenzi concrete (grep, git diff față de commit-ul
pre-refactor `4fc4722`, rulări de teste) — nu din memorie. Rezultat: **10/11 confirmate integral,
1 discrepanță reală semnalată explicit**:

1. **Invariant testat pt. toate cele 24 de intrări** — CONFIRMAT. Verificat nume exacte de teste
   (nu doar regex aproximativ) pt. toate cele 18 fișiere sursă: fiecare are cel puțin un test
   „răspuns greșit rămâne pe aceeași întrebare" ȘI un test „răspuns corect avansează" (ex.
   `sub-sau-langa-radical`: „wrong answers keep the same question..." + „...advances through
   advanced levels..."; `multiplication-1120-v3`: „wrong never advances or inflates the count").
2. **Zero implementări proprii de `onAnswer`** — CONFIRMAT. `grep` peste `js/` arată toate cele 18
   fișiere delegând direct la `orchestrator.onAnswer(...)` (unele prin `handleOrchestratorResult`,
   verificat că doar reacționează la semnalul de rutare `subquizEvent.routeComplete`, nu la
   grading). Singura excepție: `rigle-cl1.js` are un `onAnswer() {}` gol — stub mort pt. „apeluri
   neguardate din HUD", niciodată chemat (motor propriu m2, separat de `falling-engine.js`).
3. **Impunere reală, la ambele niveluri** — CONFIRMAT. Motor: 2 gărzi în `falling-engine.js`
   (Motor3Butoane + SubquizOrchestrator), fiecare cu test dedicat care demonstrează crash pe calea
   veche. `SubquizDefinition.define()`: 8/8 teste verzi, inclusiv „define({onAnswer}) chiar arunca"
   și „SubquizOrchestrator.create respinge la construire o definiție cu onAnswer".
4. **Subquizurile dau doar CE** — CONFIRMAT (aceleași teste ca pct. 3). Toate cele 32 de bucăți
   (17 subquizuri reale + 15 bucăți „bază" din §12) funcționează exclusiv prin
   `generator`+`initialState`+date declarative.
5. **Plasa de siguranță „supraviețuiește ca dată"** — **NU, discrepanță reală față de textul
   literal al planului.** `grep` confirmă: `SQ3_EXIT_MAX_ATTEMPTS` nu mai există sub nicio formă,
   nicăieri — a fost **eliminată complet**, nu transformată în date. Aceasta a fost o decizie
   explicită a userului, luată în **Faza A** (aprobarea planului, 18.08.2026), documentată în
   jurnal: „mecanism de avans forțat fără răspuns corect ('plasa de siguranță') — găsit într-un
   singur loc (sq3), eliminat complet din contract, nicăieri nu există limită de încercări."
   Planul original (§9) nu a fost rescris să reflecte această decizie ulterioară — rezultatul
   final e de fapt **mai strict** decât cerea criteriul inițial (fără limită deloc, nu doar
   „limită păstrată ca date"), dar literal, criteriul 5 așa cum e scris azi în plan e fals.
6. **Cele 4 sloturi de animație funcționează** — CONFIRMAT. `promptHoldMs`/`continueStep`/
   `runDelayMs` active și citite de `falling-engine.js`, folosite azi în 11 fișiere de quiz
   (numărul exact 7/11 din plan era o fotografie la 18.08.2026, dinaintea restructurării — mecanismul
   însuși, verificat, funcționează peste tot unde e nevoie).
7. **Bug-ul din §1 nu se mai poate exprima** — CONFIRMAT. `grep` pe `outcome:"wrong-answer"` scris
   de mână găsește un singur caz real, în `conexe-table-quiz/engine.js` (`onStepWrong`, folosită
   azi DOAR de `onTimeout`) — dar rezultatul ei e mereu suprascris de `outcome:"timeout"` explicit
   înainte de a ajunge la `falling-engine.js`, deci bug-ul exact din §1 (stare avansată + etichetă
   „wrong-answer" simultan) rămâne structural imposibil.
8. **Zero titluri „NEFUNCTIONAL", identice cu cele dinainte** — CONFIRMAT. `grep -r NEFUNCTIONAL
   js/` → zero. Comparație completă, prin `git diff`, a tuturor titlurilor de meniu între
   `4fc4722` (ultimul commit înainte de Faza A) și starea curentă — identice (singura diferență
   aparentă, investigată, era un artefact al metodologiei de comparație — un fișier `.md` de
   documentație inclus accidental în setul vechi, nu o schimbare reală).
9. **Non-regresie** — CONFIRMAT. 507 teste, 504 trec, 3 pică — confirmate riguros preexistente:
   `tests/vizualizare3-tabel-fluenta.test.js` nu a fost atins din 10.08.2026 (8 zile înainte de
   începerea lucrării), teste sensibile la dată curentă. `check:docs`/`check:encoding` curate.
10. **`rigle-cl1.js` neatins și funcțional** — CONFIRMAT riguros: `git diff 4fc4722 HEAD --
    js/quizzes/rigle-cl1.js` → 0 linii, fișier byte-identic cu starea dinaintea refactorului
    întreg. Verificat funcțional live (construiește, `beginRound()` funcționează).
11. **Raportul reflectă realitatea** — acest bloc, scris acum, e chiar dovada.

**Toate cele 11 fișiere §12 din această sesiune + gardul, deja pushate — nimic nou de commis
pentru Faza F în sine (a fost verificare pură, fără modificări de cod).**

**Ultima actualizare anterioară (păstrată mai jos, pentru context):** 20.08.2026 seara — **§12
COMPLET, inclusiv gardul.** După ce toate cele 15
fișiere au fost învelite, userul a cerut explicit continuarea cu gardul propriu-zis („continuă și
cu gardul acum"). Implementat `valideazaConstructiaPrinSubquizOrchestrator` în
`falling-engine.js`, mirror exact al gardului Motor3Butoane din Faza C — verifică
`rezultat.subquizEvent` (semnătura pusă de `decorate()` în `subquiz-orchestrator.js`). Găsite și
reparate 2 teste preexistente care simulau quiz-uri prin M3B direct, fără orchestrator (compatibile
cu gardul VECHI, nu cu cel nou): `falling-engine-impune-motor-3-butoane.test.js` (al doilea test
rescris să treacă prin orchestrator, plus un test nou care confirmă că M3B fără orchestrator acum
arunca) și `falling-engine-jurnal-timing.test.js` (actualizat similar — a scos la iveală, pe drum,
o capcană reală: un generator CU efect secundar e chemat de `orchestrator.startFirst()` chiar la
pornire, nu doar la prima corectare — confirmă din nou de ce tiparul „generator gol +
dupaRaspunsCorect explicit", deja stabilit în toate cele 15 fișiere, e cel corect). Verificat
empiric, exhaustiv: toate cele 24 de intrări reale de meniu (25 cu `rigle-cl1`, exclus corect)
trec gardul fără nicio eroare — script dedicat în browser, plus un click real pe interfață. Suită
completă: 507 teste, 504 trec, 3 pică (exact preexistentele). **§12 este acum 100% complet — nimic
rămas de făcut din checklist-ul acestei secțiuni.** **Notă de proces observată o dată, la
`prime-divisions.js`, neafectând restul:** suita completă a arătat o dată 4 eșecuri (nu 3) —
`tests/equations-e3-e6.test.js` ("avoids visible common known numbers on both sides") a picat o
singură dată, apoi a trecut curat la rulările următoare — test probabilistic fără seed determinist,
flakiness preexistentă, nu regresie.

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

### Tranziție de sesiune, 20.08.2026 — motiv: context plin, NU oprire din decizie proprie

Spre deosebire de tranziția de mai sus (Faza D→E, alegere proprie a sesiunii anterioare), asta e o
tranziție cerută de user explicit („scrie un raport... sa trecem in alt chat", contextul curent
era pe cale să se umple), în mijlocul §12, cu lucru neterminat. **Nicio decizie de oprire nu s-a
luat** — sesiunea nouă trebuie să continue direct, conform autorizării de mai jos.

**Autorizare activă, dată chiar înainte de această tranziție (20.08.2026), mai largă decât cea din
18.08.2026 — citat exact, ca să nu se piardă nuanța:** „continua si implementeaza restul de
quizuri fara input de la mine - daca apar decizii de luat notezi, treci mai departe si mi le
prezitni la final. acum plec de la pc. deci continui pana finalizezi toate quizurile si daca sunt
decizii de luat le amanm pana la sfarsitul listei."

**Ce înseamnă concret pentru sesiunea nouă:**
- Continuă direct §12 — cele 11 quizuri/motoare rămase din checklist-ul de mai jos, în ordinea
  deja stabilită — **fără să te oprești să întrebi**, cu același nivel de rigoare aplicat la
  primele 4 (static check, teste actualizate, `node --test` per fișier + suită completă, verificare
  live în browser, `npm run check:encoding`, cache-bust în `index.html`, commit+push per fișier,
  actualizare RAPORT).
- Dacă apare o **decizie reală de design** (nu doar „aplică tiparul deja validat"; o alegere unde
  ar fi fost rezonabil și altfel) — nu întreba, alege varianta cea mai conservatoare (păstrează
  comportamentul existent exact, nu redesena), **notează alegerea** în secțiunea nouă
  „## Decizii amânate — de prezentat userului la final" (la finalul acestui fișier), și mergi mai
  departe. NU se prezintă userului pe parcurs — DOAR după ce toate cele 11 sunt gata.
- Autorizarea acoperă STRICT învelirea celor 11 fișiere rămase din §12. NU acoperă gardul propriu-zis
  (ultimul bullet needit din §12 — enforcement-ul „orice quiz trebuie construit prin orchestrator")
  și nu acoperă nimic din Faza F — alea rămân puncte de oprire/raportare separate, ca-nainte.
- NU se ating cele 2 bug-uri din „Bug-uri găsite, NEreparate" și nici nota din „De adresat după
  finalizarea planului curent" — rămân deliberat deferate, cu context deja complet acolo.

**Pasul următor — NU MAI EXISTĂ.** §12 e 100% complet (învelire + gard) ȘI Faza F e COMPLETĂ
(20.08.2026, cerută explicit de user imediat după §12) — vezi blocul dedicat de la începutul
secțiunii „Stare curentă" pentru raportul complet, criteriu cu criteriu. **Planul întreg
(`PLAN-motor-comun-raspuns.md`) e încheiat.**

**Toate cele 15 fișiere din §12 — REZOLVATE (20.08.2026):** `equations-e3-e6.js`,
`addition-table.js`, `addition-table-range.js`, `prime-divisors.js`, `sub-sau-langa-radical.js`,
`bagare-sub-radical.js`, `addition-table-singapore.js`, `addition-table-singapore-missing.js`,
`division-with-remainder.js`, `prime-divisions.js`, `succesive-quiz/engine.js`,
`conexe-table-quiz/engine.js`, `eff-quiz/engine.js`, `pre-equations-eff-navigation.js`,
`multiplication-1120-v2.js` — vezi paragrafele dedicate din jurnal/„Stare curentă" de mai sus pt.
detalii pe fiecare.

**Reguli de proces care rămân valabile, neschimbate** (nu le re-derivezi, sunt deja stabilite):
regula din `CLAUDE.md` — caută documentul zonei înainte de modificare (niciunul din cele 11
fișiere rămase nu are document de referință dedicat în tabel, deci explorare standard, ca la
primele 4); orice raport/commit despre un quiz specific numește ÎNTOTDEAUNA și fișierul `.js` ȘI
titlul exact din meniu (regulă memorată separat, în sistemul de memorie Claude — se aplică automat).

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
| 21.08.2026 | Post-plan — bug-uri de tranziție de rutare | User a raportat la v4: „final de nivel, apare alert de schimbare de nivel, apoi mai apare o întrebare tot din subtabla veche". Investigat (Sonnet 5), apoi re-analizat la cererea userului (Opus 5), care a corectat diagnosticul: **două** bug-uri, de vârste diferite, cu același simptom. Reparate arhitectural, nu prin petice: finalul de rută mutat ÎN orchestrator (`onRouteComplete`), semnătura M3B propagată într-un SINGUR loc (intrarea în `handle`, ca să acopere și recursia). Cele 3 quizuri cu rute reale au scăpat de `handleOrchestratorResult` și de auto-semnare. **A treia gaură, găsită abia la verificarea live** (recursia prin `onResume`) — dovadă că verificarea în browser prinde ce nu prinde Node. Test nou: `tests/orchestrator-marcaje-pe-orice-raspuns.test.js` (5 teste; verificat că pică 4/5 pe codul vechi). Suită: 520, 517 trec, 3 pică (preexistentele). Verificat live: 3 schimbări de nivel, 137 pași, zero erori, zero întrebări-fantomă. | **complet** |
| 18.08.2026 | — | Plan scris (Opus 5), pus pe GitHub. Nicio modificare de cod. | plan gata |
| 18.08.2026 | — | Plan corectat: scop extins (3 motoare din afara `js/quizzes/`, ratate la prima numărare) + ordine schimbată (impunerea ÎNAINTE de migrare, decizia userului). | plan gata |
| 18.08.2026 | Faza A | Citire completă (18 fișiere + 17 subquizuri), contract propus, apoi corectat de user de mai multe ori: mecanism de avans forțat fără răspuns corect ("plasa de siguranță") — găsit într-un singur loc (sq3), eliminat complet din contract, nicăieri nu există limită de încercări. Clarificat: „răspuns corect" la nivel de tură = doar prima apăsare, apăsările ulterioare sunt corectare, nu re-evaluare (deja consemnat, corect, în jurnalul/Vizualizare 3 existent — verificat, nu era gaură nouă). Decizie nouă de scop: orice quiz trece prin `SubquizOrchestrator`, minim o bucată — vezi §12 din plan. Faza A aprobată. | **complet** |
| 18.08.2026 | Faza B | Scris `js/motor-3-butoane.js` (M3B) + `tests/motor-3-butoane.test.js` (15 teste, toate verzi). Numele și vocabularul motoarelor (mr/mq/msq/ML/M3B) date de user. Nimic altceva neatins: niciun quiz nu-l folosește încă, nu e încărcat în `index.html`. Suita completă: 423 teste, 420 trec (3 picate preexistente, sensibile la dată). | **scris, așteaptă verificare** |
| 18.08.2026 | Faza C | User a autorizat explicit continuarea autonomă, fără OPRIRI, "e noapte". `falling-engine.js` impune semnătura M3B (aruncă altfel); toate cele 24 de quizuri sufixate „NEFUNCTIONAL" în meniu; `rigle-cl1` verificat neafectat (static + test + live); test-santinelă nou. Reparat pe drum: un test preexistent (`falling-engine-jurnal-timing.test.js`) folosea un quiz simulat pe vechea cale — actualizat sa treaca prin M3B, nu relaxat. 7 teste noi picate, așteptate (title-uri sufixate), documentate mai jos — se rezolvă singure la migrare. Verificat live în browser: eroarea chiar apare la apăsare pe quiz nemigrat. | **complet** |
| 18.08.2026 | Faza D, Lot 1 | 5 fișiere migrate (`addition-table`, `addition-table-range`, `prime-divisors`, `sub-sau-langa-radical`, `bagare-sub-radical`). Corecție de comportament intenționată la `bagare-sub-radical` (Categoria 4+6). Commit `f0ded97`, push confirmat. | **complet** |
| 19.08.2026 | Faza D, Lot 2 | 5 fișiere migrate (`addition-table-singapore`, `addition-table-singapore-missing`, `division-with-remainder`, `prime-divisions`, `equations-e3-e6`). Corecție de comportament intenționată la `division-with-remainder` (Categoria 4+6, ca la `bagare-sub-radical`). Primele fișiere cu `promptHoldMs`+`continueStep` proprii — confirmat că trec neatinse prin M3B. Verificat live în browser pentru toate 5, zero erori consolă. 483 teste, 475 trec (8 picate, toate așteptate: 3 preexistente + 5 title-uri pentru fișiere încă nemigrate din Loturile 3-4). Commit `7ed8cc1`, push confirmat. | **complet** |
| 19.08.2026 | Faza D, Lot 3 | 5 fișiere/motoare migrate, 9 intrări de meniu deblocate (`succesive-quiz/engine.js`, `conexe-table-quiz/engine.js` ×4, `eff-quiz/engine.js` ×4, `pre-equations-eff-navigation.js`, `multiplication-1120-v2.js`). Cel mai mare volum de corecții de comportament din tot refactorul, concentrat în `multiplication-1120-v2.js` (6 subquiz-uri interne, comentariul sursă spunea explicit „greșelile sunt ignorate" la modul intensiv — corectat, fără excepție). Suita existentă a acelui fișier avea 10 teste care testau bug-urile ca feature, rescrise. 499 teste, 495 trec (4 picate, toate așteptate: 3 preexistente + 1 title pentru `multiplication-1120-v2-modular`, Lotul 4). Verificat live în browser. Commit `5c08b54`, push confirmat. | **complet** |
| 19.08.2026 | Faza D, Lot 4 | Ultimele 3 fișiere cu subquizuri reale migrate: `multiplication-1120-v2-modular.js` (9 subquizuri — toate 9 aveau bug ascuns, nu doar cele 3 marcate în inventar; gasit si reparat bug real de „pop fără view"), `multiplication-1120-v3-train-eff-eq-forms.js` (3 subquizuri, toate Categoria 2, exact ca prezis în inventar), `multiplication-1120-v4-intensiv-multipli-234.js` (5 subquizuri — **fișierul bug-ului ORIGINAL**: `sq5FluentParty` reparat definitiv, Categoria 5 de la `sq3FactorGroup` — plasa de siguranță de 5 încercări — ELIMINATĂ complet, plus un `allowOnWrong` prost-folosit descoperit la `baseDefinition`, ratat de inventarul din Faza A). **Faza D COMPLETĂ — toate 18 fișiere migrate, zero titluri NEFUNCTIONAL rămase.** 498 teste, 495 trec (3 pică, toate preexistente). Verificat live în browser, inclusiv 8 răspunsuri greșite la rând în sq3 (peste fostul plafon de 5) rămânând pe aceeași întrebare cu butoane complet funcționale. | **complet** |
| 20.08.2026 | Faza E, §12, equations-e3-e6 | PRIMUL quiz „simplu" învelit în `SubquizOrchestrator` (o singură bucată „bază"). Găsită și rezolvată o capcană structurală generală, reutilizabilă la toate cele 14 rămase: tiparul `beginRound`/`pickNextRound` (gestionează întrebarea direct, fără motor) intră în conflict cu auto-pornirea leneșă a orchestratorului — ar înghiți prima apăsare, regenerând o întrebare nouă în loc s-o proceseze. Rezolvat cu `generator()` care întoarce `current` deja existent (nu regenerează, nu consumă o extragere aleatoare în plus) + `sincronizeazaOrchestratorul()` care pornește/sincronizează explicit. A doua capcană, mai subtilă: vederea de răspuns greșit construită de motor nu avea `successionHistory` (panoul de sumar) — reparat prin `dupaApasare`. Verificat cu script dedicat: prima apăsare procesată corect, greșit+successionHistory, corect avansează, run-complete/nivel funcționează, schimbare de nivel funcționează. Teste: 11/11. Suită completă: 506 teste, 503 trec, 3 pică (exact preexistentele). Verificat live în browser. | **complet** |
| 20.08.2026 | Faza E, §12, addition-table | Al 2-lea quiz simplu învelit. Capcană specifică: `options` proprii sunt numere, motorul normalizează la string-uri — `isResolvedCombo` compară strict cu un număr, ar fi picat tăcut. Corectat: `options[ctx.index]` în loc de `ctx.alesul`. Găsit și `divisionHistory`/`prompt` lipsă pe răspuns greșit, corectate. **Corecție de proces, la cererea userului**: mecanismul de pornire al orchestratorului simplificat la ambele fișiere deja învelite — orchestrator pornit o dată la construcție, `generator` gol, sincronizare printr-un singur apel necondiționat (fără ramificația „e pornit sau nu" din prima variantă, inutilă). Teste: 7/7. Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat cu script + live. | **complet** |
| 20.08.2026 | Faza E, §12, addition-table-range | Al 3-lea (și, pentru moment, ultimul cerut) quiz simplu învelit — clonă structurală a `addition-table.js`, exact același tipar simplificat aplicat direct, fără explorare suplimentară. 6/6 teste din prima încercare. Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat live. | **complet** |
| 20.08.2026 | Faza E, §12, sub-sau-langa-radical | Al 5-lea quiz simplu învelit — prima diferență structurală reală față de tipar: ramura fără avans de nivel din `dupaRaspunsCorect` întorcea `{}` (fără `action`), ceea ce sub orchestrator ar fi lovit generatorul gol (item gol în loc de întrebare reală). Reparat explicit: cheamă `pickNewQuestion()` și întoarce `{action:"continue", view: roundView()}`. Confirmat: fără capcana `options[ctx.index]`/`ctx.alesul` (niciun hook nu o atinge). Sincronizare centralizată în `pickNewQuestion()` (3 puncte de mutație, spre deosebire de un singur „beginXRound" la fișierele anterioare) + apel explicit redundant în `beginRound` (cale activ exercitată de teste, nu doar teoretică). Verificat live exact scenariul de risc (răspuns greșit imediat după avans de nivel arată întrebarea nouă, nu una învechită), programatic pe instanța reală înregistrată în pagină, zero erori consolă. Teste: 11/11. Suită completă: 506, 503 trec, 3 pică (preexistente). Commit `33ade82`, push confirmat. | **complet** |
| 20.08.2026 | Post-Faza F, cele 2 bug-uri | Userul a cerut explicit rezolvarea ambelor bug-uri documentate ca „NEreparate". **Bug 1** (`setSq2Config` respinge tăcut `exitCount` invalid): fix ales — varianta (c), cea mai conservatoare (nimic nu se schimbă comportamental, doar valoarea returnată devine cinstită: `{ok, rejected}` în loc de `true` necondiționat) — aplicat UNIFORM la toate cele 7 câmpuri ale funcției (nu doar `exitCount`, ca să nu rămână API-ul pe jumătate mincinos), identic în `v3` și `v4`. **Bug 2** (`beginRound(next)` cu obiect trunchiat ar corupe grading-ul, `equations-e3-e6.js`): fix ales — varianta (b), verificare defensivă `typeof next?.correct === "number"` (NU doar `!== undefined`, cum sugera propunerea inițială — ar fi trecut fals-pozitiv pe `correct:true`, boolean-ul de outcome M3B, omniprezent în rezultate; coliziune de nume găsită la implementare, motiv suplimentar față de „mai simplu" pentru a evita varianta (a)). 8 teste noi (2 equations-e3-e6, 4 v3, 2 v4), toate verzi din prima încercare, plus verificare live cu scripturile reale, ambele bug-uri confirmate reparate, zero erori consolă. Suită completă: 515 teste, 512 trec, 3 pică (preexistente). Commit `65c1c6b`, push confirmat. **Secțiunea „Bug-uri găsite" din acest raport — ambele intrări rezolvate, nimic rămas deschis.** | **complet** |
| 20.08.2026 | Post-Faza F, RUN_DONE_MS | Userul a cerut, imediat după raportul Fazei F, eliminarea pauzei fixe de 450ms de la finalul unui „run-complete" fără avans de nivel (item 1 din „De adresat după finalizarea planului curent"). `RUN_DONE_MS` schimbat din `450` în `0` în `falling-engine.js` — un singur punct de impact în tot repo-ul, `LEVEL_ADV_MS` (avansul de nivel, 1400ms) neatins deliberat, alt scop. Verificare live: prima metodă de măsurare (polling pe `document.body.textContent`) a fost defectă, a produs timpi falși de ordinul secundelor — corectată citind direct elementul izolat `#top-number` și calculând singur indexul corect prin divizibilitate (nu presupus). Rezultat, pe `prime-divisors.js`: 0ms măsurat la fiecare din 8 tranziții consecutive, inclusiv finalizări de lanț fără avans de nivel — exact scenariul reclamat inițial de user. Suită completă: 507, 504 trec, 3 pică (preexistente, neafectate). Zero erori consolă. Commit `755db08`, push confirmat. | **complet** |
| 20.08.2026 | Faza F, verificare finală | Cerută explicit de user imediat după §12 („Faza F acum"). Toate cele 11 criterii din §9 al planului verificate riguros, unul câte unul, cu comenzi concrete (nu din memorie): grep pe tot `js/` pentru `onAnswer` propriu (zero, toate deleagă la orchestrator) și pentru `outcome:"wrong-answer"` scris de mână (un singur caz, cod mort — rezultatul mereu suprascris la timeout); `git diff` complet față de `4fc4722` (ultimul commit dinaintea Fazei A) pentru titluri de meniu (identice) și pentru `rigle-cl1.js` (0 linii diferență, byte-identic); rulare completă a suitei (507 teste, 504 trec, 3 pică, confirmate preexistente prin `git log` — fișierul de test neatins din 10.08.2026); `check:docs`/`check:encoding` curate. **Un singur criteriu (5, plasa de siguranță „ca dată") nu se potrivește literal cu planul** — a fost ELIMINATĂ complet, nu tabelizată, printr-o decizie explicită a userului din Faza A, deja documentată — semnalat clar, nu ascuns. Nicio modificare de cod în această fază — verificare pură. **PLANUL ÎNTREG E COMPLET.** | **complet** |
| 20.08.2026 | Faza E, §12, gardul al doilea | Enforcement-ul propriu-zis, autorizat separat de user („continuă și cu gardul acum") — `valideazaConstructiaPrinSubquizOrchestrator` adăugată în `falling-engine.js`/`resolveChoice`, mirror exact al gardului Motor3Butoane din Faza C: verifică `rezultat.subquizEvent` (semnătura pusă de `decorate()` în `subquiz-orchestrator.js`), aruncă altfel cu mesaj explicit. Găsite și reparate 2 teste preexistente incompatibile cu noul gard (simulau quiz-uri prin M3B direct, fără orchestrator): `falling-engine-impune-motor-3-butoane.test.js` (al doilea test rescris să treacă prin orchestrator + test nou „M3B fără orchestrator acum aruncă") și `falling-engine-jurnal-timing.test.js` — la acesta din urmă, prima încercare de reparare (generator CU efect secundar, mutând starea) a picat cu o eroare de timing subtilă: `orchestrator.startFirst()` cheamă generatorul IMEDIAT, la pornire, nu doar la prima corectare — exact capcana pe care tiparul „generator gol + `dupaRaspunsCorect` explicit" (deja stabilit în toate cele 15 fișiere din §12) o evită prin construcție. Corectat aplicând același tipar, nu o variantă nouă. Verificat empiric, exhaustiv, în browser: toate cele 24 de intrări reale de meniu (25 cu `rigle-cl1`, exclus corect — motor propriu m2) trec gardul fără nicio eroare, plus un click real pe interfață. Suită completă: 507, 504 trec, 3 pică (preexistente). Commit `0384779`, push confirmat. **§12 100% COMPLET — învelire + gard.** | **complet** |
| 20.08.2026 | Faza E, §12, multiplication-1120-v2 | ULTIMUL fișier din §12 învelit — 1411 linii, cel mai mare din tot refactorul. Confirmat la citirea integrală: UN SINGUR M3B, cu `dupaApasare`/`dupaRaspunsCorect` ramificate intern pe `stage`/`mode` pentru cele 6 „subquiz"-uri informale (anchor/intensiv/anchorSumValues/rapidAnchorAdditions/effectiveAnchorAddition/nonAnchorProducts) — NU `SubquizOrchestrator` real cu push/pop (spre deosebire de fișierul-soră `multiplication-1120-v2-modular.js`, deja învelit în Faza E principală cu 9 subquiz-uri reale). Tiparul „o bucată bază" s-a aplicat direct, fără redesenare — `esteCorect`/`mesaje`/`actiuni` copiate identic din vechiul M3B. Diferență structurală reală: 9 situri separate de mutație a lui `current` (8 funcții `build*Question*`, una cu 2 ramuri) — fără un chokepoint unic, sincronizare adăugată la fiecare sit individual, nu centralizată. `roundView()` = exact vederea generică (fără câmpuri proprii) — doar `def.hintMessage`. `options` string-uri, `ctx.alesul` sigur. `dupaRaspunsCorect` întorcea deja mereu comandă explicită pe toate ramurile. Teste: 33/33 din prima încercare, inclusiv toate testele de regresie „CORECTAT" (Categoriile 3/4/6) pe toate cele 6 zone. Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat live end-to-end: lanțul complet de 5 tranziții de stage (anchor→subquiz3→4→5→6) parcurs în ordine reală prin `index.html`, plus răspuns greșit imediat după ultima tranziție (scenariul cel mai riscant) — prompt/opțiuni corecte, nu învechite. Zero erori consolă. Commit `b3235b2`, push confirmat. **§12 (învelirea) COMPLETĂ — toate cele 15 fișiere.** | **complet** |
| 20.08.2026 | Faza E, §12, pre-equations-eff-navigation | Al 14-lea fișier învelit — un singur `current` unificat (ca `sub-sau-langa-radical.js`), `buildQuestion()` singurul loc care îl schimbă, sincronizare centralizată acolo PLUS un apel explicit în `beginRound` (ramura `if(next)` nu trece prin `buildQuestion()`). `roundView()` are un singur câmp propriu (`successionHistory`, panou sumar cu 5 linii: Triunghi/Semn/Pas/Mod/Perfecte) — injectat prin `dupaApasare`, apelând `roundView().successionHistory` direct (evită duplicarea logicii de construcție a array-ului). `options` deja string-uri în ambele moduri (numeric/formulă) — `ctx.alesul` sigur de folosit. `dupaRaspunsCorect` întorcea deja mereu comandă explicită. Teste: 13/13 din prima încercare. Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat live: mesaj cu valoarea aleasă, `successionHistory` actualizat corect (Pas 1/3→2/3 la trecerea la pasul următor din triunghi), zero erori consolă. Commit `25f0b7b`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, eff-quiz/engine | Al 13-lea fișier învelit, deblochează 4 intrări de meniu (addition/subtraction/multiplication/division-eff-helper.js). Fisier-frate cu `conexe-table-quiz/engine.js`, dar cu o diferență de istorie: fosta `onStepWrong` fusese deja ȘTEARSĂ la Faza D (nu mai avea niciun apelant, nici `onTimeout`) — vederea de răspuns greșit era deja delegată integral lui M3B, prin `construiesteVedere:(extra)=>({...roundView(),...extra})`. Sub orchestrator, aceeași soluție ca la `conexe-table-quiz.js` se aplică identic: `dupaApasare` întoarce `roundView()` complet (are propriile `divisionHistory`/`bondHistory`/`questionFormat`/`successionHistory`, absente din vederea generică). `esteCorect` compară direct indexul (`index === correctIndex`), nu `options[index]` — formă și mai simplă, fără nicio ambiguitate de tip. `beginCurrentStep()` (în bucla `while`) e singurul loc care schimbă `currentFact`/`currentBuilt`/`options`/`correctIndex` — sincronizare centralizată acolo. Teste: 7/7 din prima încercare. Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat live pe toate 4 quiz-urile: mesaj cu valoarea aleasă, `successionHistory` actualizat corect pe corect, zero erori consolă. Commit `eb809b2`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, conexe-table-quiz/engine | Al 12-lea fișier învelit, deblochează 4 intrări de meniu (adunare/scădere/înmulțire/împărțire — 4 adaptoare separate). M3B era deja curat cuplat din Faza D: `dupaRaspunsCorect` cheamă direct `onStepCorrect(meta)` existentă, neschimbată, care produce fie un pas intermediar, fie un rezultat complet de bloc/nivel prin lanțul `completeCurrentBlock→finishBlock→advanceLevel`. Provocarea reală, diferită de toate fișierele anterioare: `roundView()` delegă la `adapter.buildRoundView`, cu câmpuri complet custom și CONDIȚIONATE de `conexeType` (`questionFormat`/`targetSum`/`bondKnownAddend`/`bondMissingSide` doar pt. tipurile „bond-*", altfel absente) — prea variabil ca să injectezi câmpuri punctuale ca la fișierele anterioare. Rezolvat structural: `dupaApasare` întoarce `roundView()` ÎNTREG (nu doar delta), exact ca vechiul `onStepWrong` (`...roundView()`) — valabil universal, pentru orice adaptor, fără cazuri speciale per tip. Sincronizare centralizată în `buildOptionsFor`, singurul loc care schimbă `options`/`correctIndex` (`currentFact`/`currentConexeType` deja actualizate înainte de a-l chema). Teste: 49/49 din prima încercare, pe toate cele 4 adaptoare (inclusiv testele explicite pe formatul „singapore-bond" vs. colon/star/minus). Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat live pe toate 4 quiz-urile ȘI explicit pe scenariul cel mai riscant (răspuns greșit pe un prompt „bond" — toate câmpurile custom, inclusiv `targetSum`/`bondKnownAddend`/`bondMissingSide`, rămân corecte), zero erori consolă. Commit `b44f4d2`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, succesive-quiz/engine | Al 11-lea învelit, PRIMUL motor din afara `js/quizzes/` (nu se autoînregistrează — consumat prin adapter de `addition-succesive-helper.js`). Pas intermediar real (serie de N pași în lanț). `options` deja STRING-uri — `ctx.alesul` sigur de folosit direct în mesajul de greșit ȘI în `recordAttempt`, fără capcana de tip întâlnită la `prime-divisions.js` (aceeași ca la NUMERE, dar aici STRING-urile erau deja identice cu ce normalizează motorul). Găsit și tratat, capcana `successionHistory` deja cunoscută de la `equations-e3-e6.js` (primul fișier migrat din §12): `roundView()` are `successionHistory`/`promptHtml` proprii, absente din vederea generică — injectate prin `dupaApasare`/`sincronizeazaOrchestratorul()`. `prepareStep()` e singurul loc care schimbă `currentStep`/`options`/`correctIndex` — sincronizare centralizată acolo, un singur loc, ca la `addition-table-singapore.js`. `dupaRaspunsCorect` întorcea deja mereu comandă explicită pe ambele ramuri — `intrebareUrmatoare` rămâne cod mort. Teste: 7/7 din prima încercare. Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat live: mesaj cu valoarea aleasă, `successionHistory` actualizat corect pe corect, zero erori consolă. Commit `6c66f2a`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, prime-divisions | Al 10-lea quiz simplu învelit — frate cu `prime-divisors.js` (deja migrat), pas intermediar real (lanț de împărțiri succesive) cu propria pauză `promptHoldMs`+`continueStep` la FIECARE pas (nu doar terminal, spre deosebire de `prime-divisors.js`). Capcană nouă, mai subtilă decât un mesaj: `options` sunt NUMERE, dar `ctx.alesul` era folosit ATÂT în mesajul dinamic de greșit CÂT ȘI în `buildMistakePayload` (stocat ca `combo.wrong`) — sub orchestrator, `ctx.alesul` ar fi devenit string (normalizare motor), iar `combo.wrong` (string) comparat mai târziu cu `!==` strict față de un NUMĂR (`correctQuotient`) în `buildStepFromCombo` ar fi picat mereu acea comparație, indiferent de valoare — corupere silențioasă a logicii de reluare a combo-urilor greșite, nu doar un mesaj afișat greșit. Reparat cu `options[ctx.index]` peste tot (mesaj + payload). Sincronizare la 2 situri explicite (`beginRound`, ramura intermediară din `dupaRaspunsCorect`), ca la `prime-divisors.js`. Teste: 6/6 din prima încercare, inclusiv lanțul complet de împărțiri. Suită completă: 506, 503 trec, 3 pică (preexistente) — o rulare izolată a arătat un al 4-lea eșec într-un fișier neatins (`equations-e3-e6.test.js`, test probabilistic fără seed, confirmat flaky prin 3 rulări izolate + o a doua rulare completă curată), nu regresie. Verificat live: wrong stă pe loc cu mesaj conținând valoarea NUMERICĂ aleasă corect, `divisionHistory` prezent, zero erori consolă. Commit `99b33bf`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, division-with-remainder | Al 9-lea quiz simplu învelit — structural identic cu `bagare-sub-radical.js` (`current` unificat, `pickNewQuestion()` PURĂ, sincronizare la fiecare din cele 3 situri de mutație: `advanceLevel`, ramura din `dupaRaspunsCorect`, `beginRound`), dar SPRE DEOSEBIRE de `bagare-sub-radical.js`, `dupaRaspunsCorect` întorcea deja mereu comandă explicită pe toate cele 3 ramuri (nu are capcana `{}`) — `intrebareUrmatoare` rămâne cod mort, ca la primele 4 fișiere. `mesaje.gresit` e o funcție STATICĂ (ignoră `ctx`), fără dependență de `ctx.alesul`. Verificat live: wrong stă pe loc, correct avansează, zero erori consolă — observat (needitat, preexistent, deja documentat în Lotul 2) că o opțiune arată literal „undefined" când `pickTraps` nu poate umple al doilea trap la `i=2`, needitat, în afara scopului. Teste: 8/8 din prima încercare. Suită completă: 506, 503 trec, 3 pică (preexistente). Commit `3ebbbf6`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, addition-table-singapore-missing | Al 8-lea quiz simplu învelit — fisier-frate structural identic cu `addition-table-singapore.js` (fresh migrat), + dimensiunea `missingSide`. Aceleași câmpuri proprii de injectat pe ramura de greșit, plus doi noi (`bondKnownAddend`, `bondMissingSide`, ambele derivate din `currentMissingSide`). Sincronizare centralizată în `buildOptionsForFact`, la fel. Teste: 8/8 din prima încercare. Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat live: mesaj dinamic cu valoarea aleasă, câmpuri proprii prezente pe greșit, bondHistory actualizat pe corect, zero erori consolă. Commit `f4d67bd`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, addition-table-singapore | Al 7-lea quiz simplu învelit — fără `current` unificat (`currentFact`+`options`+`correctIndex` separate, sincronizare centralizată în `buildOptionsForFact`, singurul loc care le schimbă). `dupaRaspunsCorect` întorcea deja mereu comandă explicită (ca la primele 4, nu ca la ultimele 2) — `intrebareUrmatoare` (`() => null`, deja neutralizată dinainte de lucrare) rămâne cod mort. Găsit și tratat: `roundView()` are câmpuri proprii (`questionFormat`, `targetSum`, `bondHistory`) absente din vederea generică — injectate prin `dupaApasare`, la fel ca `divisionHistory`/`successionHistory` la fișierele anterioare. Primul fișier cu mesaj dinamic real folosind `ctx.alesul` (nu doar `options[ctx.index]` din closure) — verificat live că valoarea aleasă apare corect în mesaj prin orchestrator. Teste: 8/8 din prima încercare, inclusiv scenariul de retry. Suită completă: 506, 503 trec, 3 pică (preexistente). Verificat live: mesaj dinamic corect, câmpuri proprii prezente pe greșit, bondHistory actualizat pe corect, zero erori consolă. Commit `66cc595`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, bagare-sub-radical | Al 6-lea quiz simplu învelit — aceeași capcană ca la `sub-sau-langa-radical.js` (ramura „caz normal" din `dupaRaspunsCorect` întorcea `{}`, bazându-se pe `intrebareUrmatoare` implicit al M3B — ștearsă, înlocuită cu comandă explicită). Diferență: aici `pickNewQuestion()` e o funcție PURĂ (nu se auto-mută pe `current`) — sincronizarea adăugată separat la fiecare din cele 4 situri unde codul face `current = pickNewQuestion()` (`advanceLevel`, 2 ramuri din `dupaRaspunsCorect`, `beginRound`), nu centralizată într-un singur loc ca la fișierul anterior. `esteCorect` fără capcana `options[ctx.index]`/`ctx.alesul` (confirmat, ca la fișierul anterior). Verificat live: wrong stă pe loc cu hint, correct din ramura normală avansează cu prompt nou, correct-cu-streak avansează faza — toate cu semnătura M3B prezentă, zero erori consolă. Teste: 8/8 din prima încercare. Suită completă: 506, 503 trec, 3 pică (preexistente). Commit `62012bd`, push confirmat. | **complet** |
| 20.08.2026 | Faza E, §12, prime-divisors | Al 4-lea quiz simplu învelit — primul cu pas intermediar real (lanț de împărțiri până la 1), `dupaRaspunsCorect` întoarce mereu comandă explicită și pe ramura intermediară, deci tiparul simplificat rămâne neschimbat. Aceeași capcană `options[ctx.index]` vs `ctx.alesul`. Diferență față de `addition-table*`: `divisionHistory` are conținut REAL (nu gol) — injectat prin `dupaApasare`, verificat live că lanțul 4→2→1 arată istoricul corect pe ecran. 6/6 teste din prima încercare, inclusiv testul dedicat pasului intermediar. Suită completă: 506, 503 trec, 3 pică (preexistente). | **complet** |
| 20.08.2026 | Faza E, v4 | ULTIMUL fișier cu subquizuri reale: toate 5 subquizuri migrate din `multiplication-1120-v4-intensiv-multipli-234.js` (fișierul bug-ului ORIGINAL) la contractul declarativ. `sq2EffVbs`/`sq2EffSbs` foloseau `turCorect` (ca v3) — reparate la fel, dar cod mort azi (nedeclanșate automat). Găsită și tratată aceeași capcană de „mesaj scurs" ca la v2-modular, de data asta la `sq5Definition` (exit spre "base" în mod B/levelStart, sq5 fiind primul din rută) — corectat cu `view:{message:undefined}`, verificat cu script dedicat. Suita fișierului: 28/28 din prima încercare, inclusiv testul de regresie exact pe bug-ul original. Suită completă: 506 teste, 503 trec, 3 pică — exact cele 3 preexistente, zero eșecuri legate de lucrare pentru prima dată din Faza C încoace. Verificat live: greșit rămâne + `wrongFacts`, corect avansează, zero erori consolă. **Cu asta, toate cele 17 subquizuri reale sunt migrate — pașii 1-3 din §5 (plan) COMPLEȚI.** | **complet** |
| 20.08.2026 | Faza E, v2-modular | 9/9 subquizuri migrate din `multiplication-1120-v2-modular.js` la contractul declarativ, `raspundeSubquiz`/`creeazaM3BSubquiz` șterse. Niciun hook nu folosea `turCorect` (verificat prin grep) — migrare fără corecție de comportament ascunsă, spre deosebire de v3. Capcană structurală găsită și tratată: `actiuni.*` nu au acces la `runtime` (deci nu pot chema `nextItem()` manual), iar `mesaje.corect` implicit s-ar fi scurs pe ramuri de exit fără `view` propriu — verificat ramură cu ramură, un singur caz real (`anchorSumValues`→`rapidAnchorAdditions`), corectat cu `view:{message:undefined}` explicit. `domainProducts`: mesajul de tranziție de domeniu recreat ca `mesaje.corect` dinamic (detectează `currentDomainCount===0`). Verificat cu script dedicat: mesaj neconfirmat scurs, tranziție de domeniu exact la a 15-a întrebare. Suita fișierului: 43/43 din prima încercare, nimic rescris. Suită completă: 506 teste, 476 trec, 30 pică (exact v4 nemigrat + 3 preexistente). Verificat live: greșit rămâne + `wrongFacts`, corect avansează, zero erori consolă. Sufix scos, commit în lucru. | **complet** |
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
- [x] `multiplication-1120-v2-modular.js` — 9/9 subquizuri migrate, sufix scos — 20.08.2026
      (vezi „Stare curentă": migrare mai curat mecanică decât v3, dar cu o capcană structurală
      nouă — `actiuni.*` nu au acces la `runtime`, mesajele pe ramuri de exit fără `view` propriu
      trebuiau tratate explicit ca sa nu se scurga)
- [x] `multiplication-1120-v3-train-eff-eq-forms.js` — 3/3 subquizuri migrate, sufix scos —
      20.08.2026 (vezi „Stare curentă" pt. detalii: bug real de `turCorect` reparat ca efect
      direct al migrării, fix „pop fără view" centralizat în `subquiz-definition.js`)
- [x] `multiplication-1120-v4-intensiv-multipli-234.js` — 5/5 subquizuri migrate, sufix scos —
      20.08.2026 (ULTIMUL fișier — vezi „Stare curentă": 28/28 teste din prima încercare,
      inclusiv testul de regresie pe bug-ul original din sq5; aceeași capcană de „mesaj scurs"
      ca la v2-modular, găsită și tratată la fel)
- [x] Test-santinelă: `define({ onAnswer })` chiar aruncă — 19.08.2026,
      `tests/subquiz-definition-faza-e-ce-nu-cum.test.js` (7 teste, toate verzi; include și
      `SubquizOrchestrator.create()` cu o definiție cu `onAnswer`, nu doar `define()` direct)
- [x] §12: învelirea structurală — toate cele 15 quizuri „simple" construite prin
      `SubquizOrchestrator`, minim o bucată „bază". **COMPLETĂ 20.08.2026** — toate 15 gata (fără
      gard încă, doar structural, cum spune planul).
- [x] §12: al doilea gard — enforcement-ul propriu-zis, **COMPLET 20.08.2026** (autorizare nouă,
      explicită, a userului: „continuă și cu gardul acum"). Vezi „Stare curentă" pentru detalii
      complete: `valideazaConstructiaPrinSubquizOrchestrator` în `falling-engine.js`, mirror exact
      al gardului Motor3Butoane din Faza C, verifică `rezultat.subquizEvent` (semnătura pusă de
      `decorate()` în `subquiz-orchestrator.js`). Verificat empiric: toate cele 24 de intrări de
      meniu reale (25 cu `rigle-cl1`, exclus corect — motor propriu) trec fără nicio eroare.
      - [x] `equations-e3-e6.js` — 20.08.2026 (tiparul reutilizabil, simplificat — vezi „Stare
            curentă": orchestrator pornit o dată, `generator` gol, sincronizare necondiționată)
      - [x] `addition-table.js` — 20.08.2026 (`options[ctx.index]` în loc de `ctx.alesul`,
            vezi „Stare curentă" pt. capcana de tip număr/string)
      - [x] `addition-table-range.js` — 20.08.2026 (clonă structurală a
            `addition-table.js`, exact același tipar simplificat, aceeași
            capcană `options[ctx.index]`; 6/6 teste, verificat live)
      - [x] `prime-divisors.js` — 20.08.2026 (aceeași capcană `options[ctx.index]`, plus
            `divisionHistory` cu conținut REAL — nu gol ca la `addition-table*` — trebuia
            injectat prin `dupaApasare` la fel; are pas intermediar real, testat explicit
            live: lanțul 4→2→1 funcționează, `divisionHistory` se afișează corect; 6/6 teste)
      - [x] `sub-sau-langa-radical.js` — 20.08.2026 (prima diferență structurală reală față de
            tipar: `dupaRaspunsCorect` avea o ramură `{}` fără `action`, reparată explicit; vezi
            paragraful dedicat mai sus)
      - [x] `bagare-sub-radical.js` — 20.08.2026 (aceeași capcană ca la `sub-sau-langa-radical.js`
            — ramura „caz normal" din `dupaRaspunsCorect` întorcea `{}`, reparată explicit; aici
            `pickNewQuestion()` rămâne PURĂ, deci sincronizarea s-a adăugat la fiecare din cele 4
            situri de mutație, nu centralizat)
      - [x] `addition-table-singapore.js` — 20.08.2026 (fără `current` unificat — `currentFact`+
            `options`+`correctIndex` separate; `roundView()` are câmpuri proprii `questionFormat`/
            `targetSum`/`bondHistory`, injectate explicit prin `dupaApasare` pe ramura de greșit;
            mesaj dinamic real cu `ctx.alesul`, confirmat corect prin orchestrator)
      - [x] `addition-table-singapore-missing.js` — 20.08.2026 (identic structural cu
            `addition-table-singapore.js`, + dimensiunea `missingSide`; aceleași câmpuri proprii
            `bondKnownAddend`/`bondMissingSide` injectate prin `dupaApasare`)
      - [x] `division-with-remainder.js` — 20.08.2026 (structural identic cu
            `bagare-sub-radical.js`, dar `dupaRaspunsCorect` întorcea deja mereu comandă explicită
            pe toate ramurile — fără capcana `{}`; `mesaje.gresit` static, fără `ctx.alesul`)
      - [x] `prime-divisions.js` — 20.08.2026 (frate cu `prime-divisors.js`; `options` numere, dar
            `ctx.alesul` era folosit atât în mesaj CÂT ȘI în `buildMistakePayload` — ar fi stocat
            `combo.wrong` ca string, comparat mai târziu cu `!==` strict față de un număr; reparat
            cu `options[ctx.index]` peste tot)
      - [x] `succesive-quiz/engine.js` — 20.08.2026 (`options` deja string-uri, `ctx.alesul` sigur
            de folosit; `successionHistory`/`promptHtml` proprii injectate ca la equations-e3-e6.js;
            `prepareStep()` singurul punct de mutație, sincronizare centralizată acolo)
      - [x] `conexe-table-quiz/engine.js` (4 intrări de meniu) — 20.08.2026 (M3B deja curat cuplat
            din Faza D — `dupaRaspunsCorect` cheamă direct `onStepCorrect` neschimbată; provocarea
            reală: `roundView()` delegă la 4 adaptoare cu câmpuri custom condiționate de tip,
            nepotrivite cu forma generică — rezolvat cu `dupaApasare` întorcând `roundView()`
            complet, nu câmpuri punctuale; 49/49 teste pe toate 4 adaptoarele din prima încercare)
      - [x] `eff-quiz/engine.js` (4 intrări de meniu) — 20.08.2026 (fisier-frate cu
            `conexe-table-quiz/engine.js` — fosta `onStepWrong` deja ștearsă la Faza D, aceeași
            soluție: `dupaApasare` întoarce `roundView()` complet; `esteCorect` compară direct
            indexul, nu `options[index]`)
      - [x] `pre-equations-eff-navigation.js` — 20.08.2026 (`buildQuestion()` singurul loc de
            mutație a lui `current`, plus sincronizare explicită în `beginRound` pt. ramura cu
            `next`; `successionHistory` propriu injectat prin `dupaApasare`, apelând `roundView()`
            direct, fără duplicare de logică)
      - [x] `multiplication-1120-v2.js` — 20.08.2026 (ULTIMUL — 1411 linii, cel mai mare fișier
            din tot refactorul; confirmat la citire: UN SINGUR M3B cu 6 „subquiz"-uri interne
            informale, ramificate pe `stage`/`mode`, NU SubquizOrchestrator real cu push/pop —
            tiparul „o bucată bază" s-a aplicat direct, fără redesenare. 9 situri separate de
            mutație a lui `current` — sincronizare adăugată la fiecare, nu centralizată. `roundView()`
            fără câmpuri proprii — doar `def.hintMessage`. 33/33 teste din prima încercare, inclusiv
            toate testele de regresie „CORECTAT" pe toate cele 6 zone. Verificat live end-to-end,
            lanțul complet de 5 tranziții de stage (anchor→3→4→5→6) în ordine reală, plus răspuns
            greșit imediat după ultima tranziție — toate corecte, zero erori)

**§12 COMPLET — toate cele 15 fișiere învelite în `SubquizOrchestrator`. Rămâne DOAR gardul
propriu-zis (enforcement-ul „orice quiz trebuie construit prin orchestrator") — explicit în afara
scopului autorizării acestei sesiuni, neatins, pentru un pas separat.**
- [ ] **OPRIRE** — raportat (acest punct: pasul 1 complet, gata de pasul 3 — migrarea per fișier)

## Faza F — verificare finală

**COMPLETĂ — 20.08.2026.** Toate cele 4 puncte verificate riguros, cu comenzi concrete (nu din
memorie) — vezi „Stare curentă" pentru raportul complet, criteriu cu criteriu.

- [x] Niciun titlu din meniu nu mai conține „QUIZ NEFUNCTIONAL - IN REFACTORING" — `grep -r
      NEFUNCTIONAL js/` → zero rezultate.
- [x] Titlurile sunt identice cu cele dinainte de lucrare — comparat riguros, prin `git diff`, cu
      `4fc4722` (ultimul commit înainte de Faza A) — toate cele 24 de titluri de meniu identice.
- [x] Toate testele repo-ului verzi + `npm run check:docs` + `npm run check:encoding` — 507 teste,
      504 trec, 3 pică (confirmate preexistente: `vizualizare3-tabel-fluenta.test.js`, neatins din
      10.08.2026, cu 8 zile înainte de începerea lucrării); `check:docs`/`check:encoding` curate.
- [x] Cele 11 criterii din §9 al planului, verificate unul câte unul — 10/11 confirmate integral;
      **1 discrepanță reală semnalată explicit** (criteriul 5, plasa de siguranță — vezi mai jos).
- [x] **OPRIRE** — raport final prezentat userului.

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

## Bug-uri de tranziție de rutare (21.08.2026) — REZOLVATE (commit `da4447b`)

> Găsite pornind de la un simptom raportat de user la `multiplication-1120-v4-intensiv-multipli-234.js`
> („T*/ 11-20 - v4 - bag toate in joc, intensiv multipli 2 3 4"): *„final de nivel, apare alert de
> schimbare de nivel, apoi mai apare o întrebare tot din subtabla veche, apoi continuă cu întrebări
> din subtabla noului nivel."* Userul a cerut întâi doar investigație (fără reparare), apoi
> re-analiză cu Opus 5 înainte de a repara.

**Simptomul, mecanic.** `resolveChoice` din `js/falling-engine.js` cheamă gărzile ÎNAINTE de
`applyAnswerResult`. Când o gardă aruncă, `applyAnswerResult` nu mai rulează niciodată — deci nici
`setInputEnabled(false)`, iar `animating` fusese deja pus pe `false` la începutul funcției. Ecranul
rămâne pe întrebarea veche, cu butoanele active, deși starea internă a quizului a avansat deja
(mutația s-a produs înainte de aruncare). Următoarea apăsare a userului e un răspuns normal, care
trece gărzile — abia atunci se reîmprospătează ecranul. De-acolo „întrebarea-fantomă". Eroarea nu e
prinsă nicăieri (`grep`: niciun `window.onerror`, niciun try/catch pe cale).

**Cauza 1 — avansul de nivel (garda 2 `subquizEvent`; introdusă de gardul §12, 20.08.2026).**
Cele 3 quizuri cu rute reale prindeau semnalul `routeComplete` într-un `handleOrchestratorResult`
propriu și ÎNLOCUIAU rezultatul orchestratorului cu unul construit de mână (`advanceLevel()`), fără
`subquizEvent`. Aruncă la FIECARE schimbare de nivel.

**Cauza 2 — revenirea din sq3 (garda 1 `motor3Butoane`; latentă de la Faza D).** M3B semnează și
comanda, și vederea ei (`js/motor-3-butoane.js`, ramura de rutare). Dar `subquiz-definition.js`
șterge deliberat vederea comenzii la `pop` (ca să n-o îngroape pe cea din `onResume` — fix corect
din Faza D), iar orchestratorul cade atunci pe `resumed.view`, construită de `onResume`, care NU
trece prin M3B. Rezultat nesemnat, aceeași aruncare, fără alertă. Vechi, nu de la gardul de azi.

**Cauza 3 — recursia prin `onResume`; GĂSITĂ ABIA LA VERIFICAREA LIVE, după ce primul fix părea
complet.** La `pop`, dacă `onResume` cere el însuși o rutare (v4 iese din nivel exact așa, când sq3
a completat acoperirea: `{action:"exit", reason:"levelCoveredAfterSq3"}`), orchestratorul
recursează cu comanda LUI — care nu vine din M3B, deci e nesemnată. Primul fix propaga semnătura în
`decorate`, ceea ce nu acoperea recursia. **Lecție: Node nu a prins-o pentru că, cu
`random: () => 0`, nivelul se termină mereu în subquizul de bază; browserul a prins-o din a doua
schimbare de nivel.**

**Reparația (arhitecturală, la cererea userului: „dacă sofisticarea e necesară, folosește-o").**
Principiul impus: *finalul de rută e tot un eveniment de rutare, deci se rezolvă în orchestrator, ca
`push`/`pop`/`exit`; quizul spune doar CE urmează, orchestratorul pune marcajele.*

1. `js/subquiz/subquiz-orchestrator.js`: config nou `onRouteComplete` — `routeComplete()` îl cheamă
   și decorează el rezultatul. Semnătura M3B se propagă de pe comandă într-un SINGUR loc, la
   intrarea în `handle` (`cuSemnaturaComenzii(handleIntern(command), command)`), ca să acopere
   toate ramurile ȘI recursia. Semnătura nu se inventează niciodată — se copiază doar cea pusă de
   M3B. În plus, `onAnswer` fără subquiz pornit aruncă acum explicit, în loc să întoarcă tăcut un
   rezultat nesemnat care ar fi crăpat mai târziu, departe de cauză (razgandire-ieftina.md, p. 9).
2. Cele 3 quizuri (`v2-modular`, `v3`, `v4`): `handleOrchestratorResult` ȘTERS din toate; `onAnswer`
   /`onTimeout` întorc direct rezultatul orchestratorului; cele 6 auto-semnări manuale
   (`motor3Butoane: global.Motor3Butoane.SEMNATURA`) șterse — quizurile nu mai construiesc
   rezultate de top. Fișierele au ieșit mai SIMPLE, nu mai complicate.

**Respins ca sofisticărie inutilă:** slăbirea gărzii (ar anula rostul ei) și restructurarea
avansului de nivel ca `jump`/`start` prin orchestrator (corectă, dar mult peste ce cere bug-ul).

**Verificare.** Test nou `tests/orchestrator-marcaje-pe-orice-raspuns.test.js` (5 teste: cele 3
quizuri reale duse prin 2 schimbări de nivel + recursia prin `onResume` + aruncarea fără subquiz
pornit); confirmat că pică 4/5 pe codul vechi și trece 5/5 pe cel nou. Suită completă: 520 teste,
517 trec, 3 pică (exact preexistentele). `check:encoding` și `check:docs` OK. Live, în browser real,
pe v4: 3 schimbări de nivel, 137 de pași, **zero erori**, iar după fiecare alertă urmează doar
întrebări din subtabla nouă (12x, apoi 13x, apoi 14x) — zero întrebări-fantomă.

**De reținut pentru Faza F:** criteriul 3 („impunere reală pe 2 niveluri") fusese verificat cu un
singur răspuns per quiz, fără să ajungă vreodată la o schimbare de nivel — de-aia n-a prins nimic.
O verificare de gardă trebuie să treacă prin TRANZIȚIILE de rutare, nu doar prin pașii obișnuiți.

## Bug-uri găsite — AMBELE REZOLVATE 20.08.2026

> Titlu original: „Bug-uri găsite, NEreparate — lăsate pentru altă ocazie". Erau bug-uri REALE,
> verificate, nu speculații — dar în afara scopului exact al lucrării aflate în desfășurare când au
> fost găsite (motorul comun de răspuns / învelirea în orchestrator), deci nereparate deliberat la
> momentul respectiv. Userul a cerut explicit rezolvarea lor imediat după finalizarea planului —
> ambele rezolvate acum, vezi detaliile din fiecare secțiune. Context original păstrat neșters, ca
> oricine reia firul să înțeleagă cum au fost găsite și de ce alegerea de fix a fost cea aleasă.

### 1. `setSq2Config` respinge tăcut `exitCount` în afara `{3, 4, 5}` — REZOLVAT 20.08.2026

**Rezolvare:** varianta (c) din cele 3 propuse — cea mai conservatoare, dat fiind e SINGURA care nu
schimbă NIMIC observabil (nici ce valori sunt acceptate, nici ce se întâmplă la o valoare invalidă
— setarea rămâne neschimbată, exact ca înainte). Doar valoarea RETURNATĂ devine cinstită: în loc de
`true` necondiționat, funcția întoarce acum `{ok: boolean, rejected: string[]}` — `rejected`
listează EXACT câmpurile CERUTE (prezente în `config`) dar respinse ca invalide; câmpurile absente
din `config` nu contează (n-au fost o „cerere"). **Decizie de scop, notată explicit:** deși bug-ul
raportat era specific despre `exitCount`, tiparul „silent no-op" era IDENTIC pentru toate cele 7
câmpuri ale funcției (`intensiveMode`, `sbsAnswerFactor`, `sbsAnswerProduct`, `factCount`,
`exitCount`, `exitMode`, `eqFormCount`) — aplicat fix-ul UNIFORM la toate 7, nu doar la `exitCount`,
ca să nu rămână funcția pe jumătate cinstită (o inconsistență artificială, fără nicio justificare
tehnică). Aplicat identic în AMBELE fișiere (`v3`/`v4`, implementare byte-identică, confirmat).
Teste noi: 4 în `multiplication-1120-v3-train-eff-eq-forms.test.js` + 2 în
`multiplication-1120-v4-intensiv-multipli-234.test.js` (valoare invalidă → `{ok:false,rejected:[...]}`
+ nimic scris în storage; valoare validă → `{ok:true,rejected:[]}` + scris corect; mai multe câmpuri
simultan, unele valide unele nu; fără niciun câmp → `{ok:true,rejected:[]}`). Verificat live cu
scripturile reale din pagină, pe ambele fișiere, zero erori consolă. Suită completă: 515 teste, 512
trec, 3 pică (preexistente). Commit `65c1c6b`, push confirmat.

**Text original al bug-ului (păstrat pentru context):**

**Unde:** `js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js` ȘI
`js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js` — funcția `setSq2Config`, ambele
fișiere au implementarea identică:
```js
if ([3, 4, 5].includes(Number(config.exitCount))) {
  sq2ExitCount = Number(config.exitCount);
  writeSetting(SQ2_EXIT_COUNT_KEY, sq2ExitCount);
}
```

**Simptom exact:** `quiz.setSq2Config({ exitCount: 2 })` (sau orice valoare ∉ {3,4,5}, ex. 6, 10,
0) nu face NIMIC — `sq2ExitCount` rămâne la valoarea anterioară (implicit 3), fără nicio eroare,
niciun avertisment. Funcția întoarce mereu `true`, indiferent care câmpuri au fost de fapt
acceptate — apelantul nu are cum să afle că cererea lui a fost ignorată.

**Cum a fost găsit (20.08.2026, migrarea v3 la Faza E):** un test folosea `exitCount: 2` și trecea
— dar ACCIDENTAL, prin coincidența a două bug-uri care se anulau reciproc. Tiparul vechi (câte o
instanță `Motor3Butoane` nouă la fiecare apăsare, înlocuit acum) rupea `turCorect` — o corectare
(a doua apăsare, după una greșită) apărea mereu ca „prima apăsare", deci `turCorect` era mereu
`true`, nu doar la prima încercare reală. Asta făcea ca un tur „corectat" să se numere GREȘIT ca
`turCorect`, adăugând un increment în plus la `correctCountsByB` — care, din întâmplare, compensa
exact faptul că `sq2ExitCount` rămăsese la 3 (nu devenise 2 cum cerea testul). Odată reparat
`turCorect` (corect, ca parte a migrării la Faza E), testul a picat — investigația a scos la
iveală bug-ul de validare, mascat până atunci.

**De ce NU s-a reparat:** în afara scopului Fazei E (asta ține de panoul de control/validarea
configurației, nu de „subquiz dă CE nu CUM" sau „quiz construit prin SubquizOrchestrator").
**De ce practic nu a produs pagube până acum:** panoul de control (`appendSq2ControlPanel`, la
ambele fișiere) oferă DOAR trei butoane radio, 3/4/5 — din UI, o valoare invalidă nu poate fi
trimisă niciodată. Gaura e accesibilă DOAR printr-un apel programatic direct la `setSq2Config` cu
o valoare din afara mulțimii (exact ce făcea testul).
**Ce s-a făcut în loc:** testul a fost corectat să folosească `exitCount: 3` (o valoare validă),
păstrând aceeași intenție de testare (verifică distincția `turCorect` „correct" vs „any").

**Reparație posibilă, neimplementată — de ales una:** (a) lărgește validarea să accepte orice
număr întreg pozitiv; (b) păstrează restricția dar clamp la cea mai apropiată valoare validă, în
loc de no-op tăcut; (c) `setSq2Config` să întoarcă `false` (sau un obiect cu ce s-a acceptat/respins)
când o valoare e respinsă, ca apelantul să poată reacționa.

### 2. `beginRound(next)` cu un obiect trunchiat ar corupe grading-ul ulterior — REZOLVAT 20.08.2026

**Rezolvare:** varianta (b) din cele 2 propuse — verificare defensivă în `beginRound`, NU redesenare
a lui `nextAfterCorrect()`. Ales (b) în loc de (a) și pentru un motiv suplimentar, găsit la
implementare (nu doar „mai simplu"): opțiunea (a) ar fi cerut ca `nextRound` să care `current`
complet — dar `current.correct` (valoarea NUMERICĂ a răspunsului corect, pt. acest fișier) ar fi
intrat în coliziune de nume cu `correct: true` (boolean-ul de outcome, omniprezent în rezultatele
M3B) — risc de suprascriere silențioasă, în funcție de ordinea de spread. Verificarea defensivă
ALEASĂ nu e nici ea literal `next?.correct !== undefined` (cum sugera propunerea inițială — ar fi
trecut fals-pozitiv exact pe acel `correct:true` boolean) — ci `typeof next?.correct === "number"`,
care exclude explicit acel caz. Calea reală (`falling-engine.js`) rămâne neatinsă — `next` e mereu
ori absent, ori deja complet, deci ramura defensivă (cădere pe `pickNewQuestion()`) nu se declanșează
azi, e o plasă de siguranță pentru viitor. Teste noi (2), în `equations-e3-e6.test.js`: un `next`
trunchiat (forma exactă a lui `roundView()`) nu corupe grading-ul — răspunsul pe indexul corect al
întrebării noi e acceptat normal; un `next` complet (din `pickNextRound()`) funcționează identic,
neschimbat. Verificat live cu scriptul real din pagină. Suită completă: 515, 512 trec, 3 pică
(preexistente). Commit `65c1c6b`, push confirmat.

**Text original al bug-ului (păstrat pentru context):**

**Unde:** `js/quizzes/equations-e3-e6.js` — `esteCorect`/`beginRound`.

**Mecanismul exact:**
```js
esteCorect: (_item, index) => Boolean(current) && Number(current.options?.[index]) === current.correct,
...
beginRound(next) {
  current = next ?? pickNewQuestion();
  ...
}
```
`esteCorect` citește `current.correct`. Dacă `beginRound` e chemat cu un `next` TRUNCHIAT — de
exemplu rezultatul lui `roundView()` (`{prompt, options, correctIndex, hintMessage,
successionHistory}`, FĂRĂ câmpul `correct`) — atunci după acel apel `current.correct` devine
`undefined`, iar `esteCorect` întoarce `false` pentru ORICE apăsare ulterioară, la nesfârșit
(quiz-ul pare „înțepenit", orice răspuns e gresit), până la următoarea `pickNewQuestion()` reală
(la următorul run-complete sau schimbare de nivel).

**Cum a fost găsit (20.08.2026, învelirea în orchestrator, §12):** un script de verificare
scria (artificial) `quiz.beginRound(s.nextRound)` imediat după un run-complete, presupunând că
așa arată fluxul real al aplicației — și a lovit exact coruperea de mai sus.

**De ce NU e (încă) un bug viu:** verificat explicit în `js/falling-engine.js`:
```js
startRound(result.nextRound ?? getQuiz().beginRound(getQuiz().pickNextRound()));
```
Cu `??`, quan `result.nextRound` e deja prezent (mereu adevărat la acest fișier — `nextAfterCorrect()`
îl setează pe ambele ramuri de run-complete), ramura din dreapta (care AR chema `beginRound` cu
`nextRound`-ul trunchiat) NU se evaluează NICIODATĂ. `nextRound` e doar AFIȘAT direct
(`startRound`/`renderRound`), niciodată retrimis în `beginRound`. Confirmat cu un script corectat
că această secvență exactă nu se declanșează în aplicația reală.

**De ce nu s-a reparat oricum:** comportamentul e IDENTIC, neatins, cu codul dinainte de migrarea
la Faza E (`esteCorect`/`beginRound` copiate verbatim) — a repara asta ar însemna o redesenare
reală (ex. `nextAfterCorrect()` să care mai departe obiectul `current` complet, nu doar
`roundView()`), în afara scopului „învelește, nu reproiecta".

**Risc rămas, pentru viitor:** dacă vreodată apare un NOU loc care cheamă
`quiz.beginRound(ceva.nextRound)` fără protecția `??` de mai sus (ex. un buton de acțiune în
arenă, sau o rescriere a lui `falling-engine.js`), sau dacă `nextAfterCorrect()` e modificat să
refolosească `nextRound` altfel — grading-ul s-ar rupe tăcut, exact ca în scenariul găsit.

**Reparație posibilă, neimplementată — de ales una:** (a) `nextAfterCorrect()` să pună pe
`nextRound` obiectul `current` complet (cu `correct`), nu doar `roundView()`; (b) `beginRound` să
verifice defensiv `next?.correct !== undefined` înainte să aibă încredere într-un `next` primit,
altfel să cadă pe `pickNewQuestion()`.

## De adresat după finalizarea planului curent

> Observații apărute pe parcurs care NU sunt bug-uri (verificat — comportament intenționat,
> existent dinainte de lucrarea curentă), dar merită o discuție separată, de altă natură decât
> „repară asta", după ce planul actual (Faza E completă) e gata. Nu se ating acum — ar fi scope
> creep peste scopul exact al motorului comun de răspuns.

### 1. Pauza fixă de 450ms (`RUN_DONE_MS`) la finalul fiecărui „run-complete" — REZOLVAT 20.08.2026

**Rezolvare:** userul a ales explicit varianta „elimină" (nu doar scurtează). `RUN_DONE_MS` schimbat
din `450` în `0` în `js/falling-engine.js` (un singur punct de impact, verificat — nicio altă
referință în tot repo-ul). `LEVEL_ADV_MS` (1400ms, avansul de nivel) rămas complet neatins — are
alt scop (celebrarea „Next level!"), userul a cerut eliminarea DOAR a pauzei descrise mai jos.
**Verificat live, riguros** (prima încercare de măsurare a fost defectă — polling pe
`document.body.textContent`, prea larg, a produs timpi falși de ~2-4s; corectată citind direct
elementul `#top-number`, izolat, plus calculul propriu al indexului corect prin divizibilitate, nu
presupunere): pe `prime-divisors.js`, click pe răspunsul corect care ÎNCHEIE lanțul (numărul ajunge
la 1, fără avans de nivel — exact scenariul reclamat) → tranziție la runda următoare în **0ms**
măsurat, de 8 ori la rând, pași intermediari și finalizări de lanț deopotrivă. Suită completă: 507,
504 trec, 3 pică (preexistente, neafectate — zero test depindea de valoarea exactă). Zero erori
consolă. Commit `755db08`, push confirmat.

**Text original al observației (păstrat pentru context):**

**Unde:** `js/falling-engine.js:19` — `const RUN_DONE_MS = 450;`, folosită la liniile ~727-728:
```js
result.runDelayMs ??
  (result.levelAdvanced ? LEVEL_ADV_MS : RUN_DONE_MS);
```
Delay-ul implicit pentru orice rezultat cu `outcome:"run-complete"` care nu-și specifică propriul
`runDelayMs` (`LEVEL_ADV_MS=1400` e varianta pentru avans de nivel, mai lungă — separată).

**Cum a apărut discuția (20.08.2026):** userul a semnalat un „lag perceptibil, la fiecare câteva
întrebări" la `prime-divisors.js` / „Găsire divizori primi". Investigat cu măsurători directe: (1)
300 apeluri `onAnswer` sintetice, sub 0.5ms fiecare — logica quiz-ului nu e cauza; (2) clickuri
reale în UI, cu polling pe DOM până starea devine validă din nou — confirmat exact: fiecare pas
intermediar dintr-un lanț de împărțiri e instant (0ms), dar fiecare FINALIZARE de lanț (numărul
ajunge la 1) durează consistent ~465ms, potrivindu-se exact cu `RUN_DONE_MS=450` (+ overhead mic
de polling). `finishSeriesRun` din `prime-divisors.js` nu specifică niciodată `runDelayMs`, deci
cade mereu pe acest implicit.

**De ce NU e bug, verificat, nu presupus:** `finishSeriesRun` (funcția care produce rezultatul
`run-complete`) e byte-identică înainte și după commit-ul Faza E (`git diff f0ded97 e6c762c` —
singura diferență e indentarea, de la mutarea în noua funcție wrapper `baseDefinition`).
Comportamentul exista identic dinainte de toată lucrarea curentă din această sesiune; userul l-a
observat abia acum pentru că testa activ exact acest fișier, imediat după ce fusese învelit.

**De ce merită revizitat totuși, mai târziu:** un lanț de împărțiri la `prime-divisors.js` are des
2-4 pași rapizi (instant) urmați de o pauză de aproape jumătate de secundă — asimetria de ritm
poate fi resimțită ca inconsistentă, mai ales de un copil. Posibile direcții, NICIUNA evaluată
încă (doar enumerate, nu recomandate):
(a) scurtează `RUN_DONE_MS` global, pentru toate quizurile;
(b) lasă fiecare quiz să-și seteze propriu `runDelayMs`, mai mic pentru ramuri fără mesaj de
    arătat (ex. ramura lui `finishSeriesRun` cu `message: ""`);
(c) nu schimba nimic — pauza ar putea fi acolo intenționat, ca „respirație" înainte de următorul
    număr, nu un defect.
Depinde de o decizie de UX a userului, nu de un fapt tehnic de corectat — de-aia stă aici, nu la
„Bug-uri găsite, nereparate".

## Decizii amânate — de prezentat userului la final

> Secțiune nouă (autorizare 20.08.2026 — vezi „Tranziție de sesiune" din „Stare curentă"). Diferită
> de cele două secțiuni de mai sus: nu e un bug (verificat, real) și nu e o observație de UX — e o
> **alegere de implementare** făcută unilateral, în timpul învelirii celor 11 quizuri rămase din
> §12, într-un loc unde ar fi fost rezonabil și altfel, dar userul a cerut explicit să nu se
> oprească lucrul ca să întrebe. Fiecare intrare: ce trebuia decis, ce s-a ales și de ce (mereu
> varianta cea mai conservatoare — comportament identic cu dinainte), ce altă variantă exista.
> **Se prezintă userului DOAR după ce toate cele 11 fișiere sunt gata — nu pe parcurs.**

**CONCLUZIE FINALĂ (20.08.2026, toate cele 11 fișiere rămase gata): secțiunea rămâne GOALĂ —
zero decizii reale de design de raportat.** Verificat explicit, la fiecare din cele 11 fișiere, dacă
vreo alegere s-a ridicat la nivelul unei „decizii de design cu alternative vizibile pentru user"
(nu doar un detaliu de implementare fără impact comportamental):

- **Capcanele structurale găsite** (ramura `dupaRaspunsCorect` care întorcea `{}` fără `action` la
  `sub-sau-langa-radical.js`/`bagare-sub-radical.js`; `ctx.alesul` vs. `options[ctx.index]` la
  `prime-divisions.js`, cu risc de corupere a `combo.wrong` stocat) au fost toate **corectări
  obligatorii**, nu alegeri — dat fiind tiparul deja aprobat („dupaRaspunsCorect intoarce mereu o
  comanda explicita, niciodata undefined"), lăsarea lor necorectate ar fi produs un bug REAL
  (item gol afișat / comparație de tip stricată), nu doar o variantă alternativă acceptabilă.
- **Locul exact al apelurilor `sincronizeazaOrchestratorul()`** (centralizat într-un singur punct
  de mutație vs. scattered la mai multe situri, ex. `prime-divisions.js`/`multiplication-1120-v2.js`
  cu 2 și respectiv 9 situri) a variat de la fișier la fișier, dictat STRICT de structura internă
  existentă a fiecăruia (unde chiar mutează `current`/`options`) — zero impact comportamental
  vizibil, deci nu calificată drept „decizie de design", doar un detaliu de implementare adaptat.
- **Soluția „`dupaApasare` întoarce `roundView()` complet"** (la `conexe-table-quiz/engine.js`,
  `eff-quiz/engine.js`) vs. injectarea de câmpuri punctuale (la `equations-e3-e6.js`,
  `succesive-quiz/engine.js`, `pre-equations-eff-navigation.js`) — ambele ar fi produs EXACT
  același rezultat vizibil (verificat prin teste identice); alegerea a fost dictată de câte
  câmpuri proprii avea `roundView()`-ul fiecărui fișier (1 câmp → injectare punctuală mai simplă;
  4+ câmpuri condiționate de tip → returnarea completă mai robustă), nu o alegere cu consecințe
  vizibile diferite pentru user.

Toate cele 11 fișiere (de fapt 15, incluzând primele 4 din sesiunea anterioară) au comportament
**identic, verificat riguros**, cu codul dinainte de înveliire — asta a fost cerința explicită și
scopul întregii lucrări din §12.
