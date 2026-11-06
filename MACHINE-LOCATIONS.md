# Lokalizacja maszyn — SkrySkry Fitness 2.0

W widoku Trening przy każdym ćwiczeniu dostępne jest pole „Twoja maszyna / stanowisko”. Wpisz numer maszyny, nazwę albo lokalizację, np. `Maszyna 04 · strefa nóg` lub `Wyciąg przy lustrze`.

Po kliknięciu „Zapisz” wpis jest zapisywany jako rekord `workout` w PostgreSQL z datą, nazwą ćwiczenia, wariantem planu A/B/C i polem `machine`. Przy następnym wejściu w ten sam plan aplikacja pokazuje ostatnio zapisaną lokalizację dla ćwiczenia.

Aktualny kompletny pakiet wdrożeniowy 2.0 jest udostępniony w rozmowie jako `SkrySkry-Fitness-PWA-2.0.zip`. Rozpakuj go i użyj jako źródła Docker Compose w Coolify.