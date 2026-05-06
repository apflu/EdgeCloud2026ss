# 11


## Fragen
Wo läuft die Vision-Inferenz wirklich? Der Reachy Mini hat nicht die Rechenleistung für ein brauchbares Sturzerkennungsmodell. Also muss der Videostream zum Server. Dann ist die Aussage "Bilder verlassen den Raum nicht" zwar noch haltbar (lokales Netz), aber die Architektur im Dokument ist irreführend. Besser wäre: Reachy streamt an den Server, der Server inferiert, Rohbilder werden sofort verworfen – nur Events werden gespeichert.

Sturzerkennung per Kamera ist der umständliche Weg. Ein Beschleunigungssensor am ESP32 erkennt Stürze deutlich zuverlässiger, schneller und ressourcenschonender. Die Kamera bringt für Sturzerkennung wenig Mehrwert, dafür viel Komplexität (Pose Estimation, Beleuchtungsprobleme, Okklusion). Sinnvoller wäre die Kamera als zweiten Kanal zur Verifikation zu nutzen – also erst Sturz per IMU detektieren, dann kurz per Kamera bestätigen.

Sensor Fusion fehlt konzeptionell. Das Dokument sagt, der Server wertet Sensordaten und Kamera-Metadaten "zusammen" aus – aber wie? Es fehlt eine konkrete Fusionsstrategie. Best Practice wäre ein Event-Driven-Ansatz: Jeder Sensor publiziert Events über MQTT, der Server hat eine Rule Engine oder ein einfaches Zustandsmodell, das aus kombinierten Events Alarmstufen ableitet. Beispiel: Beschleunigungssensor meldet Sturz + Puls steigt + Patient antwortet nicht auf Reachy-Audioprobe → Alarm Stufe 3.

Verschlüsselung auf ESP32 – machbar, aber mit Einschränkungen. Der ESP32 hat Hardware-AES, also ist symmetrische Verschlüsselung kein Problem. TLS mit Zertifikaten wird aber schnell eng im RAM. Pragmatischer für ein Uni-Projekt: MQTT over TLS zum Server, Pre-Shared Keys statt vollständige PKI. Das ist technisch sauber und trotzdem umsetzbar.

Netzwerktopologie ist unklar. Wie kommunizieren die Komponenten? Eine saubere Architektur wäre: ESP32s → MQTT-Broker (auf dem Server) → Processing Pipeline → Dashboard. Reachy separat per RTSP oder gRPC an den Server. Zwei getrennte Kommunikationspfade, sauber trennbar.

Was macht Reachy eigentlich sinnvoll? Im aktuellen Konzept ist Reachy eher ein teurer Kameraständer. Der eigentliche Mehrwert wäre Interaktion: Patient ansprechen ("Brauchen Sie Hilfe?"), Kopf zum Patienten drehen als visuelles Feedback, einfache Ja/Nein-Kommunikation ermöglichen. Das würde Reachy von einem passiven Beobachter zu einem aktiven Assistenten machen.

192.168.179.191 laboradmin FU12Labor
