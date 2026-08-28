# Vocabular — definiții pt. comunicare între user și AI

Acest document există pentru că același cuvânt ("turn") era folosit în cod cu **trei
înțelesuri diferite**, iar userul folosea "turn" pentru un al patrulea. Discuția a durat
mult până s-a lămurit — de-acolo regula de mai jos.

**Regulă**: când o discuție despre organizarea codului duce la un cuvânt nou/redefinit
pentru un concept, el se trece AICI, cu definiția exactă și cu ce înlocuiește în cod.
Înainte de orice discuție viitoare despre denumiri, verifică acest document.

## Cele patru concepte (decise 28.08.2026)

Toate patru descriu momente diferite din fluxul unei întrebări. Pentru copil, mai multe
dintre ele arată IDENTIC pe ecran (aceeași imagine: întrebarea, cu răspunsul completat) —
diferența e doar în contabilitatea internă a codului, nu vizuală.

| # | concept | cuvânt convenit | ce înlocuiește în cod |
|---|---|---|---|
| 1 | apăsarea unui buton de răspuns | `turn_apasare` | `apasare` (contractul Motor3Butoane) |
| 2 | întrebarea, cu toate apăsările ei, până la răspunsul corect | `repetare_intrebare_pana_la_raspuns_corect` | `tur` (contractul Motor3Butoane) |
| 3 | seria de întrebări (se termină, apoi vine alta) | `serie_de_intrebari` | `turn` (Singapore), `run` (motor) |
| 4 | repetiția programată a unui fapt (spațiere/recapitulare) | `repetitie_programata_fact` | `turn` (quizurile de înmulțire v2/v4) |

**De reținut**: conceptele 3 și 4 foloseau ȘI ELE cuvântul "turn" în cod, cu sensuri total
diferite de conceptul 1. De-aia userul (care avea în minte conceptul 1) și AI-ul (care
citise codul de la Singapore/înmulțiri, adică 3/4) nu se înțelegeau — nu era o
inconsecvență a userului, era ambiguitate deja existentă în cod.

## Identificatori derivați (concept 1 + 2)

Aceștia sunt nume de câmpuri/funcții din contractul `js/motor-3-butoane.js`, construite
pe baza conceptelor de mai sus — nu sunt concepte noi, sunt aplicarea lor.

| azi | devine |
|---|---|
| `dupaApasare` | `dupa_turn_apasare` |
| `inainteDeApasare` | `inainte_de_turn_apasare` |
| `numarApasare` | `numar_turn_apasare` |
| `estePrimaApasare` | `este_primul_turn_apasare` |
| `turCorect` | `corect_din_primul_turn_apasare` |

## Identificatori derivați (concept 3 — `serie_de_intrebari`)

Din `js/falling-engine.js` + cele două quizuri Singapore. `runComplete`/`runDelayMs` erau
folosite de ~29, respectiv ~15 fișiere (motorul + aproape orice quiz care termină o serie).

| azi | devine |
|---|---|
| `startTurn` | `incepe_serie_de_intrebari` |
| `hadMistakeThisTurn` | `a_gresit_in_serie` |
| `buildTurnCompleteStep` | `construieste_pasul_de_serie_terminata` |
| `runComplete` | `serie_terminata` |
| `finishRun` | `terminaSerie` |
| `runDelayMs` | `pauza_intre_serii_ms` |
| `RUN_DONE_MS` | `PAUZA_INTRE_SERII_IMPLICITA_MS` |

**Redenumit și string-ul literal** (valoarea câmpului `outcome`, în 31 de fișiere `.js`,
71 apariții): `"run-complete"` → `"serie-terminata"`. Inițial lăsat neatins (nu era pe lista
aprobată — e o reprezentare soră, nu identic cu identificatorul `runComplete`), apoi userul a
cerut explicit și redenumirea lui.

**Excepție deliberată**: `documente de referinta/RAPORT-motor-comun-raspuns.md`, secțiunea care
citează „textul original al observației" din 20.08.2026, păstrează `outcome:"run-complete"` —
e reconstituire istorică a codului din acel moment, nu cod curent. Redenumirea acolo ar
falsifica istoricul.

## Identificatori derivați (concept 4 — `repetitie_programata_fact`)

Din quizurile de înmulțire `multiplication-1120-v2.js`, `-v2-modular.js`,
`-v4-intensiv-multipli-234.js`.

| azi | devine |
|---|---|
| `dueTurn` | `repetitie_programata_scadenta` |
| `turnsByKey` | `repetitii_programate_dupa_fapt` |
| `turnsTarget` | `tinta_repetitii_programate` |
| `effectiveTurnCount` | `numar_repetitii_programate_efective` |
| `turnCount` | `numar_repetitii_programate` |
| `turnsRow` | `rand_repetitii_programate` |

## Câmp de jurnal (date persistate — atenție specială)

| azi | propunere | stare |
|---|---|---|
| `a_cata_apasare_pe_buton` | `al_catelea_turn_apasare_pe_buton` | **confirmat** (28.08.2026) — e scris în loguri deja salvate (fișiere JSON, IndexedDB), nu doar în cod |

Acest câmp e diferit de restul: nu e doar un nume de variabilă, e o CHEIE în date deja
existente (jurnalul salvat al userului, jurnalul viu din IndexedDB al oricărui alt user).
Redenumirea în cod nu redenumește automat ce e deja scris pe disc/în browser — vezi
`documente de referinta/RAPORT-motor-comun-raspuns.md` pentru discuția completă despre
ce se întâmplă cu datele vechi la redenumire.

## Excepție unică, autorizată explicit (28.08.2026): câmpul de jurnal în modulul vechi

`Vizualizare si interpretare logs/` rămâne, ca regulă de proiect, „nu se modifică" —
neschimbată în `CLAUDE.md`/`AGENTS.md`. Userul a autorizat explicit **doar pentru acest
caz** o excepție punctuală: câmpul de jurnal (singurul identificator din tot vocabularul
nou care exista și acolo) a fost redenumit și în acest modul, ca datele să rămână
citibile consecvent peste tot:

```
a_cata_apasare_pe_buton  →  al_catelea_turn_apasare_pe_buton
```

Atins: `mabp-analiza.js`, `README.md`, `Specificatie_MABP_analiza_vizualizare_YouLearn_v0.1.md`
**și** `.docx`-ul geamăn (editat cu skill-ul `docx`, validat XSD + python-docx), cele două
fixturi JSON (`youlearn_loguri_dummy_v1.json` — 209 apariții, `youlearn_rezultate_asteptate_dummy_v1.json`),
plus testele `tests/mabp-analiza.test.js` și `tests/mabp-vizualizare.test.js`.

Niciun alt identificator din vocabular (`turn_apasare`, `serie_de_intrebari`,
`repetitie_programata_fact`, `"run-complete"`→`"serie-terminata"`) nu exista în acest
modul — verificat explicit, nu presupus. Excepția nu schimbă regula pentru viitor: orice
altă modificare a acestui modul rămâne interzisă fără altă autorizare punctuală.
