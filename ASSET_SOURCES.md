# Bild- und Ortsquellen

## Casa Antares

- `dist/assets/casa-eingang.avif`: vom Nutzer im Projekt bereitgestellte Datei `Casa_Eingang.avif`, unverändert übernommen.
- `dist/assets/casa-antares-garten.webp`: https://fincasdelavilla.com/wp-content/uploads/2024/09/casa-antares-villa-de-leyva-fincas-de-la-villa-9.webp — Quelle: https://fincasdelavilla.com/casa-alquiler-villa-de-leyva/casa-antares/
- `dist/assets/casa-antares-pergola.jpg`: https://www.bodasenvilladeleyva.com/wp-content/uploads/2020/06/MAHEYALBERTO-17.jpg — Quelle: https://www.bodasenvilladeleyva.com/portfolio/casa-antares/
- Die Pergola zeigt eine frühere Feier, keine Zusage zur Dekoration der Hochzeit von Francisco und Katherine. In der Bildunterschrift als Impression gekennzeichnet.
- Adresse und Karteneinbettung am 13.09.2026 über den vom Nutzer genannten Link https://share.google/9lVp0teyH2hZcPGr6 in Google Maps bestätigt: Casa Antares, Km 3 vía el Infiernito, Villa de Leyva, Boyacá, Kolumbien. Google-Maps-Koordinaten: 5.6456278, -73.5542638.

## Text

Hochzeitsort, Beschreibung der Umgebung, Temperaturen (ca. 22 °C tagsüber / 12 °C nachts) und Heizpilze nach Nutzerangaben. Die Temperaturangaben sind als ungefähre Orientierung formuliert, nicht als Wettervorhersage.

## Animation

### Schleier und Tagesablauf

Der untere Saum trägt eine prozedurale Bogenstickerei mit kleinen Perlen und sanften Lichtreflexen. Das Muster folgt den Stoffkoordinaten und damit der Bewegung des Netzes. Die Deckkraft beträgt mindestens 99,2 %, damit der Ablauf hinter dem geschlossenen Schleier kaum durchscheint. Bei reduzierter Bewegung bleibt das Licht zeitlich konstant; ohne WebGL zeigt die Abdeckung einen statischen bestickten Saum.

Tagesablauf nach Nutzerangaben: Ankunft 16:30, Zeremonie 17:00, Abendessen 19:00 am 09.01.2027, Ende 00:30 am 10.01.2027. Alle Zeiten sind Ortszeit Kolumbien (UTC−05:00).

Der Schleier wird mit einem WebGL-Stoffnetz gerendert und benötigt kein zusätzliches Bild. Positionsbasierte 3D-Simulation mit festen 1/60-s-Schritten, Längen-, Scher- und Biegeconstraints, Schwerkraft, Dämpfung, einer festen oberen Kante und gewichtetem Maus-/Fingergriff am unteren Saum. Beim Hochziehen führen weiche Federn den Stoff in einem Bogen über die obere Kante; es handelt sich um eine interaktive Stoffannäherung. Unsichtbare Tabs/Abschnitte pausieren; kleine Bildschirme verwenden ein reduziertes Netz. Tastatur und Direktanzeige ergänzen die Ziehgeste. Ohne WebGL bleibt eine einfache nach oben zusammenklappende Abdeckung erhalten. Hochziehen und erneutes Senken wurden mit schmalem und breitem Stoffnetz geprüft; die Ziehgeste wurde zusätzlich im Browser überprüft.

Geprüft: wiederholtes Öffnen/Schließen, kurze Ziehbewegung und Rückkehr, ausreichend weites Ziehen, Direktanzeige, Enter-Bedienung, endliche Simulationswerte, Abdeckung bei 320 und 850 Pixeln Breite. Keine externen Laufzeitbibliotheken.

### Briefumschlag

Der Klick auf das Siegel oder „Mit Animation öffnen“ startet ausdrücklich die vollständige Animation. „Ohne Animation öffnen“ zeigt die Einladung direkt. Nach der Öffnung startet „Briefanimation ansehen“ in der oberen Leiste dieselbe Animation erneut; der Knopf bleibt beim Scrollen sichtbar.
