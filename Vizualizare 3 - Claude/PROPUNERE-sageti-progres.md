# Săgeți de progres în tabelul de fluență — notă de decizie

Status: **discutat 22.07.2026, neimplementat.** Reguli de lucru: `AGENTS.md`.

## Decizia

Varianta **comparare fact-cu-fact (numărare „≥8 din 10 facts au urcat")** a fost
**respinsă de user**: e mai *slabă* statistic decât compararea mediilor (testul
semnelor aruncă mărimea → ~64% din puterea comparării de medii), iar compararea
mediilor **e deja implementată** (media coeficientului per celulă,
`motor-analiza.js:562`). Un al doilea sistem paralel ar adăuga complexitate fără
să aducă putere — doar verificabilitate/robustețe, insuficient ca să merite.

## Ce rămâne, dacă se fac vreodată săgeți

Se pleacă de la S1 (compararea mediilor), NU de la un sistem nou:

- **Slăbiciunea lui S1 (netestate = 0, acoperire variabilă) se rezolvă din quiz
  design**, la sursă: quizul începe cu facts-urile din subtablă rămase netestate în
  sesiunea precedentă. Efect: aproape zero netestate → media reflectă măiestria, nu
  golurile; și, ambele celule acoperind aceleași facts, **dificultatea se anulează
  în diferență** (se scad aceleași 7×8 din 7×8). Două slăbiciuni rezolvate fără cod
  statistic nou.
- **Gărzi minime pentru o săgeată onestă:** celule **bazate** (n + zile, criteriul
  existent) + calupuri **disjuncte** + un **prag** de diferență (o cifră, ex. 5pp pe
  Total). Nu un sistem — doar condiții pe comparație.
- **Reziduu onest, inerent:** pe subtablă (10 facts) plafonul de precizie rămâne —
  mișcările mici stau sub zgomot. Progresul mic se vede acumulat (peste mai multe
  calupuri) sau pe rândul **Total** (n ~10× mai mare, unde un prag de 5pp ≈ 2,8 SE).
  Nu e motiv de sistem nou, e granița a ce poate arăta 10 facts.

## Legături

- `CONTINUARE-proiect-MABP.md` — secțiunea „Progres/direcție" (calupuri
  înghețate/vii; feedback zilnic prin efort + recorduri de acuratețe, nu prin
  măsurare de progres microscopic, care nu poate fi cinstit imediat).
- `SPECIFICATIE.md` §13 — fotografiile stratificate, etichetele de încredere,
  „Citirea diferențelor (anti-amăgire)".
