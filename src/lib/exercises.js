// Exercise library: Polish name + original name, muscle group, animation id and a short technique note.
// `aliases` keep compatibility with names saved by older app versions (e.g. "Chest Press").

const E = (id, name, original, muscle, anim, tips, aliases = []) => ({ id, name, original, muscle, anim, tips, aliases });

export const EXERCISES = Object.fromEntries([
  // --- Siłownia: klatka / barki / ramiona ---
  E("chest-press", "Wyciskanie na maszynie siedząc", "Chest Press", "Klatka piersiowa", "chest-press",
    "Usiądź tak, by uchwyty były na wysokości środka klatki. Łopatki ściągnięte i oparte o oparcie, wypychaj uchwyty przed siebie bez blokowania łokci. Wracaj powoli, kontrolując ciężar."),
  E("db-bench-press", "Wyciskanie hantli na ławce", "Dumbbell Bench Press", "Klatka piersiowa", "db-bench-press",
    "Połóż się na ławce, stopy stabilnie na podłodze, łopatki ściągnięte. Opuszczaj hantle do boków klatki z łokciami pod kątem ok. 45°. Wypychaj w górę, nie uderzając hantlami o siebie."),
  E("pec-deck", "Rozpiętki na maszynie", "Pec Deck", "Klatka piersiowa", "pec-deck",
    "Ustaw siedzisko tak, by ramiona były na wysokości barków. Łokcie lekko ugięte, zbliżaj ramiona przed sobą, czując napięcie klatki. Wracaj powoli do pełnego rozciągnięcia."),
  E("push-ups", "Pompki", "Push-ups", "Klatka piersiowa", "push-ups",
    "Dłonie nieco szerzej niż barki, ciało w jednej linii od głowy do pięt. Opuszczaj klatkę do podłogi z łokciami skierowanymi lekko w tył. Napnij brzuch i pośladki przez cały ruch."),
  E("wall-pushup", "Pompki przy ścianie lub blacie", "Incline Push-ups", "Klatka piersiowa", "wall-pushup",
    "Oprzyj dłonie o ścianę lub blat na wysokości klatki. Utrzymuj ciało prosto i zginaj łokcie, zbliżając klatkę do podpory. Im niżej podpora, tym trudniejsze ćwiczenie.",
    ["Pompki przy ścianie lub blacie"]),
  E("chair-pushups", "Pompki z dłońmi na krześle", "Chair Push-ups", "Klatka piersiowa", "chair-pushups",
    "Ustaw stabilne krzesło przy ścianie i oprzyj dłonie o krawędź siedziska. Ciało prosto, opuszczaj klatkę do krawędzi i wypychaj się w górę. To łatwiejsza wersja klasycznych pompek."),
  E("shoulder-press", "Wyciskanie nad głowę siedząc", "Shoulder Press", "Barki", "shoulder-press",
    "Usiądź z plecami opartymi o oparcie, uchwyty lub hantle na wysokości barków. Wypychaj ciężar pionowo w górę, nie wyginając odcinka lędźwiowego. Opuszczaj powoli do wysokości uszu."),
  E("lateral-raise", "Unoszenie hantli bokiem", "Lateral Raises", "Barki", "lateral-raise",
    "Stań prosto z lekko ugiętymi łokciami. Unoś hantle bokiem do wysokości barków, prowadząc ruch łokciami. Nie bujaj tułowiem i opuszczaj powoli.",
    ["Lateral Raise"]),
  E("face-pull", "Przyciąganie liny do twarzy", "Face Pull", "Górne plecy", "face-pull",
    "Ustaw wyciąg na wysokości twarzy i chwyć linę nachwytem. Przyciągaj linę do czoła, rozchylając łokcie wysoko na boki. Na końcu ruchu ściągnij łopatki i wróć powoli."),
  E("rear-delt", "Odwrotne rozpiętki na maszynie", "Rear Delt Fly", "Tył barków", "rear-delt",
    "Usiądź przodem do oparcia maszyny, ramiona przed sobą na wysokości barków. Odprowadzaj ramiona szeroko do tyłu z lekko ugiętymi łokciami. Ruch kontrolowany, bez szarpania.",
    ["Mantis", "Pec-deck reverse", "Reverse Pec Deck"]),
  E("biceps-curl", "Uginanie ramion z hantlami", "Biceps Curl", "Biceps", "biceps-curl",
    "Stań prosto, łokcie przy tułowiu. Uginaj ręce, unosząc hantle do barków bez bujania ciałem. Opuszczaj powoli do pełnego wyprostu."),
  E("hammer-curl", "Uginanie ramion chwytem młotkowym", "Hammer Curl", "Biceps", "hammer-curl",
    "Trzymaj hantle chwytem neutralnym (kciuki do góry), łokcie przy bokach. Uginaj ramiona, nie odrywając łokci od tułowia. Opuszczaj ciężar powoli."),
  E("machine-curl", "Uginanie ramion na maszynie", "Machine Curl", "Biceps", "machine-curl",
    "Oprzyj ramiona na podpórce modlitewnika, pachy blisko krawędzi. Uginaj ręce do pełnego skurczu bicepsa. Nie prostuj łokci gwałtownie na dole."),
  E("cable-curl", "Uginanie ramion na wyciągu", "Cable Curl", "Biceps", "cable-curl",
    "Stań przodem do dolnego wyciągu, łokcie przy tułowiu. Uginaj ramiona, przyciągając drążek do klatki. Wyciąg utrzymuje napięcie przez cały ruch – opuszczaj powoli."),
  E("triceps-pushdown", "Prostowanie ramion na wyciągu", "Triceps Pushdown", "Triceps", "triceps-pushdown",
    "Stań przy górnym wyciągu, łokcie przyklejone do boków. Prostuj ręce w dół do pełnego wyprostu, nie ruszając ramionami. Wracaj powoli do kąta ok. 90°."),
  E("triceps-machine", "Prostowanie ramion na maszynie", "Triceps Machine", "Triceps", "triceps-machine",
    "Usiądź prosto i chwyć uchwyty po bokach. Wypychaj uchwyty w dół, prostując łokcie. Barki trzymaj nisko, bez unoszenia ich do uszu."),
  E("chair-dips", "Pompki w podporze tyłem na krześle", "Chair Dips", "Triceps", "chair-dips",
    "Oprzyj dłonie o krawędź stabilnego krzesła za sobą, nogi przed sobą. Zginaj łokcie do ok. 90°, opuszczając biodra blisko krzesła. Wypychaj się w górę siłą tricepsów."),

  // --- Plecy ---
  E("lat-pulldown", "Ściąganie drążka wyciągu górnego", "Lat Pulldown", "Plecy", "lat-pulldown",
    "Usiądź z udami pod wałkami, chwyć drążek szerzej niż barki. Ściągaj drążek do górnej części klatki, prowadząc łokcie w dół. Wracaj powoli do pełnego wyprostu ramion."),
  E("pull-up", "Podciąganie na drążku", "Pull-up", "Plecy", "pull-up",
    "Chwyć drążek nachwytem nieco szerzej niż barki i zawiśnij na prostych rękach. Ściągnij łopatki w dół, a potem podciągnij się, aż broda znajdzie się nad drążkiem. Opuszczaj się powoli, bez bujania.",
    ["Podciąganie", "Pull up", "Pullup", "Pull-ups", "Chin-up"]),
  E("assisted-pull-up", "Podciąganie z gumą lub negatywy", "Assisted / Negative Pull-up", "Plecy", "pull-up",
    "Wersja dla początkujących. Z gumą: zaczep gumę o drążek, wsuń w nią stopę lub kolano i podciągaj się jak zwykle – guma pomaga. Negatywy: wejdź na ławkę z brodą nad drążkiem i opuszczaj się jak najwolniej (3–5 s). W polu POWT. wpisuj liczbę powtórzeń.",
    ["Podciąganie z gumą", "Negatywy", "Negative Pull-up", "Assisted Pull-up"]),
  E("dead-hang", "Zwis na drążku", "Dead Hang", "Plecy", "dead-hang",
    "Chwyć drążek i zawiśnij na prostych rękach, stopy nad podłogą. Barki lekko ściągnięte w dół, spokojny oddech. Wzmacnia chwyt i przygotowuje do podciągania. W polu POWT. wpisz liczbę sekund.",
    ["Zwis", "Hang"]),
  E("seated-row", "Wiosłowanie siedząc na wyciągu", "Seated Row", "Plecy", "seated-row",
    "Usiądź prosto ze stopami na podporze i lekko ugiętymi kolanami. Przyciągaj uchwyt do brzucha, ściągając łopatki. Nie odchylaj się mocno do tyłu.",
    ["Row", "Cable Row"]),
  E("australian-row", "Wiosłowanie w zwisie (australijskie)", "Australian Row", "Plecy", "australian-row",
    "Połóż się pod stabilnym drążkiem lub mocnym stołem i chwyć krawędź. Ciało prosto, przyciągaj klatkę do drążka, ściągając łopatki. Opuszczaj się powoli."),

  // --- Nogi / pośladki ---
  E("leg-press", "Wypychanie nogami na suwnicy", "Leg Press", "Nogi", "leg-press",
    "Stopy na platformie na szerokość bioder, plecy dociśnięte do oparcia. Opuszczaj platformę do kąta ok. 90° w kolanach i wypychaj, nie blokując kolan. Kolana prowadź w linii stóp."),
  E("seated-leg-curl", "Uginanie nóg siedząc", "Seated Leg Curl", "Tył uda", "seated-leg-curl",
    "Ustaw wałek nad piętami, uda dociśnięte. Uginaj nogi pod siebie, aż poczujesz mocne napięcie tyłu uda. Wracaj powoli do wyprostu.",
    ["Leg Curl"]),
  E("lying-leg-curl", "Uginanie nóg leżąc", "Lying Leg Curl", "Tył uda", "lying-leg-curl",
    "Połóż się przodem na maszynie, wałek tuż nad piętami. Uginaj nogi w stronę pośladków bez odrywania bioder od ławki. Opuszczaj powoli."),
  E("leg-extension", "Prostowanie nóg siedząc", "Leg Extension", "Przód uda", "leg-extension",
    "Usiądź głęboko, wałek na dolnej części piszczeli. Prostuj nogi do pełnego wyprostu i zatrzymaj na chwilę. Opuszczaj ciężar powoli.",
    ["Seated Leg Extension"]),
  E("smith-squat", "Przysiad na maszynie Smitha", "Smith Machine Squat", "Nogi", "smith-squat",
    "Gryf na górnej części pleców, stopy lekko przed linią sztangi. Schodź biodrami w dół i w tył do ud równoległych do podłogi. Wstawaj, wypychając podłogę całą stopą."),
  E("hack-squat", "Przysiad na maszynie hack", "Hack Squat", "Nogi", "hack-squat",
    "Oprzyj plecy o oparcie, stopy na środku platformy. Schodź kontrolowanie do kąta 90° w kolanach. Wypychaj się piętami, nie odrywając pleców."),
  E("squats", "Przysiady", "Bodyweight Squat", "Nogi", "squats",
    "Stopy na szerokość barków, palce lekko na zewnątrz. Siadaj biodrami w tył i w dół, klatka do góry, kolana w linii stóp. Wstawaj dynamicznie, napinając pośladki."),
  E("chair-squat", "Przysiady do krzesła", "Box Squat", "Nogi", "chair-squat",
    "Stań przed krzesłem, stopy na szerokość bioder. Siadaj powoli biodrami w tył, aż lekko dotkniesz siedziska. Wstań bez pomagania sobie rękami.",
    ["Przysiady do krzesła"]),
  E("jump-squats", "Przysiady z wyskokiem", "Jump Squats", "Nogi", "jump-squats",
    "Zejdź do przysiadu i dynamicznie wyskocz w górę, pomagając sobie rękami. Ląduj miękko na śródstopiu, od razu przechodząc w kolejny przysiad. Kolana prowadź w linii stóp."),
  E("lunges-in-place", "Wykroki w miejscu", "Static Lunges", "Nogi", "lunges",
    "Stań w rozkroku jedna noga z przodu, druga z tyłu. Opuszczaj tylne kolano w stronę podłogi, tułów prosto. Wypchnij się przednią piętą i powtórz, potem zmień nogę.",
    ["Wykroki w miejscu", "Lunges"]),
  E("db-lunges", "Wykroki z hantlami", "Dumbbell Lunges", "Nogi", "db-lunges",
    "Trzymaj hantle w opuszczonych rękach. Zrób krok w przód i opuść tylne kolano blisko podłogi. Wróć, odpychając się przednią nogą."),
  E("rdl", "Martwy ciąg na prostych nogach (rumuński)", "Romanian Deadlift", "Tył uda", "rdl",
    "Trzymaj sztangę lub hantle przy udach, kolana lekko ugięte. Wypychaj biodra w tył, prowadząc ciężar blisko nóg, plecy proste. Wróć, napinając pośladki."),
  E("glute-bridge", "Most biodrowy", "Glute Bridge", "Pośladki", "glute-bridge",
    "Połóż się na plecach, stopy blisko pośladków. Unieś biodra, napinając pośladki, aż ciało utworzy linię od kolan do barków. Zatrzymaj na sekundę i opuść powoli.",
    ["Most biodrowy"]),
  E("hip-thrust", "Wypychanie bioder z oparciem o ławkę", "Hip Thrust", "Pośladki", "hip-thrust",
    "Oprzyj łopatki o ławkę, stopy na szerokość bioder. Wypychaj biodra w górę do linii prostej z tułowiem, broda lekko przy klatce. Na górze mocno napnij pośladki."),
  E("abductor", "Odwodzenie nóg na maszynie", "Hip Abductor", "Pośladki", "abductor",
    "Usiądź prosto, poduszki po zewnętrznej stronie kolan. Rozsuwaj nogi na boki, napinając pośladki. Wracaj powoli, nie pozwalając ciężarkom uderzyć."),
  E("adductor", "Przywodzenie nóg na maszynie", "Hip Adductor", "Przywodziciele", "adductor",
    "Usiądź prosto, poduszki po wewnętrznej stronie kolan. Ściskaj nogi do środka w kontrolowanym tempie. Otwieraj je powoli do wygodnego rozciągnięcia."),
  E("standing-calves", "Wspięcia na palce stojąc", "Standing Calf Raise", "Łydki", "calf-raise",
    "Stań prosto, przednia część stóp na podwyższeniu lub podłodze. Wspinaj się wysoko na palce i zatrzymaj na sekundę. Opuszczaj pięty powoli, rozciągając łydki."),
  E("calf-machine", "Wspięcia na palce na maszynie", "Calf Machine", "Łydki", "calf-machine",
    "Ustaw wałki na barkach, palce stóp na krawędzi platformy. Wspinaj się na palce, prostując kostki. Opuszczaj pięty poniżej platformy dla pełnego zakresu."),

  // --- Brzuch / stabilizacja / kondycja ---
  E("plank", "Deska (plank)", "Plank", "Brzuch", "plank",
    "Oprzyj się na przedramionach i palcach stóp, łokcie pod barkami. Ciało w jednej linii, brzuch i pośladki napięte. Oddychaj spokojnie i nie unoś bioder."),
  E("knee-plank", "Deska na kolanach", "Knee Plank", "Brzuch", "knee-plank",
    "Oprzyj się na przedramionach i kolanach, łokcie pod barkami. Ciało od kolan do głowy w jednej linii. Napnij brzuch i oddychaj spokojnie.",
    ["Deska na kolanach"]),
  E("side-plank", "Deska bokiem", "Side Plank", "Brzuch", "side-plank",
    "Połóż się bokiem, oprzyj na przedramieniu, łokieć pod barkiem. Unieś biodra, tworząc prostą linię ciała. Utrzymaj pozycję, nie pozwalając biodrom opadać."),
  E("bird-dog", "Naprzemienne wyprosty w klęku (bird dog)", "Bird Dog", "Stabilizacja", "bird-dog",
    "Klęknij w podporze, dłonie pod barkami, kolana pod biodrami. Wyprostuj jednocześnie przeciwną rękę i nogę, utrzymując stabilny tułów. Wróć powoli i zmień stronę.",
    ["Bird dog"]),
  E("mountain-climbers", "Wspinaczka górska", "Mountain Climbers", "Brzuch", "mountain-climbers",
    "Ustaw się w podporze na dłoniach, ciało prosto. Naprzemiennie przyciągaj kolana do klatki w szybkim tempie. Biodra trzymaj nisko, a barki nad dłońmi."),
  E("burpees", "Burpees (padnij-powstań)", "Burpees", "Całe ciało", "burpees",
    "Z pozycji stojącej zejdź do przysiadu i oprzyj dłonie o podłogę. Wyrzuć nogi do podporu, wróć do przysiadu i wyskocz w górę. Tempo dopasuj do swoich możliwości."),
  E("jump-rope", "Skakanka", "Jump Rope", "Kondycja", "jump-rope",
    "Trzymaj łokcie blisko tułowia, kręć skakanką nadgarstkami. Skacz nisko, lądując miękko na śródstopiu. Zacznij od krótkich serii z przerwami.")
].map(ex => [ex.id, ex]));

