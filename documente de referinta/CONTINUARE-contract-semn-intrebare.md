# CONTINUARE — contract pentru semnul de întrebare (`?` de revelat)

> **Stare: discuție deschisă, NIMIC de implementat până nu se iau cele 3 decizii de la
> secțiunea „Reluăm exact de aici".** Documentul transcrie contextul discuției din
> 28.08.2026, ca să poată fi continuată online, fără re-derivare.

## De unde a pornit

La quizul nou „Numaram din 2 in 2 - inainte si inapoi" (`js/quizzes/numarare-cu-pas.js`),
întrebarea e un tabel HTML cu 10 coloane, construit de quiz. La fiecare răspuns corect apărea
un **flash vizibil**: tot tabelul dispărea pentru o fracțiune de secundă, înlocuit de un text
simplu pe un singur rând, apoi revenea.

**Cauza**, găsită în cod: motorul are două bucăți separate care nu se cunoșteau între ele.

| bucată | fișier | ce face |
|---|---|---|
| A. afișarea întrebării | `js/falling-engine.js`, în `renderRound` (~l. 647) | pe prompt-text simplu, înfășoară fiecare `?` în `<span class="q-mark">?</span>` |
| B. revelarea răspunsului | `js/falling-engine.js`, `buildRevealedState` (~l. 530) | la răspuns corect, **ignora** ce era deja pe ecran și reconstruia tot `promptHtml` din `state.prompt` (textul simplu) |

Bucata A punea deja marcajul pe ecran, dar bucata B nu se uita la el. La un prompt scurt
(`"10=?+5"`) reconstrucția dădea aproape același rezultat → nu se vedea nimic. La un tabel,
reconstrucția din text simplu îl prăbușea într-o linie.

## Ce s-a implementat deja (28.08.2026)

Funcție nouă `revealAnswerInPlace(state, answer)` în `js/falling-engine.js`: caută marcajul în
DOM-ul **deja randat** și îi schimbă doar conținutul (+ clasa `.q-correct`, minus `.q-mark`),
în loc să reconstruiască promptul. Dacă nu găsește marcajul, cade pe calea veche, neschimbată.

Selectorul actual acceptă **două** clase: `.question-to-reveal, .q-mark`.

Verificat în browser pe 12 quizuri. Rezultatul e byte-identic cu al căii vechi (la „Ecuatii":
`<span class="q-correct">5</span> = 1 + 4`), dar obținut prin modificarea nodului existent.

**Commit-uri:** `15d8238` conține quizul nou + prima formă a fixului (doar
`.question-to-reveal`). Extinderea selectorului cu `.q-mark` e în commit-ul următor.

## Cele 3 variante care coexistă azi

Nu sunt grupate „quiz nou / preexistent / cele 4" — gruparea reală e:

1. **Motorul revelează in-place** (mecanismul nou) — majoritatea: Numaram din 2 in 2,
   Adunări succesive, Ecuatii cu 3 4 5 6 numere, Impartiri cu rest 1-10, cele două
   „intrebari ajutatoare", Bagare sub radical, Sub sau lângă radical v1.
2. **Motorul revelează cu re-randare completă** (calea veche, lăsată intenționat) — doar
   formatele `singapore-bond` (Tabla adunarii Singapore) și `division-eq`. Acolo revelarea
   scrie și câmpuri de stare proprii (`bondRevealedAddend`, `revealedQuotient`), citite și de
   alt cod — nu doar textul de pe ecran.
3. **Quizul se revelează singur, motorul nu intervine** — Împărțiri la numere prime, Tabla
   adunarii - Clasic, Tabla adunarii - 1..n + 1..n. Își scriu propriul `promptHtml` cu
   răspunsul înăuntru; motorul detectează (`resultAlreadyRevealed`) și se retrage.
