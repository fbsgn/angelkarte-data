/* Angelkarte Norwegen – gemeinsame App-Logik
   window.APP_MODE = 'personal' (GitHub-Sync, KML-Ordner)  |  'public' (nur lokal, Beispiel-KML) */
(function () {
'use strict';

const PUBLIC = window.APP_MODE === 'public';
const CFG = { repoOwner: 'fbsgn', repoName: 'angelkarte-data', syncPath: 'data/angelkarte-sync.json' };
// ── Impressum (§ 5 DDG): VOR DEM VERÖFFENTLICHEN AUSFÜLLEN (Anschrift darf mehrzeilig sein). Solange Felder leer sind, zeigt die App eine Warnung. ──
const LEGAL = { name: '', address: '', email: '' };
const CONSENT_KEY = 'angelkarte_consent_v1';

// Storage-Keys (personal-Keys unverändert, damit bestehende Daten erhalten bleiben)
const K = PUBLIC
  ? { kml: 'angelkarte_pub_kml_v1', spots: 'angelkarte_pub_spots_v1', sheet: 'angelkarte_pub_sheet_v1', seen: 'angelkarte_pub_seen_v1', view: 'angelkarte_pub_view_v1' }
  : { kml: 'angelkarte_kml_store_v10', spots: 'angelkarte_custom_spots_v5', sheet: 'angelkarte_sheet_state_v3', tomb: 'angelkarte_tombstones_v1', dirty: 'angelkarte_sync_dirty_v1', view: 'angelkarte_view_v1' };
const TOKEN_KEY = 'angelkarte_gh_token_v1';
const THEME_KEY = 'angelkarte_theme_v1';

const EXAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Hellesoy Fangpunkte (Beispiel)</name>
<Placemark><name>Schellfisch 1</name><Point><coordinates>4.760972,60.670417,0</coordinates></Point></Placemark>
<Placemark><name>Schellfisch 2</name><Point><coordinates>4.726722,60.685028,0</coordinates></Point></Placemark>
<Placemark><name>Dorsch 1</name><Point><coordinates>4.851056,60.634056,0</coordinates></Point></Placemark>
<Placemark><name>Dorsch 2</name><Point><coordinates>4.808056,60.670778,0</coordinates></Point></Placemark>
<Placemark><name>Leng 1</name><Point><coordinates>4.759056,60.705556,0</coordinates></Point></Placemark>
<Placemark><name>Leng 2</name><Point><coordinates>4.840778,60.671139,0</coordinates></Point></Placemark>
<Placemark><name>Leng 3</name><Point><coordinates>4.701028,60.616889,0</coordinates></Point></Placemark>
</Document></kml>`;

// ───────────────────────── Helpers ─────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escBr = s => esc(s).replace(/\r?\n/g, '<br>');
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
function htmlToText(h) {
  if (!h) return '';
  if (!/[<&]/.test(h)) return h;
  const d = new DOMParser().parseFromString(h.replace(/<br\s*\/?>/gi, '\n'), 'text/html');
  return (d.body.textContent || '').trim();
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function showToast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
function triggerDownload(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
function copyText(txt) {
  const done = () => showToast('📋 Kopiert: ' + txt);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => showToast('⚠️ Kopieren nicht möglich'));
  else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { showToast('⚠️ Kopieren nicht möglich'); } ta.remove(); }
}

// ───────────────────────── Theme ─────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#0a1628' : '#ffffff';
}
applyTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');

// ───────────────────────── UI aufbauen ─────────────────────────
const view = lsGet(K.view, {}) || {};
const baseNames = { sjokart: '🗺️ Kartverket Sjøkart', topo: '🏔️ Kartverket Topo', osm: '🌍 OpenStreetMap', esri: '🛰️ Satellitenbild (ESRI)' };
let currentBase = 'sjokart'; // wird unten nach Prüfung der Einwilligung gesetzt
// Einwilligung (Art. 6 Abs. 1 lit. a DSGVO): tiles.openseamap.org wird erst nach ausdrücklicher Zustimmung kontaktiert.
const consent = (() => { try { return JSON.parse(localStorage.getItem(CONSENT_KEY)) || {}; } catch (e) { return {}; } })();
function setConsent(k, v) { if (v) consent[k] = Date.now(); else delete consent[k]; try { localStorage.setItem(CONSENT_KEY, JSON.stringify(consent)); } catch (e) {} }
const PROVIDERS = {
  openseamap: { name: 'OpenSeaMap', host: 'tiles.openseamap.org', what: 'Das Seezeichen-Overlay (Tonnen, Leuchtfeuer, Bojen)' },
  osm: { name: 'OpenStreetMap', host: 'tile.openstreetmap.org', what: 'Die Basiskarte OpenStreetMap' },
  esri: { name: 'Esri Satellitenbild', host: 'server.arcgisonline.com', what: 'Das Satellitenbild (Anbieter: Esri, USA – die Daten können in ein Land außerhalb des EWR übertragen werden)' },
  havbunn: { name: 'Tiefendaten (Kartverket)', host: 'wms.geonorge.no', what: 'Das Tiefendaten-Overlay (Havbunn, Kartverket/Geonorge)' }
};
const BASE_PROVIDER = { osm: 'osm', esri: 'esri' }; // sjokart/topo = Standardkarte (Kartverket), ohne Dialog
if (baseNames[view.base] && (!BASE_PROVIDER[view.base] || consent[BASE_PROVIDER[view.base]])) currentBase = view.base;
const overlayOn = { seaMap: !!consent.openseamap && view.seaMap !== false, depth: !!consent.havbunn && !!view.depth };

const LEGAL_STAND = '10.11.2026';
function legalHtml() {
  const ln = (u, t) => `<a href='${u}' target='_blank' rel='noopener'>${t}</a>`;
  const ok = LEGAL.name && LEGAL.address && LEGAL.email;
  const imp = ok
    ? `<p><b>${esc(LEGAL.name)}</b><br>${esc(LEGAL.address).replace(/\n/g, '<br>')}<br>E-Mail: <a href='mailto:${esc(LEGAL.email)}'>${esc(LEGAL.email)}</a></p>`
    : `<p class='legal-warn'>⚠️ Angaben fehlen – bitte in <code>app.js</code> unter <code>LEGAL</code> (Name, Anschrift, E-Mail) eintragen.</p>`;
  const consentList = Object.keys(PROVIDERS).map(k => consent[k]
    ? `<li>✅ ${esc(PROVIDERS[k].name)} – zugestimmt <button class='popup-btn' data-legal='revoke' data-key='${k}' type='button'>Widerrufen</button></li>`
    : `<li>${esc(PROVIDERS[k].name)} – keine Einwilligung, es wird nichts geladen</li>`).join('');
  return `<h2>Impressum &amp; Datenschutz</h2>
<h3>Impressum</h3><p>Angaben gemäß § 5 DDG:</p>${imp}
<p>Privates, nicht-kommerzielles Hobbyprojekt – ohne Werbung und ohne Einnahmen.</p>
<h3>Haftungsausschluss</h3>
<p>Die Karte ist <b>keine Navigationshilfe</b>. Kartenmaterial, Tiefen-, Wetter- und Seegangsdaten sowie eingetragene Spots können fehlerhaft, unvollständig oder veraltet sein. Für die Sicherheit auf dem Wasser gelten amtliche Seekarten, Seewetterberichte und gesunder Menschenverstand. Die Nutzung erfolgt auf eigene Gefahr. Für Inhalte externer Anbieter sind allein diese verantwortlich.</p>
<h3>Quellen</h3>
<p>Karten: ${ln('https://www.kartverket.no/', 'Kartverket')}, OpenStreetMap-Mitwirkende (ODbL), Esri, OpenSeaMap-Mitwirkende. Wetter und Wellen: ${ln('https://www.met.no/', 'MET Norway')} (${ln('https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0')}). Software: ${ln('https://leafletjs.com/', 'Leaflet')} (BSD-2-Clause).</p>
<h3>Datenschutz – Kurzfassung</h3>
<p><b>Wir erheben und speichern keine personenbezogenen Daten von dir.</b> Es gibt kein Benutzerkonto, keine Cookies, kein Tracking, keine Analyse- oder Werbedienste und keine eigene Datenbank. Spots, KML-Dateien und Einstellungen bleiben ausschließlich im Speicher deines Browsers auf deinem Gerät. Technisch unvermeidbar: Dein Gerät verbindet sich beim Laden der Seite und der Karte <b>direkt mit den unten genannten Servern</b>, die dabei deine IP-Adresse sehen. Darauf haben wir weder Einfluss noch Zugriff.</p>
<h3>1. Verantwortlicher</h3><p>Siehe Impressum.</p>
<h3>2. Hosting (GitHub Pages)</h3>
<p>Diese Seite wird über GitHub Pages ausgeliefert (GitHub, Inc., USA, ein Unternehmen von Microsoft). Beim Aufruf verarbeitet GitHub technisch notwendige Verbindungsdaten (u. a. IP-Adresse, Zeitpunkt, aufgerufene Datei, Browser-Informationen) in Server-Logs. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer und stabiler Betrieb). Mehr dazu: ${ln('https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement', 'Datenschutzerklärung von GitHub')}. Programmbibliotheken (Leaflet) und Schriften werden <b>nicht</b> von Drittservern nachgeladen, sondern von derselben Adresse.</p>
<h3>3. Lokale Speicherung im Browser</h3>
<p>Die App speichert auf deinem Gerät (localStorage, Cache-Speicher): deine Spots, geladene KML-Dateien, letzten Kartenausschnitt, gewählte Karte und Overlays, Design (hell/dunkel), deine Einwilligungen, zuletzt abgerufene Wetterdaten sowie für den Offline-Betrieb App-Dateien und Kartenkacheln. Diese Daten werden nicht an uns übertragen und nicht für Cookies, Tracking oder Profilbildung verwendet. Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG (für den von dir gewünschten Dienst erforderlich). Löschen: Website-Daten im Browser löschen${PUBLIC ? ' oder im Menü „Punkte“ → „Alles löschen“' : ''}. Bitte sichere wichtige Spots vorher per „Export JSON“.</p>
<h3>4. Standort (GPS)</h3>
<p>Dein Standort wird nur nach Aktivierung von „GPS“ und deiner Freigabe im Browser verwendet. Er wird nur auf deinem Gerät angezeigt und weder gespeichert noch an uns gesendet. Beachte: Bei aktivem GPS lädt die App Kartenkacheln rund um deine Position für den Offline-Betrieb vor. Dem jeweiligen Kartenanbieter (Punkt 5) wird dadurch ungefähr dein Aufenthaltsort erkennbar.</p>
<h3>5. Kartendienste</h3>
<p>Karten werden <b>direkt von den Servern der Anbieter</b> geladen. Übertragen werden jeweils deine IP-Adresse, die angefragte Kachel (entspricht dem Kartenausschnitt), der Zeitpunkt, Browser-/Geräteinformationen und die Adresse dieser Seite (Referrer).</p>
<ul>
<li><b>Kartverket</b> (Norwegen, EWR): Sjøkart und Topo über cache.kartverket.no. Das ist die Standardkarte und Grundfunktion der App (Art. 6 Abs. 1 lit. b/f DSGVO). Ohne diese Verbindung kann keine Karte angezeigt werden.</li>
<li>Optional und jeweils <b>nur nach deiner ausdrücklichen Einwilligung</b> (Art. 6 Abs. 1 lit. a DSGVO): <b>OpenSeaMap</b> (tiles.openseamap.org), <b>OpenStreetMap</b> (tile.openstreetmap.org, OpenStreetMap Foundation), <b>Esri Satellitenbild</b> (server.arcgisonline.com, Esri, USA – Übermittlung in ein Drittland möglich) und <b>Tiefendaten</b> (wms.geonorge.no, Kartverket/Geonorge). Ohne Zustimmung wird keine Verbindung aufgebaut.</li>
</ul>
<p><b>Deine Einwilligungen</b> (jederzeit widerrufbar, Wirkung für die Zukunft):</p><ul>${consentList}</ul>
<h3>6. Wetter &amp; Wellen (MET Norway)</h3>
<p>Nur wenn du „Wetter“ antippst, sendet dein Gerät die Koordinaten des gewählten Punkts (auf 4 Nachkommastellen gerundet) und deine IP-Adresse an api.met.no (Norwegisches Meteorologisches Institut, Norwegen/EWR). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (von dir angeforderte Funktion).</p>
<h3>7. MarineTraffic</h3>
<p>„Schiffe“ öffnet nur einen Link zu marinetraffic.com in einem neuen Tab, mit der aktuellen Kartenmitte in der Adresse. Daten werden erst übertragen, wenn du den Link anklickst. Danach gilt die Datenschutzerklärung von MarineTraffic.</p>
${PUBLIC ? '' : `<h3>8. GitHub-Sync (nur persönliche Version)</h3><p>Ist ein Token eingetragen, werden Spots über die GitHub-API (api.github.com) im Repository des Betreibers gespeichert. Das Token liegt nur lokal in diesem Browser.</p>`}
<h3>Deine Rechte</h3>
<p>Dir stehen die Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu. Da wir keine personenbezogenen Daten von dir speichern, betreffen diese Rechte vor allem die oben genannten Anbieter. Erteilte Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO).</p>
<p style='color:var(--text-2);font-size:13px'>Stand: ${LEGAL_STAND}</p>
<div class='modal-actions'><button class='modal-btn primary' id='closeLegal' type='button'>Schließen</button></div>`;
}
function openLegal() { $('legalBody').innerHTML = legalHtml(); $('legalModal').classList.add('open'); $('legalModal').querySelector('.modal-card').scrollTop = 0; }
let pendingConsent = null;
function askConsent(key, onYes) {
  const p = PROVIDERS[key]; pendingConsent = { key, onYes };
  $('consentTitle').textContent = `${p.name} aktivieren?`;
  $('consentBody').innerHTML = `<p>${esc(p.what)} wird <b>direkt vom Server ${esc(p.host)}</b> geladen. Dabei erhält der Betreiber dieses Servers deine <b>IP-Adresse</b>, den angefragten Kartenausschnitt, den Zeitpunkt, Browser-Informationen und die Adresse dieser Seite. Wir haben darauf keinen Zugriff.</p><p>Ohne deine Zustimmung wird <b>keine</b> Verbindung zu ${esc(p.name)} aufgebaut. Du kannst die Zustimmung jederzeit unter „Impressum &amp; Datenschutz“ widerrufen.</p>`;
  $('consentModal').classList.add('open');
}
function closeConsent() { pendingConsent = null; $('consentModal').classList.remove('open'); }
async function revokeConsent(key) {
  if (!PROVIDERS[key]) return;
  setConsent(key, false);
  if (key === 'openseamap' && overlayOn.seaMap) setSeamap(false);
  if (key === 'havbunn' && overlayOn.depth) setDepth(false);
  if (BASE_PROVIDER[currentBase] === key) switchBase('sjokart');
  const host = PROVIDERS[key].host;
  try { const c = await caches.open('angelkarte-tiles-v14'); for (const r of await c.keys()) { const h = new URL(r.url).hostname; if (h === host || h.endsWith('.' + host)) await c.delete(r); } } catch (e) {}
  showToast('Einwilligung widerrufen'); openLegal();
}

function buildUI() {
  const nav5 = PUBLIC
    ? '<button class="nav-btn" id="navInfo" aria-label="Hilfe"><span class="ic">ℹ️</span><span>Hilfe</span></button>'
    : '<button class="nav-btn" id="navSync" aria-label="Sync und Token"><span class="ic" id="navSyncIc">☁️</span><span>Sync</span></button>';
  const radios = Object.keys(baseNames).map(k => `<label class="layer-option"><input type="radio" name="layer" value="${k}" ${k === currentBase ? 'checked' : ''}/> ${baseNames[k]}${BASE_PROVIDER[k] ? ' <small>· nur mit Zustimmung</small>' : ''}</label>`).join('');
  const publicActions = PUBLIC ? '<button class="action-btn full danger" id="btnClearAll">🗑️ Alles löschen</button>' : '';
  const extraModal = PUBLIC ? `
