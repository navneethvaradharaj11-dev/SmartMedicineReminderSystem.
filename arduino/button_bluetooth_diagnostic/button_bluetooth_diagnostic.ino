#include <SoftwareSerial.h>

#define PIN_BTN_CONFIRM   2
#define PIN_BTN_SNOOZE    3
#define PIN_LIMIT_SWITCH  4
#define PIN_LED           7
#define PIN_BT_TX         9
#define PIN_BT_RX         10
#define BT_BAUD           9600

SoftwareSerial bluetooth(PIN_BT_RX, PIN_BT_TX);

unsigned long lastConfirm = 0;
unsigned long lastSnooze = 0;
unsigned long lastBox = 0;
unsigned long lastHeartbeat = 0;

const unsigned long DEBOUNCE_MS = 200;

void setup() {
  Serial.begin(BT_BAUD);
  Serial.setTimeout(20);
  bluetooth.begin(BT_BAUD);
  bluetooth.setTimeout(20);

  pinMode(PIN_BTN_CONFIRM, INPUT_PULLUP);
  pinMode(PIN_BTN_SNOOZE, INPUT_PULLUP);
  pinMode(PIN_LIMIT_SWITCH, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);

  sendBt("BT|DIAG|READY|Buttons use INPUT_PULLUP: pin -> switch -> GND");
}

void loop() {
  unsigned long now = millis();

  if (now - lastHeartbeat > 3000) {
    lastHeartbeat = now;
    sendBt("BT|DIAG|HEARTBEAT");
  }

  if (bluetooth.available()) {
    String command = bluetooth.readStringUntil('\n');
    command.trim();
    if (command.length() > 0) {
      sendBt("BT|DIAG|COMMAND|" + command);
    }
  }

  if (digitalRead(PIN_BTN_CONFIRM) == LOW && now - lastConfirm > DEBOUNCE_MS) {
    lastConfirm = now;
    flashLed();
    sendBt("BT|BUTTON|Confirm|Pressed");
  }

  if (digitalRead(PIN_BTN_SNOOZE) == LOW && now - lastSnooze > DEBOUNCE_MS) {
    lastSnooze = now;
    flashLed();
    sendBt("BT|BUTTON|Snooze|Pressed");
  }

  if (digitalRead(PIN_LIMIT_SWITCH) == LOW && now - lastBox > DEBOUNCE_MS) {
    lastBox = now;
    flashLed();
    sendBt("BT|BUTTON|Box opened|Pressed");
  }
}

void sendBt(const String& message) {
  bluetooth.println(message);
  Serial.println(message);
}

void flashLed() {
  digitalWrite(PIN_LED, HIGH);
  delay(80);
  digitalWrite(PIN_LED, LOW);
}
