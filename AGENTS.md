# Resurse comune YouLearn

## Index de documente pe zonă

> **Regulă**: dacă userul cere o modificare sau o adăugare într-o zonă anume, caută
> întâi dacă zona are un document de referință mai jos și citește-l **înainte** să
> propui sau să scrii cod. Tabelul e duplicat identic în `CLAUDE.md` — spre deosebire
> de acest fișier, `CLAUDE.md` se auto-încarcă la fiecare sesiune (verificat empiric,
> `AGENTS.md` nu se auto-încarcă). `npm run check:docs` verifică sincronizarea.

<!-- INDEX-DOCUMENTE:START -->
| Zonă | Document(e) de citit înainte de modificare |
|---|---|
| Cl. 1 - Rigle (quiz cl. 1, motor propriu m2) | `documente de referinta/RIGLE-REFERENCE.md` |
| EFF (Extended Fact Family) | `documente de referinta/EFF-REFERENCE.md` |
| Vizualizare 3 / MABP (interpretare loguri, modul activ) | `Vizualizare 3 - Claude/CONTINUARE-proiect-MABP.md`, `Vizualizare 3 - Claude/SPECIFICATIE.md` |
| Profil ASNW (arena simplă pt. new user) | `Documentatie Profil ASNW - arena simpla pt new user.md` |
| Acolade (axa numerelor) | `documente de referinta/referinta acolade - text.md` |
| Quiz nou / modificare quiz existent | `documente de referinta/QUIZ-SPEC-SABLON.md` |
| Placeholder de răspuns (semnul `?`) — contract, marcaj, revelare | `js/placeholder-raspuns.js`, `tests/placeholder-raspuns.test.js`, `documente de referinta/CONTINUARE-contract-semn-intrebare.md` |
| Schimbarea de nivel (banner, pauză, ultimul nivel) | `js/schimbare-de-nivel.js`, `tests/schimbare-de-nivel.test.js` |
| Pasul următor după un răspuns corect (`pasUrmator`: pauză + runda următoare) | `js/falling-engine.js`, `tests/falling-engine-pas-urmator.test.js` |
| Butoane „default" (md / make default) | `documente de referinta/standard-butoane-default-md.md` |
| Titluri secțiuni CP (panou nou/existent) | `documente de referinta/standard-titluri-cp.md` |
| Optiuni CP declarative (panou CP nou/migrat, link de partajare) | `documente de referinta/standard-optiuni-cp.md`, `js/motor-optiuni-control-panel.js` |
| Organizare cod / cuplare (design nou, restructurare) | `documente de referinta/razgandire-ieftina.md` |
| `numaraTICs()` (scris/împrumut) | `js/numara-tics.js`, `tests/numara-tics.test.js` |
| Deschidere Codex browser local | `Codex docs/Deschidere Codex browser - referinta pt Codex.md` |
| „Vizualizare si interpretare logs/" (MABP vechi) | **nu se modifică** — `Vizualizare si interpretare logs/README.md` (înlocuit de Vizualizare 3, păstrat intact) |
| Zonă-test index documente (canar de diagnostic, nu e feature reală) | `documente de referinta/ZONA-TEST-REFERENCE.md` |
<!-- INDEX-DOCUMENTE:END -->

## Regulă: cerere curentă vs. regulă/cerere din trecut — nu decizi singur, informezi și întrebi