<div class="modal" id="infoModal"><div class="modal-card">
  <h2>⚓ Angelkarte Norwegen</h2>
  <p>Kostenlose GPS-Angelkarte für Norwegen – läuft im Browser, keine App nötig. Kein Tracking, keine Cookies, keine Werbung: Deine Spots und Einstellungen bleiben <b>nur auf deinem Gerät</b>. Karten lädt dein Gerät direkt vom Anbieter: die Standardkarte von Kartverket sofort, alle optionalen Karten und Overlays (unter „Ebenen“) erst nach deiner Zustimmung. Details: <a href="#" id="infoLegal">Impressum &amp; Datenschutz</a>.</p>
  <h3>📍 GPS</h3><ul><li>„GPS" unten antippen, „Zentrieren" bringt die Karte zurück zu dir. Das Display bleibt bei aktivem GPS an.</li></ul>
  <h3>📌 Spots</h3><ul><li>„Spot" antippen und auf die Karte tippen – oder Karte lange gedrückt halten.</li><li>Im Menü „Punkte": „Spot an meiner Position" setzt direkt einen Spot per GPS.</li><li>Spot antippen: bearbeiten, Koordinaten kopieren, löschen.</li></ul>
  <h3>📂 KML</h3><ul><li>„Punkte" öffnen, KML-Datei antippen oder hineinziehen (Google Earth, Garmin, Navionics …).</li></ul>
  <h3>💾 Backup</h3><ul><li>Export/Import JSON sichert Spots und KML. Bitte regelmäßig exportieren – Browserdaten können gelöscht werden.</li></ul>
  <h3>🌞 Sonne / 🌙 Nacht</h3><ul><li>Unter „Ebenen" lässt sich zwischen hellem (Sonne) und dunklem Design wechseln.</li></ul>
  <h3>📱 Installieren</h3><ul><li><b>iPhone:</b> Safari → Teilen → „Zum Home-Bildschirm"</li><li><b>Android:</b> Chrome → Menü → „App installieren"</li></ul>
  <p style="color:var(--text-2);font-size:13px;margin-top:10px">Die Beispielpunkte (🎣) zeigen Fangstellen bei Hellesøy – ersetze sie durch deine eigenen.</p>
  <div class="modal-actions"><button class="modal-btn primary" id="closeInfo">Los geht's 🎣</button></div>
