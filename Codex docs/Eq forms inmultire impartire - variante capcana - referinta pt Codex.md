# Eq forms inmultire impartire - variante capcana - referinta pt Codex

Referinta pentru quizuri care folosesc equation forms cu inmultire si impartire (`*` / `:`), mai ales cand forma poate cere fie produsul, fie un factor lipsa.

## Regula generala

Pentru o familie de fact multiplicativ:

```text
A * b = product
```

genereaza variantele-capcana in functie de raspunsul lipsa:

1. Daca raspunsul corect este produsul intreg (`correct === product`), capcanele trebuie sa fie produse apropiate cu aceeasi ultima cifra.
2. Daca raspunsul corect este un factor lipsa (`correct !== product`), capcanele trebuie sa fie factori apropiati numeric.

## Caz 1: lipseste produsul

Exemplu:

```text
17*6=?
```

Corect:

```text
102
```

Capcane recomandate:

```text
102 - 10 = 92
102 + 10 = 112
```

Variante:

```text
92, 102, 112
```

Extindere daca trebuie mai multe capcane:

```text
correct ± 10
correct ± 20
correct ± 30
```

Motiv: elevul ramane in zona produselor posibile si este fortat sa verifice calculul, nu doar ordinul de marime.

## Caz 2: lipseste factorul

Exemplu:

```text
17*?=102
```

Corect:

```text
6
```

Capcane recomandate:

```text
6 - 1 = 5
6 + 1 = 7
```

Variante:

```text
5, 6, 7
```

Extindere daca trebuie mai multe capcane:

```text
correct ± 1
correct ± 2
correct ± 3
```

Motiv: daca forma cere factorul, capcanele de tip produs (`92`, `112`) sunt nepotrivite; elevul trebuie sa aleaga factorul din vecini plauzibili.

## Pseudocod

```js
function buildMulDivEqFormTrapOptions(correct, product, shuffle) {
  const wrong = [];

  function addWrong(value) {
    if (value < 0 || value === correct || wrong.includes(value)) return;
    wrong.push(value);
  }

  if (correct === product) {
    [10, 20, 30].forEach((delta) => {
      addWrong(correct - delta);
      addWrong(correct + delta);
    });
  } else {
    [1, 2, 3].forEach((delta) => {
      addWrong(correct - delta);
      addWrong(correct + delta);
    });
  }

  while (wrong.length < 2) addWrong(correct + wrong.length + 1);

  const options = shuffle([String(correct), String(wrong[0]), String(wrong[1])]);
  return { options, correctIndex: options.indexOf(String(correct)) };
}
```

## Protectie utila

Pentru quizurile `T*/ 11-20`, evita intrebari unde raspunsul corect este chiar factorul nivelului (`A`), de exemplu raspuns `17` la levelul 17x. Aceste intrebari pot deveni prea banale sau pot repeta excesiv acelasi raspuns.

Regula folosita in Subquiz 7 din quizul refactorizat:

```js
if (!Number.isFinite(correct) || correct === factorForLevel(level)) return null;
```

## Sursa initiala

Regula a fost preluata din Subquiz 7 (`domainProducts`) al quizului:

```text
T*/ 11-20 v2 - Clonat - Modular
```

Fisiere relevante:

```text
js/quizzes/multiplication-1120-v2-modular.js
tests/multiplication-1120-v2-modular.test.js
```

Teste care descriu intentia:

```text
direct modular subquiz 7 uses close traps when the missing factor is found by division
direct modular subquiz 7 uses same-last-digit traps when the missing product is found by multiplication
```

## Cum se foloseste in quizuri viitoare

Cand un quiz nou foloseste `QFGenerator` / equation forms pentru inmultire-impartire:

1. Calculeaza `product = A * b`.
2. Citeste raspunsul corect produs de forma de ecuatie.
3. Daca `correct === product`, foloseste capcane de produs: `±10`, `±20`, `±30`.
4. Daca `correct !== product`, foloseste capcane de factor: `±1`, `±2`, `±3`.
5. Amesteca raspunsul corect cu doua capcane.
6. Adauga teste pentru ambele cazuri.
