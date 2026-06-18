/**
 * @file main.cpp
 * @brief Smart Medical Waiting Room - Connected Edge Node (Python-Spoofing)
 */

#include <Arduino.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <PubSubClient.h>

// --- Unsere Sensor-Klassen ---
#include "EnvironmentMonitor.h"
#include "PatientCounter.h"
#include "GasAlarm.h"

// --- KONFIGURATION (HIER ANPASSEN!) ---
const char* ssid = "OpenWRT-2.4G";         // <-- 2.4 GHz WLAN (oder Hotspot) eintragen
const char* password = "FU12Labor"; // <-- WLAN Passwort eintragen

// Wir nutzen den öffentlichen Broker für den Test!
// (Später im Labor hier die IP des Servers eintragen, z.B. "192.168.x.x")
const char* mqtt_server = "192.168.179.191";
const int mqtt_port = 1883;

// EXAKT das Topic aus dem Python-Skript!
const char* mqtt_topic = "edge/observations/room/101"; 

// --- PINS ---
#define I2C_SDA 4
#define I2C_SCL 5
#define GAS_PIN 6

// --- OBJEKTE ---
EnvironmentMonitor envMonitor;
PatientCounter patientCounter;
GasAlarm gasAlarm;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

/**
 * @brief Stellt eine stabile WLAN Verbindung her
 */
/**
 * @brief Stellt eine stabile WLAN Verbindung her (mit Deep Debugging)
 */
void setup_wifi() {
  Serial.println("\n--- Netzwerk Setup ---");
  Serial.print("Verbinde mit WLAN: ");
  Serial.println(ssid);

  // 1. WLAN Event-Listener (Der "Spion", der lauscht, was schiefgeht)
  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info){
    if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
      Serial.print("\n[WLAN FEHLER] Verbindung abgelehnt! Reason-Code: ");
      Serial.println(info.wifi_sta_disconnected.reason);
    }
  });

  // 2. Expliziter Reset des WLAN-Moduls
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(500);

  // 3. Optional: Zwinge den ESP32, auch ältere WPA2-Standards zu akzeptieren
  //WiFi.setMinSecurity(WIFI_AUTH_WPA_WPA2_PSK); 

  // 4. Start
  WiFi.begin(ssid, password);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[SUCCESS] WLAN verbunden!");
    Serial.print("IP-Adresse: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[FATAL] WLAN Timeout. Konnte keine Verbindung herstellen.");
  }
}

/**
 * @brief Hält die MQTT-Verbindung aufrecht
 */
void reconnect_mqtt() {
  while (!mqttClient.connected()) {
    Serial.print("Verbinde mit MQTT-Broker...");
    String clientId = "ESP32-MedicalHub-";
    clientId += String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println(" [SUCCESS] Verbunden!");
    } else {
      Serial.print(" [ERROR] Fehlercode: ");
      Serial.print(mqttClient.state());
      Serial.println(" - 5 Sekunden warten...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL); 

  // 1. Netzwerk starten
  setup_wifi();
  mqttClient.setServer(mqtt_server, mqtt_port);

  // 2. Hardware starten
  Serial.println("\n--- Hardware Setup ---");
  envMonitor.begin();
  patientCounter.begin();
  gasAlarm.begin(GAS_PIN);
}

void loop() {
  // 1. WLAN Check
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARNUNG] WLAN verloren. Verbinde neu...");
    WiFi.disconnect();
    WiFi.reconnect();
    delay(5000); // Hier ist ein Delay okay, weil wir eh offline sind
    return;
  }

  // 2. MQTT Check
  if (!mqttClient.connected()) {
    reconnect_mqtt();
  }
  
  // DAS IST DIE WICHTIGSTE ZEILE! Sie muss JEDEN Durchlauf ohne Pause ausgeführt werden.
  mqttClient.loop(); 

  // 3. Stoppuhr-Logik (Senden ohne Delay!)
  static unsigned long lastMsgTime = 0; // Speichert den Zeitpunkt der letzten Nachricht
  unsigned long now = millis();

  // Wenn 3000 Millisekunden (3 Sekunden) vergangen sind:
  if (now - lastMsgTime >= 3000) {
    lastMsgTime = now; // Stoppuhr zurücksetzen

    // --- Sensoren auslesen ---
    envMonitor.update();
    patientCounter.update();
    gasAlarm.update();

    // --- JSON NEU AUFBAUEN ---
    DynamicJsonDocument doc(1024); 

    doc["roomId"] = "Room-101";
    
    // Dynamischer Zeitstempel (Damit das Dashboard erkennt: Neue Daten!)
    char timeString[32];
    sprintf(timeString, "2026-06-18T12:00:%02d.%03dZ", (now / 1000) % 60, now % 1000);
    doc["timestamp"] = timeString; 

    // Patienten Array
    JsonArray patients = doc.createNestedArray("patients");
    JsonObject patientA = patients.createNestedObject();
    
    patientA["patientId"] = "PATIENT-A"; 
    patientA["displayAlias"] = "Patient A (ESP32)"; 
    patientA["bedZone"] = "Bed A";

    // Tracking
    JsonObject tracking = patientA.createNestedObject("tracking");
    float distMeters = patientCounter.getDistance() / 1000.0; 
    tracking["personDetected"] = true; 
    tracking["zone"] = "Bed A";
    tracking["posture"] = "sitting";
    tracking["motionLevel"] = 4.8;
    tracking["fallProbability"] = 7;
    tracking["timeImmobileSeconds"] = 0;
    tracking["distanceFromBedMeters"] = distMeters; 
    tracking["confidence"] = 0.98;

    // Vitals
    JsonObject vitals = patientA.createNestedObject("vitals");
    vitals["heartRate"] = 133; 
    vitals["temperature"] = envMonitor.getTemperature(); 
    vitals["oxygenSaturation"] = 98;

    // Devices
    JsonArray devices = patientA.createNestedArray("devices");
    JsonObject dev1 = devices.createNestedObject();
    dev1["id"] = "esp32-s3-sensor-hub-01";
    dev1["type"] = "wearable";
    dev1["battery"] = 100;
    dev1["lastSeen"] = timeString; // Auch hier der neue Zeitstempel

    // --- Senden ---
    String payload;
    serializeJson(doc, payload);

    Serial.println("\n--- Sende an Dashboard ---");
    serializeJsonPretty(doc, Serial);
    Serial.println();
    
    mqttClient.publish(mqtt_topic, payload.c_str());
  } 
  // HIER KEIN DELAY MEHR! Die Schleife rast weiter und hält MQTT am Leben.
}