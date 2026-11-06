# SkrySkry Fitness 2.0

Prywatna aplikacja PWA do prowadzenia redukcji, treningów, diety i pomiarów.

## Nowość 2.0
Przy każdym ćwiczeniu w planie FBW A/B/C znajduje się pole **Twoja maszyna / stanowisko**. Możesz wpisać numer maszyny, nazwę lub lokalizację (np. „Maszyna 04 · strefa nóg”). Zapis trafia do dziennika treningów i jest odtwarzany przy kolejnym wejściu w ten sam plan.

## Wdrożenie
Pakiet projektu: `SkrySkry-Fitness-PWA-2.0.zip` (dołączony w rozmowie). W Coolify wybierz Docker Compose (`docker-compose.yml`), ustaw `ADMIN_USERNAME=skryskry`, własne `ADMIN_PASSWORD` (minimum 12 znaków), `SESSION_SECRET`, `DB_PASSWORD` oraz zgodny `DATABASE_URL`. Wystaw port 3000 i włącz HTTPS.

Uwaga: ustaw hasło wyłącznie w zmiennych środowiskowych Coolify. Nie commituj `.env`.