> Când o cerere a userului din contextul prezent (promptul curent, prompturile recente, chatul
> curent) pare să contravină, să intre în conflict cu, sau să încalce o cerere ori o regulă din
> trecut — fie consemnată în fișierele de reguli (`AGENTS.md`, `CLAUDE.md`, alte documente de
> referință), fie o cerere anterioară pe care userul a cerut explicit să o ții minte — **nu
> ignora cererea curentă și nu decide tu, tacit, care dintre cele două are prioritate.** Nu o
> menționezi doar tangențial, în treacăt, eliptic, și nici n-o ignori complet continuând ca și
> cum cererea nouă nu exista. Explici userului, clar și structurat, pe larg și pe înțeles —
> NU eliptic, tangențial sau frust — conflictul exact pe care îl vezi, în această formă:
>
> **Posibilă încălcare regulă stabilită:**
> - **A) Cererea curentă a userului:** ...
> - **B) Regula (posibil) încălcată:** consemnată în fișierul X, la data Y, în contextul Z, cu
>   motivația/argumentele W
> - **C) Părerea lui Claude** despre acest conflict cerere-regulă — exprimată clar, direct, pe
>   înțeles, nu tangențial, nu implicit, nu frust, nu eliptic
> - **D) Tu, user, acum că te-am informat, ce decizi?** — întrebi userul, **nu iei tu decizia**
>   în locul lui.
>
> Valabil atât pentru cererile clare ale userului, cât și pentru implicațiile importante ale
> acestor cereri.

**Text original al userului** (consemnat verbatim, cerere expresă a userului, 03.09.2026 — nu
se corectează gramatical, nu se parafrazează, rămâne exact cum a fost scris):

```
Deci regula: Cand o cerere a mea din contextul przent (contextul przent =promptul curent, prompturile recete, chatul prezent)
deci: cand o cere re a mea din contextul prezent 
ti se pare ca contravine, intra in conflict, ar incalca o cerere sau o regula din trecut, din fisierele tale de reguli sau din regulile pe care tiam cerut au sa le stmemorezi,
Deci cand {o cerere curenta a userului pare sa incalce o regula trecuta}
atunci ii explici userului { in mod clar si struturat,pe larg si explicit si pe inteles, *NU eliptic sau tangential sau deloc si ignori cererea * conflictul pe care il vezi intre A)cererea curenta si B) regula care pare incalcata.
Deci nu ignori sau mentionezi intreacat pe scur t tangential, 
ci spui clar raspiucat asa :
*Posibila incalcare regual stabilita:*
A) cererea curenta a useruli:
B)Regula incalcata: consemnata in fisierul x, la data y, in contextul z, cu motivatia si argumentele w
C)parerea lui claude n legatura cu acest posibil conflict cerere-regula- parere exprimat si ea  clar si pe intelesul userului, dirct, nu tangential, nu inplictt, nu frust, nu eliptic
D)Tu, user, acum ca te-am informat, ce decizi ? Deci intebu userul sa decida , nu iei tu deciziile in locul userului daca ti-a cerut un lucru.

Este valabil si pentru cerereile clare ale userului, si pentru implicatiile importante ale acestor cereri ale userului.
```

## Invocarea skill-urilor grele

Nu invoca skill-uri de referință grele (ex. `claude-api`, `docx`, `pptx`, `xlsx`) pentru întrebări conversaționale/comparative — răspunde din cunoștințe proprii, cu mențiunea că detaliile pot fi depășite.

Dacă e nevoie real de un skill greu (se scrie/editează cod care folosește acel API, sau utilizatorul cere fapte autoritative curente pentru o decizie reală), nu-l invoca direct — întreabă întâi, explicit: „e nevoie de skill greu, o să coste tokeni, îl invoc sau răspund din cunoștințe cu caveat?" Invocă doar după răspuns afirmativ.

## Deschiderea locală în Codex browser

- Citește mai întâi `Codex docs/Deschidere Codex browser - referinta pt Codex.md`; nu relua încercările vechi deja documentate.
- Folosește direct `http://localhost:8770/index.html` și evită portul `8766`, care a rămas uneori ocupat de un server vechi.
- Verifică mai întâi URL-ul cu `Invoke-WebRequest`. Dacă răspunde cu `StatusCode 200`, nu porni încă un server.
- Dacă portul `8770` nu răspunde, obține executabilul Python din `load_workspace_dependencies`, apoi rulează persistent, din rădăcina proiectului: `python.exe -m http.server 8770 --bind 127.0.0.1`.
- Nu folosi `Start-Process` pentru serverul pornit de Codex: procesul copil se poate închide când comanda părinte se termină.
- După pornire, verifică obligatoriu `StatusCode 200`, apoi deschide în browser URL-ul cu `localhost`, nu cu `127.0.0.1`.

