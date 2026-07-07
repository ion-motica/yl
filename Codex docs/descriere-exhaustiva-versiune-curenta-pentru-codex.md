# Youlearn - descriere exhaustiva versiune curenta pentru Codex

Data scanarii: 2026-07-07.

Scop: document de reorientare pentru Codex la interventii viitoare. Nu este documentatie pentru copil/utilizator final. Este o harta tehnica si pedagogica a versiunii curente dupa pull-ul la `0489521`.

## Stare repo

- Radacina locala: `C:\Users\I\Projects\Youlearn.com`
- Remote: `https://github.com/ion-motica/yl.git`
- Branch uzual: `master`
- Ultimul pull confirmat: fast-forward `3f617e6..0489521`
- Teste rulate dupa pull: `node --test tests/*.test.js`
- Rezultat dupa pull: 153 teste trecute, 0 esuate.

## Regula de lucru cu Git pentru acest thread

Utilizatorul prefera ca eu sa nu incerc commit/push direct, ci sa ii dau comenzi PowerShell.

Cand spune `commit push`, raspunsul trebuie sa includa direct o secventa de forma:

```powershell
cd "C:\Users\I\Projects\Youlearn.com"

git add -- index.html js/quizzes/multiplication-1120-v2.js tests/multiplication-1120-v2.test.js

git commit -m "Mesaj commit"

git push origin master
```

Cand spune `pull`, comanda este:

```powershell
cd "C:\Users\I\Projects\Youlearn.com"

git pull origin master
```

## Comenzi utile

Server local static, daca nu exista deja unul pornit:

```powershell
cd "C:\Users\I\Projects\Youlearn.com"
python -m http.server 8766
```

Verificare teste completa:

```powershell
cd "C:\Users\I\Projects\Youlearn.com"
node --test tests/*.test.js
```

Atentie: `package.json` are un script `test` vechi, care ruleaza doar `tests/addition-table-conexe-helper.test.js`. Pentru verificarea reala se foloseste comanda de mai sus.

## Structura generala

Aplicatia este statica. Nu exista build step. `index.html` incarca direct CSS si scripturi globale browser, in ordine stricta. Modulele sunt IIFE-uri care expun obiecte pe `window`, de exemplu `QuizRegistry`, `FallingEngine`, `LayoutConfig`, `StartupQuiz`, `CpRegistry`, `CpShell`.

Fisiere de varf:

- `index.html` - scheletul DOM si ordinea scripturilor.
- `style.css` - aproape tot stilul: arena, lift, CP, desktop/mobil, ASNW, tonomat, quiz T11-20.
- `js/app.js` - compozitorul principal al aplicatiei.
- `js/falling-engine.js` - motorul vizual comun: cadere, raspunsuri, timeout, reveal, bounce.
- `js/quiz-registry.js` - registru global de quizuri.
- `js/startup-quiz.js` - alege quizul de pornire si citeste configuratie din URL.
- `js/cp-registry.js` si `js/cp-shell.js` - panourile de control.
- `tests/` - teste Node `node:test`, fara browser real.
- `Codex docs/` si `documente de referinta/` - documentatie de lucru.

## Layout aplicatie

`index.html` defineste trei zone principale:

- `divArena`: ecranul de telefon / scena efectiva de joc.
- `divMeniu`: meniul cu niveluri si lista de quizuri.
- `divCp`: panourile de control.

Pe mobil, `divMeniu` si `divCp` sunt overlay-uri. Pe desktop, `app.js` construieste dinamic un tabel cu 3 coloane si muta aceleasi noduri:

1. arena;
2. meniu;
3. CP.

Aceasta mutare este intentionata. Nu dubla DOM-ul si nu crea layout paralel fara nevoie.

## Pornirea aplicatiei

Fluxul principal din `js/app.js`:

1. Strange toate referintele DOM intr-un obiect `dom`.
2. Alege quizul initial cu `StartupQuiz.resolveStartupQuizId()`.
3. Creeaza instanta quizului activ prin `QuizRegistry.createActive()`.
4. Aplica eventual configuratia ceruta prin URL (`?quiz=...&cfg=...`).
5. Inregistreaza panourile CP.
6. Creeaza `CpShell`, `AamArena`, `LayoutStage`, `FallingEngine`.
7. Construieste selectorul de quizuri si niveluri.
8. Porneste prima runda cu `engine.startRound(quiz.beginRound(quiz.pickNextRound()))`.
9. Porneste loop-ul de cadere.
10. Aplica layoutul desktop/mobil.

