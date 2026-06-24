# Node 2: Vision & Triage Node (ESP32-CAM)

## Sinn & Zweck
Dieser Node liefert das visuelle Feedback für den Triage-Prozess. Um Datenschutzvorgaben zu erfüllen, streamt er nur bei Bedarf.

## Technologie
- **M-JPEG Streaming**: Liefert einen ungefilterten Live-Stream mit bis zu 15 MB/s.
- **HTTP Server**: Erreichbar unter `http://<IP-ADRESSE>:81/stream`.

## Schnittstelle & Integration
**Nächste Schritte für KI/Backend-Team:**
1. Der Server greift den Raw-Stream über die HTTP-Schnittstelle ab.
2. Ein lokales Vision-Language-Model (VLM) wertet die Bilder auf dem EPYC-Server (RTX 5090) aus.
3. Bei Notfällen (Sturz erkannt) wird ein Alarm an das Personal generiert.