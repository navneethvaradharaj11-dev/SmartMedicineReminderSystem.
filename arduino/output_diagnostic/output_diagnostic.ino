#include <SoftwareSerial.h>

#define PIN_BUZZER        8
#define PIN_LED           7
#define PIN_BT_TX         9
#define PIN_BT_RX         10
#define BT_BAUD           9600
#define BUZZER_TONE_HZ    2000

SoftwareSerial bluetooth(PIN_BT_RX, PIN_BT_TX);

void setup() {
  Serial.begin(BT_BAUD);
  bluetooth.begin(BT_BAUD);

  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED, OUTPUT);

  allOutputsOff();
  sendBt("BT|DIAG|OUTPUT|READY");
}

void loop() {
  sendBt("BT|DIAG|OUTPUT|LED_PIN_7");
  digitalWrite(PIN_LED, HIGH);
  delay(700);
  digitalWrite(PIN_LED, LOW);
  delay(300);

  sendBt("BT|DIAG|OUTPUT|BUZZER_TONE");
  tone(PIN_BUZZER, BUZZER_TONE_HZ);
  delay(700);
  noTone(PIN_BUZZER);
  digitalWrite(PIN_BUZZER, LOW);
  delay(1200);
}

void sendBt(const String& message) {
  bluetooth.println(message);
  Serial.println(message);
}

void allOutputsOff() {
  noTone(PIN_BUZZER);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED, LOW);
}
