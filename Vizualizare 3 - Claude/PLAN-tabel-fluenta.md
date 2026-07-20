# Plan de implementare — Tabelul „% fluență per subtablă" (axa 5) + bifele de calup

Plan gata de execuție, în stilul `PLAN-segmentare-calupuri.md` (care a mers perfect).
Contextul de design: `SPECIFICATIE.md` §13. Reguli de lucru: `AGENTS.md`. Nu re-deriva
decizii — tot ce părea ambiguu e decis și pinuit aici.

## Scop

Prima vizualizare a seriei de scoruri: un tabel cu **rânduri = subtablele domeniului
activ + „Toată fereastra"**, **coloane = calupuri (vechi → noi)**, **celulă = scor %
+ etichetă de încredere**. Motorul există deja (`calculeazaSerieScorFluenta`, testat);
runda asta adaugă: builderul de model al tabelului (pur, în motor), opțiunea în axa 5,
subsecțiunea „5.2" cu bifele de mărime calup, randarea și CSS-ul.

Decizii de user (20.07.2026): bifele de calup stau în subsecțiunea tabelului (NU în
axa 2); **fără** plafonare pe acoperire (etichetele rămân doar pe n + zile);
recomandatorul de fezabilitate NU intră în runda asta.

## Reguli de lucru (obligatorii)

- Editează NUMAI cu tool-ul Edit/Write (fișierele au diacritice; PowerShell
  Get-Content|Set-Content le corupe).
- Fără `cd` în comenzi. Commit DOAR dacă îl cere userul, mesaj simplu în ghilimele.
- Modificări DOAR în fișierele din „Definition of done". Nu atinge motorul existent
  dincolo de adăugarea builderului + exportul lui.
- La final urcă `?v=33` → `?v=34` la TOATE tag-urile din `vizualizare3.html`
  (versiune comună, convenția proiectului).

## Pasul 1 — `definitii-axe.js` (etapa 5)

1. În axa `vizualizare` (id `vizualizare`), adaugă opțiunea nouă, activabilă (fără
   `dezactivata`), după `grila_10x10`:
   ```js
   { id: "tabel_fluenta", eticheta: "Tabel % fluență per subtablă (serie calupuri)" },
   ```
   `grila_10x10` rămâne cu `activa: true` (defaultul nu se schimbă).
2. În `subsectiuni` ale etapei 5, adaugă:
   ```js
   tabel_optiuni: "5.2 Opțiuni pt Tabel % fluență",
   ```
3. Tot în etapa 5, adaugă maparea declarativă reprezentare → subsecțiune (cheie nouă
   pe obiectul etapei, lângă `subsectiuni`):
   ```js
   // Ce subsecțiune de opțiuni aparține cărei reprezentări; bootstrap-ul ascunde
   // subsecțiunile reprezentărilor inactive.
   reprezentare_subsectiuni: { grila_10x10: "grila_optiuni", tabel_fluenta: "tabel_optiuni" },
   ```
4. Axă nouă, ULTIMA în array-ul `axe` al etapei 5 (ca să cadă în subsecțiunea nouă):
   ```js
   {
     id: "marime_calup",
     eticheta: "Mărime calup (răspunsuri valide)",
     subsectiune: "tabel_optiuni",
     tip_selectie: "unica",
     // `marime` e valoarea citită de cod; id-ul e doar identificator de bifă.
     optiuni: [
       { id: "25", eticheta: "25 (±10 puncte)", marime: 25 },
       { id: "50", eticheta: "50 (±7)", marime: 50 },
       { id: "100", eticheta: "100 (±5)", marime: 100, activa: true },
       { id: "200", eticheta: "200 (±3,5)", marime: 200 },
     ],
   },
   ```
   Randarea generică din bootstrap (radio + `dataset.preset = "marime_calup_<id>"`)
   vine gratis, inclusiv capturarea în preseturi (`construiesteZonaPreseturi` se
   creează automat pentru subsecțiunea nouă — vezi bootstrap ~linia 1647). Nimic
   manual pentru preseturi.

## Pasul 2 — motor: `construiesteModelTabelFluenta` (funcție pură + export)

În `motor-analiza.js`, după `calculeazaSerieScorFluenta`. Contract:

