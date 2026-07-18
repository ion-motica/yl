# Plan de implementare — segmentarea în calupuri (axa 2, pentru tabelul de scor)

Plan detaliat, gata de execuție. Contextul complet: `SPECIFICATIE.md` §13 (design-ul
înghețat) + `AGENTS.md` (reguli de lucru). Nu re-deriva decizii: tot ce e ambiguu a
fost deja decis și e pinuit aici.

## Scop

`calculeazaScorFluenta` (există, testată) calculează scorul unei ferestre de facts pe
UN set de întrebări. Pasul ăsta construiește seturile: taie istoricul unei ferestre în
**calupuri de N răspunsuri valide consecutive, ancorate în prezent**, și compune seria
de scoruri (viitoarele coloane ale tabelului). Doar motor pur + teste. **Fără UI.**

## Reguli de lucru (obligatorii)

- Modificări DOAR în fișierele listate la „Definition of done". Nimic altceva.
- Editează cu tool-ul Edit, NU prin PowerShell `Get-Content|Set-Content` (fișierele au
  diacritice; PowerShell le corupe).
- Fără `cd` în comenzi; fără pipe-uri inutile; commit DOAR dacă cere userul, cu mesaj
  simplu între ghilimele (fără `$(...)`).
- Nu adăuga nimic din secțiunea „În afara scopului", oricât de util ar părea.

## Pasul 1 — refactor mic în `motor-analiza.js` (comportament identic)

În `aplicaFiltre` există predicatul intern `impulsiva`. Extrage-l ca funcție de modul,
lângă celelalte helpere de filtrare:

```js
// Apăsare oarbă: sub plancher nu e un răspuns citit. Câmp opțional în filtru.
function esteRaspunsImpulsiv(intrebare, filtru) {
  const prag = filtru.plancher_impulsivitate_secunde;
  const t = intrebare.timp_primul_raspuns_secunde;
  return prag != null && t !== null && t < prag;
}
```

`aplicaFiltre` îl apelează în loc de closure-ul local. Zero schimbare de comportament
(testele existente trebuie să rămână verzi fără nicio modificare).

## Pasul 2 — predicatul de validitate pentru calupuri

„Răspuns valid" = exact ce numără `calculeazaStatistici` ca `n` (ca `n_valide` al
calupului să fie garantat egal cu `n_total` al scorului — există test pentru asta):

```js
// Valid pt. calup = intră în precizie: are rezultat, nu e impulsiv, iar dacă
// filtrul exclude timpii extremi din precizie, respectă și intervalul de timp.
function esteRaspunsValidPentruCalup(intrebare, filtru) {
  if (intrebare.corect_din_prima === null || intrebare.corect_din_prima === undefined) return false;
  if (esteRaspunsImpulsiv(intrebare, filtru)) return false;
  if (filtru.exclude_timpi_extremi_din_precizie) {
    const t = intrebare.timp_primul_raspuns_secunde;
    if (t !== null && (t < filtru.timp_minim_secunde || t > filtru.timp_maxim_secunde)) return false;
  }
  return true;
}
```

## Pasul 3 — `segmenteazaFereastraInCalupuri` (miezul)

Funcție nouă în `motor-analiza.js`, lângă `segmenteazaInCalupuri` (pe care NU o
atingi — aceea are alt contract: un calup per celulă, pentru grila de stare).

### Contract

```js
segmenteazaFereastraInCalupuri({ intrebari, celuleFereastra, marimeCalup, filtru })
// -> array de calupuri, ordonat CRONOLOGIC (vechi -> noi):
// [{ index_din_prezent,   // 0 = cel mai recent calup (deci ultimul din array)
//    intrebari,           // felia contiguă de întrebări (valide + invalide)
//    n_valide,            // câte valide conține; la calupuri pline == marimeCalup
//    complet,             // n_valide === marimeCalup
//    data_prima_zi,       // ziua (YYYY-MM-DD) primului răspuns VALID din calup, sau null
//    data_ultima_zi }]    // ziua ultimului răspuns VALID din calup, sau null
```

- `intrebari` = întrebări GRUPATE (ieșirea din `grupeazaApasarilePeIntrebari`), în
  ordinea salvării — același contract ca la `calculeazaScorFluenta`. Ordinea
  array-ului E cronologia; nu parsa timestampuri pentru ordonare.
- `celuleFereastra` = array de cell_id (ex. `["mul:12x3", "mul:12x4"]`), ca la
  `calculeazaScorFluenta`.