</div></div>` : `
<div class="modal" id="tokenModal"><div class="modal-card">
  <h2>☁️ GitHub-Sync</h2>
  <p>Fine-grained Token mit <b>Contents: Read &amp; Write</b> für das Repo <b>${CFG.repoName}</b> (GitHub → Settings → Developer settings). Er wird nur lokal in diesem Browser gespeichert.</p>
  <label for="tokenInput">Token</label>
  <input id="tokenInput" type="password" autocomplete="off" placeholder="github_pat_…"/>
  <div class="modal-status" id="tokenStatus"></div>
  <div class="modal-actions"><button class="modal-btn" id="tokenSyncNow">🔄 Jetzt sync</button></div>
  <div class="modal-actions"><button class="modal-btn danger" id="tokenDelete">Löschen</button><button class="modal-btn" id="tokenCancel">Schließen</button><button class="modal-btn primary" id="tokenSave">Speichern</button></div>
</div></div>`;

  document.body.insertAdjacentHTML('afterbegin', `
<div id="map"></div>
<div id="topbar">
  <div class="chip app-title">⚓ Angelkarte<small>${PUBLIC ? 'Norwegen · öffentlich' : 'Norwegen · Sjøkart'}</small></div>
  <div class="spacer"></div>
  <button class="btn" id="btnWx" aria-label="Wetter und Wellen">🌤️</button>
  <button class="btn" id="btnLayers" aria-label="Kartenebenen">🗺️ Ebenen</button>
</div>
<div id="gpsStatus"></div>
<div id="modeBanner"><span>📍 Auf die Karte tippen, um den Spot zu setzen</span><button id="modeCancel" type="button">Abbrechen</button></div>
<div id="layerPanel">
  <div class="panel-title">Basiskarte</div>${radios}
  <div class="legal-note">Kartverket ist die Standardkarte. Alle anderen Karten und Overlays werden erst nach deiner Zustimmung vom jeweiligen Anbieter geladen (siehe Datenschutz).</div>
  <hr class="panel-divider"/>
  <div class="panel-title">Overlays</div>
  <div class="overlay-row"><div class="overlay-label">⚓ OpenSeaMap<small>Bojen, Tonnen, Leuchtfeuer · nur mit Zustimmung</small></div><div class="toggle-sw ${overlayOn.seaMap ? 'on' : ''}" id="toggleSeamap" role="switch"></div></div>
  <div class="overlay-row"><div class="overlay-label">🌊 Tiefendaten<small>Havbunn – Kartverket · nur mit Zustimmung</small></div><div class="toggle-sw ${overlayOn.depth ? 'on' : ''}" id="toggleDepth" role="switch"></div></div>
  <div class="overlay-row"><div class="overlay-label">🚢 Schiffe<small>MarineTraffic (externer Tab)</small></div><button class="popup-btn" id="btnMarineTraffic" type="button">Öffnen ↗</button></div>
  <hr class="panel-divider"/>
  <div class="panel-title">Design</div>
  <div class="overlay-row"><div class="overlay-label">🌙 Nacht-Design<small>Dunkel – für Abend/Nacht</small></div><div class="toggle-sw" id="toggleTheme" role="switch"></div></div>
  <hr class="panel-divider"/>
  <div class="overlay-row"><div class="overlay-label">🔒 Datenschutz<small>Impressum &amp; Einwilligungen</small></div><button class="popup-btn" id="btnLegal" type="button">Öffnen</button></div>
</div>
<div id="sheet">
  <div class="sheet-head">
    <button class="icon-btn" id="sheetCollapseBtn" aria-label="Einklappen/Ausklappen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
    <div class="sheet-title"><h3>Punkte &amp; Spots</h3><div class="sheet-sub" id="summary">Kein Inhalt</div></div>
  </div>
  <div class="sheet-body">
    <div class="section"><div class="section-label">Aktionen</div><div class="grid-actions">
      <button class="action-btn primary" id="btnAddSpot">➕ Spot auf Karte</button>
      <button class="action-btn primary" id="btnSpotHere">📍 Spot per GPS</button>
      <button class="action-btn" id="btnExportJson">⬇️ Export JSON</button>
      <button class="action-btn" id="btnExportKml">⬇️ Export KML</button>
      <button class="action-btn full" id="btnImportJson">📥 Import JSON</button>${publicActions}
    </div></div>
    <div class="section"><div class="section-label">Eigene Spots</div><div class="list" id="spotList"></div></div>
    <div class="section"><div class="section-label">KML laden</div>
      <div id="dropzone"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>KML-Datei antippen oder hierher ziehen</div>
      <input type="file" id="fileInput" accept=".kml,.kmz,application/vnd.google-earth.kml+xml" multiple/><input type="file" id="jsonImportInput" accept=".json,application/json"/>
    </div>
    <div class="section"><div class="section-label">KML-Dateien</div><div class="list" id="kmlList"></div></div>
  </div>
</div>
<nav id="bottomNav">
  <button class="nav-btn" id="navCenter" aria-label="Auf Position zentrieren"><span class="ic">🎯</span><span>Zentrieren</span></button>
  <button class="nav-btn" id="navGps" aria-label="GPS ein/aus"><span class="ic">📡</span><span>GPS</span></button>
  <button class="nav-btn" id="navSpot" aria-label="Spot setzen"><span class="ic">📌</span><span>Spot</span></button>
  <button class="nav-btn" id="navKml" aria-label="Punkte und Spots"><span class="ic">📂</span><span>Punkte</span></button>
  ${nav5}
</nav>
<div id="toast" role="status" aria-live="polite"></div>
<div class="modal" id="spotModal"><div class="modal-card">
  <h2 id="spotModalTitle">Spot anlegen</h2>
  <label for="spotName">Name</label><input id="spotName" type="text" placeholder="z. B. Köhlerkante" autocomplete="off"/>
  <label for="spotNote">Notiz</label><textarea id="spotNote" placeholder="Tiefe, Drift, Köder, Bemerkung …"></textarea>
  <div class="modal-actions"><button class="modal-btn" id="spotCancel" type="button">Abbrechen</button><button class="modal-btn primary" id="spotSave" type="button">Speichern</button></div>
</div></div>${extraModal}
<div class='modal' id='consentModal'><div class='modal-card'>
  <h2 id='consentTitle'>Aktivieren?</h2>
  <div id='consentBody'></div>
  <div class='modal-actions'><button class='modal-btn' id='consentNo' type='button'>Nein</button><button class='modal-btn primary' id='consentYes' type='button'>Zustimmen &amp; aktivieren</button></div>
