# Youlearn / yl - harta rapida pentru Codex

Ultima analiza: 2026-07-03.

Scopul documentului: sa reduca timpul de orientare la interventii viitoare. Nu este documentatie pentru utilizator final, ci memorie tehnica pentru Codex.

## Rezumat

`yl` este o aplicatie web statica pentru quiz-uri matematice, livrata probabil prin GitHub Pages. Nu exista build step. `index.html` incarca direct CSS si multe scripturi browser globale, in ordine stricta. Majoritatea modulelor expun obiecte pe `window`, de exemplu `QuizRegistry`, `FallingEngine`, `LayoutConfig`, `AsnwProfile`.

Repo local analizat:

`C:\Users\motica.ion\Projects\yl`

Remote:

`https://github.com/ion-motica/yl.git`

Branch:

`master`

Git poate cere safe directory din cauza ownership-ului Windows. Pentru comenzi fara schimbare globala foloseste:

```powershell
git -c safe.directory=C:/Users/motica.ion/Projects/yl status --short --branch
```

La analiza existau doua fisiere noi neincluse in Git:

- `documente de referinta/2026.07.02 rezumat chat w creare quz impartire cu rest.md`
- `documente de referinta/ION_LOCK Note Ion 2026.07.02.md`

## Comenzi utile

Aplicatia este statica. Pentru vizualizare locala se poate porni un server simplu din radacina proiectului, apoi se deschide `index.html`.

Testele existente:

```powershell
node --test (Get-ChildItem tests -Filter *.test.js | ForEach-Object { $_.FullName })
```

Rezultat la analiza: 94 teste trecute, 0 esuate.

Scriptul din `package.json` ruleaza doar un test:

```powershell
npm test
```

## Structura de top

- `index.html` - layout principal, incarca toate scripturile browser in ordine.
- `style.css` - aproape tot stylingul, inclusiv layout mobil/desktop, lift, CP, ASNW.
- `preview.html` - probabil pagina alternativa de preview.
- `js/` - logica principala.
- `tests/` - teste Node `node:test`, fara browser real.
- `documente de referinta/` - documentatie si exploratoare pentru EFF/AAM.
- `axe acolade mere/` - motor vizual AAM separat, incarcat in aplicatia principala.
- `Dansul albinelor EFF/`, `facts din coloane animate/` - experimente sau pagini separate.

## Pornirea aplicatiei

`index.html` creeaza trei zone mari:

- `divArena` - ecranul de telefon / arena principala.
- `divMeniu` - lista quiz-uri si niveluri; drawer pe mobil, coloana pe desktop.
- `divCp` - control panels; overlay pe mobil, coloana pe desktop.

`js/app.js` este compozitorul principal:

- strange referintele DOM in obiectul `dom`;
- alege quiz-ul initial prin `StartupQuiz`;
- initializeaza `QuizRegistry`, `CpShell`, `AamArena`, `LayoutStage`, `FallingEngine`;
- construieste selectorul de quiz-uri si niveluri;
- muta aceleasi noduri DOM intre layout mobil si tabel desktop cu 3 coloane;
- conecteaza profilul ASNW, onboarding-ul, lift type, reward-uri si panourile CP.

Important: scripturile sunt globale IIFE, nu import/export. Ordinea din `index.html` este contract implicit.

## Contract quiz

Un quiz inregistrat in `QuizRegistry` are metadata:

- `id`
- `title`
- `description` optional
- `order` optional
- `create(meta)` care intoarce instanta quiz-ului

Instanta quiz-ului trebuie sa ofere, in practica:

- `getLevel()`
- `getMaxLevel()`
- `getMinLevel()`
- `getLevelLabel()`
- `getLevelButtonTitle(level)`
- `switchLevel(level)`
- `isCompleted()`
- `pickNextRound()`
- `beginRound(next?)`
- `onAnswer(index, meta?)`
- `onTimeout(meta?)`
- `getFallSpeedFactor()` optional
- `shouldBounceToTop()` optional
- `getProgressDisplay()` optional
- `getAamIllustration(state)` optional
- `advanceIfSwapIncompatible()` optional

Runda returnata catre `FallingEngine` foloseste de obicei:

- `prompt` sau `promptHtml`
- `options`
- `correctIndex`
- `hintMessage`
- `divisionHistory`
- `successionHistory`
- `questionFormat`
- `resetFall`
- `bounce`
- `runComplete`
- `gameComplete`
- `levelAdvanced`
- `nextRound`
- `message`
- `banner`
- `flash`

## Motoare principale

### FallingEngine

Fisier: `js/falling-engine.js`

