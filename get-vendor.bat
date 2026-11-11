@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==========================================
echo  Leaflet + omnivore nach vendor\ laden
echo  (einmalig - danach kein CDN mehr noetig)
echo ==========================================
echo.

if not exist vendor mkdir vendor
set CDN=https://cdn.jsdelivr.net/npm

curl -fsSL -o vendor\leaflet.js %CDN%/leaflet@1.9.4/dist/leaflet.js
if errorlevel 1 (echo FEHLER: leaflet.js & pause & exit /b 1)
curl -fsSL -o vendor\leaflet.css %CDN%/leaflet@1.9.4/dist/leaflet.css
if errorlevel 1 (echo FEHLER: leaflet.css & pause & exit /b 1)
curl -fsSL -o vendor\leaflet-omnivore.min.js %CDN%/leaflet-omnivore@0.3.4/leaflet-omnivore.min.js
if errorlevel 1 (echo FEHLER: leaflet-omnivore.min.js & pause & exit /b 1)
curl -fsSL -o vendor\LICENSE-leaflet.txt %CDN%/leaflet@1.9.4/LICENSE
if errorlevel 1 (echo FEHLER: LICENSE leaflet & pause & exit /b 1)
curl -fsSL -o vendor\LICENSE-leaflet-omnivore.txt %CDN%/leaflet-omnivore@0.3.4/LICENSE
if errorlevel 1 (echo FEHLER: LICENSE omnivore & pause & exit /b 1)

echo.
echo Fertig. Inhalt von vendor\:
dir /b vendor
echo.
echo Jetzt lokal testen und danach upload.bat ausfuehren.
pause
