# Standard — optiuni CP declarative (motor-optiuni-control-panel.js)

> Tipar pt. panourile CP ale quizurilor: optiunile se **declara** ca date (un tabel
> de "campuri"), nu se scriu ca cod DOM imperativ. Din acelasi tabel se genereaza
> automat atat panoul CP, cat si linkul de partajare (getSharedConfig/getSharedLink/
> applySharedConfig).
>
> **Cand se aplica (trigger):** orice quiz cu panou CP propriu (`appendXControlPanel`)
> — fie unul nou, fie unul migrat de la stilul vechi (helper-e locale `addBifa`/
> `addStepper`/`appendSelectField` duplicate in mai multe fisiere). Referinta din
> `AGENTS.md`.

## De ce exista acest standard

Cerere user, 03.09.2026, dupa ce s-a cerut un buton "Genereaza link cu parametrii
CP" pt. un singur quiz (tabla-inmultirii-tabel), apoi "vreau acest buton sa
functioneze pt. TOATE quizurile": **"standardizam optiunile din CP ca sa poata fi
citite automat, nu sa trebuiasca sa vina nenea claude la fiecare quiz si sa faca
analiza cuantica."**

Diagnosticul din `documente de referinta/razgandire-ieftina.md`, intrebarea 1
("daca ma razgandesc la o optiune noua, in cate locuri trebuie sa scriu?"): inainte
de acest motor, raspunsul era **minim 3** — codul DOM al panoului, plus (daca quizul
voia link de partajare) `getSharedConfig` si `applySharedConfig` scrise manual,
camp cu camp, cu propria validare repetata de fiecare data. `rigle-cl1.js` si
`rigle-tabla-1-10.js` aveau panouri CP aproape identice, duplicate cuvant cu
cuvant — coeziune slaba clasica (regula 3 din documentul de mai sus: "tabele in loc
de if-uri").

## Regula-nucleu: un "camp" e un obiect, nu cod

```js
{
  cheie: "mutareColoane",        // identificator unic — devine cheia in cfg (link)
  tip: "bifa" | "enum" | "numar" | "set" | "culoare",
  eticheta: "Mutare coloane:",   // text afisat langa control
  grup: "Mutare coloane",        // (optional) titlu de sectiune — campurile
                                  // consecutive cu acelasi grup se aduna sub el
  get: () => valoareCurenta,
  set: (valoare) => {...},       // aplica + valideaza/clampeaza intern (asa cum
                                  // fac deja scrie*() din quizuri)

  // specifice tipului "enum" (o valoare dintr-o lista fixa):
  optiuni: [{ valoare, text }, ...],
  stilAfisare: "select" | "radio",     // implicit "select"

  // specifice tipului "numar" (interval):
  min, max,
  pas: 1,               // implicit 1
  zecimale: 0,           // implicit 0
  stilAfisare: "stepper" | "slider",   // implicit "stepper"

  // specific tipului "set" (mai multe valori bifate simultan):
  optiuni: [{ valoare, text }, ...],
  minSelectate: 1,       // implicit 1 — sub acest numar, ultima debifare e refuzata

  implicit: <valoare>,   // (optional) fallback cand input-ul din link e invalid —
                          // daca lipseste, aplicaConfig cade pe get() (nu schimba nimic)
  inDOM: true,            // (optional) false = nu apare in panoul CP (ex: nivelul,
                          // care are propriul UI in bara de niveluri), dar tot
                          // participa la citesteConfig/aplicaConfig
  activCand: (valoriCurente) => boolean,  // (optional) vizibil doar cand alt camp
                                          // are o anume valoare
  dupaSchimbare: () => {},  // (optional) efect secundar suplimentar dupa set()
}
```

Un quiz scrie o functie `campurileCP(...)` care returneaza `[camp1, camp2, ...]`.
`js/motor-optiuni-control-panel.js` face restul:

- **`construiesteDOM(mount, campuri)`** — deseneaza panoul, grupat, respectand
  `activCand`. Re-randare completa (nu update partial) — "UI = f(state)", punctul
  12 din `razgandire-ieftina.md`.
- **`citesteConfig(campuri)`** — `{ [cheie]: get() }` pt. toate campurile. Asta e
  `getSharedConfig()`.
- **`aplicaConfig(campuri, sharedNetrusted)`** — pt. fiecare cheie prezenta in
  `shared`, valideaza dupa metadata campului (whitelist pt. enum/set, clamp pt.
  numar, regex hex pt. culoare, `Boolean()` pt. bifa) si apeleaza `set()`. Asta e
  `applySharedConfig()` — validare **automata**, nu mai scrisa manual per camp.
- **`campNivelStandard(quizApi, nivelImplicit)`** — genereaza automat campul de
  nivel (`getLevel`/`switchLevel`/`getMinLevel`/`getMaxLevel`, deja contract comun
  tuturor quizurilor), cu `inDOM: false` (nivelul are propriul UI, bara de
  butoane, in afara panoului CP). Un quiz il pune la inceputul propriei liste, nu-l
  redeclara manual.

## Doua decizii importante (nu evidente din prima citire)

1. **`dupaSchimbare`, NU un `onChange` automat.** Motorul nu stie care schimbare
   trebuie sa declanseze un restart de nivel si care nu. In `tabla-inmultirii-tabel.js`,
   bifa "Comută pe tabla adunării" restarteaza nivelul (schimba operatia pe toate
   cele 10 randuri), dar padding-ul sau marimea fontului NU — se aplica direct,
   vizual. Fiecare camp isi declara explicit efectul, prin `dupaSchimbare` (capturat
   din closure-ul quizului, ex: `() => opts.onChange?.()`), niciodata implicit.

2. **Un camp de tip "numar" cu variante multiple (ex: durata per mod de "Mutare
   coloane") devine UN CAMP SEPARAT per variantă, nu un singur camp care "urmareste
   modul curent".** `tabla-inmultirii-tabel.js` are 5 campuri de durata
   (`rocadaDurataS`, `alternareF2DurataS`, ...), fiecare cu propriul `activCand`
   care il arata in UI DOAR cand modul lui e selectat — dar TOATE 5 participa la
   `citesteConfig`/`aplicaConfig` (share-link), indiferent care e vizibil acum.
   Asta pastreaza fidelitatea completa: daca ai reglat manual durata la 3 moduri
   diferite, linkul le transmite pe toate, nu doar pe a modului activ acum.

## Implementare de referinta

Migrate (03.09.2026), toate verificate cu `npm test` + Playwright end-to-end
(panoul CP arata/functioneaza identic, share-link cand exista):

- **`js/quizzes/tabla-inmultirii-tabel.js`** — primul migrat, precedentul.
  `appendTablaInmultiriiTabelControlPanel` de la ~65 de linii de cod DOM
  repetitiv la 4; `getSharedConfig`/`applySharedConfig` de la validare scrisa
  manual la 3-6 linii fiecare, fara nicio validare de mana.
- **`js/app.js` (sectiunea General)** — categorie separata, nu per-quiz
  (omisa din analiza initiala a "quizurilor cu panou CP"). Doar bifa
  "Afiseaza Timpi raspuns" migrata; butoanele de actiune (Vizualizare3,
  Genereaza link) raman cod simplu — nu au stare, motorul e pt. campuri
  get/set. A scos la iveala cod mort (`responseTimesInput`/
  `syncResponseTimesInput`, fara niciun apelant in afara locului unde
  checkbox-ul tocmai fusese creat).
- **`js/app.js` (sectiunea Debug/"Depanare")** — gasita abia la scrierea
  checkului de enforcement (03.09.2026), niciodata pe lista initiala de
  migrare. Majoritatea delega deja la alte module (`AsnwProfile`,
  `LevelChangeReward`) — cod curat, in afara domeniului acestui standard.
  Un singur slider brut ("cate numere de la buton la ?", `asnwNumbersFlowCount`)
  migrat la motor. Bifa "Border verde..." (`debugInfoBorders`) **ramasa
  neatinsa**, marcata `CP-DECLARATIV-EXCEPTIE` — e dezactivata (nu doar
  ascunsa) automat cand modul ASNW e activ, prin manipulare DOM directa
  (`debugBordersInput.disabled`) in `applyDebugInfoBorders()`; motorul nu are
  azi un concept de camp "vizibil dar dezactivat" (doar `activCand`, care
  ASCUNDE complet).
- **`js/quizzes/rigle-cl1.js`** — 18 campuri, migrare completa. A cerut 2
  extensii mici ale motorului: `formateazaAfisare` (text custom pe slider,
  ex. "de 3× mai încet" in loc de cifra bruta) si `eticheta` pe campurile
  enum-radio (sub-titlu mic deasupra unui grup radio, cand nu justifica un
  `grup` intreg). Dependenta incrucisata (Suma Minim/Maxim — schimband unul,
  celalalt se re-clampeaza) rezolvata prin `dupaSchimbare: rerandeaza`,
  acelasi tipar ca la campul "mutareColoane" din tabla-inmultirii-tabel.
- **`js/quizzes/rigle-tabla-1-10.js`** — migrare **partiala**, deliberat.
  Toate campurile simple (Grila, Pozitie coloane, Numerotare, Bara mere,
  Lift + Pornire + Scala, FOV, Dara) migrate. Sectiunea "Culori" (selector de
  element + color picker + paleta personala de max. 10 culori + scheme
  complete salvate/aplicate/sterse) **ramane cod vechi, neatins** — are stare
  proprie (elementul curent selectat, tranzitorie, nepersistata), actiuni
  compuse (salveaza/aplica un SET de 5 culori deodata) si o relatie
  master-detail intre selector si picker. Nu se incadreaza curat in formatul
  "camp = {tip, get, set}". **Intrebare arhitecturala deschisa**: cum tratam
  sisteme CP compuse, cu stare si actiuni proprii — nu doar optiuni simple.
  Nu blocheaza restul migrarii; ramane pt. o discutie separata. Sectiunea e
  marcata explicit cu comentarii `CP-DECLARATIV-EXCEPTIE:START`/`:END`
  (03.09.2026), recunoscute de `scripts/check-cp-optiuni-declarative.mjs` —
  vezi „Enforcement" mai jos. Corectie fata de o presupunere gresita facuta
  in conversatie: migrarea celor 5 culori curente la campuri `culoare` NU ar
  fi dat acestui quiz un link de partajare "gratis" — `rigle-tabla-1-10.js`
  nu are deloc `getSharedConfig`/`getSharedLink`/`applySharedConfig` azi
  (doar `tabla-inmultirii-tabel.js` si `equations-e3-e6.js` au share-link
  complet implementat), deci acel beneficiu specific nu exista fara sa se
  construiasca intai intreaga infrastructura de share-link pt. acest quiz —
  scop mai mare decat migrarea panoului CP, nefacut acum.
- **`js/quizzes/equations-e3-e6.js`** — al doilea quiz cu share-link,
  precedentul original (getSharedConfig/applySharedConfig scrise manual
  INAINTE sa existe motorul). Migrare completa, inclusiv `campul` "signMode"
  (fara control UI propriu, mereu SAME_SIGN — `inDOM: false`, dar participa
  la share-link pt. fidelitate cu formatul dinainte). **Capcana reala găsită
  aici**: `set()` NU trebuie sa aiba efecte secundare (restart de runda) —
  motorul cheama `set()` o data per camp prezent in `shared`, deci un `set()`
  cu restart inclus ar restarta runda de N ori la un singur `applySharedConfig`
  (N = nr. de campuri din link), in loc de o singura data. Restart-ul ramane
  STRICT in `dupaSchimbare` (UI) si, separat, o singura data la finalul
  `applySharedConfig` insusi. Testele existente (`tests/equations-e3-e6.test.js`,
  scrise inainte de motor) au trebuit actualizate sa incarce
  `motor-optiuni-control-panel.js`.
- **`js/quizzes/pre-equations-eff-navigation.js`** — migrare completa, 7
  campuri, inclusiv un efect secundar compus real (schimbarea "Raspuns ca"
  reseteaza simultan "Necunoscuta" la null, care cade pe propriul fallback
  calculat) si campuri al caror `get()` foloseste o functie cu fallback
  (`effectiveAnswerMode()`/`effectiveUnknownSymbol()`), nu direct valoarea
  bruta din config.

- **`js/quizzes/addition-table-singapore-missing.js`** — migrare completa, 10
  campuri (6 numar, 3 enum, 1 culoare — primul folosit REAL de motor). Efect
  secundar compus real: `setIlustrareLa("toate")` dezactiveaza automat
  "Spectacol la final de level" (deja in `setIlustrareLa`), UI-ul re-desenat
  prin `dupaSchimbare: rerandeaza` ca al doilea select sa arate schimbarea.
- **`js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js`** — migrare
  completa a panoului `appendSq2ControlPanel` (6 campuri, primul `tip: "set"`
  folosit real). `setSq2Config` — API public separat, testat direct in 3
  fisiere de teste, cu contract `{ok, rejected}` — **ramas STRICT neatins**,
  nu are legatura cu tabelul declarativ. Testele existente
  (`tests/jurnal-intrebari.test.js`) actualizate sa incarce motorul.
- **`js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js`** — DOUA
  panouri CP separate in acelasi fisier (Sq3: 5 campuri; Sq5: 7 campuri),
  fiecare cu propriul `campurileCP`. Cazuri noi: **doua tipuri de hook**
  (`hooks.onChange` vs `hooks.onRouteChange` — al doilea cand schimbarea
  cere repornirea rutei de subquiz-uri, nu doar re-randare CP) si
  `activCand` folosit pt. prima data pe o vizibilitate REAL conditionata
  (campul "Intrare in sq5" apare doar cand "Ruleaza sq5" e pe modul B).
  `setSq2Config` (contract public `{ok, rejected}`, testat separat)
  **ramas neatins** — nu are legatura cu acest tabel. `appendSq2ControlPanelUnused`
  NU era cod mort obisnuit: avea un comentariu chiar deasupra lui — "Panoul
  CP al lui sq2 ramane definit (cod pastrat), dar nu mai e expus pe obiectul
  quizului -> CpRegistry il considera dezactivat, deci nu se afiseaza.
  Decizie user, 29.07.2026 ('ramane ascuns integral')" — deci o decizie user
  explicita sa fie PASTRAT, doar ascuns, nu sters. Descoperit 03.09.2026 la
  scrierea checkului de enforcement, semnalat userului (format "posibila
  incalcare regula stabilita"); userul a decis acelasi 03.09.2026 sa-l
  stearga totusi ("nu mai are rost pastrat") — **sters complet**, decizia
  din 29.07.2026 fiind explicit suprascrisa de cea din 03.09.2026. Comentariul
  care il referea (langa `setSq2Config`, mai sus in fisier) actualizat sa
  reflecte stergerea. **La aceeasi migrare s-au gasit si sters** (03.09.2026)
  `sq5SliderRow`/`sq5StepperRow` — doi helperi DOM bruti ramasi orfani dupa
  migrarea `appendSq3ControlPanel`/`appendSq5ControlPanel` la motor, fara
  niciun apelant (confirmat prin grep) si fara nicio decizie user in spate —
  cod mort obisnuit, caz diferit de `appendSq2ControlPanelUnused`.

Teste: `tests/motor-optiuni-control-panel.test.js` (motorul, izolat — toate
cele 5 tipuri, plus validare pe input malitios/invalid per tip),
`tests/tabla-inmultirii-tabel-share-link.test.js`,
`tests/equations-e3-e6.test.js`, `tests/jurnal-intrebari.test.js`
(actualizate sa incarce motorul).

## Enforcement (check automat)

Cerere user, 03.09.2026: "sa nu se mai poata face adaugari in cp decat prin
acest motor cu date stocate in text" — implementat, `scripts/check-cp-optiuni-declarative.mjs`
(`npm run check:cp-optiuni`), rulat automat inaintea oricarui commit alaturi
de `check:docs`/`check:encoding`/`test`.

**Domeniu verificat**: `js/quizzes/*.js` + `js/app.js` — unde traiesc toate
panourile CP ale quizurilor si sectiunile CP din shell-ul aplicatiei.
`js/motor-optiuni-control-panel.js` exclus (e motorul insusi).

**Ce detecteaza**: `document.createElement("select")` si atribuiri
`.type = "checkbox"|"radio"|"number"|"range"|"color"` — tiparele de cod DOM
imperativ pe care motorul le inlocuieste.

**Mecanism de exceptie (2 cai, ambele cer motiv + data)**:

1. **Marcaje in sursa** — `// CP-DECLARATIV-EXCEPTIE:START` / `:END` in jurul
   blocului de cod, cu un comentariu explicit deasupra care spune de ce nu se
   incadreaza in formatul declarativ. Folosit azi in 2 locuri:
   - `js/quizzes/rigle-tabla-1-10.js` — sectiunea "Culori" (vezi mai sus).
   - `js/app.js` — bifa "Border verde..." din panoul Debug (vezi mai sus).
2. **`EXCEPTII_PUNCTUALE`** (lista in scriptul insusi) — STRICT pt. cazuri
   unde sursa nu poate fi marcata inca (ex: o decizie user in asteptare, cat
   timp fisierul nu se modifica pana la raspuns). Foloseste numele functiei +
   brace-matching ca sa goleasca acea zona inainte de scanare. **Goala azi**
   (03.09.2026) — singurul caz folosit (`appendSq2ControlPanelUnused` din
   `multiplication-1120-v4-intensiv-multipli-234.js`, vezi bulletul dedicat
   mai sus) s-a rezolvat prin stergerea completa a functiei, nu printr-o
   exceptie permanenta — mecanismul ramane in script, gata pt. urmatorul caz
   real.

**Gasit la scriere (03.09.2026), corectat inainte de a activa checkul**: 2
helperi DOM bruti orfani (`sq5SliderRow`/`sq5StepperRow`, cod mort obisnuit,
sterse), 1 slider brut in panoul Debug (`js/app.js`, migrat la motor).

**Domeniu NEACOPERIT, deliberat, gasit la scriere (03.09.2026)** — panouri CP
complet separate, in afara celor 7 fisiere de quiz identificate initial,
nemigrate si azi in afara scopului acestui check:

- `js/falling-engine.js` — `buildLiftControlPanel()` (transparenta fundal
  lift, latime lift, checkbox-uri "riseFromButton"/"revealAnswer...").
- `js/aam-arena.js` — `buildControlPanel()` (checkbox-uri PANEL_SWITCHES +
  extensii axa, `<select>` "Obiect afisat", slider viteza acolada).

Ambele sunt panouri CP reale, comparabile ca marime cu un quiz migrat — nu
niste cazuri marginale. Nu au fost migrate acum (scop nou, nu doar
"terminarea" migrarii deja incepute) — raman pt. o decizie separata a
userului daca se extinde proiectul si la ele.

Aceasta structura **a trecut prin ajustari reale** pe parcursul migrarii
(`formateazaAfisare`, `eticheta` pe radio), exact cum s-a anticipat ("faci o
prima structura de standarduri, apoi o ajustezi ... pe masura ce
implementezi fiecare quiz") — dar schema de baza (5 tipuri de camp, get/set,
dupaSchimbare, activCand, inDOM) s-a dovedit suficienta pt. toate cele 8
panouri CP existente in proiect, inclusiv cazurile mai neobisnuite (doua
tipuri de hook, doua panouri separate in acelasi fisier, valori enum
booleene/numerice, sliders cu text formatat custom).

## Verificare (cum confirmi ca merge)

Dupa migrarea unui quiz: (a) `npm test` — motorul si contractul de share-link al
quizului au teste dedicate; (b) Playwright manual — panoul CP arata identic
(aceleasi campuri, aceeasi ordine, acelasi comportament la schimbare — inclusiv
care campuri restarteaza nivelul si care nu); (c) genereaza linkul, navigheaza la
el intr-un tab nou, confirma ca toata starea (nivel + toate campurile CP) se
restaureaza exact.
