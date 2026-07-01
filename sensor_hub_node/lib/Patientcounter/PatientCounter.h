#ifndef PATIENT_COUNTER_H
#define PATIENT_COUNTER_H

#include <Arduino.h>
#include <Adafruit_VL53L0X.h>

class PatientCounter {
  private:
    Adafruit_VL53L0X lox;
    bool is_ready;
    int last_distance_mm;

    // --- Debounced presence state ---
    // The raw VL53L0X reading flickers near the detection threshold and drops
    // out to an error status for single frames. Counting arrivals directly off
    // that raw signal produced thousands of phantom patients. We therefore
    // debounce here: hysteresis dead-band + N consecutive confirmations, and a
    // failed measurement HOLDS the previous state instead of flipping it.
    bool present;             // stable, debounced "someone is in range"
    uint8_t enter_streak;     // consecutive confirmed in-range samples
    uint8_t exit_streak;      // consecutive confirmed out-of-range samples
    unsigned long count;      // rising-edge count on the DEBOUNCED signal

  public:
    bool begin();
    void update();
    int getDistance();

    // Debounced outputs — use these for occupancy/patient counting, not the
    // raw distance, to avoid phantom counts from sensor flicker.
    bool isPresent();
    unsigned long getCount();
    void resetCount();
};

#endif