```js
construiesteModelTabelFluenta({ inregistrari, catalog, marimeCalup, praguri })
// -> {
//   tip: "tabel_fluenta",
//   marime_calup,
//   eticheta_domeniu: catalog.eticheta,
//   antete: [ { index_din_prezent, eticheta } ],   // vechi -> noi; [] dacă niciun calup nicăieri
//   randuri: [ { tip: "subtabla" | "total", eticheta, celule: [ null | celulă ] } ],
// }
```

- `inregistrari` = BRUTE (ca la `ruleazaAnaliza`); builderul rulează intern
  `normalizeaza` → `grupeazaApasarilePeIntrebari`.
- `celulă` = exact un element din seria `calculeazaSerieScorFluenta` (scor 0..1 sau
  null, eticheta, eticheta_text, n_total, n_valide, zile_distincte, facts_testate,
  facts_total, complet, data_prima_zi, data_ultima_zi, index_din_prezent).
- `null` în `celule` = „rândul ăsta nu are un calup atât de vechi" — DIFERIT de o
  celulă cu eticheta `date_insuficiente` (aia e un calup existent, dar subțire).
- Builderul se sprijină NUMAI pe `catalog.celule[]` (câmpurile `cell_id`, `a`) și
  `catalog.eticheta` — nimic altceva din catalog.

Algoritm:

```text
valideaza: inregistrari e array; catalog are `celule` array (mesaje în stilul valideaza() existent)
   (marimeCalup îl validează deja segmenteazaFereastraInCalupuri — nu dubla validarea)
intrebari = grupeazaApasarilePeIntrebari(normalizeaza(inregistrari))

ferestre = valorile distincte `a` din catalog.celule, crescător
  → per a: { tip: "subtabla", eticheta: `${a} ×`, celuleFereastra: cell_id-urile cu acel a }
  + la FINAL: { tip: "total", eticheta: "Toată fereastra", celuleFereastra: toate cell_id-urile }

per fereastră: serie = calculeazaSerieScorFluenta({ intrebari, celuleFereastra, marimeCalup, praguri })

nrColoane = max(serie.length) peste toate rândurile
aliniere LA DREAPTA (prezentul e coloana comună): celule = [null × (nrColoane − serie.length), ...serie]
  // seria e deja cronologică (vechi -> noi), deci index_din_prezent 0 cade pe ultima
  // coloană la TOATE rândurile — alinierea pe coloane = alinierea pe index_din_prezent.

antete: pentru coloana c (0..nrColoane−1), idx = nrColoane−1−c:
  idx 0 → `ultimele ${marimeCalup}` · idx 1 → `anterioarele ${marimeCalup}`
  · idx k≥2 → `cu ${k} calupuri în urmă`
```

Rândurile pentru subtable fără nicio dată rămân în model (celule toate null) — onest,
ca „netestat" în grilă. Modelul e NUMERIC (scor 0..1); formatarea în % o face randarea.
Exportă `construiesteModelTabelFluenta` în API-ul public.

## Pasul 3 — bootstrap: integrare

Cusăturile existente (numerele de linie sunt orientative, simbolurile sunt exacte):

- `CONFIGURATIE` (~144) — NU se atinge; ramura de tabel nu trece prin `ruleazaAnaliza`.
- `analizeazaSiRandeaza(inregistrari, info)` (~2010) — SINGURUL loc care transformă
  sursa în model + randare. Aici se ramifică.
- `randeazaVizualizarea` (~1837) — construiește antetul (titlu + butoanele de sursă,
  liniile ~1840-1857) și apoi grila/foliile.
- `randeazaControlPanel` (~1617) — generic; subsecțiunile se creează la ~1639-1648.
- Timerele foliilor: `ceasGrup` (clearTimeout ~504, setTimeout ~534) și `ceasAuto`
  (~615, ~619) — module-level în IIFE.

Modificări:

1. **Stare nouă** (lângă `sursaActiva`):
   ```js
   let reprezentareActiva = "grila_10x10";     // NU se persistă (convenția: doar Domeniul ține minte)
   let marimeCalupActiva = 100;                 // inițial din opțiunea cu activa:true din definitii
   let ultimaAnaliza = null;                    // { inregistrari, info } — pt. re-randare fără recitirea sursei
   ```
   Inițializează `marimeCalupActiva` citind din `axe` opțiunea `activa` a axei
   `marime_calup` (nu hardcoda 100 de două ori).

