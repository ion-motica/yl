# PLAN — Trei moduri pentru săgețile de progres (Total / coloana Acum / toate subtablele)

Status: **specificație pt. implementare, 23.07.2026.** Reguli de lucru: `AGENTS.md`.
Implementator vizat: **Sonnet 5** — lucru mecanic (o axă declarativă, un helper de
săgeată, câteva clase CSS, o buclă atinsă). Nimic din motor (`motor-analiza.js`) nu se
schimbă: e strict **prezentare** peste modelul deja calculat. Reversibil integral
(stinge bifele / revert diff). Rigoarea pe corectitudine rămâne maximă chiar dacă
riscul e mic — de aceea criteriile de la §7 sunt exhaustive.

## 1. Scopul

Azi săgețile ↗/↘ apar **doar** pe rândul Total, dintr-o singură bifă. Le extindem la
trei moduri independente, comandate din trei bife, folosind **aceleași** săgeți:

- **Pt. rândul Total** — ca azi.
- **Pt. coloana Acum la subtablă** — o singură săgeată pe fiecare rând de subtablă
  (11×–20×), în coloana „acum".
- **Pe toate subtablele** — fiecare celulă afișată a fiecărei subtable.

Plus rearanjarea din CP (subtitlu + redenumire + două bife noi + un rând liber).

## 2. Comportamentul

**Reuniune:** o celulă capătă săgeată dacă *oricare* mod activ o prinde. Coloana „acum"
a unei subtable e prinsă și de „acum" și de „toate" → primește **o singură** săgeată (nu
două), rezolvat prin etichete pe aceeași săgeată (§4.2, §4.3).

**Ce rânduri:** „acum" și „toate" ating doar rândurile `tip === "subtabla"` (11×–20×).
Rândul Total (`tip === "total"`) e comandat **exclusiv** de „Pt. rândul Total". Rândul
„Ex. lucrate" nu intră în buclă (se construiește separat) → automat fără săgeți.

**Referința (regula de goluri):** pentru o celulă cu procent `cc`, referința `cs` =
**ultima celulă afișată din stânga**, sărind peste goluri / „—". Deja calculată în buclă
ca `procentAnteriorAfisat` (vezi §3) — o refolosim, nu scriem logică nouă.
- `cs` lipsește (prima celulă afișată a rândului) → **fără** săgeată.
- celulă goală / „—" → fără săgeată și nu e referință pentru nimeni.
- pe Total (fără goluri) `cs` = vecina imediată → **identic cu azi**.

**Pragul:** orice diferență `cc !== cs` de procent **rotunjit** (`Math.round(scor*100)`)
→ săgeată; `cc > cs` ↗ verde, `cc < cs` ↘ roșu; egal → nimic. Sub 1pp nu apare
(rotunjirea taie). Fără prag separat pe subtable.

**Exemplu explicit (rândul 12× din jurnalul real):** celule afișate
`46 · 46 · 46 · [gol] · [gol] · 48 · 48 · 51`.
- 15.07=46: prima afișată, `cs=null` → nimic.
- 16.07=46: `cs=46`, egal → nimic. 17.07=46: idem → nimic.
- 20.07=48: `cs`=17.07=46 (sare peste cele două goluri), `48>46` → ↗.
- 21.07=48: `cs`=20.07=48, egal → nimic.
- acum=51: `cs`=21.07=48, `51>48` → ↗.

În modul „toate" rândul 12× arată ↗ pe 20.07 și ↗ pe acum. În modul „acum" doar ↗-ul
de pe „acum".

## 3. Reperele din cod (verificate — nu se ghicește)

