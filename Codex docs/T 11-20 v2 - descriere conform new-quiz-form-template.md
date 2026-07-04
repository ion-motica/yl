# Descriere quiz T*/ 11-20 v2 conform new-quiz-form-template.txt

Surse analizate: structura proiectului, `Codex docs/project-map.md`, `index.html`, `js/app.js`, `js/quizzes/multiplication-1120-v2.js`, `js/eff/qf-generator.js`, `js/fact-catalog.js`, `style.css`, `tests/helpers/load-quiz-environment.js`.

## ca un formular cu campuri de completat cand iti cer un quiz nou sau sa modifici un quz existent. acum discutam cum sa facem acest formulr: sa nu fie nici f stufos/coplesitor  pt mine si sa fie clr si cuprinzator si pt tine si pt quiz sa iasacum trebuie

Acest document completeaza formularul pentru quiz-ul existent `T*/ 11-20 v2`. Descrierea este facuta din codul actual, nu din intentii viitoare. Quiz-ul este implementat in `js/quizzes/multiplication-1120-v2.js` si este incarcat in `index.html` dupa modulele EFF/QF, pentru ca foloseste `QFGenerator` si `FactCatalog`.

## nume quiz: exemplu: t20 v2

Nume quiz: `T*/ 11-20 v2`

ID registry: `multiplication-1120-v2`

Fisier principal: `js/quizzes/multiplication-1120-v2.js`

Titlu in meniu: `T*/ 11-20 v2`

Descriere registry: `Inmultirea 11-20: BUCATA 1 - doar test ancore.`

## are mai ulte tipuri de intrebari ? da

Da. Are un quiz mare `q1` cu doua sub-moduri pedagogice, care pot fi tratate ca `q2`:

1. `test anchors` / `anchor`: test pe ancorele `B = {2, 3, 4, 5, 15}`.
2. `intensiv`: antrenament de 10 intrebari pe doua facts gresite distincte.

In plus, intrebarile au multe `q forms`, generate de `QFGenerator`: forme de inmultire si impartire complementara, cu necunoscuta pe pozitii numerice diferite.

## definim termeni:

Termenii folositi in acest quiz:

- `A` = factorul fix al nivelului, calculat ca `10 + level`.
- `B` = ancora lucrata, una dintre `2, 3, 4, 5, 15`.
- `c` / `result` = produsul `A * B`.
- `fact` = obiect creat prin `FactCatalog.createFact({ operation: "mul", values: { a: A, b: B } })`.
- `q1` = quiz-ul mare `T*/ 11-20 v2`.
- `q2` = modul intern al quiz-ului: `anchor` sau `intensiv`.
- `q form` = forma concreta a ecuatiei afisate, generata din `QFGenerator`, distincta de subquiz.

## 	-pt facts : 	- a+b=c c:a=b - a, b sunt numerele mai mici, c este suma/ descazutul/ produsul / deimpartitul = numarul mai mare

Pentru acest quiz, fact-ul de baza este de inmultire:

`A * B = c`

Unde:

- `A` este factorul mare 11-20, fix pe nivel.
- `B` este ancora mica sau medie: 2, 3, 4, 5, 15.
- `c` este produsul, adica numarul mare.

Exemplu nivel 1:

- `A = 11`
- `B = 2`
- `c = 22`
- fact de baza: `11*2=22`
- forme conexe posibile: `2*11=22`, `22:2=11`, `22:11=2`, cu `?` pe pozitii numerice.

## 	- q1=quiz mare q2=subquiz/subquizuri

`q1` este `T*/ 11-20 v2`.

`q2`-urile reale din cod sunt modurile:

- `anchor` = test anchors.
- `intensiv` = antrenament intensiv pe doua facts gresite.

Ele nu sunt quiz-uri separate in `QuizRegistry`; sunt stari interne ale aceleiasi instante de quiz.

## 	- q form e distinct de subquiz

Da. `q form` este generat separat de modul curent.

Modul curent decide ce fact/ancora se lucreaza. `QFGenerator` decide forma ecuatiei: inmultire directa, comutata, impartire complementara, orientare cu numerele in stanga sau in dreapta egalului, si pozitia lui `?`.

Exemple pentru fact-ul `11*2=22`:

