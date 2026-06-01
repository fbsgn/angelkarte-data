# ⚓ Angelkarte Norwegen

**🇩🇪 Deutsch** | [🇬🇧 English](#-fishing-map-norway)

---

## 🇩🇪 Angelkarte Norwegen

> Kostenlose, mobile GPS-Angelkarte für Norwegen – direkt im Browser, keine App nötig.

![HTML](https://img.shields.io/badge/HTML-Single%20File-e8b84b?style=flat-square&logo=html5)
![License](https://img.shields.io/badge/Lizenz-kostenlos-12b08d?style=flat-square)
![Offline](https://img.shields.io/badge/Offline-fähig-12b08d?style=flat-square)

### 🌐 Live

| Version | Link |
|---|---|
| 🔒 Meine Karte (mit GitHub-Sync) | [fbsgn.github.io/angelkarte-data](https://fbsgn.github.io/angelkarte-data/) |
| 🌍 Öffentliche Version (für alle) | [fbsgn.github.io/angelkarte-data/angelkarte-public.html](https://fbsgn.github.io/angelkarte-data/angelkarte-public.html) |

---

### 📱 Funktionen

- 🗺️ **Norwegen Seekarte** (Kartverket Sjøkart) als Standard
- 🏔️ Topo, OpenStreetMap & Satellitenbild wählbar
- ⚓ **OpenSeaMap** Overlay – Bojen, Tonnen, Leuchtfeuer
- 🌊 **Tiefendaten** (Havbunn – Kartverket)
- 🚢 MarineTraffic-Integration
- 📍 **GPS-Tracking** mit Genauigkeitsanzeige
- 📌 **Eigene Spots anlegen** mit Name & Notiz
- 📂 **KML-Dateien laden** (Drag & Drop)
- ☁️ **GitHub-Sync** – Spots geräteübergreifend speichern *(nur persönliche Version)*
- 💾 Export/Import als JSON & KML
- 📱 **Als PWA installierbar** – auch offline nutzbar

---

### 🚀 Öffentliche Version nutzen

Die öffentliche Version ist eine **einzelne HTML-Datei** – einfach öffnen und loslegen:

👉 **[Jetzt öffnen](https://fbsgn.github.io/angelkarte-data/angelkarte-public.html)**

- Keine Registrierung
- Keine App-Installation
- Alle Daten bleiben lokal auf deinem Gerät
- Backup per Export/Import JSON

**Als App installieren:**
- **iPhone:** Safari → Teilen → „Zum Home-Bildschirm"
- **Android:** Chrome → Menü → „App installieren"

---

### 🗂️ Repo-Struktur

```
angelkarte-data/
├── index.html              # Persönliche Karte (mit GitHub-Sync)
├── angelkarte-public.html  # Öffentliche Version (standalone)
├── kml/
│   ├── index.json          # KML-Dateiliste
│   ├── Hellesoy.kml        # Beispiel-Fangpunkte Hellesøy
│   └── NautnesDaten.kml    # Fangpunkte Nautnes
├── data/
│   └── angelkarte-sync.json  # Spot-Sync (automatisch generiert)
└── upload.bat              # Upload-Script für Windows
```

---

### 🛠️ Eigene Version erstellen

1. Dieses Repo forken
2. GitHub Pages aktivieren: **Settings → Pages → Branch: main**
3. `index.html` öffnen und `CFG.repoOwner` auf deinen GitHub-Nutzernamen ändern
4. GitHub Token erstellen und in der App eintragen (⚙️-Button)

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

> Free mobile GPS fishing map for Norway – runs directly in the browser, no app required.

### 🌐 Live

| Version | Link |
|---|---|
| 🔒 Personal map (with GitHub sync) | [fbsgn.github.io/angelkarte-data](https://fbsgn.github.io/angelkarte-data/) |
| 🌍 Public version (for everyone) | [fbsgn.github.io/angelkarte-data/angelkarte-public.html](https://fbsgn.github.io/angelkarte-data/angelkarte-public.html) |

---

### 📱 Features

- 🗺️ **Norway nautical chart** (Kartverket Sjøkart) as default
- 🏔️ Topo, OpenStreetMap & satellite imagery selectable
- ⚓ **OpenSeaMap** overlay – buoys, beacons, lighthouses
- 🌊 **Depth data** (Havbunn – Kartverket)
- 🚢 MarineTraffic integration
- 📍 **GPS tracking** with accuracy display
- 📌 **Custom fishing spots** with name & notes
- 📂 **KML file loading** (drag & drop)
- ☁️ **GitHub sync** – spots synced across devices *(personal version only)*
- 💾 Export/Import as JSON & KML
- 📱 **Installable as PWA** – works offline

---

### 🚀 Use the public version

The public version is a **single HTML file** – just open and go:

👉 **[Open now](https://fbsgn.github.io/angelkarte-data/angelkarte-public.html)**

- No registration required
- No app installation
- All data stays locally on your device
- Backup via JSON export/import

**Install as app:**
- **iPhone:** Safari → Share → „Add to Home Screen"
- **Android:** Chrome → Menu → „Install app"

---

### 🛠️ Create your own version

1. Fork this repository
2. Enable GitHub Pages: **Settings → Pages → Branch: main**
3. Open `index.html` and change `CFG.repoOwner` to your GitHub username
4. Create a GitHub token and enter it in the app (⚙️ button)

---

### 📡 Services used

| Service | Usage |
|---|---|
| [Kartverket](https://kartverket.no) | Nautical charts, topo, depth data |
| [OpenSeaMap](https://openseamap.org) | Maritime overlay |
| [OpenStreetMap](https://openstreetmap.org) | Base map |
| [ESRI](https://esri.com) | Satellite imagery |
| [Leaflet](https://leafletjs.com) | Map framework |
| [GitHub Pages](https://pages.github.com) | Hosting |

---

*Made with ❤️ for Norwegian fishing – Tight lines! 🎣*
