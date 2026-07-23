# Continuare — proiectul MABP complet (filtrare · interpretare · vizualizare)

Document de predare pentru a continua modulul „Vizualizare 3 - Claude" într-un chat nou.
Acoperă imaginea de ansamblu; pentru ajustările vizuale ale foliilor vezi `CONTINUARE-folii.md`.

## Citește întâi

- `AGENTS.md` (rădăcină) — regulile de design ale userului. Nucleul: **quizul raportează, feature-ul
  procesează**. Cod simplu, funcții cu argumente, minimal diff, propune înainte de implementare.
- `documente de referinta/razgandire-ieftina.md` — diagnostic de cuplare/coeziune, la organizarea codului.
- `Vizualizare 3 - Claude/SPECIFICATIE.md` — specificația detaliată a acestui modul.

## Ce este MABP

**Motor de Axe cu Bife și Preseturi.** Un control panel generat din definiții declarative de axe;
combinațiile de bife formează configurația; un motor comun o duce prin: validează → normalizează →
grupează → segmentează → filtrează → calculează → interpretează → vizualizează. A adăuga o opțiune =
a o adăuga în array, fără cod nou de logică.

Context: userul a fost frustrat că un agent anterior (Codex) a construit o interfață stufoasă și a
ratat chiar sensul acronimului. Acest modul e reconstrucția, de la zero, respectând literal cerințele.

## Fluxul motorului (înghețat)

```
inregistrari brute (IndexedDB, ordinea cheii)
→ valideaza → normalizeaza
→ grupeazaApasarilePeIntrebari   (apăsări → întrebări; o apăsare = o înregistrare)
→ selecteazaDomeniu              (fact/subtablă/tablă, via catalog)
→ segmenteazaInCalupuri          (ferestrele de comparație = "calupuri")
→ aplicaFiltre                   (per calup: exclude outliers/timpi suspecți)
→ calculeazaStatistici           (per calup: precizie, mediană, n, zile distincte)
→ interpreteaza                  (clasificare stare; ulterior: progres între calupuri)
→ construiesteModelVizualizare
```

Contract public, **funcție pură** (fără DOM/IndexedDB):
`ruleazaAnaliza({ inregistrari, catalog, configuratie, praguri })`.

## Contractul datelor (jurnalul)

O înregistrare per apăsare, în IndexedDB `youlearn_jurnal_intrebari` → `intrebari`, citită **în
ordinea cheii**. 18 câmpuri (`data_ora_ro, quiz_name, subquiz_name, intrebare, raspuns,
raspuns_corect, a_cata_apasare_pe_buton, durata_raspuns_secunde, fact, quiz_id, subquiz_id, fact_id,
eq_form, extra, …`). Sursa reală: `js/jurnal-intrebari.js`.

**Ce lipsește (rămâne `null`, nu inventăm):**
- `session_id` — deci axa „N sesiuni" e dezactivată.
- `question_instance_id` — **nu e necesar**: gruparea pe întrebări se face din
  `a_cata_apasare_pe_buton` (valoarea `1` începe o întrebare nouă), citind în ordinea salvării.
- evenimente `timeout` — nu sunt logate; numărul de întrebări afișate e subestimat (limitare notată).

**Maparea fact→celulă** (decizie a userului): funcția izolată `cheieCelulaDinInregistrare` citește
câmpul canonic `fact` (ex. "7*8=56"), nu textul întrebării. Grila e POZIȚIONALĂ: 7×3 ≠ 3×7.
Notă: `fact_id` e per-eq_form; `familyKey` (canonic, comutativ) NU se salvează în jurnal.

**Domeniul de interes al userului e tabla 1-10 (10×10)** — 11-20 a fost doar
experimentul care a produs jurnalul real descărcat, nu domeniul urmărit. Jurnalul
real conține EXCLUSIV facts pe 11-20 (verificat: 0 din 652 înregistrări au primul
operand în 1-10) — pe domeniul implicit (1-10), tabelele/grila arată goale pe
date reale; verificarea mecanicii pe 1-10 se face cu
`FixtureLoguriDummyVizualizare3.construiesteFixture()` (1-20 × 1-20, determinist).
Opțiunea „Tabla 11-20 × 1-20" din axa Domeniu (`definitii-axe.js`) e deja activă
și funcțională (adăugată 17.07.2026, catalogul generalizat ca interval
`{aMin,aMax,bMin,bMax}` în `catalog-tabla-inmultirii.js`) — NU mai e „vor urma".

