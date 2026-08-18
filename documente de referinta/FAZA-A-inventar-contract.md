# Faza A — inventarul variației reale + contractul propus

> Anexă la `PLAN-motor-comun-raspuns.md` (§5, Faza A). Citit din codul real, pe toate cele 18
> fișiere/motoare în scop + cele 17 subquizuri, 18.08.2026. Regula confirmată, fără excepții:
> **răspuns corect → avansezi; răspuns greșit → rămâi pe aceeași întrebare până răspunzi corect.**
> Ce variază legitim: (a) ce întrebare vine următor, (b) cum se construiesc opțiunile, (c) cum se
> numără o întrebare **rezolvată** (corect, oricâte încercări a luat) spre ținta subquiz-ului,
> (d) pauze/animații ca durate, (e) un plafon opțional de încercări pe aceeași întrebare, după
> care se forțează rezolvarea (plasa de siguranță, ca la sq3).

## 1. Categoriile găsite (fapte, nu opinii)

**Categoria 1 — deja conforme** (rămân pe întrebare la greșit, avansează doar la corect):
`addition-table.js`, `addition-table-range.js`, `prime-divisors.js`, `sub-sau-langa-radical.js`,
`addition-table-singapore.js`, `addition-table-singapore-missing.js`, `prime-divisions.js`,
`equations-e3-e6.js`, `eff-quiz/engine.js`, `conexe-table-quiz/engine.js`,
`succesive-quiz/engine.js`, `pre-equations-eff-navigation.js`, `v4:base`, `v4:sq3` (parțial —
vezi Cat. 5), `v2-modular:anchors`, `v2-modular:rapidAnchorAdditions`,
`v2-modular:effectiveAnchorAddition`, `v2-modular:nonAnchorProducts`. **18 din ~31.**

**Categoria 2 — avansează mereu, nu verifică deloc corectitudinea** (nu doar etichetă greșită —
`isCorrect` nici nu e citit): `v2-modular:intensiv`, `v2-modular:effectiveAnchorAdditionIntensive`,
`v2-modular:nonAnchorProductsIntensive`, `v2.js` subquiz „intensiv" + sub-mod „effectiveIntensiv" +
sub-mod „nonAnchorProductsIntensiv", `v4:sq2VBS/SBS` (cod mort), `v3:base`, `v3:sq2`, `v3:sq2SBS`
(toate 3 subquizurile fișierului). **10 din ~31.**

**Categoria 3 — avansează mereu, urmărește corectitudinea, dar etichetează greșit** (bug-ul
original sq3/sq5 — avans intern tăcut + `outcome` incorect, ecran desincronizat de stare):
`v4:sq5` (eticheta reparată deja, politica nu), `v2-modular:anchorSumValues` (ambele ramuri),
`v2-modular:domainProducts` (doar ramura de tranziție între domenii), `v2.js:anchorSumValues`
(Subquiz 3). **4 din ~31.**

**Categoria 4 — avansează mereu, etichetă onestă, tot încalcă regula:**
`division-with-remainder.js` (schimbă notația la 1a greșeală, sare la alt fapt la a 2a),
`bagare-sub-radical.js` (sare direct la altă întrebare, nicio reluare vreodată). **2 din ~31.**

**Categoria 5 — mecanism de avans forțat după un număr fix de încercări greșite pe aceeași
întrebare, fără ca răspunsul să fi fost dat corect vreodată: DE ELIMINAT.** Găsit într-un singur
loc — `v4:sq3`, limita 5 încercări (`SQ3_EXIT_MAX_ATTEMPTS`). Decizie explicită a userului,
18.08.2026: acest mecanism nu a fost cerut niciodată de el — a fost tratat greșit ca „excepție
acceptată" într-un schimb anterior, fără confirmare directă. **O întrebare rămâne pe ecran oricât
de multe răspunsuri greșite ia — fără limită, fără excepție — până se răspunde corect.** Nu mai e
un parametru opțional al contractului; nu mai există deloc.

**Categoria 6 — „cotă" de nivel numărată pe TOTAL de apăsări, nu pe rezolvate:**
`bagare-sub-radical.js` (21), `division-with-remainder.js` (21) — ambele incrementează la
fiecare apăsare, corectă sau nu. Sub regula confirmată (numărul se ia la rezolvare, nu la
apăsare), ambele trebuie renumărate — altfel, odată impusă reluarea pe greșit, un copil blocat pe
o singură întrebare ar epuiza cota fără să fi rezolvat aproape nimic.

**Categoria 7 — secvențe multi-pas legitime** (mai multe trepte în aceeași unitate logică, fiecare
treaptă respectând regula individual — nu cere nimic special de la contract, „următoarea treaptă"
e doar ce întoarce `generator`): `prime-divisions.js` (descompunere factor cu factor),
`addition-table-singapore.js`/`-missing.js` (coadă → fază retry → avans),
`pre-equations-eff-navigation.js` (3 pași per triunghi), `eff-quiz`/`conexe-table-quiz`
(serie A/B, bloc m1/m2).

