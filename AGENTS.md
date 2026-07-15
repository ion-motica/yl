# Resurse comune YouLearn

## Deschiderea locală în Codex browser

- Citește mai întâi `Codex docs/Deschidere Codex browser - referinta pt Codex.md`; nu relua încercările vechi deja documentate.
- Folosește direct `http://localhost:8770/index.html` și evită portul `8766`, care a rămas uneori ocupat de un server vechi.
- Verifică mai întâi URL-ul cu `Invoke-WebRequest`. Dacă răspunde cu `StatusCode 200`, nu porni încă un server.
- Dacă portul `8770` nu răspunde, obține executabilul Python din `load_workspace_dependencies`, apoi rulează persistent, din rădăcina proiectului: `python.exe -m http.server 8770 --bind 127.0.0.1`.
- Nu folosi `Start-Process` pentru serverul pornit de Codex: procesul copil se poate închide când comanda părinte se termină.
- După pornire, verifică obligatoriu `StatusCode 200`, apoi deschide în browser URL-ul cu `localhost`, nu cu `127.0.0.1`.

## `numaraTICs()`

- Sursa comună: `js/numara-tics.js`.
- Testele contractului: `tests/numara-tics.test.js`.
- API public disponibil în proiect: `numaraTICs(intrare): number`.
- Intrarea este fie un string cu o singură operație, fie obiectul explicit `{ operandStanga, operatie, operandDreapta }`.
- Quizul furnizează explicit operația; funcția nu extrage context din quiz, DOM sau variabile globale.
- Funcția simulează algoritmul scris școlar și numără TICs (Transport, Împrumut, Carry). Nu o înlocui cu o estimare de calcul mental și nu reordona operanzii.
