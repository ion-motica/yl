# Vizualizare 3 - Claude — Specificație

> Modul nou, de la zero, pentru interpretarea și vizualizarea logurilor YouLearn.
> Înlocuiește încercarea MABP din `Vizualizare si interpretare logs/` (rămâne intactă, nu o atingem).
> Regulile de design: vezi `AGENTS.md` → „Programare simplă și modulară în YouLearn".

## 0. Fraza-nucleu (testul de fidelitate)

**MABP = Motor de Axe cu Bife și Preseturi.** Control panelul este generat din definiții declarative de axe. Combinațiile de bife formează configurația. Configurația trece printr-un motor comun care validează → normalizează → grupează → segmentează → filtrează → calculează → interpretează → vizualizează. Adăugarea unei opțiuni = adăugarea ei în array, fără cod nou de logică.

Structura este **înghețată** de user. Codul detaliază interiorul funcțiilor, nu schimbă structura.

## 1. Ce vede utilizatorul

- Buton nou în CP (control panel din `index.html`). La apăsare → **tab nou**.
- Pagina nouă: **stânga** = div control panel; **dreapta** = div vizualizare. Ambele scrolabile independent.
- CP-ul are 6 etape (0–5). Fiecare etapă arată axele ei. În prototip, **o singură opțiune activă** per axă (bifă/radio); restul afișate dezactivate, cu mențiunea „vor urma".
- Prima vizualizare: **grila 10×10** a tablei înmulțirii (ca în captura aprobată): fiecare celulă = un fact, cu etichetă de stare + 4 pătrățele „traseul stării".

## 2. Datele disponibile (contractul jurnalului)

Sursă: IndexedDB `youlearn_jurnal_intrebari` → `intrebari`, citită **în ordinea cheii** (ordinea salvării). Fiecare înregistrare = o apăsare:

`data_ora_ro, quiz_name, subquiz_name, intrebare, raspuns, raspuns_corect, a_cata_apasare_pe_buton, durata_raspuns_secunde, fact, quiz_id, subquiz_id, fact_id, eq_form, extra` (+ `indexeddb_key` adăugat de cititor).

**Ce rămâne `null` / indisponibil (onest, nu inventăm):**

| Lipsă | Efect | Consecință în prototip |
| --- | --- | --- |
| `session_id` | Nu putem segmenta pe sesiuni sigur | Axa „ultimele N sesiuni" rămâne dezactivată („vor urma") |
| `question_instance_id` | — | **Nu e necesar**: gruparea pe întrebări se face din `a_cata_apasare_pe_buton` (valoarea `1` începe o întrebare nouă), citind în ordinea salvării |
| evenimente `timeout` | Nu sunt logate | Numărul de întrebări afișate e subestimat; se notează ca limitare, nu se corectează |
| `optiuni_afisate` | Nu sunt logate | Analiza distractorilor rămâne „vor urma" |

## 3. Fluxul motorului (înghețat)

Procedural, citibil de sus în jos. Fiecare pas produce date inspectabile (testabile separat).

```text
inregistrari brute (IndexedDB, ordinea cheii)
→ valideaza()
→ normalizeaza()
→ grupeazaApasarilePeIntrebari()   // apăsări → întrebări (corect-din-prima, nr apăsări, timpi)
→ selecteazaDomeniu()              // fact / subtablă / tablă, via catalog
→ segmenteazaInCalupuri()          // ferestrele de comparație (azi / 7z / N răspunsuri / tot)
→ aplicaFiltre()                   // per calup: exclude outliers/timpi suspecți
→ calculeazaStatistici()           // per calup: precizie, mediană, n, zile distincte
→ interpreteaza()                  // clasificare stare (+ ulterior: progres între calupuri)
→ construiesteModelVizualizare()
→ afiseaza()                       // grila 10×10
```

Notă: „segmentarea în calupuri" = axa fereastră, aplicată o dată per calup. Filtrarea și statisticile rulează *în interiorul* fiecărui calup; interpretarea compară calupurile între ele. În prototip există **un singur calup** (tot istoricul), deci fără comparație încă.

## 4. Contractul public al motorului

`motor-analiza.js` — funcție pură. Fără DOM, fără IndexedDB, fără globale. Citirea datelor aparține codului apelant (bootstrap-ul).

```js
const model = ruleazaAnaliza({
  inregistrari,   // array brut, în ordinea salvării
  catalog,        // date declarative: celulele tablei, fact_id → poziție
  configuratie,   // construită din bifele CP
});
```

`configuratie` în prototip:

```js
{
  domeniu:     { tip: "tabla", table_id: "mul:1-10x1-10", agregare_forme: "per_fact" },
  filtrare:    { preset: "standard_v1" },
  segmentare:  { tip: "tot_istoricul" },
  statistici:  ["precizie_prima", "mediana_timp_corect", "n"],
  interpretare:{ tip: "stare_curenta" },
  vizualizare: { tip: "grila_10x10" }
}
```

Flux intern (fiecare funcție primește doar datele și parametrii ei, returnează date):

