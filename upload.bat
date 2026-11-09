@echo off
setlocal
echo.
echo ==========================================
echo  Angelkarte auf GitHub hochladen
echo ==========================================
echo.

git --version >nul 2>&1
if errorlevel 1 (
    echo FEHLER: Git ist nicht installiert!
    echo Download: https://git-scm.com/download/win
    pause
    exit /b 1
)

cd /d C:\Norge

if not exist ".git" (
    echo Initialisiere Git-Repository...
    git init
    git branch -M main
    git remote add origin https://github.com/fbsgn/angelkarte-data.git
)

:: Remote immer auf das richtige Repo setzen (frueher: angelkarte.git)
git remote set-url origin https://github.com/fbsgn/angelkarte-data.git

:: Nur Web-Dateien hinzufuegen - NIE "git add ." (Ordner enthaelt PDFs, Tokens, Recovery-Keys)
git add index.html angelkarte-public.html app.js app.css sw.js manifest.json manifest-public.json icon-192.svg icon-512.svg README.md upload.bat kml/

git commit -m "Angelkarte aktualisiert" >nul 2>&1
if errorlevel 1 echo (Keine neuen Aenderungen zum Committen)

echo.
echo Hole Aenderungen von GitHub (Spot-Sync-Datei)...
git pull origin main --rebase --autostash
if errorlevel 1 (
    echo FEHLER beim Pull - bitte Konflikte manuell loesen.
    pause
    exit /b 1
)

echo.
echo Lade hoch zu GitHub...
git push -u origin main
if errorlevel 1 (
    echo.
    echo ==========================================
    echo  FEHLER beim Hochladen.
    echo  Repo pruefen: https://github.com/fbsgn/angelkarte-data
    echo ==========================================
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  FERTIG! Online unter:
echo  Persoenlich:  https://fbsgn.github.io/angelkarte-data/
echo  Oeffentlich:  https://fbsgn.github.io/angelkarte-data/angelkarte-public.html
echo  (GitHub Pages braucht ca. 1-2 Minuten)
echo ==========================================
echo.
pause
