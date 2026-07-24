# Standard — setare opțiuni default cu butoane „md / make default"

> Tipar reutilizabil pentru a marca **ce opțiune dintr-o axă** (grup de radio/bife)
> este defaultul persistent care se încarcă la refresh, prin câte un buton mic „md"
> lângă fiecare opțiune.
>
> **Când se aplică (trigger):** când userul cere un *default* pe un set de opțiuni cu
> buton „make default", întreabă-l întâi dacă vrea **acest standard**, apoi aplică-l
> exact ca aici. Referință din `AGENTS.md`.

## Regula-nucleu (modelul de comportament)

1. Fiecare opțiune **funcțională** primește un buton mic lângă ea. Butonul stă **în afara**
   label-ului opțiunii, ca apăsarea lui să **nu** bifeze opțiunea.
2. Butonul opțiunii care e **default** arată eticheta **„default"** (plin, evidențiat); la
   click nu face nimic (a făcut deja). Celelalte arată **„md"**, tooltip „make default".
3. Apăsarea **„md"** → acea opțiune devine defaultul persistent și **se salvează**. NU comută
   ce e bifat/afișat acum (poți marca defaultul fără să schimbi ce vezi).
4. **Bifarea** unei opțiuni = doar o **vezi acum** (temporar). NU schimbă defaultul, NU se
   salvează, **se pierde la refresh**.
5. La încărcare (refresh) se încarcă **mereu defaultul marcat**, **niciodată ultima bifă**.
6. Default inițial (nimic salvat încă) = opțiunea marcată `activa: true` în definiții. Există
   **mereu exact un** buton „default".
7. Opțiunile **dezactivate** nu primesc buton.
8. Persistență: **o cheie localStorage per axă**.

## De ce așa (raționament)

Modelul mental al userului pentru default-uri e simplu și constant: **defaultul marcat se
respectă, punct** — nu există o regulă concurentă „ține minte ultima bifă". O bifare e
tranzitorie; doar butonul „md" marchează defaultul. O variantă în care „bifarea devine și
default" (numită intern „Model A") a fost **respinsă explicit** de user fiindcă contrazice
exact regula de mai sus. Vezi discuția din memorie: `feedback_youlearn_default_marcat_nu_ultima_bifa`.

## Coliziune de nume (atenție)

„make default" se suprapune cu **„Make default"-ul de la preseturi** (P din MABP), care alege
ce *preset* se aplică automat (eticheta „Default preset:"). Sunt două lucruri la niveluri
diferite: presetul = un pachet de bife pe o subsecțiune; „md" = o singură bifă dintr-o axă.
Dacă cele două coexistă vizibil, **dezambiguizează vocabularul**.

## Implementare de referință (Vizualizare 3, axa „Reprezentare")

- Fișier logică: `Vizualizare 3 - Claude/vizualizare3-bootstrap.js`.
- Cheie localStorage: `viz3_reprezentare_default`.
- Persistență: `citesteReprezentareDefaultSalvata` / `salveazaReprezentareDefault`
  (mirror după blocul Domeniului).
- Init defaultului: `reprezentareDefault` = salvatul valid, altfel opțiunea `activa`.
- Butoane: `construiesteButonDefault`, `actualizeazaUnButonDefault`, `actualizeazaButoaneDefault`,
  `faDefaultReprezentare` (early-return dacă opțiunea e deja default), într-un `Map` optId→buton.
- Gardă randare buton: `if (axa === axaVizualizare && !opt.dezactivata)`.
- Gardă bifare inițială: ramura `else if (axa === axaVizualizare)` din bucla de opțiuni
  (bifa pornește din defaultul salvat, nu din `activa`).
- Listener de `change`: bifarea setează doar `reprezentareActiva` (ce vezi) — **NU** apelează
  `faDefaultReprezentare` (asta ar readuce „Model A"-ul respins).
- CSS: `.viz3-rand-cu-default` (rândul), `.viz3-buton-default`, `.viz3-buton-default--activ`
  (defaultul curent: plin, `cursor: default`). Mirror după `.viz3-buton-slidere`.

## Scalare (dacă se extinde la mai multe axe)

Acum e cablat pe o singură axă (`axa === axaVizualizare`), deliberat („testăm și extindem după").
Generalizarea la „orice axă poate avea bife-default persistente" e o refactorizare mecanică:

- cheie per-axă (`viz3_default_<axaId>`), un `Map` axaId→optId în loc de o variabilă unică;
- flag declarativ în `definitii-axe.js` (ex. `default_memorabil: true`) în locul comparației
  `axa === axaVizualizare`;
- helperi cheiaţi pe (axaId, optId).

Două decizii de care depinde generalizarea:

1. **(rezolvat)** Bifarea e tranzitorie — nu setează niciodată defaultul. Regula 4/5 de mai sus.
2. **Precedența preset vs. md** când axa e într-o subsecțiune acoperită de un preset: presetul
   („defaultul de capitol") vs. md-ul unei bife („defaultul de sub-capitol"). Se decide printr-o
   singură variabilă cu nume explicit, `defaultul_de_capitol_overrides_defaultul_de_subcapitol`
   (azi *de facto* presetul se aplică ultimul → capitolul câștigă). **Nu se aplică** cât timp axa
   cu „md" stă **în afara** oricărui preset (cazul actual al Reprezentării).

## Verificare (cum confirmi că merge)

Pe file:// în panoul intern, `window.location.reload()` e **no-op** — nu re-execută scripturile;
forțează încărcare reală prin **bump de `?v=N`** (vezi `project_youlearn_cache_busting`). Probele
minime: (a) fresh → default = `activa`, buton „default" pe ea; (b) bifezi cealaltă opțiune → NU se
scrie în localStorage, defaultul rămâne pe prima; (c) reload real → se încarcă defaultul, nu bifa;
(d) „md" pe cealaltă → se salvează, reload real → se încarcă ea.