```js
function ruleazaAnaliza({ inregistrari, catalog, configuratie }) {
  valideaza(inregistrari, catalog, configuratie);
  const normalizate = normalizeaza(inregistrari);
  const intrebari   = grupeazaApasarilePeIntrebari(normalizate);
  const inDomeniu   = selecteazaDomeniu(intrebari, catalog, configuratie.domeniu);
  const calupuri    = segmenteazaInCalupuri(inDomeniu, configuratie.segmentare);
  const curatate    = calupuri.map((c) => aplicaFiltre(c, configuratie.filtrare));
  const statistici  = curatate.map((c) => calculeazaStatistici(c, configuratie.statistici));
  const interpretate= interpreteaza(statistici, configuratie.interpretare, PRAGURI);
  return construiesteModelVizualizare(interpretate, catalog, configuratie.vizualizare);
}
```

Rezultatul unei întrebări (după grupare):

```js
{
  data_ora_ro, quiz_id, subquiz_id, fact_id, fact, eq_form, intrebare,
  primul_raspuns,               // valoarea primei apăsări
  corect_din_prima,             // boolean
  timp_primul_raspuns_secunde,  // durata primei apăsări
  numar_apasari,
  corectat_in_final,            // boolean sau null
  raspunsuri_gresite: [ ... ]
}
```

## 5. Axele CP: opțiunea activă (prototip) vs. „vor urma"

Fiecare axă = definiție declarativă în `definitii-axe.js`. CP-ul se generează din ea. Opțiunile dezactivate au `dezactivata: true` + `motiv: "vor urma"`.

| Etapă | Axă | **Activ acum** | Dezactivate — „vor urma" |
| --- | --- | --- | --- |
| 0 Domeniu | Domeniu matematic | Tabla 1-10 × 1-10, **agregat per fact** | subtablă (7×…), tabla 11-20, interval custom a-b×c-d |
| 0 Domeniu | Structură eq_form/EFF | Toate formele unui fact, împreună | 1 eq_form; același rol necunoscută; tot EFF; selecție granulară |
| 1 Filtrare | Curățare date | **Filtru standard v1** | fără filtrare; IQR; MAD; praguri custom |
| 2 Segmentare | Fereastră / calup | Tot istoricul (un calup) | azi; 7z; 30z; ultimele N răspunsuri; N sesiuni (blocat: fără `session_id`) |
| 3 Statistici | Agregare | Precizie prima + mediană timp corect + n | percentile; medie tăiată; procente pe intervale |
| 4 Interpretare | Rezultat | **Stare curentă** (clasificare) | progres/direcție; comparație calupuri |
| 5 Vizualizare | Reprezentare | **Grila 10×10 stare** | folii separabile; grafic linie; matrice fact×eq_form; listă facts problematice |

**Filtru standard v1** (definiție explicită, în `config-praguri.js`):
- doar `a_cata_apasare_pe_buton === 1` (prima reacție);
- pentru viteză: doar întrebările corecte din prima;
- exclude timp `< 0.5s` (apăsare prea rapidă, probabil accidentală) și `> 15s` (pauză probabilă) din calculul vitezei;
- datele brute NU se modifică; excluderea e doar în stratul de analiză.

## 6. Clasificarea stării (provizorie, în fișier de configurare versionat)

Stare = precizie (corect-din-prima) **și** viteză (mediană timp corect-din-prima) împreună. Praguri în `config-praguri.js`, cu `praguri_version`. Valorile de mai jos sunt **provizorii**, de calibrat pe date reale — nu adevăruri fixe.

| Stare | Regulă provizorie | Traseu (pătrățele) |
| --- | --- | --- |
| `netestat` | n = 0 | 0 |
| `date_insuficiente` | 0 < n < 5 **sau** zile_distincte < 2 | 1 |
| `in_lucru` | testat destul, dar sub „consolidare" | 2 |
| `in_consolidare` | precizie ≥ 80% și mediană ≤ 4.0s | 3 |
| `fluent` | precizie ≥ 90% și mediană ≤ 2.0s | 4 |

Fiecare celulă afișează **și `n`** și numărul de zile distincte. Regula de suficiență condiționată pe zile distincte (nu doar pe n brut) previne verdictul „stabil" dintr-o singură sesiune intensă.

## 7. Validitatea statistică — ce garantăm și ce NU

Din evaluarea aprobată:
- **Progresul de zecimi de secundă este valid doar agregat** (delta per fact, apoi sumă pe subtablă/tablă), nu per fact individual pe fereastră scurtă. → în prototip afișăm doar **stare**, nu progres; progresul vine în faza cu comparație de calupuri.
- **Granularitatea `eq_form` individual nu susține statistică** (n ≈ 0–2). Rămâne doar răsfoire brută, nu celulă cu verdict.
- **Fără p-value / „semnificație" formală**; folosim etichete graduale de suficiență.
- Intervale de încredere pentru precizie: Wilson/Jeffreys (nu formula normală) — **DE DECIS DE USER** când ajungem la afișarea incertitudinii.

