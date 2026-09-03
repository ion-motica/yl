# YouLearn — instrucțiuni de proiect (auto-încărcat)

Acest fișier se auto-încarcă la fiecare sesiune Claude Code în acest proiect — spre
deosebire de `AGENTS.md`, care **nu** se auto-încarcă (verificat empiric, 25.07.2026:
într-o sesiune lungă de lucru la Rigle, `AGENTS.md` nu a apărut niciodată singur în
context, a trebuit citit explicit de două ori). De-aia regulile esențiale stau aici,
nu doar în `AGENTS.md`.

**Citește `AGENTS.md` la începutul oricărei sesiuni de lucru în acest repo** —
conține regulile complete de design/organizare cod („Programare simplă și modulară
în YouLearn"), nu doar indexul de mai jos.

## Regulă: caută documentul zonei înainte de modificare

Dacă userul cere o modificare sau o adăugare într-o zonă anume a aplicației, caută
întâi dacă acea zonă are un document de referință în tabelul de mai jos și
citește-l **înainte** să propui sau să scrii cod. Nu presupune că nu există un
document — verifică tabelul, nu re-deriva context din cod de la zero dacă cineva
deja l-a scris.

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
| Organizare cod / cuplare (design nou, restructurare) | `documente de referinta/razgandire-ieftina.md` |
| `numaraTICs()` (scris/împrumut) | `js/numara-tics.js`, `tests/numara-tics.test.js` |
| Deschidere Codex browser local | `Codex docs/Deschidere Codex browser - referinta pt Codex.md` |
| „Vizualizare si interpretare logs/" (MABP vechi) | **nu se modifică** — `Vizualizare si interpretare logs/README.md` (înlocuit de Vizualizare 3, păstrat intact) |
| Zonă-test index documente (canar de diagnostic, nu e feature reală) | `documente de referinta/ZONA-TEST-REFERENCE.md` |
<!-- INDEX-DOCUMENTE:END -->

Acest tabel e **duplicat identic** în `AGENTS.md` (secțiunea „Index de documente pe
zonă"). `npm run check:docs` verifică: (a) cele două copii sunt identice, (b) fiecare
cale din tabel există pe disc, (c) fișierele `*REFERENCE*.md`/`*SABLON*.md`/
`referinta*.md` din `documente de referinta/` apar undeva în index. Dacă adaugi o
zonă nouă sau un document nou de tip referință, actualizează **ambele** fișiere și
rulează checkul înainte de commit.

## Cerere curentă vs. regulă/cerere din trecut — nu decid singur, informez și întreb

Când o cerere a userului din contextul prezent (promptul curent, prompturile recente,
chatul curent) pare să contravină, să intre în conflict cu, sau să încalce o cerere
ori o regulă din trecut — fie consemnată în fișierele de reguli (`AGENTS.md`,
`CLAUDE.md`, alte documente de referință), fie o cerere anterioară pe care userul a
cerut explicit să o țin minte — nu ignor cererea curentă și nu decid eu, tacit, care
dintre cele două are prioritate.

Nu o menționez doar tangențial, în treacăt, eliptic, și nici n-o ignor complet
continuând ca și cum cererea nouă nu exista. În schimb, explic userului — clar și
structurat, pe larg și pe înțeles, NU eliptic, tangențial sau frust — conflictul
exact pe care îl văd, exact în această formă:

**Posibilă încălcare regulă stabilită:**

- **A)** Cererea curentă a userului: ...
- **B)** Regula (posibil) încălcată: consemnată în fișierul X, la data Y, în contextul Z, cu motivația/argumentele W
- **C)** Părerea mea despre acest conflict cerere-regulă — exprimată clar, direct, pe înțeles, nu tangențial, nu implicit, nu frust, nu eliptic
- **D)** Tu, user, acum că te-am informat, ce decizi? — întreb userul, nu iau eu decizia în locul lui.

Valabil atât pentru cererile clare ale userului, cât și pentru implicațiile importante ale acestor cereri.

Text original al userului (consemnat verbatim, cerere expresă a userului, 03.09.2026
— nu se corectează gramatical, nu se parafrazează, rămâne exact cum a fost scris):

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