## Clasificarea stării (praguri PROVIZORII, în `config-praguri.js`, versionate)

Progresie: `netestat → abia_inceput → nu_il_stie → in_lucru → fluent`. Fiecare celulă arată `n` și
zile distincte.

| Stare | Regulă | Pătrățele |
| --- | --- | --- |
| netestat | n = 0 | 0 |
| abia_inceput | n < 5 sau zile < 2 | 1 |
| nu_il_stie | testat destul, sub praguri | 2 |
| in_lucru | precizie ≥ 80% și mediană ≤ 4,0s | 3 |
| fluent | precizie ≥ 90% și mediană ≤ 2,0s | 4 |

Filtru standard v1: doar prima apăsare; viteza doar pe corecte-din-prima; exclude timp `<0,5s` și
`>15s` din viteză. Datele brute NU se modifică.

## Ce e implementat vs. ce urmează

**Gata (Etapele 1-3):**
- Motorul pur: grupare, domeniu, filtre, statistici, clasificare stare. Teste: 11/11
  (`tests/vizualizare3-motor.test.js`, `tests/vizualizare3-domeniu.test.js`).
- Pagina cu 2 coloane (CP stânga, viz dreapta, scroll independent).
- CP generat din `definitii-axe.js`: 6 etape, o opțiune activă/axă, restul „vor urma".
- Grila 10×10 randată din model, ca 4 folii transparente cu tot motorul de permutări vizuale.

