#include "GasAlarm.h"

bool GasAlarm::begin(int pin) {
  adc_pin = pin;
  pinMode(adc_pin, INPUT);
  last_gas_value = 0;
  
  // Analoge Pins können nicht wirklich "fehlschlagen", daher immer true
  return true; 
}

void GasAlarm::update() {
  // ADC liest die Spannung (0 bis 4095 beim ESP32)
  last_gas_value = analogRead(adc_pin);
}

int GasAlarm::getGasLevel() {
  return last_gas_value;
}