## Programare simplă și modulară în YouLearn

> La **organizarea codului** (modul nou, feature nou, restructurare) citește întâi
> `documente de referinta/razgandire-ieftina.md` — instrument de diagnostic pentru cuplare.
> NU la fiecare modificare, și nu ca listă de bifat: dacă diagnosticul iese curat, nu se face nimic.
> Documentul are secțiune proprie despre când e contraproductiv; ea are prioritate față de tentația
> de a aplica tehnici.

Design simplu, modular, necomplicat, ca o gramatică generativă. Modularitate prin API/metodă cu argumente explicite.

Când adăugăm funcționalități noi în YouLearn, folosim preferabil un contract/API comun cu inversion of control. Codul existent trebuie să apeleze feature-ul nou și să-i furnizeze explicit parametrii necesari. Feature-ul nou nu trebuie să ghicească sau să extragă context din interiorul quizurilor. Contextul aparține quizului; feature-ul primește datele printr-un contract/API explicit, le validează/normalizează și procesează. Aplicăm asta pentru loguri/analytics, event contract / event reporting.

**Regulă practică: quizul raportează, feature-ul procesează.**

1. Caută mai întâi soluția cea mai simplă care rezolvă cerința actuală. Nu construi infrastructură pentru nevoi viitoare neconfirmate.

2. Preferă funcții simple, obiecte cu date și parametri expliciți. Evită clase, moștenire, fabrici, registre și straturi suplimentare dacă nu există o nevoie concretă.

3. Folosește un API comun:
   - codul existent apelează feature-ul nou;
   - quizul furnizează explicit datele necesare;
   - feature-ul validează, normalizează și procesează datele;
   - feature-ul nu caută singur context în quiz, DOM sau variabile globale.

4. Preferă aceeași funcție cu argumente diferite, nu funcții separate pentru fiecare quiz.

   Exemplu:

   ```js
   inregistreazaIncercare({
     identificatorQuiz,
     intrebare,
     raspunsDat,
     raspunsCorect,
     corect,
     timp,
   });
   ```

5. Dacă un quiz are alt format, folosește lângă el o funcție mică de transformare către contractul comun. Nu crea un „sistem de adaptoare” dacă o funcție simplă este suficientă.

6. Ce nu este disponibil rămâne `null`. Nu inventa valori și nu construi alte sisteme numai pentru a completa toate câmpurile.

7. Nu generaliza după un singur caz. Extrage cod comun numai după ce apar cel puțin două cazuri reale care chiar au aceeași structură.

8. Fiecare modul are o responsabilitate clară:
   - quizul știe întrebarea și starea lui;
   - feature-ul nou procesează datele primite;
   - stocarea știe să salveze;
   - interfața știe să afișeze.

9. Preferă fluxuri care se citesc de sus în jos:

   ```js
   valideaza();
   normalizeaza();
   proceseaza();
   salveaza();
   ```

   Evită ramificații adânci, callbackuri îngropate și logică răspândită inutil în multe fișiere.

9a. Preferă macar la nivel macro o abordare procedurală:
   - fluxul principal trebuie să fie clar, liniar și ușor de urmărit;
   - complexitatea necesară poate fi ascunsă în interiorul unor funcții bine numite;
   - la nivelul apelurilor trebuie să se vadă clar ordinea pașilor, nu detaliile convolute;
   - nu expune în fluxul principal mecanisme interne complicate;
   - nu sparge artificial codul în prea multe funcții mici dacă asta face fluxul mai fragmentat și mai greu de urmărit.

10. Fă modificarea minimă necesară:
   - nu refactoriza lucruri fără legătură;
   - nu redenumi sau muta cod doar pentru „curățenie”;
   - nu modifica alte quizuri;
   - nu schimba comportamentul existent fără cerere explicită.

