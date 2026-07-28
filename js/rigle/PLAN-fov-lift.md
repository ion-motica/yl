# PLAN — FOV Lift (feedback zburător de la coloană spre întrebare)

> Pentru executant (Sonnet 5). Citește întâi `documente de referinta/RIGLE-REFERENCE.md`
> §4 (validarea NU e implementată — feature-ul ăsta e prima piesă din ea) și §9 (gotcha-uri
> de poziționare analitică — le extindem, nu le reinventăm).

## 1. Cerința (cuvintele userului)

La **fiecare** apăsare pe un buton (corect sau greșit, mutare reală sau re-apăsare pe
coloana curentă): span-urile se resetează la invizibil și animația rulează din nou de la
capăt.

Un pătrățel verde zburător pornește de la poziția „celulei N" din coloana pe care a
aterizat liftul (N = lățimea coloanei, aceeași cifră ca pe eticheta butonului), **conține
el însuși cifra N**, și zboară spre o casetă nouă („FOV Lift") lipită cu marginea ei de jos
de marginea de sus a liftului (deasupra = spre vârful ecranului, nu z-index). Caseta are
2 rânduri:
- rândul 1 (span1): „N e prea mic" / „N e prea mare" / „N e corect"
- rândul 2 (span2): „N<a+b" / „N>a+b" / „N=a+b"

Ambele span-uri sunt invizibile inițial; fiecare devine vizibil când pătrățelul ajunge la
el. La coloana **corectă**, dacă bifa „Cu animație pt. corect" e activă, pătrățelul merge
mai departe spre „?" din întrebarea liftului: la sosire „?" e înlocuit cu suma corectă,
într-un div verde care **pulsează continuu** (nu o dată), și rămâne dezvăluit **până la
fact nou**. Pătrățelul dispare la final.

Poziția de start nu depinde de bifa „Numerotează rânduri": pătrățelul își poartă singur
cifra, iar poziția e cea geometrică a celulei a N-a, chiar dacă acolo nu e randat nimic.

## 2. Premortem — cele 3 capcane reale (verificate în cod, nu presupuse)

### 2.1. Homing exponențial spre țintă în mișcare se poate BLOCA

Cu `poz += (țintă − poz) × k` pe cadru și o țintă care coboară cu `v`, pătrățelul rămâne
permanent în urmă cu o distanță constantă (regim staționar):

```
eroare_staționară = v / λ          (λ = rata de homing, în 1/s)
```

Cu `vitezaCoborare = 34` px/s (din `CONFIG_ETAPA1`) și λ=8: eroare = 34/8 = **4,25 px**.
Dacă pragul de sosire e 4px, pătrățelul **nu ajunge niciodată** — planează la 4,25px și
secvența rămâne agățată acolo, fără eroare în consolă.

**Mitigare (obligatorie):** λ=10 (eroare staționară 3,4px) + prag de sosire **8px** +
**limită dură de durată per etapă** (1,5s → snap la țintă și treci mai departe). Limita
dură e plasa de siguranță: garantează că secvența se termină ORICUM, indiferent ce se
întâmplă cu geometria.

### 2.2. `.rigle-scene` are `overflow: hidden`, iar caseta stă DEASUPRA liftului

După fiecare fact nou liftul e la `y=0` (sus de tot). Dacă copilul apasă un buton chiar
atunci, caseta ar fi poziționată la `top` negativ și **tăiată complet** — feedback invizibil
exact în cel mai probabil moment de apăsare.

**Mitigare:** `top = Math.max(0, liftTop − inaltimeCaseta)`. Când liftul e prea sus, caseta
rămâne lipită de marginea de sus a scenei și se suprapune parțial peste lift — vizibil, nu
tăiat. (Dacă userul preferă „sub lift" în acel caz, e o schimbare de 2 linii — nu decid eu
acum, semnalez.)

### 2.3. Ținta NU se măsoară per cadru (lecția de la Pasul 0)

Tentația e `getBoundingClientRect()` pe span în fiecare cadru, cât zboară. Asta ar
reintroduce exact citirea de layout per cadru care producea sacadarea (măsurat: 18,87 ms
→ 0,49 ms după eliminare, commit `bde59b9`).

**Mitigare:** măsoară **o singură dată**, la pornirea cursei, decalajul span-urilor față de
colțul liftului. În fiecare cadru, ținta = poziția **analitică** a liftului (`colX[colIndex]`,
`y`, `liftH`) + decalajul memorat. Zero citiri DOM în buclă.

## 3. De ce merge țintirea, deși liftul se mișcă în două feluri

- **Orizontal:** liftul glisează 0,35s spre coloana nouă (`.rigle-lift--ready { transition:
  left 0.35s ease }`). Zborul e mai lung decât atât, deci se țintește direct poziția
  **finală** — `colX[colIndex]`, cunoscută instantaneu la apăsare. Glisarea eased nu trebuie
  urmărită deloc.
- **Vertical:** `y` avansează liniar (34 px/s). Recalcularea țintei în fiecare cadru
  urmărește căderea automat — inclusiv la pauză (`y` se oprește → ținta se oprește, fără cod
  special).

Marja de viteză e uriașă: lift 34 px/s vs. zbor efectiv de ordinul sutelor px/s. Nu există
risc de „nu prinde ținta"; nu e nevoie de ajustare dinamică de viteză.

## 4. Alternative respinse

- **Tranziții CSS + `setTimeout` înlănțuit** (varianta din prima versiune a planului) —
  respinsă: o tranziție pornită spre un punct fix nu se poate re-ținti, iar ținta se mișcă
  (mai ales orizontal, 100-200px). Ar rata vizibil.
- **Predicție într-un singur pas (intercept închis)** — respinsă: mai fragilă decât
  re-țintirea per cadru (nu tratează pauza/factul nou/resize fără cod suplimentar), fără
  câștig vizual.
- **Funcție generică „zboară la țintă"** — respinsă acum: un singur loc de folosire, o
  singură cursă. Abstracție prematură (AGENTS.md regula 7). Se scrie procedural.
- **Web Animations API** — respinsă pt. minim diff: motorul folosește deja `tick()` + rAF;
  nu introducem o unealtă nouă pt. un feature.

## 5. Criterii de succes (falsificabile — se verifică, nu se privesc)

1. **Nu se blochează:** după orice apăsare, secvența ajunge la capăt (pătrățelul dispare)
   în maxim ~2,5s. Verificat prin citirea repetată a `display`/`opacity` pătrățelului după
   3s — trebuie ascuns.
2. **Span-uri succesive, nu simultane:** span2 devine vizibil strict după span1 (nu în
   același cadru).
3. **Start analitic corect:** `xStart` calculat == `colX[colIndex] + (N − 0.5) * cell`, fără
   citire DOM. Verificat prin comparație cu valoarea teoretică.
4. **Pulsație continuă la corect:** elementul care înlocuiește „?" are
   `getComputedStyle(...).animationName !== "none"` și `animationIterationCount === "infinite"`.
5. **Persistență:** re-apăsarea butonului corect după dezvăluire nu face „?" să reapară în
   niciun cadru intermediar.
6. **Fără elemente agățate:** 3 apăsări diferite în <300ms nu lasă pătrățele pe ecran și nu
   produc erori (`read_console_messages`).
7. **Bifa oprește complet:** debifarea „Pe lift" → nimic zburător, nicio casetă, fără
   remount.
8. **Fără regresie de performanță:** cadru median rămâne ~16,7ms în timpul animației
   (măsurat cu fereastra VIZIBILĂ — altfel `requestAnimationFrame` e throttled și
   măsurătoarea e falsă; vezi memoria „verifică instrumentul înainte de măsurătoare").

## 6. Config nou

### 6.1. CP (`js/quizzes/rigle-cl1.js`)

Chei noi (pattern identic cu `GRID_VERTICAL_KEY` etc.):

```js
const FOV_BUTON_KEY = "rigleFovButon";
const FOV_LIFT_KEY = "rigleFovLift";
const FOV_LIFT_CORECT_KEY = "rigleFovLiftAnimatieCorect";
const getFovButon = () => global.LayoutConfig?.get(FOV_BUTON_KEY, true) !== false;
const getFovLift = () => global.LayoutConfig?.get(FOV_LIFT_KEY, true) !== false;
const getFovLiftCorect = () => global.LayoutConfig?.get(FOV_LIFT_CORECT_KEY, true) !== false;
```

În `mountArena`, adăugat la `cfg`: `fovButon`, `fovLift`, `fovLiftAnimatieCorect`.

În `appendRigleControlPanel`, după blocul „Lift": titlu
`"Etichete (FOV Feedback Oranj Verde)"` + 3 `addRow` (checkbox), fiecare scrie în
`LayoutConfig` și cheamă `mounted?.setFov({ buton })` / `{ lift }` / `{ animatieCorect }`.

### 6.2. Engine — API public nou

`setFov(opts)` — pattern identic cu `setGridLines`: mută flagurile în `cfg`, fără remount.
Dacă `lift` devine `false`, oprește orice cursă în desfășurare și ascunde caseta+pătrățelul.
Adăugată la `return { ... setFov }`.

### 6.3. Constante noi (lângă `LIFT_INSET`, `ETICHETA_GAP`)

```js
const FOV_LAMBDA = 10;        // rata de homing (1/s) — eroare staționară = 34/10 = 3,4px
const FOV_PRAG_SOSIRE = 8;    // px; > eroarea staționară, altfel nu ajunge niciodată (§2.1)
const FOV_DURATA_MAX_ETAPA = 1.5; // s; plasă de siguranță — snap + treci mai departe
```

## 7. DOM/CSS nou (creat o dată la mount, ca `lift`/`qEl`)

- **`.rigle-lift-necunoscuta`** — span dedicat pentru „?". `randeazaFact()` se schimbă: în
  loc de `qEl.textContent = cfg.intrebare`, se pune partea „a+b=" ca text + acest span cu
  „?". Necesar ca să-i putem citi poziția și schimba conținutul fără să atingem restul
  întrebării.
- **`.rigle-lift-raspuns`** — clasa adăugată pe acel span la dezvăluire: fundal verde,
  `animation: rigle-blink 0.6s ease-in-out infinite` (**continuu** — cerință explicită,
  spre deosebire de `.rigle-btn-mismatch--corect` care e static).
- **`.rigle-fov-lift`** — caseta cu span1+span2. `position:absolute`, copil al `scene`,
  `z-index` peste lift, `pointer-events:none`. Ascunsă implicit.
- **`.rigle-fov-lift-linie`** — cele 2 rânduri; `opacity:0` + `transition: opacity .15s`,
  clasă `--vizibil` → `opacity:1`.
- **`.rigle-fov-zburator`** — pătrățelul verde: `position:absolute`, copil al `scene`,
  `pointer-events:none`, cifra N centrată. **Fără `transition`** — poziția se scrie direct
  din buclă, în fiecare cadru.

## 8. Implementare (ordine procedurală)

1. **`randeazaFact()`** — randează întrebarea cu span-ul `.rigle-lift-necunoscuta` (§7). La
   fiecare fact nou: oprește cursa FOV în desfășurare, ascunde caseta + pătrățelul, scoate
   `.rigle-lift-raspuns` (fact nou = stare complet nouă, idempotență).

2. **`calculeazaTextFov(colIndex)`** → `{ tip, linie1, linie2, corect }`. Pur, zero DOM.
   `linie1` are exact forma din `actualizeazaEtichetaButon`; dacă extragerea în funcție
   comună nu complică fluxul, extrage — altfel duplică cele 3 șiruri (regula 9a: nu sparge
   artificial dacă face fluxul mai greu de urmărit).

3. **`porneșteFovLift()`** — apelată din `selectColumn()`, ultima linie, doar dacă
   `cfg.fovLift`. Face DOAR pregătirea (fără să anime):
   - `fovRulareId++` (token; o cursă veche nu mai scrie nimic după ce a pornit alta).
   - Scrie textele în span1/span2, le scoate `--vizibil`.
   - Poziționează caseta: măsoară-i lățimea/înălțimea **acum** (după ce are text), apoi
     `top = Math.max(0, liftTop − h)` (§2.2), `left` centrat pe lift, limitat în scenă.
   - **Măsoară o singură dată** decalajele span1/span2/„?" față de colțul liftului și le
     memorează (§2.3).
   - Pune pătrățelul la `xStart`/`yStart` analitic (§9), text = N, îl face vizibil.
   - Setează starea cursei: `etapa = 0`, `timpEtapa = 0`.

4. **Avansarea cursei — în `tick()`**, după `actualizeazaNumerotareAnimata()`, doar dacă e
   o cursă activă și nu e pauză:
   ```
   țintă = poziția analitică a liftului + decalajul memorat al etapei curente
   factor = 1 − Math.exp(−FOV_LAMBDA * dt)     // frame-rate independent
   poz += (țintă − poz) * factor
   timpEtapa += dt
   dacă distanța < FOV_PRAG_SOSIRE  SAU  timpEtapa > FOV_DURATA_MAX_ETAPA:
       snap la țintă, execută efectul etapei, treci la etapa următoare
   ```
   Efectele pe etape: `0 → arată span1`; `1 → arată span2`; `2 → dezvăluie răspunsul`
   (doar dacă `tip === "corect"` ȘI `cfg.fovLiftAnimatieCorect`; dacă era deja dezvăluit,
   NU ascunde/reface — doar lasă-l); `3 → ascunde pătrățelul, cursa se termină`.

5. **CSS + wiring CP** (§6, §7).

6. **Verificare** (§5) — cu fereastra vizibilă, măsurători reale, nu privire.

## 9. Formule analitice

- `N = cfg.latimiColoane[colIndex]`
- `xStart = colX[colIndex] + (N − 0.5) * cell` — centrul celulei a N-a (confirmat:
  `.rigle-row-cell` are `flex: 1 0 0`, deci celule egale de `cell` fiecare).
- `randCurent = Math.round((y + liftH) / cell)`; `yStart = randCurent * cell + cell / 2` —
  rândul unde e marginea de jos a liftului. (Formula seamănă cu `pozitieReper` din
  `actualizeazaNumerotareAnimata`, dar **fără** „+1"-ul de acolo, care servea alt scop.)
- Ținta per cadru: `colX[colIndex] + decalajX_memorat`, `y + decalajY_memorat`.

## 10. Ce NU se schimbă

- `actualizeazaMismatch()`, `reglajLift()`, `reglajEticheta()`, dreptunghiul portocaliu —
  neatinse; doar citite (`colX`, `cell`, `totalMere`, `y`, `liftH`).
- Eticheta de pe buton — acum gated de `cfg.fovButon`, logica internă neschimbată.
- `facte.js` / `RigleFacte` — deloc.
- `?v=` bump în `index.html` (altfel browserul servește cod vechi).

## 11. Riscuri reziduale (semnalate, nerezolvate — nu extind scope-ul singur)

- **Text lung la sumă mare** („15 e prea mare" / „15>7+8") poate face caseta mai lată decât
  liftul. Nu s-a cerut word-wrap pentru ea; dacă arată urât, se rezolvă separat.
- **Liftul continuă să cadă** sub casetă cât rulează cursa (caseta e poziționată o dată, la
  apăsare, și nu urmărește căderea). La 34 px/s și ~1,5s de cursă, liftul coboară ~50px —
  caseta va părea că „rămâne în urmă". Dacă deranjează, varianta e să repoziționăm caseta
  în fiecare cadru (ieftin — poziție analitică, fără măsurare). **Nu am ales singur** —
  întreabă userul dacă apare ca problemă vizibilă.