| Fapt | Locul |
| --- | --- |
| `rand.tip` = `"subtabla"` / `"total"` | `motor-analiza.js:612,617` |
| Coloana „acum" = ultima; marcată `antet.este_acum === true` | `motor-analiza.js:653-656` |
| `antete` și `celule` construite ambele din `momente` → aliniate 1:1 pe index | `motor-analiza.js:653-671` |
| Garda de afișare subtablă = `motor.casutaEDeAfisat(celula)` (eticheta `incredere_mare`) | `motor-analiza.js:578` |
| `procentAnteriorAfisat` = ultima celulă afișată, golurile sărite; reset per rând | `vizualizare3-bootstrap.js:2081,2112-2113` |
| Săgeata Total azi (de înlocuit) | `vizualizare3-bootstrap.js:1968`, apel `:2119` |
| Toate `td` din tbody sunt deja `position: relative` (pt. bară) | `vizualizare3.css:831-835` |
| Reveal săgeți azi: clasa `viz3-arata-sageti` | `vizualizare3.css:954-957`, JS `:2381` |

## 4. Modificări, fișier cu fișier

### 4.1 `definitii-axe.js` — axa `progres_tabel`, câmpul `optiuni` (`:309-312`)

Redenumește Total și adaugă două bife (toate trei `activa: true`), **înaintea** barei:

```js
        optiuni: [
          { id: "sageti_total", eticheta: "Pt. rândul Total", activa: true },
          { id: "sageti_acum", eticheta: "Pt. coloana Acum la subtablă", activa: true },
          { id: "sageti_toate", eticheta: "Pe toate subtablele", activa: true },
          { id: "bara_verticala", eticheta: "Bară de progres verticală", activa: false },
        ],
```

Cheia de preset a Total-ului rămâne `progres_tabel_sageti_total` (id neschimbat) → nu
strică preseturile salvate. Cele două noi: `progres_tabel_sageti_acum`,
`progres_tabel_sageti_toate`.

### 4.2 `vizualizare3-bootstrap.js`

**(a) Starea (`:2369`):** înlocuiește flag-ul unic cu trei:

```js
  let progresTabelSagetiTotal = true;
  let progresTabelSagetiAcum = true;
  let progresTabelSagetiToate = true;
```

(șterge vechiul `let progresTabelSageti = true;`)

**(b) `aplicaOptiuniProgresTabel` (`:2381`):** înlocuiește linia unică de toggle cu trei:

```js
    tabelFluentaAtual.classList.toggle("viz3-arata-sageti-total", progresTabelSagetiTotal);
    tabelFluentaAtual.classList.toggle("viz3-arata-sageti-acum", progresTabelSagetiAcum);
    tabelFluentaAtual.classList.toggle("viz3-arata-sageti-toate", progresTabelSagetiToate);
```

**(c) Săgeata: un singur loc de fabricat.** Înlocuiește **integral** funcția
`adaugaSagetiTotal` (`:1965-1982`) cu:

```js
  // Sageata de directie pentru O celula: compara procentul rotunjit `cc` cu
  // referinta `cs` (ultima celula AFISATA din stanga, deja sarita peste goluri de
  // apelant). `cs === null` (prima celula afisata) sau `cc === cs` -> nicio sageata.
  // Etichetele de mod (--total/--acum/--toate) decid, prin CSS, care bifa o arata;
  // celula "acum" a unei subtable primeste O SINGURA sageata cu doua etichete, deci
  // "acum" + "toate" pornite nu dubleaza. Singurul loc unde se naste o sageata.
  function adaugaSageataCelula(td, { cc, cs, tipRand, esteAcum }) {
    if (cs === null || cc === cs) return;
    const urca = cc > cs;
    const sageata = document.createElement("span");
    sageata.className = urca ? "viz3-sageata-sus" : "viz3-sageata-jos";
    sageata.textContent = urca ? "↗" : "↘";
    if (tipRand === "total") {
      sageata.classList.add("viz3-sageata--total");
    } else if (tipRand === "subtabla") {
      sageata.classList.add("viz3-sageata--toate");
      if (esteAcum) sageata.classList.add("viz3-sageata--acum");
    }
    td.appendChild(sageata);
  }
```

**(d) Bucla de randare (`:2083-2119`):** adaugă `idx` la `forEach`, cheamă săgeata în
blocul `if (afisata)` **înainte** de reasignarea referinței, și **șterge** apelul
post-buclă `adaugaSagetiTotal`:

