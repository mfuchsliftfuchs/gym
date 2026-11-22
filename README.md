# Gym

Trainingslog fürs iPhone: Gewicht und Wiederholungen pro Satz, Trainingspläne, Steigerungsvorschlag, Pausentimer, Körpergewicht und Fortschrittskurven. Läuft als Web-App ohne Server, die Daten bleiben auf dem iPhone.

## 1. Online stellen (GitHub Pages, einmalig)

1. Auf github.com: **New repository**, Name `gym`, **Public**, ohne README anlegen.
2. In diesem Ordner im Terminal ausführen (`DEINNAME` = dein GitHub-Benutzername):

   ```powershell
   git init -b main
   git add .
   git commit -m "Gym App"
   git remote add origin https://github.com/DEINNAME/gym.git
   git push -u origin main
   ```

   Beim ersten Push öffnet sich ein Browserfenster zur GitHub-Anmeldung.
3. Auf GitHub im Repo: **Settings → Pages → Branch: main, Ordner / (root) → Save**.
4. Nach ca. 1 Minute ist die App unter `https://DEINNAME.github.io/gym/` erreichbar.

Spätere Änderungen: `git add .`, `git commit -m "..."`, `git push`. Das iPhone holt sich die neue Version beim übernächsten Öffnen.

## 2. Aufs iPhone holen

1. Die Adresse in **Safari** öffnen (nicht Chrome).
2. **Teilen → Zum Home-Bildschirm**.
3. Die App ab jetzt immer über das Homescreen-Symbol öffnen. Nur dort bleiben die Daten dauerhaft gespeichert.

## 3. Kurzbefehl für den iPhone-Timer (optional)

Der Button **iPhone-Timer** in der Pausenleiste startet den Timer der Uhr-App. Dafür einmal anlegen:

1. App **Kurzbefehle** öffnen, **+** tippen.
2. Kurzbefehl **Gym Pause** nennen (genau so geschrieben).
3. Aktion **Timer starten** hinzufügen.
4. Bei der Dauer die Variable **Kurzbefehleingabe** wählen und als Einheit **Sekunden** einstellen.
5. Fertig. Die App übergibt die restliche Pausenzeit in Sekunden.

Danach wechselt das iPhone kurz in die Kurzbefehle-App. Zurück geht es über das Symbol links oben oder durch Wischen.

## 4. Backup

Unter **Training → Backup exportieren** in **Dateien → iCloud Drive** speichern. Wiederherstellen über **Backup importieren**. Wenn das letzte Backup älter als 14 Tage ist, erinnert dich die App.

## Entwicklung

- Lokal testen: `python -m http.server 5173`, dann http://localhost:5173 öffnen.
- Logik-Selbsttest: `node test.mjs`
- Übungsdatenbank: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense), auf Name, Muskel und Gerät gekürzt.