## 8. Fișiere

**Noi** (folderul `Vizualizare 3 - Claude/`):

| Fișier | Rol | DOM? | IndexedDB? |
| --- | --- | --- | --- |
| `vizualizare3.html` | pagina: stânga CP, dreapta viz | — | — |
| `vizualizare3.css` | stil, două coloane scrolabile independent | — | — |
| `vizualizare3-bootstrap.js` | citește IndexedDB, leagă motorul de DOM, deschide tab | da | da |
| `motor-analiza.js` | fluxul pur (secțiunea 4) | nu | nu |
| `definitii-axe.js` | axele declarative; CP se generează din ele | nu | nu |
| `config-praguri.js` | filtru standard v1 + praguri stare, versionate | nu | nu |
| `catalog-tabla-inmultirii.js` | catalogul 10×10 (fact_id → rând, coloană, etichetă) | nu | nu |
| `fixture-loguri-dummy.js` | loguri sintetice pentru teste | nu | nu |

**Modificat:** `js/app.js` — un buton în panoul **CP - General** (`buildGeneralPanel()`, meniul afișat pentru toate quizurile, lângă „Afiseaza Timpi raspuns"), care apelează `global.deschideVizualizare3Claude()` (pattern identic cu `deschideVizualizareLogs`: deschide pagina în tab nou). Plus `index.html` — includerea scripturilor noului modul.

## 9. Etapizare cu teste

Fiecare etapă se închide cu (a) un test automat pe care îl rulezi tu și (b) o verificare manuală descrisă.

### Etapa 1 — Gruparea apăsărilor → întrebări
- Cod: `grupeazaApasarilePeIntrebari()` + `normalizeaza()`.
- Test automat: `tests/vizualizare3-motor.test.js` cu fixture mic: 1 întrebare cu 2 apăsări (greșit apoi corect) → 1 întrebare, `corect_din_prima=false`, `numar_apasari=2`, `corectat_in_final=true`.
- **Tu rulezi:** `node --test tests/vizualizare3-motor.test.js` → toate verzi.

### Etapa 2 — Domeniu + statistici + clasificare stare
- Cod: `selecteazaDomeniu()`, `calculeazaStatistici()`, `interpreteaza()`.
- Test automat: fixture cu facts cunoscute → verifică precizie, mediană, stare și nr. pătrățele.
- **Tu rulezi:** același `node --test`; citești în consolă un rezumat lizibil (ex. `5*5=25: fluent, n=12, mediană 1.4s`).

### Etapa 3 — Pagina + grila 10×10
- Cod: `vizualizare3.html/css`, `construiesteModelVizualizare()`, `vizualizare3-bootstrap.js`, buton în CP.
- Test automat: model → structură grilă (100 celule, stări corecte) fără DOM real.
- **Tu verifici manual:** apeși butonul în CP → tab nou; grila arată ca în captură; celulele fără date = „Netestat".

### Etapa 4 — CP generat din `definitii-axe.js`
- Cod: `construiesteControlPanel(definitiiAxe)` — bife active + dezactivate „vor urma".
- Test automat: adaug o opțiune în array → apare o bifă nouă în CP; o elimin → dispare. Fără atingerea codului UI.
- **Tu verifici manual:** vezi cele 6 etape cu opțiunile lor; cele „vor urma" apar gri, needitabile.

### Etapa 5 — Fixture realist + validare pe date reale
- Cod: `fixture-loguri-dummy.js` extins; opțional buton „folosește fixture".
- **Tu verifici manual:** deschizi pe jurnalul real din IndexedDB; compari câteva celule cu numărătoarea din viewer-ul Tabulator existent.

## 10. NECESAR vs OPȚIONAL

**NECESAR pentru prototip:** butonul + pagina 2 coloane; motorul pur (flux secțiunea 4); gruparea pe apăsări; filtru standard v1; clasificare stare; grila 10×10; CP generat din axe cu o opțiune activă/axă; fixture + teste.

**OPȚIONAL (faze ulterioare, „vor urma"):** progres/direcție (comparație calupuri, delta agregat); ferestre temporale/volum; IQR/MAD; percentile și procente pe intervale; folii separabile/suprapozabile; grafice; matrice fact×eq_form; structuri EFF/eq_form granulare; incertitudine (Wilson); subtablă / tabla 11-20 / interval custom.

**De mutat ulterior (în afara acestui modul):** butonul „View logs in Tabulator" (azi per-quiz în `multiplication-1120-v3-train-eff-eq-forms.js`) va fi mutat într-un loc comun tuturor quizurilor. Nu se atinge acum.

## 11. Decizii rămase la user (DE DECIS)

- Praguri numerice exacte pentru stare și pentru filtru standard v1 (propuse provizoriu în secțiunile 5–6; le calibrăm pe date reale).
- Metoda de interval de încredere, când ajungem la afișarea incertitudinii.
- Denumirea axei „același rol al necunoscutei" (propus în loc de „NVC").