## StartupQuiz

Fisier: `js/startup-quiz.js`

Cheie persistenta in `LayoutConfig`: `startupQuizId`.

Ordine de rezolvare:

1. Daca URL-ul are `?quiz=<id>` si quizul exista, acela castiga.
2. Altfel foloseste quizul salvat in `LayoutConfig`.
3. Altfel fallback la `addition-table-range`.
4. Daca lipseste, incearca alte fallback-uri.

`StartupQuiz.getRequestedQuizConfig()` citeste `cfg` din URL. Accepta JSON direct sau base64url. Este folosit in special de quizul `equations-e3-e6` pentru linkuri partajabile.

## Contractul unui quiz

Un quiz este inregistrat cu:

- `id`
- `title`
- `description`
- `order`
- `gestionareGreseli` optional
- `create(meta)`

Instanta intoarsa de `create` trebuie sa ofere in practica:

- `getQuizId()` optional, dar util.
- `getLevel()`
- `getMinLevel()`
- `getMaxLevel()`
- `getLevelLabel()`
- `getLevelButtonTitle(level)`
- `switchLevel(level)`
- `isCompleted()`
- `pickNextRound()`
- `beginRound(next?)`
- `onAnswer(index, meta?)`
- `onTimeout(meta?)`
- `getProgressDisplay()` optional.
- `getFallSpeedFactor()` optional.
- `shouldBounceToTop()` optional.
- `getAamIllustration(state)` optional.
- `advanceIfSwapIncompatible()` optional.
- CP-uri speciale pot expune metode precum `getSubquizStartOptions()` sau `appendTonomatControlPanel()`.

O runda sau un rezultat de raspuns poate include:

- `prompt`
- `promptHtml`
- `options`
- `correctIndex`
- `hintMessage`
- `successionHistory`
- `divisionHistory`
- `questionFormat`
- `resetFall`
- `bounce`
- `flash`
- `message`
- `banner`
- `outcome`
- `runComplete`
- `levelAdvanced`
- `gameComplete`
- `nextRound`
- `runDelayMs`
- `promptHoldMs`
- `continueStep`

`FallingEngine` normalizeaza rezultatele, dar quizurile noi trebuie sa respecte acest vocabular.

## FallingEngine

Fisier: `js/falling-engine.js`

Responsabilitati:

- coboara liftul;
- masoara timpul de raspuns;
- gestioneaza butoanele 1/2/3 si tastele 1/2/3;
- gestioneaza pauza cu Space/P;
- anima raspunsul care urca spre lift, daca modul permite;
- face reveal la contact, inlocuind `?` cu raspunsul ales cand optiunea este activa;
- pastreaza marcajele de raspuns gresit pe aceeasi intrebare;
- proceseaza timeout cand liftul atinge jos;
- randeaza promptul, optiunile, istoricul si mesajele;
- anunta ASNW onboarding la intrebare noua si raspuns;
- apeleaza `quiz.onAnswer` si `quiz.onTimeout`.

Moduri de lift:

- `content`: intrebarea este in lift.
- `bar`: intrebarea este fixa jos, moverul este bara.
- `ball`: intrebarea este fixa jos, moverul este bila.

Aspect important: daca `result.runDelayMs` este `0`, intrebarea/nivelul urmator poate aparea imediat, fara pauza lunga. T11-20 foloseste asta la avansari ca bara sa nu curga peste intrebarea veche.

Timeout:

- motorul cheama `quiz.onTimeout(meta)`.
- Daca quizul intoarce aceeasi intrebare si aceleasi optiuni, marcajele gresite pot fi reaplicate.

## CP - panouri de control

Fisiere:

- `js/cp-registry.js`
- `js/cp-shell.js`

Panourile curente inregistrate in `app.js`:

- `subquiz` - vizibil daca quizul are `getSubquizStartOptions`.
- `equationTonomat` - vizibil daca quizul are `appendTonomatControlPanel`.
- `liftType`
- `debug`
- `lift`
- `aam`

