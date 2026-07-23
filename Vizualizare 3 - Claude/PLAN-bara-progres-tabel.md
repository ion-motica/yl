# PLAN — Bară de progres verticală în „Tabel % fluență" (cerința 2.1)

Status: **specificație pt. aprobare, 23.07.2026.** Reguli de lucru: `AGENTS.md`.
Implementator vizat: **Sonnet 5** (lucru mecanic — geometrie + CSS + două controale
declarative, fără decizii de arhitectură noi). Nimic din motor (`motor-analiza.js`)
nu se atinge: e strict **prezentare** peste modelul deja calculat.

## 1. Scopul

În fiecare celulă a tabelului „% fluență per subtablă", în spatele numărului, punem o
**bandă verticală** care arată, față de coloana precedentă (ziua/calupul din stânga),
cât s-a câștigat sau s-a pierdut — și, prin grila de separatoare până la 100%, cât mai
are omul de parcurs până la măiestrie. Plus două bife de comutare și trei slidere de
reglaj, în CP la „5.2 Opțiuni pt Tabel % fluență".

Analogie de citire (exemplul din Excel al userului, 46% → 48% → 44%):
- **46%** (prima celulă din rând, fără referință la stânga): toată verde până la 46%.
- **48%** (cs=46, cc=48, urcă): verde până la 46% + **portocaliu** de la 46% la 48%.
- **44%** (cs=48, cc=44, coboară): verde până la 44% + **roșu 50%** de la 44% la 48%.

## 2. Unde apare bara

- **Rândurile de subtablă** (11×…20×) și **rândul Total** („Toată fereastra"). NU pe
  rândul „Ex. lucrate" (sunt numărători, nu procente — `construiesteRandExercitii`,
  `vizualizare3-bootstrap.js:1936`), NU pe antet, NU pe coloana de etichete.
- **Doar în celulele care afișează efectiv un procent.** Celulele goale sau „—" au un
  scor în model, dar l-am ascuns intenționat fiindcă nu e de încredere
  (`casutaEDeAfisat` / etichetă, `vizualizare3-bootstrap.js:2033` și `:1914`) — o bară
  peste o valoare ascunsă ar contrazice garda. Rândul Total afișează mereu procent, deci
  are mereu bară.

## 3. Geometria barei (partea din DATE, calculată la randare)