4. **Nu se revelează niciodată** — formatul `fg-stack` (T*/ 11-20 - v4, Subquiz 3: grup de
   factori). Descoperit în discuția de continuare, lipsea din lista de mai sus.
   `stateHasQuestionMark` are un `if` explicit care întoarce `false`, deci motorul nici nu
   ajunge la calea de marcaj. `?`-ul rândului curent e caracter brut, fără niciun tag.

   **Atenție la motivul din cod:** comentariul justifică opt-out-ul cu „i-ar sparge rândurile
   într-o singură linie" — motivul acela **nu mai e valabil**, exact asta a reparat
   `revealAnswerInPlace` (modifică doar nodul slotului, nu rescrie tot `promptHtml`-ul).
   Ce rămâne valabil e decizia pedagogică din `PLAN-v4-subquiz3-grupuri-factori.md` §2.8
   („toate rândurile arată `?`", cu varianta care arată rezultatele notată ca idee de viitor
   în §9). Azi cele două — constrângere tehnică moartă și decizie de design vie — stau lipite
   în același `return false`.

## De ce quizul de azi n-a primit automat `q-mark`

Sunt două căi prin care un quiz dă întrebarea motorului:

- `prompt` (text curat, fără HTML) → **motorul** scrie HTML-ul, deci el pune și `.q-mark`;
- `promptHtml` (HTML deja scris de quiz) → motorul îl injectează exact cum l-a primit, nu-l
  mai procesează, deci nu pune nimic.

Quizul de azi folosește `promptHtml` (ca să controleze tabelul), deci marcajul trebuia pus de
quiz. A fost pus, dar cu alt nume (`question-to-reveal`) decât convenția existentă (`q-mark`).

Motivul pentru care motorul **nu** ar trebui să caute orbește caracterul `?` într-un
`promptHtml` gata scris: (a) nu poate distinge `?`-ul întrebării de un `?` apărut în marcaj
(atribut, text auxiliar); (b) un `replace` orb într-un string care e deja HTML poate nimeri
greșit și rupe structura — a existat deja azi un bug exact de acest tip (ghilimelele duble din
`font-family` au spart atributul `style`).

## Duplicare reală care justifică extragerea

Marcajul `<span class="q-mark">?</span>` e scris **literal, identic, în 3 locuri**:

- `js/falling-engine.js:647`
- `js/quizzes/bagare-sub-radical.js:41`
- `js/quizzes/sub-sau-langa-radical.js:34`

Deci nu e generalizare speculativă (AGENTS.md, regula 7: extragi comun după ≥2 cazuri reale
cu aceeași structură) — sunt 3.

## Propunerea userului + evaluarea

**Propunerea:** un contract prin care fiecare quiz specifică tag-ul din jurul `?`-ului (sau ce
semn alege el); o funcție comună, generică, refolosită de majoritatea quizurilor, ca să nu se
reinventeze; iar dacă e nevoie de altceva (cazul de azi), contractul să permită specificarea
unei funcții alternative, cu funcția de `replace` ca default.

**Corect și susținut de cod:** partea cu marcaj unic comun (duplicarea de mai sus o justifică)
și partea cu „quizul declară explicit" — respectă regula din AGENTS.md, quizul raportează,
feature-ul procesează, motorul nu ghicește din context.

**Obiecție la partea cu funcția alternativă:** cazul de azi nu cere altă *funcție*, ci același
marcaj pus în altă *poziție*. Dacă lucrul comun e o funcție mică ce întoarce **doar marcajul**
(nu una care procesează un text întreg), atunci quizul cu tabel o poate chema direct în celulă:
`` `<td>${semnDeIntrebare()}</td>` ``. Deci un singur primitiv, folosit în două feluri — nu
două funcții, și fără câmp de configurare (AGENTS.md, regula 1: fără infrastructură pentru
nevoi neconfirmate).

**Ce lipsea din propunere — variația reală există, dar în altă parte.** Verificat în CSS: azi
sunt **trei** tratamente vizuale diferite ale aceluiași lucru:

| unde | marcaj | CSS |
|---|---|---|
| majoritatea quizurilor | `.q-mark` | `style.css:2061` — galben (`var(--win)`) + bold |
| formatul `division-eq` | `.q-q` | **niciun CSS** — culoare normală |
| `singapore-bond` | `?` simplu, fără tag | nimic |

Deci semnul de întrebare arată deja diferit de la un quiz la altul, fără ca asta să fie o
decizie luată de cineva. Un contract adevărat ar trebui să rezolve și asta.

## Reluăm exact de aici — cele 3 decizii