</div></div>
<div class='modal' id='legalModal'><div class='modal-card'><div id='legalBody'></div></div></div>`);
  $('toggleTheme').classList.toggle('on', document.documentElement.getAttribute('data-theme') === 'dark');
}
buildUI();

// ───────────────────────── Karte ─────────────────────────
const baseLayers = {
  sjokart: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png', { attribution: '© Kartverket – Sjøkart', maxZoom: 18, minZoom: 3 }),
  topo: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', { attribution: '© Kartverket – Topo', maxZoom: 18, minZoom: 3 }),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }),
  esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 })
};
const layerSeamap = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { attribution: '© OpenSeaMap', maxZoom: 18 });
const layerDepth = L.tileLayer.wms('https://wms.geonorge.no/skwms1/wms.havbunnraster3', { layers: 'havbunnraster', format: 'image/png', transparent: true, version: '1.3.0', opacity: .55, attribution: '© Kartverket – Havbunn', maxZoom: 18 });

const startLayers = [baseLayers[currentBase]];
if (overlayOn.depth) startLayers.push(layerDepth);
if (overlayOn.seaMap) startLayers.push(layerSeamap);
const map = L.map('map', {
  center: Array.isArray(view.center) ? view.center : [62.5, 7], zoom: view.zoom || 6,
  zoomControl: true, attributionControl: true, layers: startLayers, tapTolerance: 15
});
map.on('moveend', debounce(() => {
  const c = map.getCenter();
  lsSet(K.view, { center: [+c.lat.toFixed(5), +c.lng.toFixed(5)], zoom: map.getZoom(), base: currentBase, seaMap: overlayOn.seaMap, depth: overlayOn.depth });
}, 600));
function saveViewPrefs() { const c = map.getCenter(); lsSet(K.view, { center: [+c.lat.toFixed(5), +c.lng.toFixed(5)], zoom: map.getZoom(), base: currentBase, seaMap: overlayOn.seaMap, depth: overlayOn.depth }); }

let kmlLayers = [], spots = [], tombs = lsGet(K.tomb, []) || [];
let gpsMarker = null, gpsCircle = null, gpsWatchId = null, gpsActive = false, gpsCentered = false, wakeLock = null;
let spotAddMode = false, modalState = null;
const colors = ['#e8b84b', '#12b08d', '#e85050', '#6c8ebf', '#f5d17a', '#a8d8a8', '#ff9f7f'];

function reorderOverlays() {
  if (map.hasLayer(layerDepth)) { map.removeLayer(layerDepth); map.addLayer(layerDepth); }
  if (map.hasLayer(layerSeamap)) { map.removeLayer(layerSeamap); map.addLayer(layerSeamap); }
}
function updateSummary() {
  const vk = kmlLayers.filter(x => x.visible).length, vs = spots.filter(x => x.visible).length;
  $('summary').textContent = `${kmlLayers.length} KML · ${spots.length} Spots · ${vk + vs} sichtbar`;
  $('btnAddSpot').classList.toggle('active', spotAddMode);
}

// ───────────────────────── Spots ─────────────────────────
const validSpot = s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180;
function newId() { return Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
function normSpot(s) {
  const id = String(s.id || newId());
  return { id, name: String(s.name || 'Spot'), note: String(s.note || ''), lat: +s.lat, lng: +s.lng, visible: s.visible !== false, updatedAt: +s.updatedAt || parseInt(id, 10) || 0 };
}
const plain = s => ({ id: s.id, name: s.name, note: s.note, lat: s.lat, lng: s.lng, visible: s.visible, updatedAt: s.updatedAt });
function spotPopupHtml(s) {
  const ll = `${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}`;
  return `<div class="popup-title">${esc(s.name)}</div><div class="popup-desc">${s.note ? escBr(s.note) : '<i>Keine Notiz</i>'}</div>` +
    `<div class="popup-coord">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</div>` +
    `<div class="popup-actions"><button class="popup-btn" data-act="edit" data-id="${esc(s.id)}">✏️ Bearbeiten</button>` +
    `<button class="popup-btn" data-act="copy" data-ll="${ll}">📋 Kopieren</button>` +
    `<button class="popup-btn" data-act="wx" data-lat="${s.lat}" data-lng="${s.lng}" data-label="${esc(s.name)}">🌤️ Wetter</button>` +
    `<button class="popup-btn danger" data-act="del" data-id="${esc(s.id)}">🗑️ Löschen</button></div>`;
}
function createSpotMarker(spot) {
  const icon = L.divIcon({ html: '<div class="spot-marker"><span>📍</span></div>', className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -16] });
  return L.marker([spot.lat, spot.lng], { icon, zIndexOffset: 900 }).bindPopup(() => spotPopupHtml(spot), { maxWidth: 300 });
}
function attachSpot(s) { s.marker = createSpotMarker(s); if (s.visible) s.marker.addTo(map); spots.push(s); }
function rebuildSpots(list) { spots.forEach(s => s.marker && map.removeLayer(s.marker)); spots = []; list.forEach(s => attachSpot(Object.assign({}, s))); renderSpotList(); }
function persistSpots() { lsSet(K.spots, spots.map(plain)); if (!PUBLIC) lsSet(K.tomb, tombs); }
function spotsChanged() { persistSpots(); renderSpotList(); if (!PUBLIC) { setDirty(true); scheduleSync(); } }

function deleteSpot(id) {
  const i = spots.findIndex(s => s.id === id); if (i < 0) return;
  const s = spots[i];
  if (!confirm(`Spot „${s.name}" löschen?`)) return;
  if (s.marker) map.removeLayer(s.marker);
  spots.splice(i, 1);
  if (!PUBLIC) tombs.push({ id, deletedAt: Date.now() });
  spotsChanged(); showToast('🗑️ Spot gelöscht');
}
function renderSpotList() {
  const list = $('spotList'); list.innerHTML = '';
  if (!spots.length) list.innerHTML = '<div class="empty">Noch keine eigenen Spots.</div>';
  spots.forEach((spot, i) => {
    const item = document.createElement('div'); item.className = 'item';
    item.innerHTML = `<div class="dot" style="background:#d62828"></div><button class="item-main" data-fly="${i}"><span class="name">${esc(spot.name)}</span><span class="meta">${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}</span></button><div class="toggle-sw ${spot.visible ? 'on' : ''}" data-idx="${i}" role="switch"></div><button class="remove" data-idx="${i}" aria-label="Löschen">×</button>`;
    list.appendChild(item);
  });
  list.querySelectorAll('[data-fly]').forEach(b => b.addEventListener('click', () => {
    const s = spots[+b.dataset.fly]; if (!s.visible) { s.visible = true; s.marker.addTo(map); persistSpots(); renderSpotList(); }
    map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 15), { duration: .8 }); setSheetCollapsed(true); setTimeout(() => s.marker.openPopup(), 900);
  }));
  list.querySelectorAll('.toggle-sw').forEach(sw => sw.addEventListener('click', () => {
    const s = spots[+sw.dataset.idx]; s.visible = !s.visible; s.visible ? s.marker.addTo(map) : map.removeLayer(s.marker);
    sw.classList.toggle('on', s.visible); persistSpots(); updateSummary();
  }));
  list.querySelectorAll('.remove').forEach(b => b.addEventListener('click', () => deleteSpot(spots[+b.dataset.idx].id)));
  updateSummary();
}
function restoreSpots() {
  const items = lsGet(K.spots, []);
  if (!Array.isArray(items)) return;
  items.map(normSpot).filter(validSpot).forEach(attachSpot);
  renderSpotList();
}
function openSpotModal(state) {
  modalState = state;
  const s = state.id ? spots.find(x => x.id === state.id) : null;
  $('spotModalTitle').textContent = s ? 'Spot bearbeiten' : 'Spot anlegen';
  $('spotName').value = s ? s.name : ''; $('spotNote').value = s ? s.note : '';
  $('spotModal').classList.add('open'); setTimeout(() => $('spotName').focus(), 80);
}
function closeSpotModal() { $('spotModal').classList.remove('open'); modalState = null; }
function saveSpotModal() {
  if (!modalState) return;
  const name = $('spotName').value.trim() || 'Spot', note = $('spotNote').value.trim();
  if (modalState.id) {
    const s = spots.find(x => x.id === modalState.id);
    if (s) { s.name = name; s.note = note; s.updatedAt = Date.now(); if (s.marker.isPopupOpen()) s.marker.closePopup(); }
  } else {
    attachSpot({ id: newId(), name, note, lat: modalState.latlng.lat, lng: modalState.latlng.lng, visible: true, updatedAt: Date.now() });
  }
  spotsChanged(); closeSpotModal(); setSpotMode(false); showToast('📍 Spot gespeichert');
}
function setSpotMode(on) {
  spotAddMode = on; document.body.classList.toggle('spot-mode', on);
  $('navSpot').classList.toggle('active', on); $('modeBanner').classList.toggle('visible', on); updateSummary();
}

// Popup-Aktionen (Leaflet stoppt Klick-Bubbling → Listener direkt am Popup)
function wirePopup(el) {
  if (!el) return;
  el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', ev => {
    ev.preventDefault();
    const act = b.dataset.act;
    if (act === 'copy') copyText(b.dataset.ll);
    else if (act === 'del') { map.closePopup(); deleteSpot(b.dataset.id); }
    else if (act === 'edit') { map.closePopup(); openSpotModal({ id: b.dataset.id }); }
    else if (act === 'wx' || act === 'wxrefresh') showWeather(+b.dataset.lat, +b.dataset.lng, b.dataset.label || 'Position', act === 'wxrefresh');
  }));
}
map.on('popupopen', e => wirePopup(e.popup.getElement()));

