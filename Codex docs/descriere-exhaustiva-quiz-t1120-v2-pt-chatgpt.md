# Descriere exhaustiva pentru ChatGPT - quiz T*/ 11-20 v2

Acest text descrie quizul existent `T*/ 11-20 v2`, implementat in proiectul YL in fisierul `js/quizzes/multiplication-1120-v2.js`.

Scopul descrierii: vreau sa discut cu ChatGPT ce ar trebui facut in continuare cu acest quiz: ce pastrez, ce simplific, ce rafinez pedagogic, cum il fac mai coerent pentru copil si cum il aliniez cu arhitectura generala a proiectului.

## 1. Identitate quiz

- Nume afisat in meniu: `T*/ 11-20 v2`
- ID in registry: `multiplication-1120-v2`
- Fisier principal: `js/quizzes/multiplication-1120-v2.js`
- Script incarcat in `index.html`: `js/quizzes/multiplication-1120-v2.js?v=25`
- Descriere registry: inmultirea 11-20, bucata de lucru pentru tabla 11-20.
- Quizul foloseste:
  - `QuizRegistry`, pentru inregistrare si selectie;
  - `GameUtils`, pentru random si shuffle;
  - `ProgressDisplay.hidden()`, ca sa ascunda progresul standard;
  - `FactCatalog`, pentru facts de inmultire/adunare in unele forme;
  - `QFGenerator`, pentru forme variate de intrebari la ancore si intensiv.

## 2. Scop pedagogic general

Quizul antreneaza tabla inmultirii pentru factorii mari 11-20.

Ideea centrala este:

1. Copilul are un factor mare fix pe nivel, numit `A`.
2. Pentru acel `A`, copilul lucreaza mai intai produse cu ancore usoare.
3. Apoi foloseste ancorele ca sa compuna produse non-ancora.
4. La final ajunge sa raspunda direct la produse non-ancora.

Exemplu pentru nivelul 1:

- `A = 11`
- ancore: `11*2`, `11*3`, `11*4`, `11*5`, `11*15`
- non-ancore: `11*6`, `11*7`, `11*8`, `11*9`, `11*11`, `11*12`, `11*13`, `11*14`, `11*16`, `11*17`, `11*18`, `11*19`
- strategii implicite:
  - `11*6 = 11*5 + 11*1`
  - `11*12 = 11*10 + 11*2`
  - `11*18 = 11*15 + 11*3`

## 3. Niveluri

Quizul are niveluri de la 1 la 10.

Formula:

```text
A = 10 + level
```

Nivelurile sunt:

- nivel 1: factorul 11
- nivel 2: factorul 12
- nivel 3: factorul 13
- nivel 4: factorul 14
- nivel 5: factorul 15
- nivel 6: factorul 16
- nivel 7: factorul 17
- nivel 8: factorul 18
- nivel 9: factorul 19
- nivel 10: factorul 20

La fiecare nivel se reseteaza starea interna: greseli, cozi de intrebari, mod intensiv, streakuri, timpi, progres de subquiz.

La finalul nivelului 10, `advanceLevel()` marcheaza quizul complet si afiseaza mesajul `Ai ajuns la final.`

## 4. Domenii numerice

### Factor mare

`A` este mereu intre 11 si 20.

### Ancore de baza

Ancorele principale sunt:

```text
[2, 3, 4, 5, 15]
```

Ele apar in subquizul 1 si in intensivul asociat.

### Ancore folosite ca parti de compunere

Pentru compuneri si distractori exista si lista:

```text
[1, 2, 3, 4, 5, 10, 15, 20]
```

### Non-ancore

Non-ancorele sunt:

```text
[6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19]
```

Acestea sunt factorii mici care nu sunt considerati ancore si care trebuie invatati prin descompunere sau produs direct.

## 5. Descompunerea non-ancorelor

Quizul descompune factorul non-ancora `b` in doua ancore:

