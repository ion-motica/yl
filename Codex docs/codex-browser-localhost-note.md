# Codex browser - deschidere locala Youlearn

Cand trebuie deschisa aplicatia in Codex browser:

1. Evita portul `8766` daca apare `Forbidden`; in trecut a ramas un server vechi pe acest port.
2. Foloseste portul curat `8770` cand este disponibil.
3. URL uzual:

```text
http://localhost:8770/index.html?quiz=<quiz-id>
```

Pentru quizul v3 curent:

```text
http://localhost:8770/index.html?quiz=multiplication-1120-v3-train-eff-eq-forms
```

Verificare rapida din PowerShell:

```powershell
Invoke-WebRequest -Uri "http://localhost:8770/index.html?quiz=multiplication-1120-v3-train-eff-eq-forms" -UseBasicParsing -TimeoutSec 3
```

Daca `8770` nu raspunde, porneste un server static nou din radacina proiectului pe un port liber, apoi verifica intai din PowerShell ca `index.html` raspunde cu `200`.
