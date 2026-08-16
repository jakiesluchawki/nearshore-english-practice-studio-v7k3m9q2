# Nearshore English

Praktyczna aplikacja do codziennego angielskiego dla IT recruiterki pracującej w zespole nearshore.

## Co zawiera

- 100 gotowych lekcji po 15–20 minut;
- pełny recruitment lifecycle: sourcing, screening, projekt, tech stack, logistyka, feedback, oferta i negocjacje;
- tryb „Help, My Brain Is Empty” i 18 szybkich ściąg;
- lokalny postęp, zapis własnych fraz i lekki mechanizm Again / Hard / Good;
- generator promptów do dalszej pracy w ChatGPT — bez API i bez automatycznego wysyłania danych;
- wymowę fraz przez wbudowaną syntezę mowy przeglądarki.

## Prywatność

Brama hasłowa działa po stronie przeglądarki i ma ograniczyć przypadkowy dostęp. GitHub Pages jest hostingiem statycznym, więc nie jest to zabezpieczenie odpowiednie dla poufnych danych. Aplikacja nie zawiera danych kandydatów ani klientów.

## Lokalne uruchomienie

```bash
npm ci
npm run dev
```

## Kontrola jakości

```bash
npm run test:content
npm run build:pages
```