```text
daca b >= 16: b = 15 + (b - 15)
daca b >= 11: b = 10 + (b - 10)
altfel:       b = 5 + (b - 5)
```

Exemple:

- `6 = 5 + 1`
- `8 = 5 + 3`
- `12 = 10 + 2`
- `14 = 10 + 4`
- `16 = 15 + 1`
- `19 = 15 + 4`

Aceasta descompunere este fundamentul subquizurilor 3, 4 si 5.

## 6. Subquizuri/stadii existente

In cod exista 6 stadii pedagogice:

1. `anchors` / `normal` - test pe ancore
2. `intensiv` - antrenament intensiv pe doua ancore gresite
3. `anchorSumValues` - valori de ancore in sume
4. `rapidAnchorAdditions` - adunari rapide cu produse-ancora
5. `effectiveAnchorAddition` - adunarea efectiva a doua produse-ancora
6. `nonAnchorProducts` - inmultiri directe cu non-ancore

Important: codul are si un selector de pornire pentru testarea directa a subquizurilor. In prezent, default-ul din cod este:

```text
DEFAULT_START_STAGE = "nonAnchorProducts"
```

Asta inseamna ca, daca nu exista alta alegere salvata in `localStorage`, quizul porneste direct in subquizul 6. Pare o setare temporara de dezvoltare/testare, nu neaparat flowul pedagogic final.

Optiunile de pornire disponibile in panoul de control sunt:

- `Normal`
- `1 anchors`
- `2 intensiv`
- `3 valori ancore suma`
- `4 adunari rapide cu ancore`
- `5 adunare efectiva ancore`
- `6 inmultiri non-anchors`

Selectia se salveaza in `localStorage` la cheia:

```text
yl:mul1120v2:startStage
```

## 7. Flow normal complet

Daca optiunea este `Normal`, flowul este:

```text
Subquiz 1 anchors
  -> eventual Subquiz 2 intensiv, declansat de greseli
  -> dupa terminarea anchors: Subquiz 3
  -> dupa terminarea Subquiz 3: Subquiz 4
  -> dupa terminarea Subquiz 4: Subquiz 5
  -> dupa terminarea Subquiz 5: Subquiz 6
  -> dupa terminarea Subquiz 6: nivelul urmator
```

In modurile directe, cand alegi un subquiz anume din panoul de control, terminarea acelui subquiz avanseaza direct la nivelul urmator si ramane in acelasi subquiz.

Exemplu: daca aleg `5 adunare efectiva ancore`, dupa ce termin subquizul 5 la nivelul 1, quizul trece la nivelul 2 tot in subquizul 5.

## 8. Subquiz 1 - anchors / test ancore

Scop: testeaza produsele cu ancorele principale:

```text
A*2, A*3, A*4, A*5, A*15
```

Unde `A` este factorul nivelului.

La nivel 1, facts sunt:

- `11*2`
- `11*3`
- `11*4`
- `11*5`
- `11*15`

Intrebarile nu sunt doar forma directa `A*b=?`. Ele folosesc forme generate de `QFGenerator`, inclusiv inmultire comutata si impartiri complementare, dar doar cu raspuns numeric.

Forme QF active:

- `f1_initial`
- `f1_comutat`
- `f1_complementar`
- `f1_complementar_comutat`
- `doua_nr_in_STANGA`
- `doua_nr_in_DREAPTA`
- `trei_pozitii_pt_cate_un_numar`

Forma QF inactiva:

- `doua_pozitii_pt_cate_un_semn_operator_matematic`

Reguli de alegere:

- exista o coada de ancore;
- o tura trece prin toate ancorele `[2, 3, 4, 5, 15]`;
- ordinea porneste crescator, dar codul poate interschimba aleator elemente vecine;
- dupa ce coada se goleste, se construieste o tura noua;
- quizul limiteaza intrebarile unde raspunsul corect este chiar factorul `A`, ca sa nu apara prea des variante banale.

