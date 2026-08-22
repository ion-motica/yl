@echo off
cd /d "C:\Users\I\Projects\Youlearn.com"
start "" http://127.0.0.1:8770
python -m http.server 8770 --bind 127.0.0.1
pause

REM rem inseman comentariu de o line in .bat, cica nu e multiline
REM 
REM 
REM 
REM 
REM descrie exact pas cu pas ca pt prosti cum sa pornesc din powersharll serverul youlearn pt portul pe care i folosesti de obicei
REM 
REM Portul „de obicei" e **8770** (config `youlearn-local` din [.claude/launch.json](.claude/launch.json), legat pe 127.0.0.1 — doar pentru tine, local).
REM 
REM 
REM 
REM ## Pas cu pas în PowerShell
REM 
REM **1. Deschide PowerShell**
REM Start → scrii „PowerShell" → Enter.
REM 
REM **2. Mergi în folderul proiectului**
REM Scrii exact (cu ghilimele, că are spații în nume):
REM ```powershell
REM cd "C:\Users\I\Projects\Youlearn.com" 
REM python -m http.server 8770 --bind 127.0.0.1
REM ```
REM Enter.
REM 
REM **4. Verifică că a pornit**
REM Ar trebui să vezi ceva de genul:
REM ```
REM Serving HTTP on 127.0.0.1 port 8770 (http://127.0.0.1:8770/) ...
REM ```
REM Fereastra PowerShell rămâne „ocupată" — asta e normal, serverul rulează cât timp fereastra e deschisă.
REM 
REM **5. Deschide în browser**
REM Mergi la:
REM - `http://127.0.0.1:8770/` — pagina index
REM - `http://127.0.0.1:8770/Vizualizare%203%20-%20Claude/vizualizare3.html` — modulul la care lucrezi acum
REM 
REM **6. Ca să oprești serverul**
REM Dai click în fereastra PowerShell și apeși `Ctrl + C`.
REM 
REM ---
REM Notă: dacă vrei să testezi și de pe telefon (aceeași rețea WiFi), există și config-ul `youlearn-telefon` pe portul 8000, legat pe `0.0.0.0` în loc de `127.0.0.1` — dar pentru lucru normal pe calculator, 8770 e cel corect.
REM 