**Vor urma (dezactivate cu motiv în CP):**
- **Progres/direcție** — comparație de calupuri, delta agregat (delta per fact comparabil, apoi
  agregare). ASTA e ținta reală: „uite câteva zecimi de secundă de progres care se adună!". În
  prototip afișăm doar STARE, nu progres, fiindcă progresul de zecimi e valid doar agregat.
  Discuție extinsă 22.07.2026 (chat, nefinalizată în plan):
  - Calupuri **înghețate, nesuprapuse** pt. istoricul afișat (odată închis, un calup nu se
    mai recalculează retroactiv) + un calup **viu** (sliding, se termină azi) pt. „azi a
    contat", fără amânarea recompensei. Analogie: lumânări bursiere închise + lumânarea
    curentă. De decis: conținutul calupului viu — „ultimele N care se termină azi" (ce
    face deja `fereastraFactLaMoment`, gratis) vs. „tot ce s-a strâns de la ultima
    închidere" (mai curat, dar subțire în prima zi) — diferența contează puțin pentru
    numărarea de tranziții de stare (ambele variante taie facts-urile fără destule date
    prin pragurile de încredere existente), ar conta dacă am afișa vreodată delte de scor.
  - Mesajul cinstit pentru părinte NU e procent/medie (verificat cu userul: „procente nu
    înseamnă nimic pt oameni fără studii superioare") — ci **numărare de tranziții de
    stare** între două calupuri: „7 tăblițe au urcat o treaptă, 2 au ajuns fluente". Se
    calculează comparând starea per celulă (deja clasificată de motor) la cele două
    calupuri, fără niciun cod de scor nou.
  - **Săgeți de tendință în tabelul tehnic** (`Tabel % fluență`) — vezi
    **`PROPUNERE-sageti-progres.md`** (notă de decizie, 22.07.2026). Varianta
    fact-cu-fact („≥8 din 10 facts au urcat") a fost **respinsă de user**: mai slabă
    statistic decât compararea mediilor (deja implementată), n-ar aduce putere, doar un
    al doilea factor de complexitate. Dacă se fac vreodată săgeți, se pleacă de la S1
    (medii), cu netestatele rezolvate din quiz design (quizul începe cu facts-urile
    netestate în sesiunea precedentă → acoperire ~completă → media reflectă măiestria
    și dificultatea se anulează în diferență). Reziduu inerent: pe subtablă (10 facts)
    mișcările mici stau sub zgomot; progresul mic se vede acumulat sau pe rândul Total.
  - ~~Rând nou sub „Toată fereastra": nr. total de răspunsuri valide din acea coloană,
    cu textul „ai muncit atât, ai progresat de la X% la Y%".~~ RESPINS (22.07.2026):
    numărul de răspunsuri e deja vizibil în tooltip-ul celulei Total (`n=${celula.n}`,
    `vizualizare3-bootstrap.js:1928`) — un rând separat ar duplica; iar „progres de la
    X% la Y%" moștenește conflația acoperire/măiestrie de mai sus (procentul crește și
    doar din facts noi atinse, nu neapărat din facts deja purtate devenite mai bune) —
    nu e un mesaj pe care să te bazezi fără să verifici tooltip-ul dedesubt, ceea ce
    anulează scopul unui rând-rezumat.
- **Pas independent de adâncime** — acum pasul dintre poze e fixat la o „celulă
  plină" (adâncime × facts/subtablă), deci adâncimi mici dau poze care se
  suprapun aproape total. Userul a întrebat (21.07.2026) dacă un pas MAI MARE,
  ales separat, n-ar da poze mai rare dar mai distincte — relevant mai ales pt.
  Progres/direcție (de mai sus), unde tocmai diferența dintre poze vecine e ce
  se compară. Decis: etapă separată, DUPĂ recomandatorul de fezabilitate
  (`PLAN-recomandator-fezabilitate.md`), nu în runda curentă.
- **Tabla adunării 1-10 (+)** — prioritatea userului e „tabla + sau × 1-10"
  (21.07.2026). Azi motorul mapează doar înmulțirea (`cheieCelulaDinInregistrare`,
  punct unic înlocuibil, regex `[*x×]`), iar catalogul are doar operația `mul`.
  De făcut: catalog `add` + extinderea mapării + opțiune în axa Domeniu. Un log
  de adunare azi cade în „necatalogate" → tabele goale, fără crash.
- Ferestre temporale/volum (azi/7z/30z, ultimele N răspunsuri).
- IQR/MAD, percentile, procente pe intervale.
- Structuri EFF/eq_form granulare (matrice fact × eq_form).
- Incertitudine (interval Wilson) — DE DECIS metoda cu userul.

## Evaluarea statistică (agreată)

La ~1000-2500 întrebări / 100 facts / 50-80 zile: **fezabil**, cu rezerve. Cele mai importante
condiții: separă starea de progres; compară în interiorul acelorași facts; viteza împreună cu
precizia; nivel explicit de suficiență a datelor (`n`, zile); preseturi/filtre versionate; fără
p-value, doar etichete graduale de suficiență.

## Fișiere (`Vizualizare 3 - Claude/`)

| Fișier | Rol | DOM/IndexedDB? |
| --- | --- | --- |
| `motor-analiza.js` | fluxul pur | nu |
| `catalog-tabla-inmultirii.js` | catalogul 10×10 (fact_id→celulă) | nu |
| `config-praguri.js` | filtru v1 + praguri stare, versionate | nu |
| `definitii-axe.js` | axele + foliile, declarativ | nu |
| `fixture-loguri-dummy.js` | loguri sintetice pentru teste/demo | nu |
| `vizualizare3-bootstrap.js` | singurul strat cu DOM + IndexedDB | da |
| `vizualizare3.html/.css` | pagina | — |

## Integrare rămasă

- Butonul de deschidere din **CP-General** (`js/app.js`, `buildGeneralPanel()`) + includerea
  scripturilor în `index.html`. `deschideVizualizare3Claude` deschide pagina în tab nou. NEFĂCUT încă
  — pagina se accesează deocamdată direct prin URL.
- „View logs in Tabulator" (azi per-quiz) de mutat într-un loc comun — separat, mai târziu.

## Reguli de colaborare (importante pentru user)

- Propune înainte de a implementa; separă NECESAR de OPȚIONAL; nu adăuga scope în tăcere.
- Structură ușor de ajustat prin array/config — userul se răzgândește des după ce vede rezultatul.
- Nu alege metode statistice în locul userului; prezintă opțiuni cu avantaje/limite, el decide.
- Verifică real (browser + măsurători + screenshot), nu declara „merge" fără dovadă.
- Commit doar când cere userul. Vezi `CONTINUARE-folii.md` pentru capcanele de prompt la commit.
