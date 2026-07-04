ca un formular cu campuri de completat cand iti cer un quiz nou sau sa modifici un quz existent. acum discutam cum sa facem acest formulr: sa nu fie nici f stufos/coplesitor  pt mine si sa fie clr si cuprinzator si pt tine si pt quiz sa iasacum trebuie

nume quiz: exemplu: t20 v2
are mai ulte tipuri de intrebari ? da
definim termeni:
	-pt facts : 	- a+b=c c:a=b - a, b sunt numerele mai mici, c este suma/ descazutul/ produsul / deimpartitul = numarul mai mare
	- q1=quiz mare q2=subquiz/subquizuri
	- q form e distinct de subquiz


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