- `?*2=22`
- `11*?=22`
- `11*2=?`
- `22=?*2`
- `22=11*?`
- `?:2=11`
- `22:?=11`
- `22:2=?`
- `22=?*11`

## **nivel alegere subquiz q2 in cadrul quizului mare q1

Quiz-ul porneste mereu in `anchor`. Modul `intensiv` apare automat dupa ce copilul greseste doua facts distincte in `anchor`, apoi raspunde corect la intrebarea curenta.

Nu exista alegere manuala de `q2` in UI. Alegerea este controlata de logica quiz-ului.

## 	lista de nume q2s din q1

Lista q2:

- `anchor` / afisat ca `test anchors`
- `intensiv` / afisat ca `intensiv`

## 	reguli intrare si iesire din quiz mare q1

Intrare in `q1`:

- utilizatorul alege `T*/ 11-20 v2` din lista de quiz-uri;
- sau `StartupQuiz` il selecteaza ca quiz de pornire, daca asa este configurat.

Iesire din `q1`:

- utilizatorul selecteaza alt quiz;
- pagina se reincarca;
- nu exista stare `completed`; `isCompleted()` returneaza mereu `false`.

La intrare se creeaza o instanta noua prin `global.Mul1120V2Quiz.create({ quizId })`.

## 	reguli intrare si iesire din fiecare subquiz q2

`anchor`:

- intrare: la pornirea quiz-ului, la schimbare manuala de nivel, dupa terminarea unei sesiuni intensive daca nu s-au facut doua sesiuni intensive, si dupa avansarea la nivel nou;
- iesire: dupa doua facts gresite distincte si un raspuns corect ulterior se intra in `intensiv`; dupa 21 raspunsuri totale in anchor, corecte sau gresite, se avanseaza nivelul.

`intensiv`:

- intrare: cand exista doua facts distincte gresite in `anchor` si copilul raspunde corect la intrebarea curenta;
- iesire: dupa 10 intrebari intensive;
- dupa prima sesiune intensiva se revine la `anchor`;
- dupa doua sesiuni intensive in acelasi nivel se avanseaza la nivelul urmator.

## 	exista o ordine / pattern /regului in care apar (daca apar) sub-quizurile sau aleator?

Da, exista pattern:

1. Quiz-ul incepe in `anchor`.
2. `anchor` alege ancorele din `B = [2, 3, 4, 5, 15]`.
3. O tura trece prin toate ancorele exact o data.
4. Ordinea de baza este ascendenta, dar codul poate interschimba aleator ancore vecine.
5. Dupa doua facts distincte gresite si un raspuns corect, intra in `intensiv`.
6. `intensiv` foloseste cele doua ancore gresite: 5 intrebari pe prima si 5 pe a doua, amestecate aleator.
7. Dupa intensiv revine la `anchor`, cu exceptia cazului in care s-au facut deja doua sesiuni intensive pe nivel; atunci avanseaza nivelul.

## 	ce persistenta au datele colectate: facts gresite, timpi de raspuns etc

Persistenta este doar in memoria instantei curente de quiz.

Date colectate in timpul rularii:

- `wrongFacts`: facts distincte gresite in anchor;
- `factsLucrateIntensiv`: etichete pentru facts lucrate intensiv;
- `intensivFacts`: ancorele lucrate intensiv;
- `intensivQueue`: coada de 10 intrebari intensive;
- `intensivCount`: cate intrebari intensive au fost parcurse;
- `intensivSessionsDone`: cate sesiuni intensive s-au terminat in nivelul curent;
- `lastCorrectByB`: ultimul timp de raspuns corect pentru fiecare ancora;
- `answeredCount`: raspunsuri totale in anchor, corecte sau gresite;
- `anchorQueue`: ancore ramase in tura curenta;
- `recentFactorFlags`: limiteaza aparitia raspunsului egal cu factorul nivelului;
- `current`: intrebarea curenta.

Nu se foloseste `FactStore` pentru acest quiz.

## 		ce date persista dupa reload — nimic, doar nivelul, tot progresul, etc.

Dupa reload nu persista nimic din starea quiz-ului: nici nivelul quiz-ului, nici facts gresite, nici timpii de raspuns, nici sesiunile intensive, nici intrebarea curenta. Starea este reconstruita de la zero cand quiz-ul este recreat.

