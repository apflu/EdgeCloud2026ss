#ifndef ENVIRONMENT_MONITOR_H
#define ENVIRONMENT_MONITOR_H

#include <Arduino.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP280.h>

class EnvironmentMonitor {
  private:
    Adafruit_AHTX0 aht;
    Adafruit_BMP280 bmp;
    
    // Status-Flags (Fault Isolation)
    bool aht_ready;
    bool bmp_ready;
    
    float last_temp;
    float last_humidity;
    float last_pressure;

  public:
    bool begin();
    void update();
    float getTemperature();
    float getHumidity();
    float getPressure();
};

#endif