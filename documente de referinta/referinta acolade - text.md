# Referință acolade extensibile (SVG)

> Fișier companion: `referinta acolade.js` — implementare canonică.  
> Demo: `referinta acolade.html`  
> Utilizare live: `axe acolade mere/axe acolade mere.js` (aceeași geometrie).

---

## 1. De ce desen, nu caractere

- Acoladele trebuie **animate** (lărgime variabilă) — doar segmentele drepte cresc/scad.
- Caractere Unicode (⏞ ⏟) sau fonturi LaTeX nu scalează uniform pe orice lățime.
- Soluția: **path SVG** din arce de cerc + linii drepte, parametri fixi.

---

## 2. Cele 4 orientări

Toate sunt **aceeași piesă geometrică**, rotită la 0° / 90° / 180° / 270°:

| Cheie | Deschidere spre | Muchie anchor (referință) |
|-------|-----------------|---------------------------|
| `jos` | conținutul de dedesubt | muchia **de jos** a acoladei (`y0`) |
| `sus` | conținutul de deasupra | muchia **de sus** (`y0`) |
| `stanga` | conținutul din stânga | muchia din **stânga** (`x0`) — span pe **Y** |
| `dreapta` | conținutul din dreapta | muchia din **dreapta** — span pe **Y** |

Pentru `stanga` / `dreapta`: `spanStart` / `spanEnd` sunt coordonate **Y**; `anchor` este coordonata **X** fixă.

---

## 3. Gramatica geometrică (modelul final)

Pe direcția span-ului (orizontal pentru jos/sus):

```
[sfert cap stânga] — linie dreaptă — [vârf: 2 sferturi] — linie dreaptă — [sfert cap dreapta]
```

### 3.1 Capete

- **Câte un sfert de cerc** per cap (rază `R`).
- Deocamdata **fără** segment drept suplimentar după cap (se poate adăuga ulterior dacă e nevoie).

### 3.2 Vârf central (nu „bump” rotund)

- **Două sferturi de cerc identice**, simetrice.
- Fiecare curbe **spre punctul de pe axa centrală a span-ului** `(xc, …)`, **nu spre exterior**.
- Intersecția = **vârf ascuțit** (^ sau v), nu arc bombat.
- Important în SVG: arcul **interior** folosește `sweep-flag` corect:
  - **jos:** ambele sferturi centrale → `sweep 0`
  - **sus:** ambele sferturi centrale → `sweep 1`

### 3.3 Laturi drepte (partea animabilă)

- Între cap-ul stâng și zona vârfului (`xc − R`): segment **L** orizontal.
- Între vârf și cap-ul drept (`xc + R` … `x2 − R`): segment **L** simetric.
- La animație **doar aceste două lungimi** se modifică; capetele și vârful rămân formă fixă.

---

## 4. Parametri numerici

| Symbol | Valoare | Rol |
|--------|---------|-----|
| `R0` | **6 px** | Raza de bază a sfertului |
| `FIXED_R` | **4** | Lățime fixă totală = `4·R` (cap + vârf 2R + cap) |
| `R` | `R0` sau `span/4` | Dacă `span < 4·R0`, **R se micșorează** proporțional |
| `L` | `(span − 4R) / 2` | Fiecare latură dreaptă; poate fi **0** |

### Poziții cheie (orientare `jos`, span `[x1, x2]`, anchor `y0`)

- `xc = (x1 + x2) / 2`
- `yShelf = y0 − R` — nivelul laturilor drepte
- Vârf: `(xc, y0 − 2R)`
- Cap stânga: arc de la `(x1, y0)` la `(x1+R, yShelf)`
- Zona vârf: de la `(xc−R, yShelf)` la `(xc+R, yShelf)` prin `(xc, y0−2R)`
- Cap dreapta: de la `(x2−R, yShelf)` la `(x2, y0)`

Orientarea `sus` = aceleași formule cu oglindă verticală (`yShelf = y0 + R`, vârf la `y0 + 2R`).

---

## 5. Cuprinderea obiectelor (mere pe axă)

Acolada nu se leagă doar de **centrul** tick-urilor, ci de **marginea vizuală** a obiectelor:

- Obiectele stau centrate pe pozițiile întregi `1, 2, 3, …` pe axă.
- Pas între două numere consecutive: `unit` (px).
- Span acoladă pentru indici `start … end`:

```
x1 = xAt(start) − unit/2
x2 = xAt(end)   + unit/2
```

Funcție: `ReferintaAcolade.spanForObjects(startIdx, endIdx, xAt, unit)`.

---

## 6. API (`referinta acolade.js`)

```javascript
ReferintaAcolade.R0           // 6
ReferintaAcolade.FIXED_R      // 4
ReferintaAcolade.ORIENT       // { JOS, SUS, STANGA, DREAPTA }

ReferintaAcolade.radius(span, r0?)
ReferintaAcolade.straightHalf(span, R)   // L — pentru animație

ReferintaAcolade.pathOpenJos(x1, x2, y0, R)
ReferintaAcolade.pathOpenSus(x1, x2, y0, R)

ReferintaAcolade.path(spanStart, spanEnd, anchor, orient, { r0? })
ReferintaAcolade.append(svg, spanStart, spanEnd, anchor, orient, opts?)
ReferintaAcolade.spanForObjects(startIdx, endIdx, xAt, unit)

ReferintaAcolade.demoInViewBox(svg, w, h, orient, { span?, pad? })
```

`append` returnează `{ R, L, orient, d, pathEl }`.

### Stil implicit path

- `stroke: #0f172a`
- `stroke-width: 1.35`
- `fill: none`, cap/join rotund

---

## 7. Animație (viitor)

1. Păstrezi `R` (sau recalculezi dacă span devine foarte mic).
2. Actualizezi `span` → noi `x1`, `x2` (sau `y1`, `y2`).
3. Recalculezi `L = straightHalf(span, R)`.
4. Regeneri `d` cu aceleași funcții `pathOpenJos` / `pathOpenSus` sau `path`.
5. Setezi `pathEl.setAttribute('d', d)` — capetele și vârful rămân proporționale; doar liniile **L** se lungesc/scurtesc.

---

## 8. Greșeli de evitat (din iteratiile anterioare)

| Greșeală | Efect |
|----------|--------|
| Arc `sweep` inversat la vârf | „Bump” rotund spre exterior |
| 4 sferturi la vârf (model vechi) | Formă prea rotundă, nu vârf clar |
| Span doar între centre tick | Acolada nu cuprinde merele |
| Caractere Unicode scalate pe X | Deformare, neuniform |
| Segment drept lung + mic Q la centru | Nu arată ca notația matematică |

---

## 9. Integrare în alte vizualizări

1. Include `referinta acolade.js` (sau copiază funcțiile).
2. Calculează `x1/x2` cu `spanForObjects` dacă ai obiecte pe axă.
3. Alege `ORIENT.JOS` deasupra conținutului, `ORIENT.SUS` dedesubt.
4. `append(svg, x1, x2, yAnchor, orient)`.

Pentru „axe acolade mere”: acolade mici = `JOS`, acolada mare = `SUS`.