**1. Numele marcajului.** Rămânem pe `q-mark` (există deja în 3 locuri + e interogat de
`js/asnw-onboarding.js:378` pentru mânuța de onboarding) și renunțăm la `question-to-reveal`,
sau invers? Decizia elimină selectorul compus `.question-to-reveal, .q-mark` din
`revealAnswerInPlace`.

**2. Semnul.** Funcția comună primește semnul ca parametru (`?`, `_`, pătrat gol), sau e mereu
`?` și quizul alege doar **unde** îl pune?

**3. Cele trei tratamente vizuale.** Le unificăm acum — deci se umblă și la `division-eq`
(`.q-q`) și la `singapore-bond` (`?` fără tag) — sau le lăsăm cum sunt, iar contractul acoperă
doar quizurile normale? De reținut: la aceste două formate revelarea scrie și câmpuri de stare
proprii, deci nu e doar o schimbare de clasă CSS.

**Unde se scrie contractul, după decizii:** în `AGENTS.md`, lângă secțiunea existentă
„Contractul de răspuns la quiz/subquiz" — nu doar în cod.

## Continuarea discuției — ce s-a stabilit, ce rămâne

> Discuție, **nimic implementat**. Userul nu a aprobat încă scrierea de cod.

### Forma contractului (stabilit de user)

O **singură** funcție, transmisă de quiz către motor **ca parametru** al unei funcții cerute
de motor: `functieDinArenaEngine(..., functieDefinirePlaceholder(), ...)`.

- **Obligatorie și explicită.** Fără fallback tacit „dacă quizul nu zice nimic, presupun
  generica". Quizul o declară chiar și când e fix funcția generică. Efect: un quiz nou nu
  poate să *uite* — divergența nu mai poate intra din neatenție, care e exact cum au apărut
  cele 3-4 variante de azi.
- **Acoperă toate formele de întrebare** — simplă, compusă, tabel, stack. Fără excepții,
  fără categorii speciale.
- **Locul funcției generice:** lângă celelalte utilitare comune de quiz, **nu** exportată din
  `js/falling-engine.js`.

### Definiția care face contractul să funcționeze

**Placeholder = locul unde se pune una din cele 3 valori de pe butoanele de răspuns.**
De obicei caracterul `?`, dar userul poate alege altceva.

Criteriul ăsta rezolvă cazul `fg-stack`, unde pe ecran sunt **două** `?`: rândul curent
(`14*5=?`) e placeholder — primește una din cele 3 valori; al doilea (`14*15=?`) e o
întrebare viitoare, nu placeholder.

### Cele două axe — de ținut minte, se confundă ușor

| axă | întrebare | acoperită de contract acum? |
|---|---|---|
| **A. marcajul** | unde e locul care primește una din cele 3 valori? | **da**, peste tot |
| **B. politica de revelare** | se arată acolo răspunsul, sau rămâne `?`? | nu, rămâne cum e |

Confuzia lor a produs, în discuție, o „a treia stare" inventată degeaba (`fg-stack` are
placeholder, doar că alege să nu-l reveleze — nu e absență de placeholder). Contractul
acoperă acum **doar axa A**.

### De revenit după ce se închide contractul `?`

1. **`singapore-bond` și `division-eq`** (axa B + unificarea vizuală, decizia 3 de mai sus).
   Sunt lăsate deoparte **intenționat**: la ele revelarea scrie și câmpuri de stare proprii
   (`bondRevealedAddend`, `revealedQuotient`), citite de alt cod — nu e doar schimbare de
   clasă CSS. Se reiau după.
2. **`fg-stack`** — de despărțit constrângerea tehnică moartă de decizia de design vie
   (vezi varianta 4 de mai sus).

### Rămân de decis

- **Semnătura funcției.** Fără argumente (întoarce marcajul gata făcut) sau cu? Userul a zis
  că semnul poate fi și altceva decât `?` — de lămurit dacă asta înseamnă *argument* al
  funcției generice, sau *altă funcție* declarată de quiz.
- **Numele clasei.** `q-mark` (există în 3 locuri + interogat de `js/asnw-onboarding.js:378`)
  vs. `question-to-reveal` (doar în quizul cu tabel). Decizia elimină selectorul compus
  `.question-to-reveal, .q-mark` din `revealAnswerInPlace`.