Reguli de iesire:

- dupa 21 raspunsuri totale in anchors, corecte sau gresite, se termina subquizul 1;
- in flow normal, se intra in subquizul 3;
- in mod direct `anchorsOnly`, se trece la nivelul urmator.

Greseli:

- daca raspunsul este gresit, intrebarea ramane aceeasi;
- factul gresit se adauga in lista `wrongFacts`, dar doar o data per ancora;
- daca exista doua ancore distincte gresite, copilul trebuie mai intai sa raspunda corect la intrebarea curenta;
- dupa acel raspuns corect, se intra in subquizul 2 intensiv, cu cele doua ancore gresite.

Timeout:

- daca bara cade, timeoutul este ignorat ca greseala;
- se reseteaza bara si ramane aceeasi intrebare.

## 9. Subquiz 2 - intensiv pe ancore

Scop: antreneaza doua ancore gresite in subquizul 1.

Intrare:

- automat, dupa doua facts distincte gresite in anchors si un raspuns corect ulterior;
- sau direct, din optiunea `2 intensiv`.

In mod direct, intensivul porneste cu ancorele `[2, 3]`.

Reguli:

- ia doua ancore problematice;
- face o coada de 10 intrebari;
- 5 intrebari sunt pentru prima ancora si 5 pentru a doua;
- ordinea este amestecata;
- in intensiv, greselile sunt ignorate pentru progres: orice raspuns consuma o intrebare din cele 10;
- intrebarile folosesc QF forms numerice;
- se exclude forma in care raspunsul ar fi chiar factorul `A`.

Iesire:

- dupa 10 intrebari;
- daca este prima sesiune intensiv din nivel, revine la anchors;
- dupa doua sesiuni intensive in acelasi nivel, in flow normal trece mai departe la subquizul 3;
- in mod direct `intensivOnly`, dupa cele 10 intrebari trece la nivelul urmator.

## 10. Subquiz 3 - valori ancore suma

Nume intern:

```text
anchorSumValues
```

Titlu afisat:

```text
valori ancore suma
```

Scop: copilul invata sa vada produsul non-ancora ca suma de produse-ancora si sa identifice valoarea produsului-ancora lipsa.

Pentru un non-anchor `b`, quizul calculeaza:

```text
b = anchor_mare + anchor_mic
A*b = A*anchor_mare + A*anchor_mic
```

Promptul poate avea forma:

```text
A*b=?+A*anchor_afisat
```

sau:

```text
A*b=A*anchor_afisat+?
```

Raspunsul corect este valoarea produsului-ancora lipsa, adica:

```text
A * anchor_lipsa
```

Exemplu nivel 1:

```text
11*6=?+11*1
```

Raspunsul este `55`, fiindca `6 = 5 + 1`, deci lipseste `11*5`.

Distractorii sunt valori din aceeasi tabla `A*anchor`, folosind ancore apropiate si lista de ancore `[1,2,3,4,5,10,15,20]`.

Reguli de iesire:

- dupa 12 raspunsuri totale;
- sau dupa 7 raspunsuri corecte consecutive;
- in flow normal, trece la subquizul 4;
- in mod direct, trece la nivelul urmator.

Greseli:

- daca raspunsul este gresit, se contorizeaza intrebarea si streakul se reseteaza;
- quizul genereaza o intrebare noua dupa raspuns, chiar daca a fost gresit.

## 11. Subquiz 4 - adunari rapide cu ancore

Nume intern:

```text
rapidAnchorAdditions
```

Titlu afisat:

```text
adunari rapide cu ancore
```

Scop: copilul exerseaza transformari rapide ale sumei de doua produse-ancora, mai ales cand apare transport sau trecere peste suta.

Pentru fiecare non-anchor `b`, se calculeaza:

```text
bigTerm = A * anchor_mare
smallTerm = A * anchor_mic
total = bigTerm + smallTerm
```

Codul selecteaza doar cazurile in care merita o strategie rapida:

