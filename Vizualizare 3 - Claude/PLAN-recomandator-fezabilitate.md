# Plan de implementare — Recomandatorul de fezabilitate a adâncimii

Implementează „Analiza de fezabilitate a granulației" (SPECIFICATIE.md §13) în forma
decisă de user pe 21.07.2026, adaptată designului v2 al tabelului (fotografii
stratificate). Reguli de lucru: `AGENTS.md`. Tot ce era ambiguu e decis și pinuit
aici — nu re-deriva, nu adăuga scope.

## Schimbări față de versiunea inițială a acestui plan (citește dacă ai văzut deja o versiune veche)

Userul a corectat două lucruri esențiale după prima versiune:

1. **Domeniul de interes e tabla 1-10 (10×10), NU 11-20.** 11-20 a fost doar
   experimentul care a produs jurnalul real descărcat — nu domeniul pe care userul
   îl urmărește. Toate țintele de verificare de mai jos sunt pe **1-10**, cu
   **fixture-ul dummy** (jurnalul real n-are NICIUN răspuns pe 1-10: 0 din 652
   înregistrări, verificat direct). Vezi memoria `project_youlearn_domeniu_1_10`.
2. **Afișarea s-a schimbat**: nu mai există rezumate numerice per bifă
   (`viz3-bifa-rezumat`, ideea din runda 1). În loc: bifa recomandată se
   **selectează automat** (o dată, apoi respectă alegerea manuală a userului) și
   primește un marcaj text „(Recomandat)" lângă eticheta ei; comparația completă
   între cele 4 adâncimi trăiește într-un **tabel separat, sub tabelul de
   evoluție**, cu titlu și coloane dictate de user (vezi Pasul 3.5).
3. **Recomandarea e multi-domeniu** (runda 3, la cererea userului): urmează
   domeniul activ din CP — 1-10 rămâne prioritatea absolută (ținta primară A),
   11-20 × 1-20 primește țintă secundară B pe logul real; tabla adunării (+) =
   etapă separată (motorul mapează azi doar înmulțirea). Vezi decizia 7.

Motorul (Pasul 1) NU s-a schimbat — funcția e deja generică pe orice catalog,
verificat direct: pe 10×10 dă `facts_per_subtabla=10` corect (era 20 la 11-20),
fără nicio linie de cod nouă.

## Deciziile userului (21.07.2026 — autoritate de design)

1. **Scop**: recomandă DOAR adâncimea fotografiei (2/5/10/20 răsp/fact). Granulația
   calendaristică (zi/3 zile/săptămână) = etapa următoare, NU acum.
