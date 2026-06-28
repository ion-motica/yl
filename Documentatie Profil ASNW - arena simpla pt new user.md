# Documentație Profil ASNW — arena simplă pt new user

## Context

Profil destinat utilizatorilor noi (inclusiv copii cl. 1–8 și adulți fără instrucțiuni), testat pe telefon. Probleme observate fără ghidare:

- Nu știau ce să apese pe ecran.
- Au apăsat, dar nu înțelegeau ce se întâmplă (ex. liftul care se ridică).
- Prea multe mesaje pe ecran; titlu complicat.
- Etichetele dev vizibile (`div ilustrare din arena`, etc.) derută.
- Nu înțelegeau de ce se ridică liftul și ce reprezintă textele din zonă.

**Scop:** un mod „arena simplă” care reduce zgomotul vizual și textual și face obiectivul jocului evident, fără a schimba logica quiz-urilor existente.

---

## Nume profil

**Profil ASNW — arena simplă pt new user**

(ASNW = *Arena Simplă New User* — denumire de lucru.)

---

## Activare

- **Unde:** CP → **Depanare layout**
- **Control:** o bifă master **Profil ASNW — arena simplă pt new user**
- **Default:** `true` (bifat la prima deschidere / pentru useri noi)

Când bifa master este **`true`**, se aplică automat setările de mai jos (și se sincronizează sub-bifele CP corespunzătoare). Când este **`false`**, arena revine la comportamentul actual (mod dezvoltator / utilizator avansat).

**Meniu, CP, pauză:** rămân vizibile și funcționale — nu se ascund în profil ASNW.

---

## Arhitectură CP — sub-bife și obiecte de configurare

Pentru **fiecare opțiune** din profil se creează o **sub-bifă** în CP (Depanare layout).

Valorile sub-bifelor se introduc într-un **obiect de configurare** (ex. `AsnwProfileConfig` / câmpuri în `LayoutConfig`) și se **pasează ca argument** funcțiilor / modulelor care le consumă:

| Sub-bifă | Consumator (exemplu) |
|----------|----------------------|
| Ilustrare din arena — gol | `AamArena`, `onRender` |
| Titlu quiz — simplificat | `app.js` → `dom.quizTitleEl` |
| Titluri div-uri — ascunse | CSS class pe `#game` / `app.js` |
| Nume nivel — ascuns | `renderProgress()` / `app.js` |
| Progres pătrățele v/r — ascuns | `renderProgress()` |
| Mesaj hint — ascuns | `falling-engine.js` → `#message` |
| Listă operații — fără conținut | `falling-engine.js` → `renderRound` |
| Lift clonă static — afișat | `FallingEngine` / DOM nou |
| Stelute 3× — progres simplu | modul nou + `FallingEngine` |
| Lift ASNW — fără urcare / teleport sus | `FallingEngine` |

**Quiz de pornire default:** dropdown separat în CP (`js/startup-quiz.js`) — **nu** face parte din ASNW.

**Bifa master** setează toate sub-bifele la valorile ASNW. Debifarea master-ului lasă sub-bifele **editabile individual** (util pentru debug / combinații parțiale).

---

## Setări impuse când Profil ASNW = true

### 1. `#div-ilustrare-din-arena` — gol

- Zona de ilustrare din arena (`#div-ilustrare-din-arena` / `.arena-ilustrare-body`) **nu afișează nimic** (gol).
- Fără SVG AAM, fără ecuații, fără conținut auxiliar în această zonă.

### 2. Titlu quiz — doar nume simplificat

- Pe ecranul de joc, titlul quizului afișează **doar varianta simplificată**, nu ID-ul tehnic.
- Pentru quiz-ul `addition-table-range`:
  - **În meniu / registru:** `Tabla adunarii - 1..n + 1..n`
  - **Pe arena (profil ASNW):** **`Adunari`**

### 3. Titluri div-uri — ascunse

- Etichetele de zonă (`.arena-zone-label`) sunt **ascunse**:
  - `div ilustrare din arena`
  - `div lista operatii`
  - `div ilustrare in lift`
  - orice alt label dev similar vizibil pe arena