- exista transport pe unitati/zeci;
- sau suma trece in urmatoarea suta;
- anumite cazuri care se termina ambele in 5 sunt sarite daca nu trec peste suta;
- cazurile cu multipli de 10 sunt pastrate doar daca rotunjirea la suta are sens.

Strategii generate:

1. Rotunjirea termenului mare la urmatoarea suta:

```text
bigTerm + smallTerm = roundedHundred + ?
```

Exemplu:

```text
95+19=100+?
```

2. Spargerea termenului mic in zeci plus rest:

```text
bigTerm + smallTerm = bigTerm + lowerTen + ?
```

Exemplu:

```text
65+52=65+50+?
```

3. Rotunjirea termenului mic in sus si scaderea diferentei:

```text
bigTerm + smallTerm = bigTerm + upperTen - ?
```

Exemplu:

```text
65+26=65+30-?
```

Distractorii sunt numere apropiate de raspunsul corect.

Reguli de selectie:

- se construieste lista candidatilor utili pentru nivel;
- daca exista mai multe intrebari candidate, nu se repeta imediat acelasi prompt;
- daca nu exista niciun candidat, promptul devine `no candidates`.

Reguli de iesire:

- daca exista un singur candidat, subquizul il repeta pana la primul raspuns corect, apoi termina;
- daca exista mai multi candidati, termina dupa `min(12, candidateCount * 3)` raspunsuri totale;
- in flow normal, trece la subquizul 5;
- in mod direct, trece la nivelul urmator.

Greseli:

- la raspuns gresit, intrebarea ramane aceeasi;
- timeoutul lasa aceeasi intrebare;
- la raspuns corect, trece mai departe.

## 12. Subquiz 5 - adunare efectiva ancore

Nume intern:

```text
effectiveAnchorAddition
```

Titlu afisat:

```text
adunare efectiva ancore
```

Scop: copilul calculeaza efectiv suma celor doua produse-ancora care compun produsul non-ancora.

Pentru un non-anchor `b`:

```text
b = anchor_mare + anchor_mic
bigTerm = A * anchor_mare
smallTerm = A * anchor_mic
prompt = bigTerm + smallTerm = ?
```

Exemplu nivel 1:

```text
55+11=?
```

pentru `11*6`, fiindca `6 = 5 + 1`.

Raspunsul este suma finala, adica produsul non-ancora:

```text
A*b
```

Reguli de selectie:

- foloseste toate non-ancorele;
- incearca sa nu repete imediat acelasi prompt;
- dupa o intrebare, urmatoarea este aleasa aproape de non-ancora curenta, daca exista optiuni apropiate;
- daca un item gresit devine scadent pentru retry, il poate readuce dupa 2-5 ture.

Distractorii:

- sunt valori apropiate de suma corecta;
- incearca variante `correct +/- 10`, `+/-1`, `+/-2`, `+/-5`, `+/-20`.

Reguli de iesire:

- dupa 21 raspunsuri totale;
- sau dupa 10 raspunsuri corecte consecutive;
- in flow normal, trece la subquizul 6;
- in mod direct, trece la nivelul urmator.

Greseli:

- la raspuns gresit, intrebarea ramane aceeasi pana este corectata;
- greseala este notata pentru factorul `b`;
- dupa o greseala, acel `b` este programat pentru reaparitie peste 2-5 ture;
- daca doua non-ancore ajung sa aiba cel putin 2 greseli fiecare, intra in intensivul subquizului 5.

Intensiv subquiz 5:

- porneste pe primele doua non-ancore problematice;
- pentru fiecare creeaza pana la 5 forme QF valide;
- coada rezultata este amestecata;
- dupa terminare revine la subquizul 5 normal;
- mesajul este `Inapoi la subquiz 5.`

Observatie: intensivul subquizului 5 nu avanseaza nivelul direct; este un episod de antrenament in interiorul subquizului 5.

