// Deci avem tabla inmultirii adunarii, scaderii, impartirii.
//
// Nivelul F0
// Definitie: un f0 un fact este un rand dintr-o tabla (a inmultirii, impartirii, adunarii sau scaderii), de ex "3+2=5"
//
// Structura acestui fisier: produs cartezian al switchurilor active.
// Daca F1 are N switchuri true si F2 are M switchuri true → N*M combinatii de baza,
// inmultite apoi cu fiecare grup F3 activ.
// Daca un nivel are 0 switchuri true → 0 combinatii indiferent de restul.

const EFF_CONFIG = {

  // Nivelul F1
  //   Definitie: un grup F1 este format din urmatoarele f0 din tablele de facts:

  f1_initial: true,               //  -f1 initial: 3+2=5
  f1_comutat: true,               //  -f1 comutat: 2+3=5
  f1_complementar: true,          //  -f1 complementar: 5-2=3
  f1_complementar_comutat: true,  //  -f1 complementar comutat: 5-3=2

  //  Deci pt fiecare f0 avem 4 f1
  //
  //  Comentariu: "comutat" in sensul de "rocada"
  //      10=8+2 comutat: 10=2+8
  //      10-8=2 comutat: 10-2=8
  //      10=2*5 comutat: 10=5*2
  //      10:2=5 comutat: 10:5=2
  //
  //  Comentariu: "complementar" in sensul de +- si */:
  //      2+3=5 complementar: 5-3=2
  //      3+2=5 complementar: 5-2=3
  //      5-2=3 complementar: 3+2=5
  //      5*2=10 complmentar: 10:2=5
  //      2*5=10 complmentar: 10:5=2
  //      10:5=2 complmentar: 2*5=10
  //      10:2=5 complmentar: 5*2=10

  // Nivelul F2
  //   Definitie: pt fiecare f0 din F1 avem doua forme:

  doua_nr_in_STANGA: true,    //  -Forma "doua numere in stanga egalului": 3+2=5
  doua_nr_in_DREAPTA: true,   //  -Forma "doua numere in dreapta egalului": 5=3+2

  //  Deci pt fiecare f0 avem 4 f1 si 4*2 f2

  // Nivelul F3
  //   Definitie: pt. fiecare f2 putem sa il transformam in intrebare in mai multe feluri:
  //   -cate un ?:

  trei_pozitii_pt_cate_un_numar: true,                   // ?+2=3, 3+?=5, 3+2=?
  doua_pozitii_pt_cate_un_semn_operator_matematic: true, // 3?2=5, 3+2?5

  //   - cate doua ?:

  o_pozitie_pt_cate_2_semne: true,                // 3?2?5
  trei_pozitii_pt_cate_2_numere: true,            // ?+?=5, 2+?=?, ?+3=?
  sase_pozitii_pt_cate_un_semn_si_un_numar: true, // ??2=5, ?+2?5, 3??=5, 3?2=?, 3+??5, 3+2??

  //  In total 3+2+1+3+6=15 moduri de a formula intrebari corelate fiecarui fact f2,
  //  deci 8*15=120 de forme de a pune intrebari conexe pt fiecare f0
};
