# SkrySkry Fitness 2.1

Prywatna aplikacja PWA do prowadzenia redukcji, treningów, diety i pomiarów.

## Nowość 2.1
- **Animacje ćwiczeń** – przycisk „Demo” przy każdym ćwiczeniu pokazuje wbudowaną animację SVG (bez YouTube i zewnętrznych zasobów) oraz wskazówki techniki. Nazwy ćwiczeń są po polsku (oryginał w nawiasie).
- **Nowy wygląd** – spójny ciemny motyw (niebieski/różowy), dolna nawigacja: Przegląd · Trening · Dieta · Postępy · Więcej.
- **Trening** – timer odpoczynku 60/90/120 s z wibracją, „Ostatnio: 3×10 @ 40 kg” i przycisk „Wpisz to samo”, poprawiony zapis daty, planu i serii.
- **Dieta i woda** – przełączanie dni, „Ostatnio dodane”, cofanie (toast „Cofnij”) dla posiłków, wody i pomiarów.
- **Postępy** – wykres wagi ze średnią kroczącą i linią celu, edycja/usuwanie pomiarów.
- **Ustawienia per użytkownik** – cele (kcal, makro, woda, waga), kalkulator TDEE, motyw, strefa czasowa; onboarding przy pierwszym logowaniu.
- **Tryb offline** – zmiany zapisane bez internetu są kolejkowane i synchronizowane po powrocie online.
- **Backend** – globalna obsługa błędów, walidacja ID, filtrowanie wpisów po dacie, healthcheck `/api/health`.

## Powrót do poprzedniej wersji
Stan sprzed modernizacji jest zachowany w gałęzi `backup-przed-ulepszeniami`. W Coolify wystarczy zmienić gałąź źródłową na `backup-przed-ulepszeniami` i wykonać Redeploy (dane w bazie pozostają nienaruszone).

## Wdrożenie
W Coolify wybierz Docker Compose (`docker-compose.yml`), ustaw `ADMIN_USERNAME=skryskry`, własne `ADMIN_PASSWORD` (minimum 12 znaków), `SESSION_SECRET` (**wymagany** przy `NODE_ENV=production`), `DB_PASSWORD` oraz zgodny `DATABASE_URL`. Wystaw port 3000 i włącz HTTPS. Pełna lista zmiennych: `.env.example` (nowe zmienne są opcjonalne).

Uwaga: ustaw hasło wyłącznie w zmiennych środowiskowych Coolify. Nie commituj `.env`.

## Rozwój lokalnie
```bash
npm ci
npm run dev        # serwer :3001 + Vite :5173
npm run build      # build produkcyjny do dist/
npm run start:prod # uruchomienie serwera produkcyjnego
```

## Sleeper Build Edition — konfiguracja powiadomień

Aplikacja obsługuje przypomnienia o posiłkach przez Web Push. Aby wysyłać je również po zamknięciu PWA, ustaw w zmiennych środowiskowych Coolify:

- `VAPID_PUBLIC_KEY` — publiczny klucz VAPID
- `VAPID_PRIVATE_KEY` — prywatny klucz VAPID (sekret; nie dodawaj go do repozytorium)
- `VAPID_SUBJECT` — np. `mailto:admin@skryskry.pl`
- `APP_TIMEZONE` — `Europe/Warsaw`

Wygeneruj własną parę kluczy poleceniem `npx web-push generate-vapid-keys`. Po zapisaniu zmiennych wykonaj redeploy. Nie używaj kluczy prywatnych w kodzie ani w repozytorium.

Na iPhonie wymagane jest iOS 16.4 lub nowszy: otwórz aplikację w Safari, wybierz Udostępnij → Dodaj do ekranu początkowego, uruchom ją z nowej ikony i zaakceptuj prośbę o powiadomienia. Godziny posiłków są konfigurowalne w Ustawieniach. Powiadomienia można w dowolnym momencie wyłączyć.


## Dwa niezależne profile

Aplikacja obsługuje dwa osobne konta w tej samej instalacji i bazie PostgreSQL:
- `skryskry` — dotychczasowy profil, niebiesko-zielony motyw i zachowane dane.
- `kieltyczka` — osobny profil z różowym motywem, pustą historią i tym samym planem treningowym.

Wpisy, ustawienia, pomiary, dieta, treningi i osiągnięcia są przypisane do identyfikatora zalogowanego użytkownika. Nie są współdzielone między kontami.

### Utworzenie konta kieltyczka w Coolify

1. Otwórz aplikację w Coolify i przejdź do **Environment Variables**.
2. Dodaj zmienną:
   - **Name:** `KIELTYCZKA_PASSWORD`
   - **Value:** własne, silne hasło o długości co najmniej 12 znaków.
3. Nie dodawaj loginu jako zmiennej — login jest ustawiony na stałe: `kieltyczka`.
4. Zapisz zmienne i wykonaj **Redeploy** aplikacji.
5. Po uruchomieniu otwórz stronę aplikacji i zaloguj się:
   - login: `kieltyczka`
   - hasło: wartość wpisana do `KIELTYCZKA_PASSWORD`.

Konto jest tworzone automatycznie przy starcie aplikacji, jeśli jeszcze nie istnieje i zmienna `KIELTYCZKA_PASSWORD` zawiera co najmniej 12 znaków. Ponowny redeploy nie nadpisuje hasła istniejącego konta. Późniejszą zmianę hasła wykonaj po zalogowaniu w **Ustawienia → Zmiana hasła**.

**Ważne:** nie wpisuj hasła w kodzie, README ani repozytorium GitHub. Ustaw je wyłącznie jako sekret w Coolify. Nie zmieniaj `DATABASE_URL`, `DB_PASSWORD`, `SESSION_SECRET` ani `ADMIN_PASSWORD` podczas dodawania drugiego profilu. Przed wdrożeniem warto wykonać kopię zapasową PostgreSQL.
