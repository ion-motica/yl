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

## Câmp de jurnal (date persistate — atenție specială)

| azi | propunere | stare |
|---|---|---|
| `a_cata_apasare_pe_buton` | `a_catelea_turn_apasare_pe_buton` | **de confirmat explicit** — e scris în loguri deja salvate (fișiere JSON, IndexedDB), nu doar în cod |

Acest câmp e diferit de restul: nu e doar un nume de variabilă, e o CHEIE în date deja
existente (jurnalul salvat al userului, jurnalul viu din IndexedDB al oricărui alt user).
Redenumirea în cod nu redenumește automat ce e deja scris pe disc/în browser — vezi
`documente de referinta/RAPORT-motor-comun-raspuns.md` pentru discuția completă despre
ce se întâmplă cu datele vechi la redenumire.

## Ce NU se atinge

`Vizualizare si interpretare logs/` — modul vechi, marcat explicit "nu se modifică" în
`CLAUDE.md`/`AGENTS.md`. Păstrează vocabularul vechi (`apasare`, `tur`) intact, ca
referință istorică. Testele lui (`tests/mabp-analiza.test.js`,
`tests/mabp-vizualizare.test.js`) rămân neatinse din același motiv.
