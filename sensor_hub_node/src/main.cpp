/**
 * @file main.cpp
 * @brief Smart Medical Waiting Room - Connected Edge Node
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
const char* ssid = "DEIN_WLAN_NAME";         // <-- 2.4 GHz WLAN eintragen
const char* password = "DEIN_WLAN_PASSWORT"; // <-- WLAN Passwort eintragen

// Öffentlicher MQTT Test-Server
const char* mqtt_server = "localhost";
const int mqtt_port = 1883;
// WICHTIG: Denk dir hier einen EIGENEN, einzigartigen Namen aus!
const char* mqtt_topic = "karlsruhe/medical/sensor_dein_name"; 

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
void setup_wifi() {
  Serial.println("\n--- Netzwerk Setup ---");
  Serial.print("Verbinde mit WLAN: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[SUCCESS] WLAN verbunden!");
  Serial.print("IP-Adresse: ");
  Serial.println(WiFi.localIP());
}

/**
 * @brief Hält die MQTT-Verbindung aufrecht
 */
void reconnect_mqtt() {
  while (!mqttClient.connected()) {
    Serial.print("Verbinde mit MQTT-Broker...");
    String clientId = "ESP32-Medical-";
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
  // WLAN Check
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARNUNG] WLAN verloren. Verbinde neu...");
    WiFi.disconnect();
    WiFi.reconnect();
    delay(5000);
    return;
  }

  // MQTT Check
  if (!mqttClient.connected()) {
    reconnect_mqtt();
  }
  mqttClient.loop(); // Wichtig, damit MQTT im Hintergrund läuft

  // Sensoren auslesen
  envMonitor.update();
  patientCounter.update();
  gasAlarm.update();

  // JSON zusammenbauen
  StaticJsonDocument<256> doc; 
  doc["room"] = "waiting_room_1";
  doc["temperature_c"] = envMonitor.getTemperature();
  doc["humidity_percent"] = envMonitor.getHumidity();
  doc["pressure_hpa"] = envMonitor.getPressure();
  doc["door_distance_mm"] = patientCounter.getDistance();
  doc["gas_adc_level"] = gasAlarm.getGasLevel();

  // Senden!
  String payload;
  serializeJson(doc, payload);

  Serial.print("Sende MQTT -> ");
  Serial.println(payload);
  
  // payload.c_str() wandelt den Arduino-String in ein für MQTT lesbares Format um
  mqttClient.publish(mqtt_topic, payload.c_str());

  // Wir senden nur alle 3 Sekunden, um den Server nicht zu fluten
  delay(3000); 
}