export const exerciseLabel = ex => (ex ? `${ex.name} (${ex.original})` : "");

const norm = s => String(s || "").toLocaleLowerCase("pl-PL").replace(/\s+/g, " ").trim();
const lookup = new Map();
for (const ex of Object.values(EXERCISES)) {
  for (const key of [ex.id, ex.name, ex.original, exerciseLabel(ex), ...ex.aliases]) lookup.set(norm(key), ex);
}

/** Finds a library exercise by id, Polish/original name, "Polish (Original)" label or legacy alias. */
export function findExercise(nameOrId) {
  if (!nameOrId) return null;
  const key = norm(nameOrId);
  if (lookup.has(key)) return lookup.get(key);
  const inParens = key.match(/\(([^)]+)\)\s*$/);
  if (inParens && lookup.has(inParens[1])) return lookup.get(inParens[1]);
  return null;
}

/** Stable comparison key for an exercise saved in a workout entry. */
export function exerciseKey(ex) {
  if (!ex) return "";
  if (ex.exId && EXERCISES[ex.exId]) return ex.exId;
  return findExercise(ex.name)?.id || norm(ex.name);
}

// Fallback animation for custom exercises, chosen by muscle group.
const MUSCLE_ANIM = {
  "Klatka piersiowa": "chest-press", "Plecy": "seated-row", "Nogi": "squats", "Barki": "shoulder-press",
  "Biceps": "biceps-curl", "Triceps": "triceps-pushdown", "Brzuch": "plank", "Pośladki": "glute-bridge",
  "Tył uda": "rdl", "Przód uda": "leg-extension", "Łydki": "calf-raise", "Górne plecy": "face-pull"
};
export function animationFor(ex) {
  const lib = ex?.exId ? EXERCISES[ex.exId] : findExercise(ex?.name);
  if (lib) return { anim: lib.anim, generic: false, lib };
  return { anim: MUSCLE_ANIM[ex?.muscle] || "squats", generic: true, lib: null };
}

