# TikTok-Sandbox für CrunchLab KI

Die Integration verwendet TikTok Login Kit Web (OAuth v2) und zunächst ausschließlich die Content Posting API mit `video.upload`. Sie ist nur für eingeloggte Shopify-Admins sichtbar. TikTok-Zugangsdaten und Tokens dürfen nie in Git, Screenshots, Supportnachrichten oder Browsercode gelangen.

## Umgebungsvariablen

In Render serverseitig setzen:

```text
TIKTOK_CLIENT_KEY=<Client Key aus TikTok for Developers>
TIKTOK_CLIENT_SECRET=<Client Secret aus TikTok for Developers>
TIKTOK_REDIRECT_URI=https://crunchlab-bestellungen.onrender.com/api/tiktok/callback
TIKTOK_ENV=sandbox
TIKTOK_TOKEN_ENCRYPTION_KEY=<zufälliger geheimer Wert mit mindestens 32 Zeichen>
```

`TIKTOK_TOKEN_ENCRYPTION_KEY` muss dauerhaft gesichert werden. Ein Austausch macht bestehende verschlüsselte Tokens unlesbar und erfordert eine neue TikTok-Verbindung.

## TikTok Developer Portal

App: **CrunchLab AI**  
Website: `https://crunch-lab.de`  
Login-Kit-Redirect URI, exakt und ohne Querystring:

```text
https://crunchlab-bestellungen.onrender.com/api/tiktok/callback
```

Scopes:

```text
user.info.basic
user.info.profile
user.info.stats
video.list
video.upload
```

`video.publish` wird noch nicht angefordert. Web Login Kit verwendet einen zufälligen, einmalig konsumierbaren `state`. PKCE ist laut aktueller TikTok-Web-Dokumentation nicht erforderlich; das Client Secret bleibt ausschließlich auf dem Server.

## Erforderliche Weiterleitung der Redirect URI

Die Callback-Route existiert in der Render-App als `/api/tiktok/callback`. Die direkte Render-URL wird verwendet, weil `crunch-lab.de` vom Shopify-Storefront bedient wird und `/api/tiktok/callback` dort nicht an die App weiterleitet. Prüfen:

```text
https://crunchlab-bestellungen.onrender.com/api/tiktok/callback
```

Eine normale Shopify-Theme-Seite reicht hierfür nicht aus. Geeignet ist eine kontrollierte Reverse-Proxy-/Edge-Weiterleitung. Erst danach funktioniert OAuth mit der verlangten exakten Domain.

## Datenbank und Deployment

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run typecheck
npm run lint
npm test
npm run build
```

Für fällige geplante Uploads einen Render Cron Job mit demselben Code, derselben persistenten Datenbank und denselben Umgebungsvariablen einrichten:

```bash
npm run tiktok:worker
```

Empfohlenes Intervall: alle 5 bis 10 Minuten. Pro Lauf werden höchstens fünf Posts verarbeitet; Fehlversuche sind auf drei Versuche mit Wartezeit begrenzt.

## Sandbox testen

1. Shopify Admin öffnen.
2. `KI-Team → TikTok` wählen.
3. „TikTok verbinden“ anklicken.
4. Ausschließlich das eigene CrunchLab-Konto autorisieren.
5. Profilbild, Benutzername, Anzeigename, Scopes und Verbindungsstatus kontrollieren.
6. `TikTok Demo` öffnen.
7. Ein unterstütztes MP4- oder MOV-Video bis 128 MB und höchstens 10 Minuten auswählen.
8. Caption und Hashtags prüfen und ausdrücklich „Als TikTok-Entwurf hochladen“ anklicken.
9. Den Status einmalig über die Übersicht abrufen.
10. Die TikTok-Inbox öffnen und den Entwurf dort bearbeiten beziehungsweise veröffentlichen.

Caption und Hashtags werden bei `video.upload` als redaktionelle Vorlage in CrunchLab KI gespeichert. Der Upload-Endpunkt selbst übernimmt diese Metadaten nicht; die endgültige Bearbeitung erfolgt im TikTok-Inbox-Ablauf.

## Prüfvideo aufnehmen

Das Bildschirmvideo sollte ohne Schnitte zeigen:

1. Shopify-Admin und internen Bereich `TikTok Demo`.
2. Klick auf „TikTok verbinden“ und TikTok-Einwilligungsseite.
3. Rückkehr mit sichtbarem CrunchLab-Profil, niemals Tokens oder Secrets.
4. Auswahl eines eigenen, rechtefreien Testvideos.
5. Bearbeitbare Caption und Hashtags.
6. Ausdrücklichen Klick auf den Entwurf-Upload.
7. Erfolgsstatus beziehungsweise TikTok-Support-ID bei einem kontrollierten Fehler.
8. TikTok-Inbox und Abschluss des Entwurfs in TikTok.

## Nach Freigabe von `video.publish`

1. TikToks Content Posting API Audit erfolgreich abschließen.
2. Scope `video.publish` im Developer Portal aktivieren und bei OAuth ergänzen.
3. Konto neu autorisieren.
4. Creator Info unmittelbar vor jedem Direct Post abrufen.
5. Rückgabewerte zu Privatsphäre, Interaktionen und maximaler Videodauer in einer bestätigungspflichtigen Oberfläche anzeigen.
6. Den vorbereiteten Direct-Post-Pfad erst nach einem privaten kontrollierten Produktionstest entsperren.
7. Status-Webhooks ergänzen oder weiterhin begrenzt pollen.

Wichtiger Richtlinienhinweis: TikToks aktuelle Content-Sharing-Richtlinie nennt rein interne Upload-Werkzeuge für eigene oder vom Team verwaltete Konten als nicht akzeptables Audit-Szenario. Die Sandbox funktioniert technisch, aber eine Freigabe für öffentliches Direct Post ist für diesen rein internen Anwendungszweck nicht garantiert.
