@echo off
echo.
echo ==========================================
echo  Angelkarte auf GitHub hochladen
echo ==========================================
echo.

:: Pruefen ob Git installiert ist
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo FEHLER: Git ist nicht installiert!
    echo.
    echo Bitte herunterladen von: https://git-scm.com/download/win
    echo Nach der Installation dieses Script nochmal starten.
    pause
    exit /b
)

echo Git gefunden. Weiter...
echo.

:: In den Norge-Ordner wechseln
cd /d C:\Norge

:: Git konfigurieren
git config --local user.name "fbsgn"
git config --local user.email "deine@email.com"

:: Repository initialisieren falls noch nicht vorhanden
if not exist ".git" (
    echo Initialisiere Git-Repository...
    git init
    git branch -M main
    git remote add origin https://github.com/fbsgn/angelkarte.git
)

:: Dateien hinzufuegen und committen
echo Dateien werden hinzugefuegt...
git add index.html upload.bat angelkarte-public.html README.md

echo Erstelle Commit...
git commit -m "Angelkarte aktualisiert" 2>nul || echo (Keine neuen Aenderungen)

:: Hochladen
echo.
echo Lade hoch zu GitHub...
echo (Browser-Fenster fuer Anmeldung kann sich oeffnen)
echo.
git stash
git pull origin main --rebase
git stash pop
git push -u origin main

echo.
echo ==========================================
if %errorlevel% equ 0 (
    echo  FERTIG! Karten sind online unter:
    echo  Deine Karte:   https://fbsgn.github.io/angelkarte-data/
    echo  Forum-Version: https://fbsgn.github.io/angelkarte-data/angelkarte-public.html
) else (
    echo  FEHLER beim Hochladen.
    echo  Stelle sicher dass das Repository existiert:
    echo  https://github.com/new  ^(Name: angelkarte, Public^)
)
echo ==========================================
echo.
pause