2. **Criteriu**: procentul de celule „încredere mare" din totalul celulelor
   candidatului (rândul „Toată fereastra" exclus). La egalitate câștigă adâncimea
   mai mică (granulație mai fină).
3. **Celule numărate**: toate pozele × rândurile-subtablă.
4. **Afișare** (actualizat): bifa recomandată se bifează singură + „(Recomandat)"
   lângă eticheta ei în CP; tabelul complet de comparație stă sub tabelul de
   evoluție a fluenței. Bifarea rămâne mereu a userului — recomandatorul DOAR
   informează, nu schimbă nimic fără voia lui după prima auto-selecție.
5. **Auto-selecție** (decis azi): bifa sare pe adâncimea recomandată la
   deschiderea tabelului (comutare grilă→tabel), la schimbarea domeniului și la
   schimbarea sursei. Dacă userul bifează ALTĂ adâncime manual, alegerea lui
   rămâne până la următoarea schimbare de domeniu/sursă/deschidere — recomandarea
   NU-l suprascrie în timp ce se uită la tabel.
6. **Pasul dintre poze rămâne legat de adâncime** (o poză = o celulă plină) —
   userul a întrebat dacă un pas mai mare, ales independent, n-ar da comparații
   mai relevante (mai puțină suprapunere între poze vecine). Răspunsul e DA, dar
   e o schimbare de alt fel (afectează tabelul de evoluție, nu doar
   recomandatorul) — **rămâne pentru etapa următoare**, adăugat ca TODO în
   `CONTINUARE-proiect-MABP.md` (Pasul 6 mai jos).
7. **Domeniul recomandării = domeniul activ din CP** (decis 21.07.2026, seara):
   recomandatorul se calculează pe catalogul bifat în axa Domeniu, deci merge
   NEschimbat pe orice interval de ÎNMULȚIRE (1-10, 11-20 × 1-20, o subtablă,
   custom a-b × c-d) — zero cod special pentru asta. Prioritatea ABSOLUTĂ
   rămâne tabla 1-10: țintele primare de verificare sunt pe 1-10; 11-20 × 1-20
   primește o verificare secundară pe logul real (dovada de generalitate).
   Tabla ADUNĂRII (+) NU intră în runda asta: maparea fact→celulă din motor
   (`cheieCelulaDinInregistrare`) recunoaște doar înmulțirea (regex `[*x×]`) —
   un log de adunare cade azi integral în „necatalogate" → B=0 → tabel gol +
   fără recomandare, fără crash. Suportul pentru + = catalog nou (operație
   "add") + extinderea acelui punct unic de mapare — etapă separată, trecută la
   TODO (Pasul 6).

## Pre-mortem (făcut; simularea de design a rulat pe fixture-ul dummy, domeniul 1-10)

- Ipoteza riscantă („procentul de bazate discriminează candidații și pe 10×10, nu
  doar pe experimentul 11-20") — VERIFICATĂ: am rulat `construiesteModelTabelFluenta`
  REAL (neschimbat) cu catalog `{aMin:1,aMax:10,bMin:1,bMax:10}` peste
  `FixtureLoguriDummyVizualizare3.construiesteFixture()` (2260 răspunsuri valide pe
  acest domeniu). Rezultat: 0% / 64,1% / 77,8% / 76,7% — discriminare clară,
  recomandată **10**. Țintele exacte (poze/celule/contor complet) sunt pinuite mai
  jos și implementarea TREBUIE să le reproducă exact.
- Generalitatea pe domenii — VERIFICATĂ pe AMBELE seturi de date: 1-10 (fixture
  dummy, ținta primară A) și 11-20 × 1-20 (logul real din 18.07, ținta secundară
  B). Aceeași funcție, alt `catalog` — nicio ramură nouă de cod.
- Notă structurală (NU e bug, e onest): la 10 facts/subtablă, n maxim per celulă =
  adâncime × 10; pragul `n_incredere_mare: 50` cere adâncime ≥ 5, deci **adâncimea
  2 nu poate avea NICIODATĂ o celulă „bazată" pe 10×10**, oricâte date aduni —
  chiar mai strict decât pe experimentul 11-20 (unde pragul era adâncime ≥ 3).
- Alternative respinse de user: număr absolut (înclinat spre adâncimi mici), scor
  ponderat (ponderi arbitrare). Nu le implementa.
- Reversibilitate: feature aditiv (funcție nouă + elemente DOM noi), revert curat.

## Reguli de lucru (obligatorii)

- Editează NUMAI cu Edit/Write (diacritice; PowerShell Get-Content|Set-Content
  corupe). Fără `cd` în comenzi. Commit DOAR la cererea explicită a userului.
- Modificări DOAR în fișierele din „Definition of done".
- La final: `?v=36` → `?v=37` la TOATE tagurile din `vizualizare3.html`.
- Text explicativ SUB tabelul de recomandare (ce înseamnă fiecare coloană) NU se
  scrie automat — userul îl adaugă separat, cu propriile formulări. Nu inventa
  paragrafe explicative (vezi „În AFARA scopului").

## Pasul 1 — motor: funcția nouă `construiesteRecomandareAdancime`

În `motor-analiza.js`, imediat DUPĂ `construiesteModelTabelFluenta` (înainte de
secțiunea „---- modelul de vizualizare"). NU atinge nicio funcție existentă.
(Neschimbat față de runda 1 — deja verificat generic pe orice catalog.)

### Contract

```js
construiesteRecomandareAdancime({ inregistrari, catalog, adancimi, praguri })
// -> {
//   tip: "recomandare_adancime",
//   candidati: [ { adancime, poze, celule_total,
//                  contor: { incredere_mare, incredere_mica, date_insuficiente },
//                  procent_bazate } ],           // ordinea = ordinea din `adancimi`
//   adancime_recomandata,   // număr | null (null când NICIUN candidat nu are
//                           //  incredere_mare > 0 — include cazul B=0; o
//                           //  „recomandare" cu 0 celule bazate n-ar însemna nimic)
// }
```

### Implementare (exact)

```js
// Fezabilitatea adâncimilor candidate: rulează modelul tabelului per candidat
// și numără etichetele de încredere pe celulele subtablelor (rândul „Toată
// fereastra" e medie derivată — s-ar număra aceleași date de două ori).
// Criteriu (decis 21.07.2026): procentul de celule „încredere mare"; la
// egalitate câștigă adâncimea mai mică. Se uită NUMAI la etichete (n + zile),
// niciodată la scoruri — anti cherry-picking, corect prin construcție.
// Rulează construiesteModelTabelFluenta per candidat, fără reuse — funcție
// pură, cost trivial la mărimea jurnalului; simplitatea bate optimizarea.
function construiesteRecomandareAdancime({ inregistrari, catalog, adancimi, praguri }) {
  if (!Array.isArray(adancimi) || adancimi.length === 0) {
    throw new Error("Recomandatorul are nevoie de un array nevid de adâncimi candidate.");
  }

  const candidati = adancimi.map((adancime) => {
    const model = construiesteModelTabelFluenta({ inregistrari, catalog, adancime, praguri });
    const contor = { incredere_mare: 0, incredere_mica: 0, date_insuficiente: 0 };
    let total = 0;
    model.randuri
      .filter((rand) => rand.tip === "subtabla")
      .forEach((rand) =>
        rand.celule.forEach((celula) => {
          contor[celula.eticheta] += 1;
          total += 1;
        })
      );
    return {
      adancime,
      poze: model.antete.length,
      celule_total: total,
      contor,
      procent_bazate: total ? contor.incredere_mare / total : 0,
    };
  });

  let recomandata = null;
  candidati.forEach((c) => {
    if (c.contor.incredere_mare === 0) return;
    if (
      !recomandata ||
      c.procent_bazate > recomandata.procent_bazate ||
      (c.procent_bazate === recomandata.procent_bazate && c.adancime < recomandata.adancime)
    ) {
      recomandata = c;
    }
  });

  return {
    tip: "recomandare_adancime",
    candidati,
    adancime_recomandata: recomandata ? recomandata.adancime : null,
  };
}
```

Note pinuite:
- `inregistrari`/`catalog`/adâncimile individuale NU se re-validează aici: primul
  apel `construiesteModelTabelFluenta` aruncă deja mesajele existente. Nu dubla
  validările.
- Export: adaugă `construiesteRecomandareAdancime,` în `global.MotorAnalizaVizualizare3`,
  imediat după `construiesteModelTabelFluenta,`.

## Pasul 2 — `definitii-axe.js`: axa capătă un marcaj declarativ nou

Pe axa `adancime_foto` (are deja `nota_dinamica: true`), adaugă imediat lângă ea:

```js
// Bootstrap-ul pune, per opțiune, un span gol care primeste "(Recomandat)"
// cand recomandatorul alege optiunea asta (vezi marcaj_recomandare mai jos).
marcaj_recomandare: true,
```

Nimic altceva nu se schimbă în acest fișier.

## Pasul 3 — bootstrap

### 3.1 — CP: span-ul de marcaj per opțiune

În `randeazaControlPanel`, în bucla generică `axa.optiuni.forEach((opt) => { ... })`
(caută `const rand = optiune(opt.eticheta, elemente);` — chiar înainte de ea):

```js
if (axa.marcaj_recomandare) {
  const marcaj = document.createElement("span");
  marcaj.className = "viz3-marcaj-recomandare";
  marcaj.dataset.marcajAdancime = String(opt.adancime);
  elemente.push(marcaj);
}
```

Rezultă un `<span>` gol lângă fiecare din cele 4 bife, pe care funcția din 3.4 îl
umple/golește. Presupune că opțiunea are câmpul `opt.adancime` — adevărat pentru
toate cele 4 opțiuni ale axei `adancime_foto`.

### 3.2 — stare nouă: `adancimeAlesaManual`

Lângă declarația `let adancimeActiva = ...` (caută-o după `axaAdancime`):

```js
// true doar dupa ce userul bifeaza manual o alta adancime decat cea
// recomandata; se reseteaza la fiecare deschidere a tabelului, schimbare de
// domeniu sau de sursa (vezi reseteazaVizualizarea si listenerul de mai jos).
let adancimeAlesaManual = false;
```

### 3.3 — reset la deschidere/domeniu/sursă

`reseteazaVizualizarea()` e deja punctul unic apelat la pornire, la schimbarea
sursei (buton, import) ȘI la schimbarea domeniului (`schimbaDomeniu` o apelează).
Adaugă o singură linie chiar la începutul funcției:

```js
async function reseteazaVizualizarea() {
  adancimeAlesaManual = false;
  if (sursaActiva === "fixture") {
    ...
```

Mai rămâne trigger-ul „deschiderea tabelului" (comutare grilă→tabel), care NU
trece prin `reseteazaVizualizarea` — trece prin listenerul de reprezentare. În
blocul `cpEl.addEventListener("change", ...)`:

```js
if (preset.startsWith("vizualizare_") && ev.target.checked) {
  reprezentareActiva = preset.slice("vizualizare_".length);
  if (reprezentareActiva === "tabel_fluenta") adancimeAlesaManual = false;
  actualizeazaSubsectiuni();
  rerandeaza();
}
if (preset.startsWith("adancime_foto_") && ev.target.checked) {
  adancimeActiva = adancimeDinOptiune(preset.slice("adancime_foto_".length));
  adancimeAlesaManual = true;
  rerandeaza();
}
```

(Singura linie nouă per bloc: `if (reprezentareActiva === "tabel_fluenta") ...` și
`adancimeAlesaManual = true;`.) Două subtilități VERIFICATE în cod — nu le
„repara":

- Auto-selecția din 3.6 setează DOAR proprietatea `.checked`, fără
  `dispatchEvent` — intenționat: `.checked` setat din JS nu emite `change`,
  deci auto-selecția nu se auto-marchează drept alegere manuală și nu re-intră
  în `rerandeaza`. NU adăuga dispatch acolo.
- PRESETURILE, în schimb, emit `change` REAL (`aplicaControalePreset`:
  `el.dispatchEvent(new Event("change"))`, linia ~1217) — deci o adâncime
  venită dintr-un preset (inclusiv presetul default aplicat la pornire) trece
  prin listener și setează `adancimeAlesaManual = true`. E COMPORTAMENTUL
  DORIT: presetul e alegerea salvată a userului și bate recomandarea, până la
  următoarea schimbare de domeniu/sursă/deschidere a tabelului.

### 3.4 — funcția de marcaj CP

Adaugă imediat după `randeazaTabelFluenta` (după linia care închide funcția, cea
cu nota de fezabilitate existentă — NU o atinge):

```js
// Marcajul „(Recomandat)" langa optiunea de adancime castigatoare — informeaza,
// nu alege in locul userului. Recalculat la fiecare analiza pe tabel (domeniul
// sau sursa pot schimba recomandarea). Cand nicio adancime n-are celule bazate,
// adancime_recomandata e null si toate marcajele se golesc.
function actualizeazaMarcajeRecomandareAdancime(recomandare) {
  axaAdancime.optiuni.forEach((opt) => {
    const marcaj = cpEl.querySelector(`[data-marcaj-adancime="${opt.adancime}"]`);
    if (!marcaj) return;
    marcaj.textContent = opt.adancime === recomandare.adancime_recomandata ? " (Recomandat)" : "";
  });
}
```

### 3.5 — tabelul de recomandare, sub tabelul de evoluție

Adaugă imediat după `actualizeazaMarcajeRecomandareAdancime`:

```js
// Tabelul de comparatie a adancimilor candidate, randat SUB tabelul de
// evolutie. NU cheama replaceChildren pe container — randeazaTabelFluenta
// tocmai l-a populat pe container (vizEl) si nu trebuie sters, doar completat.
function randeazaTabelRecomandareAdancime(container, recomandare) {
  const titlu = document.createElement("h2");
  titlu.className = "viz3-tabel-recomandare-titlu";
  titlu.textContent = "Tabel pt. recomandare adâncime per fact";
  container.appendChild(titlu);

  const tabel = document.createElement("table");
  tabel.className = "viz3-tabel viz3-tabel-recomandare";

  const thead = document.createElement("thead");
  const randAntet = document.createElement("tr");
  ["Adâncime per fact", "Nr. calupuri", "Celule în tabel (subtable × calupuri)",
   "Celule bazate (≥50 răsp. și ≥2 zile)", "% bazate"]
    .forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      randAntet.appendChild(th);
    });
  thead.appendChild(randAntet);

  const tbody = document.createElement("tbody");
  recomandare.candidati.forEach((candidat) => {
    const tr = document.createElement("tr");
    if (candidat.adancime === recomandare.adancime_recomandata) {
      tr.classList.add("viz3-tabel-recomandat");
    }
    [
      candidat.adancime,
      candidat.poze,
      candidat.celule_total,
      candidat.contor.incredere_mare,
      `${Math.round(candidat.procent_bazate * 100)}%`,
    ].forEach((valoare) => {
      const td = document.createElement("td");
      td.textContent = String(valoare);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tabel.append(thead, tbody);
  container.appendChild(tabel);
}
```

Notă pinuită: titlurile de coloană sunt EXACT cele alese de user (Adâncime per
fact / Nr. calupuri) + cele propuse de asistent și acceptate implicit (celelalte
3). „Adncime"/„Nr calupuri" din mesajul userului au primit diacritice/punctuație
standard — dacă userul vrea alt text mot-a-mot, e schimbare de-o linie.

### 3.6 — apelul, în `analizeazaSiRandeaza`

Ramura `reprezentareActiva === "tabel_fluenta"` devine:

```js
if (reprezentareActiva === "tabel_fluenta") {
  const recomandare = motor.construiesteRecomandareAdancime({
    inregistrari,
    catalog,
    adancimi: axaAdancime.optiuni.map((o) => o.adancime),
    praguri,
  });
  if (
    !adancimeAlesaManual &&
    recomandare.adancime_recomandata !== null &&
    recomandare.adancime_recomandata !== adancimeActiva
  ) {
    adancimeActiva = recomandare.adancime_recomandata;
    const optiuneRecomandata = axaAdancime.optiuni.find((o) => o.adancime === adancimeActiva);
    const inputRecomandat = optiuneRecomandata
      ? cpEl.querySelector(`input[data-preset="adancime_foto_${optiuneRecomandata.id}"]`)
      : null;
    if (inputRecomandat) inputRecomandat.checked = true;
  }
  const model = motor.construiesteModelTabelFluenta({
    inregistrari,
    catalog,
    adancime: adancimeActiva,
    praguri,
  });
  randeazaTabelFluenta(vizEl, model, info);
  actualizeazaMarcajeRecomandareAdancime(recomandare);
  if (model.antete.length > 0) randeazaTabelRecomandareAdancime(vizEl, recomandare);
  return;
}
```

De ce `model.antete.length > 0` ca gardă: `B` (numărul de răspunsuri valide) NU
depinde de adâncime (se calculează înainte de orice logică de fereastră în
`construiesteModelTabelFluenta`) — deci dacă modelul afișat n-are poze, NICIUN
candidat nu are poze; tabelul de recomandare n-ar avea ce arăta.

Motorul rulează de 5 ori pe această ramură (4 candidați + 1 model afișat) —
acceptat, NU optimiza (vezi comentariul funcției din motor).

Recomandarea urmează AUTOMAT domeniul activ: `catalog` e variabila de modul pe
care `schimbaDomeniu` o reconstruiește la fiecare schimbare de opțiune/interval
în axa Domeniu. Nu există și NU trebuie scris niciun cod special pentru 11-20
sau intervale custom — dacă te trezești scriind unul, te-ai abătut de la plan.

## Pasul 4 — CSS

În `vizualizare3.css`, după blocul `.viz3-nota-dinamica`:

```css
.viz3-marcaj-recomandare {
  font-size: 11px;
  color: var(--viz3-accent, #2a6);
  font-weight: 600;
}

.viz3-tabel-recomandare-titlu {
  margin-top: 24px;
  font-size: 15px;
}

.viz3-tabel-recomandare tr.viz3-tabel-recomandat th,
.viz3-tabel-recomandare tr.viz3-tabel-recomandat td {
  color: var(--viz3-accent, #2a6);
  font-weight: 600;
}
```

(Span-ul de marcaj gol nu ocupă loc vizibil când nu e recomandat — `textContent`
gol, fără stil vizibil.) Tabelul reutilizează `.viz3-tabel` pentru borduri/padding
— nu are nevoie de `.viz3-tabel-scroll` (doar 5 coloane, încape fără scroll).

## Pasul 5 — `?v=36` → `?v=37` (toate cele 8 taguri din `vizualizare3.html`).

## Pasul 6 — TODO-uri în `CONTINUARE-proiect-MABP.md`

Adaugă, în secțiunea „Vor urma", lângă bullet-ul „Progres/direcție" (primul e
legat de el — pasul mare reduce tocmai suprapunerea care ascunde diferența de
comparat), următoarele DOUĂ bullet-uri:

```markdown
- **Pas independent de adâncime** — acum pasul dintre poze e fixat la o „celulă
  plină" (adâncime × facts/subtablă), deci adâncimi mici dau poze care se
  suprapun aproape total. Userul a întrebat (21.07.2026) dacă un pas MAI MARE,
  ales separat, n-ar da poze mai rare dar mai distincte — relevant mai ales pt.
  Progres/direcție (de mai sus), unde tocmai diferența dintre poze vecine e ce
  se compară. Decis: etapă separată, DUPĂ recomandatorul de fezabilitate
  (`PLAN-recomandator-fezabilitate.md`), nu în runda curentă.
- **Tabla adunării 1-10 (+)** — prioritatea userului e „tabla + sau × 1-10"
  (21.07.2026). Azi motorul mapează doar înmulțirea (`cheieCelulaDinInregistrare`,
  punct unic înlocuibil, regex `[*x×]`), iar catalogul are doar operația `mul`.
  De făcut: catalog `add` + extinderea mapării + opțiune în axa Domeniu. Un log
  de adunare azi cade în „necatalogate" → tabele goale, fără crash.
```

## Pasul 7 — SPECIFICATIE.md: actualizează secțiunea recomandatorului

Secțiunea „### Analiza de fezabilitate a granulației (recomandator; propus de
user)" descrie designul v1 (mărimi de calup × pe-întrebări/pe-sesiuni), depășit.
Înlocuiește paragraful ei cu:

```markdown
Rulată automat la fiecare randare a tabelului: rulează modelul tabelului pentru
fiecare adâncime candidat (2/5/10/20), numără etichetele de încredere pe celulele
subtablelor din toate pozele (rândul „Toată fereastra" exclus — medie derivată) și
recomandă adâncimea cu cel mai mare PROCENT de celule „încredere mare"; la
egalitate câștigă adâncimea mai mică; fără recomandare când nicio celulă nu e
bazată. Se uită NUMAI la etichete (n + zile), nu la scoruri — corectă prin
construcție. Afișare: bifa recomandată se auto-selectează (o dată, respectă
alegerea manuală ulterioară a userului până la următoarea deschidere/schimbare de
domeniu sau sursă) + marcaj „(Recomandat)" lângă eticheta ei; tabel de comparație
complet sub tabelul de evoluție, cu toate cele 4 adâncimi. Decis 21.07.2026
(implementat: `PLAN-recomandator-fezabilitate.md`). Recomandarea urmează
domeniul activ din axa Domeniu — orice interval de înmulțire (11-20, o
subtablă, custom a-b × c-d) merge automat, fără cod dedicat; prioritatea
absolută a userului rămâne tabla 1-10 (× sau, în viitor, +) — 11-20 a fost doar
experimentul care a produs jurnalul real. Tabla adunării cere catalog nou +
extinderea mapării fact→celulă (`cheieCelulaDinInregistrare`, azi doar
înmulțire) = etapă separată. Granulația calendaristică (zi/3 zile/săptămână) și
pasul independent de adâncime = etape următoare, nefăcute.
```

Nu atinge nimic altceva din spec.

## Testele — fișier NOU `tests/vizualizare3-recomandare.test.js`

(Neschimbat față de runda 1 — catalogul de test e sintetic și mic, indiferent de
domeniul real 1-10; convenția existentă, vezi `tests/vizualizare3-tabel-fluenta.test.js`.)

Pattern-ul din `tests/vizualizare3-tabel-fluenta.test.js`: `incarcaMotor()` cu
`new Function`, `afterEach` cu `delete`, helper `apasariFact(fact, n, durataSecunde, zile)`
copiat identic, `CATALOG` literal 12-13 × 1-2 (4 celule, 2 facts/subtablă — mic,
ușor de calculat de mână; nu trebuie să fie domeniul real).

`PRAGURI` de test: copiază literalul existent, DAR cu
`incredere: { n_minim_calcul: 3, n_incredere_mare: 6, zile_distincte_incredere_mare: 2 }`
— pragurile de încredere sunt PARAMETRU, nu constantă; valorile reduse permit
fixture-uri mici care ating toate cele 3 etichete. Comentează asta în fișier.

Capcane știute: toleranță float 1e-9 la TOATE procentele; NU `assert.equal` pe
împărțiri.

**Fixture principal** (în ordinea asta în array; B=14):
```js
...apasariFact("12*1=12", 8, 1.5, ["2026-07-01", "2026-07-02"]),
...apasariFact("12*2=24", 4, 1.5, ["2026-07-01", "2026-07-02"]),
...apasariFact("13*1=13", 2, 1.5, ["2026-07-03"]),
```

Valori așteptate pentru `adancimi: [2, 5]` (pre-calculate; NU le re-deriva):

| candidat | poze | celule_total | incredere_mare | incredere_mica | date_insuficiente | procent_bazate |
|---|---|---|---|---|---|---|
| A=2 (pas 4; momente 2,6,10,14) | 4 | 8 | 0 | 2 | 6 | 0 |
| A=5 (pas 10; momente 4,14) | 2 | 4 | 1 | 1 | 2 | 0,25 |

(De unde vin: A=2 — celula 12× are n=2/2/4/4 pe cele 4 poze → insuf/insuf/mica/mica;
13× are n=0/0/0/2 → toate insuf. A=5 — 12× la k=4: n=4 → mica; la k=14: n=9
(5×12*1 + 4×12*2), zile {07-01,07-02} → MARE; 13× n=0 și n=2 → insuf.)

`adancime_recomandata`: **5**.

**Fixture tie-break** (B=8):
```js
...apasariFact("12*1=12", 4, 1.5, ["2026-07-01", "2026-07-02"]),
...apasariFact("12*2=24", 4, 1.5, ["2026-07-01", "2026-07-02"]),
```
Cu `adancimi: [5, 10]`: ambii candidați au exact 1 poză („acum", B=8 < ambii pași),
12× cu n=8 ≥ 6 și zile 2 → mare; 13× → insuf. Ambele: celule_total=2, mare=1,
procent 0,5 → egalitate → `adancime_recomandata: 5` (mai mică).

Testele (7):
1. **Structura candidaților** pe fixture principal, `[2, 5]`: `tip`, ordinea
   candidaților = ordinea din `adancimi`, plus poze/celule_total/contor exact
   conform tabelului.
2. **Procente + recomandata**: procent_bazate 0 și 0,25 (toleranță 1e-9);
   `adancime_recomandata === 5`.
3. **Tie-break**: fixture-ul de egalitate → ambele 0,5 → recomandata 5.
4. **Consistență cu tabelul**: pentru fixture principal + adancime 5, numără
   direct etichetele din `construiesteModelTabelFluenta` (randuri `tip ===
   "subtabla"`) și verifică egalitatea cu `contor`-ul candidatului A=5 și
   `poze === antete.length` — încuie contractul „numărătoarea = exact ce vezi
   în tabel".
5. **Niciun bazat → null**: fixture principal cu `adancimi: [2]` →
   `adancime_recomandata === null` (candidatul există, cu contorul lui).
6. **Validări**: `adancimi: []` → throw „Recomandatorul are nevoie de un array
   nevid de adâncimi candidate."; `inregistrari: 42` → throw „Motorul are nevoie
   de un array de înregistrări."; `adancimi: [0]` → throw „Adâncimea fotografiei
   trebuie să fie un întreg pozitiv."
7. **B=0**: `inregistrari: []`, `[2, 5]` → ambii candidați cu poze 0,
   celule_total 0, procent 0; `adancime_recomandata === null`.

Suita completă: `node --test "tests/*.test.js"` → TOT verde (nimic existent nu se
atinge). Notă: `tests/equations-e3-e6.test.js` are un test flaky cunoscut
(generare aleatoare) — dacă pică DOAR el, re-rulează o dată.

## Verificarea pe date (criteriile falsificabile — OBLIGATORIE; DOUĂ rulări A + B)

Un singur script read-only în scratchpad, care încarcă `motor-analiza.js`,
`catalog-tabla-inmultirii.js`, `config-praguri.js`, `fixture-loguri-dummy.js`
REALE (pattern `new Function`) și rulează `construiesteRecomandareAdancime` de
DOUĂ ori, cu `adancimi: [2, 5, 10, 20]` și praguri `ConfigPraguriVizualizare3`
în ambele — se schimbă doar catalogul și înregistrările, exact ca în aplicație.

### A. Ținta PRIMARĂ — domeniul 1-10 (prioritatea userului; fixture dummy)

Jurnalul real NU are date pe 1-10 (0 din 652 înregistrări) — rularea A folosește
`inregistrari: FixtureLoguriDummyVizualizare3.construiesteFixture()` cu catalog
`construiesteCatalogInmultire({ aMin: 1, aMax: 10, bMin: 1, bMax: 10 })`.

Ținte EXACTE (rulate deja, 21.07.2026 — B=2260, identic pe toți candidații fiindcă
B nu depinde de adâncime):

| adâncime | poze | celule_total | incredere_mare | incredere_mica | date_insuficiente | procent |
|---|---|---|---|---|---|---|
| 2 | 113 | 1130 | 0 | 979 | 151 | 0 |
| 5 | 46 | 460 | 295 | 118 | 47 | 0,6413… |
| 10 | 23 | 230 | 179 | 30 | 21 | 0,7783… |
| 20 | 12 | 120 | 92 | 14 | 14 | 0,7667… |

`adancime_recomandata`: **10**.

### B. Ținta SECUNDARĂ — domeniul 11-20 × 1-20 (log REAL; dovada de generalitate)

Rularea B folosește
`C:/Users/I/Downloads/youlearn-salvare-log-activitate-2026-07-18-11-46.json`
(JSON-ul e direct un array de înregistrări brute) cu catalog
`construiesteCatalogInmultire({ aMin: 11, aMax: 20, bMin: 1, bMax: 20 })`.

Ținte EXACTE (rulate deja, 21.07.2026 — B=611):

| adâncime | poze | celule_total | incredere_mare | incredere_mica | date_insuficiente | procent |
|---|---|---|---|---|---|---|
| 2 | 16 | 160 | 0 | 66 | 94 | 0 |
| 5 | 7 | 70 | 2 | 45 | 23 | 2/70 = 0,0285… |
| 10 | 4 | 40 | 9 | 16 | 15 | 0,225 |
| 20 | 2 | 20 | 5 | 12 | 3 | 0,25 |

`adancime_recomandata`: **20**.

Dacă ORICARE din A sau B NU se reproduce exact → **STOP, nu raționaliza, nu
„repara" țintele** — raportează userului diferența.

## Verificarea în browser (schimbare de UI; pe sursa dummy, domeniul implicit 1-10)

1. `preview_start` `{name:"youlearn-local"}` → pagina modulului. Domeniul implicit
   e deja „Tabla 1-10 × 1-10" (activ în definitii-axe.js) — nu trebuie schimbat.
2. Sursa REALĂ (implicită) n-are date pe 1-10 → bifează explicit „Alege dummy log
   pe 8 săptămâni" (altfel tabelul arată gol și nu verifici nimic).
3. Bifează „Tabel % fluență" → lângă bifa recomandată (verifică: 10 răsp/fact,
   conform țintelor) apare „(Recomandat)"; bifa aia e și cea SELECTATĂ automat
   (radio bifat), fără să fi apăsat tu ceva.
4. Sub tabelul de evoluție apare „Tabel pt. recomandare adâncime per fact", cu 4
   rânduri (2/5/10/20) și 5 coloane; rândul adâncime 10 e evidențiat (accent);
   numerele din tabel corespund exact țintelor de mai sus.
5. Bifează manual adâncimea 20 → tabelul de evoluție se re-randează pe 20;
   tabelul de recomandare NU se schimbă (aceiași candidați); marcajul
   „(Recomandat)" rămâne pe 10 (nu se mută pe cea bifată de tine).
6. Comută pe Grilă, apoi înapoi pe Tabel → bifa sare ÎNAPOI pe 10 (auto-selecție
   re-declanșată la „deschiderea tabelului"), nu rămâne pe alegerea ta de la
   pasul 5.
7. Schimbă domeniul pe „Tabla 11-20 × 1-20" (dummy-ul are date și acolo) →
   recomandarea, marcajul și tabelul de comparație se recalculează pentru noul
   domeniu, iar bifa se auto-selectează din nou. Verificare de MECANICĂ — NU
   compara numerele cu țintele B (alea sunt pe logul REAL, nu pe dummy).
8. `read_console_messages` → zero erori. Screenshot ca dovadă.

## În AFARA scopului (NU face)

- Granulația calendaristică (zi/3 zile/săptămână) — etapa URMĂTOARE.
- Pasul independent de adâncime — etapa URMĂTOARE (Pasul 6, TODO în CONTINUARE).
- Tabla ADUNĂRII (+) — cere catalog nou (operație "add") + extinderea
  `cheieCelulaDinInregistrare`; etapa URMĂTOARE (Pasul 6, TODO în CONTINUARE).
  Un log de adunare azi → totul în „necatalogate" → B=0 → „fără date", fără
  crash — acceptat, nu trata special.
- Text explicativ sub tabelul de recomandare — userul îl scrie separat; nu genera
  paragrafe „ce înseamnă fiecare coloană".
- Rezumate numerice per bifă în CP (`viz3-bifa-rezumat`) — înlocuite de tabel;
  nu le adăuga înapoi.
- Criterii alternative (absolut, ponderat), praguri noi, plafonare pe acoperire.
- Orice optimizare de reuse între modelul afișat și candidați.
- `randeazaTabelFluenta`, nota de fezabilitate existentă, funcțiile v1 din motor
  (segmentare/serie) și testele lor — NEATINSE.

## Definition of done

- Fișiere modificate: `Vizualizare 3 - Claude/motor-analiza.js`,
  `Vizualizare 3 - Claude/definitii-axe.js`,
  `Vizualizare 3 - Claude/vizualizare3-bootstrap.js`,
  `Vizualizare 3 - Claude/vizualizare3.css`,
  `Vizualizare 3 - Claude/vizualizare3.html` (doar `?v`),
  `Vizualizare 3 - Claude/CONTINUARE-proiect-MABP.md` (doar bullet-ul TODO),
  `Vizualizare 3 - Claude/SPECIFICATIE.md` (doar secțiunea recomandatorului),
  `tests/vizualizare3-recomandare.test.js` (NOU). NIMIC altceva
  (`.claude/settings.local.json` și `node_modules/` nu se ating, nu se comit).
- `node --test "tests/*.test.js"` → toate verzi.
- Scriptul pe fixture dummy (domeniul 1-10) reproduce EXACT țintele pinuite.
- Verificarea browser parcursă, cu screenshot arătat userului.
- FĂRĂ commit până nu-l cere userul explicit.