### 4. Nume nivel — ascuns

- `#level-info` (ex. „Nivel 1 · 1+1..10”) **nu se afișează** pe arena în profil ASNW.

### 5. Progres vizual (pătrățele verzi și roșii) — ascuns

- `#div-strat-info` → `.progress-visual` (streak verde + combo roșu) **ascuns** pe arena.

### 6. Mesaj hint — ascuns

- `#message` (ex. „Alege suma corectă”) **dispare** / nu se afișează în profil ASNW.

### 7. Skin fundal white-based

- **TBD** (*to be done* — idee pentru viitor, nu face parte din prima implementare).
- Direcție posibilă: fundal deschis / white-based pentru lizibilitate pe telefon.

### 8. Quiz de pornire default (CP separat, nu ASNW)

- **Unde:** CP → Depanare layout → dropdown **Quiz de pornire default**
- **Modul:** `js/startup-quiz.js`, cheie `startupQuizId` în `LayoutConfig`
- **Default:** `addition-table-range` (Tabla adunarii - 1..n + 1..n)
- **Independent de profilul ASNW** — schimbarea quiz-ului din meniu nu modifică ASNW
- La schimbare în dropdown → comută imediat quiz-ul activ (dacă motorul e pornit)

### 9. `#div-lista-operatii` — fără conținut

- `#succession-list` / lista operațiilor **nu se completează** — rămâne goală indiferent de progresul rundei.

### 10. Lift clonă static — ecran duplicat sincronizat

- Se afișează un **duplicat exact** al liftului (`#falling`), numit **„lift clonă static”**.
- **Poziție:** deasupra rândului de butoane — **marginea de jos** a clonei este **tangentă** cu **marginea de sus** a butoanelor; plasat spre partea inferioară a ecranului (aproape de butoane).
- **Fundal:** **transparent** (se vede arena prin el).
- **Comportament:** ca un **ecran duplicat** — **dimensiuni, animații și conținut identice** cu liftul dinamic, **sincronizate** în timp real.

### 11. Comportament lift în ASNW — fără urcare, teleport sus

În profil ASNW, animațiile care derutau userii noi se elimină:

| Comportament standard | Comportament ASNW |
|----------------------|-------------------|
| La tap: răspunsul **urcă** spre lift | **Nu se mai urcă** — răspuns procesat direct |
| După corect: lift **bounce** / kick în sus | **Teleport** — următoarea rundă **începe direct de sus**, fără bounce |
| Revenire sus după greșeală | **Teleport** sus, fără animație de întoarcere |

### 12. Rând cu 3 stelute (lift dinamic + lift clonă static)

- **Unde:** deasupra operației / numărului — atât în **liftul dinamic**, cât și în **lift clonă static** (sincronizat).
- **UI:** un rând cu **3 stelute-contur** (outline, neaprinse inițial).

**Reguli:**

| Eveniment | Efect pe stelute |
|-----------|------------------|
| Răspuns **corect** | Se aprinde următoarea stelută (1 → 2 → 3). |
| Răspuns **incorect** | Se stinge **ultima stelută aprinsă**. |
| **3 răspunsuri corecte consecutive** | Declanșează evenimentul **`sub-goal`** (vezi mai jos). |

- Acest mecanism **înlocuiește vizual** pătrățelele verzi/roșii ascunse.

---

## Eveniment `sub-goal`

**Denumire:** `sub-goal` — atingerea sub-obiectivului vizual (3 stelute aprinse consecutiv).

**La declanșare (ambele):**

1. **Banner** temporar: **`Bravo! Nivelul urmator!`** (la implementare inițială).
2. **Avansare nivel** în quiz-ul activ (logica existentă de level advance).

**Viitor:** bannerul va fi înlocuit cu o **animație** (nu foarte rapidă), ca userul să vadă ușor că a cumulat ceva.

**Progres stelute:** **independent** de pătrățelele verzi/roșii din quiz — nu trebuie să se încurce între ele.

**După `sub-goal`:** stelutele se **resetează** (0/3) pentru următorul sub-goal.

