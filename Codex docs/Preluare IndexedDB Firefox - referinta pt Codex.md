# Preluare IndexedDB Firefox - referință pentru Codex

## Problema

IndexedDB este izolat per browser și origine. Pagina MABP deschisă în Codex Browser citește jurnalul Codex Browser, nu jurnalul Firefox, chiar dacă URL-ul este același.

Jurnalul YouLearn folosește:

- baza de date: `youlearn_jurnal_intrebari`;
- colecția: `intrebari`;
- ordinea autoritativă: cursor IndexedDB `openCursor(..., "next")`.

## Soluția stabilă

Nu copia și nu decoda direct fișierele interne Firefox. Deschide pagina MABP chiar în Firefox, pe aceeași origine `http://localhost:8770`, cu sursa și analiza declarate în URL:

```text
http://localhost:8770/Vizualizare%20si%20interpretare%20logs/mabp.html?sursa=indexeddb&analiza=stare_generala_observata_v1
```

Pagina va:

1. selecta presetul `stare_generala_observata_v1` — „Toate exercițiile observate”;
2. citi automat IndexedDB-ul browserului Firefox;
3. analiza toate valorile `fact_id` existente, fără catalog structural;
4. păstra logurile brute nemodificate.

Presetul structural pentru subtable/EFF rămâne blocat pe surse reale până când există un catalog matematic complet compatibil.

## Deschiderea automată în Firefox

Din rădăcina proiectului, cu serverul local deja pornit:

```powershell
$url = 'http://localhost:8770/Vizualizare%20si%20interpretare%20logs/mabp.html?sursa=indexeddb&analiza=stare_generala_observata_v1'
Start-Process -FilePath 'C:\Program Files\Mozilla Firefox\firefox.exe' -ArgumentList '-new-tab', $url
```

Dacă fila s-a deschis în fundal:

```powershell
$shell = New-Object -ComObject WScript.Shell
$shell.AppActivate('Mozilla Firefox')
```

## Verificări

În pagină trebuie să apară:

- analiza „Toate exercițiile observate”;
- sursa „jurnalul IndexedDB, în ordinea cursorului”;
- numărul de înregistrări din profilul Firefox;
- rezultatul „Pe scurt” pentru facts efectiv observate.

Verificarea din 15 iulie 2026 a găsit 259 de înregistrări în profilul Firefox activ. Acest număr este doar un instantaneu și se va modifica odată cu jurnalul.

## Diagnostic read-only, numai dacă pagina nu poate citi baza

Originea Firefox pentru serverul curent se află de regulă sub:

```text
%APPDATA%\Mozilla\Firefox\Profiles\<profil-activ>\storage\default\http+++localhost+8770\idb
```

Fișierele `.sqlite`, `.sqlite-wal` și `.sqlite-shm` nu trebuie modificate manual. Ele pot fi inspectate numai read-only pentru a confirma numele colecției și numărul înregistrărilor. Valorile IndexedDB nu sunt un export JSON obișnuit; pentru analiza curentă, citirea prin API-ul IndexedDB din Firefox este calea autoritativă și mai simplă.

## Limită importantă

Portul face parte din origine. Datele salvate pe `localhost:8770` nu sunt aceleași cu datele de pe `localhost:8000`, `127.0.0.1:8770` sau alt port. Folosește exact originea în care a rulat YouLearn când au fost create logurile.
