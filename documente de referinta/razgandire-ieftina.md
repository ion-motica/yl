# Răzgândire ieftină — instrument de diagnostic

> Se citește la **organizarea codului** (modul nou, feature nou, restructurare), NU la fiecare
> modificare. Completează `AGENTS.md` → „Programare simplă și modulară în YouLearn"; nu îl înlocuiește.
>
> **Nu este o listă de bifat.** Dacă diagnosticul de mai jos iese curat, nu se face nimic.

## Cum se folosește

Întâi cele două întrebări de control. Doar dacă una iese prost, cauți tehnica potrivită mai jos.

1. **Dacă mă răzgândesc la X, în câte locuri trebuie să scriu?**
   Unu = sănătos. Mai multe = ai găsit ce merită schimbat.
2. **Dacă X se dovedește o prostie, cât mă costă să-l scot?**
   Un sfert de oră = sănătos. „Rescriu motorul" = nu e gata de construit.

## Dușmanul are două nume, nu unul

Ambele arată **identic din afară** („e greu de schimbat"), dar leacurile sunt **opuse**: unul taie,
celălalt adună. De-asta trebuie știut de fiecare dată care dintre ele e.

- **Cuplare** (*coupling*): două bucăți de cod nu pot fi schimbate una fără cealaltă.
  Leac: **taie** legătura — contracte explicite, funcții pure, date în loc de apeluri.
- **Coeziune slabă** (*low cohesion*): un singur gând e împrăștiat în mai multe locuri, sau un
  singur loc se schimbă din motive fără legătură. Leac: **adună** ce se schimbă împreună.

Regula coeziunii: **ce se schimbă împreună stă împreună.** Grupezi după *motivul schimbării*, nu
după ce fel de fișier e. De-asta `Vizualizare 3 - Claude/` ține HTML, CSS, JS, catalog și config la
un loc — un proiect „ordonat" clasic le-ar fi împrăștiat în `/css`, `/js`, `/data`.

**Întrebarea 1 detectează coeziunea slabă. Întrebarea 2 detectează cuplarea.** Amândouă sunt
necesare: cuplare zero obții banal punând totul într-un fișier uriaș, iar „separare" maximă tăind
codul în o sută de funcțiuni mărunte. Ambele sunt groaznice. Ținta e **coeziune mare înăuntru,
cuplare mică între** — vezi și regula 9a din `AGENTS.md` („nu sparge artificial codul în prea multe
funcții mici").

**Pentru agent — exemplu trăit, cu diagnostic corect.** Redenumirea stării „În lucru" a cerut patru
fișiere: `motor-analiza.js` (id + traseu), `vizualizare3-bootstrap.js` (eticheta), `vizualizare3.css`
(culoarea), teste. Asta **nu e cuplare**, e **coeziune slabă**: identitatea unei stări e un singur
gând, împrăștiat. Leacul ar fi un tabel `STARI` cu `{ id, eticheta, traseu, culoare }` — o stare pe
rând, adăugarea uneia noi = un rând. Costul real: culorile migrează din CSS în JS (aplicate prin
variabile), deci reduce de la patru locuri la două, nu la unul. Îmbunătățire, nu vindecare. Nu se
face preventiv — se face **când se mai umblă la stări**.

## Când documentul ăsta e contraproductiv

- **Cod-experiment**: o clonă de quiz în care testezi dacă o idee are sens. Nu robustiza o ipoteză.
- **Fix punctual**: o valoare greșită, un typo, o culoare. Diagnosticul nu se aplică.
- **Înainte de al doilea caz real** (regula 7 din `AGENTS.md`): tehnicile de aici pot deveni scuza
  perfectă pentru abstractizare prematură. Abstracția greșită e cel mai scump lucru de schimbat.
- **Când răspunsul la ambele întrebări de control e bun**: oprește-te. Nu căuta ce să îmbunătățești.

---

## 1. Funcții pure

O funcție e „pură" dacă primește tot ce-i trebuie ca parametri, returnează un rezultat și nu se
atinge de nimic altceva — nu citește DOM, nu scrie în bază, nu umblă la variabile globale. Aceleași
intrări → același rezultat, mereu.

**Pentru agent.** Semnal că lipsește: funcția citește `document`, `window`, IndexedDB sau o globală
ca să afle ceva ce n-a primit. Se aplică prin ridicarea dependenței în semnătură. Exemplu în proiect:
`ruleazaAnaliza({ inregistrari, catalog, configuratie, praguri })` — testabilă în 150ms fără browser.
**Când NU:** stratul de margine (bootstrap, adaptoare) trebuie să fie impur; nu-l puriifica împingând
efectele și mai departe. Un singur loc impur, bine numit, e mai bun decât cinci pe jumătate pure.

## 2. Miez pur, coajă murdară (*functional core, imperative shell*)

Tot calculul stă în funcții pure; toate „murdăriile" (citit din bază, scris în DOM) stau strânse
într-un singur loc, la margine. Partea care se schimbă des (cum arată) e separată de partea care
trebuie să fie corectă (ce calculezi).

**Pentru agent.** Semnal că lipsește: nu poți testa o regulă de business fără DOM sau bază. Exemplu:
`motor-analiza.js` (pur, zero DOM) vs `vizualizare3-bootstrap.js` (singurul care atinge IndexedDB și
DOM). Verificare: interfața s-a schimbat de trei ori, motorul n-a fost atins, testele au rămas verzi.
**Când NU:** cod care e *doar* efect (un buton care deschide un tab). Nu inventa un „miez" pentru el.

## 3. Tabele în loc de if-uri (*table-driven*)

În loc de un lanț de `if/else` care întoarce valori, scrii datele ca tabel. Ca să adaugi un caz nou
nu mai scrii cod (unde poți greși logica), ci adaugi un rând de date. Codul care-l folosește rămâne
neschimbat. Asta e, concret, „gramatica generativă": puține reguli, multe rezultate prin date.

**Pentru agent.** Semnal că lipsește: un `if/else` sau `switch` care crește de fiecare dată când
apare un caz nou, iar toate ramurile au aceeași formă. Exemple: `TRASEU_STARE`, `ETICHETE_STARE`,
`FOLII`, `felii`, `DEFINITII_AXE`.
**Când NU:** ramurile au forme *diferite* (nu doar valori diferite). Atunci tabelul devine un
mini-limbaj cu funcții în el — exact ce interzice specificația MABP („configurația combină doar
primitive implementate, fără cod arbitrar").

## 4. Constante cu nume (fără „numere magice")

Un „număr magic" e o cifră aruncată direct în cod: peste o lună nu mai știi ce e `10`. Cu nume,
numărul apare o singură dată; îl schimbi acolo și s-a schimbat peste tot.

**Pentru agent.** Semnal că lipsește: același număr apare în două locuri, sau un număr fără nume în
cod care nu e `0`/`1`. Exemplu: `DIM_PATRATEL = 10`, `GAP_PATRATEL = 2`, sincronizate cu
`.viz3-patratel` din CSS.
**Când NU:** numărul e local, evident din context și apare o singură dată (`i + 1`). O constantă
inutilă adaugă o indirecție de citit.

## 5. Idempotență

O funcție e idempotentă dacă o poți apela de câte ori vrei și rezultatul e același. Practic: întâi
șterge tot, abia apoi aplică din nou. Așa nu trebuie să ții minte ce ai făcut data trecută ca să-l
dai înapoi. Codul care „își amintește ce a aplicat ultima dată" e cel care se strică la a treia
apăsare.

**Pentru agent.** Semnal că lipsește: cod de „undo" scris de mână, sau un bug care apare doar la a
doua/a treia comutare. Exemplu: `aplicaUmplereCelula()` resetează `height`, `fontSize`, `lineHeight`,
`top` și variabilele CSS *înainte* de a recalcula.
**Când NU:** operații scumpe unde resetarea completă costă vizibil (atunci documentează compromisul
explicit — vezi punctul 12).

## 6. Testele nu sunt despre corectitudine, sunt despre curaj

Sună a birocrație, dar sunt literalmente unealta care face răzgândirea ieftină. Fără ele, fiecare
schimbare înseamnă „deschid pagina, mă uit la 100 de celule, sper că n-am stricat nimic" — deci
eziți. **Ezitarea e ce face răzgândirea scumpă.**

**Pentru agent.** Testele verifică rezultatul și contractul public, nu structura internă
(`AGENTS.md` regula 11). Un test care verifică *cum* e scris codul te împiedică să-l schimbi — e mai
rău decât niciun test. Exemplu: `tests/vizualizare3-motor.test.js` și `vizualizare3-domeniu.test.js`.
**Când NU:** nu repeta testele infrastructurii centrale la fiecare integrare; doar testul minim
specific integrării.

## 7. Nu abstractiza devreme

Pare invers față de tot restul, dar nu e. O „structură generală" făcută după un singur caz ghicește
ce va urma — de obicei greșit. Rămâi cu o abstracție care nu se potrivește, și **aia e cel mai scump
de schimbat**, pentru că totul depinde deja de ea.

**Pentru agent.** Regula 7 din `AGENTS.md`: extrage cod comun numai după cel puțin două cazuri reale
cu aceeași structură. Exemplu trăit: feliile egale păreau generale și curate; s-au lovit de realitate
(faptul are nevoie de dublu față de numere) și au devenit ponderi. A costat 20 de linii pentru că nu
era nimic construit deasupra lor.
**Când NU se aplică:** când al doilea caz real chiar există și chiar are aceeași formă. Atunci
duplicarea devine mai scumpă decât abstracția.

## 8. Datele brute rămân intacte, tot restul se derivă

Cea mai puternică dintre toate. Jurnalul nu se modifică niciodată; filtrarea și clasificarea se
întâmplă *deasupra* lui. Poți schimba orice prag și recalculezi din adevărul original. Dacă ai
„curăța" datele la salvare, în ziua în care te răzgândești informația e pierdută definitiv.

**Pentru agent.** Regula: ce e derivat trebuie să poată fi aruncat și refăcut oricând. Starea
„Fluent" nu se salvează nicăieri — se recalculează. Semnal de alarmă: orice cod care scrie înapoi în
jurnal, sau care persistă un rezultat calculat. `AGENTS.md`/README MABP: „date brute imuabile;
niciun filtru nu șterge sau rescrie jurnalul".
**Când NU:** cache pentru performanță — dar atunci cache-ul trebuie să poată fi șters oricând fără
pierdere de informație.

## 9. Erori explicite, imediate (*fail fast*)

Codul care crapă zgomotos e mai ieftin de schimbat decât cel care „se descurcă". Un pas care ignoră
politicos o valoare necunoscută îți dă mâine **un raport care arată perfect și e greșit** — și cauți
trei ore.

**Pentru agent.** Semnal că lipsește: `if (!x) return;` pe o cale unde `x` lipsă înseamnă că cineva a
greșit configurația. Exemplu: `throw new Error("Segmentare necunoscută: ...")`. Distincție
importantă: date *indisponibile* rămân `null` fără zgomot (regula 6); o *configurație* greșită oprește
raportul.
**Când NU:** date lipsă legitim (jurnal gol, fact netestat) — alea sunt stări valide, nu erori.

## 10. Fiecare pas produce date pe care le poți privi

Fluxul e un lanț de pași care primesc date și returnează date, nu o funcție uriașă. Când rezultatul
e greșit, întrebi „la care pas s-a stricat?" și schimbi **un** pas, nu tot lanțul.

**Pentru agent.** Exemplu: normalizează → grupează → domeniu → segmentează → filtrează → statistici →
clasifică → model. Fiecare e testabil separat. Specificația o cere explicit: „fiecare etapă produce
date inspectabile".
**Când NU:** nu sparge artificial în funcții mici dacă fluxul devine mai greu de urmărit
(`AGENTS.md` regula 9a). Pașii trebuie să fie *semantici*, nu bucăți tăiate mecanic.

## 11. Versionează ce se poate schimba sub tine

Pare birocrație până înțelegi la ce servește: schimbi „Fluent" de la 2,0s la 1,8s și toate rapoartele
vechi devin brusc altceva, dar arată la fel. Cu versiune, un raport zice „am fost calculat cu
pragurile v1" — poți schimba pragurile **fără să rescrii tăcut trecutul**.

**Pentru agent.** Contează dublu într-un tool al cărui scop e să compare acum cu luna trecută.
Exemplu: `praguri_version: 1`. Regula: orice prag „provizoriu" trebuie să fie versionat înainte să
producă un raport pe care cineva îl ține minte.
**Când NU:** valori pur cosmetice (culori, spațieri) — versionarea lor e zgomot.

## 12. Interfața ca funcție de stare (*UI = f(state)*)

Nu modifici interfața bucată cu bucată; o reconstruiești din date. Nu scrii niciodată cod de „undo".

**Pentru agent.** Exemplu bun: `randeazaVizualizarea()` face `replaceChildren()` și desenează din
model. **Excepție conștientă în proiect:** `aplicaUmplereCelula()` mută stiluri inline pe ~400 de
elemente în loc să redeseneze, pentru viteză — de-asta are nevoie de resetul explicit de la punctul 5.
Dacă apar bug-uri la bifat/debifat, **acolo** e locul.
**Când NU:** când re-randarea e vizibil lentă. Atunci compromisul se documentează în cod, nu se
descoperă peste trei luni.

## 13. Aceleași cuvinte în capul tău și în cod (*ubiquitous language*)

Când zici „mută starea pe altă folie", codul zice `FOLII`, `stari`, `folie`. Nu există traducere
între ce gândești și ce e scris. **Distanța dintre vocabularul tău și vocabularul codului e exact
costul fiecărei schimbări viitoare.**

**Pentru agent.** Cost real măsurat: „Motor de Axe cu Bife și Preseturi" tradus în „motor declarativ
de analiză configurabilă" a produs un modul greșit. Regula 12 din `AGENTS.md` (denumiri în română,
explicite) nu e preferință estetică, e tehnică de inginerie. Verificare: dacă utilizatorul spune o
propoziție și tu nu știi imediat ce fișier să deschizi, vocabularul a divergent.
**Când NU:** termeni tehnici consacrați care n-au echivalent util (`IndexedDB`, `cursor`, `IQR`).

## 14. Scrie cod ușor de **șters**, nu ușor de extins

Cel mai contraintuitiv, și ultimul test. Instinctul zice „fă-l flexibil ca să-l poți extinde". Dar
cea mai ieftină schimbare e ștergerea, iar codul „flexibil" e cel mai greu de șters — are tentacule
peste tot.

**Pentru agent.** Test concret: foliile = un bloc CSS + o funcție în bootstrap + o intrare în
`definitii-axe.js`. Ștergere: un sfert de oră. Nimic din motor nu știe că foliile există.
Contraexemplu: dacă `ruleazaAnaliza` ar fi returnat patru modele (unul per folie), ștergerea ar fi
însemnat rescrierea motorului și a testelor.
**Regula de control, la fiecare adăugare:** „dacă asta se dovedește o prostie, cât costă s-o scot?"
Dacă răspunsul e „mult", nu e gata de construit — indiferent cât de elegantă e ideea.