Notații: `cc` = procentul **rotunjit** al celulei curente (cel scris în celulă,
`Math.round(scor*100)`); `cs` = procentul rotunjit al celulei de **referință** din
stânga (vezi §7 pentru „care celulă"). Scala e fixă **0–100%**, ancorată **jos**
(0% = baza celulei, 100% = vârf). Banda se compune din două segmente stivuite de jos:

| Caz | S1 (verde) | S2 (deasupra lui S1) |
| --- | --- | --- |
| `cs` lipsește (prima celulă a rândului) | înălțime = `cc` | — (fără strat colorat) |
| `cc == cs` | înălțime = `cc` | — |
| `cc > cs` (urcă) | înălțime = `cs` | portocaliu, înălțime = `cc − cs` |
| `cc < cs` (coboară) | înălțime = `cc` | roșu la 50% opacitate, înălțime = `cs − cc` |

Formulare compactă, echivalentă: verde = `min(cc, cs)`; S2 acoperă intervalul de la
`min(cc,cs)` la `max(cc,cs)`, portocaliu dacă `cc>cs`, roșu-50% dacă `cc<cs`. Vârful
umplerii = `max(cc, cs)`.

**Calcul explicit pe exemplul 44% (cs=48, cc=44):** `cc<cs` → S1 verde = `cc` = 44% din
înălțimea celulei; S2 = `cs − cc` = `48 − 44` = 4% din înălțime, roșu 50%, așezat de la
44% la 48%. Vârf umplere = `max(44,48)` = 48%. Restul de la 48% la 100% rămâne gol.

**Grila de separatoare:** 10 linii negre subțiri (~1px) la fiecare 10% din înălțimea
**totală** a benzii (0,10,…,100), desenate peste umplere, sub text, pe **toată**
înălțimea — inclusiv peste zona goală de deasupra umplerii, ca să se vadă câte trepte
mai sunt până la 100%. „Pline sau goale" = pătrățelele grilei sub umplere sunt colorate
(verde/portocaliu/roșu), cele de deasupra sunt albe. Grila se întinde pe lățimea benzii,
nu pe toată celula. Implementare sugerată: `repeating-linear-gradient` peste bandă (nu 10
noduri DOM).

Culori: verde, portocaliu, roșu — de aliniat cu variabilele de temă existente din
`vizualizare3.css` (aceleași nuanțe ca stările din grilă, dacă se potrivesc); roșul cu
`opacity: 0.5` doar pe S2-ul de pierdere.

## 4. Controalele noi în CP (secțiunea „5.2 Opțiuni pt Tabel % fluență")

O singură axă declarativă nouă în `definitii-axe.js`, cu `subsectiune: "tabel_optiuni"`,
adăugată **după** axa `adancime_foto` (`definitii-axe.js:281`), ca să apară jos în 5.2.
Ordinea vizuală cerută: bifă săgeți, bifă bară, apoi cele trei slidere.

Două bife (`tip_selectie: "multipla"` → randate ca checkbox de calea existentă,
`vizualizare3-bootstrap.js:1676`):

| Bifă (etichetă) | Implicit | Efect |
| --- | --- | --- |
| „Afișează săgeți progres pe rândul Total" | **bifat** (păstrează comportamentul de azi) | comută clasa `viz3-arata-sageti` pe tabel |
| „Bară de progres verticală" | **nebifat** | comută clasa `viz3-arata-bara` pe tabel |

Patru slidere (`reglaje`, reutilizând tiparul `tip:"slider"` de la `folii`,
`definitii-axe.js:247`):

| Slider (etichetă) | min | max | pas | implicit | unitate |
| --- | --- | --- | --- | --- | --- |
| „Lățime bandă" | 5 | 100 | 1 | 100 | % (din lățimea celulei) |
| „Poziție bandă (0 stânga · 100 dreapta)" | 0 | 100 | 1 | 50 | % |
| „Înălțime rând" | 24 | 250 | 2 | 90 | px |
| „Opacitate roșu (pierdere)" | 0 | 100 | 1 | 50 | % |

Implicitele sunt puncte de plecare, de reglat din slidere. Notă de lizibilitate (calcul
pe factori): o dungă de delta `d` pp are grosime `H·d/100`. La `H=26px` (rândul de azi:
font 14px + padding 4px, `vizualizare3.css:755`) un delta de 2pp = 0,52px → invizibil; la
`H=90px` = 1,8px; la `H=150px` = 3px, vizibil. De aceea înălțimea e slider, nu fixă:
deltele mici (2–4pp) se văd doar la rânduri înalte, iar userul reglează cât vrea.

Al 4-lea slider controlează **doar** opacitatea segmentului S2 de pierdere (roșu); S2 de
câștig (portocaliu) rămâne mereu opac. La extrema `0%` roșul devine complet invizibil
(`opacity:0` — dunga de pierdere dispare, rămâne doar verdele de dedesubt); la `100%`
roșul e complet opac. Implicit `50%`, ca în geometria din §3.

## 5. Titlul tabelului (cerința 4)

Schimbă titlul din `vizualizare3-bootstrap.js:1985`:

```
"% fluență per subtablă — …"   →   "Tabel % fluență per subtablă (serie calupuri) — …"
```

Partea dinainte de „—" devine identică cu eticheta bifei de reprezentare din „5 ·
Vizualizare" (`definitii-axe.js:158`, deja „Tabel % fluență per subtablă (serie
calupuri)"). Restul șirului (`${model.eticheta_domeniu} · ${model.adancime} răsp/fact`)
rămâne neschimbat.

## 6. Cum se leagă (integrare, fără recalcularea modelului)

Cheia: aceste controale sunt **pur vizuale** — nu schimbă modelul
(`construiesteModelTabelFluenta`). Deci NU trec prin `rerandeaza()`
(`vizualizare3-bootstrap.js:2345`), care ar recalcula toată analiza la fiecare pixel de
slider. În schimb:

1. **Geometria din date** (S1/S2/culoare/grilă) se construiește o dată, la randare, în
   bucla de celule din `randeazaTabelFluenta` (`vizualizare3-bootstrap.js:2028`): pentru
   fiecare `<td>` eligibil, adaugă un strat `<div class="viz3-bara">` cu S1, S2 și grila,
   plus numărul deasupra (z-index peste bară). Celula devine `position: relative`.
2. **Reglajele globale** (lățime, poziție, înălțime) se aplică prin **variabile CSS** pe
   tabel (`--viz3-bara-latime`, `--viz3-bara-pozitie`, `--viz3-bara-inaltime-rand`),
   actualizate de un listener `input` pe fiecare slider — fără re-randare.
3. **Comutatoarele** (săgeți/bară) = adăugare/scoatere de clasă pe tabel, la `change`.
   Săgețile rămân mereu în DOM (`adaugaSagetiTotal`, `:1954`); clasa `viz3-arata-sageti`
   le arată/ascunde prin CSS. La fel bara: mereu construită, arătată doar sub
   `viz3-arata-bara`. Înălțimea de rând mărită se aplică **doar** când bara e activă
   (`.viz3-tabel.viz3-arata-bara td { height: … }`), ca tabelul să rămână compact când
   bara e oprită.
