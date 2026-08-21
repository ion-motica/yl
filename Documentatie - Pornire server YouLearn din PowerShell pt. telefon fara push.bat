@echo off
cd /d "C:\Users\I\Projects\Youlearn.com"
python -m http.server 8000
ipconfig

REM Prescurtat:
REM deci e un proiect in html intr-un folder pe pc. actualizat periodic. cum il pot vedea pe telefon?
REM 
REM Pe PC, intră în folderul proiectului:
REM 	cd C:\cale\catre\proiect
REM 	Pornește server local:
REM 	python -m http.server 8000
REM 	Află IP-ul PC-ului:
REM 	ipconfig
REM 
REM 	Cauți IPv4 Address, ceva de forma 192.168.1.37.
REM 
REM 	Pe telefon, în browser, deschizi:
REM 	http://192.168.1.37:8000
REM 
REM 	Când modifici HTML/CSS/JS pe PC, dai refresh pe telefon și vezi noua versiune.
REM 
REM Atenție la capcane:
REM 	localhost:8000 merge doar pe PC, nu pe telefon.
REM 	PC-ul și telefonul trebuie să fie pe aceeași rețea Wi-Fi.
REM 	Windows Firewall poate întreba dacă permiți Python; alege rețea privată/locală.
REM 	Dacă routerul are “AP isolation” sau telefonul e pe Guest Wi-Fi, nu se vor vedea între ele.
REM 
REM 
REM Din Cursor 
REM 	Deschizi folderul proiectului în Cursor.
REM 	Deschizi terminalul:
REM 	Terminal > New Terminal
REM 	Rulezi:
REM 	python -m http.server 8000
REM 	Afli IP-ul PC-ului:
REM 	ipconfig
REM 
REM 	Cauți IPv4 Address, de genul 192.168.1.37.
REM 
REM 	Pe telefon deschizi:
REM 	http://192.168.1.37:8000
REM 
REM 	Dacă fișierul tău e index.html, se deschide direct. Dacă e, de exemplu, v7.html, intri pe:
REM 
REM 	http://192.168.1.37:8000/v7.html
REM 
REM 
REM Capcane: 
REM 	Windows Firewall poate bloca Python/Live Server; telefonul și PC-ul trebuie să fie pe același Wi-Fi; localhost și 127.0.0.1 de pe telefon înseamnă telefonul, nu PC-ul.
REM 
REM 
REM 
REM După restart 
REM 	trebuie pornit din nou serverul, pentru că python -m http.server 8000 rulează doar cât timp terminalul respectiv rămâne deschis.
REM 
REM Cel mai simplu ritual:
REM 
REM 	cd C:\Users\I\Projects\Youlearn.com
REM 	python -m http.server 8000 --bind 0.0.0.0
REM 
REM 	Apoi pe telefon intri iar pe:
REM 
REM 	http://IP-ul-PC-ului:8000
REM 
REM 	IP-ul poate rămâne același, dar uneori routerul îl schimbă după restart. Dacă nu mai merge linkul de pe telefon, verifici iar cu:
REM 
REM 	ipconfig
REM 
REM Variantă mai comodă: 
REM 	faci un fișier start-youlearn-server.bat cu:
REM 
REM 	cd /d C:\Users\I\Projects\Youlearn.com
REM 	python -m http.server 8000 --bind 0.0.0.0
REM 	pause
REM 
REM 	După aceea dai dublu-click pe fișier când vrei să testezi pe telefon.
REM 
REM 
REM 
REM 
REM 
REM 
REM 
REM 
REM 
REM 
REM 
REM 
REM 
REM =========================================
REM =========================================
REM =========================================
REM NEPRESCURTAT
REM =========================================
REM =========================================
REM =========================================
REM deci e un proiect in html intr-un folder pe pc. actualizat periodic. cum il pot vedea pe telefon?
REM 
REM Da, se poate. Varianta bună pentru proiect HTML actualizat periodic: pornești un mic server pe PC și intri de pe telefon prin Wi-Fi.
REM 
REM Pași simpli:
REM 
REM Pe PC, intră în folderul proiectului:
REM cd C:\cale\catre\proiect
REM Pornește server local:
REM python -m http.server 8000
REM Află IP-ul PC-ului:
REM ipconfig
REM 
REM Cauți IPv4 Address, ceva de forma 192.168.1.37.
REM 
REM Pe telefon, în browser, deschizi:
REM http://192.168.1.37:8000
REM 
REM Când modifici HTML/CSS/JS pe PC, dai refresh pe telefon și vezi noua versiune.
REM 
REM Atenție la capcane:
REM 
REM localhost:8000 merge doar pe PC, nu pe telefon.
REM PC-ul și telefonul trebuie să fie pe aceeași rețea Wi-Fi.
REM Windows Firewall poate întreba dacă permiți Python; alege rețea privată/locală.
REM Dacă routerul are “AP isolation” sau telefonul e pe Guest Wi-Fi, nu se vor vedea între ele.
REM 
REM Alternativ, dacă folosești VS Code/Cursor, poți instala extensia Live Server, dai “Go Live”, apoi folosești tot IP-ul PC-ului pe telefon.
REM 
REM Siguranță: 95%. Sursă: cunoștințe standard despre server HTTP local + deducție din cazul tău: proiect HTML pe PC, testare pe telefon prin Wi-Fi.
REM E dimineață: dacă ai de plecat la 7, fă varianta minimă acum doar dacă durează 3 minute; altfel notează pașii și pleacă punctual.
REM 
REM din cursor cum fac?
REM 
REM Din Cursor ai 2 variante simple.
REM 
REM Varianta 1: Terminal în Cursor
REM 
REM Deschizi folderul proiectului în Cursor.
REM Deschizi terminalul:
REM Terminal > New Terminal
REM Rulezi:
REM python -m http.server 8000
REM Afli IP-ul PC-ului:
REM ipconfig
REM 
REM Cauți IPv4 Address, de genul 192.168.1.37.
REM 
REM Pe telefon deschizi:
REM http://192.168.1.37:8000
REM 
REM Dacă fișierul tău e index.html, se deschide direct. Dacă e, de exemplu, v7.html, intri pe:
REM 
REM http://192.168.1.37:8000/v7.html
REM 
REM Varianta 2: Live Server în Cursor
REM 
REM În Cursor mergi la Extensions.
REM Cauți Live Server.
REM Instalezi extensia de la Ritwick Dey.
REM Click dreapta pe index.html / fișierul tău HTML.
REM Alegi Open with Live Server.
REM Pe PC se deschide ceva ca:
REM http://127.0.0.1:5500
REM 
REM Pe telefon nu folosești 127.0.0.1, ci înlocuiești cu IP-ul PC-ului:
REM 
REM http://192.168.1.37:5500
REM 
REM Eu aș începe cu varianta 1, e mai curată și nu depinde de extensii.
REM 
REM Capcane: Windows Firewall poate bloca Python/Live Server; telefonul și PC-ul trebuie să fie pe același Wi-Fi; localhost și 127.0.0.1 de pe telefon înseamnă telefonul, nu PC-ul.
REM 
REM Siguranță: 95%. Sursă: practică standard de development local; deducție aplicată la cazul tău cu proiect HTML în Cursor.
REM 
REM sta asa de aproape un minut
REM 
REM Da. După restart trebuie pornit din nou serverul, pentru că python -m http.server 8000 rulează doar cât timp terminalul respectiv rămâne deschis.
REM 
REM Cel mai simplu ritual:
REM 
REM cd C:\Users\I\Projects\Youlearn.com
REM python -m http.server 8000 --bind 0.0.0.0
REM 
REM Apoi pe telefon intri iar pe:
REM 
REM http://IP-ul-PC-ului:8000
REM 
REM IP-ul poate rămâne același, dar uneori routerul îl schimbă după restart. Dacă nu mai merge linkul de pe telefon, verifici iar cu:
REM 
REM ipconfig
REM 
REM Variantă mai comodă: faci un fișier start-youlearn-server.bat cu:
REM 
REM cd /d C:\Users\I\Projects\Youlearn.com
REM python -m http.server 8000 --bind 0.0.0.0
REM pause
REM 
REM După aceea dai dublu-click pe fișier când vrei să testezi pe telefon.
REM 
REM Siguranță: 95%. Sursă: comportament standard al proceselor pornite manual în terminal + deducție din setup-ul tău Windows/Cursor.