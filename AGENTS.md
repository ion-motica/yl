# Resurse comune YouLearn

## `numaraTICs()`

- Sursa comună: `js/numara-tics.js`.
- Testele contractului: `tests/numara-tics.test.js`.
- API public disponibil în proiect: `numaraTICs(intrare): number`.
- Intrarea este fie un string cu o singură operație, fie obiectul explicit `{ operandStanga, operatie, operandDreapta }`.
- Quizul furnizează explicit operația; funcția nu extrage context din quiz, DOM sau variabile globale.
- Funcția simulează algoritmul scris școlar și numără TICs (Transport, Împrumut, Carry). Nu o înlocui cu o estimare de calcul mental și nu reordona operanzii.
