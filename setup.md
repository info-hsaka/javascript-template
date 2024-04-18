## 1 Github

### 1.1 Account erstellen

Erstelle zunächst einen Github Account, falls du noch keinen hast. Klicke dazu [hier](https://github.com/signup), gib deine Email an und wähle ein Passwort und einen Nutzernamen aus.

![](./setup_pictures/GithubSignup.png)

### 1.2 Repository forken

Sobald du deine Email verifiziert hast, kannst du eine Kopie des Tutorial Repositories erstellen, in dem du während der Vorbereitung arbeiten und deine Lösungen hochladen wirst.
In Git nennt man diese Art von Kopie auch einen "Fork"

Öffne dazu die Github Seite des Repositories [hier](https://github.com/info-hsaka/javascript-template).

Drück auf den 'Fork'-Knopf
![](./setup_pictures/Fork1.png)

und lass alle Einstellungen auf ihren Defaultwerten.
![](./setup_pictures/Fork2.png)

Wenn alles funktioniert hat, sollte nach 2-3 Sekunden folgender Screen zu sehen sein:

![](./setup_pictures/ForkSuccess.png)

Du hast jetzt eine Kopie des Repositories, als nächstes setzen wir VSCode auf und laden das Repo herunter, damit du mit dem Tutorial loslegen kannst.

Merke dir die URL deines Repositories, da wir die später noch brauchen. Die URL sollte folgendes Format haben:
https://github.com/USERNAME/javascript-template

## 2 VSCODE

### 2.1 VSCode installieren

Den Installer für VSCode kannst du [hier](https://code.visualstudio.com/Download) herunterladen.
Sobald du VSCode installiert hast, solltest du folgenden Screen sehen:
![](./setup_pictures/VSCodeStartScreen.png)

### 2.2 Extensions

Drücke zuerst auf den markierten Extension Button auf der linken Seite, um den Marktplatz zu öffnen. Hier kannst du nach Erweiterungen suchen um VSCode zu modifizieren.

#### Prettier

Suche und installiere die Extension `Prettier - Code formatter` von Prettier

![](./setup_pictures/VSCodePrettier.png)

#### Git Graph

Suche und installiere die Extension `Git Graph` von mhutchie

![](./setup_pictures/VSCodeGitGraph.png)

### 2.3 Config

Verwende die Tastenkombination `Strg+Shift+P` um die Befehlspalette von VSCode zu öffnen.

![](./setup_pictures/VSCodeCommandPalette.png)

Über die Befehlspalette kannst du alle möglichen Funktionen von VSCode aufrufen. Suche erstmal nach `Preferences: Open User Settings (JSON)` und drücke enter

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

Damit du endlich mit dem Tutorial loslegen kannst, musst du das Repository noch herunterladen. Auch das kannst du über die Befehlspalette von VSCode tun. Drücke dazu erneut `Strg+Shift+P`, und suche nach `Git: clone`.

![](./setup_pictures/GitClone.png)

Drücke Enter, und gebe nun die URL deines geforkten Repositories an:

![](./setup_pictures/GitCloneURL.png)

Noch einmal Enter, und du musst nur noch einen Ordner angeben, in dem das Repository gespeichert werden soll. Nach dem Herunterladen, fordert dich VSCode dazu auf das heruntergeladene Repo zu öffnen.

![](./setup_pictures/GitCloneOpen.png)

Evtl musst du noch bestätigen, dass du den Erstellern des Repositories vertraust 😉.

![](./setup_pictures/GitCloneTrust.png)

Jetzt bist du endlich ready loszulegen!

### 2.5 Git Commit

Sobald du Aufgaben gelöst hast oder einen Zwischenstand sichern möchtest, musst du deine Änderungen in Git "speichern". Diesen Prozess nennt man "Comitten".

Um zu comitten kannst du in VSCode das `Source Controle` Panel öffnen

![](./setup_pictures/GitCommit1.png)

Hier wird dier eine Liste aller **Changes** angezeigt, die noch nicht in Git comitted sind.
Du kannst Dateien über die Plus-/Minus-Symbole zur Liste der **Staged Changes** hinzufügen oder entfernen.
Nur Staged Changes werden beim Comitten beachtet, nicht gestagte Dateien werden ignoriert.

![](./setup_pictures/GitCommit2.png)

Um deine Änderungen zu speichern musst du oben in das Textfeld noch eine Commit-**Message** schreiben, die am besten kurz beschreiben sollte welche Änderungen du in diesem Commit gemacht hast.

### 2.6 Git Push

Sobald du deine Änderungen committet hast, sind sie lokal in Git gespeichert. Um sie auch in Github zu speichern musst du deine Commits noch **pushen**.

#### Push in VSCode

Am einfachsten fasst du das Comitten und Pushen in einem Schritt zusammen und verwendest den kleinen Pfeil rechts von Commit und dann die Option `Commit & Push`
![](./setup_pictures/GitPushDirect.png)

Alternativ, wenn du bereits comittet hast, kannst du rechtsklick auf `main` unter **Outgoing** drücken und `Push` auswählen.

![](./setup_pictures/GitPushIndirect.png)

#### Git Auth

Beim ersten pushen wirst du von Git aufgefordert dich zu authentifizieren.
Wähle in dem sich öffnenden Fenster `Sign in with your Browser` aus.
![](./setup_pictures/GitPushAuth.png)

Dein Browser sollte sich öfnnen, evtl musst du hier noch einmal dein Github-Benutzernamen/Passwort angeben und bestätigen, dass VSCode auf dein Github Repository zugreifen darf.
Wenn alles geklappt hat, solltest du folgenden Screen sehen:

![](./setup_pictures/GitPushAuth2.png)