Ordinea default in `CpRegistry`: `subquiz`, `equationTonomat`, `liftType`, `debug`, `lift`, `aam`.

`subquiz` si `liftType` sunt fortate in fata la normalizarea ordinii. Panourile pot fi mutate cu butoanele sus/jos; ordinea se salveaza in `LayoutConfig` la cheia `cpOrder`.

Eticheta panoului de subquiz este acum:

`Testeaza doar subquizul:`

## ASNW

Fisiere:

- `js/asnw-profile.js`
- `js/asnw-onboarding.js`

ASNW inseamna profil de arena simpla pentru new user. Master-ul este ON implicit. Multe efecte sunt `effective` doar daca master ON si flag-ul salvat este true.

Efecte importante:

- ascunde etichete de div-uri;
- poate simplifica titlul quizului;
- poate ascunde level info si hint;
- poate goli lista operatiilor;
- poate seta liftul in mod bara/fara urcare clasica;
- poate afisa onboarding vizual: mana, ripple, flux de numere spre `?`.

Testele acopera degradarea onboarding-ului pe zile si pe raspunsuri corecte.

## LayoutStage si LiftType

`js/layout-stage.js` controleaza raportul scenei telefonului. Intentia istorica: scena este stabila, nu se rescaleaza agresiv la fiecare resize al barelor browserului.

`js/lift-type.js` controleaza tipul de lift:

- question-in-lift/content;
- bar;
- ball.

`app.js` doar muta acelasi `.falling-inner` intre locuri, ca referintele motorului sa ramana valide.

## AAM - Acolada Axa Mere

Fisiere:

- `axe acolade mere/axe acolade mere.js`
- `js/aam-arena.js`

`AamArena` este adaptorul dintre quizuri si motorul vizual. Quizurile pot intoarce `getAamIllustration(state)`, iar AAM incearca sa parseze ecuatia si sa deseneze in zona de ilustratie.

EFF are protectii cand layoutul este swapped: evita QF-uri incompatibile cu ilustratia, zero-uri sau raspunsuri de tip semn.

## Persistenta

Persistenta principala este in `localStorage`.

Chei importante:

- `yl.layout.v1`: `LayoutConfig`, CP, ASNW, startup quiz, preferinte de layout.
- `prime-divisor-game:facts:v1`: `FactStore`, incercari si performante pe fact.
- `yl:mul1120v2:startStage`: subquizul de pornire pentru `T*/ 11-20 v2`.
- EFF profile/mistake registry au cheile lor in modulele `js/eff/*`.

Nu sterge localStorage sau `FactStore.resetAll()` fara cerere explicita.

## Motoare reutilizabile de quiz

### ConexeTableQuiz

Fisier: `js/conexe-table-quiz/engine.js`

Folosit de:

- `addition-table-conexe-helper`
- `subtraction-table-conexe-helper`
- `multiplication-table-conexe-helper`
- `division-table-conexe-helper`

Moduri pedagogice:

- M1: un fact fix, mai multe forme conexe. Aici se gradeaza performanta factului.
- M2: un format fix, mai multe facts. Greselile in M2 creeaza recovery M1.

Selectie facts:

- prefera facts performante;
- daca sunt prea putine, largeste pool-ul cu `corect_dar_lent`, `slab`, `praf`, `nou`;
- evita facts supra-antrenate, cu exceptia cazului in care toate sunt supra-antrenate.

Avansare nivel:

- dupa 4 macro-blocuri curate;
- o greseala rupe seria de macro-blocuri curate.

Timeout:

- este tratat ca gresit;
- pastreaza promptul si il pune in retry.

### EFFQuiz

Fisier: `js/eff-quiz/engine.js`

Folosit de helper-ele EFF pentru adunare/scadere/inmultire/impartire.

Concepte:

- Seria A: acelasi QF type, facts diferite.
- Seria B: acelasi fact, QF types diferite pentru restante.
- `QFGenerator` produce formele de ecuatii.
- `EFFMistakeRegistry` tine restantele.
- `EFFProfileStore` tine QF-urile active.

Avansare nivel:

- trebuie o serie A perfecta;
- toate restantele nivelului trebuie masterate.

### SuccesiveQuiz

Fisier: `js/succesive-quiz/engine.js`