2. **Ramificarea** în `analizeazaSiRandeaza`:
   ```js
   function analizeazaSiRandeaza(inregistrari, info) {
     ultimaAnaliza = { inregistrari, info };
     if (reprezentareActiva === "tabel_fluenta") {
       const model = motor.construiesteModelTabelFluenta({ inregistrari, catalog, marimeCalup: marimeCalupActiva, praguri });
       randeazaTabelFluenta(vizEl, model, info);
       return;
     }
     ... exact codul existent (ruleazaAnaliza + randeazaVizualizarea) ...
   }
   function rerandeaza() { if (ultimaAnaliza) analizeazaSiRandeaza(ultimaAnaliza.inregistrari, ultimaAnaliza.info); }
   ```

3. **Ascultătorii de schimbare** — delegare pe `cpEl`, adăugată în fluxul principal
   după `randeazaControlPanel(cpEl, axe)` (nu modifica bucla generică de randare):
   ```js
   cpEl.addEventListener("change", (ev) => {
     const preset = ev.target?.dataset?.preset ?? "";
     if (preset.startsWith("vizualizare_") && ev.target.checked) {
       reprezentareActiva = preset.slice("vizualizare_".length);
       actualizeazaSubsectiuni();
       rerandeaza();
     }
     if (preset.startsWith("marime_calup_") && ev.target.checked) {
       marimeCalupActiva = marimeDinOptiune(preset.slice("marime_calup_".length));
       rerandeaza();
     }
   });
   ```
   `marimeDinOptiune(id)` caută în definitii axa `marime_calup` și întoarce câmpul
   `marime` al opțiunii (fallback: valoarea curentă). NU parsa numărul din id.

4. **Vizibilitatea subsecțiunilor**: în `randeazaControlPanel`, când se creează
   subsecțiunea (~1641), adaugă `tinta.dataset.subsectiune = axa.subsectiune;`.
   Apoi:
   ```js
   function actualizeazaSubsectiuni() {
     const etapaViz = axe.find((e) => e.reprezentare_subsectiuni);
     const mapare = etapaViz?.reprezentare_subsectiuni ?? {};
     const legate = new Set(Object.values(mapare));
     const vizibila = mapare[reprezentareActiva];
     cpEl.querySelectorAll("[data-subsectiune]").forEach((el) => {
       const id = el.dataset.subsectiune;
       el.hidden = legate.has(id) && id !== vizibila;
     });
   }
   ```
   Apeleaz-o o dată la pornire (după `randeazaControlPanel`) și la fiecare schimbare
   de reprezentare. Subsecțiunile care nu-s în mapare rămân mereu vizibile.

5. **Antetul comun**: extrage din `randeazaVizualizarea` construcția antetului
   (liniile ~1840-1857: titlu + cele 3 rânduri de sursă) într-o funcție
   `construiesteAntet(titluText, info)` care întoarce elementul `.viz3-viz-antet`,
   refolosind `randSursa`/`butonAlegeSursa`/`butonDescarcaJurnal`/`butonImportaJurnal`
   EXACT ca azi. `randeazaVizualizarea` o apelează cu titlul existent
   (`Starea curentă — tabla înmulțirii ${catalog.eticheta}`) — comportament identic.

