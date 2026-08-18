# RAPORT de activitate — Motor comun de răspuns

> **Fișier de stare, actualizat pe parcurs.** Planul e în
> `documente de referinta/PLAN-motor-comun-raspuns.md`.
>
> **Agent: citește acest fișier PRIMUL, la fiecare pornire de sesiune.** Sesiunile se întrerup
> (limită de 5 ore); asta e singura sursă care spune unde s-a rămas, fără să reconstruiești din cod.
>
> **Se actualizează după FIECARE quiz migrat**, nu la finalul lotului.

---

## Stare curentă

**Faza:** nicio fază începută — planul tocmai a fost scris.
**Următorul pas:** Faza A (inventarul variației reale + propunerea contractului), conform §5 din plan.
**Ultima actualizare:** 18.08.2026

---

## Jurnal de progres

| Data | Fază / Lot | Ce s-a făcut | Stare |
|---|---|---|---|
| 18.08.2026 | — | Plan scris (Opus 5) și pus pe GitHub. Nicio modificare de cod încă. | plan gata |

---

## Faza A — inventar + contract

- [ ] Citit `onAnswer`-ul tuturor celor 15 fișiere în scop
- [ ] Citit cele 17 subquizuri (9 în `v2-modular`, 3 în `v3`, 5 în `v4`)
- [ ] Tabel al variației reale (ce face fiecare la corect / la greșit / ce pauze / ce cazuri speciale)
- [ ] Contract propus, cu toate cele ~27 de cazuri exprimate prin el
- [ ] **OPRIRE** — prezentat userului, aprobat

## Faza B — modulul comun

- [ ] Modul scris
- [ ] Teste proprii, pe contract
- [ ] Toate testele existente încă verzi
- [ ] **OPRIRE** — raportat

## Faza C — migrarea (loturi de câte 5)

### Lotul 1
- [ ] `addition-table.js` — *fără test azi: scris test întâi*
- [ ] `addition-table-range.js` — *fără test azi: scris test întâi*
- [ ] `prime-divisors.js` — *fără test azi: scris test întâi*
- [ ] `sub-sau-langa-radical.js` — are test
- [ ] `bagare-sub-radical.js` — *fără test azi: scris test întâi*
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

### Lotul 2
- [ ] `addition-table-singapore.js` — *fără test azi: scris test întâi*
- [ ] `addition-table-singapore-missing.js` — *fără test azi: scris test întâi*
- [ ] `division-with-remainder.js` — *fără test azi: scris test întâi*
- [ ] `prime-divisions.js` — *fără test azi: scris test întâi*
- [ ] `equations-e3-e6.js` — are test
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

### Lotul 3
- [ ] `pre-equations-eff-navigation.js` — are test
- [ ] `multiplication-1120-v2.js` — are test
- [ ] `multiplication-1120-v2-modular.js` — are test, **9 subquizuri**
- [ ] `multiplication-1120-v3-train-eff-eq-forms.js` — are test, **3 subquizuri**
- [ ] `multiplication-1120-v4-intensiv-multipli-234.js` — are test, **5 subquizuri** (aici se repară și `sq5`)
- [ ] **OPRIRE** — „Am modificat și testat quizurile ...", userul verifică și el

## Faza D — impunerea (fără ea lucrarea NU e terminată)

- [ ] `falling-engine.js` validează semnătura modulului comun; altfel aruncă eroare explicită
- [ ] `SubquizDefinition.define()` aruncă dacă definiția conține `onAnswer`
- [ ] Verificat explicit că `rigle-cl1.js` (motor m2) nu e afectat
- [ ] Test-santinelă: vechea cale chiar crapă
- [ ] Toate testele repo-ului verzi + `npm run check:docs` + `npm run check:encoding`
- [ ] **OPRIRE** — raport final

---

## Note / probleme întâlnite

*(se completează pe parcurs — orice caz care nu încape în contract, orice bug descoperit și
raportat separat, orice decizie luată de user pe parcurs)*
