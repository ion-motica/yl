# Plan de implementare — Tabelul v2: fotografii stratificate per fact

Înlocuiește designul v1 („felii cronologice", `PLAN-tabel-fluenta.md`, rămas ca
istoric — NU-l urma). Autoritatea de design: `SPECIFICATIE.md` §13, secțiunea
„Fotografii (coloanele) — v2". Reguli de lucru: `AGENTS.md`. Tot ce era ambiguu e
decis și pinuit aici — nu re-deriva.

## Context și baseline (IMPORTANT)

Working tree-ul conține tabelul v1 **implementat dar NECOMIS** (motor + bootstrap +
CSS + teste, plus coloana sticky și scroll-ul implicit la dreapta). v1 a picat la
prima întâlnire cu datele reale (felia subțire măsura acoperirea, nu fluența) și a
fost înlocuit ca design. **Refolosești scheletul** (opțiunea din axa 5, subsecțiunea
5.2, ramificarea din bootstrap, construiesteAntet, scheletul de randare cu thead/
tbody/sticky/scroll) și **rescrii miezul** (builderul din motor, bifele, antetele,
conținutul celulelor).

## Pre-mortem (făcut; criteriile falsificabile sunt mai jos)

- Ipoteza riscantă („pozele stratificate dau un tabel onest și citibil") — testată
  prin simulare pe logul real; numerele-țintă sunt pinuite în „Verificarea pe log
  real". Implementarea TREBUIE să le reproducă exact.
- Toate cele 4 adâncimi produc poze utilizabile pe datele reale (B=611): A=2 → 16
  poze · A=5 → 7 · A=10 → 4 · A=20 → 2.
- Alternativele statistice (EWMA, shrinkage, Elo/IRT, FSRS) sunt documentate în
  spec ca respinse-deocamdată; nu implementa nimic din ele.

## Reguli de lucru (obligatorii)

- Editează NUMAI cu Edit/Write (diacritice; PowerShell Get-Content|Set-Content
  corupe). Fără `cd`. Commit DOAR la cererea userului.
- Modificări DOAR în fișierele din „Definition of done".
- La final: `?v=35` → `?v=36` la TOATE tagurile din `vizualizare3.html`.

## Pasul 1 — `definitii-axe.js`: bifele devin adâncime per fact

Înlocuiește integral axa `marime_calup` (ultima din etapa 5) cu:

```js
{
  id: "adancime_foto",
  eticheta: "Adâncimea fotografiei (ultimele N răspunsuri per fact)",
  subsectiune: "tabel_optiuni",
  tip_selectie: "unica",
  // Bootstrap-ul scrie sub axă linia de fezabilitate (câte poze ies din date).
  nota_dinamica: true,
  // `adancime` e valoarea citită de cod; id-ul e doar identificator de bifă.
  optiuni: [
    { id: "2", eticheta: "2 răspunsuri / fact", adancime: 2 },
    { id: "5", eticheta: "5 răspunsuri / fact", adancime: 5, activa: true },
    { id: "10", eticheta: "10 răspunsuri / fact", adancime: 10 },
    { id: "20", eticheta: "20 răspunsuri / fact", adancime: 20 },
  ],
},
```

Cheile de preset devin `adancime_foto_*`; chei vechi `marime_calup_*` rămase în
sertarele localStorage sunt ignorate silențios de `aplicaControalePreset`
(querySelector null → skip) — acceptat, nu trata.

## Pasul 2 — `config-praguri.js`: șterge blocul mort

Șterge din `interpretare_v1` blocul `calup: { marimi: ..., implicita: ... }` cu
comentariul lui (necitit de cod; opțiunile de adâncime trăiesc în definitii-axe).
Nu schimba nimic altceva; `praguri_version` rămâne (nu s-a schimbat niciun prag).

## Pasul 3 — motor: rescrie `construiesteModelTabelFluenta`

NU atinge: `segmenteazaFereastraInCalupuri`, `calculeazaSerieScorFluenta`,
`calculeazaScorFluenta` (rămân exportate, cu testele lor — servesc alte axe).
Funcțiile private `esteRaspunsValidPentruCalup`, `ziDin` se refolosesc direct
(același IIFE). `eticheteAntetCalup` (privată, v1) se șterge — nu mai are apelanți.

### Contract nou

```js
construiesteModelTabelFluenta({ inregistrari, catalog, adancime, praguri })
// -> {
//   tip: "tabel_fluenta",
//   adancime,
//   eticheta_domeniu: catalog.eticheta,
//   facts_per_subtabla,
//   numar_raspunsuri_valide,   // B — pt. linia de fezabilitate
//   antete: [ { eticheta, este_acum } ],     // cronologic (vechi -> noi)
//   randuri: [ { tip: "subtabla"|"total", eticheta, celule: [celulă] } ],
// }
// celulă (FĂRĂ null — toate rândurile au toate celulele):
// { scor,               // 0..1, MEREU calculat (nu null!) — rândul-total și
//                        //  afișarea depind de el; eticheta decide doar afișarea
//   eticheta, eticheta_text,               // clasificaIncredereScor + textul lui
//   n,                   // suma contribuțiilor per fact (max adancime × facts)
//   zile_distincte,      // zile distincte peste TOATE răspunsurile contribuite
//   facts_testate, facts_total,
//   facts_noi,           // facts cu ≥1 răspuns valid de la poza anterioară
//   data_prima_zi, data_ultima_zi }        // span-ul răspunsurilor contribuite
```

### Algoritm (implementează exact)

```text
valideaza: inregistrari array ("Motorul are nevoie de un array de înregistrări."),
  catalog cu celule ("Motorul are nevoie de un catalog cu celule."),
  adancime întreg ≥ 1 ("Adâncimea fotografiei trebuie să fie un întreg pozitiv.")

filtru = praguri.interpretare_v1.filtru
intrebari = grupeazaApasarilePeIntrebari(normalizeaza(inregistrari))
aleDomeniului = intrebari.filter(i => cheieCelulaDinInregistrare(i) ∈ set(catalog.celule))
valide = aleDomeniului.filter(i => esteRaspunsValidPentruCalup(i, filtru))   // ordinea = cronologia
B = valide.length
factsPerSubtabla = catalog.celule.filter(c => c.a === catalog.celule[0].a).length
pas = adancime * factsPerSubtabla

momente: k = B, B−pas, B−2·pas, … cât timp k ≥ 1; apoi inversate (vechi -> noi).
  // ancorare în prezent: ultima poză e mereu la k=B; cea mai veche poate fi subțire
B === 0 -> model cu antete: [] și randuri cu celule: [] (randarea are deja mesajul de gol)

antet(k): k === B -> { eticheta: "acum", este_acum: true }
          altfel  -> { eticheta: "zz.ll", este_acum: false }
  // "zz.ll" din valide[k−1].data_ora_ro: slice(8,10) + "." + slice(5,7)
  // antete duplicate în zile intense sunt ACCEPTATE (hover-ul are detaliile)

fereastraFact(cellId, k) = ultimele `adancime` elemente din
  valide.slice(0, k).filter(celula === cellId)     // NUMAI valide intră în fereastră

celulă(cellIds, k, kAnterior):    // kAnterior = momentul precedent, 0 la prima poză
  per fact f din cellIds:
    stats_f = calculeazaStatistici(aplicaFiltre({ curent: fereastraFact(f, k) }, filtru))
    scor_f  = calculeazaScorFact(stats_f, praguri.interpretare_v1).scor
  scor = Σ scor_f / cellIds.length               // BRUT, mereu — niciodată null
  n = Σ stats_f.n · facts_testate = #(stats_f.n > 0) · facts_total = cellIds.length
  facts_noi = #(facts cu ≥1 element în valide.slice(kAnterior, k))
    // prima poză: kAnterior=0 => facts_noi === facts_testate
  zile_distincte + data_prima_zi/data_ultima_zi: din ziDin() peste UNIUNEA
    ferestrelor per fact (răspunsurile efectiv contribuite, nu tot istoricul)
  eticheta = clasificaIncredereScor(n, zile_distincte, praguri.interpretare_v1.incredere)

randuri: per `a` crescător -> fereastra subtablei (eticheta `${a} ×`);
  ultimul rând: { tip: "total", eticheta: "Toată fereastra", cellIds: TOATE }
  calculat DIRECT cu aceeași procedură — matematic egal cu media subtablelor
  (subtable egale ca număr de facts; există test care încuie egalitatea).
```

Exportul rămâne același (`construiesteModelTabelFluenta` e deja în API).

## Pasul 4 — bootstrap

1. **Redenumiri de stare** (fluxul principal): `axaMarimeCalup` → `axaAdancime`
   (căutată după id `adancime_foto`); `marimeCalupActiva` → `adancimeActiva`
   (init din opțiunea cu `activa: true`, câmpul `adancime`, fallback 5);
   `marimeDinOptiune` → `adancimeDinOptiune` (citește câmpul `adancime`).
2. **Listener**: prefixul `marime_calup_` → `adancime_foto_`.
3. **Apelul motorului**: `construiesteModelTabelFluenta({ inregistrari, catalog,
   adancime: adancimeActiva, praguri })`.
4. **`randeazaControlPanel`**, în bucla generică de axe (după forEach-ul peste
   opțiuni, înainte de `tinta.appendChild(grup)`):
   ```js
   if (axa.nota_dinamica) {
     const nota = document.createElement("div");
     nota.className = "viz3-nota-dinamica";
     nota.dataset.notaAxa = axa.id;
     grup.appendChild(nota);
   }
   ```
5. **`randeazaTabelFluenta`**:
   - titlul: `% fluență per subtablă — ${model.eticheta_domeniu} · ${model.adancime} răsp/fact`;
   - antete: `th.textContent = antet.eticheta` (nimic altceva în antet);
   - **dispare ramura de celulă null** (toate celulele există acum); ramifică DOAR
     pe `celula.eticheta`: `date_insuficiente` → „—" cu clasa
     `viz3-tabel-insuficient`; `incredere_mica` → procent cu `viz3-tabel-redus`;
     altfel procent normal. NU pe `scor === null` (scorul nu mai e null);
   - title (toate celulele): `${eticheta_text} · n=${n} · zile=${zile_distincte} ·
     facts: ${facts_noi} noi · ${facts_testate - facts_noi} purtate ·
     ${facts_total - facts_testate} neatinse` + dacă există:
     ` · ${data_prima_zi} → ${data_ultima_zi}`;
   - la final, linia de fezabilitate (defensiv, dacă elementul există):
     ```js
     const nota = cpEl.querySelector('[data-nota-axa="adancime_foto"]');
     if (nota) {
       const pas = model.adancime * model.facts_per_subtabla;
       nota.textContent = `Fereastră: subtable de ${model.facts_per_subtabla} facts · ` +
         `poză = ${model.adancime}×${model.facts_per_subtabla} = ${pas} răspunsuri · ` +
         `date valide: ${model.numar_raspunsuri_valide} → ${model.antete.length} poze`;
     }
     ```
   - clearTimeout-urile foliilor, sticky column, scroll-ul implicit la dreapta,
     mesajul de gol — rămân exact cum sunt.

## Pasul 5 — CSS

- Adaugă: `.viz3-nota-dinamica { font-size: 11px; color: var(--viz3-text-slab);
  margin-top: 6px; }`
- Șterge regula `.viz3-tabel-celula-goala` (conceptul de celulă-null a dispărut).
- Restul claselor de tabel rămân.

## Pasul 6 — `?v=35` → `?v=36` (toate tagurile).

## Testele — RESCRIE `tests/vizualizare3-tabel-fluenta.test.js`

Cele 4 teste v1 validează semantica depășită — se înlocuiesc integral. Păstrează
pattern-ul (`incarcaMotor()`, literal `PRAGURI`, helper `apasariFact` cu forma
brută, `CATALOG` literal 12-13 × 1-2). Capcane știute: toleranță float 1e-9;
NU folosi `assert.equal` pe împărțiri.

**Fixture principal** (adancime 5 → pas = 5×2 = 10), în ordinea asta în array:
- bloc A (10): 6 × `12*1=12` @1,5s, zile alternate `["2026-07-01","2026-07-02"]`;
  apoi 4 × `12*2=24` @6,0s, aceleași zile alternate (a 10-a cade pe 07-02);
- bloc B (10): 5 × `13*1=13` @1,5s (07-10/07-11); apoi 5 × `12*1=12` @1,5s (07-12).

B=20 → momente k=10 și k=20. Valori așteptate (pre-calculate):

| | poza k=10 („02.07") | poza k=20 („acum") |
|---|---|---|
| rând 12× | scor **0,6** (12*1: ultimele 5 din 6 @1,5 → 1; 12*2: 4 @6 → 0,2) · n=9 · zile=2 · noi=2 · eticheta `date_insuficiente` | scor **0,6** (12*1: cele 5 din 07-12 → 1; 12*2 neschimbat) · n=9 · zile=3 · noi=1 |
| rând 13× | scor **0** · n=0 · noi=0 · `date_insuficiente` | scor **0,5** (13*1 → 1; 13*2 → 0) · n=5 · noi=1 |
| Toată fereastra | scor **0,3** · n=9 | scor **0,55** · n=14 |

Testele:
1. **Structură + antete**: antete `["02.07", "acum"]` cu `este_acum` corect;
   randuri `["12 ×","13 ×","Toată fereastra"]`; TOATE rândurile au exact 2 celule,
   niciuna null.
2. **Scoruri exacte** conform tabelului — inclusiv: scorul e PREZENT (0,6 / 0 /
   0,3…) chiar când eticheta e `date_insuficiente` (nu null).
3. **Total = media subtablelor** pe fiecare coloană (toleranță 1e-9).
4. **facts_noi**: k=10 → 12×: 2, 13×: 0; k=20 → 12×: 1, 13×: 1.
5. **Eticheta `incredere_mica` e atinsă** — fixture separat, adancime 10 (pas 20):
   10 × `12*1` @1,5 + 10 × `12*2` @6,0, zile alternate 07-01/07-02 → o singură
   poză („acum"): rând 12×: scor 0,6 · n=20 · zile=2 → eticheta `incredere_mica`.
6. **Validări**: inregistrari ne-array → throw; adancime 0 → throw.
7. **B=0**: `inregistrari: []` → antete `[]`, toate `celule: []`.

Suita completă: `node --test "tests/*.test.js"` → TOT verde (testele de segmentare
și scor-fluență rămân neatinse). Notă: `tests/equations-e3-e6.test.js` are un test
flaky cunoscut (generare aleatoare) — dacă pică DOAR el, re-rulează o dată.

## Verificarea pe log real (criteriile falsificabile — OBLIGATORIE)

Scrie în scratchpad un script read-only care rulează `construiesteModelTabelFluenta`
REAL (încărcat din motor-analiza.js) pe
`C:/Users/I/Downloads/youlearn-salvare-log-activitate-2026-07-18-11-46.json`,
catalog `{aMin:11,aMax:20,bMin:1,bMax:20}`, adancime 5, praguri din config. Țintele
(din simularea de design; scoruri rotunjite la întreg, ordine vechi → noi):

- 7 antete; ultima `acum`; celelalte: `13.07, 14.07, 14.07, 15.07, 15.07, 16.07`;
- rând `Toată fereastra`: **4, 16, 21, 26, 30, 36, 36** (%);
- rând `11 ×`: 24, 40, 40, 40, 40, 40, 40; rând `13 ×`: 0, 30, 38, 39, 39, 42, 41;
  rând `20 ×`: 0, 0, 0, 0, 0, 40, 40.

Dacă NU se reproduc exact → **STOP, nu raționaliza, nu „repara" țintele** —
raportează userului diferența. (Scorurile brute; afișarea cu „—" e strat separat.)

## Verificarea în browser (schimbare de UI)

Jurnalul real importat trăiește în browserul userului, NU în preview — acolo
verificarea de conținut e scriptul de mai sus; în browser verifici mecanica pe
sursa dummy:
1. `preview_start` `{name:"youlearn-local"}` → pagina modulului.
2. Sursa dummy → bifează „Tabel % fluență" → antete cu date + „acum" la final;
   linia de fezabilitate apare sub bifele de adâncime și are numerele coerente.
3. Schimbă adâncimea 5 → 2 → mai multe coloane; nota se actualizează; scroll-ul
   se deschide la dreapta; coloana de nume rămâne fixă la scroll.
4. Hover pe o celulă: title-ul cu `noi · purtate · neatinse`.
5. „—" apare doar unde eticheta e insuficientă (nu există celule goale).
6. Înapoi pe grilă → folii + 5.1 intacte; înapoi pe tabel. `read_console_messages`
   → zero erori. Screenshot ca dovadă.

## În AFARA scopului (NU face)

- Numărul de turns VIZIBIL în celule (userul l-a cerut explicit „nu încă") și
  ±X exact la hover — ambele „vor urma".
- Recomandatorul de fezabilitate; bifă calendaristică (zi/3 zile/săptămână);
  sdp/nsdp pe prima-apariție-zilnică; `session_id`; decădere/„rugină".
- Funcțiile v1 din motor (segmentare/serie) și testele lor — NEATINSE.

## Definition of done

- Fișiere modificate: `Vizualizare 3 - Claude/definitii-axe.js`,
  `Vizualizare 3 - Claude/config-praguri.js`, `Vizualizare 3 - Claude/motor-analiza.js`,
  `Vizualizare 3 - Claude/vizualizare3-bootstrap.js`, `Vizualizare 3 - Claude/vizualizare3.css`,
  `Vizualizare 3 - Claude/vizualizare3.html` (doar `?v`),
  `tests/vizualizare3-tabel-fluenta.test.js` (rescris). NIMIC altceva
  (`.claude/settings.local.json` și `node_modules/` nu se ating, nu se comit).
- `node --test "tests/*.test.js"` → toate verzi.
- Scriptul pe log real reproduce EXACT țintele pinuite.
- Verificarea browser parcursă, cu screenshot arătat userului.
- FĂRĂ commit până nu-l cere userul explicit.
