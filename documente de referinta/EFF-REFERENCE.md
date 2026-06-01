# EFF — Extended Fact Family: Referință Completă

> Acesta este fișierul central de referință pentru sistemul EFF.
> Orice quiz care folosește EFF trebuie să respecte regulile de aici.

---

## 1. Ce este EFF?

Un **F0 fact** este un rând dintr-o tabelă de matematică: `3+2=5`, `6×7=42`, `15÷3=5` etc.

Un **qf** (question form) este o **formă de întrebare** derivată dintr-un F0 fact prin aplicarea unor transformări structurate (F1, F2, F3). Scopul este să consolideze un fact din toate unghiurile posibile.

**Exemplu**: din faptul F0 `3+2=5` se pot genera 120 de forme de întrebări diferite.

---

## 2. Taxonomia: F0 → F1 → F2 → F3

```
F0 (faptul de bază)
 └─ F1 (4 forme ale familiei)
     └─ F2 (2 orientări)
         └─ F3 (15 tipuri de întrebare)
                = 4 × 2 × 15 = 120 forme per F0
```

Dacă orice nivel are toate switchurile false → 0 combinații (ierarhie strictă: F1 false ⊃ F2 și F3 irelevante).

---

## 3. F1 — Familia faptului (4 forme)

| Cheie | Definiție | Exemplu pt. `3+2=5` | Exemplu pt. `3×2=6` |
|---|---|---|---|
| `f1_initial` | Faptul ca atare | `3+2=5` | `3×2=6` |
| `f1_comutat` | Rocadă: interschimba a și b | `2+3=5` | `2×3=6` |
| `f1_complementar` | Operația inversă: `+-` sau `×÷` | `5-2=3` | `6÷2=3` |
| `f1_complementar_comutat` | Complementar + rocadă | `5-3=2` | `6÷3=2` |

**Regulă**: F1 transformă F0 = (a, op, b, result) astfel:

| F1 | Nou (a, op, b, result) |
|---|---|
| initial | (a, op, b, result) |
| comutat | (b, op, a, result) |
| complementar | (result, op_invers, b, a) |
| complementar_comutat | (result, op_invers, a, b) |

Unde `op_invers` este: `+↔-`, `×↔÷`.

**Atenție**: F1_complementar schimbă operația! `3+2=5` → `5-2=3` (o scădere).
Aceasta este **intenționată** — un quiz T+ EFF va conține și întrebări de scădere când `f1_complementar` e activ.

---

## 4. F2 — Orientarea ecuației (2 forme)

Se aplică la fiecare fact F1:

| Cheie | Formă | Exemplu pt. F1 `3+2=5` |
|---|---|---|
| `doua_nr_in_STANGA` | `a op b = result` | `3+2=5` |
| `doua_nr_in_DREAPTA` | `result = a op b` | `5=3+2` |

---

## 5. F3 — Tipul de întrebare (15 forme per F2 fact)

### Faza 1: O singură necunoscută (5 tipuri, 40 EFF-uri totale per F0)

Activată întotdeauna. Interacțiune: user alege din 3 variante, 1 corectă.

**`trei_pozitii_pt_cate_un_numar`** (3 forme):

| Poziție | Exemplu STÂNGA | Exemplu DREAPTA |
|---|---|---|
| Primul număr (a) | `?+2=5` | `?=3+2` (dar ? → a=3) |
| Al doilea număr (b) | `3+?=5` | `5=3+?` |
| Rezultatul | `3+2=?` | `5=3+?` (? → result) |

> Corect: valoarea numerică (a, b, sau result) a factului F1.
> Distractori: numere apropiate din pool-ul nivelului, `optMax = max(12, corect + 2)`.

**`doua_pozitii_pt_cate_un_semn_operator_matematic`** (2 forme):

| Poziție | Exemplu STÂNGA | Exemplu DREAPTA | Opțiuni |
|---|---|---|---|
| Operatorul aritmetic | `3?2=5` | `5=3?2` | `{+, -, ×, ÷}` |
| Semnul de egalitate | `3+2?5` | `5?3+2` | `{=, <, >}` |

> Corect: operatorul/semnul corect al factului F1.
> Distractori: ceilalți operatori/semne din setul de opțiuni.