11. Testele verifică rezultatul și contractul public, nu structura internă:
   - datele corecte sunt trimise;
   - feature-ul le procesează corect;
   - funcționalitatea existentă nu se strică.

   Nu repeta pentru fiecare integrare testele mari ale infrastructurii centrale; adaugă doar testul minim specific integrării.

12. Folosește denumiri clare, explicite și fără prescurtări greu de urmărit. Preferă denumiri în română în codul nou, dacă proiectul permite.

13. Înainte de implementare, prezintă concis:
   - soluția minimă propusă;
   - fișierele modificate;
   - ce date sunt disponibile;
   - ce rămâne `null`;
   - eventualele riscuri reale.

   Separă clar: NECESAR pentru cerința actuală vs. OPȚIONAL pentru mai târziu.

14. Nu adăuga arhitectură, funcții sau cerințe suplimentare în tăcere. Dacă vezi o posibilă îmbunătățire, propune-o separat și așteaptă aprobarea.

15. Designul dorit seamănă cu o gramatică generativă:
   - puține reguli și funcții comune;
   - multe rezultate produse prin argumente și configurații;
   - fără duplicare și fără mecanisme complicate;
   - dar nu impune asta dacă ar complica lucrurile și se poate mai clar și mai simplu.

Dacă experimentăm un feature structural: propune un quiz evaluat ca fiind potrivit pentru testare; după aprobare, clonează-l și fă modificările pe acea clonă.

## Contractul de răspuns la quiz/subquiz

> Regulă fără excepție implicită, valabilă pentru **orice** quiz sau subquiz din proiect,
> indiferent cât de „special" pare cazul lui: **răspuns corect → avansează la întrebarea
> următoare. Răspuns greșit → rămâi pe aceeași întrebare, marchezi greșeala, aștepți răspunsul
> corect.** Nu există o a treia formă „default". Diferența dintre quizuri/subquizuri stă STRICT
> în (a) ce întrebare/fapt se alege următor și (b) cum se construiesc variantele de răspuns —
> niciodată în ce se întâmplă la apăsarea unui răspuns.

Mecanismul comun există deja în motor, nu se reinventează per quiz:
`js/subquiz/subquiz-definition.js` (`blockWrongTransition` reia automat aceeași întrebare pe
răspuns greșit, decât dacă comanda întoarsă are explicit `allowOnWrong: true`) și
`js/falling-engine.js` (`applyAnswerResult`, ~linia 852: `outcome === "wrong-answer"` înseamnă
literal „nu randa, rămâi pe intrebarea veche" — nu doar „a fost gresit"). Un subquiz care își
scrie propriul `onAnswer` și reimplementează „corect avansează, greșit reia" duplică o regulă pe
care motorul o impune deja — și fiecare copie e o șansă nouă de bug: găsit independent, de două
ori, în sq3 și sq5 (17.08.2026) — un răspuns care avansa itemul intern dar rămânea etichetat
`"wrong-answer"` → ecranul rămânea desincronizat de starea reală a quizului (butoane „moarte",
răspunsuri corecte notate greșit în jurnal, contaminând exact datele pe care se bazează analiza
de fluență).

O „plasă de siguranță" (ex. sq3: avansează forțat după 5 încercări greșite pe același fapt, ca
un fapt pe care copilul nu-l știe deloc să nu blocheze tot subquiz-ul) e singura excepție
acceptată — dar rămâne **explicită și rară**, nu o formă alternativă pe care fiecare subquiz o
alege liber. Și chiar și ea trebuie să respecte eticheta corectă (`outcome: "step-correct"`,
niciodată `"wrong-answer"`, din clipa în care a avansat efectiv itemul) — altfel reapare exact
bug-ul de mai sus.

## Contractul placeholderului de răspuns (semnul de întrebare)

> **Placeholder = locul din întrebare unde se pune una din cele 3 valori de pe butoanele de
> răspuns.** De obicei semnul e `?`, dar quizul poate alege altul. Fiecare quiz care pune o
> întrebare în arenă **declară explicit** `placeholderRaspuns`, chiar și când e exact handlerul
> generic. Fără declarație, `js/falling-engine.js` oprește randarea cu eroare.

