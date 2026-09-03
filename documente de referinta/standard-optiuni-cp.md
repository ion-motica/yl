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

`js/quizzes/tabla-inmultirii-tabel.js` — primul quiz migrat (03.09.2026), de la
stilul vechi (helper-e locale `addBifa`/`addStepper`/`appendSelectField`,
~65 de linii de cod DOM repetitiv + `getSharedConfig`/`applySharedConfig` scrise
manual) la `campurileCP(quizPublicApi, opts, rerandeaza)` + motor. Rezultat:
`appendTablaInmultiriiTabelControlPanel` a scazut la 4 linii; `getSharedConfig`/
`applySharedConfig` la cate 3-6 linii fiecare, fara nicio validare scrisa de mana.

Teste: `tests/motor-optiuni-control-panel.test.js` (motorul, izolat — toate cele 5
tipuri, plus validare pe input malitios/invalid per tip) si
`tests/tabla-inmultirii-tabel-share-link.test.js` (contractul complet, prin motor).

## Ce ramane de facut

Alte 7 quizuri cu panou CP propriu, inca nemigrate (stilul vechi, functional, dar
duplicat): `rigle-cl1.js`, `rigle-tabla-1-10.js` (aproape identice intre ele — cel
mai clar caz de coeziune slaba), `equations-e3-e6.js`, `pre-equations-eff-navigation.js`,
`addition-table-singapore-missing.js`, `multiplication-1120-v3-train-eff-eq-forms.js`,
`multiplication-1120-v4-intensiv-multipli-234.js` (Sq3 + Sq5).

Tipuri de camp deja intalnite in aceste 7, testate in motor dar inca nefolosite de
niciun quiz migrat: `enum` cu `stilAfisare: "radio"` (rigle-cl1, rigle-tabla-1-10),
`numar` cu `stilAfisare: "slider"` (multiplication-1120-v3), `set` (checkbox
multiplu — pre-equations-eff-navigation, equations-e3-e6), `culoare`
(rigle-tabla-1-10, addition-table-singapore-missing).

Aceasta structura **e prima trecere**, dupa o analiza a tuturor celor 8 panouri CP
existente la momentul scrierii — nu varianta finala. Se ajusteaza pe masura ce
fiecare quiz se migreaza, daca apare un caz care nu se potriveste (cerere user:
"faci o prima structura de standarduri, apoi o ajustezi ... pe masura ce
implementezi fiecare quiz").

## Verificare (cum confirmi ca merge)

Dupa migrarea unui quiz: (a) `npm test` — motorul si contractul de share-link al
quizului au teste dedicate; (b) Playwright manual — panoul CP arata identic
(aceleasi campuri, aceeasi ordine, acelasi comportament la schimbare — inclusiv
care campuri restarteaza nivelul si care nu); (c) genereaza linkul, navigheaza la
el intr-un tab nou, confirma ca toata starea (nivel + toate campurile CP) se
restaureaza exact.
