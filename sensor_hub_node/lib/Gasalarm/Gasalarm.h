#ifndef GAS_ALARM_H
#define GAS_ALARM_H

#include <Arduino.h>

class GasAlarm {
  private:
    int adc_pin;
    int last_gas_value;

  public:
    // Wir übergeben den Pin bei der Initialisierung
    bool begin(int pin);
    void update();
    int getGasLevel();
};

#endif