// ───────────────────────── KML ─────────────────────────
function saveKmlStore() {
  lsSet(K.kml, kmlLayers.filter(x => !x.isStatic).map(x => ({ name: x.name, color: x.color, count: x.count || 0, visible: x.visible, kmlText: x.kmlText || '' })));
}
function loadKmlText(name, kmlText, opt) {
  opt = opt || {};
  if (kmlLayers.some(x => x.name === name)) return 0;
  const color = opt.color || colors[kmlLayers.length % colors.length], visible = opt.visible !== false;
  const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
  if (dom.querySelector('parsererror')) return -1;
  const group = L.featureGroup(); let count = 0;
  dom.querySelectorAll('Placemark').forEach(pm => {
    const coordEl = pm.querySelector('Point coordinates'); if (!coordEl) return;
    const p = coordEl.textContent.trim().split(','), lat = parseFloat(p[1]), lng = parseFloat(p[0]);
    if (!isFinite(lat) || !isFinite(lng)) return;
    const pname = pm.querySelector('name')?.textContent?.trim() || 'Fangpunkt';
    const desc = htmlToText(pm.querySelector('description')?.textContent?.trim() || '');
    const html = `<div class="popup-title">${esc(pname)}</div>${desc ? `<div class="popup-desc">${escBr(desc)}</div>` : ''}<div class="popup-coord">${lat.toFixed(5)}, ${lng.toFixed(5)}</div><div class="popup-actions"><button class="popup-btn" data-act="copy" data-ll="${lat.toFixed(6)}, ${lng.toFixed(6)}">📋 Kopieren</button><button class="popup-btn" data-act="wx" data-lat="${lat}" data-lng="${lng}" data-label="${esc(pname)}">🌤️ Wetter</button></div>`;
    L.marker([lat, lng], { icon: L.divIcon({ html: `<div class="fish-marker" style="background:${esc(color)}"><span>🎣</span></div>`, className: '', iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -38] }) })
      .addTo(group).bindPopup(html, { maxWidth: 300 });
    count++;
  });
  try {
    omnivore.kml.parse(kmlText).eachLayer(l => {
      if (l instanceof L.Marker) return;
      if (l.setStyle) l.setStyle({ color, fillColor: color, weight: 3, fillOpacity: .2 });
      l.addTo(group);
    });
  } catch (e) {}
  if (visible) group.addTo(map);
  kmlLayers.push({ name, color, count, group, visible, kmlText, isStatic: !!opt.isStatic });
  if (opt.persist !== false && !opt.isStatic) saveKmlStore();
  renderKmlList();
  return count;
}
function removeKmlByName(name) {
  const i = kmlLayers.findIndex(x => x.name === name); if (i < 0) return;
  map.removeLayer(kmlLayers[i].group); kmlLayers.splice(i, 1);
}
function renderKmlList() {
  const list = $('kmlList'); list.innerHTML = '';
  if (!kmlLayers.length) list.innerHTML = '<div class="empty">Keine KML-Dateien geladen.</div>';
  kmlLayers.forEach((e, i) => {
    const item = document.createElement('div'); item.className = 'item';
    item.innerHTML = `<div class="dot" style="background:${esc(e.color)}"></div><button class="item-main" data-fly="${i}"><span class="name">${esc(e.name)}</span><span class="meta">${e.count} Punkte${e.isStatic ? ' · aus Repo' : ''}</span></button><div class="toggle-sw ${e.visible ? 'on' : ''}" data-idx="${i}" role="switch"></div><button class="remove" data-idx="${i}" aria-label="Entfernen">×</button>`;
    list.appendChild(item);
  });
  list.querySelectorAll('[data-fly]').forEach(b => b.addEventListener('click', () => {
    const e = kmlLayers[+b.dataset.fly]; if (!e.visible) { e.visible = true; map.addLayer(e.group); saveKmlStore(); renderKmlList(); }
    const bnds = e.group.getBounds(); if (bnds.isValid()) { map.fitBounds(bnds, { padding: [50, 50], maxZoom: 15 }); setSheetCollapsed(true); }
  }));
  list.querySelectorAll('.toggle-sw').forEach(sw => sw.addEventListener('click', () => {
    const e = kmlLayers[+sw.dataset.idx]; e.visible = !e.visible; e.visible ? map.addLayer(e.group) : map.removeLayer(e.group);
    sw.classList.toggle('on', e.visible); saveKmlStore(); updateSummary();
  }));
  list.querySelectorAll('.remove').forEach(b => b.addEventListener('click', () => {
    const e = kmlLayers[+b.dataset.idx]; if (!confirm(`„${e.name}" entfernen?`)) return;
    map.removeLayer(e.group); kmlLayers.splice(+b.dataset.idx, 1); renderKmlList(); saveKmlStore();
    if (e.isStatic) showToast('Wird beim nächsten Start aus dem Repo neu geladen');
  }));
  updateSummary();
}
function restoreKml() {
  const items = lsGet(K.kml, []);
  if (Array.isArray(items)) items.forEach(it => { if (it.kmlText) loadKmlText(it.name, it.kmlText, { persist: false, color: it.color, visible: it.visible !== false }); });
  renderKmlList();
}
function loadKmlFile(file) {
  const r = new FileReader();
  r.onload = ev => {
    const c = loadKmlText(file.name, ev.target.result, {});
    showToast(c < 0 ? '⚠️ Ungültige KML-Datei' : c === 0 && kmlLayers.some(x => x.name === file.name) ? 'ℹ️ Bereits geladen' : `✅ ${c} Punkte geladen`);
  };
  r.readAsText(file);
}
async function loadStaticKml() {
  try {
    const res = await fetch('kml/index.json', { cache: 'no-cache' }); if (!res.ok) return 0;
    const files = (await res.json()).files; if (!Array.isArray(files)) return 0;
    const texts = await Promise.all(files.map(f => fetch('kml/' + encodeURIComponent(f), { cache: 'no-cache' }).then(r => r.ok ? r.text() : null).catch(() => null)));
    let loaded = 0;
    files.forEach((f, i) => { if (!texts[i]) return; removeKmlByName(f); if (loadKmlText(f, texts[i], { isStatic: true }) >= 0) loaded++; });
    if (loaded) { saveKmlStore(); renderKmlList(); }
    return loaded;
  } catch (e) { return 0; }
}

// ───────────────────────── Export / Import ─────────────────────────
function exportJson() {
  const payload = { version: 2, exportedAt: new Date().toISOString(), customSpots: spots.map(plain), kmlLayers: kmlLayers.map(x => ({ name: x.name, color: x.color, count: x.count || 0, visible: x.visible, kmlText: x.kmlText || '' })) };
  triggerDownload(`angelkarte-backup-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  showToast('⬇️ JSON exportiert');
}
function exportKml() {
  const pm = [], ser = new XMLSerializer();
  spots.forEach(s => pm.push(`<Placemark><name>${esc(s.name)}</name><description>${esc(s.note)}</description><Point><coordinates>${s.lng},${s.lat},0</coordinates></Point></Placemark>`));
  kmlLayers.forEach(x => { if (x.kmlText) new DOMParser().parseFromString(x.kmlText, 'text/xml').querySelectorAll('Placemark').forEach(p => pm.push(ser.serializeToString(p))); });
  triggerDownload(`angelkarte-export-${stamp()}.kml`, `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n<name>Angelkarte Export</name>\n${pm.join('\n')}\n</Document>\n</kml>`, 'application/vnd.google-earth.kml+xml;charset=utf-8');
  showToast('⬇️ KML exportiert');
}
function importJsonFile(file) {
  const r = new FileReader();
  r.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result); let ns = 0, nk = 0;
      if (Array.isArray(d.kmlLayers)) d.kmlLayers.forEach(x => { if (x.kmlText && loadKmlText(x.name, x.kmlText, { color: x.color, visible: x.visible !== false }) > 0) nk++; });
      if (Array.isArray(d.customSpots)) d.customSpots.map(normSpot).filter(validSpot).forEach(s => { if (!spots.some(x => x.id === s.id)) { attachSpot(s); ns++; } });
      spotsChanged(); renderKmlList(); saveKmlStore();
      showToast(`📥 ${ns} Spots, ${nk} KML importiert`);
    } catch (e) { showToast('⚠️ Import fehlgeschlagen'); }
  };
  r.readAsText(file);
}

// ───────────────────────── GitHub-Sync (nur personal) ─────────────────────────
const apiUrl = `https://api.github.com/repos/${CFG.repoOwner}/${CFG.repoName}/contents/${CFG.syncPath}`;
let syncing = false, syncQueued = false, lastSyncAt = 0;
function setDirty(v) { if (!PUBLIC) lsSet(K.dirty, !!v); }
function isDirty() { return !PUBLIC && !!lsGet(K.dirty, false); }
function setSyncState(s) {
  const ic = $('navSyncIc'); if (!ic) return;
  ic.textContent = { ok: '☁️', busy: '🔄', err: '⚠️', none: '🔑' }[s] || '☁️';
}
const toB64 = str => { let b = ''; new TextEncoder().encode(str).forEach(c => b += String.fromCharCode(c)); return btoa(b); };
const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
function canon(sp, tb) {
  return JSON.stringify({ s: sp.map(x => [x.id, x.name, x.note, x.lat, x.lng, x.visible, x.updatedAt]).sort((a, b) => a[0] < b[0] ? -1 : 1), d: (tb || []).map(t => [String(t.id), +t.deletedAt || 0]).sort((a, b) => a[0] < b[0] ? -1 : 1) });
}
function applyMerge(remote) {
  const rs = (Array.isArray(remote.customSpots) ? remote.customSpots : []).map(normSpot).filter(validSpot);
  const now = Date.now(), maxAge = 90 * 864e5, tm = new Map();
  tombs.concat(Array.isArray(remote.deleted) ? remote.deleted : []).forEach(t => {
    if (!t || t.id == null) return; const id = String(t.id), at = +t.deletedAt || 0, p = tm.get(id);
    if (!p || at > p.deletedAt) tm.set(id, { id, deletedAt: at });
  });
  const sm = new Map(spots.map(s => [s.id, plain(s)]));
  rs.forEach(r => { const l = sm.get(r.id); if (!l || r.updatedAt > l.updatedAt) sm.set(r.id, r); });
  const merged = []; sm.forEach(s => { const t = tm.get(s.id); if (t && t.deletedAt >= s.updatedAt) return; merged.push(s); });
  const newTombs = [...tm.values()].filter(t => now - t.deletedAt < maxAge);
  const changed = canon(spots.map(plain), tombs) !== canon(merged, newTombs);
  tombs = newTombs;
  if (changed) rebuildSpots(merged);
  persistSpots();
  return changed;
}
async function ghGet(token) {
  const r = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (r.status === 404) return { data: null, sha: null };
  if (!r.ok) throw new Error('GET ' + r.status);
  const j = await r.json(); return { data: JSON.parse(fromB64(j.content)), sha: j.sha };
}
async function syncNow(opt) {
  if (PUBLIC) return; opt = opt || {};
  const token = getToken();
  if (!token) {
    setSyncState('none');
    try { const r = await fetch(CFG.syncPath, { cache: 'no-cache' }); if (r.ok && applyMerge(await r.json())) showToast('☁️ Spots aktualisiert'); } catch (e) {}
    return;
  }
  if (syncing) { syncQueued = true; return; }
  syncing = true; setSyncState('busy');
  try {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const { data, sha } = await ghGet(token);
      const merged = data ? applyMerge(data) : false;
      const payload = { version: 2, updatedAt: new Date().toISOString(), customSpots: spots.map(plain), deleted: tombs };
      const remoteCanon = data ? canon((data.customSpots || []).map(normSpot), data.deleted || []) : '';
      if (data && remoteCanon === canon(payload.customSpots, payload.deleted)) { ok = true; break; }
      const body = { message: 'Angelkarte Spot-Sync ' + new Date().toISOString().slice(0, 16), content: toB64(JSON.stringify(payload, null, 2)) };
      if (sha) body.sha = sha;
      const put = await fetch(apiUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (put.ok) { ok = true; if (opt.verbose) showToast('☁️ Spots gespeichert'); break; }
      if (put.status === 409 || put.status === 422) continue; // sha veraltet → neu holen & mergen
      throw new Error('PUT ' + put.status);
    }
    if (!ok) throw new Error('Konflikt');
    setDirty(false); setSyncState('ok'); lastSyncAt = Date.now();
    if (opt.verbose) showToast('☁️ Sync fertig');
  } catch (e) {
    console.error('Sync', e); setSyncState('err');
    if (!opt.silent) showToast('⚠️ Sync fehlgeschlagen – wird erneut versucht');
  } finally {
    syncing = false; if (syncQueued) { syncQueued = false; scheduleSync(); }
  }
}
const scheduleSync = debounce(() => { if (navigator.onLine) syncNow({ verbose: true }); else setSyncState('err'); }, 1500);
if (!PUBLIC) {
  window.addEventListener('online', () => { if (isDirty() || getToken()) syncNow({ silent: true }); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastSyncAt > 30000 && navigator.onLine) syncNow({ silent: true }); });
}

// ───────────────────────── GPS ─────────────────────────
async function acquireWake() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
function releaseWake() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && gpsActive) acquireWake(); });