```js
      rand.celule.forEach((celula, idx) => {
        // ...corpul existent (td, procentCurent, afisata, bara) neschimbat...
        if (afisata) {
          td.appendChild(construiesteBaraProgres(procentCurent, procentAnteriorAfisat));
          adaugaSageataCelula(td, {
            cc: procentCurent,
            cs: procentAnteriorAfisat,
            tipRand: rand.tip,
            esteAcum: model.antete[idx]?.este_acum === true,
          });
          procentAnteriorAfisat = procentCurent;
        }
        tr.appendChild(td);
      });
      // (fostul `if (rand.tip === "total") adaugaSagetiTotal(...)` de la :2119 - ELIMINAT.)
```

`model` și `model.antete` sunt în scope (parametrul funcției de randare); `idx` aliniază
`celule[idx]` cu `antete[idx]` (§3).

**(e) CP: `randeazaControlProgresTabel` (`:2394-2471`).** Rescrie **integral** funcția
(partea de bară + slidere rămâne identică, doar reașezată sub grupul de săgeți cu rândul
liber între ele):

```js
  function randeazaControlProgresTabel(grup, axa) {
    const optSagetiTotal = axa.optiuni.find((o) => o.id === "sageti_total");
    const optSagetiAcum = axa.optiuni.find((o) => o.id === "sageti_acum");
    const optSagetiToate = axa.optiuni.find((o) => o.id === "sageti_toate");
    const optBara = axa.optiuni.find((o) => o.id === "bara_verticala");

    // O bifa de sageti: seteaza starea prin `aplicaStare` si reaplica clasele
    // (fara re-randare). dataset.preset = progres_tabel_<id> -> intra in sertarul
    // localStorage al subsectiunii; la restaurare sistemul reemite `change`, deci
    // listenerul de aici prinde valoarea.
    function faBifaSageti(opt, aplicaStare) {
      const rand = document.createElement("label");
      rand.className = "viz3-optiune";
      const bifa = document.createElement("input");
      bifa.type = "checkbox";
      bifa.checked = opt.activa === true;
      bifa.dataset.preset = `progres_tabel_${opt.id}`;
      aplicaStare(bifa.checked);
      const text = document.createElement("span");
      text.textContent = opt.eticheta;
      bifa.addEventListener("change", () => {
        aplicaStare(bifa.checked);
        aplicaOptiuniProgresTabel();
      });
      rand.append(bifa, text);
      return rand;
    }

    const subtitluSageti = document.createElement("div");
    subtitluSageti.className = "viz3-optiuni-subtitlu";
    subtitluSageti.textContent = "Afișează săgeți";

    const randTotal = faBifaSageti(optSagetiTotal, (v) => (progresTabelSagetiTotal = v));
    const randAcum = faBifaSageti(optSagetiAcum, (v) => (progresTabelSagetiAcum = v));
    const randToate = faBifaSageti(optSagetiToate, (v) => (progresTabelSagetiToate = v));

    // Rand liber intre grupul de sageti si bifa barei (cerinta).
    const spatiu = document.createElement("div");
    spatiu.className = "viz3-spatiu-optiuni";

    const randBara = document.createElement("label");
    randBara.className = "viz3-optiune";
    const bifaBara = document.createElement("input");
    bifaBara.type = "checkbox";
    bifaBara.checked = optBara.activa === true;
    bifaBara.dataset.preset = `progres_tabel_${optBara.id}`;
    progresTabelBaraActiva = bifaBara.checked;
    const textBara = document.createElement("span");
    textBara.textContent = optBara.eticheta;
    randBara.append(bifaBara, textBara);

    const reglaje = axa.reglaje ?? [];
    const gasesteReglaj = (id) => reglaje.find((r) => r.id === id);

    const latime = randeazaSlider(gasesteReglaj("latime"), (v) => { progresTabelLatime = v; aplicaOptiuniProgresTabel(); }, axa.id);
    const pozitie = randeazaSlider(gasesteReglaj("pozitie"), (v) => { progresTabelPozitie = v; aplicaOptiuniProgresTabel(); }, axa.id);
    const inaltime = randeazaSlider(gasesteReglaj("inaltime"), (v) => { progresTabelInaltime = v; aplicaOptiuniProgresTabel(); }, axa.id);
    const opacitateRosu = randeazaSlider(gasesteReglaj("opacitate_rosu"), (v) => { progresTabelOpacitateRosu = v; aplicaOptiuniProgresTabel(); }, axa.id);

    // Sliderele barei n-au sens cat timp bara e oprita - dezactivate.
    const sliderele = [latime.slider, pozitie.slider, inaltime.slider, opacitateRosu.slider];
    sliderele.forEach((el) => (el.disabled = !progresTabelBaraActiva));
    bifaBara.addEventListener("change", () => {
      progresTabelBaraActiva = bifaBara.checked;
      sliderele.forEach((el) => (el.disabled = !progresTabelBaraActiva));
      aplicaOptiuniProgresTabel();
    });

    grup.append(
      subtitluSageti, randTotal, randAcum, randToate,
      spatiu,
      randBara, latime.rand, pozitie.rand, inaltime.rand, opacitateRosu.rand
    );
  }
```