```js
placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?"),
```

Implementarea comună e în `js/placeholder-raspuns.js` (contract + teste în
`tests/placeholder-raspuns.test.js`). Clasa pusă pe placeholder e **`placeholder-pt-raspuns`**,
construită într-un singur loc — nu se scrie de mână în quizuri.

**De ce e obligatoriu, nu cu default tacit.** Înainte, semnul era hardcodat în trei locuri din
motor, cu logici care se **contraziceau** (unul îl căuta, altul îl înlocuia doar pe primul, al
treilea le marca pe toate), marcajul era scris literal identic în trei fișiere, iar quizurile
foloseau trei clase diferite (`q-mark`, `q-q`, niciuna) — fără ca cineva să fi decis asta.
O declarație obligatorie face divergența imposibil de introdus din neatenție: un quiz nou nu
poate să „uite".

**Cele două axe se confundă ușor** — contractul acoperă doar prima:

| axă | întrebare | acoperită |
|---|---|---|
| A. marcajul | unde e locul care primește una din cele 3 valori? | **da** |
| B. revelarea | se arată acolo răspunsul, sau rămâne semnul? | nu, e politica quizului |

Un quiz poate avea placeholder și să aleagă să nu-l reveleze niciodată (formatul `fg-stack`).
Asta e politică, nu absență de placeholder.

**Alt semn** = argument (`creeaza("_")`). **Altă structură** în jurul semnului = quizul pornește
de la handlerul generic și suprascrie doar `marcaj` (exemplu real: `js/quizzes/numarare-cu-pas.js`,
unde celula are fundal galben). Nu sunt alternative, acoperă lucruri diferite.

**Excepții, deocamdată:** formatele `singapore-bond` și `division-eq` rămân pe calea veche —
revelarea lor scrie și câmpuri de stare proprii, citite de alt cod. Quizurile `customEngine`
(Rigle) nu declară nimic: nu trec prin motorul de randare. Vezi
`documente de referinta/CONTINUARE-contract-semn-intrebare.md`.

## Contractul schimbării de nivel

> Fiecare quiz cu niveluri **declară explicit** `laSchimbareDeNivel`, la fel ca
> `placeholderRaspuns`. Fără declarație, motorul oprește avansul de nivel cu eroare.

```js
laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
```

Implementarea comună: `js/schimbare-de-nivel.js` (teste: `tests/schimbare-de-nivel.test.js`).

**Ce face standardul** (decis de user, 28.08.2026):

| moment | comportament |
|---|---|
| nivel nou | „Felicitări! Nivelul următor!", ~3,5s, dispare singur |
| fluxul | **nu se oprește** — întrebarea din nivelul nou apare imediat (pauză 0), se răspunde la ea cât timp mesajul e încă pe ecran |
| ultimul nivel | „Felicitări, ai parcurs ultimul nivel!", **permanent** — dispare doar la schimbarea quizului sau a nivelului din meniu |