6. **`randeazaTabelFluenta(container, model, info)`** — funcție nouă:
   - întâi `clearTimeout(ceasGrup); clearTimeout(ceasAuto);` (foliile nu mai există
     în DOM; timerele lor nu trebuie să mai lucreze pe noduri detașate);
   - `container.replaceChildren();`
   - antet: `construiesteAntet(`% fluență per subtablă — ${model.eticheta_domeniu} · calup ${model.marime_calup}`, info)`;
   - dacă `model.antete.length === 0`: paragraf clasa `viz3-tabel-gol` cu textul
     „Nicio dată în domeniul ales — tabelul apare când există răspunsuri
     înregistrate." și return;
   - altfel `div.viz3-tabel-scroll` > `table.viz3-tabel`:
     - `thead`: un `th` gol + câte un `th` per antet (`eticheta`);
     - `tbody`: per rând un `tr`; `th scope="row"` cu `eticheta` (rândul cu
       `tip: "total"` primește clasa `viz3-tabel-total` pe `tr`); apoi per celulă un `td`:
       - `null` → td gol, clasa `viz3-tabel-celula-goala`, fără title;
       - eticheta `date_insuficiente` → text `—`, clasa `viz3-tabel-insuficient`;
       - `incredere_mica` → `${Math.round(celula.scor * 100)}%`, clasa `viz3-tabel-redus`;
       - `incredere_mare` → procentul, fără clasă specială;
       - title (toate celulele ne-null):
         `${eticheta_text} · n=${n_total} · zile=${zile_distincte} · facts ${facts_testate}/${facts_total}`
         + dacă există date: ` · ${data_prima_zi} → ${data_ultima_zi}`.
   - Ramifică pe `celula.eticheta`, NU pe `scor === null`.

## Pasul 4 — CSS (`vizualizare3.css`)

Variabile noi în blocul `--viz3-*` de sus (urmează convenția existentă):
`--viz3-tabel-font: 14px; --viz3-tabel-redus-font: 12px;
--viz3-tabel-redus-culoare: #999; --viz3-tabel-contur: #ddd;
--viz3-tabel-total-fundal: #f6f6f6;`

Reguli noi la finalul fișierului: `.viz3-tabel-scroll { overflow-x: auto; }`;
`.viz3-tabel { border-collapse: collapse; font-size: var(--viz3-tabel-font); }`;
`th`/`td` cu padding 4px 8px și `border: 1px solid var(--viz3-tabel-contur)`;
scorurile aliniate la dreapta, antetele de rând la stânga;
`.viz3-tabel-redus { color/font-size din variabile }`;
`.viz3-tabel-insuficient { color: var(--viz3-tabel-redus-culoare); }`;
`.viz3-tabel-total { font-weight: 600; background: var(--viz3-tabel-total-fundal); }`;
`.viz3-tabel-gol { color gri, italic }`.

## Testele — fișier nou `tests/vizualizare3-tabel-fluenta.test.js`

Același pattern (`incarcaMotor()`, literal `PRAGURI` — copiază-le din
`tests/vizualizare3-segmentare-calupuri.test.js`). Helper nou pentru înregistrări
BRUTE (builderul primește brute, nu grupate):

```js
function apasariFact(fact, n, durataSecunde, zile) {
  // ca intrebariFact, dar cu forma brută: a_raspuns_corect: true,
  // a_cata_apasare_pe_buton: 1, durata_raspuns_secunde, data_ora_ro, fact
}
```

Catalog literal minim în test (builderul folosește doar celule[].cell_id, celule[].a,
eticheta):

```js
const CATALOG = {
  eticheta: "12-13 × 1-2",
  celule: [
    { cell_id: "mul:12x1", a: 12 }, { cell_id: "mul:12x2", a: 12 },
    { cell_id: "mul:13x1", a: 13 }, { cell_id: "mul:13x2", a: 13 },
  ],
};
```

Capcane știute: comparații float cu toleranță (`Math.abs(x−y) < 1e-9`), nu
`assert.equal`; „încredere mare" cere n≥50 ȘI ≥2 zile — fixture-urile alternează
2 zile round-robin ca fiecare calup să conțină ambele.

1. **Structura rândurilor, fără date**: `construiesteModelTabelFluenta({ inregistrari:
   [], catalog: CATALOG, marimeCalup: 50, praguri })` → randuri cu etichetele
   `["12 ×", "13 ×", "Toată fereastra"]`, tipurile `["subtabla", "subtabla",
   "total"]`, `antete: []`, toate `celule: []`; `eticheta_domeniu: "12-13 × 1-2"`;
   `marime_calup: 50`.