---

## Rezumat vizual — ce rămâne pe ecran (profil ASNW)

```
┌─────────────────────────────┐
│  Adunari                    │  ← titlu simplificat; fără nivel, fără #message
├─────────────────────────────┤
│                             │
│     [ lift dinamic — cade ] │
│        ☆ ☆ ☆                │
│        3 + 5 = ?            │
│                             │
│  (ilustrare arena: GOL)     │
│  (listă operații: GOL)      │
│  (fără pătrățele v/r)       │
├─────────────────────────────┤
│  [ lift clonă — duplicat ]  │  ← sincronizat 1:1 cu liftul dinamic
│        ☆ ☆ ☆                │
│        3 + 5 = ?            │
├─────────────────────────────┤
│   [ 8 ]  [ 7 ]  [ 9 ]       │
│  (meniu ≡, CP, pauză — rămân)
└─────────────────────────────┘
```

---

## Mapare CP — sub-bife

| Sub-bifă CP (Depanare layout) | Când ASNW = true |
|-------------------------------|------------------|
| Profil ASNW — arena simplă pt new user | **ON** (master) |
| Ilustrare din arena — gol | ON |
| Titlu quiz — simplificat (`Adunari`) | ON |
| Titluri div-uri — ascunse | ON |
| Nume nivel — ascuns | ON |
| Mesaj hint — ascuns | ON |
| Progres pătrățele v/r — ascuns | ON |
| Listă operații — fără conținut | ON |
| Lift clonă static — ecran duplicat | ON |
| Stelute 3× + eveniment `sub-goal` | ON |
| Lift — fără urcare, teleport sus | ON |
| Quiz de pornire default (dropdown) | separat ASNW — `js/startup-quiz.js` |
| Skin white-based | TBD (idee) |

---

## Referințe cod existente (implementare viitoare)

| Element | Locație actuală |
|---------|-----------------|
| CP Depanare layout | `js/app.js` — `buildDebugPanel()` |
| Titlu quiz | `#quiz-title`, `dom.quizTitleEl` |
| Mesaj hint | `#message`, `dom.messageEl`, `falling-engine.js` |
| Nivel | `#level-info`, `dom.levelInfoEl` |
| Progres v/r | `.progress-visual`, `renderProgress()` |
| Listă operații | `#succession-list`, `falling-engine.js` → `renderRound` |
| Lift dinamic + animații | `#falling`, `FallingEngine` (`animateRising`, `bounce`) |
| Quiz 1..n+1..n | `js/quizzes/addition-table-range.js`, id `addition-table-range` |
| Quiz de pornire | `js/startup-quiz.js`, dropdown în CP Depanare |
| Etichete div | `.arena-zone-label` în `index.html` |
| Persistență opțiuni | `js/layout-config.js` → `LayoutConfig` |

---

## Ordine implementare (câte o modificare, test, confirmare)

| Pas | Modificare | Status |
|-----|------------|--------|
| 1 | Infrastructură ASNW + CP (master/sub/canonical sync) + ascundere etichete div | **Implementat — reparat wiring** |
| 2 | Ascundere `#level-info` | **Implementat** |
| 3 | Ascundere `#message` (hint) | **Implementat** |
| 4 | Ascundere `.progress-visual` (pătrățele v/r) | **Implementat** |
| 5 | Titlu quiz simplificat „Adunari” | **Implementat** |
| 6 | Ilustrare din arena — gol | **Implementat** |
| 7 | Listă operații — fără conținut | **Implementat** |
| 8 | Quiz de pornire default (dropdown CP) | **Implementat** (separat de ASNW) |
| 9 | Lift — fără urcare, teleport sus | **Implementat** |
| 10 | Stelute 3× + sub-goal + banner „Bravo! Nivelul urmator!” | **Implementat** |
| 11 | Lift clonă static sincronizat (transparent, tangent la butoane) | Pending |
| 12 | Animație sub-goal (înlocuiește banner) | Pending |
| 13 | Skin white-based | TBD |

---

## Status

**Pas 1 implementat** — așteaptă test utilizator înainte de pasul 2.
