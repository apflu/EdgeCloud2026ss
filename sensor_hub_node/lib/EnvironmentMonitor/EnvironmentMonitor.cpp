#include "EnvironmentMonitor.h"

bool EnvironmentMonitor::begin() {
  aht_ready = false;
  bmp_ready = false;
  
  // Wichtig für AHT20: Gib ihm kurz Zeit zum Aufwachen!
  delay(100); 

  // AHT20 Start
  if (aht.begin()) {
    aht_ready = true;
  } else {
    Serial.println("[WARNUNG] AHT20 ist offline oder blockiert.");
  }
  
  // BMP280 Start
  if (bmp.begin(0x77)) {
    bmp_ready = true;
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,     
                    Adafruit_BMP280::SAMPLING_X2,     
                    Adafruit_BMP280::SAMPLING_X16,    
                    Adafruit_BMP280::FILTER_X16,      
                    Adafruit_BMP280::STANDBY_MS_500);
  } else {
    Serial.println("[WARNUNG] BMP280 ist offline auf Adresse 0x77.");
  }
  
  last_temp = -999.0;
  last_humidity = -999.0;
  last_pressure = -999.0;

  // Modul ist erfolgreich, wenn ZUMINDEST EIN Sensor läuft!
  return (aht_ready || bmp_ready); 
}

void EnvironmentMonitor::update() {
  // Nur abfragen, wenn der Sensor auch wirklich lebt! (Bus-Schutz)
  if (aht_ready) {
    sensors_event_t humidity, temp;
    if (aht.getEvent(&humidity, &temp)) {
      last_temp = temp.temperature;
      last_humidity = humidity.relative_humidity;
    } else {
      last_temp = -999.0; 
      last_humidity = -999.0;
    }
  } else {
    last_temp = -999.0; 
    last_humidity = -999.0;
  }

  if (bmp_ready) {
    float p = bmp.readPressure();
    if (!isnan(p) && p > 0) {
      last_pressure = p / 100.0;
    } else {
      last_pressure = -999.0;
    }
  } else {
    last_pressure = -999.0;
  }
}

float EnvironmentMonitor::getTemperature() { return last_temp; }
float EnvironmentMonitor::getHumidity() { return last_humidity; }
float EnvironmentMonitor::getPressure() { return last_pressure; }