## ce date persista dupa reload — nimic, doar nivelul, tot progresul, etc.

Dupa reload nu persista nimic din starea quiz-ului.

Se pierd:

- nivelul curent al acestui quiz;
- facts gresite;
- timpii de raspuns;
- sesiuni intensive facute;
- coada de ancore;
- intrebarea curenta.

Comentariul din cod confirma intentia: reset la reload, fara persistenta si fara progres vizual.

## 		unde e stocat: nicaieri / var globala / bd etc

Starea este stocata in variabile locale inchise in closure-ul functiei `createQuiz`.

Nu este stocata in:

- `localStorage`;
- `FactStore`;
- baza de date;
- variabile globale publice, cu exceptia constructorului `global.Mul1120V2Quiz`.

## 		pana cand e stocat: sesiune quiz, sesiune yl, de la o sesiune yl la alta

Starea tine doar pe durata instantei curente de quiz.

Se reseteaza la:

- reload pagina;
- alegerea din nou a quiz-ului prin creare instanta noua;
- schimbarea manuala a nivelului;
- avansarea la nivel nou.

## **nivel definire - pt fiecare subquiz

Subquiz-urile nu au definitii separate de nivel; ambele folosesc acelasi `level` global al quiz-ului. Level-ul stabileste factorul fix `A = 10 + level`.

## 	nume q2:

`q2` 1: `anchor` / `test anchors`

`q2` 2: `intensiv`

## 	ce tip de intrebari contine fiecare q2 

`anchor` contine intrebari pe ancorele `B = 2, 3, 4, 5, 15`, pentru factorul nivelului curent `A`.

`intensiv` contine intrebari pe exact doua ancore gresite distincte din `anchor`, fiecare repetata de 5 ori, total 10 intrebari.

Ambele q2 folosesc aceleasi q forms numerice din `QFGenerator`.

## 		in ce forma apare intrebarea: q forms , ascii si/sau ilustratii etc

Intrebarea apare ca text ASCII in lift, prin proprietatea `prompt` returnata catre `FallingEngine`.

Nu exista `promptHtml` special si nu exista ilustratie AAM pentru acest quiz.

Q forms active:

- `f1_initial`
- `f1_comutat`
- `f1_complementar`
- `f1_complementar_comutat`
- `doua_nr_in_STANGA`
- `doua_nr_in_DREAPTA`
- `trei_pozitii_pt_cate_un_numar`

Q forms inactive:

- `doua_pozitii_pt_cate_un_semn_operator_matematic`

Se pastreaza doar q forms cu `answerType === "number"`.

## 		in ce forma apar variantele de raspuns 

Variantele apar ca 3 butoane text/numeric in zona de raspunsuri a arenei.

Fiecare varianta este string numeric:

- 1 raspuns corect;
- 2 capcane;
- ordinea este amestecata cu `GameUtils.shuffle`.

## 		ce valori au a b c? din ce domenii

Pentru acest quiz:

- `a` / `A` = `10 + level`, deci 11-20;
- `b` / `B` = una dintre ancorele `2, 3, 4, 5, 15`;
- `c` / `result` = `A * B`.

Domenii:

- nivel 1: `A = 11`;
- nivel 2: `A = 12`;
- ...
- nivel 10: `A = 20`;
- `B` este mereu in `{2, 3, 4, 5, 15}`.

Exemple:

- nivel 1, B=2: `11*2=22`;
- nivel 1, B=15: `11*15=165`;
- nivel 10, B=5: `20*5=100`;
- nivel 10, B=15: `20*15=300`.

## 	ce mesaje apar pt user pe parcursul q2	

Mesaje in `anchor`:

- raspuns corect normal: `Corect!`
- raspuns gresit: `<raspuns ales> nu e bun. Mai incearca!`
- avans la nivel dupa 21 raspunsuri totale in anchor, corecte sau gresite: alerta `ai raspuns la 21 de intrebari, next level`, banner si mesaj de nivel nou.
- intrare in intensiv: `Mod intensiv: antrenament pe ...`

Mesaje in `intensiv`:

- intrebare urmatoare: `Intensiv X/10`
- dupa terminarea primei sesiuni intensive: `Inapoi la test anchors.`
- dupa doua sesiuni intensive: alerta `ai terminat 2 sesiuni intensiv, next level`, banner si mesaj de nivel nou.

