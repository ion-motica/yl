# Deschidere Codex browser - referinta pt Codex

Aplicatia Youlearn este statica si se deschide local in Codex browser prin `index.html`.

## Solutia stabila gasita

- Evita portul `8766` daca apare `Forbidden`.
- In firele anterioare, `8766` a ramas uneori ocupat de un server vechi care raspundea gresit.
- Foloseste portul curat `8770` cand este disponibil.
- Deschide cu `localhost`, nu cu `127.0.0.1`, daca browserul intern blocheaza varianta IPv4.

## URL pentru quizul v3 curent

```text
http://localhost:8770/index.html?quiz=multiplication-1120-v3-train-eff-eq-forms
```

Quiz vizibil asteptat:

```text
T*/ 11-20 - v3 - train w eff si eq forms
Subquiz 1: baza
```

## Verificare rapida inainte de browser

Din radacina proiectului:

```powershell
Invoke-WebRequest -Uri "http://localhost:8770/index.html?quiz=multiplication-1120-v3-train-eff-eq-forms" -UseBasicParsing -TimeoutSec 3
```

Rezultatul bun este `StatusCode 200`, iar continutul trebuie sa includa `multiplication-1120-v3-train-eff-eq-forms`.

## Daca `8770` nu raspunde

Porneste un server static nou din radacina proiectului pe un port liber, apoi verifica intai din PowerShell ca `index.html` raspunde cu `200`. Dupa aceea navigheaza Codex browser la URL-ul cu `localhost:<port>/index.html?quiz=<quiz-id>`.

## Pentru viitoare chaturi

Cand userul cere "deschide in Codex browser", citeste acest fisier si foloseste direct reteta de mai sus inainte de a incerca portul vechi `8766`.