4. **Re-randarea (ex. schimbarea adâncimii) nu pierde reglajele:** starea celor 5
   controale se ține în variabile JS (ca `adancimeActiva`) și se re-aplică pe tabelul nou
   la finalul lui `randeazaTabelFluenta`. Listenerele actualizează starea + tabelul viu;
   randarea citește starea.
5. **Persistență:** controalele stau în subsecțiunea `tabel_optiuni`, care are deja o
   zonă de preseturi (`vizualizare3-bootstrap.js:1648`). Dându-le chei `dataset.preset`
   (`progres_tabel_sageti_total`, `progres_tabel_bara_verticala`, `progres_tabel_latime`,
   `progres_tabel_pozitie`, `progres_tabel_inaltime`, `progres_tabel_opacitate_rosu` —
   convenția `${axa.id}_${…}`, `:1682`), valorile se salvează/restaurează automat în
   localStorage. La restaurare sistemul emite `input`/`change` (`:1221`), deci
   listenerele noastre prind valorile. Vezi `CONTRACT-PRESETURI.md`.

Notă de refactor mic: azi `reglaje` se randează doar în `randeazaControlFolii`, iar
fabrica de slider (`:771`) codifică prefixul `folii_`. Pt. 5.2, calea generică de axă
(`:1674`) trebuie să randeze și `axa.reglaje` (dacă există), cu un builder de slider ce
ia prefixul din `axa.id`. E un mic factor comun, nu logică nouă.

## 7. Cazuri-limită (deciziile userului)

- **Referința `cs` cu goluri (rând de subtablă):** `cs` = **prima celulă ne-goală din
  stânga** (sărim peste coloanele goale/„—"), nu neapărat coloana imediat vecină. O zi
  fără test nu rupe comparația. (Diferă intenționat de săgețile Total, care iau strict
  vecinul imediat, `:1958` — dar Total n-are goluri, deci acolo coincide.)
- **Fără celulă ne-goală la stânga** (prima celulă afișată a rândului, ori prima
  coloană): fără S2 — doar verde până la `cc`.
- **`cc == cs`:** fără S2 — doar verde până la `cc` (bara se potrivește cu numărul scris;
  nicio dungă când celula arată același procent).
- **Valori rotunjite, nu scor brut:** bara folosește `Math.round(scor*100)`, ca numărul
  din celulă și ca săgețile. Consecință asumată: progresul sub 1pp nu apare ca dungă (e
  și sub-pixel la orice înălțime rezonabilă); locul cinstit pt. progresul microscopic
  rămâne rândul Total, cu `n` mare (vezi `PROPUNERE-sageti-progres.md`).
- **Celule fără procent afișat:** fără bară (§2).

## 8. Criterii de acceptare (verificabile în browser)

Pe sursa care populează tabelul (jurnalul real 11-20, sau „dummy log pe 8 săptămâni");
verificarea mecanicii pe 1-10 s-ar face cu fixture-ul dummy, dar bara e independentă de
domeniu.

1. Cu bara **oprită**: tabelul arată exact ca azi (rânduri compacte, fără bare); săgețile
   Total apar/dispar după bifa lor, care implicit e pornită.
2. Cu bara **pornită**, o celulă cu urcare cunoscută (ex. 12× 20.07=48% după 21.07…
   alege una reală din tabel) arată verde până la `cs` + portocaliu `cc−cs` deasupra;
   o celulă cu coborâre arată roșu 50% deasupra verdelui; o celulă cu `cc==cs` e integral
   verde; prima celulă a unui rând e integral verde.
3. Grila: 10 diviziuni egale pe toată înălțimea; peste umplere colorat, deasupra alb.
4. Sliderul **Înălțime** schimbă înălțimea rândurilor (și, proporțional, grosimea
   dungilor) live, fără recitirea sursei; **Lățime** îngustează banda; **Poziție** o mută
   stânga↔dreapta (fără efect vizibil la lățime 100%); **Opacitate roșu** dus la 0% face
   dunga de pierdere invizibilă (rămâne doar verdele), dus la 100% o face plin opacă;
   portocaliul (câștig) nu e afectat.
5. Numărul rămâne lizibil deasupra benzii în toate cazurile de mai sus (dacă nu, se
   îngustează banda din slider — de-asta există).
6. Reîncărcarea paginii păstrează cele 6 reglaje/bife (localStorage); schimbarea
   adâncimii (5.2) re-randează tabelul **fără** a pierde reglajele barei.
7. Titlul tabelului începe cu „Tabel % fluență per subtablă (serie calupuri)".

## 9. Legături

- `CONTINUARE-proiect-MABP.md` — fluxul motorului, secțiunea „Progres/direcție".
- `PROPUNERE-sageti-progres.md` — de ce progresul mic e cinstit doar agregat / pe Total.
- `CONTRACT-PRESETURI.md` — cum se leagă controalele noi de sertarul localStorage.
- `PLAN-tabel-fluenta.md` — randarea tabelului și subsecțiunea 5.2 existentă.