- `filtru` = obiectul de filtru (apelantul dă `praguri.interpretare_v1.filtru`).

### Algoritm (pseudocod — implementează exact asta)

```text
valideaza: intrebari e array (altfel throw "Segmentarea are nevoie de un array de întrebări.")
valideaza: marimeCalup e întreg >= 1 (altfel throw "Mărimea calupului trebuie să fie un întreg pozitiv.")

cheiFereastra = Set(celuleFereastra)
aleFerestrei = intrebari.filter(i => cheiFereastra.has(cheieCelulaDinInregistrare(i)))
   // filter păstrează ordinea originală — exact ce ne trebuie

calupuri = []
calupCurent = []   // se construiește de la NOU spre VECHI
nValide = 0
parcurge aleFerestrei DE LA COADĂ SPRE ÎNCEPUT (i = length-1 ... 0):
  adaugă întrebarea la ÎNCEPUTUL calupului curent (unshift sau push + reverse la final)
  dacă esteRaspunsValidPentruCalup(intrebare, filtru): nValide++
  dacă nValide === marimeCalup:
    închide calupul (index_din_prezent = calupuri.length), adaugă-l la calupuri
    calupCurent = [], nValide = 0
la final, dacă calupCurent are nValide >= 1: închide-l ca ultim calup (cel mai vechi, incomplet)
   // calup cu 0 valide (doar invalide rămase) NU se emite

inversează array-ul calupuri -> ordinea returnată e vechi -> noi
data_prima_zi / data_ultima_zi = ziDin() pe primul/ultimul răspuns VALID al feliei
```

### Cazuri-limită (comportament pinuit)

| Caz | Rezultat |
| --- | --- |
| 130 valide, calup 100 | 2 calupuri: [vechi: 30, incomplet, index_din_prezent=1], [nou: 100, complet, index=0] — ancorare în prezent: calupul PLIN e cel recent |
| exact divizibil (200/100) | toate `complet: true` |
| întrebări invalide printre valide | nu numără la mărime; rămân în felia lor cronologică (scorul le filtrează oricum) |
| facts din afara ferestrei | ignorate complet (nu intră în nicio felie) |
| array gol sau doar invalide | `[]` (nu un calup gol) |
| marimeCalup 0 / negativ / ne-număr | throw |

## Pasul 4 — `calculeazaSerieScorFluenta` (compunerea)

```js
// Seria de scoruri a unei ferestre: un element per calup, cronologic (vechi -> noi).
// Elementul = rezultatul calculeazaScorFluenta pe felia calupului + metadatele lui.
function calculeazaSerieScorFluenta({ intrebari, celuleFereastra, marimeCalup, praguri }) {
  const filtru = praguri.interpretare_v1.filtru;
  const calupuri = segmenteazaFereastraInCalupuri({ intrebari, celuleFereastra, marimeCalup, filtru });
  return calupuri.map((calup) => ({
    ...calculeazaScorFluenta({ intrebari: calup.intrebari, celuleFereastra, praguri }),
    index_din_prezent: calup.index_din_prezent,
    n_valide: calup.n_valide,
    complet: calup.complet,
    data_prima_zi: calup.data_prima_zi,
    data_ultima_zi: calup.data_ultima_zi,
  }));
}
```

Garanție de consistență (testată): `element.n_total === element.n_valide` pentru
fiecare element — cele două numără același lucru pe definiții identice.

