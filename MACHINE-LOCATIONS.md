# Trening — notatki techniczne (SkrySkry Fitness 2.1)

W widoku Trening każde ćwiczenie planu FBW A/B/C ma:
- przycisk **Demo** z wbudowaną animacją SVG i wskazówkami techniki (bez zewnętrznych filmów),
- informację **„Ostatnio (data): serie × powtórzenia @ kg”** z poprzedniego treningu oraz przycisk **„Wpisz to samo”**,
- **timer odpoczynku** (60/90/120 s), który startuje po oznaczeniu serii jako wykonanej.

Po kliknięciu „Zapisz” trening trafia do PostgreSQL jako rekord `workout` (data, wariant planu, lista ćwiczeń z seriami). Zapisywane są tylko ćwiczenia z co najmniej jedną wykonaną serią lub wpisanym ciężarem. Starsze wpisy z angielskimi nazwami ćwiczeń są rozpoznawane i wyświetlane po polsku.

Wdrożenie: repozytorium GitHub jako źródło Docker Compose w Coolify (gałąź `main`; kopia stanu sprzed 2.1 — gałąź `backup-przed-ulepszeniami`).
