# Nearshore English

Praktyczna aplikacja do codziennego angielskiego dla IT recruiterki pracującej w zespole nearshore.

## Co zawiera

- 100 gotowych lekcji i prowadzoną, 17-minutową sesję na każdy dzień;
- pełny recruitment lifecycle: sourcing, screening, projekt, tech stack, logistyka, feedback, oferta i negocjacje;
- 100 kontekstowych quizów, ćwiczenia PL → EN, uzupełnianie zdań i prawdziwe timery odpowiedzi;
- oddzielne powtórki konkretnych fraz, własny phrasebook, historię praktyki i prawdziwą serię dni;
- tryb „Help, My Brain Is Empty” z natychmiast dostępnymi zdaniami oraz 18 szybkich ściąg;
- kompletny, 12-etapowy screening, zwarty tryb rozmowy i osobisty skrypt budowany z zapisanych fraz;
- odsłuch wymowy, opcjonalne lokalne nagrywanie i rozpoznawanie mowy w obsługiwanych przeglądarkach;
- generator promptów z kontekstem lekcji i własnych fraz, bez klucza API i automatycznego wysyłania danych;
- lokalny eksport i import postępu między przeglądarkami.

## Prywatność

Brama hasłowa działa po stronie przeglądarki i ma ograniczyć przypadkowy dostęp. GitHub Pages jest hostingiem statycznym, więc nie jest to zabezpieczenie odpowiednie dla poufnych danych. Aplikacja nie zawiera danych kandydatów ani klientów.

Nagrania odpowiedzi pozostają w bieżącej karcie. Opcjonalne rozpoznawanie mowy jest funkcją przeglądarki i, zależnie od jej dostawcy, może wykorzystywać jego usługę. Mikrofon uruchamia się dopiero po wyraźnej akcji użytkowniczki.

## Lokalne uruchomienie

```bash
npm ci
npm run dev
```

## Kontrola jakości

```bash
npm run test:content
npm run test:routes
npm run build:pages
npm run build
npm run test:sites
```