Notă: viitorul UI afișează coloanele exact în ordinea array-ului (vechi → noi) și
etichetează cu `index_din_prezent` („ultimele 100" = index 0). Motorul NU formatează
texte de antet.

## Pasul 5 — export API

În `global.MotorAnalizaVizualizare3`, adaugă `segmenteazaFereastraInCalupuri` și
`calculeazaSerieScorFluenta` (după `calculeazaScorFluenta`). Predicatele rămân private.

## Pasul 6 — comentariu stale în `config-praguri.js`

La blocul `calup:` din `interpretare_v1`, comentariul zice „segmentarea efectivă pe
calupuri rămâne «vor urma»". Înlocuiește-l cu: segmentarea e implementată în motor
(`segmenteazaFereastraInCalupuri`); `marimi` = bifele pentru UI-ul viitor.

## Pasul 7 — cache busting în `vizualizare3.html`

Convenția proiectului: orice schimbare de JS urcă `?v=N` la script-ul respectiv.
Urcă versiunea la `motor-analiza.js` și `config-praguri.js` (acoperă și schimbările
din commit-ul anterior, care n-au urcat-o — nimic vizibil nu depindea de ele atunci).

## Testele — fișier nou `tests/vizualizare3-segmentare-calupuri.test.js`

Folosește EXACT pattern-ul din `tests/vizualizare3-scor-fluenta.test.js`: același
`incarcaMotor()`, același literal `PRAGURI`, același helper `intrebariFact(fact, n,
durataSecunde, zile)` (copiază-le — fișierele de test sunt standalone).

Capcane știute (au mușcat deja o dată):
- comparații de virgulă mobilă: folosește toleranță (`Math.abs(x - y) < 1e-9`), nu
  `assert.equal`, oriunde intră împărțiri;
- `incredere_mare` cere **n ≥ 50 ȘI ≥ 2 zile distincte** — fixture-urile pentru
  „încredere mare" trebuie să întindă răspunsurile pe minim 2 zile.

Testele, cu valori pre-calculate:

1. **Ancorare în prezent**: 30 întrebări valide (1,5s) pe ziua `2026-07-01`, apoi 100
   valide pe `2026-07-02` (în ordinea asta în array), fereastra `["mul:12x3"]`,
   calup 100 → 2 calupuri; `[0]` = vechi: `n_valide 30, complet false,
   index_din_prezent 1, data_prima_zi "2026-07-01"`; `[1]` = nou: `n_valide 100,
   complet true, index_din_prezent 0, data_prima_zi "2026-07-02"`.
2. **Exact divizibil**: 200 valide, calup 100 → 2 calupuri, ambele `complet: true`.
3. **Invalidele nu numără**: 10 valide + 5 impulsive (0,1s) + încă 10 valide,
   calup 10 → exact 2 calupuri cu `n_valide 10` fiecare. Plus o întrebare cu
   `corect_din_prima` lipsă → nici ea nu numără.
4. **Alte facts nu intră**: amestec `12*3=36` (7 valide) și `5*5=25` (20 valide),
   fereastra `["mul:12x3"]`, calup 5 → 2 calupuri (vechi: 2, nou: 5).
5. **Gol / doar invalide → `[]`**; **marimeCalup 0 / -1 / "abc" → throw**.
6. **Seria arată progresul**: fereastra `["mul:16x7"]`, calup 50; istoric: 50 valide
   corecte la mediană 6,0s (pe zilele 07-01/07-02), apoi 50 valide corecte la 1,5s
   (pe 07-10/07-11). Seria are 2 elemente, cronologic: `serie[0].scor ≈ 0.2`
   (viteza (7−6)/(7−2)=0,2 × corectitudine 1), `serie[1].scor ≈ 1.0`; ambele
   `eticheta "incredere_mare"`; `serie[1].scor > serie[0].scor`.
7. **Consistența n**: pe fixture-ul de la testul 3, pentru fiecare element din serie:
   `element.n_total === element.n_valide`.
8. **Compatibilitate**: nu modifica testele existente; toate trebuie să treacă
   neschimbate.

## În AFARA scopului (NU face, chiar dacă pare firesc)

- Tabelul UI / bootstrap / HTML / CSS (în afara bump-ului `?v`).
- `definitii-axe.js` — axa 2 din CP rămâne neatinsă; opțiunea de UI vine cu tabelul.
- `ruleazaAnaliza` și `segmenteazaInCalupuri` existente — neatinse.
- Calupuri pe sesiuni/zile (cere `session_id` — „vor urma").
- Recomandatorul de fezabilitate a granulației (feature separat; API-ul de aici îl
  va servi apelând `segmenteazaFereastraInCalupuri` cu mai multe mărimi).
- Plafonarea pe acoperire (încă DE CONFIRMAT în §13).

## Definition of done

- Fișiere modificate: `Vizualizare 3 - Claude/motor-analiza.js`,
  `Vizualizare 3 - Claude/config-praguri.js` (doar comentariul),
  `Vizualizare 3 - Claude/vizualizare3.html` (doar `?v`),
  plus fișierul nou `tests/vizualizare3-segmentare-calupuri.test.js`. NIMIC altceva
  (`git status` curat în rest; `.claude/settings.local.json` și `node_modules/` nu
  se ating și nu se comit).
- `node --test "tests/*.test.js"` → TOATE verzi (334 existente + cele noi).
- Nu e nevoie de verificare în browser: nicio suprafață UI nu se schimbă.
- Fără commit până nu-l cere userul explicit.
