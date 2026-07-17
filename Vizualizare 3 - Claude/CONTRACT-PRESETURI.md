# Contract: preseturi (P din MABP)

Șablon reutilizabil pentru ORICE zonă de preseturi din YouLearn. Când definești
preseturi noi — în Vizualizare 3 sau în alt modul — aplici acest contract, nu
inventezi alt mecanism. `SPECIFICATIE.md` §12 trimite aici.

Stil cerut de user: **simplu, robust, reconfigurabil. Nu sofisticat, nu smart.**

Acesta e un document de plan: nimic de mai jos nu e implementat încă, în afara
pieselor marcate „există deja".

## Vocabular

| Termen | Înseamnă |
| --- | --- |
| zonă | o (sub)secțiune din CP cu id stabil (ex. `grila_optiuni`), cu preseturile ei |
| control participant | orice element din zonă cu atributul `data-preset="nume_stabil"` |
| preset | date pure: `{ nume, controale: { nume_control: valoare } }` — fără logică |
| sămânța | preseturile livrate cu pagina, în fișierul din repo (`presete-<modul>.js`) |
| sertarul | copia de lucru din browser (localStorage) — singura pe care o editează pagina |

## Cele 4 operații

1. **Capturare** — citește TOATE controalele `[data-preset]` din zonă, cu valorile
   lor de acum. Nu există listă scrisă de mână: un control nou (care primește
   `data-preset`) intră automat în preseturile salvate de-atunci încolo.
2. **Aplicare** — pentru fiecare cheie din preset: găsește controlul, pune valoarea,
   declanșează evenimentul nativ (`change` la bife/câmpuri, `input` la slidere,
   `click` la butoane). Pagina reacționează exact ca la mâna omului; zero logică
   dublată. Cheile necunoscute se ignoră în tăcere — un preset vechi nu strică
   pagina nouă. *(există deja: `aplicaPreset` în bootstrap)*
3. **Salvare** — capturează zona, cere numele, scrie în sertar. Numele e cheia,
   unic **în interiorul zonei** (același nume în altă zonă e permis, nu se ceartă).
   Dacă numele există deja în zonă, popup simplu:

   > Numele este deja dat pentru un preset din această secțiune.
   > Apasă **OK** dacă vrei să îl înlocuiești.
   > Apasă **Cancel** dacă vrei să modifici numele noului preset, ca să păstrezi
   > și presetul vechi.

   OK = înlocuiește; Cancel = înapoi la câmpul de nume (textul rămâne, îl corectezi).
4. **Ștergere** — scoate presetul din sertar. Uniformă: nu există preseturi
   „speciale" de neșters.

## Stocarea: sămânța și sertarul

Modelul userului, literal: „ai o copie a conținutului fișierului, ștergi din ea
porțiunea respectivă și salvezi ce a rămas". Copia = sertarul.

- **Prima deschidere** (sertar gol): sămânța se copiază în sertar.
- **De-atunci încolo**: salvare, ștergere, default — toate editează sertarul.
  Fișierul nu se mai citește ca sursă de adevăr.
- De ce nu scriem fișierul direct: o pagină web nu are voie să scrie pe disc.
  Fișierul din repo rămâne sămânța, editată de dezvoltator (sau de YL, mai încolo).
- Consecință asumată la nivelul 1: un preset adăugat ulterior în fișier NU apare
  la cine are deja sertar. Remediul e la nivelul 2.

Cheia sertarului: `<modul>_presete_<zona>` (ex. `viz3_presete_grila_optiuni`).

```json
{
  "schema_version": 1,
  "default": "vertical simplu",
  "presete": [
    { "nume": "vertical simplu", "controale": { "aranjament_vertical": true, "folii_auto": 0 } }
  ]
}
```

## UI-ul zonei

```
Opțiuni pt Grila X × Y stare
Default preset: [vertical simplu]  [al meu 2]   ← click = aplică + selectează
        lângă cel selectat: [Delete] [Make default]
[Salvează setări curente ca Preset]             ← la apăsare: câmp nume + [OK]
```

- Click pe un preset îl **aplică și îl selectează**.
- `[Delete]` și `[Make default]` apar **doar lângă presetul selectat**.
- Default-ul zonei (unul singur) e marcat cu textul **„Default preset:"** scris
  în stânga lui — nu cu simbol. La încărcarea paginii default-ul se **aplică
  automat**, peste valorile din definiții. Fără default → pagina pornește pe
  definiții, ca acum.
- Delete pe default → zona rămâne fără default.

## Ce NU face un preset

- nu conține logică și nu apelează funcții — doar date;
- nu atinge controale din afara zonei lui;
- nu salvează stări derivate — doar valorile controalelor;
- un preset nou sau un control nou NU cere cod nou.

## Nivelurile de sofisticare

**ALES de user (17.07.2026): nivelul 2 — Portabil.** Nivelurile rămân descrise
toate, ca alt modul să poată alege altfel.

### Nivelul 1 — Simplu

Tot ce e descris mai sus și nimic în plus.

- sertar per zonă, sămânță copiată la prima deschidere;
- salvare cu suprascriere, ștergere uniformă, default auto-aplicat;
- limite asumate: fără export/import de preseturi; sămânța nouă nu se propagă
  în sertarele deja existente.

### Nivelul 2 — Portabil

Nivelul 1, plus:

- export/import preseturi ca fișier JSON în Downloads (același mecanism ca la
  jurnal — cod deja scris pentru import/export, se refolosește);
- „Reîmprospătează din fișier": numele din sămânță care lipsesc din sertar se
  adaugă; ca ștersele să nu reînvie, sertarul ține și o listă de nume șterse;
- redenumire preset.

### Nivelul 3 — Gestionar

Nivelul 2, plus:

- migrare `schema_version` (sertare vechi convertite la citire);
- preseturi parțiale: setează doar unele chei, restul rămân neatinse;
- ordonare și duplicare în listă;
- preseturi peste mai multe zone (un preset al întregii pagini).

## Pași la implementare (orientativ, nivelul 2)

Există deja în Vizualizare 3: numele stabile `data-preset` pe toate controalele
etapei 5; `aplicaPreset`; subsecția `grila_optiuni` cu butoanele ei; tiparul de
sertar (import jurnal, domeniu, sursă — aceeași formă de cod); mecanismul de
export/import fișier JSON (la jurnal — se refolosește pentru preseturi).

De adăugat: capturarea (o funcție), sertarul preseturilor (citire/scriere/copiere
sămânță + lista numelor șterse), rândul UI (câmp nume, popup nume duplicat,
Delete, Make default, eticheta „Default preset:"), aplicarea default-ului la
pornire, export/import preseturi, „reîmprospătează din fișier", redenumire.
Fără nicio modificare în motor. Estimat: 1-2 sesiuni de lucru; se poate livra
întâi miezul (nivelul 1), apoi portabilitatea, fără nimic de refăcut.

## Decizii luate (17.07.2026, cu userul)

- stocare: sertar browser; fișierul repo e doar sămânța;
- default: auto-aplicat la deschiderea paginii, unul per zonă; marcat cu textul
  „Default preset:" în stânga lui, nu cu simbol;
- ștergere: uniformă, pe copia de lucru — orice preset se poate șterge;
- nume dublu la salvare (în aceeași zonă): popup cu OK = înlocuiește /
  Cancel = înapoi la câmpul de nume; între zone diferite numele pot coincide;
- nivelul de sofisticare: **2 — Portabil**.