Folosit de quizuri cu operatii succesive in acelasi lift.

Planificare:

- serie normala daca nu exista restante;
- cluster daca restantele sunt apropiate;
- injectie de restanta izolata daca sunt departate.

Avansare:

- cere serii perfecte consecutive si restante rezolvate.

## QFGenerator

Fisier: `js/eff/qf-generator.js`

Transforma un fact din `FactCatalog` in forme EFF. Un fact raw este:

`{ a, op, b, r }`

F1:

- `f1_initial`
- `f1_comutat`
- `f1_complementar`
- `f1_complementar_comutat`

F2:

- `doua_nr_in_STANGA`
- `doua_nr_in_DREAPTA`

F3 active in faza curenta:

- `trei_pozitii_pt_cate_un_numar`
- `doua_pozitii_pt_cate_un_semn_operator_matematic`

`getActiveQFTypes(profile)` intoarce tipurile active. `renderQF(qfType, fact)` intoarce promptul si raspunsul. `buildOptions` construieste cele 3 optiuni.

In T11-20, subquizurile intensive 5 si 6 folosesc QFGenerator doar cu raspuns numeric.

## Quiz: T*/ 11-20 v2

Fisier: `js/quizzes/multiplication-1120-v2.js`

Metadata:

- id: `multiplication-1120-v2`
- titlu: `T*/ 11-20 v2`
- order: `2`
- niveluri: 1..10
- factor nivel: `A = 10 + level`
- nivel 1 = tabla lui 11, nivel 10 = tabla lui 20

Constante:

- ancore pentru subquiz 1: `[2, 3, 4, 5, 15]`
- ancore pentru descompuneri: `[1, 2, 3, 4, 5, 10, 15, 20]`
- nonanchors: `[6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19]`
- intrebari pe anchor level: `21`
- intrebari intensive: `10`
- sesiuni intensive anchor necesare pentru next level: `2`
- default temporar de pornire: `nonAnchorProducts`
- localStorage: `yl:mul1120v2:startStage`

Optiuni CP:

- `Normal`
- `1 anchors`
- `2 intensiv`
- `3 valori ancore suma`
- `4 adunari rapide cu ancore`
- `5 adunare efectiva ancore`
- `6 inmultiri non-anchors`

In mod direct, butonul ales ruleaza doar acel subquiz pe nivelul curent, iar la iesire face next level, fara sa continue prin restul subquizurilor.

In mod normal, fluxul este:

1. anchors
2. intensiv cand apar doua facts gresite in anchor
3. valori ancore suma
4. adunari rapide cu ancore
5. adunare efectiva ancore
6. inmultiri non-anchors
7. next level sau final

### Subquiz 1 - anchors

Testeaza ancorele `[2, 3, 4, 5, 15]` pentru factorul nivelului.

Intrebarile sunt forme EFF numerice generate cu QFGenerator. Exista protectie sa nu apara prea des raspunsul banal egal cu factorul nivelului.

Ordinea ancorelor:

- trece prin toate ancorele intr-o tura;
- ordinea este crescatoare cu mici schimbari intre vecini.

Reguli:

- `answeredCount` creste la orice raspuns, corect sau gresit.
- Dupa `answeredCount >= 21`, subquizul se termina.
- Raspuns gresit pastreaza aceeasi intrebare pana la corectare, in afara cazului in care pragul de 21 este atins.
- Facts gresite distincte se adauga in `wrongFacts`.
- Cand sunt doua facts distincte gresite si elevul raspunde corect la intrebarea curenta, intra in modul intensiv, cu exceptia modului direct `1 anchors`.

### Subquiz 2 - intensiv anchors

Lucreaza doua facts anchor gresite.

Reguli:

- 2 facts;
- 5 repetari per fact;
- total 10 intrebari;
- ordine random;
- greselile nu blocheaza, avanseaza oricum prin cele 10 intrebari;
- in flux normal, dupa o sesiune revine la anchors;
- dupa 2 sesiuni intensive in acelasi nivel, trece mai departe in flux;
- in mod direct `2 intensiv`, foloseste test anchors `[2, 3]` si dupa 10 intrebari face next level.

### Subquiz 3 - valori ancore suma

Scop: elevul identifica valoarea termenului ancora lipsa in descompunerea unui nonanchor.

