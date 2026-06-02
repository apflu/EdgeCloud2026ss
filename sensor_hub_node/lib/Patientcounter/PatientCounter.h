#ifndef PATIENT_COUNTER_H
#define PATIENT_COUNTER_H

#include <Arduino.h>
#include <Adafruit_VL53L0X.h>

class PatientCounter {
  private:
    Adafruit_VL53L0X lox;
    bool is_ready;
    int last_distance_mm;

  public:
    bool begin();
    void update();
    int getDistance();
};

#endif