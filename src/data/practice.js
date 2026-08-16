const checkpointChallenges = {
  5: ["Połącz wszystkie ruchy ratunkowe.", "Poprowadź trzyminutową wymianę. Kup czas, poproś o powtórzenie, popraw jedno pytanie i wróć do rozmowy bez przepraszania za swój angielski."],
  10: ["Odzyskaj rozmowę pod presją.", "Poprowadź pięć minut rozmowy, w której czegoś nie dosłyszysz, zabraknie ci słowa i nie będziesz znała jednej odpowiedzi. Za każdym razem spokojnie odzyskaj płynność."],
  15: ["Poprowadź pierwsze trzy minuty.", "Przywitaj kandydata, wyjaśnij cel telefonu, sprawdź czas i zainteresowanie, a potem płynnie przejdź do pierwszego pytania."],
  20: ["Zrób pełny screening w 15 minut.", "Przejdź od otwarcia przez doświadczenie, technologie, dostępność i oczekiwania. Na końcu krótko podsumuj ustalenia."],
  25: ["Napisz sekwencję trzech wiadomości.", "Przygotuj pierwszą wiadomość, uprzejmy follow-up i krótkie zaproszenie na rozmowę. Każda wiadomość ma być konkretna i naturalna."],
  30: ["Obsłuż trzy odpowiedzi na LinkedInie.", "Napisz odpowiedź dla osoby zainteresowanej, niezainteresowanej i proszącej o szczegóły. Zachowaj ten sam spokojny, ludzki ton."],
  35: ["Zbuduj profil w pięć minut.", "Zbierz krótki przegląd kariery, aktualny projekt, osobistą odpowiedzialność i codzienny stack. Dopytaj o jeden konkret."],
  40: ["Poprowadź dziesięć minut o doświadczeniu.", "Zbadaj praktyczne doświadczenie, poziom odpowiedzialności, jeden niedawny przykład oraz motywację do zmiany."],
  45: ["Przedstaw projekt w dwie minuty.", "Wyjaśnij kontekst klienta, cel projektu i zakres roli. Nie ujawniaj poufnych danych i sprawdź pierwszą reakcję kandydata."],
  50: ["Sprzedaj rolę bez nadęcia.", "Przedstaw projekt, zespół i model pracy, połącz rolę z profilem kandydata, a następnie odpowiedz na jedno sceptyczne pytanie."],
  55: ["Poprowadź sekcję o pieniądzach.", "Ustal typ kontraktu, oczekiwania, dostępność i inne procesy. Mów bez skrępowania, ale bez nacisku."],
  60: ["Domknij logistykę i finanse.", "Przejdź przez dostępność, kontrakt, wynagrodzenie, angielski i inne procesy. Na końcu podsumuj ustalenia własnymi słowami."],
  65: ["Przełóż interview bez chaosu.", "Poinformuj o zmianie terminu, uznaj niedogodność, zaproponuj dwie alternatywy i upewnij się, że nowy termin pasuje."],
  70: ["Przygotuj kandydata do interview.", "Wyjaśnij format i długość spotkania, sprawdź obawy kandydata, odpowiedz na jedno pytanie i zakończ wspierająco."],
  75: ["Utrzymaj proces przy presji czasu.", "Kandydat ma inną ofertę i potrzebuje decyzji do piątku. Uznaj presję, uczciwie przekaż stan procesu i zaproponuj konkretny następny krok."],
  80: ["Przeprowadź trzy rozmowy o wyniku.", "Przekaż pozytywny feedback, opóźnienie bez decyzji oraz odrzucenie. W każdej scenie bądź jasna, empatyczna i konkretna."],
  85: ["Poprowadź pełną rozmowę ofertową.", "Przekaż ofertę, omów główne warunki, zbierz pierwszą reakcję i spokojnie odpowiedz na jedną obawę."],
  90: ["Porozmawiaj o kontrofertach i decyzji.", "Poznaj kryteria decyzji, omów jedną wątpliwość i ustal realistyczny termin odpowiedzi bez wywierania presji."],
  91: ["Poprowadź screening od początku do końca.", "Przez 25–30 minut przejdź od otwarcia i agendy do doświadczenia, projektu, logistyki, pytań kandydata i podsumowania kolejnych kroków."],
  95: ["Rozplącz trudny profil.", "Kandydat odpowiada ogólnie i używa niejasnych określeń. Dopytuj o kontekst, osobisty wkład, poziom samodzielności i jeden konkretny przykład."],
  98: ["Połącz kilka ruchów ratunkowych.", "Masz mało czasu, słabe połączenie i niepełną informację o projekcie. Ustaw priorytety, poproś o powtórzenie i jasno zapowiedz, co sprawdzisz później."],
  99: ["Poprowadź rozmowę własnymi słowami.", "Użyj zapisanych fraz jako punktów orientacyjnych, ale nie czytaj skryptu. Przejdź przez otwarcie, profil, rolę i następne kroki w swoim naturalnym stylu."],
  100: ["Poprowadź pełną 30-minutową rozmowę.", "Zamknij notatki. Przeprowadź kompletny screening, reaguj na odpowiedzi kandydata, pilnuj czasu i zakończ jasnym podsumowaniem oraz następnym krokiem."],
};

