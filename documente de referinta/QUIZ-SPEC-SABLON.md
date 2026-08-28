ca un formular cu campuri de completat cand iti cer un quiz nou sau sa modifici un quz existent. acum discutam cum sa facem acest formulr: sa nu fie nici f stufos/coplesitor  pt mine si sa fie clr si cuprinzator si pt tine si pt quiz sa iasacum trebuie

nume quiz: exemplu: t20 v2
are mai ulte tipuri de intrebari ? da
definim termeni:
	-pt facts : 	- a+b=c c:a=b - a, b sunt numerele mai mici, c este suma/ descazutul/ produsul / deimpartitul = numarul mai mare
	- q1=quiz mare q2=subquiz/subquizuri
	- q form e distinct de subquiz

**definiție obligatorie — ce înseamnă „userul a răspuns la întrebare" (18.08.2026, de citit de fiecare dată când mai facem un quiz sau subquiz):

Când spui că userul „a răspuns la întrebare", sunt două lucruri separate, nu unul singur:

A) Din perspectiva apăsărilor: copilul apasă pe cele 3 butoane de câte ori e nevoie — una, două, un milion de apăsări — până nimerește butonul corect. Toate apăsările alea la un loc formează „răspunsul" la acea întrebare.

B) Din perspectiva corectitudinii — și asta e complet separat de A: dacă prima apăsare a fost pe butonul corect, întrebarea aia se consideră răspunsă corect. Dacă prima apăsare a fost greșită, indiferent câte apăsări a mai luat până a nimerit butonul corect, întreaga tură se consideră răspunsă greșit. Apăsările de după prima greșeală nu sunt încercări noi de răspuns care se evaluează separat — sunt șanse de corectare, oferite prin feedback imediat (butonul greșit marcat, rămâi pe loc). Ele schimbă ce apasă copilul mai departe, dar nu schimbă verdictul de corectitudine al turei respective.

Consecința pe care o văd: variabila isCorrect, calculată la fiecare apăsare — pe care am întâlnit-o peste tot în codul citit azi — nu poate servi simultan la două lucruri diferite. Poate decide mecanica ecranului (rămâi sau avansezi — care oricum e mereu aceeași regulă: rămâi până apeși corect). Dar nu poate fi folosită direct și pentru scor, jurnal, sau statistici de fluență — acolo trebuie păstrată doar corectitudinea primei apăsări din tură, fixată din primul moment, neschimbată de câte apăsări greșite au urmat.

**precizare — asta e deja rezolvat corect în jurnal/Vizualizare 3, nu e scop nou:** la un tur se poate apăsa de multe ori pe butoanele cu variantele de răspuns; fiecare apăsare e consemnată în jurnal, dar corectitudinea acelui tur e dată doar de primul răspuns. Deci un tur poate fi compus din multe apăsări pe butoanele de răspuns, până se apasă în sfârșit pe butonul corect. În logul mare se specifică: fiecare apăsare din jurnal are un câmp `al_catelea_turn_apasare_pe_buton` — `1` înseamnă „prima apăsare a unei întrebări noi", `2`, `3` etc. înseamnă „continuare pe aceeași întrebare". `motor-analiza.js` grupează apăsările în întrebări pe baza acestui câmp (`grupeazaApasarilePeIntrebari`), și calculează `corect_din_prima` strict din prima apăsare a grupului. Mecanismul ăsta există deja și e corect — depinde doar de motorul comun de răspuns (rămâi pe aceeași întrebare la greșit) să funcționeze peste tot, ca `al_catelea_turn_apasare_pe_buton` să numere corect. Nu e treabă separată de Vizualizare 3/statistici.


**nivel alegere subquiz q2 in cadrul quizului mare q1
	lista de nume q2s din q1
	reguli intrare si iesire din quiz mare q1
	reguli intrare si iesire din fiecare subquiz q2
	exista o ordine / pattern /regului in care apar (daca apar) sub-quizurile sau aleator?
	ce persistenta au datele colectate: facts gresite, timpi de raspuns etc
		ce date persista dupa reload — nimic, doar nivelul, tot progresul, etc.
		unde e stocat: nicaieri / var globala / bd etc
		pana cand e stocat: sesiune quiz, sesiune yl, de la o sesiune yl la alta

**nivel definire - pt fiecare subquiz
	nume q2:
	ce tip de intrebari contine fiecare q2 
		in ce forma apare intrebarea: q forms , ascii si/sau ilustratii etc
		in ce forma apar variantele de raspuns 
		ce valori au a b c? din ce domenii
	ce mesaje apar pt user pe parcursul q2	
	reguli de alegere intrebari
	Răspunsuri greșite (capcane): cum le generezi
	Feedback UI (panou info, highlight rapid, mesaje, , divuri active sau inactive)
	Ilustratii-de care, in ce div
	cam asta ar fi, la granulatie mare, nu? vorbim deocamdata de structura vazuta de sus

**definire levels
	ce inseamna level 1,2,3 etc
	cand se trece la nivelul urmator
	daca un level contine o succesiune de subquizuri: in ce ordine, cu ce ciclicitate

