# SkrySkry Fitness 2.0

Prywatna aplikacja PWA do prowadzenia redukcji, treningów, diety i pomiarów.

## Nowość 2.0
Przy każdym ćwiczeniu w planie FBW A/B/C znajduje się pole **Twoja maszyna / stanowisko**. Możesz wpisać numer maszyny, nazwę lub lokalizację (np. „Maszyna 04 · strefa nóg”). Zapis trafia do dziennika treningów i jest odtwarzany przy kolejnym wejściu w ten sam plan.

## Wdrożenie
Pakiet projektu: `SkrySkry-Fitness-PWA-2.0.zip` (dołączony w rozmowie). W Coolify wybierz Docker Compose (`docker-compose.yml`), ustaw `ADMIN_USERNAME=skryskry`, własne `ADMIN_PASSWORD` (minimum 12 znaków), `SESSION_SECRET`, `DB_PASSWORD` oraz zgodny `DATABASE_URL`. Wystaw port 3000 i włącz HTTPS.

Uwaga: ustaw hasło wyłącznie w zmiennych środowiskowych Coolify. Nie commituj `.env`.

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