Descompunere nonanchor:

- 6..9 = 5 + rest
- 11..14 = 10 + rest
- 16..19 = 15 + rest

Exemple:

- `11*17=?+11*2`
- `11*17=11*15+?`

Optiunile sunt produse din aceeasi tabla, apropiate de ancora corecta.

Iesire:

- dupa 12 raspunsuri total;
- sau dupa 7 corecte consecutive.

In flux normal merge la subquiz 4. In mod direct face next level.

### Subquiz 4 - adunari rapide cu ancore

Scop: antrenarea transformarilor rapide ale sumelor de ancore.

Exemple:

- `165+44=165+40+?`
- `60+48=100+?`
- `65+52=65+50+?`
- `75+45=100+?`

Reguli de selectie:

- daca suma nu are trecere reala, se exclude;
- daca unul dintre termeni este divizibil cu 10, suma se exclude, cu exceptia cazurilor unde numarul mare se rotunjeste la suta urmatoare;
- daca ambele numere se termina in 5, suma se exclude, cu exceptia cazurilor care trec peste suta;
- cand numarul mare este aproape de urmatoarea suta, se foloseste rotunjire la suta;
- rotunjirea se face la valoarea cea mai apropiata;
- nu trebuie sa apara cazuri de tip `65+52=65+60-?` cand varianta apropiata este `65+50+?`.

Iesire:

- daca nu exista candidati: prompt `no candidates`, apoi mai departe cu mesaj de no candidates;
- daca exista un singur candidat: se repeta pana la primul raspuns corect;
- daca exista 2+ candidati: trece mai departe dupa `min(12, 3 * nrCandidati)` raspunsuri total, corecte sau gresite.

Comportament greseli/timeout:

- raspuns gresit pastreaza aceeasi intrebare;
- timeout pastreaza aceeasi intrebare;
- nu repeta imediat aceeasi intrebare daca exista alternative.

In flux normal merge la subquiz 5. In mod direct face next level.

### Subquiz 5 - adunare efectiva ancore

Scop: raspuns direct la suma efectiva a termenilor ancora.

Exemple:

- `55+11=?`
- `55+22=?`

Optiunile sunt numerice apropiate.

Selectie:

- evita repetarea imediata;
- dupa o intrebare, urmatoarea prefera un nonanchor la distanta aproximativa `+-3` fata de intrebarea curenta;
- daca nu exista, alege cea mai apropiata.

Iesire:

- dupa 21 raspunsuri principale total;
- sau dupa 10 corecte consecutive.

Greseli:

- raspuns gresit pastreaza aceeasi intrebare pana la corectare;
- dupa o greseala la o adunare, acea adunare este reprogramata peste 2-5 turns;
- greselile se acumuleaza per adunare;
- cand exista doua adunari cu `>= 2` greseli acumulate, dupa corectarea curenta intra in intensiv subquiz 5.

Intensiv subquiz 5:

- 2 adunari problema;
- 5 forme EFF per fact;
- total 10 intrebari;
- random order;
- foloseste `QFGenerator` si facts `add`;
- dupa cele 10 intrebari revine in fluxul normal al subquizului 5;
- intrebarile intensive nu sunt contorizate la cele 21 principale.

In flux normal merge la subquiz 6. In mod direct face next level.

### Subquiz 6 - inmultiri non-anchors

Scop: produs direct pentru tabla nivelului, dar numai nonanchors.

Nonanchors:

`[6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19]`

Exemple:

- `6*11=?`
- `17*11=?`
- `12*11=?`

Optiunile folosesc capcane cu aceeasi ultima cifra ca raspunsul corect.

Iesire:

- dupa toate cele 12 nonanchors raspunse corect consecutiv;
- sau dupa 21 intrebari principale total, indiferent de corect/gresit.

Greseli:

- raspuns gresit pastreaza aceeasi intrebare pana la corectare;
- cand sunt doua nonanchors distincte gresite, dupa corectarea curenta intra in intensiv.

Intensiv subquiz 6:

- 2 facts problema;
- 5 forme EFF per fact;
- total 10 intrebari;
- random order;
- facts `mul`, cu `a = bNonanchor`, `b = factorNivel`;
- intrebarile intensive nu se numara la cele 21 principale;
- dupa intensiv revine la fluxul normal al subquizului 6.

