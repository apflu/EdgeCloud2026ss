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
const char* ssid = "OpenWRT-2.4G";         
const char* password = "FU12Labor"; 

const char* mqtt_server = "192.168.179.191";
const int mqtt_port = 1883;
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

void setup_wifi() {
  Serial.println("\n--- Netzwerk Setup ---");
  Serial.print("Verbinde mit WLAN: ");
  Serial.println(ssid);

  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info){
    if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
      Serial.print("\n[WLAN FEHLER] Verbindung abgelehnt! Reason-Code: ");
      Serial.println(info.wifi_sta_disconnected.reason);
    }
  });

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);
  delay(500);

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

  setup_wifi();
  mqttClient.setServer(mqtt_server, mqtt_port);
  
  // 🔴 HIER IST DER FIX FÜR GROSSE JSONS 🔴
  mqttClient.setBufferSize(1024); 

  Serial.println("\n--- Hardware Setup ---");
  envMonitor.begin();
  patientCounter.begin();
  gasAlarm.begin(GAS_PIN);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARNUNG] WLAN verloren. Verbinde neu...");
    WiFi.disconnect();
    WiFi.reconnect();
    delay(5000); 
    return;
  }

  if (!mqttClient.connected()) {
    reconnect_mqtt();
  }
  
  mqttClient.loop(); 


  static unsigned long lastMsgTime = 0; 
  unsigned long now = millis();

  // Alle 3 Sekunden das JSON senden
  if (now - lastMsgTime >= 3000) {
    lastMsgTime = now; 

    // Nur I2C und ADC Sensoren hier updaten (Radar wurde oben schon geupdatet)
    envMonitor.update();
    patientCounter.update();
    gasAlarm.update();

    DynamicJsonDocument doc(1024); 

    doc["roomId"] = "Room-101";
    
    char timeString[32];
    sprintf(timeString, "2026-06-18T12:00:%02d.%03dZ", (int)(now / 1000) % 60, (int)now % 1000);
    doc["timestamp"] = timeString; 

    JsonArray patients = doc.createNestedArray("patients");
    JsonObject patientA = patients.createNestedObject();
    
    patientA["patientId"] = "PATIENT-A"; 
    patientA["displayAlias"] = "Patient A (ESP32)"; 
    patientA["bedZone"] = "Bed A";

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
    


    JsonObject vitals = patientA.createNestedObject("vitals");
    vitals["heartRate"] = 133; 
    vitals["temperature"] = envMonitor.getTemperature(); 
    vitals["oxygenSaturation"] = 98;
    // Wir verstecken den Gas-Sensor bei den Vitals (oder wo es im Dashboard am besten passt)
    vitals["gas_adc_level"] = gasAlarm.getGasLevel(); 

    JsonArray devices = patientA.createNestedArray("devices");
    JsonObject dev1 = devices.createNestedObject();
    dev1["id"] = "esp32-s3-sensor-hub-01";
    dev1["type"] = "wearable";
    dev1["battery"] = 100;
    dev1["lastSeen"] = timeString; 

    String payload;
    serializeJson(doc, payload);

    Serial.println("\n--- Sende an Dashboard ---");
    serializeJsonPretty(doc, Serial);
    Serial.println();
    
    mqttClient.publish(mqtt_topic, payload.c_str());
  } 
}