export function getLessonPractice(lesson) {
  const isMessage = lesson.practiceType === "message";
  const checkpoint = checkpointChallenges[lesson.id];

  if (isMessage) {
    return {
      isMessage,
      introTitle: "Najpierw napisz po swojemu.",
      introQuestion: `Wyobraź sobie, że właśnie chcesz ${lesson.goal}. Jak napisałabyś to teraz, bez szukania idealnego zdania?`,
      cueTitle: "Napisz krótką odpowiedź",
      cueNote: "Masz 45 sekund. Skup się na intencji, prostym języku i naturalnym tonie.",
      transformEyebrow: "04 · WRITE BEFORE YOU SEE",
      transformTitle: "Zmień intencję w wiadomość.",
      transformInstruction: `${lesson.goal}. Napisz jedną krótką, naturalną wersję po angielsku.`,
      pauseSeconds: 45,
      pauseLabel: "45 sekund na napisanie jest częścią ćwiczenia",
      dialogueTitle: "Wstaw frazę do prawdziwej wymiany wiadomości.",
      finalTitle: checkpoint?.[0] || "Napisz wiadomość bez podglądania.",
      finalBody: checkpoint?.[1] || `Napisz krótką wiadomość dla sytuacji „${lesson.title}”. Użyj jednej frazy z lekcji, dopasuj ją do kontekstu i zakończ jasnym następnym krokiem.`,
    };
  }

  return {
    isMessage,
    introTitle: "Najpierw odpowiedz po swojemu.",
    introQuestion: `Wyobraź sobie, że właśnie chcesz ${lesson.goal}. Jak powiedziałabyś to teraz, bez szukania idealnego zdania?`,
    cueTitle: "Powiedz odpowiedź na głos",
    cueNote: "Masz 20 sekund. Nie oceniaj akcentu ani drobnych błędów.",
    transformEyebrow: "04 · SPEAK BEFORE YOU SEE",
    transformTitle: "Zmień intencję w zdanie.",
    transformInstruction: `${lesson.goal}. Powiedz jedną krótką, naturalną wersję po angielsku.`,
    pauseSeconds: 20,
    pauseLabel: "20 sekund ciszy jest częścią ćwiczenia",
    dialogueTitle: "Wstaw frazę do prawdziwej wymiany.",
    finalTitle: checkpoint?.[0] || "Zamknij notatki. Poprowadź 60 sekund.",
    finalBody: checkpoint?.[1] || `Rozpocznij od sytuacji „${lesson.title}”, użyj co najmniej dwóch fraz i płynnie przejdź do kolejnego pytania. Nie zatrzymuj się, żeby poprawiać drobiazgi.`,
  };
}

export { checkpointChallenges };