Hint comun: `Alege raspunsul corect.`

## 	reguli de alegere intrebari

In `anchor`:

- daca `anchorQueue` e goala, se construieste o tura noua cu toate ancorele `[2, 3, 4, 5, 15]`;
- ordinea porneste ascendenta, apoi uneori se interschimba elemente vecine;
- se extrage urmatoarea ancora din coada;
- se construieste un fact `A * B`;
- se alege aleator un q form numeric valid din `QFGenerator`;
- daca raspunsul numeric al q form-ului este chiar `A`, codul il limiteaza: maximum un raspuns de tip `A` in fereastra recenta de 5 intrebari.

In `intensiv`:

- se iau cele doua ancore gresite distincte;
- se construieste o coada de 10 pozitii: 5 pentru prima ancora, 5 pentru a doua;
- coada este amestecata aleator;
- pentru fiecare pozitie se genereaza q form numeric valid;
- se exclude complet q form-ul unde raspunsul ar fi chiar factorul `A`.

## 	Răspunsuri greșite (capcane): cum le generezi

Capcanele sunt generate numeric, cu aceeasi ultima cifra ca raspunsul corect. Codul cauta intai valori `correct +/- 10*k`, alege cele mai apropiate doua variante distincte, apoi amesteca raspunsul corect impreuna cu cele doua capcane.

## Răspunsuri greșite (capcane): cum le generezi

Capcanele sunt generate de `sameLastDigitOptions(correctNum, shuffle)`.

Reguli:

- raspunsul corect este numeric;
- capcanele cauta numere pozitive cu aceeasi ultima cifra ca raspunsul corect;
- se incearca valori `correct - 10*k` si `correct + 10*k`, pentru `k = 1..15`;
- pentru raspunsuri mici se incearca fallback `correct +/- 1` si `correct +/- 2`, dar tot prin filtrul de ultima cifra, deci fallback-ul ajuta doar cand respecta filtrul;
- se aleg cele mai apropiate doua capcane;
- daca nu sunt suficiente, se completeaza cu `correct + 10`, `correct + 20`;
- se amesteca cele trei optiuni.

Nu apar duplicate, pentru ca se foloseste `Set` pe valori numerice.

## 	Feedback UI (panou info, highlight rapid, mesaje, , divuri active sau inactive)

Feedback specific:

- panoul `divInfo11_20` este vizibil doar pentru quiz-urile care au `getInfo11_20`;
- afiseaza `Mod`, `Facts gresite`, `Facts lucrate intensiv`, `Intrebari`, `Sesiuni intensiv`, `Timp ultim corect`;
- cand modul este `intensiv`, panoul primeste clasa `is-intensiv` si devine vizual rosiatic;
- timpul ultimului raspuns corect se coloreaza cu highlight verde daca este `<= 1500 ms`;
- progresul standard cu stele/cercuri este ascuns prin `getProgressDisplay() => ProgressDisplay.hidden()`;
- la raspuns gresit se intoarce `flash: "wrong"`;
- la raspuns corect se foloseste `bounce: true`;
- la nivel nou se foloseste `flash: "win"`, `banner`, `message`, `runComplete`, `levelAdvanced`.

## 	Ilustratii-de care, in ce div

Quiz-ul nu trimite ilustratii catre AAM.

Nu implementeaza:

- `getAamIllustration`;
- `advanceIfSwapIncompatible`;
- `divisionHistory`;
- `successionHistory`;
- ilustratie in `div-ilustrare-din-arena`;
- ilustratie in `div-ilustrare-in-lift`.

Intrebarea ramane text in lift.

## 	cam asta ar fi, la granulatie mare, nu? vorbim deocamdata de structura vazuta de sus

Da. La granulatie mare, structura este:

- `q1`: `T*/ 11-20 v2`;
- `level`: alege factorul mare 11-20;
- `q2 anchor`: testeaza ancorele 2,3,4,5,15 in q forms numerice;
- `q2 intensiv`: apare dupa doua facts gresite distincte si lucreaza 10 intrebari pe cele doua facts;
- `q forms`: generate separat de `QFGenerator`;
- feedback: panou special `divInfo11_20`, nu progres standard;
- persistenta: inexistenta dupa reload.