Este motorul UI comun: caderea liftului, pauza, input 1/2/3, timeout, animatia raspunsului care urca, bounce, reveal raspuns, rendering prompt/optiuni/istoric. Nu decide pedagogia quiz-ului; apeleaza `quiz.onAnswer` si `quiz.onTimeout`.

Zone sensibile:

- calculeaza dimensiuni reale din DOM, deci modificarile CSS pot afecta viteza si pozitionarea;
- gestioneaza modurile de lift `content`, `bar`, `ball`;
- poate muta intrebarea intre lift si slotul de ilustratie prin `swapQuestionIllustration`;
- foloseste `AsnwOnboarding.notifyAnswer` si `notifyNewQuestion`.

### ConexeTableQuiz

Fisier: `js/conexe-table-quiz/engine.js`

Motor reutilizabil pentru quiz-uri de tip "intrebari ajutatoare" pe table. Are doua macro-moduri:

- M1 - un fact fix, mai multe forme conexe; noteaza performanta factului;
- M2 - un format fix, mai multe facts; greselile din M2 duc la recovery M1.

Persistenta de fact-uri se face prin `FactStore`. Nivelul avanseaza dupa 4 macro-blocuri curate.

Adapterele sunt in:

- `js/conexe-table-quiz/adapters/addition.js`
- `js/conexe-table-quiz/adapters/subtraction.js`
- `js/conexe-table-quiz/adapters/multiplication.js`
- `js/conexe-table-quiz/adapters/division.js`

Quiz-uri care il folosesc:

- `addition-table-conexe-helper`
- `subtraction-table-conexe-helper`
- `multiplication-table-conexe-helper`
- `division-table-conexe-helper`

### EFFQuiz

Fisier: `js/eff-quiz/engine.js`

Motor pentru Extended Fact Family. Foloseste:

- `QFGenerator` pentru tipuri de forma intrebare;
- `EFFProfileStore` pentru configuratie activa;
- `EFFMistakeRegistry` pentru restante;
- optional AAM illustration via `getAamIllustration`.

Seria A: acelasi QF type, facts diferite. Seria B: acelasi fact, QF types diferite pentru restante. Avansarea cere serie A perfecta si toate restantele masterate.

### SuccesiveQuiz

Fisier: `js/succesive-quiz/engine.js`

Motor pentru operatii succesive in acelasi lift. Planifica serii normale, cluster de restante apropiate sau injectie de restanta izolata. Foloseste `SuccesiveMistakeRegistry` si `SpeedManager`.

## Registrul de quiz-uri

Fisier: `js/quiz-registry.js`

Este un `Map` global simplu. `QuizRegistry.list()` sorteaza dupa `order`. `createActive()` creeaza quiz-ul activ din metadata. Adaugarea unui quiz nou inseamna de obicei:

1. creezi fisier in `js/quizzes/`;
2. inregistrezi cu `global.QuizRegistry.register({...})`;
3. adaugi `<script>` in `index.html` in ordinea corecta;
4. adaugi teste daca logica este noua sau riscanta.

Quiz-uri inregistrate observate:

- `addition-table`
- `addition-table-range`
- `addition-table-singapore`
- `addition-table-singapore-missing`
- `addition-table-conexe-helper`
- `addition-succesive`
- `subtraction-table-conexe-helper`
- `multiplication-table-conexe-helper`
- `division-table-conexe-helper`
- `prime-divisors`
- `prime-divisions`
- `division-with-remainder`
- `bagare-sub-radical`
- `addition-eff`
- `subtraction-eff`
- `multiplication-eff`
- `division-eff`
- `multiplication-1120-v2`

## Persistenta

Datele sunt in `localStorage`.

Chei importante:

- `prime-divisor-game:facts:v1` - `FactStore`, incercari si statistici pe fact.
- `yl.layout.v1` - `LayoutConfig`, preferinte layout/CP/ASNW/onboarding.
- EFF profile si mistake registry au propriile chei in modulele `js/eff/*`.

`FactStore` normalizeaza fact-uri prin `FactCatalog`, tine `dailyStats`, totaluri, SDP si campuri pentru Conexe:

- `performantaLaConexeFact`
- `deCateOriAavutPerformantLaConexe`
- `conexeM1GradedDay`

## ASNW

Fisiere:

- `js/asnw-profile.js`
- `js/asnw-onboarding.js`

`AsnwProfile` controleaza un profil "arena simpla pt new user". Master este ON implicit. Cand master ON, multe optiuni sunt aplicate prin `effective = masterOn && storedFlag`.

Presetul ASNW porneste:

- ascundere etichete div-uri;
- titlu simplificat pentru unele quiz-uri;
- ascundere level info si hint;
- lista operatii goala;
- lift fara urcare / teleport sus;
- intrebare fixa cu lift bara;
- onboarding vizual.