export const MUSCLES = ["Klatka piersiowa", "Plecy", "Nogi", "Barki", "Biceps", "Triceps", "Brzuch", "Pośladki", "Inne"];

// Training plans (same structure as before, now referencing library ids).
export const PLANS = {
  A: { short: "A", name: "FBW A — Poniedziałek", focus: "Całe ciało + stabilizacja", items: [
    ["chest-press", "3 × 10–12"], ["lat-pulldown", "3 × 10–12"], ["leg-press", "3 × 12"], ["seated-leg-curl", "3 × 12"],
    ["biceps-curl", "2 × 12"], ["triceps-pushdown", "2 × 12"], ["glute-bridge", "2 × 12"]] },
  B: { short: "B", name: "FBW B — Środa", focus: "Całe ciało + brzuch", items: [
    ["db-bench-press", "3 × 10–12"], ["seated-row", "3 × 12"], ["leg-extension", "3 × 12"], ["seated-leg-curl", "3 × 12"],
    ["lateral-raise", "2 × 15"], ["face-pull", "2 × 15"], ["glute-bridge", "2 × 12"]] },
  C: { short: "C", name: "FBW C — Piątek", focus: "Całe ciało + stabilizacja", items: [
    ["chest-press", "3 × 12"], ["lat-pulldown", "3 × 12"], ["leg-press", "3 × 12"], ["hip-thrust", "2 × 12"],
    ["biceps-curl", "2 × 12"], ["triceps-pushdown", "2 × 12"], ["side-plank", "2 × 15–20 s"]] },
  HOME: { short: "DOM", name: "Trening domowy", focus: "Bez sprzętu · spokojne tempo", items: [
    ["chair-squat", "3 × 12"], ["wall-pushup", "3 × 8–12"], ["glute-bridge", "3 × 15"], ["bird-dog", "2 × 10 / strona"],
    ["lunges-in-place", "2 × 8 / noga"], ["knee-plank", "3 × 20 s"]] }
};

export const parseScheme = scheme => {
  const s = String(scheme || "");
  return {
    sets: Math.max(1, Math.min(10, Number(s.match(/^(\d+)/)?.[1] || 3))),
    reps: s.match(/×\s*(\d+)/)?.[1] || "10",
    seconds: /\d\s*s\b/.test(s)
  };
};