## **definire levels

Levels sunt 1-10.

Formula:

`A = 10 + level`

Deci:

- nivel 1 = tabla/factorul 11;
- nivel 2 = tabla/factorul 12;
- ...
- nivel 10 = tabla/factorul 20.

## 	ce inseamna level 1,2,3 etc

Level 1: `A = 11`, facts `11*2`, `11*3`, `11*4`, `11*5`, `11*15`.

Level 2: `A = 12`, facts `12*2`, `12*3`, `12*4`, `12*5`, `12*15`.

Level 3: `A = 13`, facts `13*2`, `13*3`, `13*4`, `13*5`, `13*15`.

Level 4: `A = 14`, facts `14*2`, `14*3`, `14*4`, `14*5`, `14*15`.

Level 5: `A = 15`, facts `15*2`, `15*3`, `15*4`, `15*5`, `15*15`.

Level 6: `A = 16`, facts `16*2`, `16*3`, `16*4`, `16*5`, `16*15`.

Level 7: `A = 17`, facts `17*2`, `17*3`, `17*4`, `17*5`, `17*15`.

Level 8: `A = 18`, facts `18*2`, `18*3`, `18*4`, `18*5`, `18*15`.

Level 9: `A = 19`, facts `19*2`, `19*3`, `19*4`, `19*5`, `19*15`.

Level 10: `A = 20`, facts `20*2`, `20*3`, `20*4`, `20*5`, `20*15`.

## 	cand se trece la nivelul urmator

Se trece la nivelul urmator in doua situatii:

1. In `anchor`, dupa `answeredCount >= 21`. Important: `answeredCount` creste la fiecare raspuns in anchor, indiferent daca este corect sau gresit.
2. In `intensiv`, dupa `INTENSIV_SESSIONS_PER_LEVEL = 2` sesiuni intensive terminate in acelasi nivel.

La avans:

- se afiseaza alerta;
- `level` creste cu 1, pana la maximum 10;
- se reseteaza toata starea nivelului;
- se porneste o intrebare noua in `anchor`.

Observatie: la nivel 10, `Math.min(MAX_LEVEL, level + 1)` ramane 10; quiz-ul nu are final complet.

## 	daca un level contine o succesiune de subquizuri: in ce ordine, cu ce ciclicitate

Da, un level poate contine o succesiune de subquizuri:

1. `anchor` implicit.
2. Daca apar doua facts gresite distincte si apoi un raspuns corect: `intensiv`.
3. Dupa 10 intrebari intensive:
   - daca este prima sesiune intensiva din nivel, revine la `anchor`;
   - daca este a doua sesiune intensiva, avanseaza nivelul.
4. Daca in `anchor` ajunge la 21 raspunsuri totale, corecte sau gresite, inainte de doua sesiuni intensive, avanseaza nivelul.

Nu exista ciclu fix obligatoriu pentru intensiv; apare doar declansat de greseli.

## **alte mentiuni

Mentiuni importante din analiza proiectului:

- Quiz-ul este incarcat in `index.html` cu `js/quizzes/multiplication-1120-v2.js?v=13`.
- Ordinea scripturilor conteaza: `QFGenerator`, `FactCatalog`, `ProgressDisplay`, `QuizRegistry`, `GameUtils` trebuie sa existe inainte ca quiz-ul sa functioneze.
- Nu exista teste automate dedicate acestui quiz in `tests/`.
- Test helper-ul curent nu incarca `multiplication-1120-v2.js` si nici `QFGenerator`, deci ar trebui extins daca se adauga teste.
- Codul are mojibake in comentarii si texte din unele fisiere, dar in browser textele vizibile pot aparea corect daca fisierele sunt servite UTF-8; nu trebuie facut fix encoding larg fara cerere separata.
- `getInfo11_20()` este singura iesire de debug/observare specifica quiz-ului, dar variabilele interne nu sunt expuse direct pe `window`.
- Daca vrem urmarire live a variabilelor interne, ar fi util un hook temporar `window.__YL_DEBUG__` sau o metoda de debug pe quiz.
- Quiz-ul se numeste "BUCATA 1" in comentarii: nu are EFF, mastery, faze 2-3, persistenta, progres vizual standard sau final complet.