2. **Aliniere la dreapta + antete + scoruri** (marimeCalup 50). Fixture, în ordinea
   asta în array: 100 brute pe `12*1=12` @1,5s, zilele alternând
   `["2026-07-01","2026-07-02"]`; apoi 50 brute pe `13*2=26` @6,0s, zilele
   `["2026-07-10","2026-07-11"]`. Așteptări:
   - `antete` (3 coloane): `["cu 2 calupuri în urmă", "anterioarele 50", "ultimele 50"]`;
   - rând `12 ×`: `celule = [null, c, c]` — ambele c: scor ≈ **0,5** (fact 12×1
     fluent = 1; 12×2 netestat = 0; media pe 2 facts), eticheta `incredere_mare`;
   - rând `13 ×`: `celule = [null, null, c]` — c: scor ≈ **0,1** (13×2: viteza
     (7−6)/(7−2) = 0,2, corectitudine 1 → 0,2; 13×1 netestat → media 0,1),
     `incredere_mare`;
   - rând `Toată fereastra`: 3 celule: vechi ≈ **0,25** (50×12×1@1,5 → 1 din 4
     facts), mijloc ≈ **0,25**, recent ≈ **0,05** (0,2 din 4 facts); toate
     `incredere_mare` (fără plafonare pe acoperire — decizia userului);
   - pe ultima coloană, `index_din_prezent === 0` la toate rândurile care au celulă.
3. **Celulă subțire**: 10 brute pe `12*1=12` @1,5s, o singură zi → rând `12 ×` cu o
   celulă: `eticheta "date_insuficiente"`, `scor null`.
4. **Validări**: `inregistrari` ne-array → throw; `marimeCalup: 0` → throw (propagat
   din segmentare).
5. **Suita veche neatinsă**: `node --test "tests/*.test.js"` → toate verzi (342
   existente + cele noi). Notă: `tests/equations-e3-e6.test.js` are un test flaky
   cunoscut (generare aleatoare) — dacă pică DOAR el, re-rulează o dată înainte să
   suspectezi altceva.

## Verificarea în browser (obligatorie — e schimbare de UI)

1. `preview_start` cu `{name: "youlearn-local"}`; deschide
   `http://localhost:8770/Vizualizare 3 - Claude/vizualizare3.html`.
2. Pe sursa dummy („Alege dummy log pe 8 săptămâni" — volum mare, coloane multe):
   bifează „Tabel % fluență per subtablă" → verifică: subsecțiunea 5.1 dispare, 5.2
   apare; tabelul are rânduri per subtablă + „Toată fereastra"; ultima coloană
   „ultimele 100"; celulele gri/„—" unde e subțire; hover pe o celulă arată
   detaliile; schimbă calup 100 → 25 → tabelul se recalculează (coloane mai multe).
3. Înapoi pe „Grila X × Y stare" → grila + foliile funcționează EXACT ca înainte
   (inclusiv ciclarea automată a foliilor; 5.2 dispare, 5.1 revine).
4. Pe jurnalul real/importat: tabelul apare (probabil 1 coloană și multe „Date
   insuficiente" — corect și onest, nu e bug).
5. Screenshot ca dovadă pentru user (tabelul pe dummy + o dată grila reactivată).
6. `read_console_messages` — zero erori.

## În AFARA scopului (NU face)

- Recomandatorul de fezabilitate a granulației (rundă separată, decis).
- Persistarea reprezentării/calupului peste refresh (doar Domeniul persistă — convenție).
- Plafonarea pe acoperire (userul a decis NU).
- Axa 2 (Segmentare), axa 4 (Interpretare), grila/foliile, motorul existent —
  neatinse (în afara adăugării builderului + export).
- `session_id`, grafice, sortări/interacțiuni în tabel.

## Definition of done

- Fișiere modificate: `Vizualizare 3 - Claude/definitii-axe.js`,
  `Vizualizare 3 - Claude/motor-analiza.js`,
  `Vizualizare 3 - Claude/vizualizare3-bootstrap.js`,
  `Vizualizare 3 - Claude/vizualizare3.css`, `Vizualizare 3 - Claude/vizualizare3.html`
  (doar `?v`), plus fișierul nou `tests/vizualizare3-tabel-fluenta.test.js`.
  NIMIC altceva (`.claude/settings.local.json` și `node_modules/` nu se ating și nu
  se comit).
- `node --test "tests/*.test.js"` → toate verzi.
- Verificarea din browser parcursă integral, cu screenshot arătat userului.
- Fără commit până nu-l cere userul explicit.