### 4.3 `vizualizare3.css`

**(a)** Înlocuiește regula de reveal unică (`:952-957`) cu una pe trei clase, ancorată pe
etichetele săgeților (comentariul de deasupra actualizat):

```css
/* Bifele "Afișează săgeți" (5.2): săgețile rămân mereu în DOM (adaugaSageataCelula
   le construiește la randare pentru fiecare celulă eligibilă), doar vizibilitatea
   comută. O săgeată se vede dacă modul ei e pornit; "acum" are două etichete, deci
   se aprinde din oricare din cele două bife (reuniune), fără dublură. */
.viz3-tabel.viz3-arata-sageti-total .viz3-sageata--total,
.viz3-tabel.viz3-arata-sageti-acum .viz3-sageata--acum,
.viz3-tabel.viz3-arata-sageti-toate .viz3-sageata--toate {
  display: block;
}
```

Regulile de bază `.viz3-sageata-sus, .viz3-sageata-jos { display: none; ... }` (`:942-950`)
și culorile/mărimile (`:962-974`) rămân — subtablele moștenesc automat același stil
verde↗/roșu↘. Nu adăuga `position: relative` pe celule: toate `td` din tbody îl au deja
(`:831-835`). Vechea regulă `.viz3-tabel-total td { position: relative }` (`:938`) devine
redundantă dar inofensivă — las-o.

**(b)** Adaugă cele două clase mici de CP (lângă `.viz3-subsectiune-titlu`, `:185`):

```css
.viz3-optiuni-subtitlu {
  font-size: 12px;
  font-weight: 600;
  color: var(--viz3-text);
  margin: 4px 0;
}

.viz3-spatiu-optiuni {
  height: 10px;
}
```

### 4.4 `vizualizare3.html` — cache busting

Modificate: `.css`, `definitii-axe.js`, `.js`. Ridică `?v=42` → `?v=43` pe cele trei
include-uri (`:7,:17,:21`). Fără asta, browserul userului servește cod vechi și pare că
nu merge (vezi `AGENTS.md` / regula de cache busting).

## 5. „Un singur loc" (cerința ta)

Săgeata se naște într-o **singură** funcție (`adaugaSageataCelula`, §4.2c): glif, culoare
(prin `viz3-sageata-sus/jos`), poziție (CSS `left:-0.6em`), prag (`cc !== cs`). O
**singură** buclă decide ce celule primesc săgeată, cu referința deja existentă
(`procentAnteriorAfisat`). Care bifă arată ce → trei reguli CSS. Ca să schimbi cândva
săgețile (alt glif, alt prag, altă culoare) → atingi `adaugaSageataCelula` și cele trei
reguli, nicăieri altundeva. Vechea a-doua-numărare din `adaugaSagetiTotal` dispare.

## 6. Pre-mortem / riscuri

- **Aliniere `antete`↔`celule` pe index.** Ambele din `momente` (`motor-analiza.js:653-671`)
  → 1:1. Dacă s-ar desincroniza vreodată, săgeata „acum" ar cădea pe altă coloană —
  prins de criteriul 3 (§7).
