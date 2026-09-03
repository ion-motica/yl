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
  Nu blocheaza restul migrarii; ramane pt. o discutie separata.
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

Teste: `tests/motor-optiuni-control-panel.test.js` (motorul, izolat — toate
cele 5 tipuri, plus validare pe input malitios/invalid per tip),
`tests/tabla-inmultirii-tabel-share-link.test.js`,
`tests/equations-e3-e6.test.js` (actualizat).

## Ce ramane de facut

3 quizuri cu panou CP propriu, inca nemigrate: `addition-table-singapore-missing.js`,
`multiplication-1120-v3-train-eff-eq-forms.js`,
`multiplication-1120-v4-intensiv-multipli-234.js` (Sq3 + Sq5). Plus sectiunea
"Culori" din `rigle-tabla-1-10.js` (vezi mai sus — intrebare arhitecturala
deschisa, nu simpla migrare).

Tipuri de camp deja acoperite de motor dar inca nefolosite de niciun quiz
migrat: `culoare` (candidati: `rigle-tabla-1-10` — daca se rezolva intrebarea
de mai sus —, `addition-table-singapore-missing`), `numar` cu
`stilAfisare: "slider"` fara `formateazaAfisare` custom (multiplication-1120-v3).

Ultimul pas planificat, dupa ce TOATE panourile CP sunt migrate (inclusiv
decizia pt. "Culori"): un check automat (`scripts/check-cp-optiuni-declarative.mjs`
sau similar) care interzice cod DOM imperativ nou pt. optiuni CP in afara
motorului — cerere user, 03.09.2026: "sa nu se mai poata face adaugari in cp
decat prin acest motor cu date stocate in text". Nu se activeaza inainte de
migrarea completa (ar bloca commit-uri normale pe cod inca nemigrat).

Aceasta structura **e prima trecere**, dupa o analiza a tuturor celor 8 panouri CP
existente la momentul scrierii — nu varianta finala. S-a ajustat deja de doua ori
pe parcurs (`formateazaAfisare`, `eticheta` pe radio) exact cum s-a anticipat
("faci o prima structura de standarduri, apoi o ajustezi ... pe masura ce
implementezi fiecare quiz").

## Verificare (cum confirmi ca merge)

Dupa migrarea unui quiz: (a) `npm test` — motorul si contractul de share-link al
quizului au teste dedicate; (b) Playwright manual — panoul CP arata identic
(aceleasi campuri, aceeasi ordine, acelasi comportament la schimbare — inclusiv
care campuri restarteaza nivelul si care nu); (c) genereaza linkul, navigheaza la
el intr-un tab nou, confirma ca toata starea (nivel + toate campurile CP) se
restaureaza exact.