### Faza 2: Două necunoscute (10 tipuri)

**Se activează când >70% din combinațiile din Faza 1 au fost parcurse** la nivelul curent.
Interacțiune: user alege dintr-o pereche de valori/operatori, 3 variante, 1 corectă.

**`o_pozitie_pt_cate_2_semne`** (1 formă):
- `3?2?5` → ambii operatori necunoscuți
- Opțiuni: perechi `(op_aritmetic, semn_relational)`, ex: `(+, =)`, `(-, =)`, `(+, <)`
- Corect: `(op_factului, =)`

**`trei_pozitii_pt_cate_2_numere`** (3 forme):
- `?+?=5` → ambele numere necunoscute → opțiuni: perechi `(a, b)` din valorile factului
- `?+2=?` → a și result necunoscute → opțiuni: perechi `(a, result)`
- `3+?=?` → b și result necunoscute → opțiuni: perechi `(b, result)`

**`sase_pozitii_pt_cate_un_semn_si_un_numar`** (6 forme):
- `??2=5` → operator și a necunoscute → opțiuni: perechi `(op, a)`
- `?+2?5` → a și semn_relational → opțiuni: perechi `(a, semn)`
- `3??=5` → operator și b → opțiuni: perechi `(op, b)`
- `3?2=?` → operator și result → opțiuni: perechi `(op, result)`
- `3+??5` → b și semn_relational → opțiuni: perechi `(b, semn)`
- `3+2??` → result și semn_relational → opțiuni: perechi `(result, semn)`

> Distractori pentru Faza 2: variații ale perechii corecte, cu un singur element modificat.

---

## 6. Contorul de combinații selectate

```
total = (F1 active) × (F2 active) × (Σ F3_grup_activ × variante_per_grup)
```

Unde variante per grup F3:
- `trei_pozitii_pt_cate_un_numar`: 3
- `doua_pozitii_pt_cate_un_semn_operator_matematic`: 2
- `o_pozitie_pt_cate_2_semne`: 1
- `trei_pozitii_pt_cate_2_numere`: 3
- `sase_pozitii_pt_cate_un_semn_si_un_numar`: 6

Maximum = 4 × 2 × (3+2+1+3+6) = 4 × 2 × 15 = **120 combinații per F0 fact**.

---

## 7. Pool de fapte per nivel și quiz

| Quiz | Nivel 1–10 | Nivel 11–20 | Ce este "nivelul" |
|---|---|---|---|
| **T+ EFF** | N+0..10 | N+0..20 | N = primul termen (addend) |
| **T− EFF** | (N+0)−N...(N+10)−N | (N+0)−N...(N+20)−N | N = scăzătorul |
| **T× EFF** | N×0..10 | N×0..20 | N = primul factor |
| **T÷ EFF** | (N×1)÷N...(N×10)÷N | (N×1)÷N...(N×20)÷N | N = împărțitorul |

> **T− detaliat**: La nivel 5, faptele sunt 5−5=0, 6−5=1, 7−5=2, ..., 15−5=10.
> **T÷ detaliat**: La nivel 5, faptele sunt 5÷5=1, 10÷5=2, 15÷5=3, ..., 50÷5=10.

---

## 8. Structura seriilor în quizul T* EFF

### Tipuri de serii

**Seria A — {same EFF, different facts}** (max 5 întrebări):
- Se fixează un tip EFF (ex: `f1_initial + STÂNGA + ?+b=c`)
- Se variază faptele din pool-ul nivelului
- Dacă posibil, se includ fapte din lista "greșite"

**Seria B — {same fact, different EFF}** (max 5 întrebări):
- Se fixează un fact (din lista "greșite")
- Se variază tipurile EFF (din pool-ul activ EFF)

### Flux de serii

```
Seria A
  ├─ Nicio greșeală → altă Serie A cu alt EFF
  └─ Cel puțin o greșeală → fact(e) greșit(e) în "greșite" → Seria B
                                                                └─ Seria A (cu greșite în pool dacă posibil)
```

### Regulă avansare nivel

