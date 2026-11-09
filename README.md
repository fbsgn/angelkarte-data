# ⚓ Angelkarte Norwegen

**🇩🇪 Deutsch** | [🇬🇧 English](#-fishing-map-norway)

---

## 🇩🇪 Angelkarte Norwegen

> Kostenlose, werbefreie GPS-Angelkarte für Norwegen – direkt im Browser, keine App nötig.

![PWA](https://img.shields.io/badge/PWA-installierbar-12b08d?style=flat-square)
![Offline](https://img.shields.io/badge/Offline-fähig-12b08d?style=flat-square)
![Lizenz](https://img.shields.io/badge/Lizenz-kostenlos-e8b84b?style=flat-square)

### 🌐 Live

| Version | Link |
|---|---|
| 🔒 Meine Karte (mit GitHub-Sync) | [fbsgn.github.io/angelkarte-data](https://fbsgn.github.io/angelkarte-data/) |
| 🌍 Öffentliche Version (für alle) | [fbsgn.github.io/angelkarte-data/angelkarte-public.html](https://fbsgn.github.io/angelkarte-data/angelkarte-public.html) |

Beide Versionen nutzen denselben Code (`app.js` / `app.css`) und unterscheiden sich nur im Modus: Die öffentliche Version speichert alles **ausschließlich lokal** im Browser, die persönliche synchronisiert Spots über GitHub und lädt die KML-Dateien aus dem Repo.

---

### 📱 Funktionen

- 🗺️ **Norwegen Seekarte** (Kartverket Sjøkart) als Standard, dazu Topo, OpenStreetMap und Satellitenbild
- ⚓ **OpenSeaMap**-Overlay (Bojen, Tonnen, Leuchtfeuer) und 🌊 **Tiefendaten** (Havbunn – Kartverket)
- 🚢 MarineTraffic-Shortcut (öffnet die aktuelle Kartenposition)
- 📍 **GPS-Tracking** mit Genauigkeitsanzeige; Display bleibt bei aktivem GPS an
- 📌 **Eigene Spots**: auf die Karte tippen, per Long-Press oder direkt an der GPS-Position setzen; bearbeiten, Koordinaten kopieren, löschen
- 📂 **KML laden** (Google Earth, Garmin, Navionics …) per Tippen oder Drag & Drop
- ☁️ **GitHub-Sync** *(nur persönliche Version)*: Spots werden pro Eintrag mit Zeitstempel gemergt – offline angelegte Spots gehen nicht verloren, Löschungen werden mitgeführt
- 💾 Export/Import als JSON und KML
- 🌞 **Hochkontrast-Design für Sonne**, 🌙 Nacht-Design umschaltbar
- 📴 **Offline nutzbar**: Kartenkacheln rund um die GPS-Position werden vorab gecacht
- Letzter Kartenausschnitt, Basiskarte und Overlays werden gemerkt

---

### 🚀 Öffentliche Version nutzen

👉 **[Jetzt öffnen](https://fbsgn.github.io/angelkarte-data/angelkarte-public.html)**

- Keine Registrierung, keine Werbung
- Alle Daten bleiben lokal auf deinem Gerät – regelmäßig per **Export JSON** sichern
- Beim ersten Start sind Beispielpunkte (Hellesøy) geladen – einfach löschen

**Als App installieren:**
- **iPhone:** Safari → Teilen → „Zum Home-Bildschirm"
- **Android:** Chrome → Menü → „App installieren"

---

### 🗂️ Repo-Struktur

```
angelkarte-data/
├── index.html                # Persönliche Karte (Stub, Modus „personal")
├── angelkarte-public.html    # Öffentliche Karte (Stub, Modus „public")
├── app.js                    # Gesamte Logik (beide Versionen)
├── app.css                   # Design (hell/dunkel)
├── sw.js                     # Service Worker (Offline, Kachel-Cache)
├── manifest.json             # PWA persönlich
├── manifest-public.json      # PWA öffentlich
├── icon-192.svg / icon-512.svg
├── kml/
│   ├── index.json            # Liste der KML-Dateien (hier eintragen!)
│   └── *.kml                 # Fangpunkte
├── data/
│   └── angelkarte-sync.json  # Spot-Sync (von der App per API geschrieben)
└── upload.bat                # Upload-Script für Windows
```

---

### 🖥️ Lokal testen

`file://` reicht nicht (Service Worker, `fetch`). Im Projektordner einen kleinen Server starten:

```
cd C:\Norge
python -m http.server 8000
```

Dann `http://localhost:8000/` öffnen (Public: `/angelkarte-public.html`). Mit F12 → Konsole auf Fehler prüfen; das Handy-Layout über die Geräte-Symbolleiste (Strg+Umschalt+M) simulieren. GPS lässt sich in den DevTools unter „Sensoren" vorgeben.

---

### 🛠️ Eigene Version erstellen

1. Repo forken
2. GitHub Pages aktivieren: **Settings → Pages → Branch: main**
3. In `app.js` `CFG.repoOwner` / `CFG.repoName` auf deine Werte ändern
4. Für den Sync: Fine-grained Token mit **Contents: Read & Write** auf dein Repo erstellen und in der App unter „Sync" eintragen

Neue KML: Datei nach `kml/` legen, Namen in `kml/index.json` ergänzen, hochladen.

---

### 📡 Verwendete Dienste

| Dienst | Verwendung |
|---|---|
| [Kartverket](https://kartverket.no) | Sjøkart, Topo, Tiefendaten |
| [OpenSeaMap](https://openseamap.org) | Seezeichen-Overlay |
| [OpenStreetMap](https://openstreetmap.org) | Basiskarte |
| [ESRI](https://esri.com) | Satellitenbild |
| [Leaflet](https://leafletjs.com) | Karten-Framework |
| [GitHub Pages](https://pages.github.com) | Hosting |

---
---

## 🇬🇧 Fishing Map Norway

> Free, ad-free mobile GPS fishing map for Norway – runs in the browser, no app required.

### 🌐 Live

| Version | Link |
|---|---|
| 🔒 Personal map (with GitHub sync) | [fbsgn.github.io/angelkarte-data](https://fbsgn.github.io/angelkarte-data/) |
| 🌍 Public version (for everyone) | [fbsgn.github.io/angelkarte-data/angelkarte-public.html](https://fbsgn.github.io/angelkarte-data/angelkarte-public.html) |

Both versions share the same code (`app.js` / `app.css`). The public version stores everything **locally only**; the personal version syncs spots via GitHub and loads KML files from the repo.

### 📱 Features

- 🗺️ **Norway nautical chart** (Kartverket Sjøkart) by default; topo, OSM and satellite selectable
- ⚓ OpenSeaMap overlay and 🌊 depth data (Havbunn – Kartverket); 🚢 MarineTraffic shortcut
- 📍 **GPS tracking** with accuracy display; screen stays on while GPS is active
- 📌 **Custom spots**: tap the map, long-press, or drop one at your GPS position; edit, copy coordinates, delete
- 📂 **KML import** (Google Earth, Garmin, Navionics …)
- ☁️ **GitHub sync** *(personal version only)*: per-spot timestamp merge, deletions tracked, offline spots are never lost
- 💾 Export/import as JSON & KML
- 🌞 **High-contrast daylight theme**, 🌙 night theme toggle
- 📴 **Offline capable** with tile pre-caching around your GPS position

### 🚀 Use the public version

👉 **[Open now](https://fbsgn.github.io/angelkarte-data/angelkarte-public.html)** – no registration, all data stays on your device (back up via JSON export).

**Install as app:** iPhone: Safari → Share → "Add to Home Screen" · Android: Chrome → Menu → "Install app"

### 🖥️ Test locally

```
cd <project folder>
python -m http.server 8000
```
Open `http://localhost:8000/` and check the browser console (F12).

### 🛠️ Create your own version

1. Fork this repository
2. Enable GitHub Pages: **Settings → Pages → Branch: main**
3. Change `CFG.repoOwner` / `CFG.repoName` in `app.js`
4. For sync: create a fine-grained token with **Contents: Read & Write** and enter it in the app under "Sync"

### 📡 Services used

Kartverket (charts, topo, depth), OpenSeaMap, OpenStreetMap, ESRI, Leaflet, GitHub Pages.

---

*Made with ❤️ for Norwegian fishing – Tight lines! 🎣*