Dupa subquiz 6:

- in flux normal face next level;
- daca nivelul este 10, marcheaza quizul complet si afiseaza `Ai ajuns la final.`;
- nu trebuie sa reia nivelul 10 de la inceput.

### Panoul info T11-20

In `index.html` exista `divInfo11_20`, randat de `app.js` prin `quiz.getInfo11_20()`.

Afiseaza:

- modul curent;
- facts gresite;
- facts lucrate intensiv;
- intrebari/progres;
- sesiuni intensiv;
- timpi ultim corect pentru ancore.

Pentru subquizuri 5/6 intensive, mode-ul devine `Subquiz 5: intensiv` sau `Subquiz 6: intensiv`.

### T11-20 - detalii sensibile

- `DEFAULT_START_STAGE` este inca `nonAnchorProducts`, deci quizul porneste direct in subquiz 6 daca localStorage nu suprascrie.
- Daca se doreste revenirea la flux complet implicit, schimba default-ul la `normal` si actualizeaza testul aferent.
- `index.html` are cache-buster pentru acest fisier: `js/quizzes/multiplication-1120-v2.js?v=25`.
- Testele pentru T11-20 sunt in `tests/multiplication-1120-v2.test.js`.

## Quiz: Ecuatii cu 3 4 5 6 numere

Fisier: `js/quizzes/equations-e3-e6.js`

Metadata:

- id: `equations-e3-e6`
- titlu: `Ecuatii cu 3 4 5 6 numere`
- order: `-3`
- niveluri: 1..5
- default intrebari pe tura: 20

Familii:

- `E3`: `a = b + c`
- `E4`: `a = b + c + d`
- `E4_BAL`: `a + b = c + d`
- `E5`: `a = b + c + d + e`
- `E5_BAL`: `a + b = c + d + e`
- `E6`: `a + b + c = d + e + f`

Operatori disponibili:

- `+`
- `-`
- `*`
- `/`

Config default:

- familyId: `E3`
- operators: `["+"]`
- signMode: `same`
- showSummaryInArena: `true`
- questionsPerRun: `20`

Observatie: `normalizeConfig` forteaza momentan `signMode` la `same`. Cand sunt bifati mai multi operatori, intrebarea poate avea operatori mixti din pool, iar metadata intrebarii raporteaza `complementary` daca operatorii nu sunt toti identici.

Generare intrebari:

- nivelul creste pool-ul de termeni cu `maxTermForLevel(level) = min(9, 4 + level)`;
- lipsa `?` trece ciclic prin toate sloturile numerice;
- pentru familii cu laturi dezechilibrate, orientarea se poate inversa ca sa apara ambele directii;
- evita valori cunoscute comune vizibile pe ambele parti la familii mici;
- pentru `+`, construieste sume egale;
- pentru `-`, evita rezultate negative;
- pentru `*`, foloseste tuple dupa produs;
- pentru `/`, cere impartiri exacte;
- pentru operatori mixti, cauta expresii pe cele doua parti cu aceeasi valoare.

Raspunsuri:

- 3 optiuni numerice;
- distractori apropiati: +/-1, +/-2, +/-3, +/-5, +/-10, dublu/jumatate cand se poate.

Avansare:

- raspunsurile corecte cresc `answeredThisRun`;
- dupa `questionsPerRun`, tura se completeaza si nivelul creste pana la 5;
- la nivel 5, codul curent nu pare sa seteze automat `completed` la finalul turei; doar ramane la nivel 5 si continua ture. Daca se cere final explicit pentru acest quiz, verifica si modifica intentionat.

Timeout:

- logheaza incercarea ca gresita cu `timedOut: true`;
- pastreaza aceeasi intrebare.

Attempt log:

Fiecare raspuns inregistreaza:

- data;
- familia;
- operatorii;
- signMode;
- slotul lipsa;
- raspuns corect;
- raspuns user;
- corect/gresit;
- timeout;
- responseMs;
- prompt.

CP - `equationTonomat`:

- alegere familie;
- bife operatori;
- checkbox pentru detalii in lista din arena;
- numar de intrebari pe tura, intre 5 si 50;
- link partajabil cu `quiz=equations-e3-e6&cfg=<base64url>`;
- preview cu 5 intrebari.