function startGps() {
  if (!navigator.geolocation) { showToast('⚠️ GPS nicht verfügbar'); return; }
  gpsActive = true; $('navGps').classList.add('active'); acquireWake();
  const st = $('gpsStatus'); st.classList.add('visible'); st.textContent = '⌛ GPS wird gesucht …';
  if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lng, accuracy, altitude } = pos.coords;
    if (!gpsMarker) {
      const icon = L.divIcon({ html: '<div class="gps-pulse"><div class="gps-ring"></div><div class="gps-ring2"></div><div class="gps-dot"></div></div>', className: '', iconSize: [56, 56], iconAnchor: [28, 28] });
      gpsMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map).bindPopup(() => { const p = gpsMarker.getLatLng(); return `<div class="popup-title">📍 Mein Standort</div><div class="popup-coord">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</div><div class="popup-desc">Genauigkeit ± ${Math.round(accuracy)} m${altitude ? '<br>Höhe ' + Math.round(altitude) + ' m' : ''}</div><div class="popup-actions"><button class="popup-btn" data-act="copy" data-ll="${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}">📋 Kopieren</button><button class="popup-btn" data-act="wx" data-lat="${p.lat}" data-lng="${p.lng}" data-label="Meine Position">🌤️ Wetter</button></div>`; });
      gpsCircle = L.circle([lat, lng], { radius: accuracy, color: '#00614a', fillColor: '#12b08d', fillOpacity: .1, weight: 2, dashArray: '4 4' }).addTo(map);
      if (!gpsCentered) { map.flyTo([lat, lng], 14, { duration: 1.5 }); gpsCentered = true; }
    } else { gpsMarker.setLatLng([lat, lng]); gpsCircle.setLatLng([lat, lng]).setRadius(accuracy); }
    st.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}  ± ${Math.round(accuracy)} m${accuracy < 10 ? ' ✅' : ''}`;
    maybeWarmCache(lat, lng);
  }, err => {
    const msg = { 1: '⛔ GPS-Zugriff verweigert – bitte erlauben', 2: '⚠️ Position nicht ermittelbar', 3: '⏱ GPS-Timeout – wird wiederholt' }[err.code] || '⚠️ GPS-Fehler';
    showToast(msg); st.textContent = msg;
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 });
}
function stopGps() {
  if (gpsWatchId !== null) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
  if (gpsMarker) { map.removeLayer(gpsMarker); gpsMarker = null; }
  if (gpsCircle) { map.removeLayer(gpsCircle); gpsCircle = null; }
  gpsActive = false; gpsCentered = false; releaseWake();
  $('navGps').classList.remove('active'); $('gpsStatus').classList.remove('visible'); showToast('GPS gestoppt');
}

// Tile-Cache vorwärmen (Offline-Betrieb unterwegs)
let lastCacheCenter = null, lastWarmZoom = map.getZoom();
const distKm = (a, b) => { const R = 6371, dL = (b.lat - a.lat) * Math.PI / 180, dN = (b.lng - a.lng) * Math.PI / 180; const x = Math.sin(dL / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dN / 2) ** 2; return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); };
const lng2tile = (lon, z) => Math.floor((lon + 180) / 360 * Math.pow(2, z));
const lat2tile = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z)); };
const tile2lng = (x, z) => x / Math.pow(2, z) * 360 - 180;
const tile2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(.5 * (Math.exp(n) - Math.exp(-n))); };
function warmCache(center) {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  const z = Math.min(Math.max(map.getZoom(), 8), 15), zoom = map.getZoom(), radius = zoom >= 15 ? 2 : zoom >= 14 ? 5 : 10, b = map.getBounds();
  const layers = [baseLayers[currentBase]]; if (overlayOn.seaMap) layers.push(layerSeamap);
  const urls = [], seen = new Set();
  for (let x = lng2tile(b.getWest(), z); x <= lng2tile(b.getEast(), z); x++) for (let y = lat2tile(b.getNorth(), z); y <= lat2tile(b.getSouth(), z); y++) {
    if (distKm(center, { lat: (tile2lat(y, z) + tile2lat(y + 1, z)) / 2, lng: (tile2lng(x, z) + tile2lng(x + 1, z)) / 2 }) > radius) continue;
    layers.forEach(l => { const sub = typeof l.options.subdomains === 'string' ? l.options.subdomains[0] : 'a'; const u = l._url.replace('{s}', sub).replace('{z}', z).replace('{x}', x).replace('{y}', y); if (!seen.has(u)) { seen.add(u); urls.push(u); } });
  }
  urls.slice(0, z >= 15 ? 40 : z >= 14 ? 60 : 80).forEach(u => fetch(u, { mode: 'no-cors' }).catch(() => {}));
}
function maybeWarmCache(lat, lng) {
  const cur = { lat, lng }, z = Math.min(Math.max(map.getZoom(), 8), 15);
  if (!lastCacheCenter || distKm(lastCacheCenter, cur) >= 5 || Math.abs(z - lastWarmZoom) >= 2) { lastCacheCenter = cur; lastWarmZoom = z; warmCache(cur); }
}
map.on('zoomend', () => { if (gpsMarker) { const p = gpsMarker.getLatLng(); maybeWarmCache(p.lat, p.lng); } });

// ───────────────────────── Sheet / Panels ─────────────────────────
function setSheetCollapsed(c) { $('sheet').classList.toggle('collapsed', !!c); try { localStorage.setItem(K.sheet, c ? 'collapsed' : 'open'); } catch (e) {} }

// ───────────────────────── Wetter & Wellen (MET Norway) ─────────────────────────
// Locationforecast 2.0 + Oceanforecast 2.0, Lizenz CC BY 4.0. Direkter Browser-Aufruf ist für kleine Apps erlaubt
// (Identifikation über Origin/Referer). Deshalb: keine eigenen Header (sonst Preflight), Koordinaten max. 4 Nachkommastellen.
const WX_KEY = 'angelkarte_wx_v1', WX_TTL = 30 * 60e3;
const wxMem = new Map();
const compass = d => (d == null || !isFinite(d)) ? '–' : ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
const bft = ms => { const l = [0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]; let b = 0; while (b < l.length && ms >= l[b]) b++; return b; };
const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d || 0) : '–';
function wxEmoji(sym) {
  const s = String(sym || ''), night = /_night/.test(s);
  if (/thunder/.test(s)) return '⛈️'; if (/snow/.test(s)) return '❄️'; if (/sleet/.test(s)) return '🌨️';
  if (/showers/.test(s)) return '🌦️'; if (/rain/.test(s)) return '🌧️'; if (/fog/.test(s)) return '🌫️';
  if (/clearsky/.test(s)) return night ? '🌙' : '☀️'; if (/fair/.test(s)) return night ? '🌙' : '🌤️';
  if (/partlycloudy/.test(s)) return '⛅'; if (/cloudy/.test(s)) return '☁️'; return '🌡️';
}
async function wxGet(url) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return await r.json(); }
  finally { clearTimeout(t); }
}
function wxNormLoc(j) {
  const ts = j && j.properties && j.properties.timeseries; if (!Array.isArray(ts)) return [];
  return ts.slice(0, 70).map(e => {
    const d = e.data || {}, i = (d.instant && d.instant.details) || {}, n1 = d.next_1_hours, n6 = d.next_6_hours, n12 = d.next_12_hours;
    const p1 = n1 && n1.details && n1.details.precipitation_amount, p6 = n6 && n6.details && n6.details.precipitation_amount;
    const sm = (n1 || n6 || n12 || {}).summary;
    return { t: Date.parse(e.time), temp: i.air_temperature, wind: i.wind_speed, gust: i.wind_speed_of_gust, dir: i.wind_from_direction, cloud: i.cloud_area_fraction, sym: (sm && sm.symbol_code) || '', rain: p1 != null ? p1 : (p6 != null ? p6 / 6 : null) };
  });
}
function wxNormOce(j) {
  const ts = j && j.properties && j.properties.timeseries; if (!Array.isArray(ts)) return [];
  return ts.slice(0, 70).map(e => {
    const i = (e.data && e.data.instant && e.data.instant.details) || {};
    return { t: Date.parse(e.time), wave: i.sea_surface_wave_height, waveDir: i.sea_surface_wave_from_direction, cur: i.sea_water_speed, curDir: i.sea_water_to_direction, sst: i.sea_water_temperature };
  });
}
async function loadWeather(lat, lng, force) {
  const key = lat.toFixed(2) + ',' + lng.toFixed(2), m = wxMem.get(key);
  if (!force && m && Date.now() - m.t < WX_TTL) return m;
  const la = lat.toFixed(4), lo = lng.toFixed(4);
  const [a, b] = await Promise.allSettled([
    wxGet(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${la}&lon=${lo}`),
    wxGet(`https://api.met.no/weatherapi/oceanforecast/2.0/complete?lat=${la}&lon=${lo}`)
  ]);
  const loc = a.status === 'fulfilled' ? wxNormLoc(a.value) : [], oce = b.status === 'fulfilled' ? wxNormOce(b.value) : [];
  if (!loc.length && !oce.length) {
    const st = (lsGet(WX_KEY, {}) || {})[key];
    if (st && ((st.loc && st.loc.length) || (st.oce && st.oce.length))) return Object.assign({ stale: true }, st);
    throw a.reason || b.reason || new Error('keine Daten');
  }
  const d = { t: Date.now(), loc, oce };
  wxMem.set(key, d);
  const store = lsGet(WX_KEY, {}) || {}; store[key] = d;
  Object.keys(store).sort((x, y) => store[y].t - store[x].t).slice(12).forEach(k => delete store[k]);
  lsSet(WX_KEY, store);
  return d;
}
function wxNear(arr, t) {
  let best = null, bd = Infinity;
  arr.forEach(e => { const d = Math.abs(e.t - t); if (d < bd) { bd = d; best = e; } });
  return bd <= 3.5 * 3600e3 ? best : null;
}
// Grobe Richtwerte für kleine Boote (keine Sicherheitsempfehlung): 1 = erhöht, 2 = stark
function wxLevel(w) {
  const wind = w.wind || 0, g = w.gust || 0, wave = w.wave || 0;
  return (wind >= 14 || g >= 18 || wave >= 3) ? 2 : (wind >= 10 || g >= 14 || wave >= 2) ? 1 : 0;
}
function wxHtml(d, label, lat, lng) {
  const now = Date.now(), W = wxNear(d.loc, now) || {}, O = wxNear(d.oce, now) || {};
  const lvl = wxLevel({ wind: W.wind, gust: W.gust, wave: O.wave }), today = new Date(now).toDateString();
  const fmt = t => { const x = new Date(t), hm = x.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); return x.toDateString() === today ? hm : x.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ' + hm; };
  const row = (k, v) => `<div class="wx-k">${k}</div><div class="wx-v">${v}</div>`;
  let grid = '';
  if (d.loc.length) {
    grid += row('💨 Wind', `${compass(W.dir)} ${num(W.wind, 1)} m/s (Bft ${W.wind == null ? '–' : bft(W.wind)})${W.gust != null ? ', Böen ' + num(W.gust, 1) : ''}`);
    grid += row('☁️ Wolken', `${num(W.cloud)} % · Regen ${num(W.rain, 1)} mm/h`);
  }
  if (d.oce.length) {
    grid += row('🌊 Welle', O.wave != null ? `${num(O.wave, 1)} m aus ${compass(O.waveDir)}` : '–');
    grid += row('🧭 Strömung', O.cur != null ? `${num(O.cur, 2)} m/s nach ${compass(O.curDir)}` : '–');
    grid += row('🌡️ Wasser', `${num(O.sst, 1)} °C`);
  } else grid += row('🌊 Welle', '<i>keine Meeresdaten für diesen Punkt</i>');
  const rows = [0, 3, 6, 9, 12, 18, 24, 36].map(h => {
    const tt = now + h * 3600e3, l = wxNear(d.loc, tt) || {}, o = wxNear(d.oce, tt) || {};
    if (!l.t && !o.t) return '';
    return `<tr class="wx-l${wxLevel({ wind: l.wind, gust: l.gust, wave: o.wave })}"><td>${fmt(l.t || o.t)}</td><td>${wxEmoji(l.sym)}</td><td>${compass(l.dir)} ${num(l.wind)}${l.gust != null ? ' (' + num(l.gust) + ')' : ''}</td><td>${o.wave != null ? num(o.wave, 1) : '–'}</td><td>${num(l.rain, 1)}</td></tr>`;
  }).join('');
  const attrs = `data-lat="${lat}" data-lng="${lng}" data-label="${esc(label)}"`;
  return `<div class="wx"><div class="popup-title">${wxEmoji(W.sym)} ${esc(label)}</div>` +
    `<div class="popup-coord">${lat.toFixed(4)}, ${lng.toFixed(4)} · Luft ${num(W.temp, 1)} °C</div>` +
    (lvl ? `<div class="wx-warn wx-l${lvl}">⚠️ Wind/Seegang erhöht (Richtwerte ab 10 m/s bzw. 2 m Welle)</div>` : '') +
    `<div class="wx-grid">${grid}</div>` +
    (rows ? `<table class="wx-tab"><thead><tr><th>Zeit</th><th></th><th>Wind m/s (Böe)</th><th>Welle m</th><th>Regen</th></tr></thead><tbody>${rows}</tbody></table>` : '') +
    `<div class="wx-foot">Stand ${fmt(d.t)}${d.stale ? ' · gespeichert (offline)' : ''} · Daten: <a href="https://www.met.no/" target="_blank" rel="noopener">MET Norway</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)</div>` +
    `<div class="popup-actions"><button class="popup-btn" data-act="wxrefresh" ${attrs}>🔄 Aktualisieren</button></div></div>`;
}
async function showWeather(lat, lng, label, force) {
  const popup = L.popup({ maxWidth: 340, minWidth: 270, autoPanPadding: [12, 90] }).setLatLng([lat, lng])
    .setContent(`<div class="wx"><div class="popup-title">🌤️ ${esc(label)}</div><div class="popup-desc">Lade Wetter …</div></div>`).openOn(map);
  try {
    const d = await loadWeather(lat, lng, force);
    if (!map.hasLayer(popup)) return;
    popup.setContent(wxHtml(d, label, lat, lng));
  } catch (e) {
    if (!map.hasLayer(popup)) return;
    const why = e && e.status === 429 ? 'Zu viele Anfragen – kurz warten.' : e && e.status === 403 ? 'MET hat die Anfrage abgelehnt (403).' : 'Keine Verbindung oder keine Daten für diesen Punkt.';
    popup.setContent(`<div class="wx"><div class="popup-title">🌤️ ${esc(label)}</div><div class="popup-desc">${why}</div><div class="popup-actions"><button class="popup-btn" data-act="wxrefresh" data-lat="${lat}" data-lng="${lng}" data-label="${esc(label)}">🔄 Erneut versuchen</button></div></div>`);
    console.warn('Wetter', e);
  }
  wirePopup(popup.getElement());
}
function closeLayerPanel() { $('layerPanel').classList.remove('open'); }
function openToken() {
  const t = getToken(); $('tokenModal').classList.add('open'); $('tokenInput').value = '';
  $('tokenStatus').textContent = t ? '✅ Token vorhanden' : '⚠️ Kein Token – Sync deaktiviert (nur Lesen)';
}

