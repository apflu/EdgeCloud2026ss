#include <Arduino.h>
#include <driver/i2s.h>
#include <math.h>

// I2S Pin definitions - matching your terminal connections
#define I2S_BCLK  13
#define I2S_LRC   15
#define I2S_DOUT  8

// Audio config
#define SAMPLE_RATE     16000
#define AMPLITUDE       8000
#define DURATION_SEC    3 //I don't think we actually use this, just a reference time

void setupI2S() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX), //ESP is the controller, only sending audio out but not receiving
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,  //Audio Sample has to be 16 bit number (standard)
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,  //Makes the audio mono
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,  //Buffer for memory allow smooth audio streaming
    .dma_buf_len = 64,  //Buffer len is 64 and count 8, we have 8 buffers of 64 bytes each
    .use_apll = false,
    .tx_desc_auto_clear = true
  };

  i2s_pin_config_t pin_config = {  //Install the drivers with config and assign to the pins
    .bck_io_num   = I2S_BCLK,
    .ws_io_num    = I2S_LRC,
    .data_out_num = I2S_DOUT,
    .data_in_num  = I2S_PIN_NO_CHANGE
  };

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
  i2s_zero_dma_buffer(I2S_NUM_0); //Clear Buffer at the start
}

void playTone(int frequencyHz, int durationSec) { //How many samples, how long/ wave frequency, one at a time
  int totalSamples = SAMPLE_RATE * durationSec;
  size_t bytesWritten;

  for (int i = 0; i < totalSamples; i++) {
    int16_t sample = (int16_t)(AMPLITUDE * 
      sin(2.0 * PI * frequencyHz * i / SAMPLE_RATE));
    i2s_write(I2S_NUM_0, &sample, sizeof(sample), 
      &bytesWritten, portMAX_DELAY);
  }
}

void setup() {  //Expected: 3 different tunes for testing
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("Initializing...");
  setupI2S();
  Serial.println("I2S ready.");

  // Play 3 tones so you clearly know it's working
  Serial.println("Playing tone 1 - 440Hz (A4)");
  playTone(440, 1);

  delay(300);

  Serial.println("Playing tone 2 - 880Hz (A5)");
  playTone(880, 1);

  delay(300);

  Serial.println("Playing tone 3 - 660Hz (E5)");
  playTone(660, 1);

  Serial.println("END !!!");
}

void loop() {
  // Nothing - plays once on boot
  // Reset the board to play again
}