`AsnwOnboarding` adauga strat vizual peste butoane: mana, ripple, flux de numere catre semnul `?`. Are degradare pe zile si raspunsuri corecte consecutive. Testele acopera aceasta logica.

## Layout si panouri CP

`CpRegistry` si `CpShell` creeaza panourile de control. Panourile inregistrate in `app.js`:

- `liftType`
- `lift`
- `aam`
- `debug`

`LayoutStage` fixeaza raportul scenei telefonului, implicit `1:2`, si intentionat nu rescaleaza la fiecare resize al barelor browserului. Se remasoara la orientation change si la treceri mobil/desktop.

Pe desktop, `app.js` creeaza dinamic un tabel cu 3 coloane si muta `divArena`, `divMeniu`, `divCp`. Pe mobil, acestea revin ca frati in `.game`.

## AAM / Acolada Axa Mere

Fisiere:

- `axe acolade mere/axe acolade mere.js`
- `js/aam-arena.js`

`AamArena` este adaptorul dintre quiz-uri si motorul vizual AAM. Primeste ecuatia de la quiz prin `getAamIllustration(state)`, normalizeaza promptul, verifica daca se poate parsa, apoi deseneaza static sau animat in zona de ilustratie.

Cand layoutul e swapped, ilustratia poate fi desenata in lift, iar intrebarea sta in zona de ilustratie. Exista compatibilitati speciale pentru EFF ca sa evite intrebari cu zero sau raspunsuri semn cand swap-ul nu poate functiona bine.

## Teste

Testele sunt Node, fara DOM real complet. `tests/helpers/load-quiz-environment.js` incarca scripturile browser prin `new Function("window", code)` si seteaza `globalThis.window = globalThis`.

Acoperire observata:

- Conexe addition/division/subtraction/multiplication;
- ASNW profile;
- ASNW onboarding;
- lift type;
- level change reward;
- startup quiz.

Pentru adaugari in quiz-uri, prefera teste de motor/adapter in acelasi stil, nu teste E2E grele.

## Observatii si riscuri

- Exista mojibake in unele fisiere incarcate (`ÃŽ`, `È™`, `â€”`, etc.). Unele fisiere sunt corecte, altele par salvate/afisate cu encoding gresit. Nu face "fix encoding" larg fara cerere explicita, pentru ca poate produce dif mare si risc pe texte.
- `index.html` are cache-busting manual `?v=...` pe CSS/JS. Daca modifici fisiere pentru GitHub Pages si browserul poate ramane cu cache vechi, probabil trebuie crescut query-ul relevant.
- Script order conteaza. Un modul poate presupune ca alt global exista deja.
- `FallingEngine` are multa stare interna si multe interactiuni cu CSS; modificarile vizuale trebuie verificate in browser, nu doar prin teste Node.
- ASNW master este ON implicit. Daca o schimbare "nu se vede", verifica intai flag-urile effective din ASNW si clasele CSS aplicate pe `#game`.
- `LayoutStage` nu asculta resize normal intentionat; nu adauga listener de resize fara sa intelegi cerinta cu barele browserului.
- `FactStore.resetAll()` este folosit in teste; nu folosi in aplicatie fara intentie, sterge progresul local.

## Unde sa caut rapid

- Schimbare lista quiz-uri / quiz activ initial: `js/quiz-registry.js`, `js/startup-quiz.js`, `index.html`.
- Schimbare comportament raspuns/cadere/lift: `js/falling-engine.js`, `js/lift-type.js`, CSS pentru `.falling`, `.rising`, `.option`.
- Schimbare progres/stelute/cercuri rosii: `js/progress-display.js`, `js/progress.js`, `app.js` `renderProgress`.
- Schimbare Conexe: `js/conexe-table-quiz/engine.js` si adapterul operatiei.
- Schimbare EFF: `js/eff-quiz/engine.js`, `js/eff/qf-generator.js`, adapterul operatiei, `js/eff/*store/registry`.
- Schimbare onboarding new user: `js/asnw-profile.js`, `js/asnw-onboarding.js`, CSS clase `asnw-*`.
- Schimbare AAM: `js/aam-arena.js`, `axe acolade mere/axe acolade mere.js`.
- Schimbare layout mobil/desktop: `js/app.js`, `js/layout-stage.js`, `style.css`.

## Regula practica pentru interventii viitoare

Inainte de modificari:

1. Verifica `git status` cu safe.directory.
2. Citeste fisierul motorului relevant si testele aferente.
3. Evita refactor mare; proiectul foloseste global-uri si contracte implicite.
4. Dupa modificari, ruleaza testele Node de mai sus.
5. Pentru schimbari vizuale, verifica in browser la mobil si desktop.