// ───────────────────────── Events ─────────────────────────
const dz = $('dropzone'), fi = $('fileInput'), ji = $('jsonImportInput');
dz.addEventListener('click', () => fi.click());
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); [...e.dataTransfer.files].forEach(loadKmlFile); });
fi.addEventListener('change', () => { [...fi.files].forEach(loadKmlFile); fi.value = ''; });
ji.addEventListener('change', () => { if (ji.files[0]) importJsonFile(ji.files[0]); ji.value = ''; });
$('btnImportJson').addEventListener('click', () => ji.click());
$('btnExportJson').addEventListener('click', exportJson);
$('btnExportKml').addEventListener('click', exportKml);
$('btnAddSpot').addEventListener('click', () => { setSpotMode(true); $('sheet').classList.remove('open'); $('navKml').classList.remove('active'); showToast('📍 Jetzt auf die Karte tippen'); });
$('btnSpotHere').addEventListener('click', () => {
  if (!gpsMarker) { showToast('GPS zuerst einschalten und kurz warten'); if (!gpsActive) startGps(); return; }
  openSpotModal({ latlng: gpsMarker.getLatLng() });
});
if (PUBLIC) {
  $('btnClearAll').addEventListener('click', () => {
    if (!confirm('Wirklich alle Spots und KML löschen?')) return;
    spots.forEach(s => s.marker && map.removeLayer(s.marker)); spots = [];
    kmlLayers.forEach(x => map.removeLayer(x.group)); kmlLayers = [];
    persistSpots(); saveKmlStore(); renderSpotList(); renderKmlList(); showToast('🗑️ Alles gelöscht');
  });
  $('navInfo').addEventListener('click', () => $('infoModal').classList.add('open'));
  $('closeInfo').addEventListener('click', () => { $('infoModal').classList.remove('open'); try { localStorage.setItem(K.seen, '1'); } catch (e) {} });
} else {
  $('navSync').addEventListener('click', openToken);
  $('tokenCancel').addEventListener('click', () => $('tokenModal').classList.remove('open'));
  $('tokenSave').addEventListener('click', () => {
    const v = $('tokenInput').value.trim(); if (!v) { $('tokenModal').classList.remove('open'); return; }
    setToken(v); $('tokenModal').classList.remove('open'); showToast('✅ Token gespeichert'); syncNow({ verbose: true });
  });
  $('tokenDelete').addEventListener('click', () => { setToken(''); $('tokenInput').value = ''; $('tokenStatus').textContent = '⚠️ Token gelöscht – Sync deaktiviert'; setSyncState('none'); });
  $('tokenSyncNow').addEventListener('click', () => { $('tokenModal').classList.remove('open'); if (!getToken()) { showToast('⚠️ Erst Token speichern'); return; } syncNow({ verbose: true }); });
  $('tokenModal').addEventListener('click', e => { if (e.target.id === 'tokenModal') $('tokenModal').classList.remove('open'); });
}
$('spotCancel').addEventListener('click', () => { closeSpotModal(); setSpotMode(false); });
$('spotSave').addEventListener('click', saveSpotModal);
$('spotModal').addEventListener('click', e => { if (e.target.id === 'spotModal') closeSpotModal(); });
$('modeCancel').addEventListener('click', () => setSpotMode(false));
$('navSpot').addEventListener('click', () => { setSpotMode(!spotAddMode); if (spotAddMode) { $('sheet').classList.remove('open'); $('navKml').classList.remove('active'); showToast('📍 Jetzt auf die Karte tippen'); } });
map.on('click', e => { closeLayerPanel(); if (spotAddMode) openSpotModal({ latlng: e.latlng }); });
map.on('contextmenu', e => { if (!modalState) openSpotModal({ latlng: e.latlng }); }); // Long-Press

