# Standard — titluri secțiuni CP

> Regulă pentru titlul fiecărei secțiuni din panoul CP: titlul reflectă mereu quizul cu care
> panoul e legat (exact cum apare în „Alege quiz"), nu o prescurtare inventată de-a lungul
> timpului.
>
> **Când se aplică (trigger):** la înregistrarea unui panou nou în `CpRegistry` (`js/app.js`,
> blocul `CpRegistry.register({...})`) sau la modificarea unui titlu existent. Referință din
> `AGENTS.md`.

## Regula-nucleu

1. **Panou legat de un singur quiz** (`isEnabled` verifică o metodă/proprietate definită
   într-un singur fișier din `js/quizzes/`) → `title: "CP - " + <titlul exact al quizului>`.
   Titlul exact = ce apare **literal** în „Alege quiz", nu un nume prescurtat/inventat —
   inclusiv sufixe care există doar fiindcă quizul e înregistrat printr-un fișier-wrapper (ex.
   `sq2EffVbs`: quizul real, cel care chiar cheamă `QuizRegistry.register`, se numește
   „T*/ 11-20 - v3 - train w eff si eq forms **- jurnal**" — fișierul de bază
   `multiplication-1120-v3-train-eff-eq-forms.js` doar exportă factory-ul, nu se
   autoînregistrează). Verifică mereu în fișierul care CHEAMĂ `QuizRegistry.register`, nu în
   cel care doar definește `QUIZ_TITLE`/factory-ul.

2. **Panou comun mai multor quizuri** (ex. „Subquiz", folosit azi de 4 quizuri T*/11-20: v2,
   v2-Modular, v3, v4) → titlul NU poate fi un string fix, fiindcă e înregistrat o singură
   dată la pornire, nu per quiz activ. Se înregistrează ca **funcție** (`title: () => string`),
   care citește quizul activ din `QuizRegistry.get(QuizRegistry.getActiveId())?.title` de
   fiecare dată când e citit. Motorul din `cp-shell.js` (`resolveTitle`) rezolvă automat string
   sau funcție peste tot unde titlul se afișează — nu cere cod nou acolo, doar respectarea
   contractului la înregistrare.

3. **Un quiz cu mai multe panouri CP** (ex. SQ3 + SQ5, ambele pe același quiz
   `multiplication-1120-v4-intensiv-multipli-234.js`) → fiecare primește titlul exact + un
   sufix distinctiv, ca secțiunile să rămână distinse în listă (altfel ar deveni identice).
   Sufixul e **numele subquizului** (ex. „— Fluent party"), sau, dacă id-ul scurt deja folosit
   în cod ajută la identificare rapidă, **„SQ<n> + nume"** (ex. „— SQ5 Fluent party", cum e azi;
   SQ3 nu are un nume mai descriptiv disponibil, deci a rămas doar „— SQ3"). Alege ce e mai
   clar pt. cazul concret — regula fixă e „titlu exact + sufix", nu formatul exact al sufixului.

4. **Panouri generale**, nelegate de un quiz anume (`quizSpecific` nesetat în
   `CpRegistry.register` — ex. General, Tip lift, Lift, Acolada Axa Mere, Depanare layout) →
   nume descriptiv simplu, FĂRĂ prefixul vreunui titlu de quiz.

## De ce așa

Userul a cerut explicit (26.08.2026): titlul secțiunii CP trebuie să fie recognoscibil ca „panoul
ăstuia de quiz", nu o prescurtare inventată (`„CP — Tabla adunarii 1-10"` pt. quizul „Adunari cu
coloane - Tabla adunarii 1-10” era exact problema raportată — userul vedea titlul din CP și nu-l
putea lega direct de quizul ales din meniu). Cazurile 2 și 3 au apărut fiindcă regula literală
(„titlul exact, atât") se ciocnea cu realitatea codului: un titlu static nu poate fi corect pt. 4
quizuri diferite deodată (2), iar două panouri identice pe același quiz și-ar pierde distincția
(3) — userul a ales explicit soluțiile de mai sus pt. ambele cazuri, nu sunt decizii unilaterale
ale sesiunii care a scris regula.

## Contract tehnic

- `js/app.js`, blocul `CpRegistry.register({...})` — aici se înregistrează fiecare panou;
  `title` acceptă string SAU funcție `() => string`.
- `js/cp-shell.js`, `resolveTitle(def)` — rezolvă `title` (string sau funcție) peste tot unde
  se afișează: eticheta din TOC (`tocLabel`), `aria-label` la mânerul de drag, heading-ul
  secțiunii (`h2.cp-section-heading`).
- `setPanelEnabled(id, enabled)` din `cp-shell.js` reîmprospătează heading-ul de fiecare dată
  când e apelată (nu doar la `build()` inițial) — esențial pt. titlurile dinamice (regula 2):
  fără asta, panoul „Subquiz" ar rămâne înghețat pe titlul primului quiz activ la pornire.
  `switchQuiz()` din `js/app.js` apelează `cpShell.refreshEnabledStates()` la fiecare schimbare
  de quiz, care la rândul ei apelează `setPanelEnabled` pt. toate panourile — de-acolo vine
  reîmprospătarea.

## Verificare

Vizual, în browser: deschide CP, comută între quizurile relevante din „Alege quiz", verifică
heading-ul galben al secțiunii (nu doar rândul din TOC din stânga panoului — cele două se
actualizează separat, ambele prin `setPanelEnabled`, dar sunt elemente DOM diferite). Pt. un
panou nou legat de un singur quiz, un singur switch e suficient. Pt. un panou dinamic (regula
2), verifică explicit că heading-ul se schimbă la comutarea între **cel puțin două** quizuri
diferite care îl activează — un singur switch nu prinde bug-ul „titlul rămâne înghețat".
