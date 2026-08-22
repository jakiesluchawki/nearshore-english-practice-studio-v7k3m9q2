# Nearshore English

Praktyczna aplikacja do codziennego angielskiego dla IT recruiterki pracującej w zespole nearshore.

## Co zawiera

- 100 gotowych lekcji i prowadzoną, 17-minutową sesję na każdy dzień;
- pełny recruitment lifecycle: sourcing, screening, projekt, tech stack, logistyka, feedback, oferta i negocjacje;
- 100 kontekstowych quizów, ćwiczenia PL → EN, uzupełnianie zdań i prawdziwe timery odpowiedzi;
- oddzielne powtórki konkretnych fraz, własny phrasebook, historię praktyki i prawdziwą serię dni;
- tryb „Help, My Brain Is Empty” z natychmiast dostępnymi zdaniami oraz 18 szybkich ściąg;
- kompletny, 12-etapowy screening, zwarty tryb rozmowy i osobisty skrypt budowany z zapisanych fraz;
- odsłuch wymowy, wyraźnie oddzielone lokalne nagrywanie i dyktowanie odpowiedzi oraz pomoc przy problemach z mikrofonem;
- ocenę pojedynczej odpowiedzi albo pełnej rozmowy przez gotowy prompt do ChatGPT, bez klucza API i automatycznego wysyłania danych;
- lokalny eksport i import postępu między przeglądarkami.
- rozgałęzione symulacje rozmów z ośmioma kandydatami, w formatach 5, 15 i 30 minut;
- trening refleksu, odsłuch kandydata przed pokazaniem tekstu i pełny transcript do oceny w ChatGPT;
- anonimowy generator rozmowy przed telefonem, osiem pakietów specjalizacji IT i 16 trudnych sytuacji;
- ćwiczenia komunikacji z klientem, wiadomości rekrutacyjne, 18 częstych kalek oraz prywatny dziennik trudnych momentów;
- dziesięć autorskich filcowych ilustracji, widocznych we wszystkich modułach oraz we wszystkich stu lekcjach;
- instalację na ekranie telefonu i dostęp offline po pierwszym załadowaniu.

## Prywatność

Brama hasłowa działa po stronie przeglądarki i ma ograniczyć przypadkowy dostęp. GitHub Pages jest hostingiem statycznym, więc nie jest to zabezpieczenie odpowiednie dla poufnych danych. Aplikacja nie zawiera danych kandydatów ani klientów.

Nagrania odpowiedzi pozostają w bieżącej karcie i służą wyłącznie do odsłuchu. Dyktowanie wpisuje tekst do pola odpowiedzi, ale jest funkcją przeglądarki i, zależnie od jej dostawcy, może wykorzystywać jego usługę oraz wymagać internetu. W Brave usługa może być niedostępna mimo działającego mikrofonu; wtedy można użyć systemowego dyktowania albo innej przeglądarki. Mikrofon uruchamia się dopiero po wyraźnej akcji użytkowniczki. Ocena odpowiedzi powstaje dopiero po samodzielnym wklejeniu promptu do ChatGPT.

## Lokalne uruchomienie

```bash
npm ci
npm run dev
```

## Kontrola jakości

```bash
npm run test:content
npm run test:fieldwork
npm run test:voice
npm run test:privacy
npm run test:pwa
npm run test:routes
npm run build:pages
npm run build
npm run test:sites
```