**De ce există.** Avansul de nivel era reimplementat separat în **17 fișiere de quiz**:
fiecare cu textul lui de banner, propriul `runDelayMs`, propriul moment de `level++`. Motorul
citea doar câmpurile primite, fără nicio formă comună impusă. De acolo veneau bug-uri repetate,
cu același simptom (ecran înghețat pe întrebarea veche, răspunsuri corecte marcate greșit, avans
„fantomă") și cauze tehnice mereu altele — vezi „Bug-uri de tranziție de rutare" (21.08.2026) și
regresia din 28.08.2026 în `documente de referinta/RAPORT-motor-comun-raspuns.md`.

**Alt comportament** = argumente peste valorile implicite, nu cod nou în quiz:

```js
laSchimbareDeNivel: global.SchimbareDeNivel.standard({
  textNivelNou: "Bravo! Mergem mai departe!",
  durataMesajMs: 5000,
}),
```

Valorile implicite stau în constantele din capul lui `js/schimbare-de-nivel.js` — se schimbă
acolo, o singură dată, pentru toată aplicația.

## Contractul pasului următor (`pasUrmator`)

> Când un răspuns corect trebuie să ducă la runda următoare, quizul trimite **un singur câmp**,
> `pasUrmator`. Motorul îl aplică **întotdeauna** când e prezent. Numele vechi
> (`promptHoldMs`, `continueStep`) sunt **respinse cu eroare**, nu ignorate tăcut.

```js
pasUrmator: {
  dupa: 160,          // OPȚIONAL — doar durata pauzei; implicit DEFAULT_REVEAL_HOLD_MS (160)
  continua: { ... },  // OBLIGATORIU — vederea rundei următoare
}
```

Implementare: `js/falling-engine.js` (teste: `tests/falling-engine-pas-urmator.test.js`).

**De ce există.** Înainte erau doi câmpi **frați**, amândoi opționali, pe același rezultat:
`promptHoldMs` (durată) și `continueStep` (flux). Motorul îi cupla cu `&&`, deci câmpul despre
**durată** decidea dacă cel despre **flux** se aplică deloc. Când quizurile Singapore au scăpat de
pauza lor custom de 400ms, avansul la runda următoare s-a pierdut complet și tăcut — ecran
înghețat pe întrebarea veche, cu butoane active, răspunsuri corecte marcate greșit. Relația dintre
cei doi câmpi nu era impusă de nimic; era ținută minte doar de cine scria linia.

Forma atomică o face imposibilă: **prezența câmpului înseamnă „aplică pasul"**, iar durata stă
înăuntrul lui. Nu mai există un al doilea câmp de activare, de sincronizat mental cu primul.

| greșeală | ce face motorul |
|---|---|
| `continueStep:` sau `promptHoldMs:` | eroare explicită, care numește înlocuitorul |
| `pasUrmator` fără `continua` | eroare — „pauză care nu duce nicăieri", exact vechiul bug în haine noi |
| `dupa` care nu e număr | eroare |

**Nu confunda cu `runDelayMs`**, care rămâne mecanism separat: pauza dinaintea rundei următoare
la finalul unui *run*, citită în `finishRun`. `pasUrmator.dupa` ține de cât stă răspunsul revelat
pe ecran înainte de a se aplica pasul.

## Butoane „default" pe opțiuni (md / make default)

> Când userul cere un **default** pe un set de opțiuni (radio/bife) cu buton „make default",
> **întreabă-l întâi dacă vrea standardul „md"** documentat în
> `documente de referinta/standard-butoane-default-md.md`, apoi aplică-l exact ca acolo.
>
> Regula-nucleu: **defaultul marcat se încarcă la refresh; bifarea e temporară și NU devine
> default.** Nu inventa o regulă „ține minte ultima bifă" și nu re-litiga distincția dacă userul
> a stabilit-o deja.

## `numaraTICs()`

- Sursa comună: `js/numara-tics.js`.
- Testele contractului: `tests/numara-tics.test.js`.
- API public disponibil în proiect: `numaraTICs(intrare): number`.
- Intrarea este fie un string cu o singură operație, fie obiectul explicit `{ operandStanga, operatie, operandDreapta }`.
- Quizul furnizează explicit operația; funcția nu extrage context din quiz, DOM sau variabile globale.
- Funcția simulează algoritmul scris școlar și numără TICs (Transport, Împrumut, Carry). Nu o înlocui cu o estimare de calcul mental și nu reordona operanzii.

## Cl. 1 - Rigle (m2)

> Înainte de orice modificare la quiz-ul „Cl. 1 - Rigle" sau la motorul lui, citește
> `documente de referinta/RIGLE-REFERENCE.md` — arhitectură, contract engine, ce e
> implementat vs. ce nu, gotcha-uri cunoscute. Nu re-deriva contextul din cod de la zero.
>
> E un motor complet separat de motorul 1 (`FallingEngine`) — nu presupune contractul
> obișnuit de quiz (niveluri, `onAnswer`, etc.) fără să verifici întâi referința.