Testele sunt in `tests/equations-e3-e6.test.js`.

## Alte quizuri inregistrate observate

Lista exacta depinde de ordinea scripturilor din `index.html`, dar in versiunea curenta sunt incarcate:

- `addition-table`
- `addition-table-range`
- `addition-table-singapore`
- `addition-table-singapore-missing`
- `addition-succesive`
- `addition-table-conexe-helper`
- `division-table-conexe-helper`
- `subtraction-table-conexe-helper`
- `multiplication-table-conexe-helper`
- `prime-divisors`
- `prime-divisions`
- `division-with-remainder`
- `equations-e3-e6`
- `sub-sau-langa-radical`
- `bagare-sub-radical`
- `addition-eff`
- `subtraction-eff`
- `multiplication-eff`
- `division-eff`
- `multiplication-1120-v2`

## Teste curente

Testele existente acopera:

- Conexe addition/subtraction/multiplication/division;
- ASNW profile;
- ASNW onboarding;
- lift type;
- level change reward;
- startup quiz si URL config;
- `equations-e3-e6`;
- radicale;
- `multiplication-1120-v2`.

Comanda completa curenta:

```powershell
node --test tests/*.test.js
```

Ultimul rezultat verificat dupa pull si dupa crearea acestui document: testele trebuie rulate din nou daca se modifica codul. La scanarea initiala dupa pull: 153/153 OK.

## Encoding si cache

Exista mojibake in mai multe texte din HTML/JS (`ÃŽ`, `È™`, etc.). Nu face reparatie globala de encoding fara cerere explicita. Ar produce dif mare si risc inutil.

`index.html` foloseste cache-busting manual:

- CSS: `style.css?v=82`
- T11-20: `multiplication-1120-v2.js?v=25`
- equations: `equations-e3-e6.js?v=5`
- app: `app.js?v=63`
- CP: `cp-registry.js?v=24`, `cp-shell.js?v=19`

Daca modifici un JS/CSS vazut in browser si utilizatorul testeaza prin localhost/GitHub Pages, creste query-ul relevant.

## Reguli practice pentru modificari viitoare

1. Verifica `git status --short`.
2. Citeste fisierul quizului/motorului relevant si testul aferent.
3. Pastreaza stilul global IIFE si contractul cu `window`.
4. Nu refactoriza motoare mari daca userul cere o regula punctuala.
5. Adauga sau ajusteaza teste Node pentru comportamentul cerut.
6. Daca e modificare vizuala sau de flow cu timer, verifica in browser cand se poate.
7. Pentru T11-20, ai grija la diferenta dintre `stage` si `mode`: `stage` decide subquizul mare, `mode` poate marca intensiv intern.
8. Pentru greseli: multe quizuri au regula "ramai pe aceeasi intrebare pana la corectare"; nu schimba asta accidental.
9. Pentru timeout: verifica explicit daca timeout trebuie sa conteze sau nu. In T11-20 timeout nu schimba intrebarea.
10. Pentru final de nivel 10, verifica `gameComplete` si `isCompleted()` ca motorul sa opreasca inputul.

## Puncte rapide de cautare

- Pornire quiz si URL config: `js/startup-quiz.js`, `js/app.js`
- Lista quizuri: `index.html`, `js/quiz-registry.js`
- CP subquiz: `js/app.js`, `js/cp-registry.js`, `js/cp-shell.js`
- Lift/cadere/timeout/reveal: `js/falling-engine.js`
- T11-20: `js/quizzes/multiplication-1120-v2.js`, `tests/multiplication-1120-v2.test.js`
- Ecuatii tonomat: `js/quizzes/equations-e3-e6.js`, `tests/equations-e3-e6.test.js`
- EFF forms: `js/eff/qf-generator.js`
- EFF engine: `js/eff-quiz/engine.js`
- Conexe engine: `js/conexe-table-quiz/engine.js`
- Succesive engine: `js/succesive-quiz/engine.js`
- ASNW: `js/asnw-profile.js`, `js/asnw-onboarding.js`
- AAM: `js/aam-arena.js`, `axe acolade mere/axe acolade mere.js`
- Layout scena: `js/layout-stage.js`, `style.css`