## 13. Subquiz 6 - inmultiri non-anchors

Nume intern:

```text
nonAnchorProducts
```

Titlu afisat:

```text
inmultiri non-anchors
```

Scop: copilul raspunde direct la produsele non-ancora.

Forma principala:

```text
b*A=?
```

Exemplu nivel 1:

```text
6*11=?
```

Non-ancorele sunt parcurse in coada:

```text
[6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19]
```

Distractorii:

- au aceeasi ultima cifra ca raspunsul corect;
- sunt de forma `correct +/- 10*k`, cand se poate;
- apoi se completeaza cu variante apropiate/fallback.

Reguli de iesire:

- dupa 12 raspunsuri corecte consecutive, adica toate non-ancorele din lista;
- sau dupa 21 intrebari principale, indiferent de greseli;
- la terminare trece la nivelul urmator;
- la nivelul 10, terminarea subquizului 6 finalizeaza quizul.

Greseli:

- la raspuns gresit, intrebarea ramane aceeasi;
- non-ancora este adaugata in lista `productWrongBs`;
- daca exista doua non-ancore distincte gresite si apoi corectate, porneste intensivul subquizului 6.

Intensiv subquiz 6:

- ia primele doua non-ancore gresite;
- pentru fiecare genereaza pana la 5 QF forms numerice valide;
- le amesteca intr-o coada;
- dupa terminarea cozii revine la subquizul 6 normal;
- mesajul este `Inapoi la subquiz 6.`

## 14. Q forms si tipuri de intrebari

Pentru ancore si pentru intensive se foloseste `QFGenerator`.

Facturile pot fi:

- inmultire: `A*b=c`
- inmultire comutata: `b*A=c`
- impartiri complementare: `c:A=b`, `c:b=A`
- forme cu necunoscuta pe pozitii diferite;
- forme cu doua numere in stanga/dreapta egalului;
- forme cu trei pozitii posibile pentru un numar.

Quizul filtreaza formele astfel incat raspunsul sa fie numeric.

Pentru subquizurile 3-6 exista si forme construite manual, de tip:

- `A*b=?+A*anchor`
- `A*b=A*anchor+?`
- `bigTerm+smallTerm=rounded+?`
- `bigTerm+smallTerm=bigTerm+lower+?`
- `bigTerm+smallTerm=bigTerm+upper-?`
- `bigTerm+smallTerm=?`
- `b*A=?`

## 15. Variante de raspuns / distractori

In general sunt 3 variante:

- una corecta;
- doua gresite;
- ordinea este amestecata.

Tipuri de distractori:

1. Pentru produse si caturi: valori cu aceeasi ultima cifra ca raspunsul corect.
2. Pentru valori de ancore: alte produse din aceeasi tabla `A*anchor`.
3. Pentru adunari rapide: numere apropiate de diferenta/restul corect.
4. Pentru suma finala: numere apropiate de total.

Aceasta alegere face capcanele destul de relevante, dar exista riscul sa devina prea grele daca elevul nu intelege strategia, fiindca multe variante arata plauzibil.

## 16. Feedback si UI

Quizul foloseste arena generala cu lift/intrebari cazatoare.

Intrebarea apare ca text in lift. Nu exista ilustratie AAM specifica pentru acest quiz.

Panoul special `divInfo11_20` este vizibil pentru acest quiz si afiseaza:

- modul curent;
- facts gresite;
- facts lucrate intensiv;
- numar de intrebari/progres;
- sesiuni intensiv;
- timpul ultimului raspuns corect pentru ancorele `[2,3,4,5,15]`.

Progresul standard este ascuns:

```text
getProgressDisplay() => ProgressDisplay.hidden()
```

Feedback raspuns:

- corect: `Corect!`, bounce;
- gresit: `<raspuns> nu e bun. Mai incearca!`, flash wrong;
- avans nivel/subquiz: flash win, banner/mesaj;
- final: `Ai ajuns la final.`

