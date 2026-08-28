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

`data_ora_ro, quiz_name, subquiz_name, intrebare, raspuns, raspuns_corect, al_catelea_turn_apasare_pe_buton, durata_raspuns_secunde, fact, quiz_id, subquiz_id, fact_id, eq_form, extra` (+ `indexeddb_key` adăugat de cititor).

**Ce rămâne `null` / indisponibil (onest, nu inventăm):**

| Lipsă | Efect | Consecință în prototip |
| --- | --- | --- |
| `session_id` | Nu putem segmenta pe sesiuni sigur | Axa „ultimele N sesiuni" rămâne dezactivată („vor urma") |
| `question_instance_id` | — | **Nu e necesar**: gruparea pe întrebări se face din `al_catelea_turn_apasare_pe_buton` (valoarea `1` începe o întrebare nouă), citind în ordinea salvării |
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
- doar `al_catelea_turn_apasare_pe_buton === 1` (prima reacție);
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
## 12. Preseturi (P din MABP)

**Orice zonă nouă de preseturi respectă `CONTRACT-PRESETURI.md`** — șablonul
reutilizabil: zone cu controale `data-preset`, capturare automată (fără liste
scrise de mână), sămânță în fișier + copie de lucru în sertar, salvare cu nume
(popup la duplicat), Delete, Make default auto-aplicat. Nu se inventează alt
mecanism per modul. Nivel ales de user: **2 — Portabil** (17.07.2026).

## 13. Interpretare v1 — scorul de apropiere de fluență (tabel pe calupuri)

Detaliază opțiunile „progres/direcție; comparație calupuri" (axa 4) și un tabel nou în
axa 5. Decizii înghețate cu userul la 18.07.2026, după analiza pe jurnalul real
(652 apăsări, 12–17.07.2026). Praguri calibrate pe UN adult — provizorii; corecturile
din cercetarea aprofundată (18.07.2026) sunt integrate mai jos, profilurile de copii
rămân de validat pe date reale.

### Scopul scorului (fixat de user)

1. „Unde ești acum" — poziția pe drumul praf → fluent.
2. „Nu pedalezi în gol" — progres măsurat obiectiv, fără să mintă.
3. „Cât mai e de lucru" — din poziție + ritmul observat pe serii de calupuri, NU
   dintr-o promisiune de liniaritate: ultimii metri SUNT în pantă (legea exercițiului:
   4s→3s vine în zeci de repetiții, 2,5s→2,0s în sute).

### Funcția (pură, în motor)

