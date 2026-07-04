# Șablon spec quiz (q1 / q2 / q form)

Completează când ceri un **quiz nou** sau o **modificare** la un quiz existent.
Descrie regulile **procedural** (dacă X, atunci Y). Nu e nevoie de cod aici.

**Scope:** quiz-uri de acum înainte. Quiz simplu = un singur q2 implicit (sari secțiunea q1 despre ordinea q2).

---

## Legendă

| Termen | Înseamnă |
|--------|----------|
| **Fact** | Ce calculezi: ex. `11×3`, `33÷11` — combinația concretă de numere |
| **q form** | *Cum arată* întrebarea pe ecran (ecuație, ascii, poziții) |
| **q1** | Quiz mare — container cu nivel, progres global, tranziții între q2 |
| **q2** | Subquiz / fază / mod — ex. `anchor`, `intensiv` — reguli proprii în cadrul q1 |

**Facts (model comun):** `a op b = c` sau `c op a = b` — `a`, `b` sunt numerele mai mici; `c` este suma / descăzutul / produsul / deîmpărțitul (= numărul mai mare).

---

## Antet

```
Nume quiz:
Operație (+ − × ÷):
Mai multe subquiz-uri (q2)? da / nu

Facts — relația a, b, c:
  (ex. la înmulțire: a×b=c, c÷a=b; a=11..20, b=2..15, c=a×b)
```

---

## q1 — Quiz mare

```
Lista q2 (nume scurt):
  -
  -

Intrare q1:
  (de unde pornește: nivel, mod, condiții)

Ieșire q1:
  (când e quiz-ul terminat)

Nivel / progres global:
  (ex. L=1..10, A=10+L — dacă există)

Persistență:
  (la reload: reset total / continuă nivel / continuă progres / salvează doar: ___)
  (de obicei aici; la q2 doar dacă un subquiz diferă de restul)

Ordine / pattern între q2:
  (fixă / aleator / condiționată — ex. intensiv după anchor)

Intrare / ieșire per q2 (sau detaliat în blocul q2 de mai jos):
  q2 «nume» — intrare:
  q2 «nume» — ieșire:
```

---

## q2 — Per subquiz

Repetă blocul pentru fiecare q2. Quiz simplu = un singur bloc.

```
── q2: «nume» ──

Tipuri de întrebări (ce facts / ce operații în acest q2):

q form — întrebare:
  (forme QF permise: ex. f1_initial, comutat, complementar…)
  (ascii / text / ilustrație în întrebare)

q form — variante răspuns:
  (3 butoane numerice / text / alt layout)

Valori a, b, c (domenii în acest q2):
  a:
  b:
  c:

Mesaje user pe parcursul q2:
  (hint, timeout, banner nivel, mesaje tranziție…)

Reguli alegere întrebări:
  (random, coadă, repetă greșeli, plafon factor, ordine ancore…)

Răspunsuri greșite (capcane):
  (ex. aceeași ultimă cifră, ±10, fallback ±1…)

Feedback UI:
  (panou info, highlight rapid la ≤Xs, divuri active/inactive, mesaje live)

Ilustrații:
  (ce imagine / element; în ce div)
```

---

## Exemplu minimal — quiz simplu

```
Nume: Tabel adunare nivel 3
Operație: +
Mai multe q2? nu

── q2: principal ──
Facts: 3+b=c, b=1..10
q form întrebare: 3+?=c
q form răspuns: 3 butoane numerice
Reguli alegere: random din nivel, fără repetare imediată
Capcane: ±1, ±2
Persistență (q1): reset la reload
```

---

## Exemplu pointer — T*/ 11-20 v2

Implementare: `js/quizzes/multiplication-1120-v2.js`

```
q2: anchor — test ancore, 21 corecte, QF din profil, capcane ultimă cifră
q2: intensiv — 10 întrebări, 2 facts alternate, după anchor
Persistență: reset la reload (Etapa 1)
```

Detaliile procedurale se completează în blocurile q1/q2 de mai sus.
