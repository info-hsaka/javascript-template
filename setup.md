# Einführung

IRGENDWELCHE EINFÜHRUNGSSÄTZE

## 1) Github

### 1.1 Account erstellen

Erstelle zunächst einen Github Account, falls du noch keinen hast. Klick dazu [hier](https://github.com/signup), gib deine Email an und wähle ein Passwort und einen Nutzernamen aus.

![](./setup_pictures/GithubSignup.png)

### 1.2 Repository forken

Sobald du deine Email verifiziert hast, kannst du eine kopie des Tutorial Repositories erstellen, in dem du während der Vorbereitung arbeiten und deine Lösungen hochladen wirst.
In Git nennt man diese Art von Kopie auch einen "Fork"

Öffne dazu die Github Seite des Repositories [hier](https://github.com/info-hsaka/javascript-template).

Drück auf den "Fork"-Knopf
![](./setup_pictures/Fork1.png)

und lass alle Einstellungen auf ihren Defaultwerten.
![](./setup_pictures/Fork2.png)

Wenn alles funktioniert hat, sollte nach 2-3 Sekunden folgender Screen zu sehen sein:

![](./setup_pictures/ForkSuccess.png)

Du hast jetzt eine Kopie Des Repositories, als nächstes setzen wir VSCode auf und laden das Repo herunter, damit du mit dem Tutorial loslegen kannst.

Merk dir die URL deines Repositories, da wir die später noch brauchen, sie hat wahrscheinlich folgendes Format:
https://github.com/USERNAME/javascript-template

## 2) VSCODE

### 2.1 VSCode installieren

Den Installer für VSCode kannst du [hier](https://code.visualstudio.com/Download) herunterladen.
Sobald du VSCode installiert hast, solltest du folgenden Screen sehen:
![](./setup_pictures/VSCodeStartScreen.png)

### 2.2 Extensions

Drück zuerst auf den markierten Extension Button auf der linken Seite, um den Marketplace zu öffnen. Hier kannst du nach Erweiterungen suchen um VSCode zu modifiezieren.

#### Prettier

Such und installiere die Extension `Prettier - Code formatter` von Prettier

![](./setup_pictures/VSCodePrettier.png)

#### Git Graph

Such und installiere die Extension `Git Graph` von mhutchie

![](./setup_pictures/VSCodeGitGraph.png)

### 2.3 Config

Verwende die Tastenkombination `Strg+Shift+P` um die Kommandopalette von VSCode zu öffnen.

![](./setup_pictures/VSCodeCommandPalette.png)

Über die Komandopalette kannst du alle möglichen Funktionen von VSCode aufrufen. Suche erstmal nach `Preferences: Open User Settings (JSON)` und drücke enter

![](./setup_pictures/VSCodeCommandPalette2.png)

Es sollte sich eine Datei namens settings.json öffnen.
Ersetze den Inhalt der Datei durch das folgende:

```
{
    "[javascript]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "editor.formatOnSave": true,
    "editor.formatOnPaste": true
}

```

### 2.4 Clone Git Repository

Damit du endlich mit dem Tutorial loslegen kannst, musst du das Repository noch herunterladen. Das kannst du auch über die Kommandopalette von VSCode tun. Drücke dazu wieder `Strg+Shift+P`, und suche nach `Git: clone`.

![](./setup_pictures/GitClone.png)

Drücke Enter, und gebe jetzt die URL deines geforkten Repositories an:

![](./setup_pictures/GitCloneURL.png)

Nocheinmal Enter, und du musst nur noch einen Ordner angeben, in dem das Repository gespeichert werden soll. Nach dem Herunterladen, fordert dich VSCode dazu auf das heruntergeladene Repo zu öffnen.

![](./setup_pictures/GitCloneOpen.png)

Evtl musst du noch bestätigen, dass du den Erstellern des Repositories vertraust 😉.

![](./setup_pictures/GitCloneTrust.png)

Jetzt bist du endlich ready loszulegen!

### 2.5 Git Commit

Sobald du Aufgaben gelöst hast oder einen Zwischenstand sichern möchtest, musst du deine Änderungen in Git "speichern". Diesen Prozess nennt man "Comitten".

### 2.6 Git Push