Observatie tehnica: in `app.js`, clasa vizuala `is-intensiv` se activeaza doar daca `info.mode === "intensiv"`. Dar `getInfo11_20()` intoarce pentru unele intensive texte precum `Subquiz 5: intensiv` sau `Subquiz 6: intensiv`, deci e posibil ca stilul rosiatic de intensiv sa nu se aplice pentru toate intensivele.

## 17. Persistenta

Persistenta actuala este partiala:

- selectia subquizului de pornire se salveaza in `localStorage`, la cheia `yl:mul1120v2:startStage`;
- restul progresului nu se salveaza.

Nu persista dupa reload:

- nivelul curent;
- progresul in subquiz;
- greselile;
- coada de intrebari;
- timpii de raspuns;
- starea de intensiv;
- intrebarea curenta.

Quizul recreeaza starea de la zero la reload.

## 18. Comportament la schimbare manuala de nivel

Cand utilizatorul schimba nivelul:

- `level` devine nivelul ales, limitat intre 1 si 10;
- se reseteaza toata starea nivelului;
- se porneste din subquizul selectat ca start stage.

## 19. Ce este deja testat automat

Exista test dedicat:

```text
tests/multiplication-1120-v2.test.js
```

Testele acopera:

- default-ul curent care porneste direct in subquizul 6;
- trecerea din normal anchors in subquiz 3 dupa 21 raspunsuri;
- subquizul 3: iesire dupa 12 raspunsuri sau 7 corecte consecutive;
- subquizul 4: candidati, repetare, iesire, no candidates;
- subquizul 5: iesire dupa 21 total sau 10 corecte consecutive;
- subquizul 5: retry dupa greseli si intensiv dupa doua probleme;
- subquizul 6: iesire dupa 12 corecte consecutive sau 21 intrebari;
- subquizul 6: intensiv dupa doua non-ancore gresite;
- modurile directe anchorsOnly si intensivOnly.

Observatie: testul are in cod o cale absoluta veche (`C:/Users/I/Projects/Youlearn.com`), deci ar putea necesita ajustare pentru a rula pe masina curenta.

## 20. Posibile probleme / zone neclare

1. Default-ul curent este `nonAnchorProducts`, deci copilul poate intra direct in subquizul 6. Pare util pentru testare, dar pedagogic probabil flowul final ar trebui sa fie `normal`.

2. Comentariile initiale din fisier spun ca e doar "BUCATA 1 - doar test anchors", dar codul are deja 6 subquizuri. Comentariul este depasit si poate induce in eroare.

3. Documentatia existenta din `Codex docs/T 11-20 v2 - descriere conform new-quiz-form-template.md` pare si ea depasita: descrie in principal anchors + intensiv, nu toate cele 6 subquizuri actuale.

4. Persistenta este aproape inexistenta. Nu este clar daca pentru copil ar trebui sa retina nivelul/subquizul/progresul sau daca resetul la reload este intentionat.

5. Nu exista mastery real pe facts. Multe iesiri sunt bazate pe numar de intrebari sau streak. Poate fi bine pentru antrenament rapid, dar poate trece mai departe cu lacune.

6. Intensivele din subquiz 2, 5 si 6 au comportamente diferite. Ar putea fi bine, dar trebuie decis daca aceasta diferenta este intentionata:
   - subquiz 2 intensiv ignora greselile si consuma 10 intrebari;
   - subquiz 5/6 intensiv pare tot episod temporar, dupa care revine la subquiz;
   - doar subquiz 2 are regula cu doua sesiuni intensive per nivel in flowul anchors.

7. Subquizul 4 are cazuri `no candidates`, mai ales pe unele niveluri. Trebuie decis daca e acceptabil sau daca subquizul ar trebui sarit elegant fara a arata copilului `no candidates`.

8. Unele mesaje sunt tehnice sau de dezvoltare: `no candidates`, `non-anchors`, `Subquiz 5`, `Subquiz 6`. Poate ar trebui traduse intr-un limbaj mai prietenos pentru copil.