**Categoria 8 — pauze/animații explicite deja existente:**
`addition-table-singapore.js`/`-missing.js`: `promptHoldMs: 400` la final de tură (o singură
valoare, hardcodată, de 3 ori). `prime-divisions.js`: `promptHoldMs: CORRECT_PROMPT_HOLD_MS` (160)
la fiecare pas corect intermediar. Restul fișierelor: fără pauză explicită (avans imediat) sau
doar `runDelayMs`/delay implicit de motor la tranziții de nivel.

## 2. Contractul propus

Modul nou, `js/subquiz/raspuns-standard.js` (nume de lucru), cu denumiri în română. Ideea:
subquiz-ul/quizul dă **date**, modulul decide **tranziția**.

> **Notă 18.08.2026:** contractul de mai jos e propunerea agentului, nu regulile userului — semnalat
> explicit de user ca fiind „implementarea ta", nu derivată din reguli date de el (intrare în
> subquiz la condiția X, ieșire la condiția Y). Rămâne aici ca punct de plecare pentru discuție,
> dar **nu e aprobat** — se rescrie pe baza condițiilor exacte de intrare/ieșire pe care userul le
> confirmă separat, per subquiz (vezi întrebările din §4).

```js
CreeazaRaspunsStandard({
  esteCorect(itemCurent, indexAles) -> boolean,

  intrebareUrmatoare(context) -> item,
  // apelata DOAR cand se avanseaza dupa un raspuns CORECT — fara nicio alta cale de avans,
  // fara limita de incercari. "urmatoarea" poate fi o intrebare noua SAU urmatorul pas al
  // unei secvente (Cat. 7) — modulul nu stie diferenta, nu-l priveste.

  laIntrebareRezolvata(item) -> comanda | undefined,
  // apelat O SINGURA DATA per intrebare, exact cand a fost raspunsa CORECT (nu exista alta
  // cale de rezolvare). AICI isi actualizeaza subquiz-ul propriul contor spre tinta lui si
  // decide push/pop/exit daca tinta a fost atinsa. Daca nu returneaza nimic, modulul cere
  // `intrebareUrmatoare()`.

  mesaje: { corect, gresit },              // functii(chosen) -> text, sau string fix
  pauze: { dupaRaspunsCorect, dupaAvansIntreg },   // ms, optionale — acopera promptHoldMs/runDelayMs
})
```

**Eliminat din contract:** orice parametru de tip „numar maxim de incercari" sau echivalent —
nu exista nicio cale prin care o intrebare avanseaza fara raspuns corect.

**De ce așa, pe scurt:** `esteCorect` + `intrebareUrmatoare` = singurele lucruri specifice
conținutului (CE). `laIntrebareRezolvata` e singurul loc unde un subquiz poate cere o rutare
diferită (push/pop/exit) — și se declanșează exclusiv la rezolvare, niciodată la o apăsare
greșită încă nerezolvată, deci nu poate reproduce bug-ul din Categoriile 2-4. `plasaDeSigurantaIncercari`
transformă Categoria 5 (azi cod, la sq3) în dată, disponibilă oricui.

**Ce NU intră în contract, intenționat:** rutarea push/pop/exit/jump rămâne exclusiv în
`subquiz-orchestrator.js` (deja corect centralizată, §3 din plan) — `laIntrebareRezolvata` doar
*declanșează* o comandă de rutare, nu o reimplementează.

## 3. Decizii deja confirmate de user (nu se redeschid)

- Regula e universală, fără nicio a doua politică — orice „avansează mereu" e o încălcare de
  reparat, nu o variantă de păstrat (Categoriile 2, 3, 4 se aliniază toate la Cat. 1).
- Numărarea spre orice țintă/cotă se face **la rezolvare**, niciodată la apăsare — rezolvă direct
  Categoria 6.
- Secvențele multi-pas (Categoria 7) nu cer nimic special — sunt pur „ce întrebare vine următor".

## 4. Întrebări deschise, înainte de a scrie modulul (Faza B)

1. **Pauzele de 160ms/400ms găsite (Categoria 8) — rămân valorile alea exacte, per fișier, sau
   se unifică la o singură valoare standard** (ex. `DEFAULT_REVEAL_HOLD_MS=160`, deja constantă
   în motor) **pentru toate quizurile, inclusiv cele care azi n-au nicio pauză?**
2. **`v3` are toate cele 3 subquizuri ale lui în Categoria 2** (avansează mereu, fără verificare).
   E singurul fișier unde 100% din conținut trebuie schimbat de comportament vizibil pentru
   copil (azi: răspunde orice, treci mai departe → după: aștepți răspunsul corect). Confirmi că
   asta e intenționat, nu doar o consecință acceptată tacit?
3. **Cele 2 cazuri din Categoria 6** (`bagare-sub-radical`, `division-with-remainder`) — cota de
   21 rămâne 21, doar recalculată pe rezolvate, sau se re-evaluează valoarea acum că sensul ei
   se schimbă (21 rezolvate ia sigur mai mult timp real decât 21 apăsări)?
