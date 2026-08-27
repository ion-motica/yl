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
| Semnul de întrebare (`?`) — marcaj, revelare, contract (discuție deschisă) | `documente de referinta/CONTINUARE-contract-semn-intrebare.md` |
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