9. Nu exista ilustratii/metoda vizuala pentru descompuneri. Totul este text/numeric. Pentru un copil, subquizurile 3-5 ar putea beneficia de o reprezentare vizuala a descompunerii `b = 5+1`, `10+2`, `15+4`.

10. QF forms pot creste dificultatea rapid. Trebuie decis daca formele cu impartire complementara sunt potrivite de la inceput pentru tabla 11-20 sau daca trebuie introduse dupa ce produsul direct e stabil.

11. Exista risc ca quizul sa amestece doua obiective:
    - invatarea produselor 11-20;
    - invatarea strategiilor de calcul mental prin descompuneri.
    Poate trebuie separate mai clar pe faze.

12. Panoul de debug/progres este util pentru dezvoltare, dar poate sa nu fie potrivit ca UI final pentru copil.

13. Stilul special de intensiv poate sa nu se activeze pentru toate modurile intensive, din cauza comparatiei stricte `info.mode === "intensiv"`.

14. Unele texte/comentarii apar cu encoding stricat in sursa citita in terminal. Trebuie verificat daca in browser apar corect si daca merita curatat encodingul.

15. Testele sunt utile, dar calea absoluta din test pare mutata si poate trebui reparata pentru portabilitate.

## 21. Intrebari bune pentru ChatGPT

As vrea sfaturi pe urmatoarele directii:

1. Care ar trebui sa fie flowul pedagogic final pentru tabla 11-20: toate cele 6 subquizuri intr-un singur nivel sau impartite in quizuri mai mici?

2. Default-ul ar trebui schimbat inapoi la `normal`? Sau este mai bine sa pastrez selectorul de subquizuri pentru dezvoltare, dar copilul sa porneasca mereu in flow normal?

3. Subquizul 2 intensiv dupa ancore este util asa cum e, sau ar trebui sa fie mai apropiat de un sistem de mastery?

4. Subquizurile 3, 4 si 5 sunt prea multe etape intermediare pentru copil sau ajuta suficient de mult?

5. Ce ar trebui sa fac cu `no candidates` din subquizul 4? Sa sar automat subquizul, sa ascund mesajul, sa il inlocuiesc cu alt tip de exercitiu?

6. Cand ar trebui introduse QF forms cu impartire complementara: de la subquizul 1 sau dupa ce copilul stapaneste produsele directe?

7. Ar trebui sa existe persistenta pe nivel/subquiz/facts gresite/timpi? Daca da, ce merita salvat si ce ar trebui resetat?

8. Cum ar trebui sa arate UI-ul pentru copil: panou info tehnic, panou simplificat, explicatii vizuale, sau doar arena?

9. Ce criteriu de trecere la nivelul urmator este mai bun:
   - numar fix de intrebari;
   - streak;
   - mastery pe fiecare fact;
   - combinatie intre ele?

10. Ar trebui pastrate intensivele ca episoade separate sau integrate intr-un registru global de greseli?

11. Cum as putea formula mai clar scopul fiecarui subquiz in termeni de invatare, nu doar in termeni de cod?

12. Care este urmatorul pas cel mai bun: documentare, curatare UI, reparare teste, schimbare default, adaugare persistenta, sau simplificare pedagogica?

## 22. Rezumat foarte scurt

`T*/ 11-20 v2` este un quiz pentru tabla 11-20 pe niveluri 11x pana la 20x. Are un flow pedagogic complex cu 6 subquizuri: ancore, intensiv pe ancore, valori de ancore in sume, adunari rapide, adunarea efectiva a produselor-ancora si produse non-ancora directe. Momentan porneste implicit direct in subquizul 6, probabil pentru testare. Are multe reguli utile, dar trebuie decis daca flowul final trebuie simplificat, documentat, facut mai prietenos vizual si eventual legat de persistenta/mastery.