`calculeazaScorFluenta(intrebariFerestrei, praguri)` → `{ scor 0..100, eticheta }`,
apelată o dată per (fereastră de facts × calup). Tabelul = funcția pe calupuri
consecutive; graficele viitoare = aceleași valori. (În discuții: „scorFluenta".)

### Formula per fact

```text
scor_fact = rampa_corectitudine × rampa_viteza    // înmulțire: ambele condiții simultan
```

- **rampa_corectitudine** — pe precizia corect-din-prima (filtru standard v1):
  ≤ 45% → 0 · ≥ 90% → 1 · liniar între. Pragul de ghicit e **45%, nu 1/3** (adoptat
  18.07.2026, din cercetare): cine elimină o variantă implauzibilă ghicește efectiv
  la ~50%, deci 33% ar da credit pentru eliminare-și-ghicit. Pragul se calibrează
  împreună cu calitatea distractorilor din quiz (distractori plauzibili → prag mai
  aproape de 33%).
- **rampa_viteza** — pe mediana timpului corect-din-prima:
  ≤ 2,0s → 1 (răspuns din memorie; pragul „fluent" existent) · ≥ 7,0s → 0
  (calculează/„bâjbâie") · liniar între. Zero-ul la 7s e susținut de histograma pe
  jurnalul real: p90 = 8s; coada medianelor „bâjbâite" începe la ~6s; între 6/7/8
  diferă doar ~7 facts. Independent de filtrul 15/20s: filtrul curăță datele („a
  plecat de la masă"), rampa notează viteza — un corect de 11s contează la
  corectitudine, viteza lui e 0.
- **netestat → 0** („praf").
- **Plancher de impulsivitate** (adoptat 18.07.2026): răspunsurile sub **0,35s** se
  aruncă complet — și din precizie, nu doar din viteză (fizic imposibil să citești
  3 variante; e apăsare oarbă). Zona corectă 0,35–0,8s = „suspectă de noroc" — doar
  documentată în v1, netratată (la adult aproape inexistentă; la copii va conta).

Exemplu: fact cu 80% corecte, mediană 4,0s → (0,80−0,45)/(0,90−0,45) ≈ 0,78;
(7−4)/(7−2) = 0,60; scor = 0,78 × 0,60 ≈ **47%** din drum.

### Scorul celulei

Media scor_fact pe **toate** facts din fereastră, cu netestat = 0. E milestone-ul pe
drumul „toate facts fluente": și acoperirea de teritoriu nou, și accelerarea celui
cunoscut urcă scorul. În celulă: **un singur număr** („% din drum") + eticheta de
încredere.

### Fotografii (coloanele) — v2, decisă 20.07.2026

**Istoric:** v1 (felii cronologice de N răspunsuri, numărate per fereastră) a fost
implementată, testată pe jurnalul real și **înlocuită în aceeași zi**: o felie
subțire peste o fereastră mare măsura acoperirea, nu fluența (rândul „Toată
fereastra" avea plafon artificial 12,5% la calup 25 pe 200 facts), iar coloanele nu
erau aliniate în timp între rânduri. Designul v2 (propus de user, validat pe date
reale prin simulare) le rezolvă pe amândouă.

**Celula = o FOTOGRAFIE a stării ferestrei la un moment dat**, prin eșantionare
stratificată per fact:

- de la fiecare fact din fereastră se iau **ultimele lui A răspunsuri valide** de
  până la momentul fotografiei (A = „adâncimea", bifă: **2 / 5 / 10 / 20 răspunsuri
  per fact**, implicit **5**); fără redistribuire între facts (decis: complexitate
  fără câștig real — surplusul unui fact nu stabilizează alt fact);
- fact **niciodată testat** până la acel moment → 0 („praf"); fact testat cândva dar
  nu recent → contribuie cu ultimele lui A răspunsuri, oricât de vechi (fostele
  „trepte 1/2" s-au dizolvat: o singură regulă, fără cazuri speciale);
- scorul celulei = media scorurilor per fact pe TOATE facts din fereastră; **scorul
  brut se calculează întotdeauna** — eticheta de încredere decide doar AFIȘAREA
  („—" sub prag), nu calculul (altfel rândul-medie n-ar avea din ce se calcula);
- n-ul celulei = suma contribuțiilor per fact (max A × nr facts); etichetele de
  încredere rămân pe n + zile distincte, neschimbate.

**Momentele foto sunt COMUNE tuturor rândurilor** (cadență decisă 20.07.2026):
ancorate în prezent, la fiecare `A × facts_per_subtablă` răspunsuri valide ale
întregii ferestre, numărate înapoi de la ultimul răspuns. Consecințe:

- **antetele coloanelor sunt DATE reale** (data momentului foto; ultima = „acum");
- rândul „Toată fereastra" = **media coloanei** — și coincide matematic cu calculul
  direct per-fact la aceeași adâncime (subtable egale ca număr de facts);
- pozele consecutive se suprapun: un fact neexersat între ele arată la fel —
  segmente plate = „aici nu s-a lucrat", onest;
- adâncimea per fact face totul independent de dimensiunea ferestrei (10×10 regula,
  11-20×1-20 excepția userului, custom a-b×c-d) — nimic de recalculat.

**Scăderi oneste (principiu de ton):** quizul retestează des facts-urile slabe, deci
cele tari poartă dovezi vechi; când un fact tare-dar-ruginit e retestat, scorul
poate SCĂDEA. Nu e regres — e rugină descoperită. UI-ul nu o prezintă drept eșec.

**Ultima coloană ≠ grila** (documentat): fotografia = ultimele A per fact; grila =
toată istoria per fact. Bifa viitoare „ultimele N răspunsuri" din axa 2 a grilei
le-ar realinia.

Alternativ („vor urma"): momente foto pe sesiuni/zile calendaristice — bifă
separată. Alternative statistice cunoscute și amânate deliberat: EWMA (parametru
opac), shrinkage bayesian (schimbă rampele), Elo/IRT per fact (overkill), modele de
uitare FSRS (dacă „rugina" devine problemă reală).

### Etichete de încredere per celulă (texte fixate de user)

| n valide | etichetă | afișare |
| --- | --- | --- |
| sub 15 | Date insuficiente — nu calculăm | fără număr |
| 15–49 | Date puține — încredere mică în coeficient | scor gri/mic |
| 50+ **și ≥2 zile distincte** | Date suficiente — încredere mare în coeficient | scor normal |

„Încredere mare" cere și **≥2 zile distincte** în calup (adoptat 18.07.2026): viteza
copiilor variază puternic de la o zi la alta (test-retest r≈0,2 — „forma zilei"),
deci 100 de răspunsuri dintr-o singură după-amiază entuziastă nu-s dovadă stabilă;
fără zile ≥2, eticheta se plafonează la „Date puține". Regula din spate: scorul
poate minți cu ±1/(2√n) → 25→±10 puncte, 50→±7, 100→±5, 200→±3,5. Decis
20.07.2026: **NU se plafonează și pe acoperire** — eticheta rămâne doar pe n + zile;
acoperirea mică se vede oricum în scor (netestatele intră cu 0) și în detaliile
celulei (facts testate X/Y, la hover).

### Citirea diferențelor (anti-amăgire)

- Diferența dintre 2 celule tremură ~×1,4 față de o celulă: la calup 100, semnal abia
  de la ~7 puncte; sub prag → „zgomot sau informație, nu știm la granulația asta".
- Pași mici dar toți în aceeași direcție pe 3–4 calupuri consecutive = semnal, chiar
  dacă fiecare pas e sub prag.
- **Anti cherry-picking:** granulația se alege DOAR după n („sita se alege după
  mărimea pietrișului, nu după unde a sclipit ceva"), niciodată după scoruri.

### Analiza de fezabilitate a granulației (recomandator; propus de user)

Rulată automat la fiecare randare a tabelului: rulează modelul tabelului pentru
fiecare adâncime candidat (2/5/10/20), numără etichetele de încredere pe celulele
subtablelor din toate pozele (rândul „Toată fereastra" exclus — medie derivată) și
recomandă adâncimea cu cel mai mare PROCENT de celule „încredere mare"; la
egalitate câștigă adâncimea mai mică; fără recomandare când nicio celulă nu e
bazată. Se uită NUMAI la etichete (n + zile), nu la scoruri — corectă prin
construcție. Afișare: bifa recomandată se auto-selectează (o dată, respectă
alegerea manuală ulterioară a userului până la următoarea deschidere/schimbare de
domeniu sau sursă) + marcaj „(Recomandat)" lângă eticheta ei; tabel de comparație
complet sub tabelul de evoluție, cu toate cele 4 adâncimi. Decis 21.07.2026
(implementat: `PLAN-recomandator-fezabilitate.md`). Recomandarea urmează
domeniul activ din axa Domeniu — orice interval de înmulțire (11-20, o
subtablă, custom a-b × c-d) merge automat, fără cod dedicat; prioritatea
absolută a userului rămâne tabla 1-10 (× sau, în viitor, +) — 11-20 a fost doar
experimentul care a produs jurnalul real. Tabla adunării cere catalog nou +
extinderea mapării fact→celulă (`cheieCelulaDinInregistrare`, azi doar
înmulțire) = etapă separată. Granulația calendaristică (zi/3 zile/săptămână) și
pasul independent de adâncime = etape următoare, nefăcute.

### Vizualizarea (opțiune nouă în axa 5)

Rânduri = subtablele domeniului activ + „Toată fereastra"; coloane = calupuri
(vechi → noi); celulă = scor + etichetă. Ultima coloană ≈ starea curentă.

Decis 20.07.2026: bifele tabelului = **adâncimea fotografiei** (2/5/10/20 răspunsuri
per fact, implicit 5), în **subsecțiunea proprie a tabelului** („5.2 Opțiuni pt
Tabel % fluență") — NU în axa 2; axa 2 rămâne a grilei. Sub bife, o **linie
dinamică de fezabilitate**: „subtable de F facts · poză = A×F răspunsuri · date
valide: B → N poze". Antetele coloanelor = data momentului foto (ultima = „acum").
Plan de implementare: `PLAN-tabel-fotografii.md` (înlocuiește `PLAN-tabel-fluenta.md`,
rămas ca istoric al v1).

### session_id

Câmp nou în jurnal (partea de quiz) pentru înregistrările viitoare; fallback pentru
cele vechi: sesiune = ziua calendaristică. DE DECIS: regula de generare a id-ului
(la încărcarea paginii? după pauză de X minute?).

### Schiță praguri noi pentru `config-praguri.js` (se implementează odată cu funcția)

```js
interpretare_v1: {
  corectitudine: { prag_ghicit: 0.45, prag_plin: 0.9 },
  viteza: { secunde_plin: 2.0, secunde_zero: 7.0 },
  // corect_suspect: doar documentat în v1, netratat.
  impulsivitate: { plancher_secunde: 0.35, corect_suspect_sub_secunde: 0.8 },
  incredere: { n_minim_calcul: 15, n_incredere_mare: 50, zile_distincte_incredere_mare: 2 },
  // Adâncimile fotografiei (2/5/10/20 per fact) NU stau aici: sunt opțiuni de
  // axă și trăiesc declarativ în definitii-axe.js, ca orice altă axă. Blocul
  // `calup` din config (mort, necitit de cod) se șterge la implementarea v2.
}
```

### Profiluri de vârstă (vor urma — la primul copil-utilizator)

Puncte de plecare din cercetare (extrapolate, de validat pe date reale):

| profil | plin (credit maxim) | zero | plancher impulsivitate |
| --- | --- | --- | --- |
| adult (actual) | 2,0s | 7s | 0,35s |
| 10-12 ani | ~2,0s | ~6s | 0,30s |
| 7-9 ani | ~2,5s | ~8s | 0,35s |

Config: un obiect de praguri per profil + bifă de selecție.

### Dificultatea factului (v2, vor urma)

Problem-size effect (cel mai robust fenomen din aritmetica cognitivă): un prag
uniform e nedrept cu 7×8 față de 12×2. Soluția potrivită arhitecturii: grupe de
dificultate declarate în catalog (ușor/mediu/greu per fact); pragurile de viteză
se deplasează cu ~+1-1,5s la cele grele. Nuanță din cercetare: multe erori vin din
interferența între vecini (18×7 vs 17×7), nu doar din mărimea operanzilor.

### Decizie documentată: tablele 11-20

Literatura n-are norme de fluență pentru 11-20; școala le tratează procedural
(14×6 = 10×6 + 4×6). Aplicația își propune explicit contrariul — memorarea directă —
iar datele userului arată că se poate (25 facts sub 2s în 5 zile). Pragurile rămân
deci ambițioase CA DECIZIE ASUMATĂ: măsoară un obiectiv pe care școala nici nu-l
încearcă; scorurile vor arăta „aspre" față de așteptările școlare — nu e eroare de
măsurare, e ținta.

**Principiu de ton** (din experiența userului, care și-a administrat singur dușul
rece al lui 11-20 după fluența pe 1-10): scorul și etichetele **măsoară drumul, nu
judecă persoana**. Nimic din UI nu are voie să comunice „ești prost" — un copil
nemotivat primește de aici încurajare măsurabilă („uite, se adună"), nu verdict.

### Calibrare empirică viitoare: valea bimodală

Distribuția timpilor = două cocoașe (memoria, ~sub 1,5s; calculul, 3-10s) cu o vale
între ele. Valea, măsurată pe datele fiecărei grupe de vârstă/dificultate, e pragul
de retrieval empiric — mai bun decât orice cifră din literatură. Scriptul de
histogramă existent o poate căuta când se strâng destule date.

### Notate, în afara acestui modul

- **Quiz:** recomandare de acoperire — cât mai multe facts distincte din tabla vizată,
  pe lângă seturile intensive de remediere → tot mai puține „netestate", analiză tot
  mai exactă.
- **Quiz (din cercetare, 18.07.2026):** distractori plauzibili (calibrează pragul
  ghicitului); ocazional itemi cu scris liber pentru facts candidate la „fluent"
  (recunoașterea la 3 variante e mai ușoară decât producția — un „fluent" la variante
  poate să nu fie fluent cu adevărat); sesiuni scurte ~4-5 min (oboseala crește spre
  coada sesiunii); presiunea de viteză abia de la ≥80% corecte („accuracy before
  speed" — regulă de antrenament, nu de măsurare; scorul rămâne înmulțire, fără
  praguri-treaptă).
- **session_id** capătă un rol în plus: pe viitor permite filtrarea „cozii obosite"
  a sesiunilor lungi.
- **Viitor:** mod „probă de testare" (facts aleatorii, fără repetare-consolidare)
  pentru măsura CQPM (corecte/minut — standardul literaturii; pe quizurile adaptive
  actuale ar fi distorsionată de repetarea intensivă a greșelilor).

### Rămase deschise

Regula de generare `session_id` · validarea profilurilor de vârstă pe date reale
de copii (punctele de plecare sunt în subsecțiunea „Profiluri de vârstă").
