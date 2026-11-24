# SkrySkry Fitness 2.3.1

Prywatna aplikacja PWA do prowadzenia redukcji, treningów, diety i pomiarów.

## Poprawka 2.3.1 – AI i skanowanie na stronie Jedzenie
- Czytelne komunikaty zamiast ogólnego „spróbuj później”: brak klucza, zły klucz, brak środków, zła nazwa modelu, awaria bazy produktów.
- AI ponawia zapytanie przy chwilowym błędzie, a przy złej zmiennej `ABACUS_MODEL` samo wraca do domyślnego modelu.
- Skaner EAN ma zapasowe adresy Open Food Facts i ponowienia; gdy baza nie działa, od razu proponuje AI lub ręczne wpisanie.
- Przycisk **„Sprawdź, co nie działa”** (pojawia się po błędzie) i endpoint `GET /api/diagnostics` pokazują, czy działa AI i baza produktów. W logach Coolify widać przyczynę (`[AI]`, `[OFF]`, `[DIAG]`), a przy starcie linię `[AI] włączone…` albo `[AI] WYŁĄCZONE…`.
- **Wymagane w Coolify:** zmienna `ABACUS_API_KEY` z kluczem API z Abacus.AI. `ABACUS_MODEL` najlepiej nie ustawiać.

## Nowość 2.3 – cele i rozbudowane drzewko
- **Moje cele** (zakładka „Drzewko”) – przycisk „Dodaj cel” pozwala wybrać gotowy cel (np. pierwsze / 5 / 10 podciągnięć, wyciskanie na maszynie 60/80/100 kg, suwnica, pompki 10/20/30, deska 60 s) albo ustawić własny: ćwiczenie + ciężar w kg, liczba powtórzeń lub sekundy.
- Postęp liczy się sam z zapisanych treningów (tylko serie odhaczone jako zrobione): pasek postępu, aktualny rekord vs cel i data osiągnięcia. Cel można usunąć.
- **Nowe ćwiczenia**: „Podciąganie na drążku”, „Podciąganie z gumą lub negatywy” (dla początkujących) i „Zwis na drążku” – z animacją. Przy dodawaniu własnego ćwiczenia pojawiają się podpowiedzi z biblioteki.
- **Drzewko osiągnięć** – 4 gałęzie (Nawyki, Dieta, Siła i rekordy, Waga i pomiary), XP, poziomy z nazwami (od Nowicjusza do Legendy) i +75 XP za każdy osiągnięty cel.
- Cele zapisują się osobno dla każdego profilu. Nie trzeba żadnych nowych zmiennych środowiskowych.

## Co nowego w 2.2
- **AI przez Abacus.AI zamiast OpenAI** – szacowanie kalorii i makro posiłków oraz analiza coacha korzystają z Abacus.AI RouteLLM (model domyślnie `gpt-4.1-mini`). Wystarczy opisać posiłek, np. „2 jajka sadzone i kromka chleba z masłem” – AI zwraca kcal, B/W/T i rozbicie na składniki.
- **Naprawiony EAN** – sprawdzanie cyfry kontrolnej (błędnie odczytane kody są odrzucane od razu), obsługa EAN-8/EAN-13/UPC, zapytania do kilku wersji API Open Food Facts, cache wyników. Brak produktu w bazie to teraz jasny komunikat z przyciskami „Oszacuj przez AI” i „Dodaj ręcznie” (wcześniej mylące „Nie można połączyć się…”).
- **Lepszy skaner** – rozpoznaje tylko kody produktów (EAN/UPC), szybszy odczyt, latarka (jeśli telefon ją obsługuje), wibracja po odczycie i przycisk „Wpisz kod ręcznie”.
- **Wyszukiwarka jedzenia** – wyniki pojawiają się w trakcie pisania: najpierw wbudowana baza ok. 175 podstawowych produktów (jajka, pierś z kurczaka, ryż, banan…), potem polskie produkty ze sklepów z Open Food Facts (ze zdjęciem i marką). Gwiazdka dodaje produkt do **ulubionych**. Po wybraniu produktu widać kartę z kcal i makro przeliczanymi na żywo oraz przycisk porcji.
- **Limity** – ochrona przed nadużyciami: 40 wyszukiwań/min i 60 zapytań AI/h na użytkownika.

### Konfiguracja AI (Coolify)
1. Wygeneruj klucz w Abacus.AI: **RouteLLM API → API Keys**.
2. W Coolify → aplikacja → **Environment Variables** dodaj `ABACUS_API_KEY=<twój klucz>` (opcjonalnie `ABACUS_MODEL`, domyślnie `gpt-4.1-mini`).
3. Zrób **Redeploy**. Bez klucza aplikacja działa normalnie – wyszukiwarka, baza podstawowa i skaner EAN nie wymagają AI.

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
W Coolify wybierz Docker Compose (`docker-compose.yml`), ustaw `ADMIN_USERNAME=skryskry`, własne `ADMIN_PASSWORD` (minimum 12 znaków), `SESSION_SECRET` (zalecany; jeśli go brak, aplikacja sama wygeneruje losowy sekret i zapisze go w bazie), `DB_PASSWORD` oraz zgodny `DATABASE_URL`. Wystaw port 3000 i włącz HTTPS. Pełna lista zmiennych: `.env.example` (nowe zmienne są opcjonalne).

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
