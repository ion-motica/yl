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

**Faza:** nicio fază începută — planul tocmai a fost scris.
**Următorul pas:** Faza A (inventarul variației reale + propunerea contractului), conform §5 din plan.
**Aplicația:** complet funcțională. Impunerea (Faza C) încă nu s-a făcut, deci niciun quiz nu e marcat „NEFUNCȚIONAL".
**Ultima actualizare:** 18.08.2026

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

---

## Faza A — inventar + contract

- [x] Citit `onAnswer`-ul tuturor celor 18 fișiere în scop
- [x] Citit cele 17 subquizuri (9 în `v2-modular`, 3 în `v3`, 5 în `v4`)
- [x] Tabel al variației reale — vezi `FAZA-A-inventar-contract.md`
- [x] Contract propus — vezi `FAZA-A-inventar-contract.md` §2
- [ ] **OPRIRE** — prezentat userului, 3 întrebări deschise (§4 din anexă), în așteptare

## Faza B — modulul comun

- [ ] Modul scris
- [ ] Teste proprii, pe contract
- [ ] Toate testele existente încă verzi (aplicația funcționează normal la acest punct)
- [ ] **OPRIRE** — raportat

## Faza C — IMPUNEREA (aici se sparge totul, intenționat)

- [ ] `falling-engine.js` validează semnătura modulului comun; altfel aruncă eroare explicită
- [ ] Sufixul „ - QUIZ NEFUNCTIONAL - IN REFACTORING" pus pe toate cele **24** de quizuri din meniu
- [ ] Verificat explicit că `rigle-cl1.js` (motor m2) NU e afectat
- [ ] Test-santinelă: vechea cale chiar crapă
- [ ] **OPRIRE** — raportat

## Faza D — migrarea (loturi de câte 5 fișiere)

> Pe măsură ce un fișier e migrat + testat, i se scoate sufixul „NEFUNCȚIONAL" de la intrările de
> meniu pe care le deblochează. Numărul din paranteză = câte intrări de meniu deblochează.

### Lotul 1
- [ ] `js/quizzes/addition-table.js` (1) — *fără test: scris test întâi*
- [ ] `js/quizzes/addition-table-range.js` (1) — *fără test: scris test întâi*
- [ ] `js/quizzes/prime-divisors.js` (1) — *fără test: scris test întâi*
- [ ] `js/quizzes/sub-sau-langa-radical.js` (1) — are test
- [ ] `js/quizzes/bagare-sub-radical.js` (1) — *fără test: scris test întâi*
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

### Lotul 2
- [ ] `js/quizzes/addition-table-singapore.js` (1) — *fără test: scris test întâi*
- [ ] `js/quizzes/addition-table-singapore-missing.js` (1) — *fără test: scris test întâi*
- [ ] `js/quizzes/division-with-remainder.js` (1) — *fără test: scris test întâi*
- [ ] `js/quizzes/prime-divisions.js` (1) — *fără test: scris test întâi*
- [ ] `js/quizzes/equations-e3-e6.js` (1) — are test
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

### Lotul 3 — motoarele partajate (deblochează 9 intrări de meniu)
- [ ] `js/succesive-quiz/engine.js` (1) — *fără test: scris test întâi*
- [ ] `js/conexe-table-quiz/engine.js` (**4**) — are teste prin cele 4 fișiere helper
- [ ] `js/eff-quiz/engine.js` (**4**) — *fără test: scris test întâi*
- [ ] `js/quizzes/pre-equations-eff-navigation.js` (1) — are test
- [ ] `js/quizzes/multiplication-1120-v2.js` (1) — are test
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

### Lotul 4 — cele cu subquizuri
- [ ] `js/quizzes/multiplication-1120-v2-modular.js` (1) — are test, **9 subquizuri**
- [ ] `js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js` (1) — are test, **3 subquizuri**
- [ ] `js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js` (1) — are test, **5 subquizuri** (aici se repară și `sq5`)
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

## Faza E — Pasul 2: subquizul dă CE, nu CUM

- [ ] `SubquizDefinition.define()` aruncă dacă definiția conține `onAnswer`
- [ ] Sufixul „NEFUNCȚIONAL" pus pe cele 3 quizuri cu subquizuri
- [ ] `multiplication-1120-v2-modular.js` — 9 subquizuri migrate, sufix scos
- [ ] `multiplication-1120-v3-train-eff-eq-forms.js` — 3 subquizuri migrate, sufix scos
- [ ] `multiplication-1120-v4-intensiv-multipli-234.js` — 5 subquizuri migrate, sufix scos
- [ ] Test-santinelă: `define({ onAnswer })` chiar aruncă
- [ ] **OPRIRE** — raportat

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