- **`procentAnteriorAfisat` ca referință unică.** Reset per rând (`:2081`), actualizat
  doar la `afisata` (`:2113`). Pe Total = vecin imediat = **identic cu azi** (criteriul 5).
  Alternativa (a doua trecere post-buclă, ca azi) a fost respinsă: ar rescana golurile și
  ar duplica logica — exact ce cere userul să evităm.
- **Reuniune fără dublură.** O singură săgeată cu două etichete pe „acum" (criteriul 4).
  Alternativa „o săgeată per mod" ar pune două săgeți suprapuse când „acum"+„toate" sunt
  pornite — respinsă.
- **Ștergerea `adaugaSagetiTotal`.** Un singur apelant (`:2119`), verificat; după ștergere,
  grep `adaugaSagetiTotal` = 0 apariții.
- **Clasa veche `viz3-arata-sageti`.** Se **înlocuiește** peste tot (CSS `:954-955`, JS
  `:2381`), nu se lasă regulă orfană. Verificare: grep `viz3-arata-sageti` întoarce numai
  variantele `-total` / `-acum` / `-toate`.
- **Densitate vizuală implicită.** Cu toate trei pornite, la deschidere toată tabela de
  subtable e presărată cu ↗/↘ mici. E decizia de produs a userului (bife default bifate),
  nu un bug; fiecare mod se stinge separat.

## 7. Criterii de acceptare (verificabile în browser)

Pe jurnalul real 11-20 (ca în tabelul curent). Mecanica e domeniu-independentă; pe 1-10
s-ar verifica pe fixture-ul dummy (jurnalul real n-are date 1-10).

1. **Default** (fără preset salvat): cele 3 bife de săgeți bifate, bara nebifată; sub
   titlul subsecțiunii apare „Afișează săgeți", apoi cele 3 bife, un rând liber, apoi
   „Bară de progres verticală" + slidere. Rândul Total arată exact săgețile de azi.
2. **Doar „Pt. coloana Acum"** (celelalte două oprite): săgeți DOAR în coloana „acum", cel
   mult una pe rând de subtablă; nicăieri altundeva; Total fără săgeți.
3. **Doar „Pe toate subtablele"**: săgeți pe toate celulele afișate ale subtablelor,
   inclusiv „acum". Pe 12× (§2): ↗ pe 20.07 (vs 17.07=46, golurile sărite) și ↗ pe acum
   (vs 21.07=48); nimic pe 21.07 (48=48). Total fără săgeți.
4. **„acum" + „toate" ambele pornite**: celula „acum" a unei subtable arată EXACT o
   săgeată (inspectează DOM — un singur `<span>`).
5. **Doar „Pt. rândul Total"**: identic cu comportamentul de azi (aceleași săgeți, aceleași
   poziții).
6. **Goluri / prima celulă**: prima celulă afișată a unui rând și celulele goale/„—" nu au
   săgeată; o zi fără test nu rupe comparația (referința sare golul).
7. **Fără re-randare**: comutarea oricărei bife schimbă doar clase (fără recitirea sursei).
   Schimbarea adâncimii/domeniului re-randează și **păstrează** bifele.
8. **Persistență**: reîncărcarea paginii păstrează cele 3 bife (localStorage).
9. **Static check înainte de browser**: `node --check` pe `vizualizare3-bootstrap.js` și pe
   `definitii-axe.js` trece (vezi `AGENTS.md`).

## 8. Legături

- `PLAN-bara-progres-tabel.md` — §7 (referința cu goluri) și integrarea 5.2 pe care se
  clădește asta; sliderele/`aplicaOptiuniProgresTabel` de acolo.
- `PROPUNERE-sageti-progres.md` — de ce progresul mic e cinstit doar rotunjit/agregat
  (fundalul deciziei de prag).
- `CONTRACT-PRESETURI.md` — cum se leagă bifele noi de sertarul localStorage.
- `AGENTS.md` — cache busting, `node --check`, diff minim.