$('navGps').addEventListener('click', () => gpsActive ? stopGps() : startGps());
$('navCenter').addEventListener('click', () => { if (gpsMarker) { map.flyTo(gpsMarker.getLatLng(), Math.max(map.getZoom(), 14), { duration: 1 }); showToast('📍 Zentriert'); } else showToast('GPS zuerst einschalten'); });
$('navKml').addEventListener('click', () => {
  const sheet = $('sheet'), now = !sheet.classList.contains('open');
  sheet.classList.toggle('open', now); $('navKml').classList.toggle('active', now);
  if (now) { closeLayerPanel(); try { setSheetCollapsed(localStorage.getItem(K.sheet) === 'collapsed'); } catch (e) {} }
});
$('sheetCollapseBtn').addEventListener('click', () => setSheetCollapsed(!$('sheet').classList.contains('collapsed')));

function syncBaseRadios(v) { document.querySelectorAll('[name=layer]').forEach(x => { x.checked = x.value === (v || currentBase); }); }
function switchBase(v) { map.removeLayer(baseLayers[currentBase]); currentBase = v; map.addLayer(baseLayers[currentBase]); reorderOverlays(); syncBaseRadios(); saveViewPrefs(); }
document.querySelectorAll('[name=layer]').forEach(r => r.addEventListener('change', () => {
  const prov = BASE_PROVIDER[r.value], apply = () => { switchBase(r.value); closeLayerPanel(); showToast('Karte: ' + baseNames[currentBase].replace(/^\S+\s/, '')); };
  if (prov && !consent[prov]) { syncBaseRadios(); closeLayerPanel(); askConsent(prov, apply); return; }
  apply();
}));
function setSeamap(on, sw) {
  overlayOn.seaMap = on; on ? map.addLayer(layerSeamap) : map.removeLayer(layerSeamap);
  (sw || $('toggleSeamap')).classList.toggle('on', on); reorderOverlays(); saveViewPrefs();
}
$('toggleSeamap').addEventListener('click', function () {
  if (overlayOn.seaMap) return setSeamap(false, this);
  if (consent.openseamap) return setSeamap(true, this);
  closeLayerPanel(); askConsent('openseamap', () => setSeamap(true)); // erst nach Zustimmung wird tiles.openseamap.org kontaktiert
});
function setDepth(on, sw) {
  overlayOn.depth = on; on ? map.addLayer(layerDepth) : map.removeLayer(layerDepth);
  (sw || $('toggleDepth')).classList.toggle('on', on); reorderOverlays(); saveViewPrefs();
}
$('consentYes').addEventListener('click', () => { const p = pendingConsent; if (!p) return; setConsent(p.key, true); closeConsent(); p.onYes(); showToast('✅ ' + PROVIDERS[p.key].name + ' aktiviert'); });
$('consentNo').addEventListener('click', closeConsent);
$('consentModal').addEventListener('click', e => { if (e.target.id === 'consentModal') closeConsent(); });
$('btnLegal').addEventListener('click', () => { closeLayerPanel(); openLegal(); });
$('legalModal').addEventListener('click', e => {
  if (e.target.id === 'legalModal' || e.target.closest('#closeLegal')) { $('legalModal').classList.remove('open'); return; }
  const rb = e.target.closest('[data-legal=revoke]'); if (rb) revokeConsent(rb.dataset.key);
});
if ($('infoLegal')) $('infoLegal').addEventListener('click', e => { e.preventDefault(); openLegal(); });
map.attributionControl.setPrefix(`<a href='#' id='lnkLegal' role='button'>Impressum &amp; Datenschutz</a> · <a href='https://leafletjs.com' target='_blank' rel='noopener'>Leaflet</a>`);
map.attributionControl.getContainer().addEventListener('click', e => { if (e.target.closest('#lnkLegal')) { e.preventDefault(); openLegal(); } });
$('toggleDepth').addEventListener('click', function () {
  if (overlayOn.depth) return setDepth(false, this);
  if (consent.havbunn) return setDepth(true, this);
  closeLayerPanel(); askConsent('havbunn', () => setDepth(true));
});
$('toggleTheme').addEventListener('click', function () {
  const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
  applyTheme(dark ? 'dark' : 'light'); this.classList.toggle('on', dark);
});
$('btnMarineTraffic').addEventListener('click', () => {
  const c = map.getCenter();
  window.open(`https://www.marinetraffic.com/en/ais/home/centerx:${c.lng.toFixed(4)}/centery:${c.lat.toFixed(4)}/zoom:${Math.min(map.getZoom(), 17)}`, '_blank', 'noopener');
  closeLayerPanel();
});
$('btnLayers').addEventListener('click', e => { e.stopPropagation(); const p = $('layerPanel'); p.classList.toggle('open'); if (p.classList.contains('open')) $('sheet').classList.remove('open'), $('navKml').classList.remove('active'); });
document.addEventListener('click', e => { if (!e.target.closest('#layerPanel') && !e.target.closest('#btnLayers')) closeLayerPanel(); });
$('btnWx').addEventListener('click', e => {
  e.stopPropagation(); closeLayerPanel(); $('sheet').classList.remove('open'); $('navKml').classList.remove('active');
  const p = gpsMarker ? gpsMarker.getLatLng() : map.getCenter();
  showWeather(p.lat, p.lng, gpsMarker ? 'Meine Position' : 'Kartenmitte');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeLayerPanel(); closeSpotModal(); setSpotMode(false); } });

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

// ───────────────────────── Start ─────────────────────────
restoreSpots();
restoreKml();
updateSummary();
try { if (localStorage.getItem(K.sheet) === 'collapsed') $('sheet').classList.add('collapsed'); } catch (e) {}

if (PUBLIC) {
  if (!kmlLayers.length) { loadKmlText('Hellesoy Fangpunkte (Beispiel)', EXAMPLE_KML, {}); showToast('🎣 Beispielpunkte geladen – ersetze sie durch deine'); }
  try { if (!localStorage.getItem(K.seen)) $('infoModal').classList.add('open'); } catch (e) {}
} else {
  (async () => {
    // Hinweis: ?token=-Übergabe per URL bewusst entfernt (Token landet sonst in Verlauf/Logs). Eintragen nur manuell unter „Sync".
    if (new URLSearchParams(location.search).has('token')) history.replaceState({}, '', location.pathname);
    setSyncState(getToken() ? 'ok' : 'none');
    const n = await loadStaticKml();
    await syncNow({ silent: true });
    if (n) showToast(`📂 ${n} KML aus Repo geladen`);
  })();
}
})();