- **1 serie A perfectă** (fără nicio greșeală) ȘI
- **toate faptele din "greșite" rezolvate corect de 2 ori** (nu neapărat consecutiv)

---

## 9. Persistența datelor

| Date | Cheie localStorage | Structură |
|---|---|---|
| Tentative generale (toate quizurile) | `prime-divisor-game:facts:v1` | FactStore: per fact, per zi |
| Greșite T* EFF (per quiz) | `eff-quiz:{quizId}:mistakes:v1` | `{factKey: {wrongCount, correctCount, lastDate}}` |
| Profil EFF selectat (per quiz) | `eff-quiz:{quizId}:eff-profile:v1` | Obiect cu aceleași chei ca EFF_CONFIG |

---

## 10. Fișiere relevante

| Fișier | Rol |
|---|---|
| `documente de referinta/eff-config.js` | Switchuri true/false pentru toate formele EFF (template global) |
| `documente de referinta/eff-explorer.html` | Explorer vizual interactiv pentru configurare EFF |
| `documente de referinta/EFF-REFERENCE.md` | Acest fișier — referință completă |
| `js/eff/eff-engine.js` | *(de creat)* Motor de generare a formelor EFF |
| `js/eff/eff-profile-store.js` | *(de creat)* Persistență profil EFF per quiz |
| `js/quizzes/addition-eff-helper.js` | *(de creat)* Înregistrare quiz T+ EFF |
| `js/quizzes/subtraction-eff-helper.js` | *(de creat)* Înregistrare quiz T− EFF |
| `js/quizzes/multiplication-eff-helper.js` | *(de creat)* Înregistrare quiz T× EFF |
| `js/quizzes/division-eff-helper.js` | *(de creat)* Înregistrare quiz T÷ EFF |

---

## 11. Opțiuni generate per tip F3 și F2

### F2 = STÂNGA (`a op b = result`)

| F3 tip | Poziție | Forma | Necunoscuta | Opțiuni |
|---|---|---|---|---|
| trei_pozitii_numar | 1 | `?+2=5` | a | numere |
| trei_pozitii_numar | 2 | `3+?=5` | b | numere |
| trei_pozitii_numar | 3 | `3+2=?` | result | numere |
| doua_pozitii_semn | 1 | `3?2=5` | op | `{+,-,×,÷}` |
| doua_pozitii_semn | 2 | `3+2?5` | = | `{=,<,>}` |

### F2 = DREAPTA (`result = a op b`)

| F3 tip | Poziție | Forma | Necunoscuta | Opțiuni |
|---|---|---|---|---|
| trei_pozitii_numar | 1 | `?=3+2` | result | numere |
| trei_pozitii_numar | 2 | `5=?+2` | a | numere |
| trei_pozitii_numar | 3 | `5=3+?` | b | numere |
| doua_pozitii_semn | 1 | `5=3?2` | op | `{+,-,×,÷}` |
| doua_pozitii_semn | 2 | `5?3+2` | = | `{=,<,>}` |

> **Notă**: La F2=DREAPTA, `trei_pozitii_numar` poziția 1 = rezultatul (cel mai din stânga).
> Pozițiile 2 și 3 = a și b (la dreapta egalului).

---

## 12. Generarea distractorilor

### Distractori numerici
- `optMax = Math.max(12, corect + 2)`
- Se caută valori apropiate (±1, ±2, ...) în intervalul `[1, optMax]`
- Nu se repetă valoarea corectă

### Distractori operatori aritmetici
- Setul fix: `{+, -, ×, ÷}`
- Se exclud operatorii care produc același rezultat (ex: dacă a=3, b=2, result=5, atunci `+` e corect; distractori pot fi `-`, `×`, `÷`)
- Dacă un distractor produce din întâmplare același rezultat (ex: `2+3=5` și `2?3=5` cu `?=+`), se înlocuiește

### Distractori semn relațional
- Setul fix: `{=, <, >}`
- Corect este întotdeauna `=` (ecuațiile din tabelă sunt adevărate)
- Distractori: `<` și `>`

### Distractori perechi (Faza 2)
- Se generează variații cu un singur element modificat față de perechea corectă
- Ex: corect `(3, 2)` → distractori `(4, 2)` și `(3, 1)`
